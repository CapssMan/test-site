param([switch]$PublishPilotFeedback, [switch]$ResumeFailClosedDeployment)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not $PublishPilotFeedback) { throw "Explicit -PublishPilotFeedback confirmation is required." }

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
$assessmentSourceTag = "assessment-v14"
$assessmentTargetTag = "assessment-v15"
$adminSourceTag = "admin-v12"
$adminTargetTag = "admin-v13"
$backendVersion = "yandex-pilot-feedback-2026-08-21-1"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\020_pilot_feedback.sql"
$schemaTempPath = Join-Path $env:TEMP ("skillcheck-pilot-feedback-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$packagePath = Join-Path $env:TEMP ("skillcheck-pilot-feedback-" + [Guid]::NewGuid().ToString("N") + ".zip")
$deploymentSpec = Join-Path $env:TEMP ("skillcheck-pilot-feedback-gateway-" + [Guid]::NewGuid().ToString("N") + ".yaml")
$rollbackSpec = Join-Path $env:TEMP ("skillcheck-pilot-feedback-rollback-" + [Guid]::NewGuid().ToString("N") + ".yaml")
$packageUri = ""
$gatewayUpdated = $false
$ydbReady = $false
$previousSettings = $null
$deploymentSucceeded = $false

function Invoke-YdbJson([string]$query) {
  $raw = @(& $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array)
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @(($raw -join "`n") | ConvertFrom-Json)
}
function Get-Settings() {
  $result = @{}
  foreach ($row in @(Invoke-YdbJson "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;")) { $result[[string]$row.setting_key] = [string]$row.setting_value }
  return $result
}
function Set-AttemptGates([string]$issuance, [string]$selfService, [string]$accountRequired) {
  foreach ($value in @($issuance, $selfService, $accountRequired)) { if ($value -notin @("true", "false")) { throw "Invalid gate value." } }
  $null = Invoke-YdbJson ("UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES " +
    "(Utf8('attempt_issuance_enabled'), Utf8('$issuance'), CurrentUtcTimestamp()), " +
    "(Utf8('account_self_service_enabled'), Utf8('$selfService'), CurrentUtcTimestamp()), " +
    "(Utf8('account_required_for_attempts'), Utf8('$accountRequired'), CurrentUtcTimestamp());")
}
function Assert-ClosedProductGates([hashtable]$settings) {
  foreach ($name in @("legal_pilot_approved", "attempt_issuance_enabled", "account_registration_enabled", "account_self_service_enabled", "account_required_for_attempts")) {
    if (-not $settings.ContainsKey($name)) { throw "Required runtime gate is missing: $name" }
  }
  if ($settings.legal_pilot_approved -ne "true" -or $settings.account_registration_enabled -ne "true" -or $settings.account_required_for_attempts -ne "true") { throw "Production account pilot state differs from the approved boundary." }
  foreach ($name in @("profile_publication_enabled", "employer_workspace_enabled", "employer_invitation_enabled", "employer_contact_enabled", "candidate_credentials_enabled", "employer_company_profiles_enabled", "employer_chat_enabled")) {
    if (-not $settings.ContainsKey($name) -or $settings[$name] -ne "false") { throw "Closed product gate differs from approved state: $name" }
  }
}
function Get-Version([string]$tag) {
  $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json)
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return ($raw -join "`n") | ConvertFrom-Json
}
function Get-VersionOrNull([string]$tag) {
  $before = $ErrorActionPreference
  try { $ErrorActionPreference = "Continue"; $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json 2>$null); $code = $LASTEXITCODE } finally { $ErrorActionPreference = $before }
  if ($code -ne 0) { return $null }
  return ($raw -join "`n") | ConvertFrom-Json
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
  $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha --description $description --environment (Join-Environment $source) --tags $tag --concurrency ([int]$source.concurrency) --no-logging --format json)
  if ($LASTEXITCODE -ne 0) { throw "Runtime creation failed: $tag" }
  $created = ($raw -join "`n") | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created runtime id is missing: $tag" }
  return $created
}
function Invoke-WebRequestWithRetry([hashtable]$parameters) {
  for ($attempt = 1; $attempt -le 3; $attempt++) { try { return Invoke-WebRequest @parameters } catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds $attempt } }
  throw "Web request retry boundary failed."
}

