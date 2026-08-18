param([switch]$PublishExpansion)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $PublishExpansion) { throw "Explicit -PublishExpansion confirmation is required." }

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$node = "C:\Users\Caps\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
$apiBase = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$bankPlan = @(
  @{
    TestId = "tourism-junior"
    Version = "Tourism & Hospitality Operations Junior v1.1"
    PrivatePath = Join-Path $workspaceRoot "skillcheck-private-tourism-r1\tourism-junior.json"
    PublicPath = Join-Path $repoRoot "data\tourism-junior.json"
    ObjectKey = "banks/tourism-v1/tourism-junior.json"
    Audit = "audit-tourism-bank.js"
  },
  @{
    TestId = "software-junior"
    Version = "Software Development Junior v1.0"
    PrivatePath = Join-Path $workspaceRoot "skillcheck-private-software-r1\software-junior.json"
    PublicPath = Join-Path $repoRoot "data\software-junior.json"
    ObjectKey = "banks/software-v1/software-junior.json"
    Audit = "audit-software-bank.js"
  },
  @{
    TestId = "product-project-junior"
    Version = "Product / Project Management Junior v1.0"
    PrivatePath = Join-Path $workspaceRoot "skillcheck-private-product-project-r1\product-project-junior.json"
    PublicPath = Join-Path $repoRoot "data\product-project-junior.json"
    ObjectKey = "banks/product-project-v1/product-project-junior.json"
    Audit = "audit-product-project-bank.js"
  },
  @{
    TestId = "sales-junior"
    Version = "Sales / Business Development Junior v1.0"
    PrivatePath = Join-Path $workspaceRoot "skillcheck-private-sales-r1\sales-junior.json"
    PublicPath = Join-Path $repoRoot "data\sales-junior.json"
    ObjectKey = "banks/sales-v1/sales-junior.json"
    Audit = "audit-sales-bank.js"
  }
)
$runtimePlan = @(
  @{ Source = "assessment-v13"; Target = "assessment-v14"; Mode = "assessment" },
  @{ Source = "account-v5"; Target = "account-v6"; Mode = "account" },
  @{ Source = "admin-v11"; Target = "admin-v12"; Mode = "admin" },
  @{ Source = "employer-v3"; Target = "employer-v4"; Mode = "employer" }
)
$packagePath = Join-Path $env:TEMP ("skillcheck-expansion-runtime-" + [Guid]::NewGuid().ToString("N") + ".zip")
$verifyPath = Join-Path $env:TEMP ("skillcheck-expansion-private-" + [Guid]::NewGuid().ToString("N") + ".json")
$publicVerifyPath = Join-Path $env:TEMP ("skillcheck-expansion-public-" + [Guid]::NewGuid().ToString("N") + ".json")
$packageUri = ""
$stageUris = New-Object System.Collections.Generic.List[string]
$gatewayUpdated = $false
$ydbReady = $false
$previousSettings = $null

function Invoke-YdbJson([string]$query) {
  $raw = @(& $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array)
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @(($raw -join "`n") | ConvertFrom-Json)
}

function Get-Settings() {
  $result = @{}
  foreach ($row in @(Invoke-YdbJson "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;")) {
    $result[[string]$row.setting_key] = [string]$row.setting_value
  }
  return $result
}

function Set-AttemptGates([string]$issuance, [string]$selfService, [string]$accountRequired) {
  foreach ($value in @($issuance, $selfService, $accountRequired)) {
    if ($value -notin @("true", "false")) { throw "Invalid gate value." }
  }
  $null = Invoke-YdbJson ("UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES " +
    "(Utf8('attempt_issuance_enabled'), Utf8('$issuance'), CurrentUtcTimestamp()), " +
    "(Utf8('account_self_service_enabled'), Utf8('$selfService'), CurrentUtcTimestamp()), " +
    "(Utf8('account_required_for_attempts'), Utf8('$accountRequired'), CurrentUtcTimestamp());")
}

