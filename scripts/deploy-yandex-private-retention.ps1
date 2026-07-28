param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$bucket = "assessment-b1gafbjd3dlh-private"
$configPath = Join-Path $repoRoot "cloud\private-bucket-lifecycle.json"
$expected = [ordered]@{
  "expire-assessment-reports-365d" = @{ Prefix = "reports/"; Days = 365; AbortDays = 0 }
  "expire-deletion-backups-30d" = @{ Prefix = "deletion-backups/"; Days = 30; AbortDays = 0 }
  "expire-function-packages-1d" = @{ Prefix = "packages/"; Days = 1; AbortDays = 0 }
  "expire-bank-staging-1d" = @{ Prefix = "bank-staging/"; Days = 1; AbortDays = 0 }
  "abort-incomplete-multipart-1d" = @{ Prefix = ""; Days = 0; AbortDays = 1 }
}

function Invoke-YcJson([string[]]$arguments) {
  $raw = & $yc @arguments --format json
  if ($LASTEXITCODE -ne 0) { throw "Yandex CLI command failed." }
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

function Assert-BucketBoundary([object]$bucketInfo) {
  if ([string]$bucketInfo.name -ne $bucket -or [long]$bucketInfo.max_size -ne 1073741824 -or
      $bucketInfo.anonymous_access_flags.read -eq $true -or $bucketInfo.anonymous_access_flags.list -eq $true -or
      $bucketInfo.disabled_statickey_auth -ne $true -or [string]$bucketInfo.default_storage_class -ne "STANDARD" -or
      [string]$bucketInfo.versioning -ne "VERSIONING_DISABLED") {
    throw "Private bucket boundary differs from the approved fail-closed configuration."
  }
}

function Normalize-Rules([object]$source) {
  $rules = Read-Property $source @("lifecycle_rules", "lifecycleRules")
  if ($null -eq $rules) { return @() }
  if ($rules -is [System.Array]) {
    foreach ($rule in $rules) { Write-Output $rule }
    return
  }
  if ($null -ne $rules.PSObject.Properties["id"]) { return $rules }
  $nested = Read-Property $rules @("rules", "lifecycle_rules", "lifecycleRules")
  if ($null -eq $nested) { return @() }
  foreach ($rule in $nested) { Write-Output $rule }
}

function Assert-ExactRules([object[]]$rules) {
  if (@($rules).Count -ne $expected.Count) { throw "Unexpected lifecycle rule count." }
  foreach ($rule in @($rules)) {
    $id = [string](Read-Property $rule @("id"))
    if (-not $expected.Contains($id)) { throw "Unexpected lifecycle rule." }
    if ((Read-Property $rule @("enabled")) -ne $true) { throw "Lifecycle rule is disabled." }
    $filter = Read-Property $rule @("filter")
    $prefix = [string](Read-Property $filter @("prefix"))
    if ($prefix -ne [string]$expected[$id].Prefix) { throw "Lifecycle prefix mismatch." }
    $expiration = Read-Property $rule @("expiration")
    $days = if ($null -eq $expiration) { 0 } else { [int](Read-Property $expiration @("days")) }
    $abort = Read-Property $rule @("abort_incomplete_multipart_upload", "abortIncompleteMultipartUpload")
    $abortDays = if ($null -eq $abort) { 0 } else { [int](Read-Property $abort @("days_after_expiration", "daysAfterExpiration")) }
    if ($days -ne [int]$expected[$id].Days -or $abortDays -ne [int]$expected[$id].AbortDays) {
      throw "Lifecycle duration mismatch."
    }
  }
}

if (-not (Test-Path -LiteralPath $yc -PathType Leaf) -or -not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Required retention deployment input is missing."
}

$config = Get-Content -Raw -Encoding UTF8 $configPath | ConvertFrom-Json
Assert-ExactRules @($config.lifecycleRules)

$before = Invoke-YcJson @("storage", "bucket", "get", $bucket, "--full")
Assert-BucketBoundary $before
$currentRules = @(Normalize-Rules $before)
if ($currentRules.Count -gt 0) { Assert-ExactRules $currentRules }

$null = Invoke-YcJson @("storage", "bucket", "update", $bucket, "--lifecycle-rules-from-file", $configPath)
$after = Invoke-YcJson @("storage", "bucket", "get", $bucket, "--full")
Assert-BucketBoundary $after
Assert-ExactRules @(Normalize-Rules $after)

Write-Host "DONE: private Object Storage retention verified (reports 365d, backups 30d, temporary artifacts 1d)."
