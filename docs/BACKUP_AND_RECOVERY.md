# SkillCheck — резервные копии и восстановление

Обновлено: 20 июля 2026 года. Технический этап 13.

## Область защиты

Backend создаёт закрытый snapshot предыдущей валидной версии перед заменой каждого изменяемого operational store:

- `admin/results.json`;
- `private/attempts.json`;
- `private/attempt-sessions-v1.json`;
- `private/invites-v1.json`.

Snapshots находятся только в `disk:/skillcheck/private/backups-v1/<store-key>/`. Для каждого store сохраняются не более 12 последних версий. Временные forensic-копии повреждённого active-файла находятся в `backups-v1/corrupt/<store-key>/`, не более трёх на store.

Полные TXT-отчёты не дублируются этим механизмом. Закрытые банки вопросов являются versioned-артефактами с SHA-256 anchors и восстанавливаются отдельным owner-bootstrap. Транзакционные копии операции удаления относятся к `docs/DATA_DELETION.md` и уничтожаются после успешной проверки.

## Гарантии записи

`writeRequiredJsonArray` выполняет следующий порядок:

1. сериализует и повторно разбирает новый массив;
2. проверяет лимит строк, размер и объектный тип каждой строки;
3. читает текущий active-файл и прекращает запись, если он уже повреждён;
4. создаёт envelope предыдущей валидной версии;
5. повторно читает snapshot, проверяет store/path, SHA-256, число строк и приватность;
6. удаляет snapshots сверх лимита;
7. заменяет active-файл;
8. повторно читает active-файл и сверяет SHA-256.

Envelope содержит версию схемы, технический store key, закрытый source path, причину, timestamps, число строк, SHA-256 и сами строки. Он содержит персональные/служебные данные исходного store и поэтому никогда не должен публиковаться или копироваться в GitHub Pages.

Идентичная запись не создаёт лишний snapshot. Если запись active-файла оборвалась после создания snapshot, восстановление выполняется из уже проверенной предыдущей версии.

## Первичная baseline-копия

После первого deployment этапа 13 владелец один раз запускает из Apps Script editor:

```javascript
createOperationalBackupsForOwner()
```

Функция работает под `ScriptLock`, проверяет приватность и создаёт по одному `manual-baseline` snapshot для четырёх stores. Она возвращает только store key, имя snapshot и число строк, без содержимого записей.

Проверка состояния без раскрытия данных:

```javascript
getOperationalBackupStatusForOwner()
```

Обе функции editor-only: маршрутов `doGet`/`doPost` для них нет.

## Восстановление

Restore разрешён только при одновременно закрытых gate:

```text
LEGAL_PILOT_APPROVED=false
ATTEMPT_ISSUANCE_ENABLED=false
```

Порядок действий владельца:

1. не редактировать повреждённый JSON вручную;
2. получить inventory через `getOperationalBackupStatusForOwner()`;
3. выбрать точное имя `bkp_...json` нужного store;
4. вызвать:

```javascript
restoreOperationalStoreForOwner("admin-results", "bkp_YYYYMMDDTHHMMSSmmmZ_deadbeef.json")
```

Допустимые store keys: `admin-results`, `attempts`, `attempt-sessions`, `invites`.

Перед заменой валидный active-файл получает дополнительный `before-restore` snapshot. Если active-файл повреждён, его сырой текст сначала сохраняется в закрытый bounded corrupt-artifact с SHA-256. Затем backup envelope заново валидируется, active-файл заменяется и повторно сверяется по digest.

Публичного restore API и автоматического выбора «последней копии» нет: это защищает от удалённого отката, ошибочного выбора store и восстановления непроверенного файла.

## Связь с удалением данных

Обычные snapshots могут содержать историческую строку удаляемой попытки. Поэтому commit удаления:

1. находит связанные строки во всех operational snapshots;
2. включает исходные envelopes в закрытый транзакционный checkpoint;
3. удаляет primary-данные;
4. вычищает связанные строки из snapshots и пересчитывает их SHA-256;
5. проверяет отсутствие данных и в primary stores, и в operational backups;
6. уничтожает транзакционный checkpoint.

`result_only` очищает snapshots админ-результатов. `full_attempt` дополнительно очищает attempts, sessions и invites. Обычная backup-функция при этом отключена, чтобы операция удаления не создала новую историческую копию удаляемых данных.

## Ограничения

- Первый snapshot появляется при ручном baseline или непосредственно перед первой последующей записью. Повреждение, существовавшее до создания любого snapshot, автоматически восстановить нельзя.
- Это application-level versioning, а не независимый off-site backup. Компрометация самого Яндекс OAuth-токена может затронуть и active-файлы, и копии.
- RPO для защищённой записи — предыдущая валидная версия конкретного store. RTO зависит от ручного выбора snapshot и проверки владельцем.
- Восстановление не открывает pilot gates и не включает автоматический retention.
- Ротация Яндекс OAuth credential и независимая disaster-recovery копия остаются pilot/security checklist.

## Безопасная production-проверка

Разрешены baseline/status и восстановление только специально созданной тестовой строки после отдельного решения владельца. Нельзя намеренно портить текущие production JSON ради smoke. Для обычного rollout достаточно:

- полной VM-матрицы записи/rotation/tamper/corruption/restore;
- вызова `createOperationalBackupsForOwner()`;
- проверки inventory без содержимого;
- minimal health и подтверждения закрытых pilot gates.
