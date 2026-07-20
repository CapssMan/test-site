# SkillCheck — архитектура MVP

Обновлено: 21 июля 2026 года, этап 17.

## Общая схема

SkillCheck состоит из статического frontend на GitHub Pages, Google Apps Script Web App и приватного хранилища Яндекс Диска. Google Sheets и Google Drive не используются.

```text
Администратор
  -> admin.html
  -> POST adminCreateInvite / adminInvites / adminRevokeInvite / adminDeletionPreview / adminDeleteResult / adminDiagnostics
  -> Google Apps Script
  -> закрытые invites / deletion log / транзакционные и operational backups на Яндекс Диске

Кандидат
  -> test.html?test=<testId>&invite=<one-time-code>
  -> display-only data/<testId>.json
  -> POST beginAttempt
  <- signed attempt token + server-selected questionIds
  -> POST saveResult (только questionId/optionId/timing)
  -> Google Apps Script + закрытый answer key
  <- server-verified результат
  -> Яндекс Диск: псевдонимизированная строка без открытых контактов, attempt projection и при 80+ полный TXT
```

Главная граница доверия: браузер показывает вопросы и собирает ответы, но не знает правильные ответы и не рассчитывает итог как источник истины. Баллы, статус, блоки и рекомендацию вычисляет backend по закрытому versioned-банку.

## Проверка репозитория и CI

`npm test` запускает dependency-free orchestrator `scripts/run-ci.js`: secret scan, static/data links, JavaScript syntax, два валидатора банков и все `test-*.js`. Тот же entrypoint выполняется GitHub Actions на push в `main` и pull request.

CI имеет только `contents: read`, не получает Script Properties/GitHub secrets, не вызывает production Apps Script/Яндекс Диск и не выполняет deployment. Это отдельная граница: regression checks разрешено выполнять для недоверенного pull request, а owner-only storage/deploy операции остаются вне workflow.

## Frontend

### `index.html`

Главная страница показывает пять профессиональных тестов и объясняет controlled-pilot режим: пройти тест можно только по персональному одноразовому приглашению.

### `test.html`

Кандидатский frontend:

- удаляет `invite` из URL через `history.replaceState` сразу после открытия;
- загружает публичный банк schema v2 без `correct`, комментариев и иных ключей;
- сам пересчитывает canonical SHA-256 публичного банка и fail-closed сравнивает его с `publicDigest`;
- отправляет `beginAttempt` с API `attempt-v2`, одноразовым приглашением, email, техническим fingerprint, точной версией отдельного согласия и подтверждением 18+;
- принимает только подписанную сервером попытку с точной версией банка и точным порядком `questionIds`;
- сохраняет серверный порядок вопросов, а варианты `{id,text}` перемешивает криптографическим Fisher–Yates без изменения стабильных `optionId`;
- отправляет для каждого вопроса только `questionId`, `optionId|null`, `timedOut`, `timeSpent`;
- не отправляет `score`, `isCorrect`, правильные ответы, блоковые итоги или клиентское решение;
- показывает нейтральный экран расчёта и рендерит результат только при `scoreVerification: server-verified`, `scoringAlgorithmVersion: authoritative-v1`, `telemetryVerification: client-reported-unverified` и `penalty: 0`;
- повторяет временно неудавшуюся отправку с тем же token, payload и `requestId`.

В `sessionStorage` текущей вкладки временно находятся:

- begin-запрос с приглашением и email — максимум 30 минут;
- активный attempt token — до его срока, максимум 6 часов;
- неподтверждённая отправка с ответами и контактами — до срока token, максимум 6 часов.

После успешного сохранения эти записи удаляются. В `localStorage` остаётся только информационная дата завершения без PII, fingerprint, ответов, invite и token. Legacy pending payload из постоянного storage удаляется.

### `admin.html`

Админ-панель отправляет пароль только POST-запросом и хранит его только в памяти страницы. Она:

