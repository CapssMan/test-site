param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$runtimeServiceAccountId = "ajesa9at6fmpd0ukbb25"
$assessmentUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/assessment"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$packagePath = Join-Path $env:TEMP ("skillcheck-owner-smoke-" + [Guid]::NewGuid().ToString("N") + ".zip")
$queryPath = Join-Path $env:TEMP ("skillcheck-owner-smoke-query-" + [Guid]::NewGuid().ToString("N") + ".sql")
$eventPath = Join-Path $env:TEMP ("skillcheck-owner-smoke-event-" + [Guid]::NewGuid().ToString("N") + ".json")
$packageUri = ""
$versionId = ""
$assessment = $null
$environment = ""
$packageBucket = ""
$packageSha = ""
$smokeSucceeded = $false

function Invoke-YdbJson([string]$query) {
  [IO.File]::WriteAllText($queryPath, $query, [Text.UTF8Encoding]::new($false))
  $raw = & $ydb -e $endpoint -d $database sql -f $queryPath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed -is [System.Array]) { foreach ($item in $parsed) { Write-Output $item }; return }
  return $parsed
}

function Assert-ClosedState() {
  $settings = @{}
  foreach ($row in @(Invoke-YdbJson "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;")) {
    $settings[[string]$row.setting_key] = [string]$row.setting_value
  }
  if ($settings.legal_pilot_approved -ne "false" -or $settings.attempt_issuance_enabled -ne "false" -or
      $settings.retention_automation_enabled -ne "true") { throw "Pilot gates are not closed." }
  foreach ($table in @("assessment_invites", "assessment_sessions", "assessment_results", "ranking_profiles")) {
    $rows = @(Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM $table;")
    if ($rows.Count -ne 1 -or [long]$rows[0].row_count -ne 0) { throw "Candidate table is not empty before/after owner smoke." }
  }
  $banks = @(Invoke-YdbJson "SELECT test_id FROM assessment_banks WHERE active = true;")
  if ($banks.Count -ne 5) { throw "Five active private banks are required." }
}

function Invoke-JsonPost([string]$url, [object]$body) {
  return Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json; charset=utf-8" -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 30
}

try {
  foreach ($path in @($yc, $ydb, (Join-Path $repoRoot "cloud\owner-smoke-handler.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required owner-smoke input is missing." }
  }
  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  Assert-ClosedState

  $assessmentRaw = & $yc serverless function version get-by-tag --function-id $functionId --tag assessment-v6 --format json
  if ($LASTEXITCODE -ne 0) { throw "Current assessment-v6 configuration is unavailable." }
  $assessment = $assessmentRaw | ConvertFrom-Json
  foreach ($name in @("ALLOWED_ORIGIN", "YDB_CONNECTION_STRING", "PRIVATE_BUCKET", "ATTEMPT_SIGNING_SECRET_V1", "INVITE_CODE_SECRET_V1", "IDENTITY_HASH_SECRET_V1")) {
    $property = $assessment.environment.PSObject.Properties[$name]
    if ($null -eq $property -or [String]::IsNullOrWhiteSpace([string]$property.Value)) { throw "Current assessment configuration is incomplete." }
  }

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Owner-smoke package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  if ($LASTEXITCODE -ne 0 -or $archiveEntries -notcontains "owner-smoke-handler.js" -or
      ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' })) {
    throw "Owner-smoke package boundary is invalid."
  }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageBucket = [string]$assessment.environment.PRIVATE_BUCKET
  $packageUri = "s3://$packageBucket/packages/owner-smoke-$packageSha.zip"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Owner-smoke package upload failed." }

  $environment = @(
    "ALLOWED_ORIGIN=$($assessment.environment.ALLOWED_ORIGIN)",
    "YDB_CONNECTION_STRING=$($assessment.environment.YDB_CONNECTION_STRING)",
    "PRIVATE_BUCKET=$($assessment.environment.PRIVATE_BUCKET)",
    "RUNTIME_MODE=assessment",
    "ATTEMPT_SIGNING_SECRET_V1=$($assessment.environment.ATTEMPT_SIGNING_SECRET_V1)",
    "INVITE_CODE_SECRET_V1=$($assessment.environment.INVITE_CODE_SECRET_V1)",
    "IDENTITY_HASH_SECRET_V1=$($assessment.environment.IDENTITY_HASH_SECRET_V1)"
  ) -join ","
  $tag = "owner-smoke-" + [Guid]::NewGuid().ToString("N").Substring(0, 12)
  $createdRaw = & $yc serverless function version create --function-id $functionId --runtime nodejs22 `
    --entrypoint owner-smoke-handler.handler --memory 128MB --execution-timeout 60s --service-account-id $runtimeServiceAccountId `
    --package-bucket-name $packageBucket --package-object-name ("packages/owner-smoke-$packageSha.zip") --package-sha256 $packageSha `
    --description "Temporary IAM-only owner smoke; never routed through API Gateway" --environment $environment --tags $tag `
    --concurrency 1 --no-logging --format json
  if ($LASTEXITCODE -ne 0) { throw "Temporary owner-smoke function version was not created." }
  $created = $createdRaw | ConvertFrom-Json
  $versionId = [string]$created.id
  if ([String]::IsNullOrWhiteSpace($versionId)) { throw "Temporary version id is missing." }

  [IO.File]::WriteAllText($eventPath, '{"action":"run-owner-smoke-v1"}', [Text.UTF8Encoding]::new($false))
  $smokeRaw = & $yc serverless function invoke --id $functionId --tag $tag --data-file $eventPath
  if ($LASTEXITCODE -ne 0) { throw "IAM-only owner smoke invocation failed." }
  $smoke = ($smokeRaw -join "") | ConvertFrom-Json
  if ($smoke -is [string]) { $smoke = $smoke | ConvertFrom-Json }
  if ($smoke.ok -ne $true -or $smoke.cleaned -ne $true -or $smoke.sharedGatesClosed -ne $true -or
      $smoke.technical -ne $true -or [int]$smoke.percent -ne 100 -or [string]$smoke.scoreVerification -ne "server-verified" -or
      $smoke.reportVerified -ne $true) { throw "IAM-only owner smoke verification failed." }

  Assert-ClosedState
  $negative = Invoke-JsonPost $assessmentUrl ([ordered]@{
    action = "beginAttempt"; apiVersion = "attempt-v2"; beginRequestId = "scb_" + "a" * 24; testId = "fa-junior";
    inviteCode = "SC1-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"; email = "closed@example.invalid";
    browserFingerprint = "deadbeef"; clientBuild = "owner-smoke-negative"; privacyConsent = $true;
    privacyConsentVersion = "skillcheck-pd-consent-2026-08-21-v6"; ageConfirmed = $true
  })
  if ($negative.ok -ne $false -or [string]$negative.failureCode -ne "attempt_unavailable") {
    throw "Public assessment gate is not fail-closed after owner smoke."
  }
  $smokeSucceeded = $true
  Write-Host "DONE: IAM-only owner smoke passed, technical data cleaned, public gates remained closed."
} finally {
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $queryPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $eventPath -Force -ErrorAction SilentlyContinue
  $cleanupError = ""
  if (-not [String]::IsNullOrWhiteSpace($versionId)) {
    $successorRaw = & $yc serverless function version create --function-id $functionId --runtime nodejs22 `
      --entrypoint index.handler --memory 128MB --execution-timeout 15s --service-account-id $runtimeServiceAccountId `
      --package-bucket-name $packageBucket --package-object-name ("packages/owner-smoke-$packageSha.zip") --package-sha256 $packageSha `
      --description "Unrouted clean successor for owner-smoke cleanup" --environment $environment `
      --concurrency 1 --no-logging --format json
    if ($LASTEXITCODE -ne 0) {
      $cleanupError = "Clean successor version was not created; temporary owner-smoke version was preserved."
    } else {
      $successor = $successorRaw | ConvertFrom-Json
      if ([String]::IsNullOrWhiteSpace([string]$successor.id)) {
        $cleanupError = "Clean successor version id is missing; temporary owner-smoke version was preserved."
      } else {
        & $yc serverless function version delete --id $versionId --force | Out-Null
        if ($LASTEXITCODE -ne 0) { $cleanupError = "Temporary owner-smoke version could not be deleted after clean successor creation." }
      }
    }
  }
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) {
    & $yc storage s3 rm $packageUri --only-show-errors | Out-Null
  }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  $assessment = $null
  if (-not [String]::IsNullOrWhiteSpace($cleanupError)) {
    if ($smokeSucceeded) { throw $cleanupError }
    Write-Warning $cleanupError
  }
$environment = ""
$packageBucket = ""
$packageSha = ""
$smokeSucceeded = $false
}
