const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const match = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(").exec(source);
  assert(match, "Function not found: " + name);
  const openingBrace = source.indexOf("{", match.index);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }

  throw new Error("Function end not found: " + name);
}

const inlineScripts = Array.from(frontend.matchAll(/<script>([\s\S]*?)<\/script>/g));
assert.equal(inlineScripts.length, 1, "admin page must contain one inline application script");
new vm.Script(inlineScripts[0][1], { filename: "admin.html" });
new vm.Script(backend, { filename: "Code.gs" });

const requestFunction = extractFunction(frontend, "requestAdminAction");
assert.match(requestFunction, /method:\s*"POST"/, "admin data must use POST");
assert.match(requestFunction, /JSON\.stringify\(Object\.assign\([^\n]+password:\s*password/, "password must be in POST body");
assert.doesNotMatch(requestFunction, /[?&]password=/, "password must never be added to URL");
assert.doesNotMatch(frontend, /adminResultsCallback_|createElement\("script"\)/, "password-bearing JSONP must be removed");
assert.doesNotMatch(frontend, /reportPath|reportCode/, "internal report locations must not reach the admin UI");
assert.doesNotMatch(frontend, /mock(?:Data|Results)|ADMIN_PASSWORD\s*=|password\s*:\s*["'][^"']{4,}["']/, "frontend must not contain mock results or a hard-coded password");

const doGetFunction = extractFunction(backend, "doGet");
assert.doesNotMatch(doGetFunction, /params\.password/, "GET must not accept the admin password");
assert.match(doGetFunction, /административных операций требуется POST-запрос/, "legacy admin GET must be rejected");

const frontendContext = { Array, Boolean, Date, Number, Object, String };
const frontendFunctions = [
  "normalizeResultCode",
  "normalizeAdminRows",
  "filterAndSortResults",
  "calculateAdminMetrics",
  "buildTestDistribution",
  "getAdminBadge",
  "boundedText",
  "finiteNumber",
  "dateValue",
  "escapeHtml"
].map(name => extractFunction(frontend, name)).join("\n");

vm.runInNewContext(
  'const TECHNICAL_TEST_ID = "dev-quick";\n' +
    'const TEST_LABELS = {"fa-junior":"Financial Analyst","ca-junior":"Credit Analyst","fpa-junior":"FP&A / Budget","acc-junior":"Accounting","bi-junior":"Finance BI","dev-quick":"Dev Quick"};\n' +
    'const BANK_VERSIONS = {"fa-junior":"FA Junior v4.0","ca-junior":"CA Junior v4.0","fpa-junior":"FP&A Junior v4.0","acc-junior":"ACC Junior v4.0","bi-junior":"BI Junior v4.0","dev-quick":"DEV Quick v2.0"};\n' +
    frontendFunctions,
  frontendContext
);

const fixture = [
  {
    code: "FA-AAAA2",
    testId: "fa-junior",
    testTitle: "private@example.com",
    finalScore: 90,
    percent: 93,
    tabSwitches: 1,
    date: "2026-07-02T10:00:00.000Z",
    status: "passed",
    badge: "private@example.com",
    reportCreated: true,
    reportPath: "disk:/private/report.txt",
    email: "private@example.com",
    fingerprintHash: "private-hash"
  },
  {
    code: "CA-BBBB2",
    testId: "ca-junior",
    finalScore: 55,
    percent: 55,
    tabSwitches: 0,
    date: "2026-07-01T10:00:00.000Z",
    status: "failed",
    reportCreated: false
  },
  {
    code: "DEV-CCCC3",
    testId: "dev-quick",
    finalScore: 100,
    percent: 100,
    date: "2026-07-03T10:00:00.000Z",
    status: "passed",
    reportCreated: true
  },
  {
    code: "FA-DDDD4",
    testId: "fa-junior",
    finalScore: 70,
    percent: 70,
    date: "invalid-date",
    status: "failed",
    reportCreated: false
  }
];

const normalized = frontendContext.normalizeAdminRows(fixture);
assert.deepEqual(
  Object.keys(normalized[0]).sort(),
  ["badge", "bankVersion", "code", "date", "finalScore", "percent", "reportCreated", "scoreVerification", "scoringAlgorithmVersion", "status", "tabSwitches", "telemetryVerification", "testId", "testTitle"].sort(),
  "frontend must keep only the anonymous contract"
);
assert.equal(normalized[0].email, undefined, "email must be stripped");
assert.equal(normalized[0].fingerprintHash, undefined, "hash must be stripped");
assert.equal(normalized[0].reportPath, undefined, "report path must be stripped");
assert.equal(normalized[0].testTitle, "Financial Analyst", "test title must be derived from known test id");
assert.equal(normalized[0].badge, "Junior Strong", "badge must be derived from score and tab switches");
assert.equal(normalized[0].scoreVerification, "client-reported-unverified", "admin must label client-reported scores as unverified");

const verifiedFrontendRow = frontendContext.normalizeAdminRows([{
  code: "FA-EEE25",
  testId: "fa-junior",
  finalScore: 90,
  percent: 90,
  tabSwitches: 99,
  date: "2026-07-20T10:00:00.000Z",
  status: "passed",
  reportCreated: true,
  scoreVerification: "server-verified",
  scoringAlgorithmVersion: "authoritative-v1",
  bankVersion: "FA Junior v4.0",
  telemetryVerification: "client-reported-unverified"
}])[0];
assert.equal(verifiedFrontendRow.scoreVerification, "server-verified");
assert.equal(verifiedFrontendRow.badge, "Junior Strong", "verified badge must ignore unverified tab telemetry");
assert.equal(frontendContext.normalizeAdminRows([{ ...verifiedFrontendRow, scoringAlgorithmVersion: "other" }])[0].scoreVerification, "client-reported-unverified");
assert.equal(frontendContext.normalizeAdminRows([{ ...verifiedFrontendRow, bankVersion: "FA Junior v2.3" }])[0].scoreVerification, "client-reported-unverified");

const revokeFrontend = extractFunction(frontend, "revokeAdminInvite");
assert.match(revokeFrontend, /if \(!pendingInviteRevocations\[inviteId\]\)/, "lost revoke responses must reuse one scr_ request id");
assert.match(revokeFrontend, /requestId:\s*pendingInviteRevocations\[inviteId\]/);
assert(
  revokeFrontend.indexOf("delete pendingInviteRevocations[inviteId]") > revokeFrontend.indexOf("if (data.ok !== true)"),
  "revoke id may be cleared only after server success"
);

const defaultRows = frontendContext.filterAndSortResults(normalized, { sortOrder: "date-desc" });
assert.deepEqual(Array.from(defaultRows, row => row.code), ["FA-AAAA2", "CA-BBBB2", "FA-DDDD4"], "technical rows hidden by default and dates sorted newest first");

const devRows = frontendContext.filterAndSortResults(normalized, { test: "dev-quick", sortOrder: "date-desc" });
assert.deepEqual(Array.from(devRows, row => row.code), ["DEV-CCCC3"], "technical test can be selected explicitly");

const searchedRows = frontendContext.filterAndSortResults(normalized, { search: "bbbb", sortOrder: "date-desc" });
assert.deepEqual(Array.from(searchedRows, row => row.code), ["CA-BBBB2"], "code search must be case-insensitive");

const failedByScore = frontendContext.filterAndSortResults(normalized, { status: "failed", sortOrder: "score-asc" });
assert.deepEqual(Array.from(failedByScore, row => row.code), ["CA-BBBB2", "FA-DDDD4"], "status filter and score sorting");

assert.deepEqual(
  JSON.parse(JSON.stringify(frontendContext.calculateAdminMetrics(defaultRows))),
  { total: 3, passed: 1, failed: 2, passRate: 33, averageScore: 72, reports: 1 },
  "dashboard metrics"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(frontendContext.buildTestDistribution(defaultRows))),
  { "fa-junior": 2, "ca-junior": 1 },
  "test distribution"
);
assert.equal(frontendContext.escapeHtml('<img src=x onerror="boom">'), "&lt;img src=x onerror=&quot;boom&quot;&gt;", "table values must be escaped");

const backendVersion = /^const BACKEND_VERSION = "([^"]+)";/m.exec(backend);
assert(backendVersion, "backend version not found");
const storedRows = fixture;
const backendContext = {
  Date,
  Number,
  String,
  Boolean,
  isAdminPasswordValid: password => password === "correct-password",
  getRequiredProperty: () => "correct-password",
  getAdminFilePath: () => "disk:/skillcheck/admin/results.json",
  readJsonFromYandexDisk: () => storedRows
};

