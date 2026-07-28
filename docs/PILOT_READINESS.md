# SkillCheck — готовность к контролируемому пилоту

Обновлено: 29 июля 2026 года, после российского frontend/runtime cutover.

## Решение

**NO-GO для реальных кандидатов.** Техническая проверка этапа 17 и техническая ротация пяти банков v4 завершены, но запуск запрещён до закрытия внешних блокеров. Production gates сохраняются закрытыми: `legal_pilot_approved=false`, `attempt_issuance_enabled=false`; утверждённая автоматизация сроков включена: `retention_automation_enabled=true`.

Этот документ разделяет три разных состояния:

- `verified` — проверено тестом или live-read-only проверкой;
- `conditional` — допустимо только для малого контролируемого пилота при указанном ограничении;
- `blocker` — реальных кандидатов приглашать нельзя.

## Production evidence

| Проверка | Результат | Статус |
|---|---|---|
| Российский frontend | Candidate Build `2026.07.29.2`; 13 allowlisted объектов, 586 242 байта, live SHA-256; Yandex website root `200` | verified |
| Functions/Gateway | `assessment-v4`, `admin-v2`, `read-v3`, `write-v4`; точные Yandex/GitHub origin проходят preflight и фактические GET/POST | verified |
| Public negative smoke | `beginAttempt` → нейтральный `attempt_unavailable`; legal/issuance gates не открывались | verified |
| Owner-only E2E | private bank → 100% server-verified → TXT read-back → exact cleanup | verified |
| YDB zero state | 0 invitations, 0 sessions, 0 results, 0 ranking profiles после cutover | verified |
| Private storage/retention | 5 банков v4 в private bucket; reports 365d, backups 30d, temporary artifacts 1d | verified |
| Source/rollback | GitHub Pages остаётся рабочим frontend fallback; предыдущие function tags сохранены | verified |
| CI | 39 test suite + 5 infrastructure validators; 240 production-вопросов, 0 ошибок/предупреждений | verified |
В production могут оставаться строки из известного набора девяти smoke-кодов. По решению владельца они не удаляются, не являются пилотной выборкой и исключаются из таблицы, метрик и диаграмм Admin Build 2026.07.28.1; контракт и точный перечень зафиксированы в TECHNICAL_DATA_EXCLUSION.md.

## Техническая матрица

| Область | Evidence | Статус |
|---|---|---|
| Пять тестов и банки | пять полностью новых банков v4, 240 public questions, 40 вопросов в попытке; 0 ошибок/предупреждений аудита | verified |
| Техническая ротация | новые question/option ID, формулировки, варианты и ключи; private/public split, trust anchors и atomic cutover | verified |
| Desktop/mobile | прежний GitHub frontend проверен; для нового Yandex endpoint требуется один финальный ручной desktop/mobile проход перед первым кандидатом | conditional |
| Candidate flow | invite-only start, consent version, 18+, session-only pending submission, retry/replay | verified |
| Сохранение и TXT | authoritative save; TXT только для passed; failed не сохраняет открытые контакты | verified |
| Админка | POST-only auth, safe summary, report access, deletion preview/confirm, protected diagnostics | verified |
| Retake | persistent email/fingerprint hashes, 21-day policy, neutral response without email oracle | verified |
| Scoring | backend-only `authoritative-v1`, закрытый key, exact manifest, клиентский балл не принимается | verified |
| Invitation/attempt | single-use invite, HMAC signed `attempt-v2`, expiry, reservation, exact replay | verified |
| `questionId` | обязателен, уникален и сверяется с server manifest; option ID также проверяется | verified |
| Email enumeration | публичный lookup удалён; invalid/expired/reused invite даёт нейтральный ответ | verified |
| Abuse perimeter | per-identity/global CacheService limits и закрытая выдача приглашений | conditional |
| Deletion | result-only/full-attempt, transactional backup, operational-backup redaction, recovery | verified |
| Backup/restore | verified snapshots, rotation 12, corrupt artifact capture, restore только при закрытых gates | verified |
| Monitoring/rollback | minimal health, protected status, S1–S3 runbook, rollback существующего deployment | verified |
| Policy/instructions | privacy, separate consent, operator, deployment, deletion, backup и incident runbooks связаны | verified |
| Hidden smoke | `dev-quick` публично недоступен; owner smoke не имеет публичного route | verified |

