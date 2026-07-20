# ARCHITECTURE.md

## Общая схема

SkillCheck работает как статический сайт на GitHub Pages. GitHub Pages хранит только HTML/CSS/JS и банки вопросов, но не хранит результаты, персональные данные, токены, отчёты или JSON-базы. В текущем MVP банки всё ещё содержат правильные ответы, поэтому scoring считается клиентским и неподтверждённым.

```text
Пользователь
  -> index.html
  -> privacy.html
  -> test.html?test=<testId>
  -> data/<testId>.json
  -> Google Apps Script API
  -> Яндекс Диск REST API
```

Google Sheets и Google Drive не используются.

## Роли файлов

### `index.html`

Главная страница и карточки тестов.

### `test.html`

Основной движок тестирования:

- читает параметр `?test=`;
- выбирает тест из `TEST_CONFIG`;
- загружает JSON-банк вопросов;
- выбирает случайный набор вопросов;
- перемешивает вопросы и варианты ответа;
- пересчитывает индекс правильного ответа;
- показывает вопросы по одному;
- считает предварительный результат, штраф, плашку и Trust Score;
- требует согласие на обработку персональных данных;
- требует подтверждение 18+;
- фиксирует необязательное согласие на передачу результата работодателю;
- проверяет анти-повтор через Google Apps Script;
- отправляет результат в Google Apps Script;
- показывает пользователю случайный код результата, процент, итоговый балл, статус и предупреждение, что балл не подтверждён независимым серверным расчётом.

### `admin.html`

Обезличенная админ-панель. Она не хранит данные внутри файла и не содержит персональные данные. После ввода пароля админка запрашивает у Google Apps Script только массив из `results.json`:

```text
code
date
testId
testTitle
finalScore
percent
status
badge
tabSwitches
reportCreated
scoreVerification
```

Админка не показывает имя, email, telegram, fingerprint, внутренний путь или сырые ответы кандидата. Полный TXT можно скачать только отдельным защищённым POST-запросом после проверки админ-пароля. Таблица явно помечает текущий scoring как клиентский.

### `privacy.html`

Политика обработки персональных данных и legal-дисклеймеры MVP.

### `apps-script/Code.gs`

Google Apps Script остаётся backend/API. Он:

- читает секреты только из Script Properties;
- проверяет анти-повтор через `attempts.json`;
- проверяет строгий JSON-контракт, размеры, `testId`, версии, типы, длины и диапазоны;
- генерирует случайный код результата;
- создаёт TXT-отчёт только для успешных результатов;
- пишет полный TXT-отчёт на Яндекс Диск;
- пишет обезличенную запись в `results.json`;
- отдаёт admin.html только обезличенные данные после проверки `ADMIN_PASSWORD`;
- применяет best-effort rate limits через `CacheService`;
- отдаёт `?action=health` только как минимальный немутирующий liveness.

Backend пока не имеет закрытого answer key и не пересчитывает знания независимо: он проверяет формат и внутреннюю согласованность клиентского результата и сохраняет `scoreVerification: client-reported-unverified`. Целевая модель до пилота описана в `docs/BACKEND_SCORING_DECISION.md`.

## Script Properties

В код не вставляются реальные токены, пароли или salt. Нужны только эти Script Properties:

```text
YANDEX_DISK_TOKEN
YANDEX_DISK_REPORTS_FOLDER
YANDEX_DISK_ADMIN_FILE
YANDEX_DISK_ATTEMPTS_FILE
ATTEMPT_HASH_SALT
ADMIN_PASSWORD
```

Ожидаемые пути:

```text
YANDEX_DISK_REPORTS_FOLDER = disk:/skillcheck/reports
YANDEX_DISK_ADMIN_FILE = disk:/skillcheck/admin/results.json
YANDEX_DISK_ATTEMPTS_FILE = disk:/skillcheck/private/attempts.json
```

## Хранилище Яндекс Диска

```text
disk:/skillcheck/reports/<code>.txt
disk:/skillcheck/admin/results.json
disk:/skillcheck/private/attempts.json
```

`reports/<code>.txt` содержит полный отчёт успешного кандидата и персональные данные. Файл не публикуется и не получает публичную ссылку.

`admin/results.json` содержит только обезличенные данные для админки.

`private/attempts.json` содержит только отдельные salted hash для email и browser fingerprint, а также техническую reservation повторной отправки:

```text
SHA-256(testId + emailLower + ATTEMPT_HASH_SALT)
SHA-256(testId + browserFingerprint + ATTEMPT_HASH_SALT)
```

В `attempts.json` нельзя хранить email, имя, telegram или fingerprint в открытом виде.

## Random Engine

В `test.html` задан лимит:

```javascript
const QUESTIONS_PER_ATTEMPT = 40;
```

Правила:

