const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const report = read("docs/PILOT_READINESS.md");
const code = read("apps-script/Code.gs");
const privacy = read("privacy.html");
const consent = read("consent.html");

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
  "PILOT_READINESS.md"
].forEach(fragment => assert.ok(read("README.md").includes(fragment), `README missing: ${fragment}`));

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
