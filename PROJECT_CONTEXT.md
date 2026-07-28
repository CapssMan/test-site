# PROJECT_CONTEXT.md

## Что это за проект

SkillCheck — MVP assessment-platform и будущее ядро двусторонней платформы профессиональных навыков. В текущем controlled-pilot потоке кандидат получает приглашение, проходит тест, backend авторитетно считает результат, сохраняет advisory telemetry и возвращает случайный код. Ближайший этап переносит на российскую инфраструктуру именно кандидатский runtime и базы данных, добавляет opt-in рейтинг и делает source repository приватным без обязательного переезда на GitVerse. North Star и ограничения: `docs/PRODUCT_VISION.md`.

Результат тестирования является предварительной оценкой отдельных навыков. Он не является самостоятельным решением о найме, отказе в найме или профессиональной пригодности.

## Текущее состояние

Frontend остаётся статическим GitHub Pages сайтом:

```text
candidate: index.html -> test.html?test=<testId>#invite=... -> Google Apps Script attempt-v2 -> Яндекс Диск
admin: admin.html -> Yandex API Gateway /v1/admin -> Cloud Function admin-v1 -> YDB/private Object Storage
ranking: ranking.html -> Yandex API Gateway -> read-v2/write-v2 -> YDB
```

Google Apps Script временно остаётся backend/API только для candidate attempt write-path. Админка и рейтинг уже используют Yandex Cloud Functions, API Gateway и YDB; Google Sheets и Google Drive не используются.

Backend имеет публичный endpoint `?action=health`, который возвращает только минимальный немутирующий liveness. Он не читает Script Properties/Яндекс Диск, не раскрывает пути и не создаёт файлы. Расширенная read-only диагностика реализована отдельным POST `adminDiagnostics` за админ-паролем и возвращает только безопасные технические агрегаты.

Historical baseline этапа 10 опубликован в deployment @49, 10A — в @51. Candidate runtime: backend yandex-disk-mvp-2026-07-27-23, deployment @69, Build 2026.07.27.16, API attempt-v2, storage root app:/skillcheck. Admin Build 2026.07.28.1 использует активную Yandex Function admin-v1 и YDB/private Object Storage; pilot gates закрыты. Этапы 15–17, банки v4, least-privilege credential и техническое исключение smoke-кодов завершены.

Owner smoke 10A FA-LDUB2 исторически подтвердил server-verified / authoritative-v1 / attempt-v1. Текущий attempt-v2 требует versioned-согласие и остаётся закрыт двумя gate. Ручное удаление, backup/restore, диагностика и CI реализованы; сроки утверждены, а TTL профиля рейтинга включён, но retention остальных категорий ещё требует cutover. Российские read/write API рейтинга работают при закрытых gates. Реальные кандидаты остаются заблокированы до короткого legal/retention/SME/owner checklist; известные smoke-коды сохраняются и системно исключаются из аналитики.

Рабочие тесты:

- Financial Analyst Junior — `data/fa-junior.json`;
- Credit Analyst Junior — `data/ca-junior.json`, 80 вопросов;
- FP&A / Budget Analyst Junior — `data/fpa-junior.json`, 40 вопросов;
- Accounting / Reporting Junior — `data/acc-junior.json`, 40 вопросов;
- Finance BI / Data Analyst Junior — `data/bi-junior.json`, 40 вопросов.

## Текущая модель хранения до российского cloud-cutover

Персональные данные и полный TXT-отчёт хранятся только на закрытом Яндекс Диске:

```text
app:/skillcheck/reports/<code>.txt
```

TXT-отчёт создаётся только при успешном результате `finalScore >= 80`.

Админка использует псевдонимизированный JSON без открытых контактов:

```text
app:/skillcheck/admin/results.json
```

Legacy-compatible anti-retake projection использует приватный JSON с hash:

```text
app:/skillcheck/private/attempts.json
```

