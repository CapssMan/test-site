# SkillCheck — production expansion cutover, 19 August 2026

## Результат

Combined production expansion завершён. В рабочем account-first контуре доступны 11 направлений и 480 production-вопросов:

- пять финансовых тестов;
- Tourism & Hospitality Operations Junior v1.1;
- Software Development Junior v1.0;
- Product / Project Management Junior v1.0;
- Sales / Business Development Junior v1.0;
- Logistics / Procurement Junior v1.0;
- Digital Marketing Junior v1.0.

Публичный сайт содержит ровно 28 разрешённых файлов. Шесть новых public banks проверены сравнением SHA-256 с локальными артефактами. Все 11 `/v1/ranking` маршрутов вернули `ok=true` и запрошенный `testId`.

## Активные runtime

- `assessment-v14`;
- `account-v6`;
- `admin-v12`;
- `employer-v4`;
- `read-v7`;
- `write-v9`.

Предыдущие runtime-версии не удалялись. Для соблюдения квоты Cloud Functions снимались только устаревшие теги; версии сохранены и остаются доступными по ID. Lockbox и другие новые платные сервисы не подключались.

## Gate state после проверки

Открыты:

- `attempt_issuance_enabled=true`;
- `account_self_service_enabled=true`;
- `account_required_for_attempts=true`.

Закрыты:

- `profile_publication_enabled=false`;
- `employer_workspace_enabled=false`;
- `employer_contact_enabled=false`;
- `employer_chat_enabled=false`;
- `candidate_credentials_enabled=false`;
- `employer_company_profiles_enabled=false`.

## Инцидент квоты и восстановление

Первый запуск корректно остановился fail-closed после создания `assessment-v14`: создание следующего тега было отклонено лимитом десяти тегов. API Gateway оставался на прежнем рабочем наборе, выдача новых попыток и self-service были закрыты, активных или зарезервированных сессий не было.

Восстановление выполнено поэтапно:

1. повторно проверены закрытые gates, ноль активных сессий и метаданные банков;
2. сняты только устаревшие теги с сохранением соответствующих версий;
3. созданы новые core runtime и выполнено промежуточное переключение Gateway;
4. освобождены теги непосредственных предшественников без удаления версий;
5. созданы `read-v7` и `write-v9`, после чего Gateway переведён на окончательную конфигурацию;
6. опубликован сайт, выполнены live API/SHA-256 проверки и только затем восстановлена выдача попыток.

## Продуктовая граница

Кандидат может войти через Яндекс ID, выбрать один из 11 тестов, пройти попытку с единым 21-дневным retake-правилом и увидеть подтверждённый результат в личном кабинете. Employer workspace, публичные профили, раскрытие контактов, регалии и чат технически подготовлены, но остаются недоступны до отдельных решений и gate-opening.
