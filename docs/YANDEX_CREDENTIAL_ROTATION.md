# SkillCheck — ротация credential Яндекс.Диска

Обновлено: 23 июля 2026 года.

## Production baseline

- Backend: `yandex-disk-mvp-2026-07-23-15`.
- Apps Script deployment: `@61`; Web App URL не менялся.
- Активный storage root: `app:/skillcheck`.
- OAuth-приложение: отдельное API-only приложение `SkillCheck Storage`.
- Единственное право приложения: `cloud_api:disk.app_folder` — доступ только к папке приложения на Яндекс.Диске.
- Старое широкоправное приложение `skillcheck` удалено; выданные ему токены отозваны.
- Временные next/rollback credentials удалены из Script Properties после проверки активного хранилища.
- `LEGAL_PILOT_APPROVED=false` и `ATTEMPT_ISSUANCE_ENABLED=false` на всём протяжении операции.

Токен, Client ID, Client secret, значения Script Properties и контрольные суммы отдельных private-файлов в Git и документацию не записываются.

## Почему создано отдельное приложение

Изменение прав существующего OAuth-приложения отзывает все ранее выданные ему токены. Обычный токен без `device_id` нельзя гарантированно отозвать отдельно. Поэтому production перенесён в отдельную папку нового app-folder-only приложения, а старое широкоправное приложение выводится из эксплуатации только после полного cutover и rollback drill.

## Что делает backend

Owner-only функции отсутствуют в публичном `doGet`/`doPost`:

- `stageYandexAppFolderMigrationForOwner()` — копирует `disk:/skillcheck` в `app:/skillcheck`, повторяет временные `429/5xx`, пропускает уже совпадающие файлы и сохраняет проверенный manifest;
- `verifyYandexAppFolderMigrationForOwner()` — повторно сравнивает дерево, размеры и server-side MD5 каждого файла, связывая manifest SHA-256 с полным списком;
- `promoteYandexAppFolderMigrationForOwner()` — атомарно меняет токен и все девять storage paths, затем читает четыре operational store и все authoritative private banks;
- `rollbackYandexAppFolderMigrationForOwner()` — синхронизирует изменения обратно, возвращает прежний токен и пути и повторно проверяет активное хранилище;
- `retireYandexDiskRollbackCredentialForOwner()` — удаляет временный rollback credential после внешнего отзыва старого OAuth-приложения;
- `getYandexCredentialMigrationStatusForOwner()` — возвращает только безопасный статус без токенов и путей отдельных файлов.

Любая stage/promote/rollback операция прекращается, если открыт legal gate или включена выдача попыток. Мигратор отказывается работать с опубликованными или shared ресурсами, неизвестными именами, неожиданными файлами назначения и несовпадающими контрольными суммами.

## Проверка 23 июля 2026 года

1. Создано новое API-only приложение с единственным app-folder scope.
2. Токен сохранён напрямую в Script Properties без вывода в терминал, чат или файл.
3. Первый stage безопасно остановился на временном `503 ServiceUnavailableError`; production не переключался.
4. После добавления retry/backoff и idempotent checksum resume stage завершён.
5. Promote завершил повторную сверку, сменил все пути и проверил operational/private storage.
6. Public health после cutover: HTTP `200`, `ok:true`, backend `yandex-disk-mvp-2026-07-23-15`.
7. Protected owner diagnostics завершилась без ошибки.
8. Новый credential создал и перечитал свежие snapshot четырёх operational store.
9. Выполнен реальный rollback с обратной синхронизацией; health на прежнем пути снова вернул HTTP `200`.
10. Manifest обновлён, повторный promote завершён, health снова вернул HTTP `200` на app-folder storage.
11. Старое широкоправное OAuth-приложение удалено из кабинета Яндекса; в списке осталось только `SkillCheck Storage`.
12. `retireYandexDiskRollbackCredentialForOwner()` повторно проверила активное хранилище и удалила временные next/rollback credentials.
13. После retirement защищённая диагностика вернула `healthy`: доступны 4 operational store, 9 result rows и 9 anti-retake rows; public health повторно вернул HTTP `200`.

## Состояние rollback после retirement

Rollback на `disk:/skillcheck` намеренно больше недоступен: старое приложение и временный credential удалены. Восстановление выполняется из verified operational backups внутри `app:/skillcheck` по `BACKUP_AND_RECOVERY.md` либо через новую credential-ротацию. Pilot gates при восстановлении должны оставаться закрытыми; production JSON вручную не редактируется.

## Запрещено

- добавлять новому приложению `cloud_api:disk.read`, `cloud_api:disk.write` или `cloud_api:disk.info`;
- выводить токены в логи, URL, Git, issue или screenshot;
- удалять старое приложение до успешных stage, promote, protected diagnostics, write/read backup test и rollback drill;
- включать pilot gates одновременно с ротацией credential;
- считать публичный health доказательством целостности private storage.