vm.runInNewContext(
  'const BACKEND_VERSION = "' + backendVersion[1] + '";\n' +
    'const SUCCESS_THRESHOLD = 80;\n' +
    'const SCORE_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";\n' +
    'const SCORE_VERIFICATION_SERVER = "server-verified";\n' +
    'const AUTHORITATIVE_SCORING_VERSION = "authoritative-v1";\n' +
    'const BANK_VERSIONS_BY_ID = {"fa-junior":"FA Junior v4.0","ca-junior":"CA Junior v4.0","fpa-junior":"FP&A Junior v4.0","acc-junior":"ACC Junior v4.0","bi-junior":"BI Junior v4.0","dev-quick":"DEV Quick v2.0"};\n' +
    'const TEST_TITLES_BY_ID = {"fa-junior":"Financial Analyst Junior","ca-junior":"Credit Analyst Junior","fpa-junior":"FP&A / Budgeting Junior","acc-junior":"Accounting Junior","bi-junior":"Finance BI Junior","dev-quick":"Dev Quick Test"};\n' +
    extractFunction(backend, "normalizeResultCode") + "\n" +
    extractFunction(backend, "getAdminBadge") + "\n" +
    extractFunction(backend, "sanitizeAdminResult") + "\n" +
    extractFunction(backend, "getAdminResults"),
  backendContext
);

