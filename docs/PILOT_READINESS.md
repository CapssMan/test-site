# SkillCheck — готовность к контролируемому пилоту

Обновлено: 21 июля 2026 года, этап 17.

## Решение

**NO-GO для реальных кандидатов.** Техническая проверка этапа 17 завершена, но запуск запрещён до закрытия внешних и содержательных блокеров. Production gates сохраняются закрытыми: `LEGAL_PILOT_APPROVED=false`, `ATTEMPT_ISSUANCE_ENABLED=false`, `RETENTION_AUTOMATION_ENABLED=false`.

Этот документ разделяет три разных состояния:

- `verified` — проверено тестом или live-read-only проверкой;
- `conditional` — допустимо только для малого контролируемого пилота при указанном ограничении;
- `blocker` — реальных кандидатов приглашать нельзя.

## Production evidence

| Проверка | Результат | Статус |
|---|---|---|
| Публичный health | четыре публичных поля, `ok:true`, backend `yandex-disk-mvp-2026-07-20-13` | verified |
| Protected owner diagnostics | `healthy`, четыре operational store, 9 result rows и 9 anti-retake rows | verified |
| Operational backup | свежий проверяемый snapshot четырёх store создан owner-функцией | verified |
| Apps Script deployments | один HEAD и один стабильный versioned deployment `@56`; Web App URL не менялся | verified |
| Public negative smoke | GET begin → `method_not_allowed`; legacy → `client_upgrade_required`; unknown → `unknown_action`; dev-quick → `test_not_public` | verified |
| GitHub CI/Pages | этап 16 опубликован зелёными workflow; этап 17 повторно проверяется при публикации этого отчёта | verified |

В production остаются известные smoke-данные. Значение `9/9` не является пилотной выборкой и не должно попадать в будущую аналитику. Коды известных smoke перечислены в `PROJECT_STATUS.md`. Перед пилотом они удаляются только через preview/confirmed deletion с проверкой backup purge; ручное редактирование JSON запрещено.

## Техническая матрица

| Область | Evidence | Статус |
|---|---|---|
| Пять тестов и банки | 5 ролей, 240 public questions, 40 вопросов в попытке; 0 ошибок/предупреждений аудита | verified |
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
| Реквизиты оператора | `privacy.html` и `consent.html` содержат явные «не указано» | владелец предоставляет и утверждает реквизиты/контакт |
| Legal и retention | нет внешнего заключения, сроков, legal hold, формы подтверждения уничтожения | оператор + профильный специалист подписывают checklist |
| Исторически раскрытый answer key | старые ответы остаются в Git history/клонах/кэшах | полная содержательная ротация + SME review + новая private/public миграция |
| Яндекс credential | scope app-folder/least-privilege не подтверждён, дата ротации не зафиксирована | ротация OAuth-токена и документированная проверка scope вне Git |
| Чистая pilot-база | protected diagnostics показывает 9 smoke result/attempt rows | точечный deletion workflow после подтверждения точного списка |
| Финальный owner sign-off | нет закрытого go/no-go журнала с ответственными | заполнить `PRIVACY_CHECKLIST.md` и эту финальную секцию после остальных блокеров |

Ни один из блокеров нельзя закрывать изменением текста на `verified` без фактического доказательства.

## Финальная последовательность перед первым кандидатом

1. Выполнить содержательную ротацию пяти банков и SME review; не переписывать только Git history.
2. Повторно мигрировать public/private banks, закрепить новые digests и выполнить полную матрицу.
3. Ротировать Яндекс OAuth credential, проверить private storage и protected status.
4. Заполнить operator contacts, получить внешнее legal/retention решение, обновить consent version при необходимости.
5. По утверждённому списку удалить smoke results/attempts через admin preview/confirm; проверить operational backups и diagnostics.
6. Выполнить desktop/mobile QA, CI, health, protected status и rollback drill/readiness.
7. В закрытом owner-журнале зафиксировать версии, gates, ответственных, объём и решение `go`.
8. Сначала включить legal approval с точной consent version, затем отдельным действием issuance. Не менять оба gate одновременно с runtime rollout.
9. Создать одно owner-smoke приглашение, завершить его, проверить replay/report/status и удалить smoke-данные.
10. Ограничить первую волну 3–5 работодателями/рекрутерами и 10–30 прохождениями; при S1/S2 немедленно выключить issuance.

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

Связанные документы: `PRIVACY_CHECKLIST.md`, `OPERATIONS.md`, `DEPLOYMENT.md`, `OBSERVABILITY.md`, `BACKUP_AND_RECOVERY.md`, `DATA_DELETION.md`, `QUESTION_BANK_AUDIT.md`.
