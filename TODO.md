# TODO.md

## Главная цель

Довести SkillCheck до стабильного MVP: 5 рабочих junior-тестов, корректная случайная выборка вопросов, понятные отчёты для работодателя и проверенная отправка результатов.

## Сейчас сделано

- [x] Дизайн главной страницы.
- [x] Выбор тестов на сайте.
- [x] Прохождение теста по одному вопросу.
- [x] Таймер на каждый вопрос.
- [x] Перемешивание вопросов.
- [x] Перемешивание вариантов ответа.
- [x] Пересчёт правильного ответа после перемешивания.
- [x] Случайная выборка до 40 вопросов из банка.
- [x] Запрет копирования и контекстного меню.
- [x] Детект ухода со вкладки.
- [x] TXT-отчёт для успешных результатов через backend.
- [x] Google Apps Script API без Google Sheets и Google Drive.
- [x] Хранение на Яндекс Диске: reports, admin/results.json, private/attempts.json.
- [x] Анти-повтор через hash попытки в `attempts.json`.
- [x] localStorage-lock на тот же тест в текущем браузере.
- [x] Убран сбор телефона из формы и новых результатов.
- [x] Добавлены `privacy.html` и обязательное согласие перед стартом.
- [x] Поля `Источник кандидата` и `Опыт`.
- [x] Candidate Summary в TXT-отчёте.
- [x] Первичный QA-аудит банков в `docs/QA_REVIEW.md`.
- [x] Security-аудит этапа 10 и решение по backend-scoring задокументированы.
- [x] Подготовлены POST-only API, строгая backend-валидация, минимальный health, advisory rate limits, XSS/TXT-санитизация и CSP meta.
- [x] Pending submission хранится только в `sessionStorage`, не дольше attempt token и максимум 6 часов; legacy full-payload копии удаляются из `localStorage`, scoring выполняется backend и помечается `server-verified` / `authoritative-v1`.
- [x] Технически реализован этап 10A: display-only public banks, закрытые versioned private banks, email/test-bound invitations, signed single-use attempt и authoritative backend-scoring.
- [x] `checkAttempt` и tokenless legacy-save удалены из кандидатского потока; результат считается только сервером и маркируется `server-verified` / `authoritative-v1`.
- [x] Этап 11 технически завершён: отдельное versioned-согласие, factual privacy policy, запрет общей передачи работодателю и независимый fail-closed legal gate опубликованы в `@52`.
- [x] Этап 12 технически завершён: preview, подтверждаемое result/full-attempt удаление, транзакционная копия, verification, purge, crash recovery и закрытый журнал опубликованы в `@54`.
- [x] Этап 13 технически завершён: verified snapshots четырёх stores, rotation 12, fail-closed write, editor-only restore, corrupt artifacts и deletion redaction опубликованы в `@55`; production baseline создан.
- [x] Этап 14 технически завершён: защищённая read-only диагностика, storage aggregates, configuration presence и allowlisted errors опубликованы в `@56`; публичный health остался минимальным.
- [x] Этап 15 завершён: dependency-free `npm test`, secret/link/syntax validators и read-only GitHub Actions CI; локально 27/27 проверок.
- [x] Этап 16 завершён: operator guide, deployment/rollback runbook, privacy checklist и regression-проверка эксплуатационной документации.
- [x] Этап 17 технически завершён: live desktop/mobile, public smoke, owner diagnostics, свежий snapshot и NO-GO readiness report с точными блокерами.

## До запуска кандидатов

