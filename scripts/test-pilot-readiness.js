const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const report = read("docs/PILOT_READINESS.md");
const code = read("apps-script/Code.gs");
const privacy = read("privacy.html");
const consent = read("consent.html");
const smeHandoff = read("docs/SME_REVIEW_HANDOFF.md");
const prePilotInputs = read("docs/PRE_PILOT_INPUTS.md");
const pilotRunbook = read("docs/PILOT_RUNBOOK.md");
const productVision = read("docs/PRODUCT_VISION.md");

[
  "NO-GO для реальных кандидатов",
  "LEGAL_PILOT_APPROVED=false",
  "ATTEMPT_ISSUANCE_ENABLED=false",
  "RETENTION_AUTOMATION_ENABLED=false",
  "Исторически раскрытый answer key",
  "Яндекс credential",
  "Чистая pilot-база",
  "3–5 работодателями/рекрутерами и 10–30 прохождениями"
].forEach(fragment => assert.ok(report.includes(fragment), `pilot report missing: ${fragment}`));

[
  "test-operations-docs.js",
  "PILOT_READINESS.md",
  "SME_REVIEW_HANDOFF.md",
  "PILOT_RUNBOOK.md"
].forEach(fragment => assert.ok(read("README.md").includes(fragment), `README missing: ${fragment}`));

[
  "240 вопросов",
  "Не загружать в Git",
  "READY FOR OWNER DECISION",
  "не включает legal/retention",
  "На доработку",
  "Отклонить"
].forEach(fragment => assert.ok(smeHandoff.includes(fragment), `SME handoff missing: ${fragment}`));

["Публичные реквизиты оператора", "Внешнее legal/retention решение", "Подтверждение очистки smoke-данных", "Финальный owner sign-off"]
  .forEach(fragment => assert.ok(prePilotInputs.includes(fragment), `pre-pilot inputs missing: ${fragment}`));

[
  "подготовлен, пилот не начат",
  "LEGAL_PILOT_APPROVED=false",
  "ATTEMPT_ISSUANCE_ENABLED=false",
  "RETENTION_AUTOMATION_ENABLED=false",
  "3–5 работодателей или рекрутеров",
  "10–30 завершённых прохождений",
  "L1 — непубличное персональное приглашение без подтверждения юридической личности",
  "retake, fingerprint и signed attempt являются deterrence",
  "запрещена формулировка «личность кандидата подтверждена»",
  "не более пяти одновременно",
  "не `0`",
  "Немедленно выключить issuance",
  "достигнут лимит 30 завершённых прохождений"
].forEach(fragment => assert.ok(pilotRunbook.includes(fragment), `pilot runbook missing: ${fragment}`));

assert.doesNotMatch(pilotRunbook, /пилот (?:запущен|начат)/i,
  "pilot runbook must not claim that the blocked pilot has started");

[
  "двусторонней платформой проверенных профессиональных навыков",
  "участвовать в рейтинге только по явному opt-in",
  "объяснимый shortlist",
  "один тест доказывает профессиональную пригодность",
  "Публичный рейтинг нельзя строить как один глобальный список по raw score",
  "L1 controlled invite",
  "Публичный self-service рейтинг требует как минимум спроектированного L2",
  "Что намеренно не делаем до пилота"
].forEach(fragment => assert.ok(productVision.includes(fragment), `product vision missing: ${fragment}`));

assert.match(read("ROADMAP.md"), /Долгосрочная продуктовая цель[\s\S]*docs\/PRODUCT_VISION\.md/);
assert.match(read("README.md"), /docs\/PRODUCT_VISION\.md/);
assert.match(read("docs/PROJECT_STRUCTURE.md"), /PRODUCT_VISION\.md/);

assert.match(code, /const PUBLIC_DEV_TEST_ENABLED = false;/);
assert.match(code, /const RETENTION_AUTOMATION_ENABLED = false;/);
assert.match(code, /if \(!isLegalPilotApproved\(\)\) return buildAttemptUnavailableResponse\(\);/);
assert.match(code, /getScriptProperty\("ATTEMPT_ISSUANCE_ENABLED"\) !== "true"/);
assert.match(code, /assertAllowedObjectKeys\(source, \["questionId", "optionId", "timedOut", "timeSpent"\]/);
assert.match(code, /consumeRateLimit\("begin-attempt-global"/);
assert.match(code, /consumeRateLimit\("save-result-global"/);
assert.match(code, /function verifyProtectedDiagnosticsForOwner\(\)/);
assert.match(code, /function createOperationalBackupsForOwner\(\)/);

assert.match(privacy, /Наименование\/ФИО оператора: не указано/);
assert.match(consent, /Email для обращений по персональным данным: не указан/);
assert.doesNotMatch(report, /\[x\].*(реквизит|legal|credential|smoke|SME sign-off)/i,
  "external blockers must not be marked complete");
assert.match(read("ROADMAP.md"), /\[x\].*Техническая содержательная ротация пяти банков/,
  "technical v4 rotation must be recorded separately");
assert.match(read("ROADMAP.md"), /\[ \].*независимый человеческий SME sign-off/,
  "independent human SME gate must remain open");

console.log("Stage 17 pilot-readiness checks passed: technical controls documented, launch remains NO-GO.");
