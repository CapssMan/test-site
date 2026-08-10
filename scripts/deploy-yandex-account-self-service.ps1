param(
  [switch]$OpenSelfService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $OpenSelfService) {
  throw "Explicit -OpenSelfService confirmation is required."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$node = "C:\Program Files\nodejs\node.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$apiBase = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$assessmentSourceTag = "assessment-v12"
$accountSourceTag = "account-v1"
$assessmentTargetTag = "assessment-v13"
$accountTargetTag = "account-v2"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\014_candidate_self_service.sql"
$packagePath = Join-Path $env:TEMP ("skillcheck-account-self-service-" + [Guid]::NewGuid().ToString("N") + ".zip")
$schemaTempPath = Join-Path $env:TEMP ("skillcheck-self-service-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$defaultsTempPath = Join-Path $env:TEMP ("skillcheck-self-service-defaults-" + [Guid]::NewGuid().ToString("N") + ".sql")
$packageUri = ""
$ydbReady = $false
$deploymentSucceeded = $false

function Invoke-YdbJson([string]$query) {
  $raw = @(& $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array)
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @(($raw -join "`n") | ConvertFrom-Json)
}

function Get-Settings() {
  $rows = Invoke-YdbJson "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;"
  $settings = @{}
  foreach ($row in $rows) { $settings[[string]$row.setting_key] = [string]$row.setting_value }
  return $settings
}

function Set-RolloutGates([string]$issuance, [string]$selfService, [string]$accountRequired) {
  foreach ($value in @($issuance, $selfService, $accountRequired)) {
    if ($value -notin @("true", "false")) { throw "Invalid rollout gate value." }
  }
  $query = "UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES " +
    "(Utf8('attempt_issuance_enabled'), Utf8('$issuance'), CurrentUtcTimestamp()), " +
    "(Utf8('account_self_service_enabled'), Utf8('$selfService'), CurrentUtcTimestamp()), " +
    "(Utf8('account_required_for_attempts'), Utf8('$accountRequired'), CurrentUtcTimestamp());"
  $null = Invoke-YdbJson $query
}

function Assert-BaseGates([hashtable]$settings) {
  foreach ($key in @("legal_pilot_approved", "attempt_issuance_enabled", "account_registration_enabled", "profile_publication_enabled", "employer_contact_enabled", "employer_workspace_enabled")) {
    if (-not $settings.ContainsKey($key)) { throw "Required runtime gate is missing: $key" }
  }
  if ($settings.legal_pilot_approved -ne "true" -or $settings.attempt_issuance_enabled -notin @("true", "false") -or
      $settings.account_registration_enabled -ne "true" -or $settings.profile_publication_enabled -ne "false" -or
      $settings.employer_contact_enabled -ne "false" -or $settings.employer_workspace_enabled -ne "false") {
    throw "Production gates differ from the approved account-only pilot state."
  }
}

function Assert-FinalGates([string]$issuance, [string]$selfService, [string]$accountRequired) {
  $settings = Get-Settings
  if ($settings.attempt_issuance_enabled -ne $issuance -or
      $settings.account_self_service_enabled -ne $selfService -or
      $settings.account_required_for_attempts -ne $accountRequired -or
      $settings.account_registration_enabled -ne "true" -or
      $settings.profile_publication_enabled -ne "false" -or
      $settings.employer_contact_enabled -ne "false" -or
      $settings.employer_workspace_enabled -ne "false") {
    throw "Runtime gates differ from the expected fail-closed rollout state."
  }
}

function Get-Version([string]$tag) {
  $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json)
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Assert-Tag-Missing([string]$tag) {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $null = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json 2>$null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -eq 0) { throw "Target runtime tag already exists: $tag" }
}

function Join-Environment([object]$source) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($property in $source.environment.PSObject.Properties) {
    $value = [string]$property.Value
    if ($value -match "[,`r`n]") { throw "Runtime environment cannot be safely forwarded." }
    $pairs.Add(([string]$property.Name) + "=" + $value)
  }
  return [string]::Join(",", $pairs)
}

function Create-Version([object]$source, [string]$tag, [string]$description) {
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $script:packageObject --package-sha256 $script:packageSha `
    --description $description --environment (Join-Environment $source) --tags $tag `
    --concurrency ([int]$source.concurrency) --no-logging --format json)
  if ($LASTEXITCODE -ne 0) { throw "Runtime creation failed: $tag" }
  $created = ($raw -join "`n") | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created runtime id is missing: $tag" }
  return $created
}

function Invoke-WebRequestWithRetry([hashtable]$parameters) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try { return Invoke-WebRequest @parameters }
    catch {
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds $attempt
    }
  }
  throw "Web request retry boundary failed."
}