- [x] Настроить Script Properties: `YANDEX_DISK_TOKEN`, `YANDEX_DISK_REPORTS_FOLDER`, `YANDEX_DISK_ADMIN_FILE`, `YANDEX_DISK_ATTEMPTS_FILE`, `ATTEMPT_HASH_SALT`, `ADMIN_PASSWORD`.
- [x] После полной локальной матрицы обновить существующий Apps Script deployment этапа 10 до `@49` без смены URL.
- [x] Открыть `<WEB_APP_URL>?action=health`: ровно `ok/status/service/backendVersion`, backend `yandex-disk-mvp-2026-07-20-7`.
- [x] Проверить, что `health` не выводит token/password/salt, пути, properties, folder listings и состояние JSON, не обращается к storage и ничего не создаёт.
- [x] Сверить список Apps Script deployments: кроме HEAD и текущего стабильного deployment устаревших активных deployments не обнаружено.
- [x] Hard-disable публичный `dev-quick` по умолчанию (`PUBLIC_DEV_TEST_ENABLED=false`, `test_not_public`).
- [x] Реализовать authoritative backend-scoring, обязательные `questionId`/`optionId`, single-use signed attempt/invite и best-effort abuse limits.
- [x] Убрать публичный email-enumeration lookup из controlled-pilot потока: попытка начинается только по email/test-bound invite.
- [x] Завершить production rollout 10A в существующий deployment `@51` без смены URL; implementation commit `2addd59`, owner smoke `FA-LDUB2`, 14/14 suite и desktop/mobile browser QA подтверждены.
- [x] Выполнить техническую содержательную ротацию пяти банков: 240 новых вопросов/вариантов/ключей/ID, private/public v4 и fail-closed atomic cutover.
- [x] Подготовить закрытую Excel-книгу для независимого SME review: 240 вопросов, ключи, dropdown-вердикты, формульная сводка, структурные проверки и `docs/SME_REVIEW_HANDOFF.md`; файл не хранить в Git.
- [x] Разделить master SME-книгу на пять закрытых role-пакетов FA/CA/FPA/ACC/BI, проверить формулы/рендер и зафиксировать SHA-256 вне Git для минимального раскрытия ключей добровольным reviewers.
- [x] Подготовить закрытый no-budget recruitment pack: целевые компетенции, воронка 12+ reviewers, проверка независимости, role-specific сообщения, follow-up и реестр передачи файлов/hash.
- [x] Подготовить `docs/PRE_PILOT_INPUTS.md` для безопасного сбора operator/legal/SME/cleanup/owner решений без секретов и закрытых заключений в Git.
- [x] Подготовить `docs/EXTERNAL_REVIEW_BRIEF.md` с готовыми заданиями, сообщениями, scope и acceptance criteria для независимого SME и legal/retention специалиста.
- [x] Подтвердить owner-решение сохранить все пять финансовых тестов в MVP и не сокращать продукт до одного банка.
- [x] Подготовить `docs/FIVE_BANK_QUALITY_PLAN.md` для повторной проверки всех 240 вопросов после технического MVP.
- [x] Выполнить внутренний Q1 review Financial Analyst Junior: 40/40; детали сохранить в отдельной закрытой книге без изменения v4 и без подмены SME sign-off.
- [x] Выполнить внутренний Q1 review Credit Analyst Junior: 80/80; детали сохранить в отдельной закрытой книге, слабые distractors и policy-dependent расчёты отложить до общей versioned-ротации.
- [x] Выполнить внутренний Q1 review FP&A Junior: 40/40; детали сохранить в отдельной закрытой книге, hard-калибровку, distractors и action/trigger формулировки отложить до общей versioned-ротации.
- [x] Выполнить внутренний Q1 review Accounting / Reporting Junior: 40/40; детали сохранить в отдельной закрытой книге, hard-калибровку, рамку учёта и Excel-логику отложить до общей versioned-ротации.
- [x] Выполнить внутренний Q1 review Finance BI / Data Analyst Junior: 40/40; детали сохранить в отдельной закрытой книге, freshness, RLS/KPI hard-cases и distractors отложить до общей versioned-ротации.
- [x] Свести 16 средних Q1-замечаний в единый закрытый draft v5 proposal: 8 уточнений условия/техники и 8 redesign hard/case; production v4 не менять до SME/owner решения.
- [ ] Получить независимый человеческий SME review и sign-off банков v4; внутренний review не считать внешней экспертной приёмкой.
- [ ] Оставлять `ATTEMPT_ISSUANCE_ENABLED=false` до завершения ротации и pilot checklist.
- [ ] Для открытого публичного потока выбрать OTP/auth, CAPTCHA и/или внешний gateway.
- [x] Зафиксировать для первой контролируемой волны L1: непубличное персональное приглашение без подтверждения юридической личности; retake/fingerprint — deterrence, а не identity verification. При необходимости OTP/account/KYC требуется отдельный проект.
- [x] Подготовить `docs/PILOT_RUNBOOK.md`: допуск, роли, малые партии, метрики, feedback, ежедневная сверка и stop conditions без открытия production gates.
- [x] Проверить scope Яндекс OAuth, создать отдельное app-folder-only приложение, выполнить checksum migration, write/read backup, реальный rollback drill и повторный production cutover (`@61`).
- [x] Удалить старое широкоправное OAuth-приложение и временные next/rollback credentials после healthy owner-проверки.
- [ ] Для открытого/adversarial пилота решить, требуется ли backend question delivery.
- [ ] Указать полное наименование/ФИО, статус и адрес оператора в `privacy.html` и `consent.html`.
- [ ] Указать реальный email для запросов по персональным данным в обоих документах.
- [ ] Проверить необходимость уведомления Роскомнадзора перед масштабированием.
- [ ] Оценить вопрос хранения данных российских пользователей на Яндекс Диске.
- [x] Выключить общую передачу работодателю на frontend/backend.
- [ ] Подготовить отдельное согласие для конкретного получателя, если проект начнёт передавать результаты компании.
- [x] Подготовить технический регламент удаления данных по коду в `docs/DATA_DELETION.md`.
- [ ] Оператору с профильным специалистом утвердить legal-регламент, сроки, legal hold и форму подтверждения уничтожения.
- [x] Проверить, что `app:/skillcheck/admin/results.json` существует и читается.
- [x] Проверить, что `app:/skillcheck/private/attempts.json` существует и читается.
- [x] Пройти `dev-quick` и проверить запись результата, admin JSON, TXT-условие и код.
- [x] Проверить `checkAttempt` через `attempts.json` и POST.
- [x] Проверить, что успешный результат создаёт `app:/skillcheck/reports/<code>.txt`.
- [x] Проверить, что неуспешный результат не создаёт TXT-отчёт.
- [x] Проверить, что `admin.html` показывает только псевдонимизированные коды без открытых контактов.
- [x] Проверить, что `admin.html` запрашивает пароль через `action=adminResults` и не содержит моковых кандидатов.
- [x] Проверить localStorage retake-lock до серверного запроса и отсутствие fingerprint в нём.
- [x] Проверить, что разные тесты можно проходить в один день.
- [x] Проверить отправку результата из `test.html` в Apps Script.
- [x] Прогнать `scripts/test-security.js` и полную прежнюю тестовую матрицу: 10/10 PASS; 240 вопросов, 0 ошибок, 0 предупреждений.
- [x] Выполнить production smoke: minimal health, GET `method_not_allowed`, `unknown_action`, `dev-quick` → `test_not_public`, шестой неверный admin password → `rate_limited`.
- [x] Проверить реальное сохранение/replay/retake: failed `FA-X5P66`, `reportCreated:false`, тот же код при replay с `replayed:true`, coarse `daysLeft` без `nextDate`.
- [ ] Пройти `fa-junior` локально и на GitHub Pages.
- [ ] Пройти `ca-junior` локально и на GitHub Pages.
- [ ] Пройти `fpa-junior` локально и на GitHub Pages.
- [ ] Пройти `acc-junior` локально и на GitHub Pages.
- [ ] Пройти `bi-junior` локально и на GitHub Pages.
- [ ] Дать пройти рабочие тесты 3-5 знакомым.
- [x] По Q1 `FIVE_BANK_QUALITY_PLAN.md` найти слишком лёгкие, перегруженные и неоднозначные вопросы во всех пяти банках; 240/240 проверены, решения сохранены в пяти закрытых книгах.
- [ ] По Q3 после первых прохождений проверить вопросы, где кандидаты часто выбирают один и тот же неправильный вариант.

