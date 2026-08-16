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
$accountSourceTag = "account-v3"
$accountTargetTag = "account-v4"
$employerSourceTag = "employer-v1"
$employerTargetTag = "employer-v2"
$accountBackendVersion = "yandex-candidate-invitations-2026-08-16-1"
$employerBackendVersion = "yandex-employer-invitations-2026-08-16-1"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\016_employer_invitations.sql"
$settingsSchema = Join-Path $repoRoot "cloud\schema\017_employer_invitation_settings.sql"
$schemaTempPath = Join-Path $env:TEMP ("skillcheck-invitations-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$settingsTempPath = Join-Path $env:TEMP ("skillcheck-invitations-settings-" + [Guid]::NewGuid().ToString("N") + ".sql")
$packagePath = Join-Path $env:TEMP ("skillcheck-invitations-" + [Guid]::NewGuid().ToString("N") + ".zip")
$rollbackSpec = Join-Path $env:TEMP ("skillcheck-invitations-rollback-" + [Guid]::NewGuid().ToString("N") + ".yaml")
$packageUri = ""
$gatewayUpdated = $false
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
    employer_invitation_enabled = "false"
    employer_contact_enabled = "false"
  }
  foreach ($name in $expected.Keys) {
    if ($name -eq "employer_invitation_enabled" -and -not $requireSchema -and -not $settings.ContainsKey($name)) { continue }
    if (-not $settings.ContainsKey($name) -or [string]$settings[$name] -ne [string]$expected[$name]) {
      throw "Production gate differs from the approved closed employer state: $name"
    }
  }
  if ($requireSchema -and (-not $settings.ContainsKey("employer_invitation_v1_schema") -or $settings.employer_invitation_v1_schema -ne "true")) {
    throw "Employer invitation schema marker is missing."
  }
}

