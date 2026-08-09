param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
$sourceTag = "account-v1"
$employerTag = "employer-v1"
$schema = Join-Path $repoRoot "cloud\schema\012_employer_workspace.sql"
$schemaRuntimePath = Join-Path $env:TEMP ("skillcheck-employer-schema-" + [Guid]::NewGuid().ToString("N") + ".sql")
$settingsSchema = Join-Path $repoRoot "cloud\schema\013_employer_runtime_settings.sql"
$settingsRuntimePath = Join-Path $env:TEMP ("skillcheck-employer-settings-" + [Guid]::NewGuid().ToString("N") + ".sql")
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$packagePath = Join-Path $env:TEMP ("skillcheck-employer-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""

function Get-Version([string]$tag) {
  $raw = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return $raw | ConvertFrom-Json
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

function Join-Environment([Collections.Specialized.OrderedDictionary]$values) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($name in $values.Keys) {
    $value = [string]$values[$name]
    if ($value -match "[,`r`n]") { throw "Runtime environment value cannot be safely forwarded." }
    $pairs.Add(([string]$name) + "=" + $value)
  }
  return [string]::Join(",", $pairs)
}

function Assert-Gates-Closed() {
  $query = "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;"
  $raw = & $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Employer gate verification failed." }
  $rows = $raw | ConvertFrom-Json
  $settings = @{}
  foreach ($row in $rows) { $settings[[string]$row.setting_key] = [string]$row.setting_value }
  foreach ($key in @("employer_workspace_enabled", "employer_contact_enabled", "profile_publication_enabled")) {
    if (-not $settings.ContainsKey($key) -or $settings[$key] -ne "false") { throw "Employer gate is missing or unexpectedly open: $key" }
  }
}

try {
  foreach ($path in @($yc, $ydb, $node, $schema, $settingsSchema, $gatewaySpec, (Join-Path $repoRoot "cloud\employer-handler.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required employer deployment input is missing." }
  }
  foreach ($validator in @("test-employer-foundation.js", "test-ydb-employer-store.js", "test-security.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Employer validator failed: $validator" }
  }

  Assert-Tag-Missing $employerTag
  $source = Get-Version $sourceTag
  foreach ($name in @("YDB_CONNECTION_STRING", "IDENTITY_HASH_SECRET_V1", "ACCOUNT_SESSION_SECRET_V1")) {
    if ([String]::IsNullOrWhiteSpace([string]$source.environment.$name)) { throw "Source account runtime is missing required input: $name" }
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  Copy-Item -LiteralPath $schema -Destination $schemaRuntimePath -Force
  if (-not (Test-Path -LiteralPath $schemaRuntimePath -PathType Leaf)) { throw "Temporary schema copy was not created." }
  $null = & $ydb -e $endpoint -d $database sql -f $schemaRuntimePath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Employer schema migration failed." }
  Copy-Item -LiteralPath $settingsSchema -Destination $settingsRuntimePath -Force
  if (-not (Test-Path -LiteralPath $settingsRuntimePath -PathType Leaf)) { throw "Temporary settings copy was not created." }
  $null = & $ydb -e $endpoint -d $database sql -f $settingsRuntimePath --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Employer runtime settings migration failed." }
  Assert-Gates-Closed

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Employer runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "employer-core.js", "employer-handler.js", "ydb-employer-store.js", "account-core.js", "ydb-account-store.js")) {
    if ($archiveEntries -notcontains $required) { throw "Employer runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) { throw "Employer package boundary is invalid." }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/employer-foundation-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Employer package upload failed." }

  $environment = Join-Environment ([ordered]@{
    RUNTIME_MODE = "employer"
    YDB_CONNECTION_STRING = [string]$source.environment.YDB_CONNECTION_STRING
    ALLOWED_ORIGINS = $origin
    IDENTITY_HASH_SECRET_V1 = [string]$source.environment.IDENTITY_HASH_SECRET_V1
    ACCOUNT_SESSION_SECRET_V1 = [string]$source.environment.ACCOUNT_SESSION_SECRET_V1
  })
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $raw = & $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
    --description "Verified employer search and 1-10 shortlists; workspace and contacts closed" `
    --environment $environment --tags $employerTag --concurrency ([int]$source.concurrency) --no-logging --format json
  if ($LASTEXITCODE -ne 0) { throw "Employer runtime creation failed." }
  $created = $raw | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Employer runtime id is missing." }

  $null = & $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Employer API Gateway route update failed." }
  $verified = Get-Version $employerTag
  if ([string]$verified.id -ne [string]$created.id -or [string]$verified.environment.RUNTIME_MODE -ne "employer") { throw "Employer runtime verification failed." }
  Assert-Gates-Closed
  Write-Host "DONE: employer-v1 is routed; employer workspace and contact gates remain closed."
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $schemaRuntimePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $settingsRuntimePath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