function Get-Version([string]$tag) {
  $raw = @(& $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json)
  if ($LASTEXITCODE -ne 0) { throw "Required runtime tag is unavailable: $tag" }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Assert-Tag-Missing([string]$tag) {
  $before = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $null = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json 2>$null
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $before }
  if ($code -eq 0) { throw "Target runtime tag already exists: $tag" }
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

function Create-Version([object]$source, [string]$tag, [string]$description) {
  $timeout = [int]([string]$source.execution_timeout -replace "s$", "")
  $memory = [int]([long]$source.resources.memory / 1MB)
  $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
    --entrypoint ([string]$source.entrypoint) --memory ($memory.ToString() + "MB") `
    --execution-timeout ($timeout.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
    --package-bucket-name $packageBucket --package-object-name $script:packageObject --package-sha256 $script:packageSha `
    --description $description --environment (Join-Environment $source) --tags $tag `
    --concurrency ([int]$source.concurrency) --no-logging --format json)
  if ($LASTEXITCODE -ne 0) { throw "Runtime creation failed: $tag" }
  $created = ($raw -join "`n") | ConvertFrom-Json
  if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Created runtime id is missing: $tag" }
  return $created
}

function Escape-Yql([string]$value) {
  if ($value -notmatch '^[A-Za-z0-9 &+./_-]{1,180}$') { throw "Unsafe YQL metadata value." }
  return $value.Replace('\', '\\').Replace('"', '\"')
}

function Publish-PrivateBank([hashtable]$bank) {
  $privatePath = [string]$bank.PrivatePath
  $publicPath = [string]$bank.PublicPath
  $testId = [string]$bank.TestId
  $version = [string]$bank.Version
  $objectKey = [string]$bank.ObjectKey
  $privateSha = (Get-FileHash -LiteralPath $privatePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $privateBytes = (Get-Item -LiteralPath $privatePath).Length
  $stageKey = "bank-staging/expansion-v1/$testId-$privateSha.json"
  $stageUri = "s3://$packageBucket/$stageKey"
  $finalUri = "s3://$packageBucket/$objectKey"
  $stageUris.Add($stageUri)

  & $yc storage s3 cp $privatePath $stageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Private-bank staging upload failed: $testId" }
  & $yc storage s3 cp $stageUri $finalUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Private-bank promotion failed: $testId" }
  Remove-Item -LiteralPath $verifyPath -Force -ErrorAction SilentlyContinue
  & $yc storage s3 cp $finalUri $verifyPath --only-show-errors
  if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $verifyPath).Length -ne $privateBytes -or
      (Get-FileHash -LiteralPath $verifyPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $privateSha) {
    throw "Private-bank remote checksum mismatch: $testId"
  }

  $publicDigest = [string](Get-Content -Raw -Encoding UTF8 $publicPath | ConvertFrom-Json).publicDigest
  if ($publicDigest -notmatch '^[a-f0-9]{64}$') { throw "Public digest is invalid: $testId" }
  $null = Invoke-YdbJson ("UPSERT INTO assessment_banks (test_id, bank_version, object_key, private_digest, public_digest, active, updated_at) VALUES " +
    "(Utf8('" + (Escape-Yql $testId) + "'), Utf8('" + (Escape-Yql $version) + "'), Utf8('" + (Escape-Yql $objectKey) + "'), Utf8('$privateSha'), Utf8('$publicDigest'), true, CurrentUtcTimestamp()); " +
    "UPSERT INTO active_bank_versions (test_id, bank_version, updated_at) VALUES " +
    "(Utf8('" + (Escape-Yql $testId) + "'), Utf8('" + (Escape-Yql $version) + "'), CurrentUtcTimestamp());")
  $stored = @(Invoke-YdbJson ("SELECT test_id, bank_version, object_key, private_digest, public_digest, active FROM assessment_banks WHERE test_id = Utf8('" + (Escape-Yql $testId) + "') AND active = true;"))
  if ($stored.Count -ne 1 -or [string]$stored[0].bank_version -ne $version -or [string]$stored[0].private_digest -ne $privateSha -or [string]$stored[0].public_digest -ne $publicDigest) {
    throw "YDB bank metadata verification failed: $testId"
  }
}

try {
  foreach ($required in @($yc, $ydb, $node, $gatewaySpec)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required deployment input is missing: $required" }
  }
  foreach ($bank in $bankPlan) {
    foreach ($required in @([string]$bank.PrivatePath, [string]$bank.PublicPath, (Join-Path $repoRoot ("scripts\" + [string]$bank.Audit)))) {
      if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required bank input is missing: $required" }
    }
  }
  foreach ($validator in @("validate-tests.js", "test-public-bank-secrecy.js", "check-static-links.js", "check-js-syntax.js")) {
    & $node (Join-Path $repoRoot ("scripts\" + $validator))
    if ($LASTEXITCODE -ne 0) { throw "Expansion validator failed: $validator" }
  }
  foreach ($bank in $bankPlan) {
    & $node (Join-Path $repoRoot ("scripts\" + [string]$bank.Audit)) ([string]$bank.PrivatePath)
    if ($LASTEXITCODE -ne 0) { throw "Bank audit failed: $($bank.TestId)" }
  }

  $specText = [IO.File]::ReadAllText($gatewaySpec)
  foreach ($item in $runtimePlan) {
    if ([regex]::Matches($specText, 'tag: "' + [regex]::Escape([string]$item.Target) + '"').Count -ne 2) {
      throw "Gateway does not route both methods through $($item.Target)."
    }
    Assert-Tag-Missing ([string]$item.Target)
  }

  $sources = @{}
  foreach ($item in $runtimePlan) {
    $source = Get-Version ([string]$item.Source)
    if ([string]$source.environment.RUNTIME_MODE -ne [string]$item.Mode) { throw "Unexpected runtime mode for $($item.Source)." }
    $sources[[string]$item.Source] = $source
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $ydbReady = $true
  $previousSettings = Get-Settings
  $requiredSettings = @(
    "legal_pilot_approved", "attempt_issuance_enabled", "account_self_service_enabled", "account_required_for_attempts",
    "profile_publication_enabled", "employer_workspace_enabled", "employer_contact_enabled", "employer_chat_enabled",
    "candidate_credentials_enabled", "employer_company_profiles_enabled"
  )
  foreach ($key in $requiredSettings) {
    if (-not $previousSettings.ContainsKey($key)) { throw "Required runtime gate is missing: $key" }
  }
  if ($previousSettings.legal_pilot_approved -ne "true") { throw "Legal pilot gate is not approved." }
  foreach ($key in @("profile_publication_enabled", "employer_workspace_enabled", "employer_contact_enabled", "employer_chat_enabled", "candidate_credentials_enabled", "employer_company_profiles_enabled")) {
    if ($previousSettings[$key] -ne "false") { throw "Closed production gate differs from approved state: $key" }
  }
  Set-AttemptGates "false" "false" $previousSettings.account_required_for_attempts
  $active = @(Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM assessment_sessions WHERE state = Utf8('active') OR state = Utf8('reserved');")
  if ($active.Count -ne 1 -or [long]$active[0].row_count -ne 0) { throw "Active assessment sessions block expansion cutover." }

  $bucketRaw = @(& $yc storage bucket get $packageBucket --format json)
  if ($LASTEXITCODE -ne 0) { throw "Private bucket configuration is unavailable." }
  $bucket = ($bucketRaw -join "`n") | ConvertFrom-Json
  if ($bucket.anonymous_access_flags.read -eq $true -or $bucket.anonymous_access_flags.list -eq $true -or $bucket.disabled_statickey_auth -ne $true) {
    throw "Private bucket boundary is not fail-closed."
  }

  foreach ($bank in $bankPlan) { Publish-PrivateBank $bank }

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  foreach ($required in @("index.js", "assessment-handler.js", "account-handler.js", "admin-handler.js", "employer-handler.js")) {
    if ($archiveEntries -notcontains $required) { throw "Runtime package is missing: $required" }
  }
  if ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }) {
    throw "Runtime package boundary is invalid."
  }
  $script:packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $script:packageObject = "packages/expansion-v1-$($script:packageSha).zip"
  $packageUri = "s3://$packageBucket/$($script:packageObject)"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  $created = @{}
  foreach ($item in $runtimePlan) {
    $created[[string]$item.Target] = Create-Version $sources[[string]$item.Source] ([string]$item.Target) "SkillCheck multi-direction expansion runtime"
  }
  $null = @(& $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json) | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Expansion API Gateway cutover failed." }
  $gatewayUpdated = $true
  foreach ($item in $runtimePlan) {
    $current = Get-Version ([string]$item.Target)
    if ([string]$current.id -ne [string]$created[[string]$item.Target].id) { throw "Runtime tag verification failed: $($item.Target)" }
  }

  & (Join-Path $repoRoot "scripts\deploy-yandex-public-site.ps1") -SkipGatewayUpdate
  if ($LASTEXITCODE -ne 0) { throw "Expansion public-site deployment failed." }
  Set-AttemptGates $previousSettings.attempt_issuance_enabled $previousSettings.account_self_service_enabled $previousSettings.account_required_for_attempts

  foreach ($bank in $bankPlan) {
    $testId = [string]$bank.TestId
    $ranking = Invoke-RestMethod -Method GET -Uri ($apiBase + "/v1/ranking?testId=" + $testId + "&limit=1") -Headers @{ Origin = $origin } -TimeoutSec 30
    if ($ranking.ok -ne $true -or [string]$ranking.testId -ne $testId) { throw "Live ranking verification failed: $testId" }
    Remove-Item -LiteralPath $publicVerifyPath -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Method GET -Uri ($origin + "/data/" + $testId + ".json") -UseBasicParsing -OutFile $publicVerifyPath -TimeoutSec 30
    if (-not (Test-Path -LiteralPath $publicVerifyPath) -or
        (Get-FileHash -LiteralPath ([string]$bank.PublicPath) -Algorithm SHA256).Hash.ToLowerInvariant() -ne
        (Get-FileHash -LiteralPath $publicVerifyPath -Algorithm SHA256).Hash.ToLowerInvariant()) {
      throw "Live public-bank verification failed: $testId"
    }
  }
  Write-Host "DONE: tourism-junior v1.1, software-junior v1.0, product-project-junior v1.0 and sales-junior v1.0 are live; nine production directions are available; employer, profile, credentials, chat and contact gates remain closed."
} catch {
  if ($ydbReady -and $null -ne $previousSettings) {
    try { Set-AttemptGates "false" "false" $previousSettings.account_required_for_attempts } catch { Write-Warning "Fail-closed attempt gates could not be verified." }
  }
  if ($gatewayUpdated) { Write-Warning "Gateway was updated before failure; issuance remains closed for manual inspection." }
  throw
} finally {
  foreach ($stageUri in $stageUris) {
    if (-not [String]::IsNullOrWhiteSpace($stageUri)) { & $yc storage s3 rm $stageUri --only-show-errors | Out-Null }
  }
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $verifyPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $publicVerifyPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
