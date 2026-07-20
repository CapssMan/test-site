const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");

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

assert.match(frontend, /const FRONTEND_BUILD = "2026\.07\.20\.7"/);
assert.match(backend, /const BACKEND_VERSION = "yandex-disk-mvp-2026-07-20-6"/);
assert.match(frontend, /const PENDING_RESULT_TTL_MS = 24 \* 60 \* 60 \* 1000/, "pending result must expire after 24 hours");
assert.match(frontend, /const MAX_AUTOMATIC_RETRIES = 2/, "two automatic retries are required");
assert.match(frontend, /AUTOMATIC_RETRY_DELAYS_MS = \[1500, 4000\]/, "retry must use bounded backoff");
assert.match(frontend, /если сервер временно недоступен[\s\S]{0,240}не более 24 часов/i, "candidate must be told about local pending storage");
assert.match(privacy, /локальное хранилище браузера[\s\S]{0,1200}не более чем на 24 часа/i, "privacy page must describe local pending storage");

const domReady = /document\.addEventListener\("DOMContentLoaded"[\s\S]*?\n    \}\);/.exec(frontend);
assert(domReady, "DOMContentLoaded handler not found");
assert(domReady[0].indexOf("restorePendingResult()") < domReady[0].indexOf("loadQuestions()"), "pending result must restore before loading a new attempt");

const finishTest = extractFunction(frontend, "finishTest");
assert(finishTest.indexOf("persistPendingResult(resultData)") < finishTest.indexOf("sendResult(resultData)"), "result must be persisted before its first network send");

const sendResult = extractFunction(frontend, "sendResult");
assert.match(sendResult, /resultSubmissionInFlight \|\| resultSaved/, "double submission must remain blocked");
assert.match(sendResult, /sendResultAttempt\(data, 0\)/, "submission must use the bounded retry series");
assert.match(sendResult, /clearPendingResult\(data\.testId, data\.requestId\)/, "confirmed result must clear its local backup");

const retryAttempt = extractFunction(frontend, "sendResultAttempt");
assert.match(retryAttempt, /retryIndex >= MAX_AUTOMATIC_RETRIES/, "automatic retries must be bounded");
assert.match(retryAttempt, /waitForSubmissionRetry\(delay\)/, "retry must wait for backoff");
assert.match(extractFunction(frontend, "postResultOnce"), /NETWORK_TIMEOUT_MS/, "each request must retain a timeout");
assert.match(frontend, /window\.addEventListener\("online"/, "pending result must retry when connectivity returns");

const logFunction = extractFunction(frontend, "logSubmissionEvent");
assert.doesNotMatch(logFunction, /\bemail\b|\btelegram\b|browserFingerprint|\banswers\b|\bname\s*:|JSON\.stringify\(data\)|\bbody\b/i, "submission logs must not contain personal data or payloads");
assert.match(logFunction, /slice\(-8\)/, "logs may include only a masked request id");

const saveSource = extractFunction(backend, "saveTestResult");
assert(saveSource.indexOf('submissionState: "reserved"') < saveSource.indexOf("uploadTextToYandexDisk"), "code reservation must happen before report upload");
assert(saveSource.indexOf("findAttemptByRequestId") < saveSource.indexOf("checkAttemptHash"), "reserved attempt must resume before retake rejection");
assert.match(saveSource, /submissionState: "completed"/, "successful transaction must complete its reservation");
assert.match(saveSource, /retryable: true[\s\S]*failureCode: "temporary_storage_error"/, "partial storage failures must be explicitly retryable");
assert.match(extractFunction(backend, "generateUniqueResultCode"), /getAttemptsFilePath/, "reserved codes must participate in uniqueness checks");
assert.match(extractFunction(backend, "appendAdminResult"), /existingIndex[\s\S]*Object\.assign/, "admin write must upsert instead of append duplicates");

const attemptWriter = extractFunction(backend, "upsertAttemptRecord");
assert.doesNotMatch(attemptWriter, /\bemail\s*:|telegram|browserFingerprint\s*:|\bname\s*:/i, "private reservation must not store raw candidate data");
assert.match(attemptWriter, /payloadHash/, "reservation must bind retries to one payload hash");
assert.match(attemptWriter, /requestId/, "reservation must be keyed by request id");

const doPost = extractFunction(backend, "doPost");
assert.doesNotMatch(doPost, /errorMessage:\s*sanitizeDiagnosticMessage/, "public POST errors must not expose diagnostics");
assert.match(doPost, /failureCode: "request_processing_error"/, "public POST errors need a safe machine-readable code");

const storage = new Map();
const frontendContext = {
  String,
  Number,
  Boolean,
  Array,
  Date,
  JSON,
  isFinite,
  console: { warn() {} },
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  }
};

