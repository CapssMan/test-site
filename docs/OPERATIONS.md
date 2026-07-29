# SkillCheck — руководство оператора

Обновлено: 29 июля 2026 года, российский frontend/runtime cutover.

Это главная точка входа для эксплуатации SkillCheck. Она не заменяет тематические runbooks, а задаёт порядок действий и безопасные границы.

## Текущее состояние

Production runtime: candidate `Build 2026.07.29.2`, admin `Build 2026.07.28.1`, functions `assessment-v4`/`admin-v2`/`read-v3`/`write-v4`, API `attempt-v2`, YDB + private/public Object Storage. Российский сайт: `https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net/`.

Сервис технически готов к контролируемому пилоту, но не открыт для реальных кандидатов. Legal approval и issuance закрыты, retention automation включён. Главные внешние blockers: legal/privacy решение по реквизитам и регламенту, независимый человеческий SME sign-off v4 и owner sign-off; девять legacy smoke-кодов не удаляются и проверяемо исключены.

## Карта процедур

| Ситуация | Документ |
|---|---|
| Локальные тесты и CI | `TESTING.md` |
| Публикация и rollback | `DEPLOYMENT.md` |
| Ежедневная диагностика/ошибка | `OBSERVABILITY.md` |
| Snapshot, corrupt store, restore | `BACKUP_AND_RECOVERY.md` |
| Удаление результата/попытки | `DATA_DELETION.md` |
| Privacy/legal решение | `PRIVACY_CHECKLIST.md`, `LEGAL_PRIVACY_REVIEW.md` |
| Сбор входных решений перед пилотом | `PRE_PILOT_INPUTS.md` |
| Передача заданий внешним SME/legal специалистам | `EXTERNAL_REVIEW_BRIEF.md` |
| Проведение первой контролируемой волны | `PILOT_RUNBOOK.md` |
| Ротация банков v4 | `QUESTION_BANK_ROTATION.md` |
| Ротация Яндекс credential | `YANDEX_CREDENTIAL_ROTATION.md` |
| Security boundaries | `SECURITY_AUDIT.md` |
| Состояние и следующие этапы | `../PROJECT_STATUS.md`, `../ROADMAP.md` |

## Нормальная проверка

1. Из корня репозитория выполнить `powershell -ExecutionPolicy Bypass -File .\scripts\check-pre-pilot-live.ps1`: скрипт только читает 13 файлов на Yandex/GitHub, ranking/health/CORS и закрытый assessment gate, не запрашивает пароль и не изменяет данные.
2. Вручную открыть основной Yandex URL на desktop и mobile, проверить главную, рейтинг, privacy/consent, старт теста без приглашения и отсутствие горизонтальной прокрутки/ошибок.
3. Войти в admin и запросить защищённую YDB-диагностику: версии, gates, row counts и private storage state.
4. Сверить неожиданные counts с известными операциями; не открывать raw storage для обычного мониторинга.
5. Проверить последний GitHub Actions для `main` как source/rollback validation.
6. При warning/error следовать `OBSERVABILITY.md`, сохраняя pilot gates закрытыми.

Health `ok:true` не означает, что YDB, private banks или отчёты исправны. Полная диагностика доступна только после admin-auth.
## Уровни реакции

| Уровень | Пример | Действие |
|---|---|---|
| S1 | возможная утечка, неверный scoring, массовая потеря/подмена данных | немедленно закрыть issuance, остановить rollout, привлечь владельца/privacy-security ответственного |
| S2 | storage unavailable, corrupt operational store, submission failures | не создавать новые попытки, диагностировать, использовать backup/rollback runbook |
| S3 | единичная UI/документационная ошибка без потери данных | зарегистрировать, воспроизвести локально, исправить через обычный CI/deploy |

Нельзя восстанавливать store, удалять данные или ротировать credential только по публичному health. Сначала определить точный компонент и получить owner context.

## Передача смены или владельца

Передающий сообщает без секретов:

- текущий Git commit и runtime versions;
- состояние CI/Pages/health/protected status;
- значения pilot gates как `true/false`, но не остальные Script Properties;
- активные инциденты, deletion requests и незавершённые recovery;
- дату последней backup-проверки и credential review;
- согласованный следующий шаг и ответственного.

OAuth-токены, пароли, salts, signing secrets, deployment ID и private-bank digests передаются только через утверждённый закрытый credential channel.

## Stop conditions

Новые приглашения и rollout запрещены, если выполняется хотя бы одно условие:

- CI красный или проверяемая версия не совпадает с опубликованной;
- protected status не `healthy` либо private/operational store отсутствует или повреждён;
- privacy notice/consent/operator contacts не утверждены;
- текущие банки v4 не получили независимый человеческий SME sign-off;
- неизвестно, кто отвечает за rollback/incident;
- есть нерешённый S1/S2 incident;
- требуется действие с production-данными, но scope или backup не подтверждены.

## Запреты

- не хранить production JSON/TXT локально без явной операционной необходимости и срока удаления;
- не исправлять production store ручным редактированием;
- не отправлять bearer invite в query string;
- не сообщать кандидату существование/отсутствие записи по непроверенному email;
- не использовать test score как единственное автоматическое решение о найме;
- не включать gates «для проверки» на неопределённый срок;
- не публиковать диагностический ответ, если он может содержать operational metadata.
