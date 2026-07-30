# SkillCheck — безопасный deployment и rollback

Обновлено: 29 июля 2026 года, российский frontend/runtime cutover.

Этот runbook описывает публикацию статического frontend в Yandex Object Storage и обновление Yandex Cloud Functions/API Gateway. GitHub Pages и Google Apps Script сохраняются только как rollback; новые платные сервисы без отдельного решения не подключаются.

## Текущий production baseline

- ветка source/rollback: `main`;
- российский сайт: `https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net/`;
- GitHub Pages: резервный frontend до нейтрального домена;
- candidate: `Build 2026.07.31.1`;
- admin: `Build 2026.07.28.1`;
- functions: `assessment-v6`, `admin-v3`, `read-v4`, `write-v6`;
- API: `attempt-v2` через Yandex API Gateway;
- `legal_pilot_approved=false`;
- `attempt_issuance_enabled=false`;
- `retention_automation_enabled=true`.

Значения OAuth/IAM-токенов, паролей, salts, signing secrets и private-bank anchors в Git, issue, CI log или скриншот не записываются.
## Роли и условия допуска

Публикацию выполняет владелец каталога Yandex Cloud либо явно назначенный оператор с минимально необходимым доступом. Перед началом должны быть известны:

1. последний исправный Git commit и Apps Script version;
2. существующий deployment ID из локального `.clasp.json`/Apps Script console, но не из репозитория;
3. ответственный за решение `go/no-go`;
4. окно проверки и способ отката;
5. подтверждение, что изменение не включает real-candidate issuance без закрытия pilot blockers.

## Preflight

Из корня репозитория:

```powershell
git status --short
npm ci --ignore-scripts --no-audit --no-fund
npm test
git diff --check
```

Ожидаемый результат: рабочее дерево содержит только согласованные изменения, locked install успешен, вся матрица зелёная, whitespace errors отсутствуют. Затем проверить:

- frontend и backend используют один ожидаемый API contract;
- публичные банки не содержат answer key;
- значения Script Properties не попали в diff;
- `LEGAL_PILOT_APPROVED`, `ATTEMPT_ISSUANCE_ENABLED` и `RETENTION_AUTOMATION_ENABLED` не открываются изменением;
- backup/status исправны, если изменение затрагивает storage;
- номер build/backend version обновлён, если runtime действительно изменяется.

## Публикация российского frontend

Из корня репозитория после зелёного preflight:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-yandex-runtime-cors.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-yandex-public-site.ps1
```

Первый скрипт создаёт четыре versioned successor и только после их готовности переключает Gateway. Второй загружает ровно 13 allowlisted файлов без `--recursive`, сверяет Content-MD5, live SHA-256, точный список bucket, root page, preflight и фактический CORS assessment/admin/ranking для Yandex и GitHub origin. В конце `beginAttempt` обязан вернуть `attempt_unavailable`.

После публикации вручную проверить desktop/mobile layout главной, пяти test routes, privacy, consent, ranking и admin. Не открывать `legal_pilot_approved` или `attempt_issuance_enabled` одновременно с rollout.

GitHub Pages продолжает публиковать `main` как резерв. Его зелёный workflow не является доказательством работоспособности Yandex runtime. При S1/S2 Gateway возвращается на предыдущие теги, а пользователю даётся GitHub Pages; удалять предыдущие function versions до окончания QA запрещено.

## Legacy Apps Script rollback без смены URL
Официальная модель Apps Script разделяет immutable version и deployment. Для production используется versioned deployment; существующий deployment переводится на новую version, поэтому URL остаётся прежним.

Перед push сверить локальную привязку и список файлов:

```powershell
clasp show-authorized-user
clasp show-file-status
clasp list-deployments
```

Не копировать вывод с идентификаторами в публичные логи. Затем:

```powershell
clasp push
clasp create-deployment --deploymentId <EXISTING_DEPLOYMENT_ID> --description "SkillCheck <stage> <version>"
```

Допустим эквивалентный ручной путь: Apps Script → **Deploy → Manage deployments** → выбрать существующий Web App → **Edit** → выбрать новую version → **Deploy**. Нельзя выбирать **New deployment**, если отдельная смена URL не согласована.

`clasp push --force`, удаление deployment и изменение владельца не входят в обычный rollout. Перед любой такой операцией требуется отдельная проверка scope и последствий.

## Post-deploy verification

Проверки выполняются один раз, от немутирующих к мутирующим:

1. `GET <WEB_APP_URL>?action=health` возвращает `ok:true`, ожидаемый `service` и `backendVersion`.
2. Ответ health содержит только публичный минимальный контракт и не раскрывает paths/properties/storage state.
3. В админке защищённый status показывает ожидаемые версии и `healthy`; пароль не сохраняется браузером и не попадает в URL.
4. Если storage менялся — owner-only backup status и row counts согласованы с baseline.
5. Ошибочный пароль/неподдерживаемый action не раскрывают внутренние данные.
6. Мутирующий smoke допускается только на специально созданных тестовых данных с заранее описанной очисткой. Реальный email кандидата не используется.
7. Pilot gates после проверки остаются закрыты, если их включение не было отдельным утверждённым действием.

В release note фиксируются Git commit, Apps Script version, публичные build/backend versions, время проверки, результат CI/health/status и решение `go/no-go`. Секреты и внутренние идентификаторы не фиксируются.

## Rollback

Rollback начинается при несовместимом API, ошибке authoritative scoring, недоступности storage, нарушении consent/deletion, утечке внутренних данных или росте ошибок после rollout.

1. Остановить новые попытки: убедиться, что `ATTEMPT_ISSUANCE_ENABLED=false`. При юридическом риске также оставить `LEGAL_PILOT_APPROVED=false`.
2. Не удалять и не редактировать production JSON вручную.
3. Перевести **существующий** deployment на последнюю исправную Apps Script version через Manage deployments либо:

```powershell
clasp create-deployment --versionNumber <LAST_GOOD_VERSION> --deploymentId <EXISTING_DEPLOYMENT_ID> --description "Rollback <reason>"
```

4. Для frontend вернуть проверенный commit обычным revert-коммитом и дождаться CI/Pages; историю `main` не переписывать.
5. Повторить health и защищённый status.
6. Если повреждён operational store, следовать `BACKUP_AND_RECOVERY.md`; восстановление разрешено только при закрытых gates.
7. Зафиксировать время, симптом, затронутый компонент, выбранную version и результат проверки без персональных данных.

## Запрещённые сокращения

- не создавать новый Web App URL ради обычного обновления;
- не запускать production rollout при красном CI;
- не вставлять секреты в команды, commit messages или GitHub Actions;
- не проверять удаление/restore на реальных данных;
- не включать issuance одновременно с неизвестным runtime-изменением;
- не считать public health проверкой Яндекс.Диска — для этого существует защищённый status;
- не откатывать JSON вручную поверх активной записи.

Связанные документы: `OPERATIONS.md`, `TESTING.md`, `OBSERVABILITY.md`, `BACKUP_AND_RECOVERY.md`, `DATA_DELETION.md`, `PRIVACY_CHECKLIST.md`.

Официальные справки: [Apps Script deployments](https://developers.google.com/apps-script/concepts/deployments), [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [google/clasp commands](https://github.com/google/clasp).
