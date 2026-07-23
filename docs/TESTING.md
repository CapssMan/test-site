# SkillCheck — тестирование и CI

Обновлено: 23 июля 2026 года, выпуск банков v4.

## Единая команда

Требуется Node.js 20 или новее. Локально и в GitHub Actions используется один entrypoint:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Проект не имеет runtime/dev dependencies. Lockfile нужен для воспроизводимой проверки пустого dependency graph; `--ignore-scripts` исключает lifecycle scripts во время установки.

## Матрица

`scripts/run-ci.js` последовательно запускает:

1. `check-repository-secrets.js` — tracked и неигнорируемые новые файлы, запрещённые credential filenames, private key/OAuth/GitHub/Google/AWS patterns и высокоэнтропийные literal assignments защищённых properties.
2. `check-static-links.js` — локальные `href/src`, точные mappings шести public data-файлов и отсутствие публичной ссылки на `dev-quick`.
3. `check-js-syntax.js` — `Code.gs`, все `scripts/*.js` и inline JavaScript всех HTML.
4. `validate-tests.js` — структура production-банков, private answer fields и option-shape.
5. `audit-question-banks.js` — IDs, тайминги, баллы, ошибки и предупреждения 240 production-вопросов.
6. Все файлы `scripts/test-*.js` в стабильном алфавитном порядке.

Тесты покрывают расчёт, Telegram normalization, retake boundary, candidate/admin escaping, report formatter/access, submission recovery, authoritative scoring, signed tokens, legal gates, удаление, backup/restore, наблюдаемость, CI configuration и техническую ротацию банков. Для v4 отдельно проверяются zero legacy reuse, отсутствие закрытых полей, детерминированная private/public сборка, containment/symlink boundaries и crash recovery атомарного promoter.

Текущая матрица: 5 infrastructure validators + 22 regression suite = 27 проверок. Аудит production-банков: 240 вопросов, 0 ошибок, 0 предупреждений.

Любой ненулевой exit code или timeout отдельного скрипта 120 секунд останавливает матрицу. Runner не скрывает stdout/stderr провалившейся проверки.

## GitHub Actions

Workflow `.github/workflows/ci.yml` запускается на:

- push в `main`;
- pull request;
- ручной `workflow_dispatch`.

Безопасные ограничения:

- только `permissions: contents: read`;
- один job на `ubuntu-latest`, timeout 10 минут;
- `actions/checkout@v6` и `actions/setup-node@v6` закреплены полными commit SHA, checkout credentials не сохраняются, Node.js 24;
- checkout получает полную Git history, потому что проверка private-bank bootstrap сверяет immutable legacy commit `70e569cf…`;
- нет `${{ secrets.* }}`, environments, deploy, `clasp`, production URL или внешнего storage;
- повторный push отменяет устаревший run той же ветки;
- CI только читает checkout и выполняет локальные проверки.

Workflow сознательно не выполняет production smoke: публичный API, Apps Script quota и Яндекс Диск не должны становиться зависимостью каждого pull request.

## Добавление проверки

- Новый regression test назвать `scripts/test-<scope>.js`; runner подхватит его автоматически.
- Infrastructure validator добавить явно в `fixedChecks`, чтобы порядок был очевиден.
- Проверка должна быть детерминированной, не требовать сети/secrets и завершаться ненулевым кодом при ошибке.
- Не ослаблять secret scan ради настоящего credential. Для synthetic fixtures использовать явно тестовые низкоэнтропийные значения.
- Перед push выполнить `npm test` и `git diff --check`.

## Граница этапа

CI подтверждает целостность репозитория, но не заменяет ручной production deployment, owner-only storage verification, browser/mobile QA и внешний legal/SME review. Эти действия остаются отдельными контролируемыми процедурами.
