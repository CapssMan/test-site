# SkillCheck

SkillCheck — статическая MVP assessment-platform для первичного отбора junior-кандидатов в финансовых направлениях.

Сайт проверяет практическую финансовую логику: отчётность, cash flow, кредитный риск, Excel/аналитику, внимательность к деталям и способность принимать решения по кейсам.

Постоянный план развития находится в [`ROADMAP.md`](ROADMAP.md), актуальное состояние — в [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Текущий статус

Этап 17, техническая ротация пяти production-банков v4 и least-privilege ротация Яндекс credential завершены с решением **NO-GO для реальных кандидатов**: опубликованы 240 новых вопросов/вариантов/ключей/ID, private/public split, fail-closed trust anchors, crash-safe cutover и app-folder-only storage. Dependency-free `npm test` и read-only GitHub Actions CI выполняют 22 regression suite и 5 infrastructure validators. Runtime: candidate `Build 2026.07.21.13`, admin `Build 2026.07.21.13`, backend `yandex-disk-mvp-2026-07-23-15`, deployment `@61`; API `attempt-v2`.

`LEGAL_PILOT_APPROVED` и `ATTEMPT_ISSUANCE_ENABLED` остаются `false`. Реальные кандидаты не допускаются до заполнения реквизитов оператора, внешнего legal/retention checklist, независимого человеческого SME sign-off банков v4, очистки smoke-данных и owner sign-off.

Официальная инженерная legal/privacy-сверка обновлена 23 июля 2026 года: уведомление об обработке, локализация/трансграничность, форма подтверждения уничтожения и квалификация обезличивания вынесены в явный внешний checklist. Наличие технических controls не считается юридическим одобрением.

Рабочая версия включает:

- выбор теста на `index.html`;
- прохождение теста на `test.html?test=<testId>`;
- загрузку display-only банка вопросов из `data/*.json` без `correct`, комментариев к ответу и клиентского scoring;
- проверку целостности public bank по `publicDigest`;
- выдачу сервером точного набора из 40 вопросов после проверки одноразового приглашения;
- сохранение серверного порядка вопросов и криптографическое перемешивание вариантов ответа в браузере;
- таймер на каждый вопрос;
- фиксацию уходов со вкладки;
- одноразовые email/test-bound приглашения и 6-часовой подписанный attempt-токен;
- передачу bearer-кода приглашения только во fragment `#invite=...`: код не попадает в query, fragment сразу забирается в `sessionStorage` и удаляется из адресной строки;
- серверную attempt-сессию со статусами `active → reserved → completed` и идемпотентным восстановлением;
- анти-повтор через закрытые identity hashes на backend;
- отдельное согласие на обработку персональных данных версии `skillcheck-pd-consent-2026-07-20-v1`, связанное с attempt token/session и серверным временем;
- обязательное подтверждение 18+ перед стартом;
- hard-disabled передачу результата работодателю до отдельного согласия для конкретного получателя;
- обязательные поля источника кандидата и опыта;
- необязательный Telegram для быстрой обратной связи, сохраняемый только в успешном TXT;
- авторитетный пересчёт баллов и статуса на backend по закрытому банку с маркировкой `server-verified` / `authoritative-v1`;
- хранение времени и уходов со вкладки только как `client-reported-unverified` telemetry без штрафа к баллу;
- выдачу случайного кода результата после сохранения;
- резервную копию неподтверждённого результата в `sessionStorage` текущей вкладки и восстановление после перезагрузки этой вкладки;
- ограниченный автоматический retry и безопасную повторную отправку с `requestId`, не создающую второй код;
- отправку результата в Google Apps Script;
- хранение отчётов и псевдонимизированной админ-базы без открытых контактов на Яндекс Диске;
- административный preview и подтверждаемое удаление результата либо всей связанной попытки с crash recovery;
- до 12 закрытых проверяемых версий каждого operational store и editor-only восстановление при закрытых pilot gates;
- минимальный немутирующий health endpoint для проверки доступности Apps Script.
- защищённую POST-диагностику в админке с версиями, временем backend, storage state, размерами/row counts и санитизированной ошибкой.

Телефон в MVP не собирается. Приглашение связывается с email и тестом, а серверная сессия — с закрытыми hash email/fingerprint. Сырые email, fingerprint, invite code и attempt token в invite/session JSON и технических логах не хранятся. Это controlled-pilot access, но не полное подтверждение личности: для более сильной идентификации всё ещё нужны OTP/magic link или аккаунт.

Незавершённый begin-запрос хранится в `sessionStorage` не более 30 минут, а pending submission — не дольше срока attempt-токена и максимум 6 часов. Новые полные pending-копии в постоянное хранилище не записываются.

Результат тестирования является предварительной оценкой отдельных навыков и не является самостоятельным решением о найме или профессиональной пригодности.

Важно: public JSON не содержат правильных ответов, а frontend не считает итог. Прежние v3 ключи остаются в истории Git/клонах/кэшах, но выпуск v4 полностью заменяет их новыми ID, формулировками, вариантами и ключами. Технический evidence описан в [`docs/QUESTION_BANK_ROTATION.md`](docs/QUESTION_BANK_ROTATION.md), архитектура scoring — в [`docs/BACKEND_SCORING_DECISION.md`](docs/BACKEND_SCORING_DECISION.md). До реального пилота всё ещё нужен независимый человеческий SME sign-off v4.

## Тесты

| Тест | Статус | Банк вопросов |
|---|---|---|
| Financial Analyst Junior | Технически готов; выдача приглашений заблокирована | `data/fa-junior.json` |
| Credit Analyst Junior | Технически готов; сервер выбирает 40 из 80 | `data/ca-junior.json` |
| FP&A / Budget Analyst Junior | Технически готов; выдача приглашений заблокирована | `data/fpa-junior.json` |
| Accounting / Reporting Junior | Технически готов; выдача приглашений заблокирована | `data/acc-junior.json` |
| Finance BI / Data Analyst Junior | Технически готов; выдача приглашений заблокирована | `data/bi-junior.json` |

## Основные файлы

```text
index.html              Главная страница и карточки тестов
test.html               Движок прохождения теста
privacy.html            Политика обработки персональных данных
consent.html            Отдельное versioned-согласие на обработку данных
admin.html              Псевдонимизированная админ-панель по кодам
data/*.json             Display-only банки без answer key
apps-script/Code.gs     Google Apps Script API для Яндекс Диска
docs/QA_REVIEW.md       QA-аудит банков вопросов
docs/QUESTION_BANK_AUDIT.md Полный технический и содержательный аудит банков
docs/SCORING_AUDIT.md  Аудит расчёта результатов
docs/SECURITY_AUDIT.md Security-аудит и остаточные риски
docs/BACKEND_SCORING_DECISION.md Решение по авторитетному расчёту
docs/LEGAL_PRIVACY_REVIEW.md Инженерный legal/privacy review и owner checklist
docs/DATA_DELETION.md  Механизм удаления, crash recovery и retention boundary
docs/BACKUP_AND_RECOVERY.md Проверяемые snapshots, ротация и restore runbook
docs/OBSERVABILITY.md Защищённый status contract и operator runbook
docs/TESTING.md       Единая CI-матрица, безопасный workflow и добавление тестов
docs/OPERATIONS.md    Главная точка входа для эксплуатации и реакции на инциденты
docs/DEPLOYMENT.md    Безопасная публикация Apps Script/Pages и rollback без смены URL
docs/PRIVACY_CHECKLIST.md Privacy checklist оператора и stop conditions пилота
docs/PILOT_READINESS.md Техническое evidence, NO-GO блокеры и порядок первого пилота
docs/PRE_PILOT_INPUTS.md Безопасный шаблон входных решений SME/operator/legal/cleanup/owner
docs/QUESTION_BANK_ROTATION.md Evidence и runbook технической ротации пяти банков v4
docs/SME_REVIEW_HANDOFF.md Закрытая передача банков v4 независимому эксперту и критерии sign-off
scripts/validate-tests.js Проверка структуры JSON-банков
scripts/migrate-public-banks-10a.js Воспроизводимая структурная миграция банков 10A
README.md               Общее описание
PROJECT_CONTEXT.md      Контекст проекта
TODO.md                 План задач
ARCHITECTURE.md         Архитектура
```

## Локальный запуск

Полная локальная проверка, идентичная GitHub Actions:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Матрица не требует secrets, сети или production-доступа. Подробности: [`docs/TESTING.md`](docs/TESTING.md).

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

Быстрый локальный UI smoke-test закрытого dev-маршрута:

```text
http://localhost:8000/test.html?test=dev-quick
```

`dev-quick` hard-disabled на backend (`PUBLIC_DEV_TEST_ENABLED=false`) и не может получить attempt. Не включать его на рабочем deployment без отдельной закрытой защиты.

Проверка банков вопросов:

```bash
node scripts/validate-tests.js
node scripts/audit-question-banks.js
node scripts/test-telegram.js
node scripts/test-retake.js
node scripts/test-scoring.js
node scripts/test-admin.js
node scripts/test-report-access.js
node scripts/test-candidate-ux.js
node scripts/test-submission-reliability.js
node scripts/test-security.js
node scripts/test-public-bank-secrecy.js
node scripts/test-attempt-tokens.js
node scripts/test-backend-scoring.js
node scripts/test-10a-recovery.js
node scripts/test-legal-privacy.js
node scripts/test-data-deletion.js
node scripts/test-backup-recovery.js
node scripts/test-observability.js
node scripts/test-ci-config.js
node scripts/test-operations-docs.js
node scripts/test-pilot-readiness.js
```

## Эксплуатация

Главная точка входа оператора — [`docs/OPERATIONS.md`](docs/OPERATIONS.md). Перед публикацией использовать [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), перед работой с реальными кандидатами — [`docs/PRIVACY_CHECKLIST.md`](docs/PRIVACY_CHECKLIST.md). Тематические процедуры backup/restore, удаления и диагностики остаются в отдельных runbooks и связаны из руководства оператора.

## Правила разработки

1. Не переписывать дизайн `index.html` без отдельной задачи.
2. Не хранить банки вопросов внутри HTML.
3. Один тест = один JSON-файл в `data/`.
4. Public bank содержит только display-поля и opaque option IDs; правильный ответ хранится только в private bank.
5. Точный manifest попытки выбирает backend: 40 из 80 для Credit Analyst и все 40 для остальных production-банков.
6. Frontend перемешивает целые option-объекты и отправляет только `questionId`/`optionId`; клиентский балл не принимается.
7. Не хранить результаты, персональные данные, токены или JSON-базы на GitHub Pages.
8. Google Apps Script обновлять в существующем deployment, не меняя Web App URL без отдельного согласования.
9. Все секреты хранить только в Apps Script Properties.
10. Перед публичным запуском заполнить реквизиты и контакт оператора в `privacy.html` и `consent.html`.
11. Не включать `LEGAL_PILOT_APPROVED` и `ATTEMPT_ISSUANCE_ENABLED` для реальных кандидатов до внешнего legal/retention checklist, SME sign-off v4, data cleanup и owner sign-off.
12. Не менять вопросы, варианты или правильные ответы без отдельного подтверждения и SME-проверки.

## Backend Storage

Google Sheets и Google Drive больше не используются. Google Apps Script работает как API и хранит данные через Яндекс.Диск REST API:

```text
app:/skillcheck/reports/<code>.txt       полный TXT-отчёт успешного результата
app:/skillcheck/admin/results.json       псевдонимизированные данные без открытых контактов
app:/skillcheck/private/attempts.json    hash попыток для анти-повтора
app:/skillcheck/private/invites-v1.json  состояния одноразовых приглашений
app:/skillcheck/private/attempt-sessions-v1.json состояния attempt и recovery
app:/skillcheck/private/banks/<test>/<version>.json закрытые versioned-банки
```

Диагностика backend после деплоя:

```text
<WEB_APP_URL>?action=health
```

Публичный `health` возвращает только `ok`, статус сервиса и `backendVersion`. Он не выводит токены, пароль, salt, внутренние пути или наличие файлов, не обращается к Яндекс Диску и ничего не создаёт. Защищённая расширенная диагностика относится к отдельному этапу наблюдаемости.

Публичный контракт `attempt-v2` оставляет только POST `beginAttempt` и token-bound `saveResult`. Он требует точную версию отдельного согласия и 18+, а token/session связываются с consent version/time. Legacy/tokenless сохранение и `attempt-v1` отклоняются как `client_upgrade_required`; публичный `checkAttempt` удалён. Сервер сверяет точный manifest, option IDs, bank version и одноразовое состояние сессии, затем сам рассчитывает балл. Передача работодателю отклоняется backend. Частотные лимиты через Apps Script `CacheService` остаются best-effort защитой и не заменяют внешний API gateway/WAF.

Owner-bootstrap получает legacy-банки только из неизменяемого полного commit `70e569cf267e043aabc780e81cc4307db7e149b1` и проверяет отдельный SHA-256 каждого исходного файла до разбора JSON. Bootstrap, выпуск приглашения, `beginAttempt`, `saveResult` и включение issuance завершаются fail closed, если private-путь/файл Яндекс.Диска опубликован или расшарен (`public_key`, `public_url` или `share`). Publish/share API проект не использует.

Историческая компрометация v3 закрыта технической ротацией v4, но внутренняя проверка не заменяет независимого профильного эксперта. Перед включением выдачи приглашений нужны SME sign-off и остальные внешние условия readiness checklist. Для открытого публичного потока дополнительно нужны OTP/auth, CAPTCHA и/или внешний gateway.

Production использует отдельное API-only OAuth-приложение `SkillCheck Storage` с единственным scope `cloud_api:disk.app_folder` и активным root `app:/skillcheck`. Проверенный сценарий миграции, rollback и ротации описан в [`docs/YANDEX_CREDENTIAL_ROTATION.md`](docs/YANDEX_CREDENTIAL_ROTATION.md).

Исторический production smoke этапа 10 подтвердил baseline `@49`. Production owner smoke 10A `FA-LDUB2` на deployment `@51`: raw/final/percent `0`, статус failed, `server-verified`, `authoritative-v1`, `attempt-v1`, telemetry `client-reported-unverified`, `reportCreated:false`; точный replay вернул тот же код с `replayed:true`. После smoke issuance снова выключен, временный bridge удалён и возвращает `unknown_action`.

Нужные Script Properties:

```text
YANDEX_DISK_TOKEN
YANDEX_DISK_REPORTS_FOLDER
YANDEX_DISK_ADMIN_FILE
YANDEX_DISK_ATTEMPTS_FILE
ATTEMPT_HASH_SALT
ADMIN_PASSWORD
ATTEMPT_SIGNING_SECRET_V1
INVITE_CODE_SECRET_V1
IDENTITY_HASH_SECRET_V1
PRIVATE_BANK_DIGESTS_V1
ATTEMPT_ISSUANCE_ENABLED=false
LEGAL_PILOT_APPROVED=false
```

Пути `YANDEX_DISK_INVITES_FILE`, `YANDEX_DISK_ATTEMPT_SESSIONS_FILE`, `YANDEX_DISK_PRIVATE_BANKS_FOLDER` и `YANDEX_DISK_OPERATIONAL_BACKUPS_FOLDER` необязательны: при их отсутствии используются закрытые пути из схемы выше. Секреты и digest anchors создаются owner-bootstrap, их значения нельзя коммитить или показывать в диагностике.