const denied = backendContext.getAdminResults("wrong-password");
assert.equal(denied.ok, false, "wrong password must be rejected");
assert.equal(denied.results, undefined, "denied response must not contain results");

const allowed = backendContext.getAdminResults("correct-password");
assert.equal(allowed.ok, true, "correct password must be accepted");
assert.equal(allowed.backendVersion, backendVersion[1], "backend version must be returned");
assert.equal(Array.isArray(allowed.results), true, "admin results array");
assert.equal(allowed.results[0].email, undefined, "backend must strip email");
assert.equal(allowed.results[0].fingerprintHash, undefined, "backend must strip hashes");
assert.equal(allowed.results[0].reportPath, undefined, "backend must strip report path");
assert.equal(allowed.results[0].testTitle, "Financial Analyst Junior", "backend must derive a known test title");
assert.equal(allowed.results[0].badge, "Junior Strong", "backend must derive the badge");
assert.deepEqual(
  Object.keys(allowed.results[0]).sort(),
  ["advisoryPenalty", "badge", "bankVersion", "code", "date", "finalScore", "percent", "reportCreated", "scoreVerification", "scoringAlgorithmVersion", "status", "tabSwitches", "telemetryVerification", "testId", "testTitle"].sort(),
  "backend anonymous contract"
);
assert.equal(allowed.results[0].scoreVerification, "client-reported-unverified", "backend must label client-reported scores as unverified");

const verifiedBackendRow = backendContext.sanitizeAdminResult({
  code: "FA-EEE25",
  testId: "fa-junior",
  rawScore: 80,
  rawTotal: 100,
  percent: 80,
  finalScore: 80,
  tabSwitches: 99,
  date: "2026-07-20T10:00:00.000Z",
  status: "passed",
  badge: "Junior Strong",
  reportCreated: true,
  scoreVerification: "server-verified",
  scoringAlgorithmVersion: "authoritative-v1",
  bankVersion: "FA Junior v4.0",
  telemetryVerification: "client-reported-unverified"
});
assert.equal(verifiedBackendRow.scoreVerification, "server-verified");
assert.equal(verifiedBackendRow.badge, "Junior Strong");
assert.equal(backendContext.sanitizeAdminResult({ ...verifiedBackendRow, scoringAlgorithmVersion: "other" }).scoreVerification, "client-reported-unverified");
assert.equal(backendContext.sanitizeAdminResult({ ...verifiedBackendRow, bankVersion: "FA Junior v2.3" }).scoreVerification, "client-reported-unverified");

console.log("Admin panel tests passed: transport, access rejection, privacy contract, filters, sorting, metrics, distributions and escaping.");
