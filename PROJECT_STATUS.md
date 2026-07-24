# SkillCheck — текущее состояние

Обновлено: 24 июля 2026 года.

## Текущий этап

- Технически завершены этап 17 и содержательная ротация пяти production-банков v4; решение для реальных кандидатов остаётся **NO-GO**.
- Создан отдельный публичный контакт проекта `skillcheck.project@yandex.ru` и внесён в privacy/consent; проверка входящего/исходящего письма ещё не зафиксирована, а ФИО/наименование и адрес оператора остаются legal-блокерами.
- Локально воспроизведены locked install и 27 проверок: 22 test-файла, 5 infrastructure validators, 240 production-вопросов без ошибок/предупреждений.
- Runtime: candidate `Build 2026.07.21.13`, admin `Build 2026.07.21.13`, backend `yandex-disk-mvp-2026-07-23-15`, deployment `@61`; workflow не имеет secrets и не выполняет deploy/storage calls.
- Следующее обязательное действие: независимый человеческий SME sign-off v4 и внешний pre-pilot checklist; для документальной/контентной части достаточно режима `высокий`, для production cleanup и gate cutover нужен `очень высокий`.
- Для внешнего review подготовлены master-книга на 240 вопросов и пять минимальных role-пакетов FA/CA/FPA/ACC/BI с отдельными checks; файлы хранятся вне Git, а `docs/SME_REVIEW_HANDOFF.md` предписывает передавать reviewer только банк его компетенции. Наличие workbook не считается sign-off.
- Вне Git подготовлен безбюджетный reviewer recruitment pack: минимальная команда по четырём компетенциям, воронка из 12+ персональных кандидатов, проверка опыта/независимости, безопасная двухшаговая передача, готовые сообщения FA/FPA/CA/ACC/BI и закрытый реестр контактов. Массовая рассылка и передача master-книги запрещены.
- Добавлен `docs/PRE_PILOT_INPUTS.md`: единый безопасный шаблон реквизитов оператора, legal/retention решения, SME verdict, точного smoke-cleanup scope и owner sign-off. Закрытая owner-копия с уже известными данными и явными пробелами создана вне Git; персональные данные не публикуются.
- `docs/LEGAL_PRIVACY_REVIEW.md` повторно сверен 23 июля 2026 года по официальным источникам: добавлен реестр evidence для отдельного согласия, уведомления, локализации/трансграничности, подтверждения уничтожения и границы обезличивания. Это не открывает legal gate и не заменяет внешнее заключение.
- Подготовлен `docs/PILOT_RUNBOOK.md`: первая волна ограничена 3–5 работодателями/рекрутерами, 10–30 завершениями и партиями до пяти приглашений; выбран L1 без заявления о подтверждённой личности, заданы метрики, feedback и stop conditions. Пилот не начат, gates закрыты.
- Зафиксирована продуктовая North Star в `docs/PRODUCT_VISION.md`: self-service кандидаты, opt-in профили, version-aware рейтинг по профессиям и employer shortlist. Это post-pilot направление, не изменение текущего controlled-pilot scope.
- Подготовлен `docs/EXTERNAL_REVIEW_BRIEF.md`: безопасные готовые задания и тексты обращения к независимому SME и legal/retention специалисту, точный scope, материалы, deliverables и acceptance criteria; ответы и подписи остаются вне Git.
- Владелец подтвердил пятибанковый scope MVP без сокращения до одного теста. `docs/FIVE_BANK_QUALITY_PLAN.md` задаёт повторный цикл Q1–Q4 для всех 240 вопросов после технического MVP: внутренняя вычитка, распределённый peer review, pilot feedback и versioned-исправления.
- Начат повторный Q1: Financial Analyst Junior проверен внутренне 40/40; неверных ключей/расчётов не найдено, 3 средних редакционных замечания и 1 низкоприоритетное усиление сохранены в закрытом отчёте вне Git. Production v4 не менялся, независимый SME review по-прежнему обязателен.
- Credit Analyst Junior также проверен внутренне 80/80: неверных ключей/расчётов не найдено, 2 средние доработки и 14 низкоприоритетных замечаний сохранены в отдельном закрытом отчёте. Суммарный Q1 progress — 120/240 (50%); production v4 не менялся.
- FP&A Junior проверен внутренне 40/40: неверных ключей/расчётов не найдено, 5 средних доработок калибровки/управляемости и 16 низкоприоритетных замечаний сохранены в отдельном закрытом отчёте. Суммарный Q1 progress — 160/240 (66,7%); production v4 не менялся.
- Accounting / Reporting Junior проверен внутренне 40/40: неверных ключей/расчётов не найдено, 3 средние доработки сложности/Excel-логики и 18 низкоприоритетных замечаний сохранены в отдельном закрытом отчёте. Суммарный Q1 progress — 200/240 (83,3%); production v4 не менялся.
- Finance BI / Data Analyst Junior проверен внутренне 40/40: неверных ключей/расчётов не найдено, 3 средние доработки freshness/hard-калибровки и 15 низкоприоритетных замечаний сохранены в отдельном закрытом отчёте. Внутренний Q1 всех пяти банков завершён 240/240 (100%); production v4 не менялся, независимый SME review остаётся обязательным.
- Вне Git подготовлен единый draft v5 change proposal: все 16 средних замечаний Q1 сверены с закрытыми отчётами и разделены на 8 уточнений условия/техники и 8 redesign hard/case. Ещё 64 низкоприоритетных замечания ждут SME triage; реализация и production-ротация не начаты.
- Зафиксирована post-MVP цель скрыть source repository и личную GitHub-атрибуцию без простоя сайта. `docs/SOURCE_PRIVACY_AND_ATTRIBUTION.md` разделяет приватность исходников, публичность браузерных artifacts и обязательные сведения оператора; немедленное переключение GitHub Free repository в private запрещено runbook из-за риска отключения Pages.
- Яндекс storage переведён на отдельное API-only OAuth-приложение с единственным `cloud_api:disk.app_folder`; активный root `app:/skillcheck`, выполнены checksum migration, write/read backup test и реальный rollback drill. Старое широкоправное приложение удалено, его токены отозваны, временные next/rollback credentials удалены из Script Properties после healthy owner-проверки.
- Этап 18 заблокирован до реквизитов оператора, внешнего legal/retention checklist, SME sign-off, очистки smoke-данных и owner sign-off.
- Полный план: `ROADMAP.md`.

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
- CI configuration, operator docs, NO-GO readiness boundary, ротация v4 и credential migration защищены regression-тестами; полная локальная матрица — 27/27 проверок.

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
- Полная локальная матрица — 27/27; аудит — 240 вопросов, 0 ошибок, 0 предупреждений.
- Внутренний multi-review не является независимым человеческим SME sign-off. Полный evidence: `docs/QUESTION_BANK_ROTATION.md`.
- Закрытый SME workbook содержит пять role-вкладок, answer key, жёлтые поля вердикта/критичности/исправления, формульную сводку и 25 структурных checks; порядок безопасной передачи и acceptance criteria описан в `docs/SME_REVIEW_HANDOFF.md`.

