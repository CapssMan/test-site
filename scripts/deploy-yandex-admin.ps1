param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$yc = Join-Path (Split-Path -Parent $repoRoot) ".tools\yc\yc.exe"
$functionId = "d4e1qffg3l40q6jgq0t9"
$gatewayId = "d5d0v6g7vmk9ku6kofjm"
$runtimeServiceAccountId = "ajesa9at6fmpd0ukbb25"
$gatewayUrl = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net"
$statusPath = Join-Path $env:TEMP "skillcheck-admin-deploy-status.json"
$packagePath = Join-Path $env:TEMP ("skillcheck-admin-" + [Guid]::NewGuid().ToString("N") + ".zip")
$passwordPointer = [IntPtr]::Zero
$confirmationPointer = [IntPtr]::Zero
$plainPassword = $null
$plainConfirmation = $null
$passwordRecord = $null
$deletionSecret = $null
$packageUri = $null
$versionId = ""

function Write-Status([string]$state, [string]$message, [string]$versionId = "") {
  $payload = [ordered]@{
    state = $state
    message = $message
    versionId = $versionId
    updatedAt = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($statusPath, $payload, [Text.UTF8Encoding]::new($false))
}

function New-RandomBytes([int]$length) {
  $bytes = New-Object byte[] $length
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return $bytes
}

function ConvertTo-Base64Url([byte[]]$bytes) {
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Invoke-JsonRequest([string]$method, [string]$url, [object]$body = $null) {
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $url -TimeoutSec 20
  }
  return Invoke-RestMethod -Method $method -Uri $url -ContentType "application/json; charset=utf-8" -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 20
}

try {
  $host.UI.RawUI.WindowTitle = "SkillCheck - защищённое развёртывание админки"
  Write-Status "waiting_for_password" "Ожидается ввод пароля в локальном окне."
  Write-Host "SkillCheck: публикация защищённой админки в Yandex Cloud" -ForegroundColor Cyan
  Write-Host "Создайте новый пароль российской админки: минимум 12 символов."
  Write-Host "Ввод скрыт; пароль не сохраняется и не выводится. Запомните его для входа после переключения сайта."
  $securePassword = Read-Host "Новый пароль" -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ([String]::IsNullOrEmpty($plainPassword) -or $plainPassword.Length -lt 12 -or $plainPassword.Length -gt 1024) {
    throw "Пароль должен содержать от 12 до 1024 символов."
  }
  $secureConfirmation = Read-Host "Повторите новый пароль" -AsSecureString
  $confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureConfirmation)
  $plainConfirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)
  if ($plainPassword -cne $plainConfirmation) { throw "Пароли не совпали. Запустите окно ещё раз." }

  Write-Status "deploying" "Проверяется конфигурация и создаётся версия функции."
  Write-Host "Пароль принят. Создаю необратимый локальный хеш и разворачиваю функцию..." -ForegroundColor Yellow

  $salt = New-RandomBytes 24
  $kdf = [Security.Cryptography.Rfc2898DeriveBytes]::new($plainPassword, $salt, 310000, [Security.Cryptography.HashAlgorithmName]::SHA256)
  try { $derived = $kdf.GetBytes(32) } finally { $kdf.Dispose() }
  $passwordRecord = [String]::Join('$', @("pbkdf2-sha256", "310000", (ConvertTo-Base64Url $salt), (ConvertTo-Base64Url $derived)))
  $deletionSecret = ConvertTo-Base64Url (New-RandomBytes 32)

  if (-not (Test-Path -LiteralPath $yc -PathType Leaf)) { throw "Yandex CLI не найден." }
  $assessmentRaw = & $yc serverless function version get-by-tag --function-id $functionId --tag assessment-v5 --format json
  if ($LASTEXITCODE -ne 0) { throw "Не удалось прочитать действующую конфигурацию assessment-v5." }
  $assessment = $assessmentRaw | ConvertFrom-Json
  $requiredNames = @("ALLOWED_ORIGIN", "YDB_CONNECTION_STRING", "PRIVATE_BUCKET", "INVITE_CODE_SECRET_V1", "IDENTITY_HASH_SECRET_V1")
  foreach ($name in $requiredNames) {
    $property = $assessment.environment.PSObject.Properties[$name]
    if ($null -eq $property -or [String]::IsNullOrWhiteSpace([string]$property.Value)) { throw "В assessment-v5 отсутствует обязательная настройка $name." }
  }

  if (Test-Path -LiteralPath $packagePath) { Remove-Item -LiteralPath $packagePath -Force }
  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  $cloudPath = Join-Path $repoRoot "cloud"
  $packageEntries = Get-ChildItem -LiteralPath $cloudPath -Force | ForEach-Object Name
  & $tar -a -c -f $packagePath -C $cloudPath @packageEntries
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $packagePath)) { throw "Не удалось упаковать функцию." }
  $archiveEntries = & $tar -tf $packagePath
  $unsafeEntries = $archiveEntries | Where-Object { $_ -match '^(\./|/|\\)' -or $_ -match '(^|/)\.\.(/|$)' -or $_ -match '\\' }
  if ($LASTEXITCODE -ne 0 -or $unsafeEntries -or $archiveEntries -notcontains "index.js") { throw "Архив функции содержит недопустимый путь." }
  $packageSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $packageBucket = [string]$assessment.environment.PRIVATE_BUCKET
  $packageKey = "packages/admin-runtime-$packageSha.zip"
  $packageUri = "s3://$packageBucket/$packageKey"
  Write-Status "deploying" "Пакет готов; загружается во временный закрытый объект."
  & $yc storage s3 cp $packagePath $packageUri --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Не удалось загрузить пакет в закрытое хранилище." }

  $environment = @(
    "ALLOWED_ORIGIN=$($assessment.environment.ALLOWED_ORIGIN)",
    "YDB_CONNECTION_STRING=$($assessment.environment.YDB_CONNECTION_STRING)",
    "PRIVATE_BUCKET=$($assessment.environment.PRIVATE_BUCKET)",
    "RUNTIME_MODE=admin",
    "ADMIN_PASSWORD_PBKDF2_V1=$passwordRecord",
    "INVITE_CODE_SECRET_V1=$($assessment.environment.INVITE_CODE_SECRET_V1)",
    "IDENTITY_HASH_SECRET_V1=$($assessment.environment.IDENTITY_HASH_SECRET_V1)",
    "DELETION_SIGNING_SECRET_V1=$deletionSecret"
  ) -join ","

  $createArgs = @(
    "serverless", "function", "version", "create",
    "--function-id", $functionId,
    "--runtime", "nodejs22",
    "--entrypoint", "index.handler",
    "--memory", "128MB",
    "--execution-timeout", "15s",
    "--service-account-id", $runtimeServiceAccountId,
    "--package-bucket-name", $packageBucket,
    "--package-object-name", $packageKey,
    "--package-sha256", $packageSha,
    "--description", "Protected administration runtime v1",
    "--environment", $environment,
    "--tags", "admin-v2",
    "--concurrency", "1",
    "--no-logging",
    "--format", "json"
  )
  Write-Status "deploying" "Пакет готов; создаётся версия функции в Yandex Cloud."
  $createdRaw = & $yc @createArgs
  if ($LASTEXITCODE -ne 0) { throw "Yandex Cloud не создал версию админки." }
  $created = $createdRaw | ConvertFrom-Json
  $versionId = [string]$created.id
  if ([String]::IsNullOrWhiteSpace($versionId)) { throw "Yandex Cloud не вернул идентификатор версии." }

  Write-Status "deploying" "Версия функции создана; подключается маршрут API."
  Write-Host "Версия создана. Подключаю маршрут /v1/admin..." -ForegroundColor Yellow
  $gatewayRaw = & $yc serverless api-gateway update --id $gatewayId --spec (Join-Path $repoRoot "cloud\api-gateway.yaml") --no-logging --format json
  if ($LASTEXITCODE -ne 0) { throw "Не удалось обновить API Gateway." }
  $null = $gatewayRaw | ConvertFrom-Json

  $adminUrl = "$gatewayUrl/v1/admin"
  $healthy = $false
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    try {
      $health = Invoke-JsonRequest "GET" $adminUrl
      if ($health.ok -eq $true) { $healthy = $true; break }
    } catch {}
    Start-Sleep -Seconds 5
  }
  if (-not $healthy) { throw "Маршрут админки не прошёл проверку доступности." }

  $denied = Invoke-JsonRequest "POST" $adminUrl ([ordered]@{ action = "adminResults"; apiVersion = "attempt-v2"; password = "definitely-wrong-password" })
  if ($denied.ok -ne $false -or [string]$denied.status -ne "error" -or [string]$denied.message -ne "Доступ запрещён.") {
    throw "Проверка отказа по неверному паролю не пройдена."
  }

  $diagnostics = Invoke-JsonRequest "POST" $adminUrl ([ordered]@{ action = "adminDiagnostics"; apiVersion = "attempt-v2"; password = $plainPassword })
  if ($diagnostics.ok -ne $true) { throw "Защищённая диагностика админки не пройдена." }

  Write-Status "complete" "Админка развёрнута и прошла проверки." $versionId
  Write-Host "ГОТОВО: российская админка развёрнута и проверена." -ForegroundColor Green
  Write-Host "Версия: $versionId"
} catch {
  $safeMessage = [string]$_.Exception.Message
  Write-Status "failed" $safeMessage
  Write-Host "ОШИБКА: $safeMessage" -ForegroundColor Red
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  if ($confirmationPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer)
  }
  $plainPassword = $null
  $plainConfirmation = $null
  $passwordRecord = $null
  $deletionSecret = $null
  if (-not [String]::IsNullOrWhiteSpace($versionId) -and -not [String]::IsNullOrWhiteSpace($packageUri)) {
    & $yc storage s3 rm $packageUri --only-show-errors | Out-Null
  }
  if (Test-Path -LiteralPath $packagePath) { Remove-Item -LiteralPath $packagePath -Force -ErrorAction SilentlyContinue }
  Write-Host "Окно можно закрыть."
}
