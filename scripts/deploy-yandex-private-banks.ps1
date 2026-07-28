param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$privateDir = Join-Path $workspaceRoot "skillcheck-private-v4-r3"
$sourceDir = Join-Path $workspaceRoot "skillcheck-rotation-source"
$publicDir = Join-Path $repoRoot "data"
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$ydb = Join-Path $workspaceRoot ".tools\ydb\ydb.exe"
$node = "C:\Program Files\nodejs\node.exe"
$bucket = "assessment-b1gafbjd3dlh-private"
$endpoint = "grpcs://ydb.serverless.yandexcloud.net:2135"
$database = "/ru-central1/b1gq51n9hpjh7u3arun3/etnkl7r9gkk0in6fitmv"
$expectedTests = [ordered]@{
  "fa-junior" = "FA Junior v4.0"
  "ca-junior" = "CA Junior v4.0"
  "fpa-junior" = "FP&A Junior v4.0"
  "acc-junior" = "ACC Junior v4.0"
  "bi-junior" = "BI Junior v4.0"
}
$stagingUris = New-Object System.Collections.Generic.List[string]
$createdFinalUris = New-Object System.Collections.Generic.List[string]
$temporaryFiles = New-Object System.Collections.Generic.List[string]
$metadataCommitted = $false

function Invoke-YcJson([string[]]$arguments) {
  $raw = & $yc @arguments --format json
  if ($LASTEXITCODE -ne 0) { throw "Yandex CLI command failed." }
  return $raw | ConvertFrom-Json
}

function Invoke-YdbJson([string]$query) {
  $queryFile = Join-Path ([IO.Path]::GetTempPath()) ("skillcheck-ydb-query-" + [Guid]::NewGuid().ToString("N") + ".sql")
  try {
    [IO.File]::WriteAllText($queryFile, $query, [Text.UTF8Encoding]::new($false))
    $raw = & $ydb -e $endpoint -d $database sql -f $queryFile --format json-unicode-array
    if ($LASTEXITCODE -ne 0) { throw "YDB query failed." }
    if ([String]::IsNullOrWhiteSpace(($raw -join ""))) { return $null }
    $parsed = $raw | ConvertFrom-Json
    if ($parsed -is [System.Array]) {
      foreach ($item in $parsed) { Write-Output $item }
      return
    }
    return $parsed
  } finally {
    Remove-Item -LiteralPath $queryFile -Force -ErrorAction SilentlyContinue
  }
}

function Escape-YqlUtf8([string]$value) {
  if ($value -notmatch '^[A-Za-z0-9 &+./_-]{1,120}$') { throw "Unsafe metadata value." }
  return $value.Replace('\\', '\\\\').Replace('"', '\\"')
}

function Assert-GatesClosed([object[]]$rows) {
  $settings = @{}
  foreach ($row in @($rows)) { $settings[[string]$row.setting_key] = [string]$row.setting_value }
  if ($settings.legal_pilot_approved -ne "false" -or $settings.attempt_issuance_enabled -ne "false" -or
      $settings.retention_automation_enabled -ne "true") {
    throw "Runtime gates differ from the approved fail-closed state."
  }
}

function Find-Object([string]$key) {
  $listing = Invoke-YcJson @("storage", "s3api", "list-objects", "--bucket", $bucket, "--prefix", $key, "--max-keys", "5")
  if ($null -eq $listing -or $null -eq $listing.PSObject.Properties["contents"]) { return $null }
  return @($listing.contents) | Where-Object { $null -ne $_ -and [string]$_.key -eq $key } | Select-Object -First 1
}

function Download-And-Verify([string]$uri, [string]$expectedSha, [long]$expectedBytes, [string]$label) {
  $target = Join-Path $env:TEMP ("skillcheck-bank-verify-" + [Guid]::NewGuid().ToString("N") + ".json")
  $temporaryFiles.Add($target)
  & $yc storage s3 cp $uri $target --only-show-errors
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "$label download failed." }
  $item = Get-Item -LiteralPath $target
  $actualSha = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($item.Length -ne $expectedBytes -or $actualSha -ne $expectedSha) { throw "$label checksum mismatch." }
}

