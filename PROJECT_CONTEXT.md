# PROJECT_CONTEXT.md

## Что это за проект

SkillCheck — MVP assessment-platform для первичного screening junior-кандидатов в финансах. Кандидат выбирает направление, проходит тест, система считает результат, фиксирует поведенческие риски и возвращает случайный код результата.

Результат тестирования является предварительной оценкой отдельных навыков. Он не является самостоятельным решением о найме, отказе в найме или профессиональной пригодности.

## Текущее состояние

Frontend остаётся статическим GitHub Pages сайтом:

```text
index.html -> test.html?test=<testId> -> data/<testId>.json -> Google Apps Script -> Яндекс Диск
```

Google Apps Script остаётся backend/API. Google Sheets и Google Drive больше не используются.

Backend имеет диагностический endpoint `?action=health`. Он проверяет наличие нужных Script Properties, доступ к Яндекс Диску, папки `reports/admin/private`, а также создаёт `admin/results.json` и `private/attempts.json` как `[]`, если они ещё отсутствуют.

Рабочие тесты:

- Financial Analyst Junior — `data/fa-junior.json`;
- Credit Analyst Junior — `data/ca-junior.json`, 80 вопросов;
- FP&A / Budget Analyst Junior — `data/fpa-junior.json`, 40 вопросов;
- Accounting / Reporting Junior — `data/acc-junior.json`, 40 вопросов;
- Finance BI / Data Analyst Junior — `data/bi-junior.json`, 40 вопросов.

## Новая модель хранения

Персональные данные и полный TXT-отчёт хранятся только на закрытом Яндекс Диске:

```text
disk:/skillcheck/reports/<code>.txt
```

TXT-отчёт создаётся только при успешном результате `finalScore >= 80`.

Админка использует только обезличенный JSON:

```text
disk:/skillcheck/admin/results.json
```

Анти-повтор использует приватный JSON с hash:

```text
disk:/skillcheck/private/attempts.json
```

## Админка

`admin.html` не хранит статические результаты и не показывает персональные данные. После ввода пароля она получает через Apps Script только:

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

Узнать, кто стоит за кодом, нельзя через сайт или `admin.html`. Это возможно только вручную через закрытый Яндекс Диск и TXT-файл с соответствующим кодом.

## Как работает прохождение

1. Кандидат выбирает тест на `index.html`.
2. Открывается `test.html?test=<testId>`.
3. `test.html` загружает JSON-банк из `data/*.json`.
4. Выбираются до 40 вопросов.
5. Вопросы и варианты ответа перемешиваются.
6. Перед стартом проверяется согласие на ПДн, 18+ и анти-повтор.
7. Кандидат отвечает по одному вопросу с таймером.
8. Сайт считает баллы, штраф за уходы, итоговый балл и Trust Score.
9. Frontend отправляет результат в Google Apps Script.
10. Backend генерирует случайный код результата.
11. Backend пишет обезличенную запись в `results.json`.
12. Backend пишет hash попытки в `attempts.json`. Dev quick-test сохраняет попытку, но не блокирует повторный запуск.
13. Если `finalScore >= 80`, backend создаёт TXT-отчёт на Яндекс Диске.
14. Frontend показывает код результата, процент, итоговый балл, статус и диагностические признаки сохранения.

## Что нельзя ломать

- дизайн и карточки `index.html`;
- загрузку JSON-файлов;
- random engine;
- отправку результата в Apps Script;
- Google Script URL без отдельного запроса;
- секреты Script Properties;
- правило: GitHub Pages не хранит результаты, персональные данные, токены или JSON-базы.
