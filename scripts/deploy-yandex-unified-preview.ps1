[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$publicDeploy = Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1"
$previewTest = Join-Path $PSScriptRoot "test-yandex-unified-preview.js"
$gatewayOrigin = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$primaryOrigin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$rollbackSpec = Join-Path ([IO.Path]::GetTempPath()) ("skillcheck-gateway-pre-unified-" + [guid]::NewGuid().ToString("N") + ".yaml")
$gatewayMayBeChanged = $false

function Invoke-WebRequestWithRetry([hashtable]$Parameters) {
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try { return Invoke-WebRequest @Parameters } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Update-Gateway([string]$SpecPath) {
  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $SpecPath --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway update failed." }
}

try {
  if (-not (Test-Path -LiteralPath $yc -PathType Leaf)) { throw "Yandex Cloud CLI is missing." }
  & node $previewTest
  if ($LASTEXITCODE -ne 0) { throw "Unified preview checks failed before deployment." }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  $rollbackText = [regex]::Replace($specText, '(?ms)^  # BEGIN UNIFIED_ORIGIN_PREVIEW\r?\n.*?^  # END UNIFIED_ORIGIN_PREVIEW\r?\n', '')
  if ($rollbackText -eq $specText -or $rollbackText -match 'preview-unified') { throw "Unified preview rollback boundary is invalid." }
  [IO.File]::WriteAllText($rollbackSpec, $rollbackText, [Text.UTF8Encoding]::new($false))

  $gatewayMayBeChanged = $true
  & powershell.exe -ExecutionPolicy Bypass -File $publicDeploy
  if ($LASTEXITCODE -ne 0) { throw "Public-site deployment failed during unified preview rollout." }

  $accountUrl = $gatewayOrigin + "/preview-unified/account.html?verify=unified-preview"
  $dataUrl = $gatewayOrigin + "/preview-unified/data/dev-quick.json?verify=unified-preview"
  $account = Invoke-WebRequestWithRetry @{ Uri = $accountUrl; UseBasicParsing = $true; TimeoutSec = 30 }
  $data = Invoke-WebRequestWithRetry @{ Uri = $dataUrl; UseBasicParsing = $true; TimeoutSec = 30 }
  $config = Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/account"); UseBasicParsing = $true; TimeoutSec = 30 }
  $primary = Invoke-WebRequestWithRetry @{ Uri = ($primaryOrigin + "/account.html?verify=unified-preview"); UseBasicParsing = $true; TimeoutSec = 30 }

  if ([int]$account.StatusCode -ne 200 -or [string]$account.Headers["Content-Type"] -notmatch '^text/html' -or
      $account.Content -notmatch 'IS_UNIFIED_PREVIEW' -or $account.Content -notmatch 'IS_UNIFIED_PREVIEW\?"/v1/account"') {
    throw "Unified account preview verification failed."
  }
  if ([int]$data.StatusCode -ne 200 -or [string]$data.Headers["Content-Type"] -notmatch '^application/json') {
    throw "Unified static-data preview verification failed."
  }
  $configBody = $config.Content | ConvertFrom-Json
  if ([int]$config.StatusCode -ne 200 -or $configBody.ok -ne $true -or $configBody.enabled -ne $true) {
    throw "Unified account API verification failed."
  }
  if ([int]$primary.StatusCode -ne 200 -or $primary.Content -notmatch 'PRIMARY_SITE_ORIGIN') {
    throw "Existing primary account page verification failed."
  }

  $bindingsRaw = @(& $yc serverless function list-access-bindings --id $functionId --format json) -join "`n"
  if ($LASTEXITCODE -ne 0 -or $bindingsRaw -match 'allUsers') { throw "Cloud Function unexpectedly has public invocation access." }

  Write-Host "DONE: isolated unified-origin preview is live; existing primary site remains active; Cloud Function is not public."
  Write-Host ($gatewayOrigin + "/preview-unified/account.html")
} catch {
  if ($gatewayMayBeChanged -and (Test-Path -LiteralPath $rollbackSpec -PathType Leaf)) {
    try {
      Update-Gateway $rollbackSpec
      Write-Warning "Unified preview failed and API Gateway was restored without preview routes."
    } catch {
      Write-Warning "Unified preview failed and automatic gateway rollback also failed; inspect the gateway specification immediately."
    }
  }
  throw
} finally {
  if (Test-Path -LiteralPath $rollbackSpec -PathType Leaf) { Remove-Item -LiteralPath $rollbackSpec -Force }
}
