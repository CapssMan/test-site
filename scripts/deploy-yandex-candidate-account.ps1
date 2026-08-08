param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z0-9]{20,80}$")]
  [string]$YandexClientId
)

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
$redirectUri = $origin + "/account.html"
$sourceTag = "assessment-v11"
$assessmentTag = "assessment-v12"
$accountTag = "account-v1"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$schema = Join-Path $repoRoot "cloud\schema\011_candidate_accounts.sql"
$packagePath = Join-Path $env:TEMP ("skillcheck-candidate-account-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""

function Get-Version([string]$tag) {
  $raw = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return $raw | ConvertFrom-Json
}

function Assert-Tag-Missing([string]$tag) {
  $null = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json 2>$null
  if ($LASTEXITCODE -eq 0) { throw "Target runtime tag already exists: $tag" }
}

function New-SessionSecret() {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Join-Environment([Collections.Specialized.OrderedDictionary]$values) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($name in $values.Keys) {
    $value = [string]$values[$name]
    if ($value -match "[,`r`n]") { throw "Runtime environment value cannot be safely forwarded by CLI." }
    $pairs.Add(([string]$name) + "=" + $value)
  }
  return [string]::Join(",", $pairs)
}

function Assessment-Environment([object]$source, [string]$sessionSecret) {
  if ([string]$source.environment.RUNTIME_MODE -ne "assessment") { throw "Source runtime is not assessment." }
  $values = [ordered]@{}
  foreach ($property in $source.environment.PSObject.Properties) {
    if (@("ALLOWED_ORIGIN", "ALLOWED_ORIGINS", "ACCOUNT_SESSION_SECRET_V1") -contains $property.Name) { continue }
    $values[$property.Name] = [string]$property.Value
  }
  $values["ALLOWED_ORIGINS"] = $origin
  $values["ACCOUNT_SESSION_SECRET_V1"] = $sessionSecret
  return Join-Environment $values
}

function Account-Environment([object]$source, [string]$sessionSecret) {
  foreach ($name in @("YDB_CONNECTION_STRING", "IDENTITY_HASH_SECRET_V1")) {
    if ([String]::IsNullOrWhiteSpace([string]$source.environment.$name)) { throw "Source environment is missing required account input: $name" }
  }
  $values = [ordered]@{
    RUNTIME_MODE = "account"
    YDB_CONNECTION_STRING = [string]$source.environment.YDB_CONNECTION_STRING
    ALLOWED_ORIGINS = $origin
    YANDEX_ID_CLIENT_ID = $YandexClientId
    YANDEX_ID_REDIRECT_URI = $redirectUri
    IDENTITY_HASH_SECRET_V1 = [string]$source.environment.IDENTITY_HASH_SECRET_V1
    ACCOUNT_SESSION_SECRET_V1 = $sessionSecret
  }
  return Join-Environment $values
}

function Assert-Account-Gates-Closed() {
  $query = 'SELECT setting_key, setting_value FROM assessment_runtime_settings WHERE setting_key IN ("account_registration_enabled", "profile_publication_enabled", "employer_contact_enabled") ORDER BY setting_key;'
  $raw = & $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Candidate account gate verification failed." }
  $rows = @($raw | ConvertFrom-Json)
  if ($rows.Count -ne 3) { throw "Candidate account gates are incomplete." }
  foreach ($row in $rows) {
    if ([string]$row.setting_value -ne "false") { throw "Candidate account gate is unexpectedly open." }
  }
}

function Create-Version([object]$source, [string]$tag, [string]$environment, [string]$description) {
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $raw = & $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
    --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $script:packageObject --package-sha256 $script:packageSha `
    --description $description --environment $environment --tags $tag --concurrency ([int]$source.concurrency) `
    --no-logging --format json
  if ($LASTEXITCODE -ne 0) { throw "Runtime creation failed: $tag" }
  $created = $raw | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created runtime id is missing: $tag" }
  return $created
}

try {
  foreach ($path in @($yc, $ydb, $node, $gatewaySpec, $schema, (Join-Path $repoRoot "cloud\account-handler.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required candidate-account deployment input is missing." }
  }
  foreach ($validator in @("test-candidate-account.js", "test-assessment-handler.js", "test-ydb-account-store.js", "test-candidate-account-deployment.js")) {
    & $node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Candidate-account validator failed: $validator" }
  }

  Assert-Tag-Missing $assessmentTag
  Assert-Tag-Missing $accountTag
  $source = Get-Version $sourceTag
  $sessionSecret = New-SessionSecret
  $assessmentEnvironment = Assessment-Environment $source $sessionSecret
  $accountEnvironment = Account-Environment $source $sessionSecret

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $null = & $ydb -e $endpoint -d $database sql -f $schema --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "Candidate-account schema migration failed." }
  Assert-Account-Gates-Closed

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "account-core.js", "account-handler.js", "ydb-account-store.js", "assessment-handler.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) {
    throw "Runtime package boundary is invalid."
  }
  $script:packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $script:packageObject = "packages/candidate-account-$($script:packageSha).zip"
  $packageUri = "s3://$packageBucket/$($script:packageObject)"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $assessment = Create-Version $source $assessmentTag $assessmentEnvironment "Assessment with optional profile-bound retake; account gates closed"
  $account = Create-Version $source $accountTag $accountEnvironment "Yandex ID PKCE candidate account; registration and discovery gates closed"
  $null = & $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway candidate-account cutover failed." }

  $verifiedAssessment = Get-Version $assessmentTag
  $verifiedAccount = Get-Version $accountTag
  if ([string]$verifiedAssessment.id -ne [string]$assessment.id -or [string]$verifiedAssessment.environment.RUNTIME_MODE -ne "assessment" -or
      [string]$verifiedAccount.id -ne [string]$account.id -or [string]$verifiedAccount.environment.RUNTIME_MODE -ne "account" -or
      [string]$verifiedAccount.environment.YANDEX_ID_CLIENT_ID -ne $YandexClientId -or
      [String]::IsNullOrWhiteSpace([string]$verifiedAccount.environment.ACCOUNT_SESSION_SECRET_V1)) {
    throw "Candidate-account runtime verification failed."
  }
  Assert-Account-Gates-Closed
  Write-Host "DONE: account-v1 and assessment-v12 are routed; all three candidate-account gates remain closed."
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
