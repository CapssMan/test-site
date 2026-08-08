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
$operatorAddressInput = Join-Path $repoRoot "operator-private\roskomnadzor-2026-07-31\10_PUBLIC_OPERATOR_ADDRESS_INPUT.txt"
$operatorAddressPlaceholder = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("W9CQ0LTRgNC10YEg0L7Qv9C10YDQsNGC0L7RgNCwINC+0L/Rg9Cx0LvQuNC60L7QstCw0L0g0L3QsCDQvtGB0L3QvtCy0L3QvtC8INGB0LDQudGC0LUgWWFuZGV4IENsb3VkXQ=="))
$operatorAddressFiles = @("privacy.html", "consent.html", "ranking-consent.html")
$siteOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$githubOrigin = "https://capssman.github.io"
$publicFiles = @(
  "index.html",
  "preview-v2.html",
  "preview-v3.html",
  "assets/preview-v3.css",
  "assets/preview-v3.js",
  "social-preview.png",
  "social-preview.svg",
  "test.html",
  "admin.html",
  "privacy.html",
  "consent.html",
  "ranking.html",
  "ranking-consent.html",
  "account.html",
  "account-consent.html",
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
  if ($relativePath.EndsWith(".svg", [StringComparison]::OrdinalIgnoreCase)) { return "image/svg+xml; charset=utf-8" }
  if ($relativePath.EndsWith(".png", [StringComparison]::OrdinalIgnoreCase)) { return "image/png" }
  if ($relativePath.EndsWith(".css", [StringComparison]::OrdinalIgnoreCase)) { return "text/css; charset=utf-8" }
  if ($relativePath.EndsWith(".js", [StringComparison]::OrdinalIgnoreCase)) { return "text/javascript; charset=utf-8" }
  throw "Unsupported public file type."
}

function Get-CacheControl([string]$relativePath) {
  if ($relativePath.EndsWith(".html", [StringComparison]::OrdinalIgnoreCase)) { return "no-cache" }
  return "public, max-age=300, must-revalidate"
}

function Read-OperatorPublicAddress() {
  if (-not (Test-Path -LiteralPath $operatorAddressInput -PathType Leaf)) {
    throw "Local operator address input is missing."
  }
  $record = [IO.File]::ReadAllLines($operatorAddressInput) |
    Where-Object { $_ -match '^PUBLIC_OPERATOR_ADDRESS=' } |
    Select-Object -First 1
  if ([String]::IsNullOrWhiteSpace($record)) { throw "Local operator address field is missing." }
  $address = $record.Substring($record.IndexOf('=') + 1).Trim().TrimEnd('.')
  if ($address.Length -lt 20 -or $address.Length -gt 300 -or $address -match '[<>]') {
    throw "Local operator address value is invalid."
  }
  return $address
}

function Get-PublicBytes([string]$source, [string]$relativePath, [string]$operatorAddress) {
  if ($operatorAddressFiles -notcontains $relativePath) { return ,([IO.File]::ReadAllBytes($source)) }
  $template = [IO.File]::ReadAllText($source)
  if (([regex]::Matches($template, [regex]::Escape($operatorAddressPlaceholder))).Count -ne 1) {
    throw "Operator address placeholder count is invalid: $relativePath"
  }
  $rendered = $template.Replace($operatorAddressPlaceholder, [Net.WebUtility]::HtmlEncode($operatorAddress))
  return ,([Text.UTF8Encoding]::new($false).GetBytes($rendered))
}

