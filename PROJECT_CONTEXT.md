# PROJECT_CONTEXT.md

## Что это за проект

SkillCheck — MVP assessment-platform для первичного screening junior-кандидатов в финансах. Кандидат выбирает направление, проходит тест, система считает результат, фиксирует поведенческие риски и формирует отчёт для работодателя.

Проект не является учебной викториной. Цель — быстро понять, стоит ли приглашать кандидата на интервью и какие темы проверять глубже.

## Текущее состояние

Сайт остаётся простой статической GitHub Pages структурой:

```text
index.html -> test.html?test=<testId> -> data/<testId>.json -> Google Apps Script -> Google Sheets + TXT report
```

Рабочие тесты:

- Financial Analyst Junior — `data/fa-junior.json`;
- Credit Analyst Junior — `data/ca-junior.json`.

Черновые тесты:

- FP&A / Budget Analyst Junior — `data/fpa-junior.json`;
- Accounting Junior — `data/acc-junior.json`;
- Finance BI / Data Analyst Junior — `data/bi-junior.json`.

## Как работает прохождение

1. Кандидат выбирает тест на `index.html`.
2. Открывается `test.html?test=<testId>`.
3. `test.html` берёт конфигурацию из `TEST_CONFIG`.
4. Загружается JSON-банк из `data/*.json`.
5. Если вопросов меньше 40, берутся все.
6. Если вопросов больше 40, случайно выбираются 40.
7. Выбранные вопросы перемешиваются.
8. Варианты ответа внутри каждого вопроса перемешиваются.
9. Правильный ответ пересчитывается после перемешивания.
10. Кандидат отвечает по одному вопросу с таймером.
11. Сайт считает баллы, штраф за уходы, итоговый балл, плашку и Trust Score.
12. TXT-отчёт отправляется в Apps Script и сохраняется в Google Drive.
13. Итоговая строка пишется в Google Sheets.

## Формат вопроса

Минимально совместимые поля:

```json
{
  "block": "cashflow",
  "difficulty": "medium",
  "timeLimit": 60,
  "points": 4,
  "text": "Текст вопроса",
  "options": ["A", "B", "C", "D"],
  "correct": 0,
  "comment": "Пояснение для отчёта"
}
```

`test.html` также поддерживает запасные поля `question`, `timer`, `seconds`, `score`, `correctAnswer`, `explanation`, чтобы старые банки не ломались.

## Google Sheets

Рабочие колонки:

```text
Дата
Тест
Версия
Имя
Email
Телефон
Английский
Уход со вкладки
Баллы
Всего
Процент
Итоговый балл
Плашка
Статус
Trust Score
Ссылка на TXT отчет
```

Старые колонки `Решение`, `Баллы (сырые)`, `Всего (сырые)` не нужны в основной таблице. Детализация остаётся в TXT-отчёте.

## Что нельзя ломать

- дизайн и карточки `index.html`;
- загрузку JSON-файлов;
- выбор существующих тестов;
- отправку результата в Apps Script;
- `SPREADSHEET_ID`, `FOLDER_ID` и Google Script URL без необходимости;
- структуру проекта без отдельной причины.
