# SkillCheck — security-аудит этапов 10 и 10A

Дата аудита: 20 июля 2026 года.

Статус baseline этапа 10: опубликован в Apps Script deployment `@49` без смены URL и подтверждён production smoke; implementation commit `e251be3`. Статус 10A: техническая реализация authoritative scoring/private banks/invitations завершена; production deployment, smoke и implementation commit пока `pending`. Подготовлены candidate `Build 2026.07.20.11`, admin `Build 2026.07.20.9`, backend `yandex-disk-mvp-2026-07-20-9`; `ATTEMPT_ISSUANCE_ENABLED=false`.

## Резюме

В проверенной истории Git не найдено высокодостоверных токенов, паролей, salt или OAuth credentials. `.clasp.json` игнорируется Git и содержит только `scriptId`; локальные OAuth credentials в репозиторий не входят. Manifest Apps Script запрашивает только необходимые текущей архитектуре scopes: внешние HTTP-запросы и Script Properties.

На этапе 10 было подготовлено baseline-усиление публичного контура:

- GET больше не выполняет проверку попытки и административные действия; JSONP удалён;
- публичный `health` стал минимальным, не обращается к Яндекс Диску, не создаёт файлы и не раскрывает конфигурацию;
- POST принимает только известные `action`, JSON-объект ограниченного размера и строгий контракт;
- backend проверяет `testId`, версии теста и банка, обязательные поля, допустимые значения, длины, типы, диапазоны чисел, количество и структуру ответов;
- добавлены best-effort лимиты частоты через `CacheService` для проверки попытки, сохранения результата и административного входа;
- контекст вопроса проходит allowlist-санитизацию, а динамические значения экранируются;
- TXT очищается от управляющих символов и ограничивается по размеру;
- временная полная копия неподтверждённого результата перенесена из постоянного `localStorage` в `sessionStorage` текущей вкладки;
- HTML-страницы получили CSP meta и политику `no-referrer`;
- кандидатский экран, backend-контракт и админка явно помечают балл как `client-reported-unverified`.

Эти baseline-меры сокращали поверхность атаки, но не устраняли доверие к браузеру. Этап 10A технически перенёс answer key и scoring на backend, добавил single-use invite/attempt и удалил публичный email lookup. Главный текущий blocker — историческая компрометация контента: прежние answer keys остаются в Git history, клонах и кэшах. Подробный контракт зафиксирован в [`BACKEND_SCORING_DECISION.md`](BACKEND_SCORING_DECISION.md).

## Проверенный контур

Аудит охватил:

- текущие файлы и историю Git;
- `.gitignore`, `.clasp.json`, Apps Script manifest и OAuth scopes;
- публичные GET/POST-маршруты, JSONP и диагностику;
- обработку ошибок, логирование и ответы API;
- XSS, HTML escaping, JSON/TXT injection и управляющие символы;
- парольную админку, доступ к TXT и перебор;
- payload limits, allowlist тестов, версии банков и серверную схему результата;
- локальное хранение персональных данных;
- повторную отправку, reservation/upsert и мусорные запросы;
- модель подсчёта результата и публичность правильных ответов.

Аудит не является независимым penetration test и не доказывает отсутствие неизвестных уязвимостей.

## Результаты baseline этапа 10

Раздел ниже фиксирует состояние, проверенное и опубликованное в `@49` **до** миграции 10A. Упоминания `checkAttempt`, client scoring и tokenless `saveResult` являются историческими findings, а не описанием подготовленного 10A-контракта.

### Secrets, Git и Apps Script

- В Git history не обнаружены высокодостоверные секреты. Поиск выполнялся по характерным именам и форматам токенов/паролей; найденные упоминания относятся к названиям Script Properties и документации.
- `.gitignore` исключает локальные credentials, `.clasp.json`, JSON-базы результатов и TXT-отчёты.
- Локальный `.clasp.json` содержит только идентификатор Apps Script проекта. Сам по себе `scriptId` не является токеном доступа, но файл всё равно не публикуется.
- Manifest использует `script.external_request` для Яндекс Диска и `script.storage` для Script Properties. Дополнительные Drive/Sheets/Gmail scopes отсутствуют.
- Web App доступен анонимно, потому что кандидат должен отправлять результат без Google-аккаунта. Поэтому безопасность строится на узком API, строгой валидации, квотах и отсутствии доверия к клиентским полям.
- Фактический scope Яндекс OAuth-токена не подтверждён кодом и, вероятно, шире `disk:/skillcheck`. Allowlist путей в `Code.gs` ограничивает только штатные операции приложения, но не blast radius самого токена при его компрометации. Нужны регламент ротации и последующая миграция к app-folder/иному least-privilege credential, если Яндекс предоставляет подходящую модель.

