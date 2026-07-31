param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$allowedOrigins = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$packagePath = Join-Path $env:TEMP ("skillcheck-runtime-v6-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""

$versions = @(
  @{ SourceTag = "assessment-v7"; TargetTag = "assessment-v8"; ExpectedMode = "assessment" },
  @{ SourceTag = "admin-v4"; TargetTag = "admin-v5"; ExpectedMode = "admin" },
  @{ SourceTag = "read-v5"; TargetTag = "read-v6"; ExpectedMode = "read" },
  @{ SourceTag = "write-v7"; TargetTag = "write-v8"; ExpectedMode = "write" }
)
$retiredTags = @()

function Get-Version([string]$tag) {
  $raw = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json
  if ($LASTEXITCODE -ne 0) { throw "Required source runtime version is unavailable." }
  return $raw | ConvertFrom-Json
}

function Build-Environment([object]$source, [string]$expectedMode) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($property in $source.environment.PSObject.Properties) {
    if ($property.Name -eq "ALLOWED_ORIGINS") { continue }
    if ([string]$property.Value -match "[,`r`n]") { throw "Runtime environment value cannot be safely forwarded by CLI." }
    $pairs.Add($property.Name + "=" + [string]$property.Value)
  }
  if ([string]$source.environment.RUNTIME_MODE -ne $expectedMode) { throw "Runtime mode/tag mismatch." }
  $pairs.Add("ALLOWED_ORIGINS=" + $allowedOrigins)
  return [string]::Join(",", $pairs)
}

try {
  foreach ($path in @($yc, $gatewaySpec, (Join-Path $repoRoot "cloud\assessment-core.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required runtime deployment input is missing." }
  }
  & node (Join-Path $PSScriptRoot "verify-reviewed-v5-artifacts.js") `
    --private-dir (Join-Path $workspaceRoot "skillcheck-private-v5-ai-r1") `
    --public-dir (Join-Path $repoRoot "data") `
    --baseline-private-dir (Join-Path $workspaceRoot "skillcheck-private-v4-r3")
  if ($LASTEXITCODE -ne 0) { throw "Reviewed v5 artifact verification failed." }

  $sourceVersions = @{}
  foreach ($item in $versions) { $sourceVersions[$item.SourceTag] = Get-Version $item.SourceTag }
  foreach ($retiredTag in $retiredTags) {
    $retired = Get-Version $retiredTag
    $null = & $yc serverless function version remove-tag --id ([string]$retired.id) --tag $retiredTag --format json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Legacy tag retirement failed." }
    Write-Host ("Retired legacy tag without deleting version: " + $retiredTag)
  }

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  if ($LASTEXITCODE -ne 0 -or $archiveEntries -notcontains "assessment-core.js" -or $archiveEntries -notcontains "index.js" -or
      ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' })) {
    throw "Runtime package boundary is invalid."
  }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/runtime-v6-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  foreach ($item in $versions) {
    $source = $sourceVersions[$item.SourceTag]
    $environment = Build-Environment $source $item.ExpectedMode
    $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
    $memoryMb = [int]([long]$source.resources.memory / 1MB)
    $createdRaw = & $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
      --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
      --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
      --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
      --description ("Reviewed v5 banks successor of " + $item.SourceTag) --environment $environment `
      --tags $item.TargetTag --concurrency ([int]$source.concurrency) --no-logging --format json
    if ($LASTEXITCODE -ne 0) { throw "Runtime successor creation failed." }
    $created = $createdRaw | ConvertFrom-Json
    if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Runtime successor id is missing." }
    Write-Host ($item.TargetTag + " ready: " + [string]$created.id)
  }

  $null = & $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway cutover failed." }
  Write-Host "DONE: v5-aware runtime successors are deployed and routed; prior tags remain available for rollback."
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) {
    & $yc storage s3 rm $packageUri --only-show-errors | Out-Null
  }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
}
