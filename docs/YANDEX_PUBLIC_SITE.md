# Публичный сайт в Yandex Object Storage

Статус на 29 июля 2026 года: российский статический контур опубликован и проверен, но выдача реальных попыток остаётся закрыта до SME/legal/owner sign-off. `SkillCheck` — временное рабочее имя.

## Живой адрес

- Основной российский адрес без платного домена: `https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net/`.
- GitHub Pages остаётся рабочим резервным адресом до выбора нейтрального домена и закрытия исходного репозитория.
- Candidate Build `2026.07.31.1` использует российский `/v1/assessment`; переключение `ASSESSMENT_API_MODE` на `legacy-google` остаётся аварийным откатом backend.

## Граница публикации

В public bucket загружаются только 13 явно перечисленных файлов: семь HTML-страниц и шесть display-only JSON-банков. Скрипт не использует рекурсивную загрузку, прекращает работу при постороннем объекте и после загрузки требует точного совпадения всего списка объектов.

Перед каждой публикацией выполняются проверки ссылок, candidate UX и отсутствия ключей ответов. Для каждого объекта передаётся Content-MD5, после публикации все файлы повторно скачиваются и сравниваются с локальными по SHA-256. Каталоги `cloud`, `docs`, `scripts`, `apps-script`, private banks, отчёты, контакты и секреты в публичный бакет не попадают.

## Настройки и CORS

- Bucket: `assessment-b1gafbjd3dlh-web`, STANDARD, лимит 100 МБ, versioning disabled.
- Публичны чтение объектов и чтение списка — это обязательное условие статического hosting Yandex Object Storage; чтение конфигурации закрыто, static-key authentication отключена.
- Главная и error page: `index.html`.
- API Gateway принимает только два frontend origin: GitHub Pages и точный website endpoint Яндекса; wildcard не используется.
- Фактические ответы функций динамически возвращают только один из этих двух origin. Проверяются preflight и реальные GET/POST для assessment, admin и ranking.

Активные версии после исправления CORS:

- `assessment-v6` — `d4ev36locmu9lsjohtf0`;
- `admin-v3` — `d4etr5b695k94tmua9l3`;
- `read-v4` — `d4eophije7v42s47s0fp`;
- `write-v6` — `d4e5hbn8pmd19vqn20pt`.

Предыдущие версии сохранены и не маршрутизируются. Gateway можно вернуть на предыдущие теги без изменения YDB. Публичная база после cutover содержит 0 invitations, 0 sessions, 0 results и 0 ranking profiles; `legal_pilot_approved=false`, `attempt_issuance_enabled=false`, `retention_automation_enabled=true`.

## Стоимость

Новый сервис не подключался: использованы уже созданные bucket, API Gateway и Cloud Function. В публичном бакете 13 объектов общим объёмом около 0,56 МБ. CDN, Lockbox, VM и платный домен не подключены. При текущем тестовом трафике объём значительно ниже ежемесячных бесплатных квот, но бюджетное уведомление остаётся обязательным и при росте посещаемости стоимость нужно проверять отдельно.

## Повторная публикация

Из корня репозитория запускается `scripts/deploy-yandex-public-site.ps1`. Скрипт сначала проверяет allowlist и локальные контракты, обновляет gateway из `cloud/api-gateway.yaml`, загружает ровно 13 объектов, проверяет bucket и живые контрольные суммы, затем подтверждает Yandex-only browser CORS, отказ GitHub-origin и закрытый pilot gate.

При ошибке публикации нельзя вручную загружать каталог целиком. GitHub Pages остаётся пользовательским резервом, а предыдущие function tags — серверным rollback. После исправления причины безопасный скрипт запускается повторно.
