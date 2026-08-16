## Candidate career profile v2 — 16 August 2026

Личный кабинет кандидата расширен и опубликован на `account-v3` (`d4etah5u1d09fcmotvsq`); `assessment-v13` и остальные runtime остаются без изменений. Добавочная схема `015` хранит текущую и желаемую роль, краткий практический опыт/проекты, профессиональные инструменты и серверную дату подтверждения актуальности поиска. Старые аккаунты и результаты не переписывались.

Согласие аккаунта обновлено до `skillcheck-account-2026-08-16-v3`. Существующий участник может продолжать просматривать кабинет и проходить тесты без повторного подтверждения, но новые карьерные поля сохраняются только после явного принятия v3. Все сведения по умолчанию приватны.

Production-проверка подтвердила:

- `/v1/account` возвращает HTTP 200 и backend `yandex-candidate-profile-2026-08-16-1`;
- `account_registration_enabled=true`, `account_self_service_enabled=true`, `account_required_for_attempts=true` и `attempt_issuance_enabled=true`;
- `profile_publication_enabled=false`, `employer_workspace_enabled=false`, `employer_contact_enabled=false`;
- `candidate_profile_v2_schema=true`;
- публичная страница содержит карьерный блок и управление актуальностью;
- полный CI проходит 72/72 проверки.

Первый deployment остановился до миграции, потому что общий public-скрипт неявно переключил Gateway на ещё не созданный тег. Маршрут был сразу восстановлен на рабочий `account-v2`, а public deployment получил явный режим `-SkipGatewayUpdate`. Второй запуск остановился до схемы из-за кириллицы в пути YDB CLI; SQL перенесён во временный ASCII-путь. Третий запуск был отклонён до изменений схемы из-за смешения DDL/DML; запросы разделены. После успешной миграции квота тегов потребовала снять устаревший `account-v1`; версия `d4e77dd9rcsc8cjea6a9` не удалена и сохранена по ID. Финальный запуск создал и проверил `account-v3`.

Employer workspace, публикация профилей и раскрытие контактов не открывались. Следующий продуктовый блок — двусторонние приглашения работодателя и ответы кандидата за закрытыми gates; открывать его имеет смысл после появления реальных добровольных профилей и отдельной legal/privacy-сверки.

## Account-first production release — 10 August 2026

Candidate self-service is live. Active runtime tags are `assessment-v13` (`d4e2v5ldkbkinsqgot2u`) and `account-v2` (`d4epkq6evda8ojgmt6r5`); `admin-v10`, `employer-v1`, `read-v6` and `write-v8` remain unchanged. The public bucket contains exactly 22 allowlisted files and Candidate Build `2026.08.09.1`.
Full local CI passed 67/67 checks. A valid unauthenticated live `beginAttempt` request was denied with the neutral `attempt_unavailable` response, returned no attempt credentials and left active/reserved session count at zero.
A transient fail-closed account message captured during cutover exposed a one-shot frontend recovery gap. `account.html` now performs three bounded configuration retries and offers an enabled «Повторить проверку» action without requiring a page reload; the updated live file and all 22 public checks were verified again.


Production gates were verified as:

- `legal_pilot_approved=true`;
- `attempt_issuance_enabled=true`;
- `account_registration_enabled=true`;
- `account_self_service_enabled=true`;
- `account_required_for_attempts=true`;
- `profile_publication_enabled=false`;
- `employer_workspace_enabled=false`;
- `employer_contact_enabled=false`.

The first cutover attempt stopped fail closed because the ten-tag Cloud Functions quota was full. Only obsolete tags `read-v5` and `write-v7` were detached; their runtime versions were not deleted and remain available by IDs `d4e2ln4rrpabia9rqtg2` and `d4ej8qqg4j7a26fmr4iu`. The second attempt created both new runtimes and switched the API. An external 120-second command limit interrupted the parent process after the new runtime and public files were already live, so the 22-file SHA-256/CORS verification was rerun independently before the three candidate gates were opened atomically.

A candidate can now choose any of five tests, authenticate through Yandex ID and receive one new attempt per test every 21 days. A group link is optional cohort metadata, not an access credential. Employer search, profile publication and contact disclosure remain unavailable.

## Employer foundation production release — 9 August 2026

Stage 20A is deployed behind closed gates. Runtime tags and active version IDs are: `assessment-v12` (`d4emffs52denqnjl30dd`), `admin-v10` (`d4eovis5o4tkk016skoa`), `account-v1` (`d4e77dd9rcsc8cjea6a9`) and `employer-v1` (`d4esn3fvi5voknihjdhl`). The public Yandex bucket contains exactly 22 allowlisted files; live `employer.html` matches the local file by SHA-256.

Full CI passed 64/64 checks after the production cutover and runtime-credential rotation.

A Yandex CLI tag-removal command unexpectedly emitted the environment of an obsolete runtime during deployment. The three affected runtime credentials were treated as compromised and rotated. No active assessment sessions, candidate accounts or employer accounts existed. Issuance was closed during cutover and restored to `true` only after verification. The obsolete `assessment-v10` tag was released to satisfy the function-tag quota, while version `d4ear9l5kemg3e41gn9d` remains recoverable by ID.

Six issued group invitations were rehashed under the new credential. Their old bearer links no longer work; the administrator must use «Копировать ссылку» again before distributing them. Group descriptions, limits, usage counters and expiry were not deleted. Two completed assessment sessions/results remain unchanged.