- показывает псевдонимизированные результаты без открытых контактов;
- явно различает `server-verified` и исторические `client-reported-unverified` строки;
- скачивает полный персональный TXT только отдельным защищённым POST после повторной backend-авторизации;
- создаёт email- и test-bound одноразовые приглашения на 1–720 часов;
- повторяет потерянный create-ответ с тем же `sci_...` request ID, чтобы восстановить тот же код вместо выпуска дубля;
- показывает plaintext invite только в ответе на создание и позволяет отозвать незавершённое приглашение.
- предварительно показывает состав удаления по коду и требует повторный ввод точного кода для commit;
- удаляет только результат или всю связанную попытку через подписанный snapshot, транзакционную копию, проверку отсутствия и последующий purge копии.
- показывает защищённую read-only диагностику версий, configuration presence и агрегированного состояния storage без значений secrets, paths и строк данных.

Перед заменой admin results, attempts, sessions и invites backend сохраняет предыдущую валидную версию в `private/backups-v1`, проверяет envelope/digest и ограничивает ротацию 12 snapshots на store. Restore остаётся editor-only и разрешён только при закрытых legal/issuance gate. Удаление данных очищает связанные строки и из этих snapshots.

Админ API не возвращает имя, открытый email, Telegram, fingerprint, token, ответы, hashes или внутренние пути.

## Публичные и приватные банки

Публичный schema v2:

```text
schemaVersion, testId, testVersion, bankVersion,
questionsPerAttempt, blocks, questions, publicDigest
```

Вопрос содержит только display-поля и `options: [{id,text}]`. `optionId` детерминирован:

```text
opt_ + first20hex(SHA-256(
  "skillcheck-option-v1|<testId>|<normalizedQuestionId>|<exactOptionText>"
))
```

`publicDigest` — SHA-256 от `JSON.stringify` canonical-объекта с первыми семью полями, без самого digest. Публичные варианты сортируются по opaque ID; браузер перемешивает их при попытке.

Приватный банк хранит те же display-данные плюс `correctOptionId` и служебный комментарий. Он не коммитится и читается fail-closed: отсутствующий, повреждённый, неверной версии или digest банк не создаётся автоматически во время обычного запроса.

Сервер выбирает и фиксирует точный набор вопросов. Для Credit Analyst это 40 из 80; для остальных production-банков — имеющиеся 40. `dev-quick` публично отключён.

## Backend и API

`apps-script/Code.gs` принимает versioned JSON API `attempt-v2`. `attempt-v1` получает `client_upgrade_required`.

Публичные POST actions:

- `beginAttempt` — валидирует приглашение и создаёт попытку;
- `saveResult` — проверяет signed token, persistent session, выданный набор вопросов и считает результат.

Административные POST actions после проверки `ADMIN_PASSWORD`:

- `adminResults`;
- `adminReport`;
- `adminCreateInvite`;
- `adminInvites`;
- `adminRevokeInvite`.
- `adminDeletionPreview` / `adminDeleteResult`;
- `adminDiagnostics` — read-only техническая сводка без PII/secrets.

Legacy `checkAttempt` и tokenless `saveResult` возвращают `client_upgrade_required`. Чувствительные actions через GET не выполняются. `?action=health` остаётся минимальным немутирующим liveness и не читает хранилище или Script Properties. Детальный `adminDiagnostics` доступен только через защищённый POST, выполняет read-only probe и санитизирует ошибку до allowlisted component/code/message.

### Приглашение и attempt token

Invite code имеет высокую энтропию, детерминированно восстанавливается backend для идемпотентного admin retry и в открытом виде в JSON-хранилище не записывается. Запись привязана к HMAC email, одному testId, сроку и состоянию.

Attempt token — трёхсегментная HMAC-SHA-256 подпись с фиксированными `alg`, `kid`, `typ`, `attemptId`, `jti`, версией банка, hash набора, `iat` и `exp`. Подпись сравнивается constant-time. Token сам по себе не обеспечивает single-use: источник истины — persistent session на Яндекс Диске.

Состояния:

```text
invite:  issued -> active -> completed
                       \-> revoked / expired

session: active -> reserved(requestId, submissionHash, code, aggregate result)
               -> completed
```

Под ScriptLock backend атомарно сверяет состояние и резервирует один код. Точная повторная отправка возвращает тот же код. Другой `requestId` или изменённый payload конфликтует. Active token действует 6 часов; уже зарезервированную идентичную отправку можно безопасно восстановить до 24 часов. Если admin row успела записаться до final session write, retry чинит session, legacy attempts projection и invite до ответа об успехе.

### Authoritative scoring

Backend принимает только выданные `questionId` и допустимые для них `optionId`, затем по private bank рассчитывает:

