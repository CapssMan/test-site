# PROJECT_STRUCTURE.md

## Текущая безопасная структура

Эта структура сохраняет рабочий GitHub Pages сайт и не ломает текущий дизайн.

```text
skillcheck/
├── index.html
├── test.html
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
│   └── PROJECT_STRUCTURE.md
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
- `admin.html` — админ-панель / черновик панели результатов.

### `data/`

Папка с банками вопросов.

Правило: один тест = один JSON-файл.

Нельзя держать вопросы прямо в HTML, иначе проект быстро станет неуправляемым.

### `apps-script/`

Папка с кодом Google Apps Script. Этот файл не запускается на GitHub Pages сам по себе. Его нужно вручную скопировать в Apps Script.

### `docs/`

Дополнительная документация, которую удобно читать в Codex/Cursor/VS Code.

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