Список Apps Script deployments сверён через `clasp`: кроме HEAD и текущего стабильного deployment устаревших активных deployments в этом проекте не обнаружено. Исторические URL не считаются активными deployments текущего проекта. Если в будущем появится лишний deployment, его нужно отозвать без публикации URL/ID.

### Маршруты и диагностика

- `checkAttempt`, административная выдача результатов и TXT работают только через POST.
- Неизвестные или отсутствующие `action` отклоняются; сохранение больше не является неявным fallback-маршрутом.
- JSONP удалён. Ответы формируются как JSON, а email/fingerprint не передаются в URL.
- Cross-origin POST с GitHub Pages остаётся необходимым транспортом к Apps Script и выполняется без cookies/credentials. `Origin` не используется как доказательство доверия: любой публичный клиент считается недоверенным и проходит одинаковую серверную валидацию.
- Публичный `health` — только liveness: `ok`, статус сервиса и версия backend. Он не читает Script Properties, папки или JSON на Яндекс Диске и ничего не создаёт.
- Детальную диагностику хранилища следует реализовать на этапе 14 как отдельную защищённую административную операцию.

`checkAttempt` остаётся email-enumeration oracle. Точный `nextDate` удалён; обычная retake-блокировка возвращает только округлённый `daysLeft`, а незавершённая reservation — технический `retryAfterSeconds`. Однако поля `allowed`/`foundPreviousAttempt` всё ещё раскрывают факт зарегистрированной попытки для пары test/email или fingerprint. Per-key/global `CacheService` limits усложняют массовый перебор, но не устраняют распределённую проверку. Полное решение требует не публичного lookup по произвольному email, а invite token, подтверждённого email (OTP/magic link), аутентифицированного потока и/или CAPTCHA + внешнего gateway rate limiting. Для контролируемого пилота минимальный вариант — single-use server-issued invite/challenge, не позволяющий проверять произвольные адреса.

### Входные данные и мусорные загрузки

- Максимальный размер POST body: 250 000 символов.
- Максимум ответов в одном результате: 40; для `dev-quick` ожидается один ответ.
- Максимальный сгенерированный TXT: 200 000 символов; административная выдача также имеет отдельный предел.
- Backend использует allowlist действующих `testId`, точные версии теста и банка, известные ключи объекта и допустимые перечисления.
- Проверяются длины и форматы имени, email, Telegram, fingerprint и `requestId`; числовые поля должны быть конечными и находиться в ожидаемых диапазонах.
- Ответы проверяются по структуре, уникальному порядковому `number`, типам и внутренней согласованности агрегатов. `questionId` пока совместим с legacy payload и необязателен: если он передан, его формат и уникальность проверяются; отсутствие ID не связывает ответ с конкретным вопросом банка. Это блокирует часть мусорных payload, но не доказывает правильность ответа и не создаёт authoritative scoring.
- Ошибки разделены на постоянные validation errors, временные ошибки и rate limit. Публичный ответ не содержит токен, пароль, salt, путь Яндекс Диска, payload или stack trace.

`saveResult` пока не требует выданного сервером attempt/challenge. Публичные ключи ответов позволяют дешёво собрать полностью согласованный payload и создавать валидные записи, расходуя Apps Script/Яндекс.Диск quota. Самый дешёвый путь этого релиза закрыт: `PUBLIC_DEV_TEST_ENABLED = false`, а обе публичные операции (`checkAttempt` и `saveResult`) вызывают `assertPublicTestEnabled`, поэтому `dev-quick` по умолчанию получает `test_not_public`. Это production-minimum, но не защита обычных публичных тестов: в 10A сохранение должно требовать короткоживущий одноразовый signed attempt token, а публичный периметр — gateway/защиту от abuse.

### Rate limiting и brute force

`CacheService` применяет ограниченные окна для:

- пары тест/email/fingerprint при `checkAttempt` и общего потока таких запросов;
- одного `requestId` при `saveResult` и общего потока сохранений;
- административного пароля/операции и общего потока административных запросов.

Это advisory/best-effort защита: CacheService не является атомарным сетевым rate limiter, может очищать записи раньше TTL и не даёт надёжного IP-based ограничения. Она снижает случайный abuse и простой перебор, но не заменяет API gateway/WAF. При росте трафика потребуются внешний edge rate limiting, отдельные admin-учётные данные и журналирование безопасных событий.

### Retake и идентификация

Текущий 21-дневный retake — deterrence, а не identity control:

- email не подтверждается, поэтому кандидат или бот может подставить другой адрес;
- browser fingerprint — присылаемое клиентом 32-bit значение, которое можно изменить или подделать;
- salted hashes защищают сохранённые значения от прямого чтения, но не доказывают личность и не делают исходные идентификаторы достоверными;
- очистка browser storage, другой браузер/устройство или изменённый fingerprint обходят локальный marker.

Для контролируемого пилота достаточнее выдавать одноразовые приглашения и связывать лимит с server-issued attempt. Для более сильной идентификации нужны OTP/magic link или аккаунт; CAPTCHA и gateway ограничивают автоматизацию, но сами по себе не подтверждают личность.

### XSS, CSP и инъекции

- Динамические значения в candidate/admin UI экранируются перед HTML-вставкой.
- HTML-контекст вопроса проходит allowlist-санитизацию: активные элементы, event handlers, URL-атрибуты и произвольные теги не допускаются.
- CSP meta ограничивает источники скриптов, стилей, изображений и соединений, запрещает plugins/objects и изменение base URL; `referrer=no-referrer` исключает передачу URL страницы как Referer.
- Текущая CSP всё ещё разрешает inline CSS/JS, потому что MVP собран как статические single-file страницы. Более строгая nonce/hash CSP требует вынести inline-код в отдельные файлы или перейти на сборку.
- GitHub Pages не позволяет проекту надёжно выставить полный набор HTTP security headers из репозитория; meta CSP не заменяет серверный заголовок и не поддерживает все директивы заголовка.
- TXT не является таблицей и не импортируется автоматически в Sheets/Excel, но управляющие символы и переносы всё равно нормализуются, чтобы пользовательские поля не ломали структуру отчёта. Если появится CSV/XLSX-экспорт, нужна отдельная защита от formula injection (`=`, `+`, `-`, `@`).

### Персональные данные

- Новые полные резервные копии неподтверждённого результата хранятся только в `sessionStorage` текущей вкладки, очищаются после подтверждения/невалидной ошибки/TTL и исчезают при закрытии вкладки.
- При первом запуске валидный и неистёкший legacy pending envelope переносится из `localStorage` в `sessionStorage`, после чего постоянная копия удаляется. Невалидная, слишком большая или истёкшая legacy-копия удаляется без миграции. Если `sessionStorage` недоступен, валидная legacy-копия временно сохраняется, чтобы не потерять неподтверждённый результат.
- Локальный 21-дневный retake marker остаётся в `localStorage`, но больше не содержит browser fingerprint.
- Админская выборка остаётся обезличенной; полный TXT выдаётся только после POST-проверки пароля и не вставляется в DOM.
- Логи содержат только технический этап и безопасный хвост `requestId`, без полного payload и персональных данных.

## Addendum 10A: реализованный trust boundary

- Public banks имеют schema v2, display-only поля, opaque option IDs и `publicDigest`; `correct`/объяснения правильного ответа отсутствуют в текущей ветке и публикации.
- Authoritative answer key находится только в private versioned banks на Яндекс.Диске. SHA-256 anchors в Script Properties защищают от незаметной подмены только на стороне storage; missing/corrupt/mismatched private state обрабатывается fail closed.
- `beginAttempt` требует email/test-bound одноразовое приглашение. Plaintext invite code не хранится; публичные ошибки не раскрывают, существует ли email/приглашение/предыдущая попытка.
- Invite URL хранит bearer только во fragment `#invite=...`, не в query. Candidate захватывает fragment, сразу очищает адресную строку через `history.replaceState` и временно сохраняет код в `sessionStorage`.
- Signed attempt token имеет отдельный HMAC secret, фиксированные claims и срок 6 часов. Server-side session, а не подпись сама по себе, является источником single-use и exact-manifest binding.
- `saveResult` принимает только versioned contract `attempt-v1`, обязательные `questionId`/`optionId` и advisory telemetry. Tokenless legacy flow отклоняется как `client_upgrade_required`; `checkAttempt` удалён.
- Backend проверяет точный ordered manifest и private bank, сам рассчитывает score/pass и возвращает связку `server-verified` / `authoritative-v1`. Клиентская арифметика, tab switches и timing не влияют на итог.
- Состояние `active → reserved → completed` и binding `requestId + submissionHash` дают exact replay, конфликт изменённого payload и repair после частичного admin commit в пределах recovery window.
- Admin UI принимает только результат с ожидаемыми API/test/bank/attempt bindings и серверными markers. Создание/отзыв invite использует идемпотентные request IDs.
- Сырые email, fingerprint, invite code и attempt token не пишутся в invite/session JSON и технические логи.
- `ATTEMPT_ISSUANCE_ENABLED=false` блокирует обычную выдачу attempts; `dev-quick` остаётся public-disabled. Включение для реальных кандидатов запрещено до отдельного content-rotation gate.
- Bootstrap загружает legacy sources только из полного immutable commit `70e569cf267e043aabc780e81cc4307db7e149b1` и до JSON parse сверяет точный SHA-256 каждого файла. Commit или content mismatch останавливает миграцию.
- Metadata-проверка охватывает private root/banks/invites/sessions/attempts и связанные файлы. Любой `public_key`, `public_url` или `share` блокирует bootstrap, включение issuance, выпуск invite, begin и save; publish/share endpoints код не вызывает.

