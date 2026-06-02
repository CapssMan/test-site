# SkillCheck

SkillCheck — статическая MVP assessment-platform для первичного отбора junior-кандидатов в финансовых направлениях.

Сайт проверяет практическую финансовую логику: отчётность, cash flow, кредитный риск, Excel/аналитику, внимательность к деталям и способность принимать решения по кейсам.

## Текущий статус

Рабочая версия включает:

- выбор теста на `index.html`;
- прохождение теста на `test.html?test=<testId>`;
- загрузку банка вопросов из `data/*.json`;
- случайную выборку до 40 вопросов из банка;
- перемешивание вопросов и вариантов ответа;
- таймер на каждый вопрос;
- фиксацию уходов со вкладки;
- ограничение повторной попытки одного теста на 21 день;
- обязательные поля источника кандидата и опыта;
- подсчёт результата и Trust Score;
- TXT-отчёт с Candidate Summary;
- отправку результата в Google Apps Script, Google Sheets и Google Drive.

Повторная попытка блокируется по машинному `testId`, email, телефону и hash технического browser fingerprint. В Google Sheets для этого используются колонки `ID теста` и `Fingerprint`, а в браузере дополнительно сохраняется localStorage-lock на конкретный тест.

## Тесты

| Тест | Статус | Банк вопросов |
|---|---|---|
| Financial Analyst Junior | Работает | `data/fa-junior.json` |
| Credit Analyst Junior | Работает | `data/ca-junior.json` |
| FP&A / Budget Analyst Junior | Работает, 40 вопросов | `data/fpa-junior.json` |
| Accounting / Reporting Junior | Работает, 40 вопросов | `data/acc-junior.json` |
| Finance BI / Data Analyst Junior | Работает, 40 вопросов | `data/bi-junior.json` |

## Основные файлы

```text
index.html              Главная страница и карточки тестов
test.html               Движок прохождения теста
admin.html              Черновая админ-панель
data/*.json             Банки вопросов
apps-script/Code.gs     Google Apps Script для Sheets и TXT-отчётов
docs/QA_REVIEW.md       QA-аудит банков вопросов
scripts/validate-tests.js Проверка структуры JSON-банков
README.md               Общее описание
PROJECT_CONTEXT.md      Контекст проекта
TODO.md                 План задач
ARCHITECTURE.md         Архитектура
```

## Локальный запуск

Из-за загрузки JSON через `fetch()` проект лучше запускать через локальный сервер:

```bash
python -m http.server 8000
```

Открыть:

```text
http://localhost:8000
```

Проверка конкретных тестов:

```text
http://localhost:8000/test.html?test=fa-junior
http://localhost:8000/test.html?test=ca-junior
http://localhost:8000/test.html?test=fpa-junior
http://localhost:8000/test.html?test=acc-junior
http://localhost:8000/test.html?test=bi-junior
```

Проверка банков вопросов:

```bash
node scripts/validate-tests.js
```

## Правила разработки

1. Не переписывать дизайн `index.html` без отдельной задачи.
2. Не хранить банки вопросов внутри HTML.
3. Один тест = один JSON-файл в `data/`.
4. Если в банке меньше 40 вопросов, тест берёт все.
5. Если в банке больше 40 вопросов, тест случайно выбирает 40.
6. Варианты ответа перемешиваются, правильный индекс пересчитывается.
7. Повторная попытка одного и того же теста разрешена только через 21 день.
8. Перед обновлением Google Apps Script вручную создать новый deployment.
9. Не менять `SPREADSHEET_ID`, `FOLDER_ID` и Google Script URL без необходимости.
