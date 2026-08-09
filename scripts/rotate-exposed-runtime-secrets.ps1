param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$packagePath = Join-Path $env:TEMP ("skillcheck-security-rotation-" + [Guid]::NewGuid().ToString("N") + ".zip")
$groupSqlPath = Join-Path $env:TEMP ("skillcheck-group-rehash-" + [Guid]::NewGuid().ToString("N") + ".sql")
$packageUri = ""
$issuanceBefore = ""
$rotationSucceeded = $false

function Invoke-YcJson([string[]]$arguments) {
  $raw = @(& $yc @arguments --format json)
  if ($LASTEXITCODE -ne 0) { throw "Yandex CLI command failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return $null }
  return ($raw -join "`n") | ConvertFrom-Json
}

function Invoke-YdbJson([string]$query) {
  $raw = @(& $ydb -e $endpoint -d $database sql -s $query --format json-unicode-array)
  if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
  if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return @() }
  return @(($raw -join "`n") | ConvertFrom-Json)
}

function Invoke-YdbFile([string]$path) {
  $null = & $ydb -e $endpoint -d $database sql -f $path --format json-unicode-array
  if ($LASTEXITCODE -ne 0) { throw "YDB file query failed." }
}

function New-Secret() {
  $bytes = New-Object byte[] 48
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) }
  finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-HmacHex([string]$secret, [string]$value) {
  $key = [Text.Encoding]::UTF8.GetBytes($secret)
  $hmac = [Security.Cryptography.HMACSHA256]::new($key)
  try { return ([BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace("-", "").ToLowerInvariant() }
  finally { $hmac.Dispose() }
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

function Get-ReplacedEnvironment([object]$source, [Collections.Specialized.OrderedDictionary]$replacements) {
  $values = [ordered]@{}
  foreach ($property in $source.environment.PSObject.Properties) { $values[$property.Name] = [string]$property.Value }
  foreach ($name in $replacements.Keys) { $values[$name] = [string]$replacements[$name] }
  return Join-Environment $values
}

function Replace-TaggedVersion([string]$tag, [object]$source, [Collections.Specialized.OrderedDictionary]$replacements) {
  $environment = Get-ReplacedEnvironment $source $replacements
  $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
  $memoryMb = [int]([long]$source.resources.memory / 1MB)
  $removeOutput = @(& $yc serverless function version remove-tag --id ([string]$source.id) --tag $tag 2>$null)
  if ($LASTEXITCODE -ne 0) { throw "Could not release runtime tag: $tag" }
  try {
    $raw = @(& $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
      --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
      --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
      --package-bucket-name $packageBucket --package-object-name $script:packageObject --package-sha256 $script:packageSha `
      --description ("Credential rotation successor for " + $tag) --environment $environment --tags $tag `
      --concurrency ([int]$source.concurrency) --no-logging --format json)
    if ($LASTEXITCODE -ne 0) { throw "Replacement runtime creation failed: $tag" }
    $created = ($raw -join "`n") | ConvertFrom-Json
    if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Replacement runtime id is missing: $tag" }
    return [string]$created.id
  } catch {
    $restoreOutput = @(& $yc serverless function version set-tag --id ([string]$source.id) --tag $tag 2>$null)
    throw
  }
}

function Set-Issuance([string]$value) {
  if ($value -notin @("true", "false")) { throw "Invalid issuance value." }
  $null = Invoke-YdbJson ("UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES (Utf8('attempt_issuance_enabled'), Utf8('" + $value + "'), CurrentUtcTimestamp());")
}

try {
  foreach ($path in @($yc, $ydb, (Join-Path $repoRoot "cloud\index.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required rotation input is missing." }
  }
  foreach ($validator in @("test-employer-foundation.js", "test-employer-deployment.js", "test-security.js")) {
    & "C:\Program Files\nodejs\node.exe" (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Rotation preflight failed." }
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $active = Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM assessment_sessions WHERE state = Utf8('active') OR state = Utf8('reserved');"
  if ($active.Count -ne 1 -or [long]$active[0].row_count -ne 0) { throw "Active assessment sessions block credential rotation." }
  $accounts = Invoke-YdbJson "SELECT COUNT(*) AS row_count FROM candidate_accounts;"
  if ($accounts.Count -ne 1 -or [long]$accounts[0].row_count -ne 0) { throw "Existing candidate accounts require a separate identity migration." }
  $issuance = Invoke-YdbJson "SELECT setting_value FROM assessment_runtime_settings WHERE setting_key = Utf8('attempt_issuance_enabled') LIMIT 1;"
  if ($issuance.Count -ne 1 -or [string]$issuance[0].setting_value -notin @("true", "false")) { throw "Attempt issuance state is unavailable." }
  $issuanceBefore = [string]$issuance[0].setting_value
  Set-Issuance "false"

  $sources = [ordered]@{
    "assessment-v12" = Invoke-YcJson @("serverless", "function", "version", "get-by-tag", "--function-id", $functionId, "--tag", "assessment-v12")
    "admin-v10" = Invoke-YcJson @("serverless", "function", "version", "get-by-tag", "--function-id", $functionId, "--tag", "admin-v10")
    "account-v1" = Invoke-YcJson @("serverless", "function", "version", "get-by-tag", "--function-id", $functionId, "--tag", "account-v1")
  }
  $signingSecret = New-Secret
  $identitySecret = New-Secret
  $inviteSecret = New-Secret

  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Rotation package creation failed." }
  $script:packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $script:packageObject = "packages/security-rotation-$($script:packageSha).zip"
  $packageUri = "s3://$packageBucket/$($script:packageObject)"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Rotation package upload failed." }

  $assessmentId = Replace-TaggedVersion "assessment-v12" $sources["assessment-v12"] ([ordered]@{
    ATTEMPT_SIGNING_SECRET_V1 = $signingSecret; IDENTITY_HASH_SECRET_V1 = $identitySecret; INVITE_CODE_SECRET_V1 = $inviteSecret
  })
  $adminId = Replace-TaggedVersion "admin-v10" $sources["admin-v10"] ([ordered]@{
    IDENTITY_HASH_SECRET_V1 = $identitySecret; INVITE_CODE_SECRET_V1 = $inviteSecret
  })
  $accountId = Replace-TaggedVersion "account-v1" $sources["account-v1"] ([ordered]@{ IDENTITY_HASH_SECRET_V1 = $identitySecret })

  $groups = Invoke-YdbJson "SELECT group_id, test_id FROM assessment_invite_groups WHERE state = Utf8('issued');"
  $statements = New-Object System.Collections.Generic.List[string]
  foreach ($group in $groups) {
    $groupId = [string]$group.group_id
    $testId = [string]$group.test_id
    if ($groupId -notmatch '^grp_[a-f0-9]{32}$' -or $testId -notmatch '^[a-z0-9-]{2,40}$') { throw "Unexpected group invitation identifier." }
    $codeIdentity = Get-HmacHex $inviteSecret ("group-code-identity-v1|" + $groupId)
    $rawCode = (Get-HmacHex $inviteSecret ("invite-value-v1|" + $groupId + "|" + $testId + "|" + $codeIdentity)).Substring(0, 32).ToUpperInvariant()
    $codeHash = Get-HmacHex $inviteSecret ("invite-code-v1|SC1" + $rawCode)
    $statements.Add("UPDATE assessment_invite_groups SET code_hash = Utf8('$codeHash') WHERE group_id = Utf8('$groupId');")
  }
  if ($statements.Count -gt 0) {
    [IO.File]::WriteAllText($groupSqlPath, [string]::Join([Environment]::NewLine, $statements), [Text.UTF8Encoding]::new($false))
    Invoke-YdbFile $groupSqlPath
  }

  foreach ($item in @(@("assessment-v12", $assessmentId), @("admin-v10", $adminId), @("account-v1", $accountId))) {
    $verified = Invoke-YcJson @("serverless", "function", "version", "get-by-tag", "--function-id", $functionId, "--tag", $item[0])
    if ([string]$verified.id -ne [string]$item[1]) { throw "Rotated tag verification failed: $($item[0])" }
  }
  Set-Issuance $issuanceBefore
  $rotationSucceeded = $true
  Write-Host ("DONE: three runtime credentials rotated; active group links reissued=" + $statements.Count + "; sensitive values stayed hidden.")
} finally {
  if (-not $rotationSucceeded -and $issuanceBefore -eq "false") { Set-Issuance "false" }
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath,$groupSqlPath -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