Production rollout и production smoke этой реализации пока `pending`. До их фактического завершения нельзя приписывать 10A номер deployment, SHA commit или smoke-код.

## Остаточные риски и pilot gate после 10A

| Риск | Уровень | Состояние / действие |
|---|---|---|
| Исторически опубликованные answer keys | Критический | Удалены из текущего HEAD, но остаются в Git history, клонах и кэшах. До реального пилота нужна отдельно согласованная содержательная ротация вопросов/вариантов/ключей и SME review; rewrite истории недостаточен. |
| Production rollout 10A не завершён | Высокий до проверки | Deployment/commit/smoke остаются `pending`; обновлять только существующий Web App URL, затем выполнить закрытый owner smoke и снова оставить issuance выключенным. |
| Ошибочное включение выдачи | Закрыт gate по умолчанию | `ATTEMPT_ISSUANCE_ENABLED=false`; admin/candidate показывают pilot lock. Не включать до content rotation и checklist этапа 17. |
| Identity без OTP/account | Высокий | Email-bound invite и fingerprint ограничивают поток, но не доказывают личность. Для более сильной идентификации нужны OTP/magic link или аккаунт. |
| Анонимный Apps Script endpoint и best-effort rate limits | Высокий при открытом запуске | Controlled flow сужен invite/token/state. `CacheService` не является атомарным IP-based limiter; для открытого трафика нужен внешний gateway/WAF/CAPTCHA. |
| Широкий/неподтверждённый scope Яндекс-токена | Высокий | Code path allowlist не ограничивает украденный токен; определить scope, безопасно ротировать credential и оценить app-folder/least privilege. |
| Shared admin password | Высокий | POST + advisory limit; до масштабирования перейти на индивидуальную аутентификацию/MFA и безопасный audit trail. |
| Нет удаления, retention и backup private state | Высокий | Этапы 12–13; private banks/invites/sessions должны входить в проверенный backup/recovery и retention design. |
| CSP только через meta и inline code | Средний | Вынести JS/CSS и выставлять заголовки на управляемом hosting при следующем усилении. |
| Юридические заглушки и контакты | Высокий | Этап 11 и профильная юридическая проверка; реальные приглашения не выдавать. |

## Критерии завершения этапа 10

- [x] Аудит и архитектурное решение задокументированы.
- [x] Защитная реализация подготовлена и проверена.
- [x] Полная автоматическая матрица проходит: 10/10 скриптов PASS; аудит 240 вопросов — 0 ошибок, 0 предупреждений.
- [x] Существующий Apps Script deployment обновлён до `@49` без смены URL.
- [x] Production smoke подтверждает minimal health с четырьмя ключами, POST-only/allowlist, admin rate limit, сохранение, replay и retake без точной даты.
- [x] `dev-quick` hard-disabled по умолчанию через `PUBLIC_DEV_TEST_ENABLED=false`; обе публичные операции проверяют флаг.
- [x] Зафиксированы backend `yandex-disk-mvp-2026-07-20-7`, candidate `Build 2026.07.20.8`, admin `Build 2026.07.20.6` и deployment `@49`.
- [x] Список deployments сверён; устаревших активных deployments текущего проекта не обнаружено.
- [x] Зафиксирован SHA implementation commit: `e251be3`.

Production evidence: health содержит ровно `ok/status/service/backendVersion`; GET `checkAttempt` → `method_not_allowed`; неизвестный action → `unknown_action`; `dev-quick` → `test_not_public`; шестой неверный admin password → `rate_limited`. Реальный failed результат `FA-X5P66` сохранён с `reportCreated:false`; идентичный replay вернул тот же код и `replayed:true`; retake возвращает coarse `daysLeft` без `nextDate`.

Публикация: backend `yandex-disk-mvp-2026-07-20-7`, deployment `@49`, candidate `Build 2026.07.20.8`, admin `Build 2026.07.20.6`, Web App URL не изменён; implementation commit: `e251be3`.
