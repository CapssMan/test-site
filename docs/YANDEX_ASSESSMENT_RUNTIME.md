# Закрытый Yandex assessment runtime

Статус: 29 июля 2026 года. `SkillCheck` — временное рабочее название.

## Production-контур

- YDB Serverless: `assessment-runtime-db` (`etnkl7r9gkk0in6fitmv`), ограничение 10 RU/s и 1 ГБ.
- Cloud Function: `assessment-ranking-api` (`d4e1qffg3l40q6jgq0t9`).
- Активная assessment-версия: `assessment-v6` (`d4ev36locmu9lsjohtf0`), Node.js 22, 128 МБ, timeout 15 секунд, concurrency 1, без provisioned instances и логирования.
- Runtime account: `assessment-runtime-writer` (`ajesa9at6fmpd0ukbb25`), только `ydb.editor` для этой базы и доступ к приватному bucket без статического ключа.
- Private Object Storage: `assessment-b1gafbjd3dlh-private`, 1 ГБ, публичный и static-key доступ отключены.
- API Gateway: `GET|POST /v1/assessment`, закреплён за `assessment-v6`.

Lockbox, VM, CDN, пользовательский домен и другие постоянные платные компоненты не подключены.

## Закрытое состояние

- `legal_pilot_approved=false`
- `attempt_issuance_enabled=false`
- `retention_automation_enabled=true`

Публичный endpoint работает, но не выдаёт попытку даже при корректно сформированном запросе. Реальных приглашений, сессий, результатов, профилей рейтинга и отчётов в новом контуре нет.

## Реализовано и проверено

- Одноразовые email/test-bound приглашения и одна сессия на приглашение.
- Подписанный шестичасовой токен с привязкой к личности, браузеру, тесту, версии банка и точному набору вопросов.
- Закрытые ключи ответов и серверный расчёт для пяти финансовых банков v4, всего 240 вопросов.
- Повторяемое сохранение результата, безопасное восстановление после частичной записи и create-only TXT-отчёты.
- Сроки: результат/ответы/отчёт 365 дней, приглашение/сессия 90 дней, аудит 365 дней, временные пакеты 1 день, backup 30 дней.
- Owner-only smoke прошёл полный путь через реальную YDB и private Object Storage и удалил созданные данные; общие gates остались закрыты.
- `rankingProof` проверяет свежий пройденный нетехнический результат непосредственно в YDB и не раскрывает контакты, ответы или токены.

## Frontend и откат

Candidate Build `2026.07.31.1` по умолчанию обращается к Yandex API Gateway. В коде сохранена явная константа legacy Apps Script только для аварийного отката. Основной frontend опубликован в Yandex Object Storage, GitHub Pages остаётся резервной копией; CORS разрешает ровно эти два origin.

Девять известных legacy smoke-результатов не мигрировались. Они остаются только в прежнем rollback-контуре и исключены из обычной админ-аналитики.

Технический этап переноса завершён. До первого реального приглашения остаются содержательная/визуальная контрольная проверка и явные SME, legal и owner sign-off; только после этого можно отдельно открыть оба gates.
