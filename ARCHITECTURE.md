# SkillCheck — архитектура MVP

Обновлено: 29 июля 2026 года. Российский frontend и serverless runtime являются основным контуром; Google/GitHub сохранены только как rollback. `SkillCheck` — временное название.

## Общая схема

~~~text
Кандидат
  -> Yandex Object Storage: HTML + display-only банки
  -> API Gateway /v1/assessment
  -> assessment-v4
  -> YDB: invitation/session/result/audit
  -> private Object Storage: bank answer keys + TXT reports

Администратор
  -> admin.html
  -> API Gateway /v1/admin
  -> admin-v2
  -> YDB + private Object Storage

Рейтинг
  -> GET /v1/ranking -> read-v3 (ydb.viewer) -> публичный allowlist
  -> POST /v1/ranking/profile -> write-v4 (ydb.editor)
  -> online rankingProof у assessment-v4 -> YDB TTL
~~~

Основной сайт: `https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net/`. Резервный frontend: GitHub Pages. Candidate Build `2026.07.29.2`, admin Build `2026.07.28.1`.

## Разделение доступа

- `assessment-v4` и `admin-v2` работают под runtime account с edit-доступом только к assessment YDB и закрытому bucket.
- `read-v3` работает под отдельным `ydb.viewer` и не может менять профили.
- `write-v4` работает под отдельным `ydb.editor` и принимает только публикацию/отзыв профиля.
- API Gateway вызывает только закреплённые tagged versions.
- В публичном bucket ровно 13 allowlisted файлов; рекурсивная публикация запрещена.
- Постоянных IAM-ключей, Lockbox, VM, CDN, provisioned instances и Cloud Logging нет.

## Candidate trust boundary

Браузер показывает вопросы и собирает ответы, но не содержит правильные ответы и не считается источником результата.

- public schema содержит только display-поля, `optionId` и `publicDigest`;
- private bank содержит `correctOptionId` и служебное объяснение;
- сервер выбирает и подписывает точный ordered manifest вопросов;
- frontend криптографически перемешивает целые option-объекты, сохраняя ID;
- клиент отправляет только `questionId`, `optionId|null`, `timedOut`, `timeSpent`;
- балл, статус, блоки и рекомендацию вычисляет backend;
- результат показывается только при `scoreVerification=server-verified`.

Код приглашения, pending request и attempt token живут только в `sessionStorage` и удаляются после успешного завершения либо по сроку. `localStorage` не содержит ответов, контактов или bearer-токенов.

## Assessment API

Публичные actions:

- `beginAttempt` — проверяет gates, приглашение, identity/fingerprint, retake и private bank;
- `saveResult` — проверяет подписанный token и manifest, считает результат, сохраняет YDB/TXT;
- `rankingProof` — подтверждает свежий прошедший нетехнический YDB-result для writer-функции.

Контракт строгий: лишние/устаревшие поля отклоняются, повтор одного request ID идемпотентен, конфликтующий replay блокируется. Gates сейчас закрыты: `legal_pilot_approved=false`, `attempt_issuance_enabled=false`, retention включён.

## Рейтинг

Публикация доступна только после отдельного opt-in и результата от 80%. `assessment-v4` возвращает writer-функции минимальный proof и непрозрачный `rankingSubjectHandle`, но не контакты, ответы, result token или attempt token.

YDB хранит public allowlist и SHA-256 management token. Профиль имеет TTL 365 дней; кандидат может удалить его раньше. Рейтинг не показывает позицию при выборке меньше пяти профилей. Технические строки исключаются.

## Админка и удаление

Админ-пароль хранится только как PBKDF2-SHA256 verifier. Защищённые операции позволяют читать результат/TXT, управлять приглашениями, смотреть безопасные агрегаты и удалять данные через короткоживущий подписанный preview. Удаление связано с YDB-строками, отчётом, ranking profile и временным backup; replay контролируется ledger.

Девять legacy smoke-кодов остаются в старом rollback-хранилище по решению владельца, но исключены из обычной аналитики. Они не мигрированы в YDB.

## Хранение и стоимость

- result/answers/report: 365 дней;
- invite/session: 90 дней;
- audit: 365 дней;
- ranking profile: 365 дней на публикацию;
- deletion backup: 30 дней;
- packages/staging: 1 день.

YDB ограничена 10 RU/s и 1 ГБ, private bucket — 1 ГБ, public bucket — 100 МБ. Добавление платных компонентов требует отдельного согласия владельца.

## Rollback

Frontend может быть возвращён на GitHub Pages, candidate endpoint — на фиксированный legacy Apps Script URL, API Gateway — на предыдущие сохранённые function versions. Открытие gates не является частью автоматического deploy и выполняется только отдельным решением после SME, legal и owner sign-off.

## Проверка

`npm test` запускает secret scan, статические проверки, два валидатора банков и все `test-*.js`. GitHub Actions имеет только `contents: read`, не получает production secrets и не выполняет deploy.
