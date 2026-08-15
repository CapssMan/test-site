param([switch]$Deploy)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (-not $Deploy) { throw "Explicit -Deploy confirmation is required." }

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$node = "C:\Program Files\nodejs\node.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$gatewayOrigin = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$sourceTag = "account-v2"
$backendVersion = "yandex-account-recovery-2026-08-15-2"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$packagePath = Join-Path $env:TEMP ("skillcheck-account-recovery-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""
$createdId = ""
$tagReplaced = $false
$deploymentSucceeded = $false

function Get-Version([string]$tag) {
  $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json)
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
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
  foreach ($path in @($yc, $node, $gatewaySpec, (Join-Path $repoRoot "cloud\account-handler.js"), (Join-Path $repoRoot "account.html"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required recovery deployment input is missing." }
  }
  foreach ($validator in @("test-candidate-account.js", "test-yandex-cors-origins.js", "test-yandex-unified-preview.js", "check-repository-secrets.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Recovery validator failed: $validator" }
  }

  $source = Get-Version $sourceTag
  if ([string]$source.environment.RUNTIME_MODE -ne "account" -or [string]$source.log_options.disabled -ne "True") {
    throw "Source account runtime boundary is invalid."
  }
  foreach ($name in @("YDB_CONNECTION_STRING", "YANDEX_ID_CLIENT_ID", "YANDEX_ID_REDIRECT_URI", "IDENTITY_HASH_SECRET_V1", "ACCOUNT_SESSION_SECRET_V1")) {
    if ([String]::IsNullOrWhiteSpace([string]$source.environment.$name)) { throw "Source runtime is missing protected input." }
  }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  if ([regex]::Matches($specText, 'tag: "account-v2"').Count -ne 2 -or $specText.Contains('tag: "account-v3"')) {
    throw "Gateway account-v2 route boundary is invalid."
  }

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
  $packageObject = "packages/account-recovery-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $null = @(& $yc serverless function version remove-tag --id ([string]$source.id) --tag $sourceTag --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Could not release account-v2 tag." }
  try {
    $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
      --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
      --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
      --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
      --description "Account YDB write fix with staged diagnostics and no PII logs" --environment (Join-Environment $source) `
      --tags $sourceTag --concurrency ([int]$source.concurrency) --no-logging --format json)
    if ($LASTEXITCODE -ne 0) { throw "Account recovery runtime creation failed." }
    $created = ($raw -join "`n") | ConvertFrom-Json
    $createdId = [string]$created.id
    if ([String]::IsNullOrWhiteSpace($createdId) -or $createdId -eq [string]$source.id) { throw "Replacement account-v2 id is invalid." }
    $tagReplaced = $true
  } catch {
    $null = @(& $yc serverless function version set-tag --id ([string]$source.id) --tag $sourceTag --format json) | ConvertFrom-Json
    throw
  }

  & (Join-Path $PSScriptRoot "deploy-yandex-public-site.ps1")
  if ($LASTEXITCODE -ne 0) { throw "Public account page deployment failed." }

  $configResponse = Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/v1/account"); Headers = @{ Origin = $origin }; UseBasicParsing = $true; TimeoutSec = 30 }
  $config = $configResponse.Content | ConvertFrom-Json
  if ($config.ok -ne $true -or [string]$config.backendVersion -ne $backendVersion -or $config.enabled -ne $true) { throw "Live replacement account-v2 config verification failed." }
  $primary = Invoke-WebRequestWithRetry @{ Uri = ($origin + "/account.html?build=account-recovery"); UseBasicParsing = $true; TimeoutSec = 30 }
  $preview = Invoke-WebRequestWithRetry @{ Uri = ($gatewayOrigin + "/preview-unified/account.html?build=account-recovery"); UseBasicParsing = $true; TimeoutSec = 30 }
  foreach ($page in @($primary.Content, $preview.Content)) {
    if ($page -notmatch "ACC-YDB-WRITE" -or $page -notmatch "accountErrorMessage") { throw "Live account diagnostic page verification failed." }
  }

  $deploymentSucceeded = $true
  Write-Host "DONE: replacement account-v2 is live; staged OAuth/YDB diagnostics are active; account data remains private and all employer gates remain unchanged."
} catch {
  if ($tagReplaced -and -not [String]::IsNullOrWhiteSpace($createdId)) {
    try {
      $null = @(& $yc serverless function version remove-tag --id $createdId --tag $sourceTag --format json) | ConvertFrom-Json
      $null = @(& $yc serverless function version set-tag --id ([string]$source.id) --tag $sourceTag --format json) | ConvertFrom-Json
      Write-Warning "Recovery deployment failed; account-v2 tag was restored to the previous version."
    } catch { Write-Warning "Automatic account-v2 tag rollback failed; inspect the account route immediately." }
  }
  throw
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  if (-not $deploymentSucceeded) { Write-Warning "Account recovery deployment did not complete." }
}
