param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$allowedOrigins = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$sourceTag = "admin-v8"
$targetTag = "admin-v9"
$retiredTag = "admin-v6"
$packagePath = Join-Path $env:TEMP ("skillcheck-question-analytics-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""

function Get-Version([string]$tag) {
  $raw = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return $raw | ConvertFrom-Json
}

function Build-Environment([object]$source) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($property in $source.environment.PSObject.Properties) {
    if ($property.Name -eq "ALLOWED_ORIGINS") { continue }
    if ([string]$property.Value -match "[,`r`n]") { throw "Runtime environment value cannot be safely forwarded by CLI." }
    $pairs.Add($property.Name + "=" + [string]$property.Value)
  }
  if ([string]$source.environment.RUNTIME_MODE -ne "admin") { throw "Source runtime is not the admin contour." }
  $pairs.Add("ALLOWED_ORIGINS=" + $allowedOrigins)
  return [string]::Join(",", $pairs)
}

try {
  foreach ($path in @($yc, $gatewaySpec, (Join-Path $repoRoot "cloud\question-analytics.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required deployment input is missing." }
  }
  foreach ($validator in @("test-question-analytics.js", "test-question-analytics-ui.js", "test-yandex-admin-runtime.js")) {
    & node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Question analytics validator failed: $validator" }
  }

  $source = Get-Version $sourceTag
  $retired = Get-Version $retiredTag
  $null = & $yc serverless function version remove-tag --id ([string]$retired.id) --tag $retiredTag --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Legacy admin tag retirement failed." }

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  if ($LASTEXITCODE -ne 0 -or $archiveEntries -notcontains "question-analytics.js" -or $archiveEntries -notcontains "admin-handler.js" -or
      $archiveEntries -notcontains "index.js" -or ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' })) {
    throw "Runtime package boundary is invalid."
  }

  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/question-analytics-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $environment = Build-Environment $source
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $createdRaw = & $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
    --description "Protected aggregate question analytics successor of admin-v8" --environment $environment `
    --tags $targetTag --concurrency ([int]$source.concurrency) --no-logging --format json
  if ($LASTEXITCODE -ne 0) { throw "Admin runtime successor creation failed." }
  $created = $createdRaw | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created runtime id is missing." }

  $null = & $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway cutover failed." }
  $verified = Get-Version $targetTag
  if ([string]$verified.id -ne [string]$created.id -or [string]$verified.environment.RUNTIME_MODE -ne "admin") {
    throw "Created admin runtime verification failed."
  }
  Write-Host ("DONE: admin-v9 deployed and routed; admin-v8 remains rollback. Version id: " + [string]$created.id)
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) {
    & $yc storage s3 rm $packageUri --only-show-errors | Out-Null
  }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
}
