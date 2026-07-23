# PROJECT_STRUCTURE.md

## Текущая безопасная структура

Эта структура сохраняет рабочий GitHub Pages сайт и не ломает текущий дизайн.

```text
skillcheck/
├── .github/
│   └── workflows/
│       └── ci.yml
├── index.html
├── test.html
├── privacy.html
├── consent.html
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
│   ├── LEGAL_PRIVACY_REVIEW.md
│   ├── DATA_DELETION.md
│   ├── BACKUP_AND_RECOVERY.md
│   ├── OBSERVABILITY.md
│   ├── TESTING.md
│   └── REMAINING_ESTIMATE.md
├── scripts/
│   ├── run-ci.js
│   ├── check-repository-secrets.js
│   ├── check-static-links.js
│   ├── check-js-syntax.js
│   ├── validate-tests.js
│   ├── migrate-public-banks-10a.js
│   ├── test-public-bank-secrecy.js
│   ├── test-attempt-tokens.js
│   ├── test-backend-scoring.js
│   ├── test-10a-recovery.js
│   ├── test-legal-privacy.js
│   ├── test-data-deletion.js
│   ├── test-backup-recovery.js
│   ├── test-observability.js
│   └── test-ci-config.js
├── package.json
├── package-lock.json
├── README.md
├── PROJECT_CONTEXT.md
├── TODO.md
└── ARCHITECTURE.md
```

## Что где хранить

### `.github/` и CI

`.github/workflows/ci.yml` — read-only GitHub Actions workflow без secrets и deployment. `package.json`/`package-lock.json` задают единый dependency-free `npm test`; подробный контракт находится в `docs/TESTING.md`.

### Корень проекта

В корне остаются HTML-файлы, потому что GitHub Pages проще всего отдаёт сайт именно так.

- `index.html` — главная страница.
- `test.html` — страница прохождения теста.
- `privacy.html` — политика обработки персональных данных и описание технического идентификатора браузера.
- `consent.html` — отдельное versioned-согласие с явными prelaunch-заглушками оператора.
- `admin.html` — псевдонимизированная админ-панель по кодам без открытых контактов.

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

Production-файлы переведены на банки v4: 240 новых вопросов, вариантов, ключей и ID. Старые v3 answer keys остаются в Git history/клонах/кэшах, но не соответствуют новому содержанию. Реальные приглашения заблокированы до независимого SME sign-off и остальных внешних условий readiness checklist.

### `apps-script/`

Папка с кодом Google Apps Script. Этот файл не запускается на GitHub Pages сам по себе; production обновляется через `clasp` в существующий deployment без смены Web App URL.

Backend больше не использует Google Sheets и Google Drive. Все результаты пишутся через Яндекс.Диск REST API:

- `disk:/skillcheck/reports/<code>.txt` — полные отчёты успешных результатов;
- `disk:/skillcheck/admin/results.json` — псевдонимизированная база без открытых контактов для `admin.html`;
- `disk:/skillcheck/private/attempts.json` — legacy-compatible projection hash попыток;
- `disk:/skillcheck/private/invites-v1.json` — hash/состояния одноразовых приглашений;
- `disk:/skillcheck/private/attempt-sessions-v1.json` — active/reserved/completed attempt state и recovery;
- `disk:/skillcheck/private/banks/<test>/<version>.json` — закрытые versioned-банки с answer key.
- `disk:/skillcheck/private/backups-v1/<store-key>/...` — до 12 проверяемых snapshots каждого operational store.
- `disk:/skillcheck/private/backups-v1/corrupt/<store-key>/...` — до трёх forensic artifacts повреждённого active-файла.

`Code.gs` отдаёт минимальный немутирующий `?action=health`. Публичный POST-контракт `attempt-v2` состоит из `beginAttempt` и token-bound `saveResult`; он требует точную versioned consent binding, а `attempt-v1` и legacy `checkAttempt` отключены. Admin POST после проверки `ADMIN_PASSWORD` загружает результаты/отчёты, управляет приглашениями и отдаёт read-only `adminDiagnostics` без secret/PII/path values.

`docs/OBSERVABILITY.md` описывает защищённый status contract и operator runbook. `scripts/test-observability.js` проверяет auth boundary, агрегаты, санитизированные ошибки и сохранение минимального публичного health. `scripts/run-ci.js` объединяет infrastructure validators и все regression tests; `scripts/test-ci-config.js` защищает read-only workflow contract.

