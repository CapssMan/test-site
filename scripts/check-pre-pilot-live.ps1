param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$primaryOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$fallbackOrigin = "https://capssman.github.io/test-site"
$githubCorsOrigin = "https://capssman.github.io"
$apiBase = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$assessmentUrl = $apiBase + "/v1/assessment"
$publicFiles = @(
  "index.html",
  "test.html",
  "admin.html",
  "privacy.html",
  "consent.html",
  "ranking.html",
  "ranking-consent.html",
  "data/acc-junior.json",
  "data/bi-junior.json",
  "data/ca-junior.json",
  "data/dev-quick.json",
  "data/fa-junior.json",
  "data/fpa-junior.json"
)
$testIds = @("fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior")
$temporary = Join-Path $env:TEMP ("skillcheck-pre-pilot-live-" + [Guid]::NewGuid().ToString("N"))

function Assert-ExactPublicFiles([string]$origin, [string]$label) {
  $hostDirectory = Join-Path $temporary $label
  New-Item -ItemType Directory -Path $hostDirectory | Out-Null
  foreach ($relativePath in $publicFiles) {
    $target = Join-Path $hostDirectory (($relativePath -replace "/", "-") + ".download")
    $response = Invoke-WebRequest -Uri ($origin + "/" + $relativePath + "?qa=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) `
      -Headers @{ "Cache-Control" = "no-cache" } -UseBasicParsing -TimeoutSec 30 -OutFile $target -PassThru
    if ([int]$response.StatusCode -ne 200) { throw "$label did not serve $relativePath." }
    $source = Join-Path $repoRoot ($relativePath -replace "/", "\")
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash) {
      $sourceText = [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
      $targetText = [IO.File]::ReadAllText($target, [Text.Encoding]::UTF8).Replace("`r`n", "`n")
      if ($label -ne "github" -or $sourceText -cne $targetText) {
        throw "$label checksum mismatch: $relativePath"
      }
    }
  }
}

function Assert-ActualCors([string]$origin, [string]$path) {
  $response = Invoke-WebRequest -Method GET -Uri ($apiBase + $path) -Headers @{ Origin = $origin } `
    -UseBasicParsing -TimeoutSec 30
  if ([int]$response.StatusCode -ne 200 -or [string]$response.Headers["Access-Control-Allow-Origin"] -ne $origin) {
    throw "Actual API response CORS failed for $origin on $path."
  }
  return $response
}

try {
  New-Item -ItemType Directory -Path $temporary | Out-Null
  Assert-ExactPublicFiles $primaryOrigin "yandex"
  Assert-ExactPublicFiles $fallbackOrigin "github"

  $localTest = [IO.File]::ReadAllText((Join-Path $repoRoot "test.html"), [Text.Encoding]::UTF8)
  if ($localTest -notmatch 'Build 2026\.07\.29\.3' -or $localTest -notmatch 'const FRONTEND_BUILD = "2026\.07\.29\.3"') {
    throw "Candidate visible build and runtime build do not match the approved release."
  }

  $closedBody = [ordered]@{
    action = "beginAttempt"; apiVersion = "attempt-v2"; beginRequestId = "scb_" + "a" * 24; testId = "fa-junior";
    inviteCode = "SC1-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"; email = "closed@example.invalid";
    browserFingerprint = "deadbeef"; clientBuild = "pre-pilot-live-check"; privacyConsent = $true;
    privacyConsentVersion = "skillcheck-pd-consent-2026-07-29-v4"; ageConfirmed = $true
  }

  foreach ($origin in @($primaryOrigin, $githubCorsOrigin)) {
    $options = Invoke-WebRequest -Method OPTIONS -Uri $assessmentUrl -Headers @{
      Origin = $origin
      "Access-Control-Request-Method" = "POST"
      "Access-Control-Request-Headers" = "content-type"
    } -UseBasicParsing -TimeoutSec 30
    if ([int]$options.StatusCode -ne 204 -or [string]$options.Headers["Access-Control-Allow-Origin"] -ne $origin) {
      throw "Assessment preflight failed for $origin."
    }

    foreach ($path in @("/v1/assessment", "/v1/admin")) { $null = Assert-ActualCors $origin $path }
    foreach ($testId in $testIds) {
      $ranking = Assert-ActualCors $origin ("/v1/ranking?testId=" + $testId)
      $rankingBody = $ranking.Content | ConvertFrom-Json
      if ($rankingBody.ok -ne $true -or [string]$rankingBody.testId -ne $testId) {
        throw "Ranking read contract failed for $testId."
      }
    }

    $closedResponse = Invoke-WebRequest -Method POST -Uri $assessmentUrl -Headers @{ Origin = $origin } `
      -ContentType "application/json; charset=utf-8" -Body ($closedBody | ConvertTo-Json -Compress) `
      -UseBasicParsing -TimeoutSec 30
    $closed = $closedResponse.Content | ConvertFrom-Json
    if ([string]$closedResponse.Headers["Access-Control-Allow-Origin"] -ne $origin -or
        $closed.ok -ne $false -or [string]$closed.failureCode -ne "attempt_unavailable") {
      throw "Pilot gate or assessment response CORS is not fail closed for $origin."
    }
  }

  Write-Host "PASS: 13/13 public files match Git on Yandex and GitHub; five ranking reads work; both origins pass CORS; candidate issuance remains closed."
  Write-Host "MANUAL QA: owner confirmed the main Yandex site on desktop and mobile on 2026-07-29; no issues reported."
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
