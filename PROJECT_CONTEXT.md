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

Backend имеет публичный endpoint `?action=health`, который возвращает только минимальный немутирующий liveness. Он не читает Script Properties/Яндекс Диск, не раскрывает пути и не создаёт файлы. Защищённая расширенная диагностика запланирована отдельно.

Этап 10 завершён и опубликован в существующем deployment `@49` без смены URL: backend `yandex-disk-mvp-2026-07-20-7`, candidate `Build 2026.07.20.8`, admin `Build 2026.07.20.6`. Реализованы строгий API-контракт, allowlist тестов/версий, ограничения payload/TXT, advisory rate limits, XSS/TXT-санитизация, CSP meta и перенос полной pending-копии в `sessionStorage`. Валидный неистёкший legacy envelope мигрирует из `localStorage`, invalid/expired удаляется. Sensitive GET и JSONP удалены. Полная матрица: 10/10 скриптов PASS; 240 вопросов, 0 ошибок и 0 предупреждений. Implementation commit: pending.

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
scoreVerification
```

Узнать, кто стоит за кодом, нельзя через публичный список. Полный TXT загружается отдельным защищённым POST-запросом только после входа в админку и не вставляется в DOM.

## Как работает прохождение

1. Кандидат выбирает тест на `index.html`.
2. Открывается `test.html?test=<testId>`.
3. `test.html` загружает JSON-банк из `data/*.json`.
4. Выбираются до 40 вопросов.
5. Вопросы и варианты ответа перемешиваются.
6. Перед стартом проверяется согласие на ПДн, 18+ и анти-повтор.
7. Кандидат отвечает по одному вопросу с таймером.
8. Сайт считает предварительные баллы, штраф за уходы, итоговый балл и Trust Score.
9. Frontend отправляет результат в Google Apps Script.
10. Backend генерирует случайный код результата.
11. Backend пишет обезличенную запись в `results.json`.
12. Backend пишет hash попытки в `attempts.json`. Внутренняя retake-логика умеет bypass для dev quick-test, но публичные `checkAttempt`/`saveResult` отклоняют `dev-quick` как `test_not_public` при production-флаге по умолчанию.
13. Если `finalScore >= 80`, backend создаёт TXT-отчёт на Яндекс Диске.
14. Frontend показывает код результата, процент, итоговый балл, статус сохранения и предупреждение о клиентском расчёте.

Backend пока не имеет закрытого answer key: он проверяет строгую схему и внутреннюю согласованность, но сохраняет `scoreVerification: client-reported-unverified`. Правильные ответы доступны в публичных JSON. Authoritative backend-scoring обязателен до пилота; для открытого/adversarial сценария рекомендуется backend question delivery. Большая миграция не начата без отдельного согласования пользователя.

## Что нельзя ломать

- дизайн и карточки `index.html`;
- загрузку JSON-файлов;
- random engine;
- отправку результата в Apps Script;
- Google Script URL без отдельного запроса;
- секреты Script Properties;
- правило: GitHub Pages не хранит результаты, персональные данные, токены или JSON-базы.

## Security-границы текущего MVP

- Публичный Apps Script endpoint остаётся анонимным, потому что кандидат не обязан иметь Google-аккаунт.
- `checkAttempt`, `saveResult`, административные результаты и TXT используют только POST и известные `action`.
- `CacheService` rate limits — best-effort, не IP-based и не заменяют gateway/WAF.
- Точный retake `nextDate` удалён, но `allowed`/`foundPreviousAttempt` остаются email-enumeration oracle; email не верифицирован, 32-bit fingerprint контролируется клиентом.
- `saveResult` не требует server-issued challenge. Публичные answer keys допускают согласованный quota-spam; `dev-quick` hard-disabled по умолчанию через `PUBLIC_DEV_TEST_ENABLED=false`, но обычным тестам нужен signed attempt/invite в 10A.
- `questionId` совместим с legacy и пока необязателен; уникальность проверяется только при его наличии.
- CSP задана через meta и допускает inline JS/CSS текущих single-file страниц; это полезное ограничение, но не эквивалент полного набора HTTP security headers.
- Полная pending-копия ПДн хранится только в `sessionStorage`; `localStorage` используется для неперсонального retake marker.
- Текущий код результата подтверждает сохранение, а не независимую проверку знаний.
- Scope Яндекс OAuth-токена не подтверждён и может быть шире `disk:/skillcheck`; нужны ротация и оценка app-folder/least-privilege credential.

Подробности: `docs/SECURITY_AUDIT.md` и `docs/BACKEND_SCORING_DECISION.md`.
