## Актуальный статус 22.08.2026 — feedback и аналитика пилота в production

В production опубликованы 11 профессиональных направлений и 480 вопросов. Кандидат входит через Яндекс ID, выбирает тест самостоятельно, получает подтверждённый результат в личном кабинете и соблюдает единый 21-дневный лимит повторной попытки по каждому тесту.

Активные runtime: `assessment-v15`, `account-v6`, `admin-v13`, `employer-v4`, `read-v7`, `write-v9`. Добровольная обратная связь после результата и защищённая агрегированная аналитика пилота работают. Ровно 31 публичный файл опубликован на основном Yandex-origin, включая изолированное интерактивное демо на вымышленных данных. Выдача попыток и account-first self-service открыты; публикация профилей, employer workspace, приглашения, контакты, регалии и чат остаются закрытыми независимыми gates. Платные сервисы не подключались, старые runtime-версии сохранены.

## Исторический статус 31.07.2026 — банки v5

Усиленная внутренняя research-проверка всех 240 вопросов завершена: неверных ключей и арифметических ошибок не найдено, 16 средних и 64 малых методических замечания исправлены единым versioned-выпуском v5. Подробности: [`docs/QUESTION_BANK_REVIEW_V5.md`](docs/QUESTION_BANK_REVIEW_V5.md).

Содержание имеет статус **PASS для небольшого controlled pilot**, но не является независимым человеческим SME-заключением, официальной сертификацией или единственным основанием кадрового решения. Candidate/admin Build `2026.07.31.3` и runtime `assessment-v8` / `admin-v5` / `read-v6` / `write-v8` опубликованы в Yandex Cloud. С 31 июля 2026 года действует LIMITED GO для 10–30 прохождений только по персональным приглашениям; последующая психометрическая калибровка выполняется по результатам этой волны.

# SkillCheck

SkillCheck — MVP assessment-platform для первичного отбора junior-кандидатов и техническое ядро будущей платформы рейтинга специалистов и поиска талантов работодателями.

Сайт проверяет прикладные знания по 11 направлениям: финансам и аналитике, туризму, разработке ПО, управлению продуктами и проектами, продажам, логистике и закупкам, digital-маркетингу.