try {
  foreach ($requiredPath in @($privateDir, $sourceDir, $publicDir, $yc, $ydb, $node)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required local deployment input is missing." }
  }

  $verifyScript = Join-Path $PSScriptRoot "verify-rotated-artifacts.js"
  & $node $verifyScript --source-dir $sourceDir --private-dir $privateDir --public-dir $publicDir
  if ($LASTEXITCODE -ne 0) { throw "Private-bank deterministic verification failed." }

  $bucketInfo = Invoke-YcJson @("storage", "bucket", "get", $bucket)
  if ([string]$bucketInfo.name -ne $bucket -or [long]$bucketInfo.max_size -ne 1073741824 -or
      $bucketInfo.anonymous_access_flags.read -eq $true -or $bucketInfo.anonymous_access_flags.list -eq $true -or
      $bucketInfo.disabled_statickey_auth -ne $true) {
    throw "Private bucket boundary is not fail-closed."
  }

  $env:YDB_TOKEN = & $yc iam create-token
  if ($LASTEXITCODE -ne 0 -or [String]::IsNullOrWhiteSpace($env:YDB_TOKEN)) { throw "Temporary YDB token was not created." }
  $gatesQuery = "SELECT setting_key, setting_value FROM assessment_runtime_settings ORDER BY setting_key;"
  Assert-GatesClosed (Invoke-YdbJson $gatesQuery)

  $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $privateDir "rotation-manifest.json") | ConvertFrom-Json
  $pending = Get-Content -Raw -Encoding UTF8 (Join-Path $privateDir "private-bank-rotation-pending.v4.json") | ConvertFrom-Json
  if ([string]$pending.rotationId -ne "rotation-v4-2026-07-21-r3" -or @($manifest.banks).Count -ne $expectedTests.Count) {
    throw "Unexpected private-bank release manifest."
  }

  $metadata = New-Object System.Collections.Generic.List[object]
  foreach ($testId in $expectedTests.Keys) {
    $version = [string]$expectedTests[$testId]
    $manifestEntry = @($manifest.banks) | Where-Object { [string]$_.testId -eq $testId } | Select-Object -First 1
    $pendingEntry = $pending.banks.PSObject.Properties[$testId].Value
    $files = @(Get-ChildItem -LiteralPath (Join-Path $privateDir $testId) -Filter "*.json" -File)
    if ($null -eq $manifestEntry -or $null -eq $pendingEntry -or $files.Count -ne 1 -or
        [string]$manifestEntry.version -ne $version -or [string]$pendingEntry.bankVersion -ne $version) {
      throw "$testId private-bank manifest mismatch."
    }
    $file = $files[0]
    $fileSha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $expectedFileSha = [string]$manifestEntry.privateFileSha256
    $expectedBytes = [long]$manifestEntry.privateFileBytes
    $privateDigest = [string]$pendingEntry.privateDigest
    $publicDigest = [string]$pendingEntry.publicDigest
    if ($fileSha -ne $expectedFileSha -or $file.Length -ne $expectedBytes -or
        $privateDigest -notmatch '^[a-f0-9]{64}$' -or $publicDigest -notmatch '^[a-f0-9]{64}$') {
      throw "$testId local private-bank checksum mismatch."
    }

    $finalKey = "banks/v4/$testId.json"
    $finalUri = "s3://$bucket/$finalKey"
    $existing = Find-Object $finalKey
    if ($null -ne $existing) {
      Download-And-Verify $finalUri $expectedFileSha $expectedBytes "$testId existing object"
    } else {
      $stageKey = "bank-staging/$($pending.rotationId)/$testId-$expectedFileSha.json"
      $stageUri = "s3://$bucket/$stageKey"
      $stagingUris.Add($stageUri)
      & $yc storage s3 cp $file.FullName $stageUri --only-show-errors
      if ($LASTEXITCODE -ne 0) { throw "$testId staging upload failed." }
      Download-And-Verify $stageUri $expectedFileSha $expectedBytes "$testId staging object"
      & $yc storage s3 cp $stageUri $finalUri --only-show-errors
      if ($LASTEXITCODE -ne 0) { throw "$testId final promotion failed." }
      $createdFinalUris.Add($finalUri)
      Download-And-Verify $finalUri $expectedFileSha $expectedBytes "$testId final object"
    }
    $metadata.Add([pscustomobject]@{
      TestId = $testId
      Version = $version
      ObjectKey = $finalKey
      PrivateDigest = $privateDigest
      PublicDigest = $publicDigest
    })
    Write-Host "$testId verified in private Object Storage."
  }

  $values = $metadata | ForEach-Object {
    '(Utf8("' + (Escape-YqlUtf8 $_.TestId) + '"), Utf8("' + (Escape-YqlUtf8 $_.Version) +
      '"), Utf8("' + (Escape-YqlUtf8 $_.ObjectKey) + '"), Utf8("' + $_.PrivateDigest +
      '"), Utf8("' + $_.PublicDigest + '"), true, CurrentUtcTimestamp())'
  }
  $upsert = "UPSERT INTO assessment_banks (test_id, bank_version, object_key, private_digest, public_digest, active, updated_at) VALUES`n" +
    ($values -join ",`n") + ";"
  $null = Invoke-YdbJson $upsert
  $metadataCommitted = $true

  $stored = @(Invoke-YdbJson "SELECT test_id, bank_version, object_key, private_digest, public_digest, active FROM assessment_banks ORDER BY test_id;")
  if ($stored.Count -ne $metadata.Count) { throw "YDB bank metadata count mismatch." }
  foreach ($expected in $metadata) {
    $actual = $stored | Where-Object { [string]$_.test_id -eq $expected.TestId } | Select-Object -First 1
    if ($null -eq $actual -or [string]$actual.bank_version -ne $expected.Version -or
        [string]$actual.object_key -ne $expected.ObjectKey -or [string]$actual.private_digest -ne $expected.PrivateDigest -or
        [string]$actual.public_digest -ne $expected.PublicDigest -or $actual.active -ne $true) {
      throw "$($expected.TestId) YDB bank metadata verification failed."
    }
  }
  Assert-GatesClosed (Invoke-YdbJson $gatesQuery)
  Write-Host "DONE: five private banks and YDB metadata are verified; pilot gates remain closed."
} catch {
  if (-not $metadataCommitted) {
    foreach ($uri in $createdFinalUris) { & $yc storage s3 rm $uri --only-show-errors | Out-Null }
  }
  throw
} finally {
  foreach ($uri in $stagingUris) { & $yc storage s3 rm $uri --only-show-errors | Out-Null }
  foreach ($path in $temporaryFiles) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:\YDB_TOKEN -ErrorAction SilentlyContinue
}