1. Если в банке меньше 40 активных вопросов, берутся все.
2. Если в банке больше 40 активных вопросов, выбираются случайные 40.
3. Выбранные вопросы дополнительно перемешиваются.
4. Варианты ответа в каждом вопросе перемешиваются.
5. Правильный ответ пересчитывается по исходному индексу.
6. Вопросы с `active: false` не попадают в попытку.

## Анти-повтор

Фронт отправляет в `checkAttempt`:

```text
testId
email
browserFingerprint
```

Backend считает hash с salt из Script Properties и ищет его в `attempts.json`. Если hash уже существует для теста, повторное прохождение запрещается.

Фронт также использует `localStorage`-ключ `skillcheck_attempt_<testId>` как быстрый локальный стоппер без сохранения fingerprint, но настоящая проверка выполняется на backend. Новая полная неподтверждённая отправка хранится в `sessionStorage` текущей вкладки и удаляется после подтверждения, закрытия вкладки или TTL. При обновлении валидный неистёкший legacy envelope мигрирует из `localStorage`; invalid/oversized/expired удаляется, а при недоступном `sessionStorage` валидная копия временно остаётся в прежнем storage.

Эта схема ограничивает повтор, но не подтверждает identity: email не верифицируется, browser fingerprint — клиентское 32-bit значение. `checkAttempt` больше не выдаёт точный `nextDate`, но `allowed`/`foundPreviousAttempt` остаются email-enumeration oracle. Для controlled pilot нужны одноразовые server-issued invitations/attempts; для публичного потока — OTP/auth и anti-automation perimeter.

## Успешность

Порог успешного прохождения:

```text
SUCCESS_THRESHOLD = 80
```

Если клиентский `finalScore >= 80`, текущий backend создаёт TXT-отчёт; при результате ниже порога TXT не создаётся, но обезличенная попытка пишется в `results.json`. Это поведение является техническим MVP-контрактом, а не авторитетной проверкой результата. До пилота порог и статус должен рассчитывать backend по закрытому ключу ответов.

## Яндекс Диск API

`Code.gs` использует REST API Яндекс Диска:

- создаёт папки при необходимости;
- читает и пишет JSON-файлы;
- загружает TXT-отчёты;
- не вызывает publish/share endpoints;
- использует `LockService` при записи `results.json` и `attempts.json`.

Если `results.json` или `attempts.json` отсутствует, backend создаёт пустой массив `[]`. Если JSON повреждён, backend возвращает ошибку и не перезаписывает файл молча.

## Health Endpoint

После обновления Apps Script можно открыть:

```text
<WEB_APP_URL>?action=health
```

Ответ содержит только минимальные поля liveness: `ok`, `status`, `service`, `backendVersion`.

Endpoint не читает Script Properties или Яндекс Диск, ничего не создаёт и не раскрывает пути/состояние хранилища. Расширенная диагностика должна быть отдельной защищённой административной операцией этапа 14.

## Безопасность

Публичный API принимает только известные POST actions и ограниченный JSON-объект. Backend проверяет allowlist тестов и версий, длины/типы/диапазоны полей, максимум 40 ответов, размер body и размер TXT. GET не выполняет чувствительные операции, JSONP удалён.

У ответов обязательны уникальные порядковые номера. `questionId` пока legacy-optional: если он передан, backend проверяет формат и уникальность, но отсутствие ID не связывает ответ с вопросом банка. `saveResult` пока не требует server-issued attempt/challenge, поэтому согласованный spam может расходовать квоты. Самый дешёвый dev path закрыт: `PUBLIC_DEV_TEST_ENABLED=false`, а `checkAttempt`/`saveResult` отклоняют `dev-quick` с `test_not_public`.

`CacheService` ограничивает частоту проверки попытки, сохранения и административных операций. Эти лимиты advisory и не заменяют атомарный IP-based gateway. Candidate/admin страницы используют escaping, allowlist-санитизацию question context, CSP meta и `referrer=no-referrer`. Управляющие символы в TXT нормализуются.

Критический остаточный риск: публичные answer keys и frontend-scoring. Результаты помечаются `client-reported-unverified`; authoritative backend-scoring обязателен до пилота, а backend question delivery рекомендуется для открытого запуска.

10A должен включать закрытый answer key, mandatory `questionId`, одноразовый signed attempt/invite и gateway abuse control. Фактический scope Яндекс OAuth-токена не подтверждён и может быть шире настроенных путей: code path allowlist защищает штатные вызовы, но не blast radius украденного токена. Нужны ротация и оценка app-folder/least-privilege credential.

Не коммитить:

- `results.json`;
- `attempts.json`;
- TXT-отчёты;
- токены;
- пароли;
- salt;
- client secret;
- любые данные кандидатов.

Результаты аудита и ограничения: `docs/SECURITY_AUDIT.md`.