Production verification confirms:

- `attempt_issuance_enabled=true`;
- `employer_workspace_enabled=false`;
- `employer_contact_enabled=false`;
- `profile_publication_enabled=false`;
- `/v1/employer` GET returns `employer-workspace-v1`, `enabled:false`, `contactEnabled:false`;
- unauthenticated employer search returns HTTP 401;
- assessment/admin/account/ranking/employer responses allow only the main Yandex origin;
- invalid invitation remains `attempt_unavailable` and creates no usable attempt;
- there are no mock candidates and no public contacts.

## Employer foundation — 9 August 2026

Stage 20A was first implemented locally and is now deployed behind the closed production gates recorded above. The first employer workspace uses the existing verified Yandex account as identity and adds a separate manually verified employer authorization. There is no open company registration.

The protected `/v1/employer` contour provides six financial role templates, explainable candidate ordering and persistent shortlists of 1–10 people. Experience is shown before assessments and contributes 45% of the comparison score; assessments contribute 35%; availability and matching conditions contribute 20%. The score only orders the shortlist and never makes an automatic hiring decision.

Only active `discoverable` candidate profiles with the current publication consent, an active/open job status and a current server-verified financial result can enter search. The response contains a derived talent ID, alias, experience band, region/work format, availability, verification level and assessment summaries. Internal profile IDs, result codes, raw answers, full reports, email and phone are not returned.

The production gates remain closed by default:

- `employer_workspace_enabled=false`;
- `employer_contact_enabled=false`;
- existing `profile_publication_enabled` is still required independently.

The public `employer.html` page has no mock candidates and shows an honest closed-pilot state until the runtime is deployed and a verified employer is explicitly admitted. Contact requests, notifications, chat and contact disclosure are not part of 20A.

## Group-link copy release — 3 August 2026

Admin Build `2026.08.03.2` and protected runtime `admin-v10` (`d4eta4npbkr8vonrcv82`) are live; `admin-v9` remains the immediate rollback. Every currently usable group-invitation row now has a «Копировать ссылку» button. The bearer code is re-derived only after an authenticated admin action, verified against the stored hash and never added to the group-list response or database. Revoked, expired and full links cannot be revealed.

The candidate runtime, v6 question banks, group limits, used-seat counters, gates and data model were not changed. Local and production checks cover exact-request validation, wrong-password denial, code-hash integrity, revoked-link denial, clipboard fallback and current Yandex-only routing.

Full CI passed 54/54 checks. Production verification confirmed exact SHA-256 parity for live `admin.html`, Build `2026.08.03.2`, the copy control and protected reveal action, active `admin-v10`, retained `admin-v9`, and no `inviteCode` disclosure on a wrong-password request.

## Pilot question analytics release — 3 August 2026

Admin Build `2026.08.03.1` and protected runtime `admin-v9` (`d4e65tmuhh5oa568jjkn`) are live; `admin-v8` remains the immediate rollback. Candidate Build `2026.08.02.1`, assessment `assessment-v11`, ranking `read-v6`/`write-v8`, active v6 banks and pilot gates were not changed.

The protected admin panel now aggregates current-bank item evidence already stored with each result: sample size, correct rate, timeout rate, unanswered rate and average client-reported time versus the limit. Known technical codes, technical rows, historical bank versions and unverified scores are excluded. The endpoint returns no candidate identity, contacts or individual selected/correct answers.

The UI labels fewer than 10 observations per question as insufficient, 10–19 as an initial signal and 20 or more as a stable pilot sample. Possible difficulty/time signals are review prompts only and never change questions, points, thresholds or candidate results automatically. No new database table, paid Yandex service or personal-data category was introduced; the aggregates inherit the existing 12-month result retention and deletion workflow.

Full CI passed 53/53 checks. Production verification confirmed active `admin-v9`, the new backend version, exact SHA-256 parity for live `admin.html`, mobile rules, no-cache HTML and wrong-password denial.

## Market-calibrated v6 release — 2 August 2026

Candidate Build `2026.08.02.1` and admin Build `2026.08.02.1` are live. Active runtime tags are `assessment-v11` (`d4e1hbljjctoa19a1iq0`), `admin-v8` (`d4ebpumfp2vje98gms08`), `read-v6` (`d4eofca9eo8t29nq5thb`) and `write-v8` (`d4ekl01h3tlr7693sf54`).

Five market-calibrated v6 banks are active in private Object Storage and YDB. All 240 answer meanings and option sets retain parity with the reviewed v5 release; 35 dense prompts were simplified. The distribution is now 62 easy, 88 medium, 55 calculation, 29 case and 6 hard questions. Hard questions contribute only 3.6–3.7% of available points and serve as a ranking differentiator rather than a junior-pass prerequisite.

The calibration is aligned with current junior vacancy skill patterns and established assessment-library scope without copying third-party questions. It is suitable for the controlled pilot as an AI-assisted internal assessment, not a psychometrically validated certification. The next content decision must use pilot item statistics after 10–30 completions per test.

Production cutover was performed with issuance temporarily paused. Only two terminal `completed` sessions existed; no active attempt was interrupted. Private artifact checksums, five YDB version pointers, 13/13 public object checksums, Yandex-only CORS and both runtime health endpoints passed, after which `attempt_issuance_enabled=true` was restored. Prior v5 objects and immediate runtime predecessors remain available for rollback.