## Оценка до финала roadmap

- Осталось 3 плановых этапа (`18–20`): 20–40 часов, 110–240 тыс. токенов и 2–4 календарные недели пилота; этап 18 пока заблокирован.
- Оставшийся технический pre-pilot checklist после внешних решений: 3–8 часов, 20–60 тыс. токенов.
- До конца roadmap: суммарно 23–48 часов / 130–300 тыс. токенов + 2–4 недели пилота и внешнее время SME/legal/operator.
- Аккаунты/OTP/CAPTCHA, публичные профили/рейтинг, employer discovery, managed gateway и дополнительная server-side delivery для открытого запуска в эти диапазоны не включены.
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
- В служебных JSON есть dev-quick smoke-записи; админка их фильтрует.
- Удаление существующих smoke-данных выполнять только через preview этапа 12 и после отдельного осознанного подтверждения владельца.

## Ограничения и риски MVP

- Текущие public banks больше не раскрывают `correct`, frontend не считает итог, а token-bound backend возвращает только server-verified authoritative result.
- Старые answer keys присутствуют в Git history/клонах/кэшах, но относятся к выведенным v3 банкам и не совпадают с новым v4 содержанием. Открытым остаётся внешний SME gate v4.
- `LEGAL_PILOT_APPROVED` и `ATTEMPT_ISSUANCE_ENABLED` остаются `false`; реальных кандидатов приглашать нельзя до operator/legal/retention/SME/data-cleanup checklist.
- Controlled-pilot email enumeration закрыт удалением `checkAttempt` и email/test-bound invite flow. Для открытого потока всё ещё нужны OTP/auth, CAPTCHA и/или внешний gateway.
- Invite и fingerprint ограничивают повтор/доступ, но не подтверждают личность кандидата. Более сильная identity model требует OTP/magic link или аккаунт.
- Яндекс OAuth переведён на отдельное app-folder-only приложение; активный credential ограничен `app:/skillcheck`, а проверенный rotation/rollback runbook находится в `docs/YANDEX_CREDENTIAL_ROTATION.md`.
- Новые v4 банки прошли внутреннюю техническую вычитку, но независимый профильный эксперт ещё не подписал содержательную пригодность.
- Четыре банка содержат ровно 40 вопросов; полноценная ротация 40 из 80 есть только у Credit Analyst.
- Ручное удаление и application-level rotating backup/restore реализованы; нет независимой off-site копии и утверждённого автоматического retention.
- В `privacy.html` и `consent.html` внесён отдельный project email, но остаются явно выделенные заглушки ФИО/наименования и адреса оператора; legal gate не открывается до полного checklist.
- Не приглашать реальных кандидатов до checklist этапа 17.

## Ручной шаг пользователя

Project email создан и внесён в документы; владельцу остаётся проверить входящее/исходящее письмо. Для завершения документов нужны утверждённые публичные формулировки полного наименования/ФИО оператора, его статуса (физлицо/ИП/юрлицо) и адреса. Дополнительно нужны независимый SME sign-off и внешнее legal/retention решение. До этого оба pilot gate остаются закрытыми.