vm.runInNewContext(
  "const PENDING_RESULT_SCHEMA_VERSION = 1;\n" +
  "const PENDING_RESULT_TTL_MS = 86400000;\n" +
  "const QUESTIONS_PER_ATTEMPT = 40;\n" +
  "const AUTOMATIC_RETRY_DELAYS_MS = [1500, 4000];\n" +
  extractFunction(frontend, "getPendingResultStorageKey") + "\n" +
  extractFunction(frontend, "buildPendingResultEnvelope") + "\n" +
  extractFunction(frontend, "validatePendingResultEnvelope") + "\n" +
  extractFunction(frontend, "persistPendingResult") + "\n" +
  extractFunction(frontend, "loadPendingResult") + "\n" +
  extractFunction(frontend, "clearPendingResult") + "\n" +
  extractFunction(frontend, "isTransientHttpStatus") + "\n" +
  extractFunction(frontend, "getSubmissionRetryDelay"),
  frontendContext
);

const pendingData = {
  requestId: "sc_1234567890abcdef",
  testId: "dev-quick",
  finalScore: 90,
  percent: 90,
  answers: [{ number: 1 }],
  blockResults: { smoke: { name: "Smoke", percent: 90 } }
};
const now = 1000000;
const envelope = frontendContext.buildPendingResultEnvelope(pendingData, now);
assert.equal(envelope.expiresAt, now + 86400000);
assert.equal(frontendContext.validatePendingResultEnvelope(envelope, "dev-quick", now + 1), pendingData);
assert.equal(frontendContext.validatePendingResultEnvelope(envelope, "dev-quick", envelope.expiresAt), null, "expired pending result must be rejected");
assert.equal(frontendContext.validatePendingResultEnvelope(envelope, "fa-junior", now + 1), null, "another test must not restore this result");

assert.equal(frontendContext.persistPendingResult(pendingData), true);
assert.equal(frontendContext.loadPendingResult("dev-quick").requestId, pendingData.requestId);
frontendContext.clearPendingResult("dev-quick", "sc_different12345678");
assert(storage.size > 0, "a different request id must not clear pending data");
frontendContext.clearPendingResult("dev-quick", pendingData.requestId);
assert.equal(storage.size, 0, "confirmed request must clear pending data");
assert.equal(frontendContext.isTransientHttpStatus(503), true);
assert.equal(frontendContext.isTransientHttpStatus(400), false);
assert.equal(frontendContext.getSubmissionRetryDelay(0), 1500);
assert.equal(frontendContext.getSubmissionRetryDelay(1), 4000);

let adminRows = [];
let attemptRows = [];
let generatedCodes = 0;
let reportFailuresRemaining = 1;
let lockReleases = 0;