## Group-link description editing release - 2 August 2026

Candidate Build `2026.07.31.5` and admin Build `2026.07.31.5` are live. Active runtime tags are `assessment-v10` (`d4ear9l5kemg3e41gn9d`), `admin-v7` (`d4e7aa90un3jfkkbqdra`), `read-v6` (`d4eofca9eo8t29nq5thb`), and `write-v8` (`d4ekl01h3tlr7693sf54`).

An administrator can now edit only the description of an existing group invitation. The dedicated API accepts exactly the operation ID, group ID and description; its YDB update touches only `purpose`, leaving the test, link code, limit, used seats, lifetime and state unchanged. The live frontend and admin route passed HTTPS health, CORS, wrong-password denial and exact-file checksum verification.

All 92 Markdown tables in the five current banks now render as semantic, mobile-scrollable HTML tables with escaped cell content. Group-link first start now retries the same idempotent request automatically, the cold path uses two fewer YDB reads, and the assessment runtime timeout is 30 seconds instead of 15 seconds.

Capped group invitations are live: one teacher-facing link atomically grants one personal attempt per unique normalized email, preserves the existing retake controls, and closes when its configured seat limit is reached. Five first-cohort links were issued with 30 seats each and zero initial claims; bearer links remain only in the ignored local operator record and are never committed to Git.


## Current release addendum — 31 July 2026

Five reviewed v5 banks replace v4 as the current content release: 240/240 questions reviewed, 80 improved (16 medium and 64 low findings), zero wrong keys or arithmetic defects found. Content status is PASS for a small controlled pilot under the limitations in `docs/QUESTION_BANK_REVIEW_V5.md`. This is an AI-assisted internal research review, not independent human SME certification.

Previous production baseline: candidate/admin Build `2026.07.31.3` with runtime tags `assessment-v8` and `admin-v5`. On 31 July 2026 the owner recorded the Roskomnadzor submission, approved UZ-4/type-3 threats, published the operator details and opened both pilot gates. Historical sections below document earlier releases and are not the current deployment baseline.
# SkillCheck — текущее состояние

## Решение по историческим smoke-данным от 26.07.2026

Владелец прекратил попытки удаления известных технических результатов. Сохранившиеся строки из утверждённого набора девяти кодов остаются технической историей, не входят в кандидатскую и пилотную аналитику и показываются в Admin Build 2026.07.28.1 только по явному переключателю. Полный контракт: docs/TECHNICAL_DATA_EXCLUSION.md. Production backend: yandex-disk-mvp-2026-07-27-23. Это решение не отменяет удаление по запросу реального кандидата.


Обновлено: 29 июля 2026 года.

## Текущий этап

- Этап 18 «Российский runtime и рейтинг MVP» завершён. С 31 июля 2026 года действует **LIMITED GO** для малой invite-only волны; независимый SME review остаётся условием масштабирования, но не блокером этой исследовательской когорты.
- Candidate Build `2026.07.31.1` опубликован по адресу `https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net/` и использует российский `/v1/assessment`. GitHub Pages сохранён как рабочий rollback; Apps Script — как legacy backend rollback, а не активный candidate write-path.
- Публичный bucket содержит ровно 13 разрешённых объектов общим объёмом 584 890 байт: семь HTML и шесть display-only JSON. Все живые объекты совпали с локальными по SHA-256; answer keys, private banks, отчёты и секреты не публикуются.
- Production browser-origin ограничен основным Yandex-сайтом; GitHub-origin больше не получает разрешение candidate API. Активны `assessment-v6` (`d4ev36locmu9lsjohtf0`), `admin-v3` (`d4etr5b695k94tmua9l3`), `read-v4` (`d4eophije7v42s47s0fp`) и `write-v6` (`d4e5hbn8pmd19vqn20pt`); Yandex-origin проверен на реальных GET/POST, GitHub-origin получает CORS-отказ, wildcard отсутствует.
- Локальный locked CI теперь выполняет 45 проверок: 40 test-файлов и 5 infrastructure validators. Пять production-банков содержат 240 вопросов без ошибок и предупреждений; шестой `dev-quick` остаётся закрытой технической fixture.
- IAM-only owner-smoke прошёл полный путь: invitation, session, private bank, 100% server-verified scoring, TXT read-back и точечная очистка. Финальная YDB-проверка: 0 invitations, 0 sessions, 0 results, 0 ranking profiles.
- Runtime gates подтверждены напрямую после отдельного двухшагового открытия: `legal_pilot_approved=true`, `attempt_issuance_enabled=true`, `retention_automation_enabled=true`. Неверное приглашение по-прежнему возвращает нейтральный `attempt_unavailable` без записи данных.
- Защищённая админка через `admin-v3` умеет результаты, отчёты, агрегаты, приглашения, replay-safe удаление и диагностику. Владелец ранее успешно вошёл с новым PBKDF2-паролем; пароль и секреты не попадают в Git или frontend.
- Пять закрытых банков v4 размещены в private Object Storage и зарегистрированы в YDB; отчёты и backups имеют утверждённые сроки хранения. Постоянных ключей, Lockbox, VM, CDN и платного домена нет.
- Рейтинг умеет отдельное opt-in согласие, псевдоним, version-aware публикацию, российскую proof-проверку результата через `assessment-v6`/YDB, хранение только hash management token, отзыв и TTL 365 дней. Публичная база пуста, mock-профилей нет.
- Девять известных legacy smoke-кодов остаются только в старом контуре по решению владельца и исключаются из обычной аналитики; попытки массового удаления не повторяются.
- Публичный контакт `skillcheck.project@yandex.ru` и 2FA подтверждены. В policy/consent опубликованы ФИО оператора и project email; вопрос адреса остаётся на внешнюю legal-проверку.
- Внешние письма и follow-up от имени владельца по-прежнему запрещены. Reviewer-пакеты и legal brief готовы, но не являются SME/legal sign-off.
- Финальный технический pre-pilot QA завершён: 13/13 файлов совпали на Yandex/GitHub, пять ranking reads и оба origin проверены, desktop/mobile просмотр основного Yandex URL подтверждён владельцем, gates закрыты. Остались только внешние SME/legal/owner решения. После них этап 19 — контролируемый пилот 10–30 завершений; этап 20 — публичный self-service и employer-функции.
## Репозиторий и публикация

