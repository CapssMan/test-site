# SkillCheck — готовность к контролируемому пилоту

## Актуализация 31.07.2026 — LIMITED GO

Содержательный gate закрыт внутренним исследовательским выпуском v5: 240/240 вопросов проверены, 80 улучшены, неверных ключей и арифметических ошибок не найдено. Статус — PASS для небольшой controlled pilot волны с запретом на заявления об официальной сертификации и на автоматическое кадровое решение.

Независимый человеческий SME review остаётся рекомендацией перед масштабированием, но не блокером малой исследовательской волны. Владелец сообщил о направлении уведомления в Роскомнадзор, утвердил УЗ-4 и угрозы типа 3, разрешил публикацию адреса и отдельно открыл gates: `legal_pilot_approved=true`, `attempt_issuance_enabled=true`, `retention_automation_enabled=true`.
Обновлено: 31 июля 2026 года, после ограничения production-origin российским Yandex-сайтом.

## Решение

**LIMITED GO для контролируемого пилота.** Разрешена первая invite-only волна до 10–30 завершённых прохождений без открытой регистрации, автоматических кадровых решений и прямой передачи данных работодателям. Production gates открыты отдельными действиями: `legal_pilot_approved=true`, `attempt_issuance_enabled=true`; автоматизация сроков включена: `retention_automation_enabled=true`.

Этот документ разделяет три разных состояния:

- `verified` — проверено тестом или live-read-only проверкой;
- `conditional` — допустимо только для малого контролируемого пилота при указанном ограничении;
- `blocker` — реальных кандидатов приглашать нельзя.

## Production evidence

| Проверка | Результат | Статус |
|---|---|---|
| Российский frontend | Candidate/admin Build `2026.07.31.3`; 13 allowlisted объектов; live SHA-256; Yandex website root `200`; адрес подставлен только в три legal-страницы | verified |
| Functions/Gateway | `assessment-v8`, `admin-v5`, `read-v6`, `write-v8`; API разрешает browser-доступ только основному Yandex-origin | verified |
| Live QA | 13/13 Yandex-файлов совпадают с ожидаемыми rendered SHA-256; legal-страницы и ranking read работают, GitHub-origin не имеет candidate API CORS | verified |
| Public negative smoke | после открытия gates неверное приглашение даёт нейтральный `attempt_unavailable` и не создаёт строк | verified |
| Owner-only E2E | private bank → 100% server-verified → TXT read-back → exact cleanup | verified |
| YDB clean start | после открытия gates: 0 invitations, 0 sessions, 0 results, 0 ranking profiles | verified |
| Private storage/retention | 5 банков v5 в private bucket; reports 365d, backups 30d, temporary artifacts 1d | verified |
| Source/rollback | GitHub Pages остаётся статическим rollback и перенаправляет интерактивные страницы на Yandex; предыдущие function tags сохранены | verified |
| CI | 41 test suite + 5 infrastructure validators; 240 production-вопросов, 0 ошибок/предупреждений | verified |
В production могут оставаться строки из известного набора девяти smoke-кодов. По решению владельца они не удаляются, не являются пилотной выборкой и исключаются из таблицы, метрик и диаграмм Admin Build 2026.07.31.3; контракт и точный перечень зафиксированы в TECHNICAL_DATA_EXCLUSION.md.

## Техническая матрица

| Область | Evidence | Статус |
|---|---|---|
| Пять тестов и банки | пять текущих банков v5, 240 public questions, 40 вопросов в попытке; 0 ошибок/предупреждений аудита | verified |
| Техническая ротация | новые question/option ID, формулировки, варианты и ключи; private/public split, trust anchors и atomic cutover | verified |
| Desktop/mobile | владелец 29 июля 2026 года проверил основной Yandex endpoint на desktop и mobile; замечаний нет | verified |
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

## Остаточные ограничения после LIMITED GO

- независимый человеческий SME review требуется до масштабирования или заявлений об официальной сертификации;
- первая волна ограничена 10–30 завершёнными прохождениями по персональным приглашениям;
- тест не используется как единственное основание кадрового решения;
- передача контактов или полного отчёта работодателю остаётся выключенной;
- при инциденте S1/S2 оператор немедленно выключает `attempt_issuance_enabled`.

Технические smoke-коды исключены из обычной аналитики и не входят в пилотную выборку.

подтверждённой рассылки экспертам нет, outbound остановлен по решению владельца. Для малой исследовательской волны это не blocker; независимый SME review остаётся условием масштабирования. Read-only проверка check-pre-pilot-live.ps1 сохранена как диагностический инструмент исторического fail-closed состояния.

## Следующие действия пилота

1. Создать персональное приглашение в админке для заранее выбранного участника.
2. Передать ссылку только этому участнику и предупредить, что тест является исследовательской оценкой.
3. После первого прохождения проверить сохранение результата, добровольную публикацию рейтинга и отсутствие ошибок.
4. Набирать волну постепенно до 10–30 завершений; не публиковать общий код приглашения.
5. После волны провести психометрический разбор и решить, какие вопросы требуют корректировки.

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