Authoritative attempt flow дополнительно использует:

```text
app:/skillcheck/private/invites-v1.json
app:/skillcheck/private/attempt-sessions-v1.json
app:/skillcheck/private/banks/<test>/<version>.json
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
4. После отдельного versioned-согласия и 18+ frontend отправляет `beginAttempt` с `attempt-v2`, invite, email и browser fingerprint.
5. Backend проверяет invite/retake/private storage и выдаёт 6-часовой HMAC-signed token с точным ordered manifest вопросов.
6. Frontend сохраняет серверный порядок вопросов и криптографически перемешивает целые option-объекты.
7. Кандидат отвечает по одному вопросу с таймером; время и tab switches остаются advisory telemetry без штрафа к баллу.
8. Pending submission хранится только в текущем `sessionStorage`, не дольше token и максимум 6 часов; legacy full payload из `localStorage` удаляется.
9. `saveResult` отправляет обязательные `questionId`/`optionId`, token/session bindings и telemetry без клиентского score.
10. Backend сверяет token, session, identity/fingerprint, точный manifest и закрытый versioned bank.
11. Backend сам рассчитывает raw/final/percent/pass и маркирует результат `server-verified` / `authoritative-v1`.
12. State machine `active → reserved → completed` резервирует код, создаёт TXT только для passed, обновляет admin/attempt stores и поддерживает recovery.
13. Exact replay того же request/payload возвращает тот же код; изменённый payload конфликтует.
14. Frontend показывает результат только при совпадении `attempt-v2`, consent/attempt/test/bank bindings и серверных verification markers.

Техническая trust boundary и содержательная ротация v4 реализованы. Старые v3 ключи остаются в истории, но не соответствуют новым вопросам/ID/вариантам. `ATTEMPT_ISSUANCE_ENABLED=false` сохраняется до независимого SME sign-off v4 и остальных условий pilot checklist.

## Бюджетное правило

- По умолчанию использовать бесплатные тарифы и уже имеющиеся ресурсы.
- До создания любого ресурса, способного привести к списанию, назвать сервис, ожидаемый диапазон расходов и бесплатную альтернативу.
- Не подключать billing, платный тариф, домен, VPS или подписку без отдельного явного разрешения владельца.
- Бесплатный лимит не считать гарантией нулевой стоимости; настраивать уведомления о бюджете до production-нагрузки.

## Что нельзя ломать

- дизайн и карточки `index.html`;
- display-only JSON и их `publicDigest`;
- точный server-issued question manifest и перемешивание option-объектов;
- отправку результата в Apps Script;
- стабильный Google Script URL до проверенного cutover на Yandex Cloud;
- authoritative scoring, single-use session и fail-closed private storage;
- секреты Script Properties;
- правило: GitHub Pages не хранит результаты, персональные данные, токены или JSON-базы.
- pilot lock: не включать legal approval/issuance до operator/legal/retention/SME/owner checklist и проверки исключения известных технических кодов.

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
- Код 10A подтверждает сохранение авторитетно рассчитанного результата; public/private банки v4 технически ротированы, но их содержательная пригодность остаётся за независимым SME sign-off.
- Яндекс OAuth переведён на отдельное приложение только с `cloud_api:disk.app_folder`; активный root `app:/skillcheck`, прежнее широкоправное приложение и временные rollback credentials удалены.
- Удаление требует пароль, подписанный preview и точный код; транзакционная копия закрыта и уничтожается после проверки. Сроки утверждены: TTL рейтинга включён, автоматизация остальных категорий переносится вместе с write-cutover 18C.
- Operational JSON получают bounded snapshot предыдущей валидной версии; restore editor-only, а удаление вычищает связанные строки из snapshots.

Подробности: `docs/SECURITY_AUDIT.md`, `docs/BACKEND_SCORING_DECISION.md`, `docs/DATA_DELETION.md` и `docs/BACKUP_AND_RECOVERY.md`.