- Ветка: `main`.
- Этапы 1–2 опубликованы в commit `a7c7f85`.
- Этап 3 опубликован в commit `12868e6`.
- Этап 4 опубликован в commit `1cd8498`.
- Этап 5 опубликован в commit `44e0de1`.
- Historical baseline этапа 10: candidate `Build 2026.07.20.8`, admin `Build 2026.07.20.6`, backend `yandex-disk-mvp-2026-07-20-7`, deployment `@49`, implementation commit `e251be3`.
- Production 10A: candidate `Build 2026.07.20.11`, admin `Build 2026.07.20.9`, backend `yandex-disk-mvp-2026-07-20-9`, deployment `@51`.
- Production stage 11: candidate `Build 2026.07.20.12`, admin `Build 2026.07.20.10`, backend `yandex-disk-mvp-2026-07-20-10`, deployment `@52`, API `attempt-v2`.
- Production stage 12: candidate `Build 2026.07.20.12`, admin `Build 2026.07.20.11`, backend `yandex-disk-mvp-2026-07-20-11`, deployment `@54`, API `attempt-v2`.
- Production stage 13: candidate `Build 2026.07.20.12`, admin `Build 2026.07.20.11`, backend `yandex-disk-mvp-2026-07-20-12`, deployment `@55`, API `attempt-v2`.
- Production stage 14: candidate `Build 2026.07.20.12`, admin `Build 2026.07.20.12`, backend `yandex-disk-mvp-2026-07-20-13`, deployment `@56`, API `attempt-v2`.
- Production bank rotation v4: candidate `Build 2026.07.21.13`, admin `Build 2026.07.21.13`, backend `yandex-disk-mvp-2026-07-21-14`, deployment `@57`, API `attempt-v2`.
- Production least-privilege storage: backend `yandex-disk-mvp-2026-07-23-15`, deployment `@61`, storage root `app:/skillcheck`, API `attempt-v2`.
- Web App URL не изменён.
- Implementation commit 10A: `2addd59`.

## Live health

На 23 июля 2026 года:

- `ok: true`;
- ответ содержит ровно четыре ключа: `ok`, `status`, `service`, `backendVersion`;
- `backendVersion: yandex-disk-mvp-2026-07-23-15`;
- endpoint не обращается к Яндекс Диску, не создаёт файлы и не раскрывает paths/properties/storage state.

## Завершено

