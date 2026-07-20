# SkillCheck — защищённая наблюдаемость

Обновлено: 20 июля 2026 года, этап 14.

## Назначение

Публичный `GET ?action=health` остаётся минимальным liveness-сигналом и возвращает только `ok`, `status`, `service`, `backendVersion`. Он не читает Script Properties или Яндекс Диск и не показывает состояние внутренних файлов.

Расширенная диагностика доступна только как `POST action=adminDiagnostics` после общей проверки `ADMIN_PASSWORD`, rate limit и точной версии `attempt-v2`. В админке она загружается после входа и может быть обновлена отдельной кнопкой.

## Что показывает защищённая сводка

- версии candidate/admin/backend и API;
- время backend и длительность самой проверки;
- доступность Яндекс Диска и HTTP status probe;
- наличие allowlisted Script Properties без их значений;
- состояние, размер, количество строк, время изменения и последней записи для `admin-results`, `attempts`, `attempt-sessions`, `invites`;
- агрегированное количество TXT в просматриваемой папке reports;
- состояние legal, issuance и retention gates;
- последнюю санитизированную ошибку текущей проверки.

Сводка не возвращает storage paths, имена файлов, коды результатов, attempt/invite IDs, email, Telegram, fingerprint/hash, ответы, TXT-содержимое, токены, пароль, salt или signing secrets.

## Статусы

- `healthy` — Яндекс Диск доступен, обязательные properties присутствуют, четыре operational store и reports прошли проверку типа/приватности/чтения.
- `degraded` — отсутствует обязательная конфигурация либо хотя бы один storage-компонент не прошёл проверку.
- `ok:false` не открывает pilot gates и не запускает автоматическое восстановление. Диагностика является read-only.

Закрытые pilot gates сами по себе не делают систему `degraded`: до реального пилота значения `LEGAL_PILOT_APPROVED=false`, `ATTEMPT_ISSUANCE_ENABLED=false` и `RETENTION_AUTOMATION_ENABLED=false` являются ожидаемым безопасным состоянием.

## Безопасные ошибки

Backend сводит внутреннюю ошибку к трём полям: `component`, allowlisted `code`, нейтральный `message`. Возможные коды:

- `required_resource_missing`;
- `invalid_private_json`;
- `private_storage_visibility_error`;
- `storage_unavailable`;
- `diagnostic_check_failed`.

Исходный текст исключения, URL, path и ответ Яндекс API в административный JSON не попадают. Подробный внутренний trace при необходимости проверяется владельцем в Apps Script execution log с соблюдением правил работы с секретами.

## Runbook оператора

1. Открыть `admin.html` и войти по административному паролю.
2. Найти блок «Защищённая диагностика» и дождаться окончания проверки; для неё установлен отдельный timeout 45 секунд.
3. При `healthy` сверить версии, backend time, число строк и `lastWriteAt` с ожидаемым изменением после последней операции.
4. При `degraded` записать только `component` и `code`. Не копировать в публичный issue execution log, токены, пути или содержимое JSON.
5. `required_resource_missing`: проверить allowlisted property или наличие закрытого store из Apps Script owner context.
6. `invalid_private_json`: не выполнять обычную запись; использовать проверяемое восстановление по `BACKUP_AND_RECOVERY.md` только при закрытых pilot gates.
7. `private_storage_visibility_error`: немедленно оставить issuance выключенным и снять публикацию/расшаривание ресурса.
8. `storage_unavailable`: проверить доступность API и credential; не менять production JSON до восстановления связи.
9. После устранения причины повторить диагностику и получить `healthy`.

Владелец может выполнить `verifyProtectedDiagnosticsForOwner()` из Apps Script editor. Функция не имеет публичного route, возвращает тот же безопасный контракт и завершает execution ошибкой, если обязательная проверка не получила `healthy`.

## Границы MVP

Это pull-based operational status, а не внешняя система мониторинга. В этапе 14 нет push-alerting, независимой uptime-проверки, централизованного log aggregation и автоматического incident paging. Они оцениваются после пилота, если фактическая нагрузка подтвердит необходимость.