const backendContext = {
  String,
  Number,
  Boolean,
  Object,
  Date,
  isFinite,
  SUCCESS_THRESHOLD: 80,
  TEST_TITLES_BY_ID: { "dev-quick": "Dev Quick Smoke Test" },
  console: { log() {}, error() {} },
  LockService: {
    getScriptLock: () => ({
      waitLock() {},
      releaseLock() { lockReleases += 1; }
    })
  },
  ensureSkillCheckFolders() {},
  normalizeSubmissionRequestId: value => /^sc_[A-Za-z0-9-]{16,80}$/.test(String(value || "")) ? String(value) : "",
  normalizeTelegramContact: value => String(value || ""),
  buildSubmissionPayloadHash: data => "hash:" + data.testId + ":" + data.finalScore + ":" + data.percent,
  findAdminResultByRequestId: requestId => adminRows.find(row => row.requestId === requestId) || null,
  findAttemptByRequestId: requestId => attemptRows.find(row => row.requestId === requestId) || null,
  buildSubmissionConflictResponse: () => ({ ok: false, retryable: false, failureCode: "submission_conflict" }),
  maskRequestIdForLog: () => "...masked",
  buildSavedResultResponse: (row, replayed) => ({ ok: true, status: "ok", code: row.code, resultCode: row.code, testId: row.testId, finalScore: row.finalScore, percent: row.percent, passStatus: row.status, reportCreated: Boolean(row.reportCreated), replayed }),
  checkAttemptHash: () => ({ allowed: true }),
  generateUniqueResultCode: () => { generatedCodes += 1; return "DEV-STG9A"; },
  hashAttemptIdentifiers: () => ({ emailHash: "email-hash", fingerprintHash: "fingerprint-hash" }),
  upsertAttemptRecord: row => {
    const index = attemptRows.findIndex(item => item.requestId === row.requestId || item.code === row.code);
    if (index >= 0) attemptRows[index] = { ...attemptRows[index], ...row };
    else attemptRows.push({ ...row });
  },
  getReportsFolderPath: () => "disk:/skillcheck/reports",
  joinDiskPath: (folder, name) => folder + "/" + name,
  buildTxtReport: () => "report",
  uploadTextToYandexDisk: () => {
    if (reportFailuresRemaining > 0) {
      reportFailuresRemaining -= 1;
      throw new Error("temporary report upload failure");
    }
  },
  appendAdminResult: row => {
    const index = adminRows.findIndex(item => item.requestId === row.requestId || item.code === row.code);
    if (index >= 0) adminRows[index] = { ...adminRows[index], ...row };
    else adminRows.push({ ...row });
  }
};

vm.runInNewContext(extractFunction(backend, "saveTestResult"), backendContext);

const submission = {
  requestId: "sc_stage9reliable001",
  testId: "dev-quick",
  testTitle: "Dev Quick Smoke Test",
  name: "Test Candidate",
  email: "stage9@example.invalid",
  telegram: "",
  browserFingerprint: "stage9-browser",
  finalScore: 90,
  percent: 90,
  answers: [{ number: 1 }]
};

let response = backendContext.saveTestResult(submission);
assert.equal(response.retryable, true, "partial failure must ask the client to retry");
assert.equal(attemptRows.length, 1, "code reservation must survive the partial failure");
assert.equal(attemptRows[0].submissionState, "reserved");
assert.equal(attemptRows[0].code, "DEV-STG9A");
assert.equal(adminRows.length, 0);

response = backendContext.saveTestResult(submission);
assert.equal(response.ok, true, "retry must complete the reserved submission");
assert.equal(response.code, "DEV-STG9A", "retry must keep the reserved code");
assert.equal(generatedCodes, 1, "retry must not generate a second code");
assert.equal(adminRows.length, 1, "retry must create one admin row");
assert.equal(attemptRows.length, 1, "retry must keep one attempt row");
assert.equal(attemptRows[0].submissionState, "completed");

response = backendContext.saveTestResult(submission);
assert.equal(response.replayed, true, "confirmed replay must return the existing result");
assert.equal(response.code, "DEV-STG9A");
assert.equal(generatedCodes, 1);
assert.equal(adminRows.length, 1);
assert.equal(lockReleases, 3, "every locked submission path must release the lock");

adminRows = [];
attemptRows = [];
generatedCodes = 0;
reportFailuresRemaining = 1;
response = backendContext.saveTestResult(submission);
assert.equal(response.retryable, true);
response = backendContext.saveTestResult({ ...submission, finalScore: 91, percent: 91 });
assert.equal(response.failureCode, "submission_conflict", "changed payload must not resume a reservation");
assert.equal(response.retryable, false);
assert.equal(generatedCodes, 1);

console.log("Submission reliability tests passed: local recovery, bounded retry, reservation, resume and replay.");