- REST-интеграция Яндекс.Диска и создание папок.
- Исправление `409` для начального `[]` переводом строки.
- Сохранение passed/failed; TXT только для passed.
- Реальные `results.json` и `attempts.json`.
- Парольная админка и номер build.
- Поле Telegram, frontend/backend normalization, передача в успешный TXT.
- Этап 2 проверен live smoke `DEV-EZ3BY`: нормализованный Telegram есть только в TXT, UTF-8 корректен, служебные JSON персональных полей не содержат.
- Раздельные email/fingerprint hashes и 21-дневная retake-логика.
- Внутренняя retake-логика допускает повтор `dev-quick`, а админка скрывает его из обычной аналитики; публичные API для этого теста отключены по умолчанию на этапе 10.
- Полная автоматическая матрица retake: первый запуск, совпадения email/fingerprint, другой тест, bypass, истечение срока, `localStorage` и точная дата.
- Live smoke `FA-5DU43`: повтор `fa-junior` заблокирован, другой тест и `dev-quick` разрешены; TXT не создан.
- Полный аудит расчёта: выбор и shuffle, таймер, баллы, проценты, порог, штрафы, badge, рекомендации, Trust Score и Skill Card.
- Исправлена передача `penalty`, `rawScore` и `rawTotal`; успешный TXT синхронизирован с экранным результатом.
- Исправлена трактовка выбранного ответа при таймауте; пустой результат и диапазон 0–100 защищены.
- Live scoring smoke `DEV-B4ABJ`: raw 100%, штраф 3, итог 97, passed, TXT создан; health `ok:true`.
- Полный технический аудит 5 банков и 240 вопросов: после исправлений 0 ошибок и 0 предупреждений.
- В Financial Analyst добавлены стабильные ID `fa_001`–`fa_040` без изменения содержания.
- Блоки frontend синхронизированы с JSON; вес Skill Card рассчитывается по фактически выбранным баллам.
- Все 27 расчётных вопросов проверены; математические ошибки не обнаружены.
- Содержательные предложения зафиксированы в `docs/QUESTION_BANK_AUDIT.md`; вопросы автоматически не переписывались.
- Админ-пароль удалён из URL: данные загружаются только POST-запросом, старый GET-вход отклоняется.
- Backend и frontend выдают только псевдонимизированный административный контракт без имени, контактов, fingerprint/hash, правильных ответов, внутреннего пути и полного TXT.
- Реализованы поиск по коду, фильтры теста/статуса, сортировка, отдельное включение `dev-quick`, метрики и распределения.
- Таблица показывает дату, тест, итог, процент, статус, badge, уходы и только факт наличия TXT.
- Добавлены пустые состояния, понятная backend-ошибка, обновление, дата загрузки, frontend/backend version и безопасный выход.
- Desktop 1280 px и mobile 390 px проверены без горизонтального переполнения; на мобильном таблица преобразуется в карточки.
- Автотест `scripts/test-admin.js` и все предыдущие тесты проходят; live smoke подтверждает health, запрет GET и отказ неверному паролю без данных.
- Полный TXT теперь скачивается только из защищённой админки; один код результата не предоставляет доступ.
- Backend требует POST и админ-пароль, валидирует код, проверяет успешный результат и строит путь к отчёту самостоятельно.
- Отсутствующие и недоступные отчёты возвращают нейтральный ответ; внутренние пути и ошибки хранилища не раскрываются.
- Полный TXT не вставляется в DOM: создаётся локальная UTF-8 загрузка с безопасным именем `<CODE>.txt`.
- `scripts/test-report-access.js` и browser smoke покрывают защищённую выдачу, отказ неверному паролю и desktop/mobile интерфейс.
- Главная показывает точные 240 вопросов, фактическое число блоков и длительность, рассчитанную по таймерам банков.
- Форма кандидата получила явные labels, обязательные поля, понятные согласия, встроенные статусы и мобильную компоновку без `alert`.
- Загрузка банка и проверка повторной попытки имеют безопасные состояния и timeout; email и fingerprint больше не передаются в URL.
- Таймер отображается как `MM:SS`, прогресс доступен через ARIA, последний вопрос явно завершается, а гонка таймера и кнопки не создаёт второй ответ.
- Рассчитанный результат остаётся на экране при сетевой ошибке; доступна повторная отправка того же payload, двойной клик блокируется.
- Backend сохраняет `requestId` и при повторе возвращает тот же код без повторного результата; публичный ответ не содержит путей или внутренних флагов хранилища.
- Экран результата содержит код, статус сохранения и дисклеймер о том, что тест не заменяет собеседование.
- `scripts/test-candidate-ux.js`, вся прежняя тестовая матрица и browser-проверка пути кандидата на 1280/390 px проходят.
- Новые неподтверждённые результаты сохраняются только в `sessionStorage` текущей вкладки, не дольше attempt token и максимум 6 часов. Старые полные pending-копии удаляются из `localStorage`, а в нём остаётся только информационная дата завершения без ответов, контактов, fingerprint, invite и token.
- Временные сетевые/HTTP/backend-ошибки получают две ограниченные автоматические попытки с backoff; ручной retry и событие восстановления сети используют тот же payload и `requestId`.
- Backend сначала резервирует один код в private attempts, затем создаёт TXT, upsert-запись админки и завершает резервацию; частичный отказ продолжает ту же попытку.
- Резервация связана с hash payload и не содержит имени, email, Telegram или сырого fingerprint; изменённый payload с тем же `requestId` отклоняется.
- Коды проверяются одновременно по `results.json` и незавершённым резервациям; неоднозначные повторы не создают второй код или вторую строку.
- Frontend/backend логи содержат только этап, тип ошибки, номер попытки и последние 8 символов `requestId`, без payload и персональных данных.
- Privacy-страница и форма кандидата сообщают о резервной копии текущей вкладки максимум на 6 часов и о 30-минутном TTL незавершённого begin-запроса.
- `scripts/test-submission-reliability.js` покрывает TTL, восстановление, backoff, частичный сбой, resume, replay, конфликт payload и освобождение lock.

## Завершено на этапе 10 — historical baseline до 10A

- История Git проверена на высокодостоверные secrets: совпадений не найдено; `.clasp.json` игнорируется и содержит только `scriptId`, OAuth credentials в репозиторий не входят.
- Apps Script manifest оставляет минимальные scopes текущей архитектуры: external request и Script Properties.
- GET/JSONP удалены из чувствительных действий; POST принимает только известные `action`.
- Публичный health сокращён до минимального немутирующего liveness без путей, properties, folder listings и обращений к Яндекс Диску.
- Backend строго проверяет размер и схему payload, `testId`, версии, поля, диапазоны, ответы и сгенерированный TXT. Порядковые номера обязательны и уникальны; legacy `questionId` пока необязателен, его формат/уникальность проверяются только при наличии.
- Добавлены advisory rate limits через `CacheService`; это best-effort защита, а не атомарный IP-based gateway.
- Точный `nextDate` удалён из backend-ответа retake; остаются coarse `daysLeft`/reservation delay и признаки `allowed`/`foundPreviousAttempt`.
- `dev-quick` hard-disabled в публичных `checkAttempt`/`saveResult` по умолчанию через `PUBLIC_DEV_TEST_ENABLED=false`.
- Контекст вопроса санитизируется по allowlist, динамические значения экранируются, страницы получили CSP meta и `no-referrer`.
- TXT очищается от управляющих символов, pending PII переносится в `sessionStorage`.
- Backend, candidate UI и admin UI явно маркируют scoring как `client-reported-unverified`.
- Полные выводы: `docs/SECURITY_AUDIT.md`; архитектурная развилка: `docs/BACKEND_SCORING_DECISION.md`.