Постоянный план развития находится в [`ROADMAP.md`](ROADMAP.md), актуальное состояние — в [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

Долгосрочная North Star: специалисты самостоятельно проходят тесты, по своему выбору формируют видимый профиль и участвуют в рейтинге по профессии; работодатели получают объяснимый shortlist или проверяют собственных кандидатов. Российский технический MVP уже работает через YDB Serverless, Cloud Functions, API Gateway и Object Storage. Candidate account и первый employer discovery/shortlist-контур опубликованы; employer workspace, публикация расширенных профилей и контакты остаются закрытыми серверными gates. Границы зафиксированы в [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) и [`docs/EMPLOYER_FOUNDATION.md`](docs/EMPLOYER_FOUNDATION.md).

## Текущий статус

С 22 августа 2026 года candidate-поток работает на `assessment-v15`, account — на `account-v6`, защищённая админ-аналитика — на `admin-v13`. Кандидат выбирает любой из 11 тестов, входит через Яндекс ID, попадает в личный кабинет и получает одну новую попытку по каждому тесту раз в 21 день. В приватном карьерном профиле доступны текущая и желаемая роль, опыт/проекты, инструменты и подтверждение актуальности поиска. Ровно 31 публичный файл опубликован на основном Yandex-origin, включая изолированное демо без API и хранилища. GitHub-origin не получает candidate API. Локальный CI с предпросмотром карточки кандидата выполняет 86 проверок; текущий production-выпуск прошёл 85.

В production опубликованы добровольная оценка понятности и сложности после подтверждённого результата, один обновляемый отзыв на попытку, хранение не более 365 дней и защищённая админ-сводка пилотной воронки без имени, email, контактов, profile/attempt ID и кодов результата. Выдача попыток и account-first self-service открыты; публикация профилей, employer workspace, приглашения, контакты, регалии и чат остаются закрытыми независимыми gates.

`LEGAL_PILOT_APPROVED`, `ATTEMPT_ISSUANCE_ENABLED`, регистрация и account-first self-service открыты отдельными действиями после публикации реквизитов оператора, направления уведомления Роскомнадзору, утверждения УЗ-4/угроз типа 3 и owner sign-off. Независимый человеческий SME review рекомендуется до масштабирования и сильных публичных заявлений, но не блокирует текущий исследовательский пилот.

Официальная инженерная legal/privacy-сверка обновлена 23 июля 2026 года: уведомление об обработке, локализация/трансграничность, форма подтверждения уничтожения и квалификация обезличивания вынесены в явный внешний checklist. Наличие технических controls не считается юридическим одобрением.

Рабочая версия включает:

- выбор теста на `index.html`;
- изолированное `demo.html`: интерактивный путь кандидата и работодателя на явно вымышленных данных, без API, браузерного хранилища и влияния на рейтинг;
- подтверждённый аккаунт кандидата на `account.html` с тестами, результатами, текущей/желаемой ролью, опытом и проектами, инструментами, регионом, форматом работы и актуальностью поиска;
- подготовленный `employer.html`: типовые роли, фильтры, объяснимое сравнение и постоянный shortlist 1–10 без контактов и mock-кандидатов;
- отдельную публичную страницу `ranking.html` с выбором одного из 11 направлений, live Yandex API, безопасным состоянием набора участников и без вымышленных профилей;
- серверное ядро рейтинга: отдельный opt-in, подтверждение результата через YDB assessment proof, раздельные read/write-права, отзыв по локальному management token, TTL 365 дней, минимум пять участников и строгий список публичных полей;
- прохождение теста на `test.html?test=<testId>`;
- загрузку display-only банка вопросов из `data/*.json` без `correct`, комментариев к ответу и клиентского scoring;
- проверку целостности public bank по `publicDigest`;
- выдачу сервером точного набора из 40 вопросов после проверки аккаунта и атомарного слота попытки;
- сохранение серверного порядка вопросов и криптографическое перемешивание вариантов ответа в браузере;
- таймер на каждый вопрос;
- фиксацию уходов со вкладки;
- необязательные групповые ссылки для атрибуции вуза, преподавателя или потока без права обхода аккаунта и 21-дневного лимита;
- передачу bearer-кода групповой ссылки только во fragment `#invite=...`: код не попадает в query, fragment сразу забирается в `sessionStorage` и удаляется из адресной строки;
- серверную attempt-сессию со статусами `active → reserved → completed` и идемпотентным восстановлением;
- анти-повтор через закрытые identity hashes на backend;
- отдельное согласие на обработку персональных данных версии `skillcheck-pd-consent-2026-08-21-v6`, связанное с attempt token/session и серверным временем;
- обязательное подтверждение 18+ перед стартом;
- hard-disabled передачу результата работодателю до отдельного согласия для конкретного получателя;
- обязательные поля источника кандидата и опыта;
- необязательный Telegram для быстрой обратной связи, сохраняемый только в успешном TXT;
- авторитетный пересчёт баллов и статуса на backend по закрытому банку с маркировкой `server-verified` / `authoritative-v1`;
- хранение времени и уходов со вкладки только как `client-reported-unverified` telemetry без штрафа к баллу;
- выдачу случайного кода результата после сохранения;
- резервную копию неподтверждённого результата в `sessionStorage` текущей вкладки и восстановление после перезагрузки этой вкладки;
- ограниченный автоматический retry и безопасную повторную отправку с `requestId`, не создающую второй код;
- отправку результата в Yandex Cloud Function `/v1/assessment`;
- хранение результатов в YDB и отчётов в закрытом Yandex Object Storage без открытых контактов;
- административный preview и подтверждаемое удаление результата либо всей связанной попытки с crash recovery;
- добровольный отзыв после подтверждённого результата без влияния на балл и рейтинг; свободный комментарий не должен содержать персональные данные;
- защищённую агрегированную воронку пилота и псевдонимизированные последние отзывы в админке;
- до 12 закрытых проверяемых версий каждого operational store и editor-only восстановление при закрытых pilot gates;
- минимальные немутирующие health endpoints для assessment, admin и ranking в Yandex API Gateway.
- защищённую POST-диагностику в админке с версиями, временем backend, storage state, размерами/row counts и санитизированной ошибкой.

Телефон в MVP не собирается. Приглашение связывается с email и тестом, а серверная сессия — с закрытыми hash email/fingerprint. Сырые email, fingerprint, invite code и attempt token в invite/session JSON и технических логах не хранятся. Это controlled-pilot access, но не полное подтверждение личности: для более сильной идентификации всё ещё нужны OTP/magic link или аккаунт.

Незавершённый begin-запрос хранится в `sessionStorage` не более 30 минут, а pending submission — не дольше срока attempt-токена и максимум 6 часов. Новые полные pending-копии в постоянное хранилище не записываются.

Результат тестирования является предварительной оценкой отдельных навыков и не является самостоятельным решением о найме или профессиональной пригодности.

Важно: public JSON не содержат правильных ответов, а frontend не считает итог. Прежние v3 ключи остаются в истории Git/клонах/кэшах, но выпуск v4 полностью заменяет их новыми ID, формулировками, вариантами и ключами. Технический evidence описан в [`docs/QUESTION_BANK_ROTATION.md`](docs/QUESTION_BANK_ROTATION.md), архитектура scoring — в [`docs/BACKEND_SCORING_DECISION.md`](docs/BACKEND_SCORING_DECISION.md). До реального пилота всё ещё нужен независимый человеческий SME sign-off v4.

## Тесты

| Тест | Статус | Банк вопросов |
|---|---|---|
| Financial Analyst Junior | Опубликован; account-first доступ открыт | `data/fa-junior.json` |
| Credit Analyst Junior | Опубликован; сервер выбирает 40 из 80 | `data/ca-junior.json` |
| FP&A / Budget Analyst Junior | Опубликован; account-first доступ открыт | `data/fpa-junior.json` |
| Accounting / Reporting Junior | Опубликован; account-first доступ открыт | `data/acc-junior.json` |
| Finance BI / Data Analyst Junior | Опубликован; account-first доступ открыт | `data/bi-junior.json` |
| Tourism & Hospitality Operations Junior | Опубликован; account-first доступ открыт | `data/tourism-junior.json` |
| Software Development Junior | Опубликован; account-first доступ открыт | `data/software-junior.json` |
| Product / Project Management Junior | Опубликован; account-first доступ открыт | `data/product-project-junior.json` |
| Sales / Business Development Junior | Опубликован; account-first доступ открыт | `data/sales-junior.json` |
| Logistics / Procurement Junior | Опубликован; account-first доступ открыт | `data/logistics-procurement-junior.json` |
| Digital Marketing Junior | Опубликован; account-first доступ открыт | `data/digital-marketing-junior.json` |

## Основные файлы

```text
index.html              Главная страница и карточки тестов
test.html               Движок прохождения теста
privacy.html            Политика обработки персональных данных
consent.html            Отдельное versioned-согласие на обработку данных
admin.html              Псевдонимизированная админ-панель по кодам
ranking.html            Публичная страница добровольного рейтинга
account.html            Подтверждённый аккаунт кандидата и настройки профиля
employer.html           Закрытый employer workspace и shortlists 1–10
cloud/*.js              Ядро, YDB store и handler действующей Yandex Cloud Function
data/*.json             Display-only банки без answer key
apps-script/Code.gs     Google Apps Script API для Яндекс Диска
docs/QA_REVIEW.md       QA-аудит банков вопросов
docs/QUESTION_BANK_AUDIT.md Полный технический и содержательный аудит банков
docs/SCORING_AUDIT.md  Аудит расчёта результатов
docs/SECURITY_AUDIT.md Security-аудит и остаточные риски
docs/BACKEND_SCORING_DECISION.md Решение по авторитетному расчёту
docs/LEGAL_PRIVACY_REVIEW.md Инженерный legal/privacy review и owner checklist
docs/DATA_DELETION.md  Механизм удаления, crash recovery и retention boundary
- Решение о сохранении и исключении известных smoke-кодов: docs/TECHNICAL_DATA_EXCLUSION.md.
docs/BACKUP_AND_RECOVERY.md Проверяемые snapshots, ротация и restore runbook
docs/OBSERVABILITY.md Защищённый status contract и operator runbook
docs/TESTING.md       Единая CI-матрица, безопасный workflow и добавление тестов
docs/OPERATIONS.md    Главная точка входа для эксплуатации и реакции на инциденты
docs/DEPLOYMENT.md    Безопасная публикация Apps Script/Pages и rollback без смены URL
docs/PRIVACY_CHECKLIST.md Privacy checklist оператора и stop conditions пилота
docs/PILOT_READINESS.md Техническое evidence, NO-GO блокеры и порядок первого пилота
docs/PRE_PILOT_INPUTS.md Безопасный шаблон входных решений SME/operator/legal/cleanup/owner
docs/PILOT_RUNBOOK.md    Допуск, метрики, feedback и stop conditions первой волны
docs/PRODUCT_VISION.md   North Star кандидатов, рейтинга и employer discovery
docs/OWNER_ACTIONS.md     Три оставшихся действия владельца до первого пилота
docs/EXTERNAL_REVIEW_BRIEF.md Готовые задания независимому SME и legal/retention специалисту
docs/FIVE_BANK_QUALITY_PLAN.md Повторная проверка качества всех пяти банков после MVP
docs/SOURCE_PRIVACY_AND_ATTRIBUTION.md План private-репозитория, нейтрального домена и границы защиты от копирования
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
10. Перед публичным запуском утвердить полный публичный адрес оператора и завершить legal/retention checklist; ФИО и контакт уже опубликованы; статус НПД и регион намеренно не раскрываются.
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
