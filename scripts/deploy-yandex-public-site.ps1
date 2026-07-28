param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$bucket = "assessment-b1gafbjd3dlh-web"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$websiteSettings = Join-Path $repoRoot "cloud\public-website-settings.json"
$siteOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$githubOrigin = "https://capssman.github.io"
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

function Invoke-YcJson([string[]]$arguments) {
  $raw = & $yc @arguments --format json
  if ($LASTEXITCODE -ne 0) { throw "Yandex CLI command failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return $null }
  return $raw | ConvertFrom-Json
}

function Read-Property([object]$source, [string[]]$names) {
  if ($null -eq $source) { return $null }
  foreach ($name in $names) {
    $property = $source.PSObject.Properties[$name]
    if ($null -ne $property) { return $property.Value }
  }
  return $null
}

function Get-ObjectKeys() {
  $page = Invoke-YcJson @("storage", "s3api", "list-objects", "--bucket", $bucket, "--max-keys", "1000")
  if ($null -eq $page) { return @() }
  $truncated = Read-Property $page @("is_truncated", "isTruncated")
  if ($truncated -eq $true) { throw "Public bucket contains more objects than the deployment boundary allows." }
  $contents = Read-Property $page @("contents")
  if ($null -eq $contents) { return @() }
  foreach ($item in @($contents)) { Write-Output ([string]$item.key) }
}

function Assert-ExactBucketBoundary([object]$bucketInfo) {
  $anonymous = Read-Property $bucketInfo @("anonymous_access_flags", "anonymousAccessFlags")
  $website = Read-Property $bucketInfo @("website_settings", "websiteSettings")
  if ([string]$bucketInfo.name -ne $bucket -or [long]$bucketInfo.max_size -ne 104857600 -or
      [string]$bucketInfo.default_storage_class -ne "STANDARD" -or
      [string]$bucketInfo.versioning -ne "VERSIONING_DISABLED" -or
      (Read-Property $anonymous @("read")) -ne $true -or (Read-Property $anonymous @("list")) -ne $true -or
      (Read-Property $anonymous @("config_read", "configRead")) -eq $true -or
      (Read-Property $bucketInfo @("disabled_statickey_auth", "disabledStatickeyAuth")) -ne $true -or
      [string](Read-Property $website @("index")) -ne "index.html" -or
      [string](Read-Property $website @("error")) -ne "index.html") {
    throw "Public website bucket differs from the approved 100 MB static-hosting boundary."
  }
}

function Get-ContentType([string]$relativePath) {
  if ($relativePath.EndsWith(".html", [StringComparison]::OrdinalIgnoreCase)) { return "text/html; charset=utf-8" }
  if ($relativePath.EndsWith(".json", [StringComparison]::OrdinalIgnoreCase)) { return "application/json; charset=utf-8" }
  throw "Unsupported public file type."
}

function Get-CacheControl([string]$relativePath) {
  if ($relativePath.EndsWith(".html", [StringComparison]::OrdinalIgnoreCase)) { return "no-cache" }
  return "public, max-age=300, must-revalidate"
}

if (-not (Test-Path -LiteralPath $yc -PathType Leaf)) { throw "Yandex CLI is missing." }
foreach ($path in @($gatewaySpec, $websiteSettings)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required deployment configuration is missing." }
}
if ($publicFiles.Count -ne 13 -or @($publicFiles | Sort-Object -Unique).Count -ne 13) {
  throw "Public deployment allowlist must contain exactly 13 unique files."
}
foreach ($relativePath in $publicFiles) {
  if ($relativePath -match "(^|/)(?:cloud|docs|scripts|apps-script|private)(/|$)" -or $relativePath -match "\.\.") {
    throw "Public deployment allowlist escaped its boundary."
  }
  $source = Join-Path $repoRoot ($relativePath -replace "/", "\")
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Allowlisted public file is missing: $relativePath" }
}

foreach ($validator in @("check-static-links.js", "test-public-bank-secrecy.js", "test-candidate-ux.js", "test-yandex-public-site-deployment.js")) {
  & node (Join-Path $PSScriptRoot $validator)
  if ($LASTEXITCODE -ne 0) { throw "Public deployment validator failed." }
}

$existingKeys = @(Get-ObjectKeys)
$unexpectedBefore = @($existingKeys | Where-Object { $publicFiles -notcontains $_ })
if ($unexpectedBefore.Count -gt 0) { throw "Public bucket contains an object outside the approved allowlist." }

$null = Invoke-YcJson @("serverless", "api-gateway", "update", "--id", $gatewayId, "--spec", $gatewaySpec, "--no-logging")

foreach ($relativePath in $publicFiles) {
  $source = Join-Path $repoRoot ($relativePath -replace "/", "\")
  $bytes = [IO.File]::ReadAllBytes($source)
  $md5Algorithm = [Security.Cryptography.MD5]::Create()
  try { $md5 = [Convert]::ToBase64String($md5Algorithm.ComputeHash($bytes)) }
  finally { $md5Algorithm.Dispose() }
  $contentType = Get-ContentType $relativePath
  $cacheControl = Get-CacheControl $relativePath
  $null = Invoke-YcJson @(
    "storage", "s3api", "put-object", "--bucket", $bucket, "--key", $relativePath, "--body", $source,
    "--content-md5", $md5, "--content-type", $contentType, "--cache-control", $cacheControl
  )
  $head = Invoke-YcJson @("storage", "s3api", "head-object", "--bucket", $bucket, "--key", $relativePath)
  $contentLength = [long](Read-Property $head @("content_length", "contentLength"))
  if ($contentLength -ne $bytes.LongLength) { throw "Uploaded byte length mismatch: $relativePath" }
}

$null = Invoke-YcJson @(
  "storage", "bucket", "update", $bucket, "--public-read", "--public-list",
  "--disable-statickey-auth=true", "--website-settings-from-file", $websiteSettings
)
$bucketAfter = Invoke-YcJson @("storage", "bucket", "get", $bucket, "--full")
Assert-ExactBucketBoundary $bucketAfter

$actualKeys = @(Get-ObjectKeys | Sort-Object)
$expectedKeys = @($publicFiles | Sort-Object)
if ([string]::Join("`n", $actualKeys) -ne [string]::Join("`n", $expectedKeys)) {
  throw "Public bucket object set does not exactly match the approved allowlist."
}

$temporary = Join-Path $env:TEMP ("skillcheck-public-verify-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
  foreach ($relativePath in $publicFiles) {
    $target = Join-Path $temporary ([IO.Path]::GetFileName($relativePath))
    Invoke-WebRequest -Uri ($siteOrigin + "/" + $relativePath) -UseBasicParsing -TimeoutSec 30 -OutFile $target
    $source = Join-Path $repoRoot ($relativePath -replace "/", "\")
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash) {
      throw "Live website checksum mismatch: $relativePath"
    }
  }
  $rootTarget = Join-Path $temporary "root-index.html"
  Invoke-WebRequest -Uri ($siteOrigin + "/") -UseBasicParsing -TimeoutSec 30 -OutFile $rootTarget
  if ((Get-FileHash -LiteralPath $rootTarget -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $repoRoot "index.html") -Algorithm SHA256).Hash) {
    throw "Website root does not serve index.html."
  }
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}

$apiBase = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$assessmentUrl = $apiBase + "/v1/assessment"
$closedBody = [ordered]@{
  action = "beginAttempt"; apiVersion = "attempt-v2"; beginRequestId = "scb_" + "a" * 24; testId = "fa-junior";
  inviteCode = "SC1-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"; email = "closed@example.invalid";
  browserFingerprint = "deadbeef"; clientBuild = "yandex-public-site-deploy"; privacyConsent = $true;
  privacyConsentVersion = "skillcheck-pd-consent-2026-07-27-v3"; ageConfirmed = $true
}
foreach ($origin in @($siteOrigin, $githubOrigin)) {
  $options = Invoke-WebRequest -Method OPTIONS -Uri $assessmentUrl -Headers @{
    Origin = $origin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  } -UseBasicParsing -TimeoutSec 30
  if ([int]$options.StatusCode -ne 204 -or [string]$options.Headers["Access-Control-Allow-Origin"] -ne $origin) {
    throw "CORS preflight failed for an approved frontend origin."
  }
  foreach ($apiPath in @("/v1/assessment", "/v1/admin", "/v1/ranking?testId=fa-junior")) {
    $getResponse = Invoke-WebRequest -Method GET -Uri ($apiBase + $apiPath) -Headers @{ Origin = $origin } `
      -UseBasicParsing -TimeoutSec 30
    if ([int]$getResponse.StatusCode -ne 200 -or [string]$getResponse.Headers["Access-Control-Allow-Origin"] -ne $origin) {
      throw "Actual API response CORS failed for an approved frontend origin."
    }
  }
  $closedResponse = Invoke-WebRequest -Method POST -Uri $assessmentUrl -Headers @{ Origin = $origin } `
    -ContentType "application/json; charset=utf-8" -Body ($closedBody | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 30
  $closed = $closedResponse.Content | ConvertFrom-Json
  if ([string]$closedResponse.Headers["Access-Control-Allow-Origin"] -ne $origin -or
      $closed.ok -ne $false -or [string]$closed.failureCode -ne "attempt_unavailable") {
    throw "Actual assessment response CORS or fail-closed pilot gate verification failed."
  }
}

Write-Host "DONE: 13 public files are live in Yandex Object Storage; both frontend origins pass preflight and actual-response CORS; pilot gate remains closed."
Write-Host $siteOrigin