## Проверка этапа 10

- Полная матрица: 10/10 скриптов PASS.
- Аудит банков: 240 вопросов, 0 ошибок, 0 предупреждений.
- Existing deployment обновлён до `@49`, Web App URL не изменён; stale active deployments не обнаружены.
- GET `checkAttempt` возвращает `method_not_allowed`; неизвестный POST action — `unknown_action`.
- Публичный `dev-quick` отклонён как `test_not_public`.
- Неверный admin password отклоняется; шестой запрос в окне получил `rate_limited`.
- Реальный failed Financial Analyst сохранён с кодом `FA-X5P66`, `reportCreated:false`.
- Идентичный replay вернул тот же `FA-X5P66` и `replayed:true`, не создавая второй результат.
- Повторная попытка заблокирована с coarse `daysLeft`; точный `nextDate` отсутствует.
- Implementation commit: `e251be3`.

## Технически завершено на этапе 10A

- Public banks переведены на schema v2 и содержат только display-поля, opaque option IDs и `publicDigest`; `correct` и комментарии к ответу из текущей публикации удалены.
- Закрытые versioned private banks содержат authoritative answer key на Яндекс.Диске и проверяются по SHA-256 anchors из Script Properties.
- Администратор может создавать, безопасно повторять, просматривать и отзывать email/test-bound одноразовые приглашения.
- Invite bearer находится только во fragment `#invite=...`, никогда в query; candidate сразу переносит его в `sessionStorage` и очищает URL.
- `beginAttempt` проверяет приглашение и выдаёт точный ordered manifest, 6-часовой HMAC-signed token и server-side session.
- Публичный `checkAttempt` удалён; legacy/tokenless `saveResult` получает `client_upgrade_required`.
- Candidate отправляет только `questionId`, `optionId`, timeout и advisory telemetry; backend сверяет точный manifest и сам рассчитывает баллы/статус.
- Подтверждённый результат имеет связку `server-verified`, `authoritative-v1`, `attempt-v1`, ожидаемый test/bank/attempt; время и tab switches не влияют на балл.
- State machine `active → reserved → completed` обеспечивает single-use, exact replay, конфликт изменённого payload и repair после частичного commit.
- Сырые email, fingerprint, invite code и attempt token не сохраняются в invite/session JSON и технических логах.
- `ATTEMPT_ISSUANCE_ENABLED=false`; admin и candidate UI показывают pilot lock.
- Bootstrap читает legacy source только из полного commit `70e569cf267e043aabc780e81cc4307db7e149b1` и проверяет точные SHA-256 файлов; mismatch обрабатывается fail closed.
- Любой признак публикации private storage (`public_key`, `public_url`, `share`) блокирует bootstrap, issuance, invite, begin/save; publish/share endpoints не вызываются.
- Добавлены проверки public-bank secrecy, токенов, server scoring и recovery; полная матрица 14/14 скриптов и live browser QA на desktop/mobile прошли.

Техническая ротация v4 заменяет старые question/option ID, формулировки, варианты и ключи, поэтому раскрытые v3 answer keys не применимы к новой попытке. Включение приглашений для реальных кандидатов всё равно запрещено до независимого человеческого SME sign-off и внешнего checklist.

## Технически завершено на этапе 11

- Опубликованы factual policy `privacy.html`, отдельное согласие `consent.html` и инженерный review `docs/LEGAL_PRIVACY_REVIEW.md`.
- `attempt-v2` требует точную версию согласия и 18+ до создания сессии; backend фиксирует версию и серверное время и связывает их с signed token.
- Общая передача работодателю выключена в форме и отклоняется backend до отдельного согласия для конкретного получателя.
- Административная сводка корректно называется псевдонимизированной, а не полностью обезличенной.
- `LEGAL_PILOT_APPROVED=false` независимо блокирует включение issuance, выпуск приглашения и начало попытки; отключение legal approval принудительно закрывает issuance.
- Старый `attempt-v1` получает `client_upgrade_required`; корректный `attempt-v2` при закрытых gate возвращает нейтральный `attempt_unavailable`.
- Deployment `@52`, health `.10`, 15 локальных проверок и desktop/mobile QA подтверждены; Web App URL не изменён.

До реального пилота остаются внешние и пользовательские действия: реквизиты/статус/contact оператора, legal review уведомлений/локализации/трансграничности и утверждённый retention. Legal gate остаётся закрытым.

## Технически завершено на этапе 12

