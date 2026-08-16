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
$accountSourceTag = "account-v4"
$accountTargetTag = "account-v5"
$employerSourceTag = "employer-v2"
$employerTargetTag = "employer-v3"
$adminSourceTag = "admin-v10"
$adminTargetTag = "admin-v11"
$accountBackendVersion = "yandex-candidate-trust-chat-2026-08-17-1"
$employerBackendVersion = "yandex-employer-trust-chat-2026-08-17-1"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\018_verified_profiles_chat.sql"
$settingsSchema = Join-Path $repoRoot "cloud\schema\019_verified_profiles_chat_settings.sql"
$schemaTempPath = Join-Path $env:TEMP ("skillcheck-trust-chat-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$settingsTempPath = Join-Path $env:TEMP ("skillcheck-trust-chat-settings-" + [Guid]::NewGuid().ToString("N") + ".sql")
$packagePath = Join-Path $env:TEMP ("skillcheck-trust-chat-" + [Guid]::NewGuid().ToString("N") + ".zip")
$rollbackSpec = Join-Path $env:TEMP ("skillcheck-trust-chat-rollback-" + [Guid]::NewGuid().ToString("N") + ".yaml")
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
    candidate_credentials_enabled = "false"
    employer_company_profiles_enabled = "false"
    employer_chat_enabled = "false"
  }
  foreach ($name in $expected.Keys) {
    if (-not $requireSchema -and $name -in @("candidate_credentials_enabled", "employer_company_profiles_enabled", "employer_chat_enabled") -and -not $settings.ContainsKey($name)) { continue }
    if (-not $settings.ContainsKey($name) -or [string]$settings[$name] -ne [string]$expected[$name]) {
      throw "Production gate differs from the approved closed trust/chat state: $name"
    }
  }
  if ($requireSchema -and (-not $settings.ContainsKey("verified_profiles_chat_schema") -or $settings.verified_profiles_chat_schema -ne "true")) {
    throw "Verified profiles and chat schema marker is missing."
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
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, $settingsSchema, (Join-Path $repoRoot "cloud\trust-core.js"), (Join-Path $repoRoot "cloud\chat-core.js"), (Join-Path $repoRoot "cloud\ydb-trust-store.js"), (Join-Path $repoRoot "cloud\ydb-chat-store.js"), (Join-Path $repoRoot "account.html"), (Join-Path $repoRoot "employer.html"), (Join-Path $repoRoot "admin.html"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required trust/chat deployment input is missing." }
  }
  foreach ($validator in @("test-trust-chat-core.js", "test-ydb-trust-chat-store.js", "test-verified-profiles-chat.js", "test-admin-trust.js", "test-design-colors.js", "test-security.js", "test-yandex-cors-origins.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Trust/chat validator failed: $validator" }
  }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  if ([regex]::Matches($specText, 'tag: "account-v5"').Count -ne 2 -or [regex]::Matches($specText, 'tag: "employer-v3"').Count -ne 2 -or [regex]::Matches($specText, 'tag: "admin-v11"').Count -ne 2) {
    throw "Gateway trust/chat route boundary is invalid."
  }
  if ($specText.Contains('tag: "account-v4"') -or $specText.Contains('tag: "employer-v2"') -or $specText.Contains('tag: "admin-v10"')) { throw "Gateway still references predecessor trust/chat runtimes." }
  $rollbackText = $specText.Replace('tag: "account-v5"', 'tag: "account-v4"').Replace('tag: "employer-v3"', 'tag: "employer-v2"').Replace('tag: "admin-v11"', 'tag: "admin-v10"')
  [IO.File]::WriteAllText($rollbackSpec, $rollbackText, [Text.UTF8Encoding]::new($false))

  $accountSource = Get-Version $accountSourceTag
  $employerSource = Get-Version $employerSourceTag
  $adminSource = Get-Version $adminSourceTag
  if ([string]$accountSource.environment.RUNTIME_MODE -ne "account" -or [string]$employerSource.environment.RUNTIME_MODE -ne "employer" -or [string]$adminSource.environment.RUNTIME_MODE -ne "admin") { throw "Source runtime boundary is invalid." }
  foreach ($source in @($accountSource, $employerSource, $adminSource)) {
    if ([string]$source.log_options.disabled -ne "True") { throw "Source runtime logging boundary is invalid." }
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  Assert-ProductionGates (Get-Settings) $false

  & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1") -SkipGatewayUpdate
  if ($LASTEXITCODE -ne 0) { throw "Compatible public page deployment failed." }

  $settingsBefore = Get-Settings
  if (-not $settingsBefore.ContainsKey("verified_profiles_chat_schema") -or $settingsBefore.verified_profiles_chat_schema -ne "true") {
    Copy-Item -LiteralPath $schema -Destination $schemaTempPath -Force
    Copy-Item -LiteralPath $settingsSchema -Destination $settingsTempPath -Force
    $null = & $ydb -e $endpoint -d $database sql -f $schemaTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Verified profiles and chat schema migration failed." }
    $null = & $ydb -e $endpoint -d $database sql -f $settingsTempPath --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "Verified profiles and chat settings migration failed." }
  }
  Assert-ProductionGates (Get-Settings) $true

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "account-handler.js", "employer-handler.js", "admin-handler.js", "trust-core.js", "chat-core.js", "ydb-trust-store.js", "ydb-chat-store.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) { throw "Runtime package boundary is invalid." }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/trust-chat-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  Remove-ObsoleteTag "account-v2" "d4eg9l7egr5eajqnnuc2"
  Remove-ObsoleteTag "account-v3" "d4etah5u1d09fcmotvsq"
  Remove-ObsoleteTag "employer-v1" "d4esn3fvi5voknihjdhl"
  Remove-ObsoleteTag "assessment-v12" "d4emffs52denqnjl30dd"
  $accountCreated = New-RuntimeVersion $accountSource $accountTargetTag "account" "Candidate credentials and accepted-invitation chat; gates closed" $packageObject $packageSha
  $employerCreated = New-RuntimeVersion $employerSource $employerTargetTag "employer" "Verified organizations, credentials and internal chat; gates closed" $packageObject $packageSha
  $adminCreated = New-RuntimeVersion $adminSource $adminTargetTag "admin" "Protected credential, company and employer verification" $packageObject $packageSha

  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway trust/chat cutover failed." }
  $gatewayUpdated = $true

  foreach ($pair in @(@($accountTargetTag, $accountCreated.id), @($employerTargetTag, $employerCreated.id), @($adminTargetTag, $adminCreated.id))) {
    $verified = Get-Version ([string]$pair[0])
    if ([string]$verified.id -ne [string]$pair[1]) { throw "Runtime tag verification failed: $($pair[0])" }
  }

  $accountConfig = (Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/account"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($accountConfig.ok -ne $true -or [string]$accountConfig.backendVersion -ne $accountBackendVersion -or $accountConfig.publicProfileEnabled -ne $false -or $accountConfig.invitationEnabled -ne $false -or $accountConfig.credentialsEnabled -ne $false -or $accountConfig.chatEnabled -ne $false -or $accountConfig.contactEnabled -ne $false) { throw "Live account-v5 closed configuration verification failed." }
  $employerConfig = (Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/employer"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($employerConfig.ok -ne $true -or [string]$employerConfig.backendVersion -ne $employerBackendVersion -or $employerConfig.enabled -ne $false -or $employerConfig.invitationEnabled -ne $false -or $employerConfig.contactEnabled -ne $false -or $employerConfig.companyProfilesEnabled -ne $false -or $employerConfig.credentialsEnabled -ne $false -or $employerConfig.chatEnabled -ne $false) { throw "Live employer-v3 closed configuration verification failed." }
  $adminHealth = (Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/admin"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($adminHealth.ok -ne $true -or [string]$adminHealth.status -ne "alive") { throw "Live admin-v11 health verification failed." }

  $accountPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/account.html?build=trust-chat"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('id="credentialsCard"', 'id="candidateConversationList"', 'skillcheck-credentials-chat-2026-08-17-v1')) {
    if (-not $accountPage.Content.Contains($needle)) { throw "Live candidate trust/chat page verification failed: $needle" }
  }
  $employerPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/employer.html?build=trust-chat"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('id="companyPanel"', 'id="employerConversationList"', 'id="employerChatForm"')) {
    if (-not $employerPage.Content.Contains($needle)) { throw "Live employer trust/chat page verification failed: $needle" }
  }
  $adminPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/admin.html?build=trust-chat"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('Build 2026.08.17.1', 'id="organizationForm"', 'adminTrustReviewQueue')) {
    if (-not $adminPage.Content.Contains($needle)) { throw "Live admin trust page verification failed: $needle" }
  }
  Assert-ProductionGates (Get-Settings) $true

  $deploymentSucceeded = $true
  Write-Host "DONE: account-v5, employer-v3 and admin-v11 are live behind closed profile, employer, invitation, credential, company, chat and contact gates."
  Write-Host ($origin + "/account.html")
  Write-Host ($origin + "/employer.html")
} catch {
  if ($gatewayUpdated -and (Test-Path -LiteralPath $rollbackSpec -PathType Leaf)) {
    try {
      $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $rollbackSpec --no-logging --format json) | ConvertFrom-Json
      Write-Warning "Trust/chat deployment failed; API Gateway was restored to account-v4, employer-v2 and admin-v10."
    } catch { Write-Warning "Automatic gateway rollback failed; inspect account, employer and admin routes immediately." }
  }
  throw
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $schemaTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $settingsTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $rollbackSpec -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded) { Write-Warning "Trust/chat deployment did not complete; additive schema may remain, but all new product gates stay closed." }
}