try {
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, (Join-Path $repoRoot "cloud\pilot-analytics.js"), (Join-Path $repoRoot "test.html"), (Join-Path $repoRoot "admin.html"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required pilot-feedback deployment input is missing: $path" }
  }
  foreach ($validator in @("test-pilot-feedback-analytics.js", "test-assessment-handler.js", "test-admin-trust.js", "test-legal-privacy.js", "test-security.js", "test-yandex-cors-origins.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Pilot-feedback validator failed: $validator" }
  }

  $sourceSpecText = [IO.File]::ReadAllText($gatewaySpec)
  if ([regex]::Matches($sourceSpecText, 'tag: "assessment-v14"').Count -ne 2 -or [regex]::Matches($sourceSpecText, 'tag: "admin-v12"').Count -ne 2) { throw "Checked-in gateway source boundary is invalid." }
  $deploymentSpecText = $sourceSpecText.Replace('tag: "assessment-v14"', 'tag: "assessment-v15"').Replace('tag: "admin-v12"', 'tag: "admin-v13"')
  if ([regex]::Matches($deploymentSpecText, 'tag: "assessment-v15"').Count -ne 2 -or [regex]::Matches($deploymentSpecText, 'tag: "admin-v13"').Count -ne 2 -or $deploymentSpecText.Contains('tag: "assessment-v14"') -or $deploymentSpecText.Contains('tag: "admin-v12"')) { throw "Generated pilot-feedback gateway boundary is invalid." }
  [IO.File]::WriteAllText($deploymentSpec, $deploymentSpecText, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($rollbackSpec, $sourceSpecText, [Text.UTF8Encoding]::new($false))

  $assessmentSource = Get-Version $assessmentSourceTag
  $adminSource = Get-Version $adminSourceTag
  if ([string]$assessmentSource.environment.RUNTIME_MODE -ne "assessment" -or [string]$adminSource.environment.RUNTIME_MODE -ne "admin") { throw "Source runtime boundary is invalid." }
  foreach ($source in @($assessmentSource, $adminSource)) { if ([string]$source.log_options.disabled -ne "True") { throw "Source runtime logging boundary is invalid." } }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $ydbReady = $true
  $previousSettings = Get-Settings
  Assert-ClosedProductGates $previousSettings
  $restoreIssuance = $previousSettings.attempt_issuance_enabled
  $restoreSelfService = $previousSettings.account_self_service_enabled
  if ($restoreIssuance -eq "false" -and $restoreSelfService -eq "false") {
    if (-not $ResumeFailClosedDeployment) { throw "Explicit -ResumeFailClosedDeployment confirmation is required to restore a fail-closed pilot." }
    $restoreIssuance = "true"
    $restoreSelfService = "true"
  }
  Set-AttemptGates "false" "false" $previousSettings.account_required_for_attempts
  $active = @(Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM assessment_sessions WHERE state = Utf8('active') OR state = Utf8('reserved');")
  if ($active.Count -ne 1 -or [long]$active[0].row_count -ne 0) { throw "Active assessment sessions block the privacy-consent and feedback cutover." }

  Copy-Item -LiteralPath $schema -Destination $schemaTempPath -Force
  $null = & $ydb -e $endpoint -d $database sql -f $schemaTempPath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Pilot-feedback schema migration failed." }
  if (@(Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM assessment_feedback;").Count -ne 1) { throw "Pilot-feedback schema verification failed." }

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "assessment-handler.js", "admin-handler.js", "pilot-analytics.js", "ydb-assessment-store.js", "ydb-admin-store.js")) { if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" } }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) { throw "Runtime package boundary is invalid." }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/pilot-feedback-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $assessmentCreated = New-RuntimeVersion $assessmentSource $assessmentTargetTag "assessment" "Verified voluntary pilot feedback" $packageObject $packageSha
  $adminCreated = New-RuntimeVersion $adminSource $adminTargetTag "admin" "Protected aggregate pilot funnel and feedback" $packageObject $packageSha
  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $deploymentSpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway pilot-feedback cutover failed." }
  $gatewayUpdated = $true
  foreach ($pair in @(@($assessmentTargetTag, $assessmentCreated.id), @($adminTargetTag, $adminCreated.id))) {
    $current = Get-Version ([string]$pair[0])
    if ([string]$current.id -ne [string]$pair[1]) { throw "Runtime tag verification failed: $($pair[0])" }
  }

  & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1") -SkipGatewayUpdate
  if ($LASTEXITCODE -ne 0) { throw "Pilot-feedback public-site deployment failed." }
  Set-AttemptGates $restoreIssuance $restoreSelfService $previousSettings.account_required_for_attempts
  Assert-ClosedProductGates (Get-Settings)

  $assessmentHealth = (Invoke-WebRequestWithRetry @{ Uri = ($apiBase + "/v1/assessment"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($assessmentHealth.ok -ne $true -or [string]$assessmentHealth.backendVersion -ne $backendVersion) { throw "Live assessment-v15 verification failed." }
  $adminHealth = (Invoke-WebRequestWithRetry @{ Uri = ($apiBase + "/v1/admin"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }).Content | ConvertFrom-Json
  if ($adminHealth.ok -ne $true -or [string]$adminHealth.status -ne "alive" -or [string]$adminHealth.backendVersion -ne $backendVersion) { throw "Live admin-v13 verification failed." }
  $candidatePage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/test.html?build=pilot-feedback"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('Build 2026.08.21.1', 'id="feedbackBlock"', 'skillcheck-pd-consent-2026-08-21-v6')) { if (-not $candidatePage.Content.Contains($needle)) { throw "Live candidate feedback page verification failed: $needle" } }
  $adminPage = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/admin.html?build=pilot-feedback"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($needle in @('Build 2026.08.21.1', 'id="pilotContent"', 'adminPilotAnalytics')) { if (-not $adminPage.Content.Contains($needle)) { throw "Live admin analytics page verification failed: $needle" } }

  $deploymentSucceeded = $true
  Write-Host "DONE: assessment-v15 and admin-v13 are live with voluntary feedback and protected aggregate pilot analytics; employer, profile, invitation, credentials, chat and contact gates remain closed."
} catch {
  if ($gatewayUpdated -and (Test-Path -LiteralPath $rollbackSpec -PathType Leaf)) {
    try { $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $rollbackSpec --no-logging --format json) | ConvertFrom-Json; Write-Warning "Pilot-feedback deployment failed; API Gateway was restored to assessment-v14 and admin-v12." } catch { Write-Warning "Automatic gateway rollback failed; inspect assessment and admin routes immediately." }
  }
  if ($ydbReady) { try { Set-AttemptGates "false" "false" "true" } catch { Write-Warning "Fail-closed attempt gates could not be verified." } }
  throw
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $schemaTempPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $deploymentSpec -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $rollbackSpec -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded) { Write-Warning "Pilot-feedback deployment did not complete; additive schema may remain and new attempt issuance stays closed." }
}