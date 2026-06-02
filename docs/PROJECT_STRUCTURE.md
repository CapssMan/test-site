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
│   └── bi-junior.json
├── apps-script/
│   └── Code.gs
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   └── QA_REVIEW.md
├── scripts/
│   └── validate-tests.js
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

Папка с банками вопросов.

Правило: один тест = один JSON-файл.

Нельзя держать вопросы прямо в HTML, иначе проект быстро станет неуправляемым.

Текущие рабочие банки:

- `fa-junior.json` — Financial Analyst Junior.
- `ca-junior.json` — Credit Analyst Junior.
- `fpa-junior.json` — FP&A / Budget Analyst Junior.
- `acc-junior.json` — Accounting / Reporting Junior.
- `bi-junior.json` — Finance BI / Data Analyst Junior.

### `apps-script/`

Папка с кодом Google Apps Script. Этот файл не запускается на GitHub Pages сам по себе. Его нужно вручную скопировать в Apps Script.

Backend больше не использует Google Sheets и Google Drive. Все результаты пишутся через Яндекс.Диск REST API:

- `disk:/skillcheck/reports/<code>.txt` — полные отчёты успешных результатов;
- `disk:/skillcheck/admin/results.json` — обезличенная база для `admin.html`;
- `disk:/skillcheck/private/attempts.json` — hash попыток для анти-повтора.

`Code.gs` также отдаёт `?action=health` для диагностики доступа к Яндекс Диску и `?action=adminResults` для загрузки обезличенных результатов после проверки `ADMIN_PASSWORD`.

### `docs/`

Дополнительная документация, которую удобно читать в Codex/Cursor/VS Code.

- `PROJECT_STRUCTURE.md` — структура проекта.
- `QA_REVIEW.md` — первичный QA-аудит банков вопросов без изменения JSON.

### `scripts/`

Локальные вспомогательные проверки.

- `validate-tests.js` — проверяет структуру банков вопросов и долю случаев, где правильный ответ является самым длинным.

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
│       ├── scoring.js
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