Ссылка приглашения передаёт bearer только во fragment `#invite=...`, не в query. `test.html` сразу забирает значение в `sessionStorage` и очищает адресную строку; это уменьшает утечки через обычную query-историю/Referer, но код всё равно нужно считать секретом до использования.

Private banks дополнительно связаны с SHA-256 anchors в Script Properties. Выпуск v4 использует pending rotation manifest и атомарное продвижение trust anchors сразу для пяти банков после проверки отсутствия активных попыток. Signed token использует отдельный `ATTEMPT_SIGNING_SECRET_V1`; invite/identity hashes — отдельные секреты. `LEGAL_PILOT_APPROVED=false` и `ATTEMPT_ISSUANCE_ENABLED=false` являются независимыми production gate до полного operator/legal/SME checklist.

Owner-bootstrap воспроизводит private banks только из полного Git commit `70e569cf267e043aabc780e81cc4307db7e149b1` и проверяет точные SHA-256 legacy-файлов. Backend также проверяет metadata private paths: наличие `public_key`, `public_url` или `share` останавливает bootstrap/issuance/invite/begin/save. Publish/share endpoints в архитектуре не используются.

### `docs/`

Дополнительная документация, которую удобно читать в Codex/Cursor/VS Code.

- `PROJECT_STRUCTURE.md` — структура проекта.
- `QA_REVIEW.md` — первичный QA-аудит банков вопросов без изменения JSON.
- `QUESTION_BANK_AUDIT.md` — технический/содержательный аудит и gate ротации.
- `QUESTION_BANK_ROTATION.md` — evidence, ограничения и runbook технической ротации v4.
- `SECURITY_AUDIT.md` — baseline этапа 10 и addendum 10A.
- `BACKEND_SCORING_DECISION.md` — реализованный trust/API/storage contract.
- `LEGAL_PRIVACY_REVIEW.md` — инженерная сверка data flow, официальных требований и owner checklist.
- `OPERATIONS.md` — главная точка входа оператора, уровни реакции и stop conditions.
- `DEPLOYMENT.md` — безопасный rollout/rollback GitHub Pages и существующего Apps Script deployment.
- `PRIVACY_CHECKLIST.md` — privacy controls до приглашения, во время обработки, при запросе и инциденте.
- `PILOT_READINESS.md` — техническое evidence этапа 17, NO-GO блокеры и последовательность первого пилота.
- `DATA_DELETION.md` — удаление, crash recovery и граница retention.
- `BACKUP_AND_RECOVERY.md` — snapshot/rotation/restore runbook и ограничения failure-domain.
- `REMAINING_ESTIMATE.md` — часы, токены и режимы оставшейся работы.

### `scripts/`

Локальные вспомогательные проверки.

- `validate-tests.js` и `audit-question-banks.js` — проверяют public schema, размеры, IDs, digest и согласованность display-банков.
- `migrate-public-banks-10a.js` — воспроизводит структурную public/private миграцию без содержательных правок.
- `build-rotated-banks.js` — собирает из внешнего authoring-source детерминированные private/public v4 artifacts.
- `promote-rotated-public-banks.js` — проверяет manifest и crash-safe продвигает сразу пять public banks.
- `verify-rotated-artifacts.js` — повторно сверяет source, private/public artifacts, digests и отсутствие утечки.
- `retime-rotation-sources.js` — воспроизводимо нормализует лимиты времени по сложности во внешнем source.
- `test-bank-rotation.js` и `test-rotation-promoter.js` — проверяют содержательный cutover, path hardening и recovery.
- `test-public-bank-secrecy.js` — проверяет отсутствие answer key и self-consistent digest.
- `test-attempt-tokens.js` — проверяет подпись, claims, expiry и подмену токена.
- `test-backend-scoring.js` — проверяет серверный расчёт и недоверие к клиентской арифметике.
- `test-10a-recovery.js` — проверяет single-use state, exact replay и recovery после частичного commit.
- `test-legal-privacy.js` — проверяет отдельное согласие, запрет employer sharing и fail-closed dual gate.
- `test-data-deletion.js` — проверяет preview, подтверждение, transaction purge и recovery удаления.
- `test-backup-recovery.js` — проверяет snapshot, rotation, tamper, corruption restore и deletion redaction.

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