## Credit Analyst Junior

- [x] Проверить, что в `data/ca-junior.json` 80 вопросов.
- [x] Проверить обязательные поля вопросов.
- [x] Включить выбор случайных 40 вопросов из банка.
- [x] Переписать вопросы, где правильный ответ слишком часто самый длинный.
- [x] Проверить, что правильный ответ является самым длинным не чаще чем у 25% вопросов.
- [ ] Добавить больше вопросов по залогам и red flags.
- [ ] Добавить больше кейсов с таблицами.
- [ ] Проверить тайминги сложных вопросов.

## Следующий этап

Техническая ротация пяти банков v4 и app-folder-only ротация Яндекс credential завершены, а закрытый Excel-пакет и `docs/SME_REVIEW_HANDOFF.md` готовы к передаче эксперту; решение для реальных кандидатов остаётся `NO-GO`. Следующее действие — независимый человеческий SME sign-off вместе с operator/legal/data-cleanup checklist. Для документального/контентного этапа достаточно режима `высокий`; для удаления production smoke и gate cutover снова нужен `очень высокий`. Полная матрица находится в `docs/PILOT_READINESS.md`.

## Post-pilot North Star — не начинать до этапа 20

- [x] Зафиксировать конечную идею: self-service специалисты, opt-in профиль/рейтинг по профессии и employer shortlist.
- [x] Зафиксировать цель закрыть source repository и убрать личный GitHub username из основного URL без обещания невозможности копирования публичного frontend.
- [ ] Выбрать вариант миграции из `SOURCE_PRIVACY_AND_ATTRIBUTION.md`: GitHub Pro/private Pages, private source + public build или отдельный hosting.
- [ ] Подключить нейтральный домен и проверить новый контур до перевода текущего repository в private.
- [ ] Для снижения массового копирования спроектировать per-attempt backend delivery вместо публикации полных display-банков.
- [ ] По данным пилота выбрать account/OTP и visibility/consent model.
- [ ] Спроектировать version-aware ranking без сравнения несопоставимых банков и ложной точности малой выборки.
- [ ] Спроектировать employer search, shortlist и consent-based contact flow без массовой выдачи контактов.
- [ ] Проверить outcome feedback и спрос до выбора монетизации.
- [ ] После пилота подготовить маркетинговую стратегию: аудитории, позиционирование, каналы привлечения, доверие работодателей и измеримые acquisition/activation метрики.
- [ ] Сформировать shortlist названий и проверить домены, поисковые совпадения, соцсети и официальные реестры товарных знаков; доступность названия не считать подтверждённой без актуального поиска и профильной проверки.