- `rawScore`, `rawTotal`, `percent`;
- `finalScore` и порог 80%;
- `unansweredCount`, `blockResults`, badge, статус и рекомендацию;
- `scoreVerification: server-verified`;
- `scoringAlgorithmVersion: authoritative-v1`.

`finalScore` равен серверному проценту знаний и не уменьшается по клиентской телеметрии. Уходы со вкладки дают только `advisoryPenalty`/Trust Score и маркируются `client-reported-unverified`; обязательное поле `penalty` authoritative-результата равно нулю.

## Script Properties

Значения никогда не коммитятся и не выводятся публично:

```text
YANDEX_DISK_TOKEN
YANDEX_DISK_REPORTS_FOLDER
YANDEX_DISK_ADMIN_FILE
YANDEX_DISK_ATTEMPTS_FILE
ATTEMPT_HASH_SALT
ADMIN_PASSWORD
ATTEMPT_SIGNING_SECRET_V1
INVITE_CODE_SECRET_V1
IDENTITY_HASH_SECRET_V1
ATTEMPT_ISSUANCE_ENABLED
LEGAL_PILOT_APPROVED
```

Опционально пути новых файлов можно переопределить `YANDEX_DISK_INVITES_FILE`, `YANDEX_DISK_ATTEMPT_SESSIONS_FILE`, `YANDEX_DISK_PRIVATE_BANKS_FOLDER`. Все пути проходят allowlist `disk:/skillcheck/...`.

## Яндекс Диск

```text
disk:/skillcheck/reports/<CODE>.txt
disk:/skillcheck/admin/results.json
disk:/skillcheck/private/attempts.json
disk:/skillcheck/private/invites-v1.json
disk:/skillcheck/private/attempt-sessions-v1.json
disk:/skillcheck/private/banks/<testId>/<version-slug>.json
disk:/skillcheck/private/backups-v1/<storeKey>/bkp_<timestamp>_<id>.json
disk:/skillcheck/private/backups-v1/corrupt/<storeKey>/corrupt_<timestamp>_<id>.json
```

- `reports` — полный TXT только для результата 80+, включая PII и детализацию ответов;
- `admin/results.json` — псевдонимизированные агрегаты без открытых контактов и служебные idempotency hashes;
- `attempts.json` — совместимая completed-проекция retake/recovery;
- `invites-v1.json` — состояния приглашений и HMAC/hash-идентификаторы без открытого кода/token;
- `attempt-sessions-v1.json` — server-selected manifest, состояния, hashes и агрегат результата без raw PII/fingerprint/token/ответов;
- `private/banks` — immutable закрытые ключи.
- `private/backups-v1` — bounded snapshots operational stores; содержит те же категории закрытых данных и не является публичным.

JSON write защищён `LockService`; повреждённый файл не перезаписывается автоматически. Перед заменой создаётся и проверяется предыдущая версия, active-файл проверяется после загрузки. TXT и JSON загружаются через REST API Яндекс Диска, publish/share endpoints не используются.

## Ограничения и pilot gate

Новая архитектура закрывает подделку итоговых клиентских полей и убирает ключи из текущего публичного HEAD. `LEGAL_PILOT_APPROVED` независимо блокирует включение issuance, выпуск приглашения и начало попытки до реквизитов оператора и внешнего legal checklist. Однако ответы старых версий уже были опубликованы в Git history и могли попасть в клоны/кэши. Удаление полей из текущего файла или переписывание истории не отзывает уже полученные копии. Для реального пилота нужны оба осознанно открытых gate: завершённые legal/retention требования и отдельно согласованная ротация содержания/ключей банков.

Остаточные риски:

- browser timing/tab signals не подтверждены и не являются identity proof;
- одноразовое email-bound приглашение — controlled-pilot perimeter, не OTP/account;
- `CacheService` rate limits best-effort и не заменяют внешний атомарный gateway для открытого запуска;
- scope текущего Яндекс OAuth-токена может быть шире `disk:/skillcheck`; нужны ротация и проверка least-privilege/app-folder модели;
- наблюдаемость этапа 14 является pull-based status без внешнего alerting/paging; backup остаётся в том же failure-domain Яндекс Диска и не заменяет off-site DR.

Не коммитить результаты, private banks, TXT, candidate data, токены, пароли, salt, OAuth credentials или временные bootstrap secrets.
