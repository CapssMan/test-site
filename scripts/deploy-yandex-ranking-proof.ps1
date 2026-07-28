param(
  [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$yc = Join-Path $workspaceRoot ".tools\yc\yc.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$packageBucket = "assessment-b1gafbjd3dlh-private"
$gatewaySpec = Join-Path $repoRoot "cloud\api-gateway.yaml"
$assessmentUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/assessment"
$profileUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/ranking/profile"
$packagePath = Join-Path $env:TEMP ("skillcheck-ranking-proof-" + [Guid]::NewGuid().ToString("N") + ".zip")
$packageUri = ""
$releases = @(
  @{ SourceTag = "assessment-v3"; TargetTag = "assessment-v4"; ExpectedMode = "assessment" },
  @{ SourceTag = "write-v3"; TargetTag = "write-v4"; ExpectedMode = "write" }
)

function Get-Version([string]$tag) {
  $raw = & $yc serverless function version get-by-tag --function-id $functionId --tag $tag --format json
  if ($LASTEXITCODE -ne 0) { throw "Required source runtime version is unavailable." }
  return $raw | ConvertFrom-Json
}

function Build-Environment([object]$source, [string]$expectedMode) {
  $pairs = New-Object System.Collections.Generic.List[string]
  foreach ($property in $source.environment.PSObject.Properties) {
    if ($property.Name -eq "RESULT_AUTHORITY_URL") { continue }
    if ([string]$property.Value -match "[,`r`n]") { throw "Runtime environment value cannot be safely forwarded by CLI." }
    $pairs.Add($property.Name + "=" + [string]$property.Value)
  }
  if ([string]$source.environment.RUNTIME_MODE -ne $expectedMode) { throw "Runtime mode/tag mismatch." }
  if ($expectedMode -eq "write") { $pairs.Add("RESULT_AUTHORITY_URL=" + $assessmentUrl) }
  return [string]::Join(",", $pairs)
}

try {
  foreach ($path in @($yc, $gatewaySpec, (Join-Path $repoRoot "cloud\assessment-handler.js"), (Join-Path $repoRoot "cloud\ranking-profile-handler.js"))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required ranking-proof deployment input is missing." }
  }
  foreach ($validator in @("test-assessment-handler.js", "test-ranking-profile.js", "test-yandex-cors-origins.js")) {
    & node (Join-Path $PSScriptRoot $validator)
    if ($LASTEXITCODE -ne 0) { throw "Ranking-proof deployment validator failed." }
  }

  if (-not $VerifyOnly) {
  $sourceVersions = @{}
  foreach ($item in $releases) { $sourceVersions[$item.SourceTag] = Get-Version $item.SourceTag }
  $cloudPath = Join-Path $repoRoot "cloud"
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $entries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @entries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw "Runtime package creation failed." }
  $archiveEntries = & $tar -tf $packagePath
  if ($LASTEXITCODE -ne 0 -or $archiveEntries -notcontains "assessment-handler.js" -or
      $archiveEntries -notcontains "ranking-profile-handler.js" -or
      ($archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' })) {
    throw "Runtime package boundary is invalid."
  }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageObject = "packages/ranking-proof-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageObject"
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Runtime package upload failed." }

  foreach ($item in $releases) {
    $source = $sourceVersions[$item.SourceTag]
    $environment = Build-Environment $source $item.ExpectedMode
    $timeoutSeconds = [int]([string]$source.execution_timeout -replace "s$", "")
    $memoryMb = [int]([long]$source.resources.memory / 1MB)
    $createdRaw = & $yc serverless function version create --function-id $functionId --runtime ([string]$source.runtime) `
      --entrypoint ([string]$source.entrypoint) --memory ($memoryMb.ToString() + "MB") `
      --execution-timeout ($timeoutSeconds.ToString() + "s") --service-account-id ([string]$source.service_account_id) `
      --package-bucket-name $packageBucket --package-object-name $packageObject --package-sha256 $packageSha `
      --description ("Russian YDB ranking-proof successor of " + $item.SourceTag) --environment $environment `
      --tags $item.TargetTag --concurrency ([int]$source.concurrency) --no-logging --format json
    if ($LASTEXITCODE -ne 0) { throw "Ranking-proof runtime successor creation failed." }
    $created = $createdRaw | ConvertFrom-Json
    if ([String]::IsNullOrWhiteSpace([string]$created.id)) { throw "Ranking-proof runtime successor id is missing." }
    Write-Host ($item.TargetTag + " ready: " + [string]$created.id)
  }

  $null = & $yc serverless api-gateway update --id $gatewayId --spec $gatewaySpec --no-logging --format json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "API Gateway ranking-proof cutover failed." }
  }

  $dummyToken = ("a" * 40) + "." + ("b" * 80) + "." + ("c" * 43)
  $proofBody = [ordered]@{
    action = "rankingProof"; apiVersion = "ranking-proof-v1"; attemptId = "att_" + "a" * 32;
    attemptToken = $dummyToken; resultCode = "FA-ABCDE"
  }
  $proof = Invoke-RestMethod -Method POST -Uri $assessmentUrl -ContentType "application/json; charset=utf-8" `
    -Body ($proofBody | ConvertTo-Json -Compress) -TimeoutSec 30
  if ($proof.ok -ne $false -or [string]$proof.failureCode -ne "ranking_proof_unavailable") {
    throw "Invalid YDB ranking proof did not fail closed."
  }
  $publishBody = [ordered]@{
    action = "publish"; apiVersion = "ranking-profile-v1"; publicAlias = "Technical Check";
    publicConsent = $true; publicConsentVersion = "skillcheck-ranking-public-2026-07-26-v1";
    resultProof = [ordered]@{ attemptId = "att_" + "a" * 32; attemptToken = $dummyToken; resultCode = "FA-ABCDE" }
  }
  $publishJson = $publishBody | ConvertTo-Json -Compress -Depth 4
  $publishBytes = [Text.Encoding]::UTF8.GetBytes($publishJson)
  $publishRequest = [Net.HttpWebRequest]::Create($profileUrl)
  $publishRequest.Method = "POST"
  $publishRequest.ContentType = "application/json; charset=utf-8"
  $publishRequest.ContentLength = $publishBytes.Length
  $publishRequest.Timeout = 30000
  $requestStream = $publishRequest.GetRequestStream()
  try { $requestStream.Write($publishBytes, 0, $publishBytes.Length) } finally { $requestStream.Dispose() }
  try { $publishResponse = $publishRequest.GetResponse() } catch [Net.WebException] { $publishResponse = $_.Exception.Response }
  if ($null -eq $publishResponse) { throw "Invalid profile publication returned no response." }
  try {
    $publishStatus = [int]$publishResponse.StatusCode
    $reader = [IO.StreamReader]::new($publishResponse.GetResponseStream(), [Text.Encoding]::UTF8)
    try { $publishResult = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  } finally { $publishResponse.Dispose() }
  if ($publishStatus -ne 403 -or [string]$publishResult.error -ne "result_proof_rejected") {
    throw "Invalid profile publication did not fail closed."
  }
  Write-Host "DONE: ranking proof is served by assessment-v4 from YDB; write-v4 rejects fabricated publication."
} finally {
  if (-not [String]::IsNullOrWhiteSpace($packageUri)) { & $yc storage s3 rm $packageUri --only-show-errors | Out-Null }
  Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue
}