## Financial Analyst Junior

- [x] Проверить совместимость с random engine.
- [ ] Расширить банк больше 40 вопросов для ротации.
- [x] Убрать самые очевидные и непрофессиональные distractors.
- [ ] Проверить актуальность вопросов после правок эксперта.

## FP&A Junior

- [x] Написать полный банк минимум 40 вопросов.
- [ ] Довести до 80 вопросов для ротации.
- [x] Темы: БДР, БДДС, forecast, план-факт, факторный анализ, сценарии.
- [x] Добавить кейсы по EBITDA, марже, расходам, unit economics.
- [x] Убрать декоративные и очевидно неверные варианты ответа.
- [ ] Провести ручное прохождение и вычитку формулировок.

## Accounting Junior

- [x] Написать полный банк минимум 40 вопросов.
- [ ] Довести до 80 вопросов для ротации.
- [x] Темы: проводки, первичка, НДС, основные средства, амортизация, дебиторка, кредиторка.
- [x] Сделать вопросы практическими, не академическими.
- [x] Убрать декоративные и очевидно неверные варианты ответа.
- [ ] Провести ручное прохождение и вычитку формулировок.

## Finance BI / Data Analyst Junior

- [x] Написать полный банк минимум 40 вопросов.
- [ ] Довести до 80 вопросов для ротации.
- [x] Темы: SQL, JOIN, GROUP BY, Power BI, data quality, метрики, дубли, справочники.
- [x] Добавить кейсы по ошибкам данных.
- [x] Убрать декоративные и очевидно неверные варианты ответа.
- [ ] Провести ручное прохождение и вычитку формулировок.

## Позже

- [ ] Сделать распределение случайной выборки по блокам, а не просто общий random.
- [ ] Добавить поддержку `active: false` в редакторский процесс банков.
- [ ] Улучшить TXT-отчёт: сильные/слабые темы и блок `Что проверить на интервью`.
- [x] Реализовать псевдонимизированную `admin.html` без открытых контактов и с защищённой выдачей TXT.
- [ ] Рассмотреть PDF-отчёты.
- [ ] Собрать первые 20-50 прохождений и улучшить вопросы по статистике.