- Админка получила отдельный preview удаления по коду и явное подтверждение повторным вводом кода.
- `result_only` удаляет результат и TXT; `full_attempt` дополнительно удаляет связанные attempt/session/invite без затрагивания других записей.
- Backend требует свежий HMAC-подписанный preview состояния, serializes commit под `LockService` и строит storage paths только сам.
- Перед изменением создаётся закрытая транзакционная копия; после повторной проверки отсутствия primary-данных копия безвозвратно удаляется.
- Exact replay и editor-only recovery продолжают незавершённую операцию по тому же request ID после сбоя или закрытия браузера.
- Закрытый технический журнал не содержит контактов, ответов, отчёта, identity hashes, invite bearer или attempt token.
- Автоматический retention остаётся выключенным до утверждения оператором: `RETENTION_AUTOMATION_ENABLED=false`, конкретный срок не обещается.
- Deployment `@54`, health `.11`, 14/14 тестовых скриптов, 2 валидатора и desktop/mobile QA подтверждены; существующие production-данные не удалялись.

## Технически завершено на этапе 13

- Четыре изменяемых store защищены snapshot предыдущей валидной версии перед заменой: admin results, attempts, sessions и invites.
- Snapshot и active-файл валидируются как bounded JSON arrays, повторно читаются и сверяются по SHA-256.
- Ротация ограничена 12 версиями на store; identical write не создаёт копию.
- Повреждённый active-файл не перезаписывается обычной записью; editor-only restore сохраняет forensic artifact и работает только при закрытых pilot gates.
- Публичных backup/status/restore routes нет, private folders/files fail closed проверяются на публикацию/расшаривание.
- Удаление этапа 12 очищает связанные строки из operational backups и повторно проверяет их отсутствие.
- Production baseline и inventory для четырёх stores успешно выполнены из Apps Script editor без изменения primary JSON.
- Deployment `@55`, health `.12`, 15/15 тестовых скриптов и 2 валидатора подтверждены.

## Технически завершено на этапе 14

- Публичный health сохранил ровно четыре безопасных liveness-поля и не обращается к storage/configuration.
- Добавлен отдельный rate-limited POST `adminDiagnostics`, защищённый тем же админ-паролем и API version gate.
- В админке видны frontend/backend versions, backend time, Яндекс.Диск, gate-состояния и только признаки наличия allowlisted properties.
- Для results/attempts/sessions/invites показываются агрегированные state, size, row count, modified time и latest record time без строк данных и storage paths.
- Любая диагностическая ошибка преобразуется в allowlisted component/code/message; токены, пароль, salt, URL, коды результатов, IDs и персональные данные не возвращаются.
- Проверка read-only: не создаёт отсутствующие stores, не пишет snapshots, не запускает restore и не меняет pilot gates.
- Deployment `@56`, health `.13`, защищённый production status, 16/16 тестовых скриптов и 2 валидатора подтверждены.

## Завершено на этапе 15

- `npm test` является единым локальным/CI entrypoint и автоматически подхватывает все `scripts/test-*.js`.
- Добавлены отдельные проверки repository secrets, credential filenames, static/data links и синтаксиса `Code.gs`/Node/inline HTML JavaScript.
- Банки проходят оба существующих валидатора: 5 production-банков, 240 вопросов, 0 ошибок и 0 предупреждений.
- GitHub Actions запускается для push в `main`, pull request и вручную; устаревший run той же ветки отменяется.
- Workflow имеет только `contents: read`, Node 24, timeout 10 минут, locked `npm ci --ignore-scripts` и не использует production secrets/environments/deploy.
- Checkout/setup actions закреплены полными commit SHA; `persist-credentials:false` не оставляет workflow token в локальном Git config.
- Full history checkout нужен только для проверки legacy commit anchors; первый shallow run выявил эту зависимость и был исправлен без ослабления теста.
- CI configuration, operator docs, NO-GO readiness boundary, ротация v4, credential migration, сбалансированная выборка и TXT insights защищены regression-тестами; полная локальная матрица — 29/29 проверок.

## Этап 16 — эксплуатационная документация

- `docs/OPERATIONS.md` задаёт normal checks, уровни реакции S1–S3, stop conditions и безопасную передачу смены.
- `docs/DEPLOYMENT.md` описывает preflight, Pages, обновление существующего versioned Apps Script deployment без смены URL, post-deploy verification и rollback.
- `docs/PRIVACY_CHECKLIST.md` объединяет pilot blockers, правила приглашения/обработки, запрос субъекта, incident response и регулярный owner review.
- Runbooks связаны с backup, deletion, observability, testing и legal review; значения credentials/deployment ID в документацию не внесены.
- `test-operations-docs.js` блокирует исчезновение обязательных процедур и случайное появление live Web App ID в deployment runbook.

## Этап 17 — pilot readiness

- Live browser QA: главная, пять тестов, privacy, consent и admin проверены на desktop и mobile 390×844; horizontal overflow и console errors не обнаружены.
- Public negative smoke: health `.13`, GET begin `method_not_allowed`, legacy `client_upgrade_required`, unknown action `unknown_action`, `dev-quick` `test_not_public`.
- Apps Script owner diagnostics: `healthy`, четыре operational store, 9 result rows и 9 anti-retake rows.
- После диагностики создан свежий проверяемый snapshot четырёх operational store; production JSON вручную не менялся.
- В `docs/PILOT_READINESS.md` технические controls отделены от внешних блокеров; решение остаётся NO-GO.
- `test-pilot-readiness.js` фиксирует закрытые gates, незаполненные operator details и запрет документального открытия пилота.

## Техническая ротация банков v4

