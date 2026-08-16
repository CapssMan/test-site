param([switch]$Deploy)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not $Deploy) { throw "Explicit -Deploy confirmation is required." }

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
$gatewayOrigin = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$sourceTag = "account-v2"
$targetTag = "account-v3"
$backendVersion = "yandex-candidate-profile-2026-08-16-1"
$consentVersion = "skillcheck-account-2026-08-16-v3"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\015_candidate_profile_v2.sql"
$packagePath = Join-Path $env:TEMP ("skillcheck-candidate-profile-v2-" + [Guid]::NewGuid().ToString("N") + ".zip")
$rollbackSpec = Join-Path $env:TEMP ("skillcheck-candidate-profile-v2-rollback-" + [Guid]::NewGuid().ToString("N") + ".yaml")
$packageUri = ""
$gatewayUpdated = $false
$schemaTempPath = Join-Path $env:TEMP ("skillcheck-candidate-profile-v2-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$defaultsTempPath = Join-Path $env:TEMP ("skillcheck-candidate-profile-v2-defaults-" + [Guid]::NewGuid().ToString("N") + ".sql")
$deploymentSucceeded = $false

function Invoke-YdbJson([string]$query) {
  $raw = @(& $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array)
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @(($raw -join "`n") | ConvertFrom-Json)
}

function Get-Settings() {
  $settings = @{}
  foreach ($row in (Invoke-YdbJson "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;")) {
    $settings[[string]$row.setting_key] = [string]$row.setting_value
  }
  return $settings
}

function Assert-ProductionGates([hashtable]$settings, [bool]$requireSchema) {
  $expected = [ordered]@{
    legal_pilot_approved = "true"
    attempt_issuance_enabled = "true"
    account_registration_enabled = "true"
    account_self_service_enabled = "true"
    account_required_for_attempts = "true"
    profile_publication_enabled = "false"
    employer_workspace_enabled = "false"
    employer_contact_enabled = "false"
  }
  foreach ($name in $expected.Keys) {
    if (-not $settings.ContainsKey($name) -or [string]$settings[$name] -ne [string]$expected[$name]) {
      throw "Production gate differs from the approved candidate-only state: $name"
    }
  }
  if ($requireSchema -and (-not $settings.ContainsKey("candidate_profile_v2_schema") -or $settings.candidate_profile_v2_schema -ne "true")) {
    throw "Candidate profile v2 schema marker is missing."
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
  } finally { $ErrorActionPreference = $previousPreference }
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
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, (Join-Path $repoRoot "cloud\account-handler.js"), (Join-Path $repoRoot "account.html"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required candidate-profile deployment input is missing." }
  }
  foreach ($validator in @("test-candidate-profile-v2.js", "test-candidate-account.js", "test-ydb-account-store.js", "test-account-cabinet.js", "test-legal-privacy.js", "test-yandex-cors-origins.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Candidate-profile validator failed: $validator" }
  }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  if ([regex]::Matches($specText, 'tag: "account-v3"').Count -ne 2 -or $specText.Contains('tag: "account-v2"')) {
    throw "Gateway account-v3 route boundary is invalid."
  }
  [IO.File]::WriteAllText($rollbackSpec, $specText.Replace('tag: "account-v3"', 'tag: "account-v2"'), [Text.UTF8Encoding]::new($false))

  Assert-Tag-Missing $targetTag
  $source = Get-Version $sourceTag
  if ([string]$source.environment.RUNTIME_MODE -ne "account" -or [string]$source.log_options.disabled -ne "True") {
    throw "Source account runtime boundary is invalid."
  }
  foreach ($name in @("YDB_CONNECTION_STRING", "YANDEX_ID_CLIENT_ID", "YANDEX_ID_REDIRECT_URI", "IDENTITY_HASH_SECRET_V1", "ACCOUNT_SESSION_SECRET_V1")) {
    if ([String]::IsNullOrWhiteSpace([string]$source.environment.$name)) { throw "Source runtime is missing protected input." }
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $before = Get-Settings
  Assert-ProductionGates $before $false

  $currentPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/account.html?build=candidate-profile-v2-resume"); UseBasicParsing = $true; TimeoutSec = 30 }
  $staticReady = $currentPage.Content.Contains('id="careerProfileCard"') -and
    $currentPage.Content.Contains('id="experienceSummary"') -and
    $currentPage.Content.Contains($consentVersion)
  if (-not $staticReady) {
    & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1") -SkipGatewayUpdate
    if ($LASTEXITCODE -ne 0) { throw "Compatible candidate-profile public page deployment failed." }
  } else {
    Write-Host "Candidate-profile public files are already live; verified upload is reused."
  }

  if (-not $before.ContainsKey("candidate_profile_v2_schema") -or $before.candidate_profile_v2_schema -ne "true") {
    $migrationText = [IO.File]::ReadAllText($schema)
    $defaultsIndex = $migrationText.IndexOf("UPSERT INTO", [StringComparison]::Ordinal)
    if ($defaultsIndex -lt 1) { throw "Candidate-profile migration boundary is missing." }
    [IO.File]::WriteAllText($schemaTempPath, $migrationText.Substring(0, $defaultsIndex), [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($defaultsTempPath, $migrationText.Substring($defaultsIndex), [Text.UTF8Encoding]::new($false))
    $null = & $ydb -e $endpoint -d $database sql -f $schemaTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Candidate-profile schema migration failed before settings." }
    $null = & $ydb -e $endpoint -d $database sql -f $defaultsTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Candidate-profile settings migration failed." }
  }
  Assert-ProductionGates (Get-Settings) $true

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "account-core.js", "account-handler.js", "ydb-account-store.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) {
    throw "Runtime package boundary is invalid."
  }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/candidate-profile-v2-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
    --description "Private candidate career profile and availability freshness; employer gates closed" `
    --environment (Join-Environment $source) --tags $targetTag --concurrency ([int]$source.concurrency) `
    --no-logging --format json)
  if ($LASTEXITCODE -ne 0) { throw "Candidate-profile runtime creation failed." }
  $created = ($raw -join "`n") | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created account-v3 id is missing." }

  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway account-v3 cutover failed." }
  $gatewayUpdated = $true

  $verified = Get-Version $targetTag
  if ([string]$verified.id -ne [string]$created.id -or [string]$verified.environment.RUNTIME_MODE -ne "account") {
    throw "Account-v3 runtime verification failed."
  }
  $configResponse = Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/account"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }
  $config = $configResponse.Content | ConvertFrom-Json
  if ($config.ok -ne $true -or [string]$config.backendVersion -ne $backendVersion -or [string]$config.accountConsentVersion -ne $consentVersion -or
      $config.enabled -ne $true -or $config.publicProfileEnabled -ne $false) { throw "Live account-v3 configuration verification failed." }
  $page = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/account.html?build=candidate-profile-v2"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('id="careerProfileCard"', 'id="experienceSummary"', 'id="confirmAvailabilityButton"', $consentVersion)) {
    if (-not $page.Content.Contains($needle)) { throw "Live candidate-profile page verification failed: $needle" }
  }
  Assert-ProductionGates (Get-Settings) $true

  $deploymentSucceeded = $true
  Write-Host "DONE: account-v3 and candidate profile v2 are live; attempts remain open; employer workspace, profile publication and contact gates remain closed."
  Write-Host ($origin + "/account.html")
} catch {
  if ($gatewayUpdated -and (Test-Path -LiteralPath $rollbackSpec -PathType Leaf)) {
    try {
      $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $rollbackSpec --no-logging --format json) | ConvertFrom-Json
      Write-Warning "Candidate-profile deployment failed; API Gateway was restored to account-v2."
    } catch { Write-Warning "Automatic account-v2 gateway rollback failed; inspect the account route immediately." }
  }
  throw
} finally {
  Remove-Item -LiteralPath $schemaTempPath -Force -ErrorAction SilentlyContinue
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $defaultsTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $rollbackSpec -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded) { Write-Warning "Candidate-profile deployment did not complete; additive schema may remain but closed employer gates were not changed." }
}
