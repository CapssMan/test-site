# PROJECT_STRUCTURE.md

## Текущая безопасная структура

Эта структура сохраняет рабочий GitHub Pages сайт и не ломает текущий дизайн.

```text
skillcheck/
├── index.html
├── test.html
├── privacy.html
├── admin.html
├── data/
│   ├── fa-junior.json
│   ├── ca-junior.json
│   ├── fpa-junior.json
│   ├── acc-junior.json
│   ├── bi-junior.json
│   └── dev-quick.json
├── apps-script/
│   └── Code.gs
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   ├── QA_REVIEW.md
│   ├── QUESTION_BANK_AUDIT.md
│   ├── SECURITY_AUDIT.md
│   ├── BACKEND_SCORING_DECISION.md
│   └── REMAINING_ESTIMATE.md
├── scripts/
│   ├── validate-tests.js
│   ├── migrate-public-banks-10a.js
│   ├── test-public-bank-secrecy.js
│   ├── test-attempt-tokens.js
│   ├── test-backend-scoring.js
│   └── test-10a-recovery.js
├── README.md
├── PROJECT_CONTEXT.md
├── TODO.md
└── ARCHITECTURE.md
```

## Что где хранить

### Корень проекта

В корне остаются HTML-файлы, потому что GitHub Pages проще всего отдаёт сайт именно так.

- `index.html` — главная страница.
- `test.html` — страница прохождения теста.
- `privacy.html` — политика обработки персональных данных и описание технического идентификатора браузера.
- `admin.html` — обезличенная админ-панель по кодам, без персональных данных.

### `data/`

Папка с public display-only банками schema v2.

Правило: один тест = один JSON-файл.

Public JSON содержит текст, display-метаданные, opaque option IDs и `publicDigest`, но не `correct` и не комментарий к правильному ответу. Нельзя держать private answer key в HTML, `data/`, Git или GitHub Pages.

Текущие рабочие банки:

- `fa-junior.json` — Financial Analyst Junior.
- `ca-junior.json` — Credit Analyst Junior.
- `fpa-junior.json` — FP&A / Budget Analyst Junior.
- `acc-junior.json` — Accounting / Reporting Junior.
- `bi-junior.json` — Finance BI / Data Analyst Junior.
- `dev-quick.json` — закрытый smoke-банк; публичная выдача attempt отключена.

Тексты/варианты текущей миграцией 10A не изменялись. Старые answer keys остаются в Git history, клонах и кэшах, поэтому реальные приглашения заблокированы до отдельно согласованной содержательной ротации.

### `apps-script/`

Папка с кодом Google Apps Script. Этот файл не запускается на GitHub Pages сам по себе; production обновляется через `clasp` в существующий deployment без смены Web App URL.

Backend больше не использует Google Sheets и Google Drive. Все результаты пишутся через Яндекс.Диск REST API:

- `disk:/skillcheck/reports/<code>.txt` — полные отчёты успешных результатов;
- `disk:/skillcheck/admin/results.json` — обезличенная база для `admin.html`;
- `disk:/skillcheck/private/attempts.json` — legacy-compatible projection hash попыток;
- `disk:/skillcheck/private/invites-v1.json` — hash/состояния одноразовых приглашений;
- `disk:/skillcheck/private/attempt-sessions-v1.json` — active/reserved/completed attempt state и recovery;
- `disk:/skillcheck/private/banks/<test>/<version>.json` — закрытые versioned-банки с answer key.

`Code.gs` отдаёт минимальный немутирующий `?action=health`. Публичный POST-контракт `attempt-v1` состоит из `beginAttempt` и token-bound `saveResult`; legacy `checkAttempt` удалён. Admin POST после проверки `ADMIN_PASSWORD` загружает результаты/отчёты и управляет приглашениями.

Ссылка приглашения передаёт bearer только во fragment `#invite=...`, не в query. `test.html` сразу забирает значение в `sessionStorage` и очищает адресную строку; это уменьшает утечки через обычную query-историю/Referer, но код всё равно нужно считать секретом до использования.

Private banks дополнительно связаны с SHA-256 anchors в Script Properties. Signed token использует отдельный `ATTEMPT_SIGNING_SECRET_V1`; invite/identity hashes — отдельные секреты. `ATTEMPT_ISSUANCE_ENABLED=false` является production gate до ротации банков.

Owner-bootstrap воспроизводит private banks только из полного Git commit `70e569cf267e043aabc780e81cc4307db7e149b1` и проверяет точные SHA-256 legacy-файлов. Backend также проверяет metadata private paths: наличие `public_key`, `public_url` или `share` останавливает bootstrap/issuance/invite/begin/save. Publish/share endpoints в архитектуре не используются.

### `docs/`

Дополнительная документация, которую удобно читать в Codex/Cursor/VS Code.

- `PROJECT_STRUCTURE.md` — структура проекта.
- `QA_REVIEW.md` — первичный QA-аудит банков вопросов без изменения JSON.
- `QUESTION_BANK_AUDIT.md` — технический/содержательный аудит и gate ротации.
- `SECURITY_AUDIT.md` — baseline этапа 10 и addendum 10A.
- `BACKEND_SCORING_DECISION.md` — реализованный trust/API/storage contract.
- `REMAINING_ESTIMATE.md` — часы, токены и режимы оставшейся работы.

### `scripts/`

Локальные вспомогательные проверки.

- `validate-tests.js` и `audit-question-banks.js` — проверяют public schema, размеры, IDs, digest и согласованность display-банков.
- `migrate-public-banks-10a.js` — воспроизводит структурную public/private миграцию без содержательных правок.
- `test-public-bank-secrecy.js` — проверяет отсутствие answer key и self-consistent digest.
- `test-attempt-tokens.js` — проверяет подпись, claims, expiry и подмену токена.
- `test-backend-scoring.js` — проверяет серверный расчёт и недоверие к клиентской арифметике.
- `test-10a-recovery.js` — проверяет single-use state, exact replay и recovery после частичного commit.

## Почему пока не выносить CSS и JS

Сейчас дизайн уже работает. Если сразу разнести всё на `assets/css`, `assets/js`, можно случайно сломать сайт и деплой. Поэтому на текущем этапе лучше:

1. оставить рабочие HTML как есть;
2. вынести только документацию и Apps Script;
3. после стабилизации 5 тестов аккуратно провести рефакторинг.

## Будущая структура после рефакторинга

Когда MVP станет стабильным, можно перейти к такой структуре:

```text
skillcheck/
├── index.html
├── test.html
├── privacy.html
├── admin.html
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── test.css
│   │   └── admin.css
│   └── js/
│       ├── app.js
│       ├── test-engine.js
│       ├── attempt-client.js
│       ├── anti-cheat.js
│       └── reports.js
├── data/
│   ├── fa-junior.json
│   ├── ca-junior.json
│   ├── fpa-junior.json
│   ├── acc-junior.json
│   └── bi-junior.json
├── apps-script/
│   └── Code.gs
└── docs/
```

Но это лучше делать позже, когда тесты уже готовы.