if (-not (Test-Path -LiteralPath $yc -PathType Leaf)) { throw "Yandex CLI is missing." }
foreach ($path in @($gatewaySpec, $websiteSettings)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required deployment configuration is missing." }
}
if ($publicFiles.Count -ne 21 -or @($publicFiles | Sort-Object -Unique).Count -ne 21) {
  throw "Public deployment allowlist must contain exactly 19 unique files."
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

$operatorAddress = Read-OperatorPublicAddress
$expectedSha256 = @{}
$existingKeys = @(Get-ObjectKeys)
$unexpectedBefore = @($existingKeys | Where-Object { $publicFiles -notcontains $_ })
if ($unexpectedBefore.Count -gt 0) { throw "Public bucket contains an object outside the approved allowlist." }

$null = Invoke-YcJson @("serverless", "api-gateway", "update", "--id", $gatewayId, "--spec", $gatewaySpec, "--no-logging")

foreach ($relativePath in $publicFiles) {
  $source = Join-Path $repoRoot ($relativePath -replace "/", "\")
  $bytes = Get-PublicBytes $source $relativePath $operatorAddress
  $md5Algorithm = [Security.Cryptography.MD5]::Create()
  try { $md5 = [Convert]::ToBase64String($md5Algorithm.ComputeHash($bytes)) }
  finally { $md5Algorithm.Dispose() }
  $shaAlgorithm = [Security.Cryptography.SHA256]::Create()
  try { $expectedSha256[$relativePath] = ([BitConverter]::ToString($shaAlgorithm.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() }
  finally { $shaAlgorithm.Dispose() }
  $contentType = Get-ContentType $relativePath
  $cacheControl = Get-CacheControl $relativePath
  $uploadSource = $source
  $renderedPath = ""
  if ($operatorAddressFiles -contains $relativePath) {
    $renderedPath = Join-Path $env:TEMP ("skillcheck-public-render-" + [Guid]::NewGuid().ToString("N") + ".html")
    [IO.File]::WriteAllBytes($renderedPath, $bytes)
    $uploadSource = $renderedPath
  }
  try {
    $null = Invoke-YcJson @(
      "storage", "s3api", "put-object", "--bucket", $bucket, "--key", $relativePath, "--body", $uploadSource,
      "--content-md5", $md5, "--content-type", $contentType, "--cache-control", $cacheControl
    )
  } finally {
    if (-not [String]::IsNullOrWhiteSpace($renderedPath)) {
      Remove-Item -LiteralPath $renderedPath -Force -ErrorAction SilentlyContinue
    }
  }
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
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$expectedSha256[$relativePath]) {
      throw "Live website checksum mismatch: $relativePath"
    }
  }
  $rootTarget = Join-Path $temporary "root-index.html"
  Invoke-WebRequest -Uri ($siteOrigin + "/") -UseBasicParsing -TimeoutSec 30 -OutFile $rootTarget
  if ((Get-FileHash -LiteralPath $rootTarget -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$expectedSha256["index.html"]) {
    throw "Website root does not serve index.html."
  }
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}

$apiBase = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$assessmentUrl = $apiBase + "/v1/assessment"
$invalidInviteBody = [ordered]@{
  action = "beginAttempt"; apiVersion = "attempt-v2"; beginRequestId = "scb_" + "a" * 24; testId = "fa-junior";
  inviteCode = "SC1-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"; email = "closed@example.invalid";
  browserFingerprint = "deadbeef"; clientBuild = "yandex-public-site-deploy"; privacyConsent = $true;
  privacyConsentVersion = "skillcheck-pd-consent-2026-07-31-v5"; ageConfirmed = $true
}
foreach ($origin in @($siteOrigin)) {
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
  $invalidInviteResponse = Invoke-WebRequest -Method POST -Uri $assessmentUrl -Headers @{ Origin = $origin } `
    -ContentType "application/json; charset=utf-8" -Body ($invalidInviteBody | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 30
  $invalidInvite = $invalidInviteResponse.Content | ConvertFrom-Json
  if ([string]$invalidInviteResponse.Headers["Access-Control-Allow-Origin"] -ne $origin -or
      $invalidInvite.ok -ne $false -or [string]$invalidInvite.failureCode -ne "attempt_unavailable") {
    throw "Actual assessment response CORS or invalid-invite privacy check failed."
  }
}

$deniedOptions = Invoke-WebRequest -Method OPTIONS -Uri $assessmentUrl -Headers @{
  Origin = $githubOrigin
  "Access-Control-Request-Method" = "POST"
  "Access-Control-Request-Headers" = "content-type"
} -UseBasicParsing -TimeoutSec 30
if ([string]$deniedOptions.Headers["Access-Control-Allow-Origin"] -eq $githubOrigin) {
  throw "GitHub fallback unexpectedly received candidate API CORS."
}
Write-Host "DONE: 19 public files are live in Yandex Object Storage; Yandex origin passes API CORS; GitHub fallback is denied; invalid invitation remains privacy-preserving and creates no attempt."
Write-Host $siteOrigin