CacheService rate limiting является best-effort и не заменяет внешний gateway/WAF. Для малого controlled pilot допускается только при непубличных одноразовых ссылках, малом объёме, ручном мониторинге и возможности немедленно закрыть issuance. Для открытой регистрации или массовой рассылки внешний gateway/CAPTCHA/OTP обязателен.

## Блокеры запуска

| Блокер | Текущее доказательство | Что закрывает |
|---|---|---|
| Реквизиты оператора | ФИО и проверенный `skillcheck.project@yandex.ru` опубликованы только в policy/consent; статус НПД и регион скрыты как избыточные | профильный специалист определяет, нужен ли публичный адрес и в каком допустимом объёме |
| Legal и retention | нет внешнего заключения, сроков, legal hold, формы подтверждения уничтожения | оператор + профильный специалист подписывают checklist |
| Исторически раскрытый answer key / SME v4 | техническая ротация выполнена; закрытая review-книга на 240 вопросов и runbook `SME_REVIEW_HANDOFF.md` подготовлены; 24.07.2026 отправлены четыре адресных письма без вложений по потокам FA/FPA, CA, ACC и BI, ответы ожидаются; внешний review ещё не выполнен | профильный эксперт подтверждает банки v4 либо возвращает точечные правки новой версией |
| Чистая pilot-база / техническое исключение | известный набор девяти smoke-кодов сохраняется по решению владельца; Admin Build 2026.07.28.1 исключает фактически присутствующие строки из обычной аналитики | перед открытием gates подтвердить нулевое влияние известных кодов на базовые метрики и сохранить переключатель выключенным |
| Финальный owner sign-off | нет закрытого go/no-go журнала с ответственными | заполнить `PRIVACY_CHECKLIST.md` и эту финальную секцию после остальных блокеров |

Ни один из блокеров нельзя закрывать изменением текста на `verified` без фактического доказательства.

## Финальная последовательность перед первым кандидатом

1. Закрытая рабочая копия `PRE_PILOT_INPUTS.md` создана, первая адресная волна reviewer outreach отправлена 24.07.2026. Ждать ответы 4–7 дней; после явного согласия по `SME_REVIEW_HANDOFF.md` подтвердить компетенцию/независимость и передать reviewer только его review-книгу. Получить sign-off; замечания исправлять только новой versioned-ротацией.
2. Утвердить полный публичный адрес оператора, получить внешнее legal/retention решение и повторно проверить consent v2; ФИО, project email и 2FA подтверждены; статус НПД и регион хранятся только во внутреннем owner-контуре.
3. В Admin Build 2026.07.28.1 проверить, что при выключенном техническом переключателе известные smoke-коды отсутствуют в таблице, метриках и диаграммах; не выполнять новые попытки их массового удаления.
4. Выполнить desktop/mobile QA, CI, health, protected status и readiness.
5. В закрытом owner-журнале зафиксировать версии, gates, ответственных, объём и решение `go`.
6. Сначала включить legal approval с точной consent version, затем отдельным действием issuance. Не менять оба gate одновременно с runtime rollout.
7. Создать одно owner-smoke приглашение, завершить его, проверить replay/report/status и удалить smoke-данные.
8. Ограничить первую волну 3–5 работодателями/рекрутерами и 10–30 прохождениями; при S1/S2 немедленно выключить issuance.

## План измерений пилота

До первой волны согласовать владельца каждой метрики:

- приглашения → начатые → завершённые попытки;
- время, таймауты, retry/replay и ошибки сохранения;
- распределение итогов и блоков без автоматического изменения порога;
- полезность кода/TXT/Skill Card для рекрутера;
- обращения кандидатов, удаления и privacy incidents;
- качественная обратная связь кандидатов и работодателей;
- связь результата с человеческим решением без превращения теста в единственный фильтр.

На выборке 10–30 прохождений не делать сильных статистических выводов и не менять scoring автоматически.

Связанные документы: PRE_PILOT_INPUTS.md, QUESTION_BANK_ROTATION.md, SME_REVIEW_HANDOFF.md, PRIVACY_CHECKLIST.md, OPERATIONS.md, DEPLOYMENT.md, OBSERVABILITY.md, BACKUP_AND_RECOVERY.md, DATA_DELETION.md, TECHNICAL_DATA_EXCLUSION.md, QUESTION_BANK_AUDIT.md.