try {
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, (Join-Path $repoRoot "cloud\assessment-handler.js"), (Join-Path $repoRoot "cloud\account-handler.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required self-service deployment input is missing." }
  }
  foreach ($validator in @("test-account-self-service.js", "test-candidate-account.js", "test-ydb-self-service.js", "test-candidate-ux.js", "test-security.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Self-service validator failed: $validator" }
  }

  Assert-Tag-Missing $assessmentTargetTag
  Assert-Tag-Missing $accountTargetTag
  $assessmentSource = Get-Version $assessmentSourceTag
  $accountSource = Get-Version $accountSourceTag
  if ([string]$assessmentSource.environment.RUNTIME_MODE -ne "assessment" -or [string]$accountSource.environment.RUNTIME_MODE -ne "account") {
    throw "Source runtime mode is invalid."
  }
  foreach ($source in @($assessmentSource, $accountSource)) {
    foreach ($name in @("YDB_CONNECTION_STRING", "IDENTITY_HASH_SECRET_V1", "ACCOUNT_SESSION_SECRET_V1")) {
      if ([String]::IsNullOrWhiteSpace([string]$source.environment.$name)) { throw "Source runtime is missing required protected input." }
    }
  }
  if ([string]$assessmentSource.environment.ACCOUNT_SESSION_SECRET_V1 -cne [string]$accountSource.environment.ACCOUNT_SESSION_SECRET_V1 -or
      [string]$assessmentSource.environment.IDENTITY_HASH_SECRET_V1 -cne [string]$accountSource.environment.IDENTITY_HASH_SECRET_V1) {
    throw "Assessment and account runtimes do not share the same protected identity boundary."
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $ydbReady = $true
  $before = Get-Settings
  Assert-BaseGates $before
  Set-RolloutGates "false" "false" "false"
  Assert-FinalGates "false" "false" "false"
  $active = Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM assessment_sessions WHERE state = Utf8('active') OR state = Utf8('reserved');"
  if ($active.Count -ne 1 -or [long]$active[0].row_count -ne 0) { throw "Active assessment sessions block the account-first cutover." }

  $migrationText = [IO.File]::ReadAllText($schema)
  $defaultsIndex = $migrationText.IndexOf("UPSERT INTO", [StringComparison]::Ordinal)
  if ($defaultsIndex -lt 1) { throw "Self-service migration boundary is missing." }
  [IO.File]::WriteAllText($schemaTempPath, $migrationText.Substring(0, $defaultsIndex), [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($defaultsTempPath, $migrationText.Substring($defaultsIndex), [Text.UTF8Encoding]::new($false))
  $null = & $ydb -e $endpoint -d $database sql -f $schemaTempPath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Self-service schema migration failed." }
  $null = & $ydb -e $endpoint -d $database sql -f $defaultsTempPath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Self-service defaults migration failed." }
  Assert-FinalGates "false" "false" "false"

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "assessment-handler.js", "account-handler.js", "ydb-account-store.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) {
    throw "Runtime package boundary is invalid."
  }
  $script:packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $script:packageObject = "packages/account-self-service-$($script:packageSha).zip"
  $packageUri = "s3://$packageBucket/$($script:packageObject)"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $assessment = Create-Version $assessmentSource $assessmentTargetTag "Account-required assessment and atomic 21-day self-service"
  $account = Create-Version $accountSource $accountTargetTag "Yandex ID candidate account with per-test self-service access"
  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway account-first cutover failed." }
  $verifiedAssessment = Get-Version $assessmentTargetTag
  $verifiedAccount = Get-Version $accountTargetTag
  if ([string]$verifiedAssessment.id -ne [string]$assessment.id -or [string]$verifiedAccount.id -ne [string]$account.id) {
    throw "New runtime tag verification failed."
  }

  & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Account-first public-site deployment failed." }

  Set-RolloutGates "true" "true" "true"
  Assert-FinalGates "true" "true" "true"
  $accountConfigResponse = Invoke-WebRequestWithRetry @{ Method = "GET"; Uri = ($apiBase + "/v1/account"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }
  $accountConfig = $accountConfigResponse.Content | ConvertFrom-Json
  if ($accountConfig.ok -ne $true -or $accountConfig.enabled -ne $true -or $accountConfig.selfServiceEnabled -ne $true -or
      $accountConfig.accountRequiredForAttempts -ne $true -or $accountConfig.publicProfileEnabled -ne $false) {
    throw "Live account-first configuration verification failed."
  }
  $assessmentHealthResponse = Invoke-WebRequestWithRetry @{ Method = "GET"; Uri = ($apiBase + "/v1/assessment"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }
  $assessmentHealth = $assessmentHealthResponse.Content | ConvertFrom-Json
  if ($assessmentHealth.ok -ne $true -or [string]$assessmentHealth.backendVersion -ne "yandex-cloud-self-service-2026-08-09-1") {
    throw "Live account-first assessment verification failed."
  }

  $deploymentSucceeded = $true
  Write-Host "DONE: account-v2 and assessment-v13 are live; Yandex account is required; self-service is open; employer, contact and profile-publication gates remain closed."
  Write-Host ($origin + "/account.html")
} catch {
  if ($ydbReady) {
    try {
      Set-RolloutGates "false" "false" "false"
      Assert-FinalGates "false" "false" "false"
      Write-Warning "Rollout failed and new attempt issuance was left safely closed."
    } catch {
      Write-Warning "Fail-closed gate state could not be verified; inspect YDB settings immediately."
    }
  }
  throw
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $schemaTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $defaultsTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded -and $ydbReady) { Write-Warning "Account-first rollout did not complete." }
}
