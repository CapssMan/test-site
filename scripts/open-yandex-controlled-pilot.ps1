param(
  [switch]$NotificationSubmitted
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not $NotificationSubmitted) { throw "Explicit -NotificationSubmitted confirmation is required." }

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$siteOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$accountUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/account"

function Invoke-YdbQuery([string]$query) {
  $raw = & $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "YDB controlled-pilot query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @($raw | ConvertFrom-Json)
}

function Get-Settings() {
  $rows = Invoke-YdbQuery "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;"
  $settings = @{}
  foreach ($row in $rows) { $settings[[string]$row.setting_key] = [string]$row.setting_value }
  return $settings
}

function Set-Gates([string]$legal, [string]$issuance, [string]$registration) {
  foreach ($value in @($legal, $issuance, $registration)) {
    if ($value -notin @("true", "false")) { throw "Invalid gate value." }
  }
  $query = "UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES " +
    "(Utf8('legal_pilot_approved'), Utf8('$legal'), CurrentUtcTimestamp()), " +
    "(Utf8('attempt_issuance_enabled'), Utf8('$issuance'), CurrentUtcTimestamp()), " +
    "(Utf8('account_registration_enabled'), Utf8('$registration'), CurrentUtcTimestamp());"
  $null = Invoke-YdbQuery $query
}

function Assert-State([string]$legal, [string]$issuance, [string]$registration) {
  $settings = Get-Settings
  foreach ($key in @("legal_pilot_approved", "attempt_issuance_enabled", "account_registration_enabled", "profile_publication_enabled", "employer_contact_enabled", "retention_automation_enabled")) {
    if (-not $settings.ContainsKey($key)) { throw "Required gate is missing: $key" }
  }
  if ($settings["legal_pilot_approved"] -ne $legal -or
      $settings["attempt_issuance_enabled"] -ne $issuance -or
      $settings["account_registration_enabled"] -ne $registration -or
      $settings["profile_publication_enabled"] -ne "false" -or
      $settings["employer_contact_enabled"] -ne "false" -or
      $settings["retention_automation_enabled"] -ne "true") {
    throw "Runtime settings differ from the approved controlled-pilot boundary."
  }
}

foreach ($path in @($yc, $ydb)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required Yandex CLI input is missing." }
}

$before = $null
$changed = $false
try {
  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }

  $privacy = (Invoke-WebRequest -Uri ($siteOrigin + "/privacy.html") -UseBasicParsing -TimeoutSec 30).Content
  $accountConsent = (Invoke-WebRequest -Uri ($siteOrigin + "/account-consent.html") -UseBasicParsing -TimeoutSec 30).Content
  if ($privacy -notmatch "skillcheck-privacy-2026-08-08-v10" -or
      $privacy -notmatch "Первичное уведомление.+направлено" -or
      $accountConsent -notmatch "действует с 8 августа 2026 года") {
    throw "Live legal documents are not ready for the controlled pilot."
  }

  $before = Get-Settings
  Assert-State $before["legal_pilot_approved"] $before["attempt_issuance_enabled"] $before["account_registration_enabled"]
  Set-Gates "true" "true" "true"
  $changed = $true
  Assert-State "true" "true" "true"

  $account = Invoke-WebRequest -Method GET -Uri $accountUrl -Headers @{ Origin = $siteOrigin } -UseBasicParsing -TimeoutSec 30
  $config = $account.Content | ConvertFrom-Json
  if ($account.StatusCode -ne 200 -or $config.ok -ne $true -or $config.enabled -ne $true -or $config.publicProfileEnabled -ne $false) {
    throw "Live account boundary did not reach the approved state."
  }

  $changed = $false
  Write-Host "DONE: controlled pilot, attempt issuance and account registration are open."
  Write-Host "CLOSED: expanded profile publication and employer contact."
  Write-Host $siteOrigin
} catch {
  if ($changed -and $null -ne $before) {
    try {
      Set-Gates $before["legal_pilot_approved"] $before["attempt_issuance_enabled"] $before["account_registration_enabled"]
      Assert-State $before["legal_pilot_approved"] $before["attempt_issuance_enabled"] $before["account_registration_enabled"]
      Write-Warning "Opening failed and gates were rolled back."
    } catch {
      Write-Warning "Gate rollback could not be verified; inspect YDB settings immediately."
    }
  }
  throw
} finally {
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
