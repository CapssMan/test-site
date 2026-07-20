# PROJECT_CONTEXT.md

## Что это за проект

SkillCheck — MVP assessment-platform для первичного screening junior-кандидатов в финансах. Кандидат получает контролируемое приглашение, проходит тест, backend авторитетно считает результат, сохраняет advisory telemetry и возвращает случайный код результата.

Результат тестирования является предварительной оценкой отдельных навыков. Он не является самостоятельным решением о найме, отказе в найме или профессиональной пригодности.

## Текущее состояние

Frontend остаётся статическим GitHub Pages сайтом:

```text
index.html -> test.html?test=<testId>#invite=... -> display-only data/<testId>.json -> Google Apps Script attempt-v1 -> Яндекс Диск
```

Google Apps Script остаётся backend/API. Google Sheets и Google Drive больше не используются.

Backend имеет публичный endpoint `?action=health`, который возвращает только минимальный немутирующий liveness. Он не читает Script Properties/Яндекс Диск, не раскрывает пути и не создаёт файлы. Защищённая расширенная диагностика запланирована отдельно.

Historical baseline этапа 10 опубликован в deployment `@49`, implementation commit `e251be3`. Этап 10A завершён и production-verified в существующем deployment `@51` без смены URL: backend `yandex-disk-mvp-2026-07-20-9`, candidate `Build 2026.07.20.11`, admin `Build 2026.07.20.9`, implementation commit `2addd59`. Полная матрица 14/14 скриптов и live browser QA на desktop/mobile прошли.

Owner smoke `FA-LDUB2` подтвердил `server-verified` / `authoritative-v1` / `attempt-v1`, exact replay того же кода и отсутствие TXT для failed-результата; после проверки issuance выключен, временный bridge удалён. Реальный пилот остаётся заблокирован до отдельно согласованной содержательной ротации банков: старые answer keys доступны в Git history, клонах и кэшах.

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

Legacy-compatible anti-retake projection использует приватный JSON с hash:

```text
disk:/skillcheck/private/attempts.json
```

Authoritative attempt flow дополнительно использует:

```text
disk:/skillcheck/private/invites-v1.json
disk:/skillcheck/private/attempt-sessions-v1.json
disk:/skillcheck/private/banks/<test>/<version>.json
```

Private banks содержат answer key и проверяются по SHA-256 anchors из Script Properties. Если защищённый storage опубликован/расшарен либо private JSON отсутствует/повреждён, backend завершается fail closed.

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
bankVersion
scoreVerification
scoringAlgorithmVersion
telemetryVerification
```

Узнать, кто стоит за кодом, нельзя через публичный список. Полный TXT загружается отдельным защищённым POST-запросом только после входа в админку и не вставляется в DOM.

## Как работает прохождение

1. Администратор выпускает email/test-bound одноразовое приглашение; при выключенном issuance операция заблокирована.
2. Candidate URL передаёт bearer-код только во fragment `#invite=...`; страница сразу переносит его в `sessionStorage` и очищает адресную строку.
3. `test.html` загружает display-only public bank без `correct` и проверяет `publicDigest`.
4. После согласий frontend отправляет `beginAttempt` с `attempt-v1`, invite, email и browser fingerprint.
5. Backend проверяет invite/retake/private storage и выдаёт 6-часовой HMAC-signed token с точным ordered manifest вопросов.
6. Frontend сохраняет серверный порядок вопросов и криптографически перемешивает целые option-объекты.
7. Кандидат отвечает по одному вопросу с таймером; время и tab switches остаются advisory telemetry без штрафа к баллу.
8. Pending submission хранится только в текущем `sessionStorage`, не дольше token и максимум 6 часов; legacy full payload из `localStorage` удаляется.
9. `saveResult` отправляет обязательные `questionId`/`optionId`, token/session bindings и telemetry без клиентского score.
10. Backend сверяет token, session, identity/fingerprint, точный manifest и закрытый versioned bank.
11. Backend сам рассчитывает raw/final/percent/pass и маркирует результат `server-verified` / `authoritative-v1`.
12. State machine `active → reserved → completed` резервирует код, создаёт TXT только для passed, обновляет admin/attempt stores и поддерживает recovery.
13. Exact replay того же request/payload возвращает тот же код; изменённый payload конфликтует.
14. Frontend показывает результат только при совпадении `attempt-v1`, attempt/test/bank bindings и серверных verification markers.

Техническая trust boundary реализована, но текущие тексты/ключи исторически скомпрометированы прежней публикацией. `ATTEMPT_ISSUANCE_ENABLED=false` сохраняется до содержательной ротации банков и pilot checklist.

## Что нельзя ломать

- дизайн и карточки `index.html`;
- display-only JSON и их `publicDigest`;
- точный server-issued question manifest и перемешивание option-объектов;
- отправку результата в Apps Script;
- стабильный Google Script URL;
- authoritative scoring, single-use session и fail-closed private storage;
- секреты Script Properties;
- правило: GitHub Pages не хранит результаты, персональные данные, токены или JSON-базы.
- pilot lock: не включать issuance до отдельно согласованной ротации банков.

## Security-границы текущего MVP

- Публичный Apps Script endpoint остаётся анонимным, потому что кандидат не обязан иметь Google-аккаунт, но начало попытки требует email/test-bound invite.
- Публичный `checkAttempt` удалён; tokenless/legacy `saveResult` отклоняется как `client_upgrade_required`.
- `beginAttempt`, token-bound `saveResult`, административные результаты/TXT/invites используют строгие POST-контракты и известные `action`.
- `CacheService` rate limits — best-effort, не IP-based и не заменяют gateway/WAF.
- Invite и fingerprint ограничивают поток, но не доказывают личность; для более сильной идентификации нужны OTP/magic link или аккаунт.
- `questionId`/`optionId` обязательны и сверяются с точным server-issued manifest и private bank.
- Invite/token/email/fingerprint не хранятся открыто в invite/session JSON и технических логах.
- Private storage не должен иметь `public_key`, `public_url` или `share`; backend проверяет это перед критическими действиями и fail closed.
- CSP задана через meta и допускает inline JS/CSS текущих single-file страниц; это полезное ограничение, но не эквивалент полного набора HTTP security headers.
- Полная pending-копия хранится только в `sessionStorage` максимум 6 часов; `localStorage` содержит только информационную дату завершения.
- Код 10A подтверждает сохранение авторитетно рассчитанного результата, но текущий банк нельзя считать секретным до содержательной ротации.
- Scope Яндекс OAuth-токена не подтверждён и может быть шире `disk:/skillcheck`; нужны ротация и оценка app-folder/least-privilege credential.

Подробности: `docs/SECURITY_AUDIT.md` и `docs/BACKEND_SCORING_DECISION.md`.
