param(
  [switch]$NotificationSubmitted
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $NotificationSubmitted) {
  throw "Explicit -NotificationSubmitted confirmation is required."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$siteOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$accountUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/account"
$clientId = "abdbe0089e38479387668f15d71ff739"
$redirectUri = $siteOrigin + "/account.html"
$gateChanged = $false

function Invoke-YdbQuery([string]$query) {
  $raw = & $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "YDB account-gate query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @($raw | ConvertFrom-Json)
}

function Get-AccountSettings() {
  $rows = Invoke-YdbQuery "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;"
  $settings = @{}
  foreach ($row in $rows) { $settings[[string]$row.setting_key] = [string]$row.setting_value }
  return $settings
}

function Assert-AccountSettings([string]$registration) {
  $settings = Get-AccountSettings
  foreach ($key in @("account_registration_enabled", "profile_publication_enabled", "employer_contact_enabled")) {
    if (-not $settings.ContainsKey($key)) { throw "Required candidate-account gate is missing: $key" }
  }
  if ([string]$settings["account_registration_enabled"] -ne $registration -or
      [string]$settings["profile_publication_enabled"] -ne "false" -or
      [string]$settings["employer_contact_enabled"] -ne "false") {
    throw "Candidate-account gates differ from the approved registration-only state."
  }
}

function Set-RegistrationGate([string]$value) {
  if (@("true", "false") -notcontains $value) { throw "Invalid registration gate value." }
  $query = "UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES (Utf8('account_registration_enabled'), Utf8('$value'), CurrentUtcTimestamp());"
  $null = Invoke-YdbQuery $query
}

function Get-LiveAccountConfig() {
  $response = Invoke-WebRequest -Method GET -Uri $accountUrl -Headers @{ Origin = $siteOrigin } `
    -UseBasicParsing -TimeoutSec 30
  if ([int]$response.StatusCode -ne 200 -or [string]$response.Headers["Access-Control-Allow-Origin"] -ne $siteOrigin) {
    throw "Live account configuration or CORS check failed."
  }
  return $response.Content | ConvertFrom-Json
}

function Assert-LiveDocuments() {
  $index = (Invoke-WebRequest -Uri ($siteOrigin + "/index.html") -UseBasicParsing -TimeoutSec 30).Content
  $privacy = (Invoke-WebRequest -Uri ($siteOrigin + "/privacy.html") -UseBasicParsing -TimeoutSec 30).Content
  $consent = (Invoke-WebRequest -Uri ($siteOrigin + "/account-consent.html") -UseBasicParsing -TimeoutSec 30).Content
  if ($index -notmatch 'href="account\.html"' -or
      $privacy -notmatch 'skillcheck-privacy-2026-08-08-v10' -or
      $privacy -match '\[Адрес оператора опубликован на основном сайте Yandex Cloud\]' -or
      $consent -notmatch 'skillcheck-account-2026-08-08-v1') {
    throw "Live account entry or legal documents are not ready for registration."
  }
}

foreach ($path in @($yc, $ydb)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required Yandex CLI input is missing." }
}

try {
  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) {
    throw "Temporary YDB token was not created."
  }

  Assert-LiveDocuments
  $before = Get-AccountSettings
  if (-not $before.ContainsKey("account_registration_enabled")) { throw "Registration gate is missing." }
  Assert-AccountSettings ([string]$before["account_registration_enabled"])
  if ([string]$before["account_registration_enabled"] -notin @("true", "false")) {
    throw "Registration gate has an invalid value."
  }

  $configBefore = Get-LiveAccountConfig
  $expectedBeforeEnabled = [string]$before["account_registration_enabled"] -eq "true"
  if ($configBefore.ok -ne $true -or $configBefore.enabled -ne $expectedBeforeEnabled -or [string]$configBefore.clientId -ne $clientId -or
      [string]$configBefore.redirectUri -ne $redirectUri -or [string]$configBefore.scope -ne "login:email" -or
      $configBefore.publicProfileEnabled -ne $false) {
    throw "Live account configuration differs from the approved OAuth boundary."
  }

  if ([string]$before["account_registration_enabled"] -eq "false") {
    Set-RegistrationGate "true"
    $gateChanged = $true
  }

  Assert-AccountSettings "true"
  $configAfter = Get-LiveAccountConfig
  if ($configAfter.ok -ne $true -or $configAfter.enabled -ne $true -or
      $configAfter.publicProfileEnabled -ne $false -or [string]$configAfter.clientId -ne $clientId) {
    throw "Live registration did not reach the approved registration-only state."
  }

  $gateChanged = $false
  Write-Host "DONE: account registration is open; profile publication and employer contact remain closed."
  Write-Host ($siteOrigin + "/account.html")
} catch {
  if ($gateChanged) {
    try {
      Set-RegistrationGate "false"
      Assert-AccountSettings "false"
      Write-Warning "Registration opening failed and was rolled back to closed."
    } catch {
      Write-Warning "Registration rollback could not be verified; inspect YDB settings immediately."
    }
  }
  throw
} finally {
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