- Выпуск `rotation-v4-2026-07-21-r3` содержит 240 новых production-вопросов: FA 40, CA 80, FP&A 40, Accounting 40, BI 40.
- Authoring-source и private artifacts находятся вне Git; public JSON не содержат answer key или объяснений.
- Builder запрещает legacy ID/точные тексты/варианты, контролирует сходство, position/length side channels и воспроизводимо создаёт opaque option IDs.
- Private/public parity, digests и pending trust anchors проверяются повторной детерминированной сборкой.
- Public promoter заменяет пять файлов одной crash-safe транзакцией с journal, backup и commit marker; partial/corrupt сценарии покрыты тестами.
- Production legacy bootstrap навсегда отключён; он разрешён только для закрытого `dev-quick` fixture.
- Полная локальная матрица — 29/29; аудит — 240 вопросов, 0 ошибок, 0 предупреждений.
- Внутренний multi-review не является независимым человеческим SME sign-off. Полный evidence: `docs/QUESTION_BANK_ROTATION.md`.
- Закрытый SME workbook содержит пять role-вкладок, answer key, жёлтые поля вердикта/критичности/исправления, формульную сводку и 25 структурных checks; порядок безопасной передачи и acceptance criteria описан в `docs/SME_REVIEW_HANDOFF.md`.

## Оценка до финала roadmap

- Российский этап 18 завершён; осталось 2 продуктовых этапа: короткий пилот и публичный запуск.
- До первого кандидата остались короткий ручной visual QA и один QA/sign-off проход после внешних решений. До финального продукта осталось примерно 16–28 часов, 63–126 тыс. токенов и 1–3 календарные недели пилота.
- Рейтинг и российский runtime включены в готовый контур; платежи и сложный marketplace в оценку не входят.
- Повторная шлифовка неизменённых тестов и новые попытки удаления девяти smoke-результатов не планируются.
- Подробная разбивка и режимы: `docs/REMAINING_ESTIMATE.md`.

## Известные production smoke-данные

- Исторический успешный dev-quick report: `DEV-Z2VK8.txt`; публичный `dev-quick` теперь отключён.
- Исторический Telegram/UTF-8 smoke report: `DEV-EZ3BY.txt`.
- Исторический retake smoke: `FA-5DU43`; TXT не создавался.
- Исторический scoring smoke report: `DEV-B4ABJ.txt`.
- Историческая проверка надёжности отправки: failed `DEV-7S2N2`; повтор вернул тот же код с `replayed:true`, TXT не создавался.
- Security production smoke: failed `FA-X5P66`, `reportCreated:false`; идентичный replay вернул тот же код с `replayed:true`; retake заблокирован без точного `nextDate`.
- Production owner smoke 10A: `FA-LDUB2`, raw/final/percent `0`, failed, `server-verified`, `authoritative-v1`, `attempt-v1`, telemetry `client-reported-unverified`, `reportCreated:false`; exact replay вернул тот же код с `replayed:true`.
- После smoke issuance выключен; временный bridge удалён и возвращает `unknown_action`.
- В служебных JSON могут оставаться известные DEV- и FA-smoke записи; админка `2026.07.28.1` фильтрует весь набор девяти кодов, а не только dev-quick.
- Новые попытки массового удаления известных smoke-данных не выполнять; удаление по запросу реального кандидата остаётся отдельным защищённым workflow.

## Ограничения и риски MVP

- Текущие public banks больше не раскрывают `correct`, frontend не считает итог, а token-bound backend возвращает только server-verified authoritative result.
- Старые answer keys присутствуют в Git history/клонах/кэшах, но относятся к выведенным v3 банкам и не совпадают с новым v4 содержанием. Открытым остаётся внешний SME gate v4.
- LEGAL_PILOT_APPROVED и ATTEMPT_ISSUANCE_ENABLED остаются false; реальных кандидатов приглашать нельзя до operator/legal/retention/SME/owner checklist и проверки технического исключения.
- Controlled-pilot email enumeration закрыт удалением `checkAttempt` и email/test-bound invite flow. Для открытого потока всё ещё нужны OTP/auth, CAPTCHA и/или внешний gateway.
- Invite и fingerprint ограничивают повтор/доступ, но не подтверждают личность кандидата. Более сильная identity model требует OTP/magic link или аккаунт.
- Яндекс OAuth переведён на отдельное app-folder-only приложение; активный credential ограничен `app:/skillcheck`, а проверенный rotation/rollback runbook находится в `docs/YANDEX_CREDENTIAL_ROTATION.md`.
- Новые v4 банки прошли внутреннюю техническую вычитку, но независимый профильный эксперт ещё не подписал содержательную пригодность.
- Четыре банка содержат ровно 40 вопросов; полноценная ротация 40 из 80 есть только у Credit Analyst.
- Ручное удаление и application-level rotating backup/restore реализованы; TTL новой YDB-схемы и lifecycle приватного Object Storage применены. Независимой off-site копии пока нет.
- В `privacy.html` и `consent.html` опубликованы только ФИО и project email; статус НПД и регион убраны как избыточные, вопрос адреса остаётся на legal-проверку.
- Не приглашать реальных кандидатов до checklist этапа 17.

## Ручной шаг пользователя

Project email проверен владельцем, ФИО опубликовано только в policy/consent, а статус НПД и регион публично не раскрываются. Для завершения документов нужен утверждённый профильным специалистом полный публичный адрес оператора. Дополнительно нужны независимый SME sign-off и внешнее legal/retention решение. До этого оба pilot gate остаются закрытыми.
