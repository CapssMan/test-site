# SkillCheck — готовность к контролируемому пилоту

Обновлено: 24 июля 2026 года, после первой адресной волны reviewer outreach.

## Решение

**NO-GO для реальных кандидатов.** Техническая проверка этапа 17 и техническая ротация пяти банков v4 завершены, но запуск запрещён до закрытия внешних блокеров. Production gates сохраняются закрытыми: `LEGAL_PILOT_APPROVED=false`, `ATTEMPT_ISSUANCE_ENABLED=false`, `RETENTION_AUTOMATION_ENABLED=false`.

Этот документ разделяет три разных состояния:

- `verified` — проверено тестом или live-read-only проверкой;
- `conditional` — допустимо только для малого контролируемого пилота при указанном ограничении;
- `blocker` — реальных кандидатов приглашать нельзя.

## Production evidence

| Проверка | Результат | Статус |
|---|---|---|
| Публичный health | четыре публичных поля; runtime — backend yandex-disk-mvp-2026-07-26-20, admin Build 2026.07.26.15 | verified после rollout; gates закрыты |
| Protected owner diagnostics | `healthy`, четыре operational store, 9 result rows и 9 anti-retake rows | verified |
| Operational backup | свежий проверяемый snapshot четырёх store создан owner-функцией | verified |
| Apps Script deployments | существующий versioned deployment обновлён до `@61`; Web App URL не менялся | verified |
| Яндекс credential/storage | отдельное API-only приложение, только `cloud_api:disk.app_folder`, root `app:/skillcheck`; checksum cutover, write/read backup и реальный rollback drill; старое приложение и rollback credential удалены | verified |
| Public negative smoke | GET begin → `method_not_allowed`; legacy → `client_upgrade_required`; unknown → `unknown_action`; dev-quick → `test_not_public` | verified |
| GitHub CI/Pages | commit retirement `2d9254d`: SkillCheck CI #9 и Pages #71 завершены успешно | verified |

В production могут оставаться строки из известного набора девяти smoke-кодов. По решению владельца они не удаляются, не являются пилотной выборкой и исключаются из таблицы, метрик и диаграмм Admin Build .15; контракт и точный перечень зафиксированы в TECHNICAL_DATA_EXCLUSION.md.

## Техническая матрица

| Область | Evidence | Статус |
|---|---|---|
| Пять тестов и банки | пять полностью новых банков v4, 240 public questions, 40 вопросов в попытке; 0 ошибок/предупреждений аудита | verified |
| Техническая ротация | новые question/option ID, формулировки, варианты и ключи; private/public split, trust anchors и atomic cutover | verified |
| Desktop/mobile | главная, пять test routes, privacy, consent и admin без horizontal overflow; mobile 390×844 проверен | verified |
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
| Реквизиты оператора | рабочий контакт `skillcheck.project@yandex.ru` внесён; владелец подтвердил входящее/исходящее письмо и 2FA 24.07.2026; ФИО/наименование и адрес остаются «не указано» | владелец с профильным специалистом утверждает оставшиеся публичные реквизиты |
| Legal и retention | нет внешнего заключения, сроков, legal hold, формы подтверждения уничтожения | оператор + профильный специалист подписывают checklist |
| Исторически раскрытый answer key / SME v4 | техническая ротация выполнена; закрытая review-книга на 240 вопросов и runbook `SME_REVIEW_HANDOFF.md` подготовлены; 24.07.2026 отправлены четыре адресных письма без вложений по потокам FA/FPA, CA, ACC и BI, ответы ожидаются; внешний review ещё не выполнен | профильный эксперт подтверждает банки v4 либо возвращает точечные правки новой версией |
| Чистая pilot-база / техническое исключение | известный набор девяти smoke-кодов сохраняется по решению владельца; Admin Build .15 исключает фактически присутствующие строки из обычной аналитики | перед открытием gates подтвердить нулевое влияние известных кодов на базовые метрики и сохранить переключатель выключенным |
| Финальный owner sign-off | нет закрытого go/no-go журнала с ответственными | заполнить `PRIVACY_CHECKLIST.md` и эту финальную секцию после остальных блокеров |

Ни один из блокеров нельзя закрывать изменением текста на `verified` без фактического доказательства.

## Финальная последовательность перед первым кандидатом

1. Закрытая рабочая копия `PRE_PILOT_INPUTS.md` создана, первая адресная волна reviewer outreach отправлена 24.07.2026. Ждать ответы 4–7 дней; после явного согласия по `SME_REVIEW_HANDOFF.md` подтвердить компетенцию/независимость и передать reviewer только его review-книгу. Получить sign-off; замечания исправлять только новой versioned-ротацией.
2. Заполнить оставшиеся реквизиты оператора, получить внешнее legal/retention решение и обновить consent version при необходимости; project email и 2FA уже проверены владельцем.
3. В Admin Build .15 проверить, что при выключенном техническом переключателе известные smoke-коды отсутствуют в таблице, метриках и диаграммах; не выполнять новые попытки их массового удаления.
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
