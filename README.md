# SkillCheck

SkillCheck — статическая MVP assessment-platform для первичного отбора junior-кандидатов в финансовых направлениях.

Сайт проверяет практическую финансовую логику: отчётность, cash flow, кредитный риск, Excel/аналитику, внимательность к деталям и способность принимать решения по кейсам.

Постоянный план развития находится в [`ROADMAP.md`](ROADMAP.md), актуальное состояние — в [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Текущий статус

Рабочая версия включает:

- выбор теста на `index.html`;
- прохождение теста на `test.html?test=<testId>`;
- загрузку банка вопросов из `data/*.json`;
- случайную выборку до 40 вопросов из банка;
- перемешивание вопросов и вариантов ответа;
- таймер на каждый вопрос;
- фиксацию уходов со вкладки;
- анти-повтор через hash попытки на backend;
- обязательное согласие на обработку персональных данных перед стартом;
- обязательное подтверждение 18+ перед стартом;
- отдельное необязательное согласие на передачу результата работодателю;
- обязательные поля источника кандидата и опыта;
- необязательный Telegram для быстрой обратной связи, сохраняемый только в успешном TXT;
- подсчёт результата и Trust Score;
- выдачу случайного кода результата после сохранения;
- отправку результата в Google Apps Script;
- хранение отчётов и обезличенной админ-базы на Яндекс Диске;
- health endpoint для проверки связки Apps Script -> Яндекс Диск.

Телефон в MVP больше не собирается. Повторная попытка проверяется по отдельным SHA-256 hash для пары `testId + email` и пары `testId + browserFingerprint` с `ATTEMPT_HASH_SALT`. Сырые email и fingerprint в backend-записи анти-повтора не хранятся.

Результат тестирования является предварительной оценкой отдельных навыков и не является самостоятельным решением о найме или профессиональной пригодности.

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
privacy.html            Политика обработки персональных данных
admin.html              Обезличенная админ-панель по кодам
data/*.json             Банки вопросов
apps-script/Code.gs     Google Apps Script API для Яндекс Диска
docs/QA_REVIEW.md       QA-аудит банков вопросов
docs/QUESTION_BANK_AUDIT.md Полный технический и содержательный аудит банков
docs/SCORING_AUDIT.md  Аудит расчёта результатов
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

Быстрый dev smoke-test без retake-блокировки:

```text
http://localhost:8000/test.html?test=dev-quick
```

Проверка банков вопросов:

```bash
node scripts/validate-tests.js
node scripts/audit-question-banks.js
node scripts/test-telegram.js
node scripts/test-retake.js
node scripts/test-scoring.js
```

## Правила разработки

1. Не переписывать дизайн `index.html` без отдельной задачи.
2. Не хранить банки вопросов внутри HTML.
3. Один тест = один JSON-файл в `data/`.
4. Если в банке меньше 40 вопросов, тест берёт все.
5. Если в банке больше 40 вопросов, тест случайно выбирает 40.
6. Варианты ответа перемешиваются, правильный индекс пересчитывается.
7. Не хранить результаты, персональные данные, токены или JSON-базы на GitHub Pages.
8. Google Apps Script обновлять в существующем deployment, не меняя Web App URL без отдельного согласования.
9. Все секреты хранить только в Apps Script Properties.
10. Перед публичным запуском указать контактный email оператора в `privacy.html`.

## Backend Storage

Google Sheets и Google Drive больше не используются. Google Apps Script работает как API и хранит данные через Яндекс.Диск REST API:

```text
disk:/skillcheck/reports/<code>.txt       полный TXT-отчёт успешного результата
disk:/skillcheck/admin/results.json       обезличенные данные для admin.html
disk:/skillcheck/private/attempts.json    hash попыток для анти-повтора
```

Диагностика backend после деплоя:

```text
<WEB_APP_URL>?action=health
```

`health` не выводит токены, пароль или salt. Он проверяет наличие Script Properties, доступ к Яндекс Диску и создаёт `results.json` / `attempts.json` как пустые массивы, если файлов ещё нет.

Нужные Script Properties:

```text
YANDEX_DISK_TOKEN
YANDEX_DISK_REPORTS_FOLDER
YANDEX_DISK_ADMIN_FILE
YANDEX_DISK_ATTEMPTS_FILE
ATTEMPT_HASH_SALT
ADMIN_PASSWORD
```
