# ARCHITECTURE.md

## Общая схема

SkillCheck работает как статический сайт на GitHub Pages. GitHub Pages хранит только HTML/CSS/JS и банки вопросов, но не хранит результаты, персональные данные, токены, отчёты или JSON-базы.

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
- считает результат, штраф, плашку и Trust Score;
- требует согласие на обработку персональных данных;
- требует подтверждение 18+;
- фиксирует необязательное согласие на передачу результата работодателю;
- проверяет анти-повтор через Google Apps Script;
- отправляет результат в Google Apps Script;
- показывает пользователю случайный код результата, процент, итоговый балл и статус.

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
reportPath/reportCode
```

Админка не показывает имя, email, telegram, fingerprint или сырые ответы кандидата. Вместо персональной ссылки она показывает только технический путь/код отчёта для ручной проверки на закрытом Яндекс Диске.

### `privacy.html`

Политика обработки персональных данных и legal-дисклеймеры MVP.

### `apps-script/Code.gs`

Google Apps Script остаётся backend/API. Он:

- читает секреты только из Script Properties;
- проверяет анти-повтор через `attempts.json`;
- генерирует случайный код результата;
- создаёт TXT-отчёт только для успешных результатов;
- пишет полный TXT-отчёт на Яндекс Диск;
- пишет обезличенную запись в `results.json`;
- отдаёт admin.html только обезличенные данные после проверки `ADMIN_PASSWORD`;
- отдаёт `?action=health` для диагностики Script Properties, доступа к Яндекс Диску и наличия JSON-файлов.

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

`private/attempts.json` содержит только hash попытки:

```text
SHA-256(testId + emailLower + browserFingerprint + ATTEMPT_HASH_SALT)
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

Фронт также использует localStorage-ключ `skillcheck_attempt_<testId>` как быстрый локальный стоппер, но настоящая проверка выполняется на backend.

## Успешность

Порог успешного прохождения:

```text
SUCCESS_THRESHOLD = 80
```

Если `finalScore >= 80`, статус `passed` и backend создаёт TXT-отчёт. Если `finalScore < 80`, статус `failed`, TXT-отчёт не создаётся, но обезличенная попытка всё равно пишется в `results.json`.

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

Ответ содержит `ok`, `backendVersion`, флаги наличия Script Properties, `yandexDiskAccess`, HTTP-код Яндекс Диска, пути `reportsFolder/adminFile/attemptsFile` и признаки `adminFileExists/attemptsFileExists`.

Endpoint не выводит `YANDEX_DISK_TOKEN`, `ADMIN_PASSWORD` или `ATTEMPT_HASH_SALT`.

## Безопасность

Не коммитить:

- `results.json`;
- `attempts.json`;
- TXT-отчёты;
- токены;
- пароли;
- salt;
- client secret;
- любые данные кандидатов.