function Get-Version([string]$tag) {
  $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json)
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Get-VersionOrNull([string]$tag) {
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json 2>$null)
    $exitCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previousPreference }
  if ($exitCode -ne 0) { return $null }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Remove-ObsoleteTag([string]$tag, [string]$expectedVersionId) {
  $version = Get-VersionOrNull $tag
  if ($null -eq $version) { return }
  if ([string]$version.id -ne $expectedVersionId) { throw "Obsolete tag points to an unexpected version: $tag" }
  $null = & $yc serverless function version remove-tag --id $expectedVersionId --tag $tag
  if ($LASTEXITCODE -ne 0) { throw "Obsolete tag removal failed: $tag" }
  Write-Host "Removed obsolete tag $tag; runtime version $expectedVersionId was preserved."
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

function New-RuntimeVersion([object]$source, [string]$tag, [string]$mode, [string]$description, [string]$packageObject, [string]$packageSha) {
  $existing = Get-VersionOrNull $tag
  if ($null -ne $existing) {
    if ([string]$existing.environment.RUNTIME_MODE -ne $mode) { throw "Existing target tag has an invalid runtime mode: $tag" }
    return $existing
  }
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
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
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, $settingsSchema, (Join-Path $repoRoot "cloud\invitation-core.js"), (Join-Path $repoRoot "cloud\ydb-invitation-store.js"), (Join-Path $repoRoot "account.html"), (Join-Path $repoRoot "employer.html"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required employer invitation deployment input is missing." }
  }
  foreach ($validator in @("test-employer-invitations.js", "test-ydb-invitation-store.js", "test-employer-ui.js", "test-account-cabinet.js", "test-security.js", "test-yandex-cors-origins.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Employer invitation validator failed: $validator" }
  }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  if ([regex]::Matches($specText, 'tag: "account-v4"').Count -ne 2 -or [regex]::Matches($specText, 'tag: "employer-v2"').Count -ne 2) {
    throw "Gateway invitation route boundary is invalid."
  }
  if ($specText.Contains('tag: "account-v3"') -or $specText.Contains('tag: "employer-v1"')) { throw "Gateway still references superseded invitation runtimes." }
  $rollbackText = $specText.Replace('tag: "account-v4"', 'tag: "account-v3"').Replace('tag: "employer-v2"', 'tag: "employer-v1"')
  [IO.File]::WriteAllText($rollbackSpec, $rollbackText, [Text.UTF8Encoding]::new($false))

  $accountSource = Get-Version $accountSourceTag
  $employerSource = Get-Version $employerSourceTag
  if ([string]$accountSource.environment.RUNTIME_MODE -ne "account" -or [string]$employerSource.environment.RUNTIME_MODE -ne "employer") { throw "Source runtime boundary is invalid." }
  if ([string]$accountSource.log_options.disabled -ne "True" -or [string]$employerSource.log_options.disabled -ne "True") { throw "Source runtime logging boundary is invalid." }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  Assert-ProductionGates (Get-Settings) $false

  & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1") -SkipGatewayUpdate
  if ($LASTEXITCODE -ne 0) { throw "Compatible public page deployment failed." }

  $settingsBefore = Get-Settings
  if (-not $settingsBefore.ContainsKey("employer_invitation_v1_schema") -or $settingsBefore.employer_invitation_v1_schema -ne "true") {
    Copy-Item -LiteralPath $schema -Destination $schemaTempPath -Force
    Copy-Item -LiteralPath $settingsSchema -Destination $settingsTempPath -Force
    $null = & $ydb -e $endpoint -d $database sql -f $schemaTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Employer invitation schema migration failed." }
    $null = & $ydb -e $endpoint -d $database sql -f $settingsTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Employer invitation settings migration failed." }
  }
  Assert-ProductionGates (Get-Settings) $true

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "account-handler.js", "employer-handler.js", "invitation-core.js", "ydb-invitation-store.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) { throw "Runtime package boundary is invalid." }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/employer-invitations-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  Remove-ObsoleteTag "admin-v9" "d4e65tmuhh5oa568jjkn"
  Remove-ObsoleteTag "assessment-v11" "d4e1hbljjctoa19a1iq0"
  $accountCreated = New-RuntimeVersion $accountSource $accountTargetTag "account" "Candidate invitation inbox; employer and contact gates closed" $packageObject $packageSha
  $employerCreated = New-RuntimeVersion $employerSource $employerTargetTag "employer" "All-candidate search, shortlist invitations and statuses; gates closed" $packageObject $packageSha

  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway invitation cutover failed." }
  $gatewayUpdated = $true

  $verifiedAccount = Get-Version $accountTargetTag
  $verifiedEmployer = Get-Version $employerTargetTag
  if ([string]$verifiedAccount.id -ne [string]$accountCreated.id -or [string]$verifiedEmployer.id -ne [string]$employerCreated.id) { throw "Invitation runtime tag verification failed." }

  $accountConfig = (Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/account"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($accountConfig.ok -ne $true -or [string]$accountConfig.backendVersion -ne $accountBackendVersion -or $accountConfig.invitationEnabled -ne $false -or $accountConfig.publicProfileEnabled -ne $false) { throw "Live account-v4 configuration verification failed." }
  $employerConfig = (Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/employer"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($employerConfig.ok -ne $true -or [string]$employerConfig.backendVersion -ne $employerBackendVersion -or $employerConfig.enabled -ne $false -or $employerConfig.invitationEnabled -ne $false -or $employerConfig.contactEnabled -ne $false) { throw "Live employer-v2 configuration verification failed." }

  $accountPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/account.html?build=employer-invitations"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('id="invitationList"', 'action:"respondInvitation"', 'id="invitationsTitle"')) {
    if (-not $accountPage.Content.Contains($needle)) { throw "Live candidate invitation page verification failed: $needle" }
  }
  $employerPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/employer.html?build=employer-invitations"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('id="talentList"', 'id="sendInvitationBatch"', 'id="employerInvitations"')) {
    if (-not $employerPage.Content.Contains($needle)) { throw "Live employer invitation page verification failed: $needle" }
  }
  Assert-ProductionGates (Get-Settings) $true

  $deploymentSucceeded = $true
  Write-Host "DONE: account-v4 and employer-v2 are live behind closed employer, invitation, profile and contact gates."
  Write-Host ($origin + "/account.html")
  Write-Host ($origin + "/employer.html")
} catch {
  if ($gatewayUpdated -and (Test-Path -LiteralPath $rollbackSpec -PathType Leaf)) {
    try {
      $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $rollbackSpec --no-logging --format json) | ConvertFrom-Json
      Write-Warning "Invitation deployment failed; API Gateway was restored to account-v3 and employer-v1."
    } catch { Write-Warning "Automatic gateway rollback failed; inspect account and employer routes immediately." }
  }
  throw
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $schemaTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $settingsTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $rollbackSpec -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded) { Write-Warning "Employer invitation deployment did not complete; additive schema may remain, but all employer gates stay closed." }
}
