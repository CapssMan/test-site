const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps-script", "appsscript.json"), "utf8"));
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const banks = fs.readdirSync(path.join(root, "data"))
  .filter(name => name.endsWith(".json"))
  .map(name => JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8")))
  .filter(bank => bank && bank.testId);

const constantsContext = {};
const backendPreamble = backend.slice(0, backend.indexOf("function doGet"));
vm.runInNewContext(
  backendPreamble +
  "\nthis.securityConstants = {" +
  "SUCCESS_THRESHOLD, MAX_ANSWERS_PER_RESULT, SCORE_VERIFICATION_CLIENT_REPORTED, PUBLIC_DEV_TEST_ENABLED," +
  "TEST_TITLES_BY_ID, EXPECTED_ANSWERS_BY_TEST_ID, ALLOWED_ENGLISH_LEVELS," +
  "ALLOWED_CANDIDATE_SOURCES, ALLOWED_CANDIDATE_EXPERIENCE, TEST_VERSIONS_BY_ID," +
  "BANK_VERSIONS_BY_ID, ALLOWED_BLOCKS_BY_TEST_ID};",
  constantsContext
);
const backendConstants = clone(constantsContext.securityConstants);

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Static transport and browser boundaries.
["index.html", "test.html", "admin.html", "privacy.html"].forEach(file => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(source, /http-equiv="Content-Security-Policy"/i, file + " must define a CSP");
  assert.match(source, /object-src 'none'/, file + " must block plugins");
  assert.match(source, /base-uri 'none'/, file + " must block base-tag URL rewriting");
  assert.match(source, /form-action 'self'/, file + " must restrict form targets");
  assert.match(source, /<meta name="referrer" content="no-referrer">/i, file + " must suppress referrer leakage");
});

const doGetSource = extractFunction(backend, "doGet");
const doPostSource = extractFunction(backend, "doPost");
const publicHealthSource = extractFunction(backend, "buildPublicHealthStatus");
const adminGuardSource = extractFunction(backend, "guardAdminRequest");
const checkAttemptHashSource = extractFunction(backend, "checkAttemptHash");
assert.doesNotMatch(doGetSource, /params\.callback|jsonOrJsonp|buildHealthStatus\(/, "GET must not expose JSONP or detailed storage health");
assert.doesNotMatch(publicHealthSource, /YANDEX|ADMIN_|ATTEMPT_|folder|path|storage|diagnostic/i, "public health must not expose configuration or storage state");
assert.match(doGetSource, /action === "checkAttempt"[\s\S]*methodNotAllowedResponse/, "retake checks must reject GET");
assert.match(doGetSource, /action === "adminResults" \|\| action === "adminReport"[\s\S]*methodNotAllowedResponse/, "admin routes must reject GET");
assert.match(doPostSource, /action === "saveResult"/, "result saving must require an explicit action");
assert.match(doPostSource, /unknown_action/, "unknown POST actions must be rejected");
assert.doesNotMatch(doPostSource, /return jsonResponse\(saveTestResult\(data\)\)/, "POST must not fall through to an unvalidated save");
assert.doesNotMatch(doPostSource, /sanitizeDiagnosticMessage|error\.message/, "public POST failures must not leak internal diagnostics");
assert.doesNotMatch(backend, /function\s+jsonOrJsonpResponse\b/, "JSONP response support must be removed");
assert.match(backend, /const PUBLIC_DEV_TEST_ENABLED = false;/, "technical dev test must be private by default");
assert.doesNotMatch(checkAttemptHashSource, /nextDate\s*:/, "blocked retake response must not disclose an exact next-attempt date");
assert(
  adminGuardSource.indexOf('const authGate = consumeRateLimit("admin-auth-global"') < adminGuardSource.indexOf("isAdminPasswordValid(supplied)"),
  "global admin auth gate must be consumed before password hashing"
);

const finishTestSource = extractFunction(candidate, "finishTest");
const postResultSource = extractFunction(candidate, "postResultOnce");
assert.match(finishTestSource, /action:\s*"saveResult"/, "candidate payload must declare saveResult");
assert.match(postResultSource, /action:\s*"saveResult"/, "candidate transport must preserve saveResult");
assert.match(extractFunction(candidate, "persistPendingResult"), /sessionStorage\.setItem/, "pending result must use sessionStorage");
assert.doesNotMatch(extractFunction(candidate, "persistPendingResult"), /localStorage\.setItem/, "full pending result must not persist across browser sessions");
assert.match(privacy, /sessionStorage[\s\S]*текущей вкладке/, "privacy notice must describe session-scoped recovery");

const renderQuestionSource = extractFunction(candidate, "renderCurrentQuestion");
const contextSanitizerSource = extractFunction(candidate, "sanitizeQuestionContext");
assert.match(renderQuestionSource, /sanitizeQuestionContext\(q\.context\)/, "question context must be sanitized before HTML rendering");
assert.doesNotMatch(renderQuestionSource, /html\s*\+=\s*q\.context/, "raw question context must never reach innerHTML");
assert.match(contextSanitizerSource, /allowedTags/, "context sanitizer must use an allowlist");
assert.doesNotMatch(contextSanitizerSource, /IMG:\s*true|SCRIPT:\s*true|IFRAME:\s*true|A:\s*true/, "active and remote-content tags must not be allowed");
assert.match(contextSanitizerSource, /node\.removeAttribute/, "context attributes must be removed by default");

assert.match(admin, /Баллы пока не являются серверно подтверждёнными/, "admin must disclose score-integrity limits");
assert.match(candidate, /Балл пока рассчитан в браузере и не проверен закрытым серверным ключом/, "candidate must receive the score-integrity disclosure");
assert.match(backend, /const SCORE_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified"/, "backend must use an explicit score-verification marker");

assert.deepEqual(
  manifest.oauthScopes.slice().sort(),
  [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.storage"
  ].sort(),
  "Apps Script must retain only the required explicit scopes"
);
assert.equal(manifest.webapp.executeAs, "USER_DEPLOYING");
assert.equal(manifest.webapp.access, "ANYONE_ANONYMOUS");
assert.match(gitignore, /^apps-script\/\.clasp\.json$/m, "Apps Script project binding must stay ignored");
assert.match(gitignore, /^\.clasprc\.\*$/m, "clasp credentials must stay ignored");
assert.match(gitignore, /^\.env$/m, "environment secrets must stay ignored");
assert.match(gitignore, /^token\*\.json$/m, "OAuth token files must stay ignored");

assert.equal(banks.length, 6, "security matrix must cover all six test banks");
banks.forEach(bank => {
  const expectedCount = Number(bank.questionsPerTest || Math.min(40, bank.questions.length));
  assert.equal(backendConstants.BANK_VERSIONS_BY_ID[bank.testId], bank.version, bank.testId + " bank version must match backend allowlist");
  assert.equal(backendConstants.EXPECTED_ANSWERS_BY_TEST_ID[bank.testId], expectedCount, bank.testId + " answer count must match the real attempt size");
  assert.deepEqual(
    backendConstants.ALLOWED_BLOCKS_BY_TEST_ID[bank.testId].slice().sort(),
    Object.keys(bank.blocks || {}).sort(),
    bank.testId + " block allowlist must match the real bank"
  );
});

// Minimal public health is executable without storage access, and callbacks are ignored.
const healthContext = {
  String,
  Math,
  jsonResponse: payload => payload
};
vm.runInNewContext(
  'const BACKEND_VERSION = "security-test";\n' +
  extractFunction(backend, "buildPublicHealthStatus") + "\n" +
  extractFunction(backend, "methodNotAllowedResponse") + "\n" +
  extractFunction(backend, "doGet"),
  healthContext
);
const publicHealth = healthContext.doGet({ parameter: { action: "health", callback: "stealSecrets" } });
assert.deepEqual(
  Object.keys(publicHealth).sort(),
  ["backendVersion", "ok", "service", "status"].sort(),
  "public health must expose only liveness metadata"
);
assert.equal(publicHealth.status, "alive");
assert.equal(Object.hasOwn(publicHealth, "callback"), false);
assert.equal(healthContext.doGet({ parameter: { action: "checkAttempt", email: "private@example.com" } }).status, "method_not_allowed");
assert.equal(healthContext.doGet({ parameter: { action: "adminReport", password: "secret" } }).status, "method_not_allowed");

// Request parsing rejects oversized, malformed and unsupported payloads before routing.
const parserContext = { String, Number, Object, Array, Boolean, Error, JSON, isFinite };
vm.runInNewContext(
  "const MAX_POST_BODY_CHARS = 250000;\n" +
  extractFunction(backend, "publicRequestError") + "\n" +
  extractFunction(backend, "isPlainObject") + "\n" +
  extractFunction(backend, "parseRequestBody"),
  parserContext
);

function expectParserFailure(event, failureCode) {
  assert.throws(
    () => parserContext.parseRequestBody(event),
    error => Boolean(error && error.publicRequestError && error.failureCode === failureCode),
    "parseRequestBody must reject with " + failureCode
  );
}

assert.equal(
  parserContext.parseRequestBody({ postData: { contents: '{"action":"health"}', type: "application/json", length: 19 } }).action,
  "health"
);
expectParserFailure({}, "empty_request");
expectParserFailure({ postData: { contents: "{", type: "application/json", length: 1 } }, "invalid_json");
expectParserFailure({ postData: { contents: "[]", type: "application/json", length: 2 } }, "invalid_json_object");
expectParserFailure({ postData: { contents: "{}", type: "application/x-www-form-urlencoded", length: 2 } }, "unsupported_content_type");
expectParserFailure({ postData: { contents: "{}", type: "application/json", length: 250001 } }, "payload_too_large");
expectParserFailure({ postData: { contents: "x".repeat(250001), type: "text/plain", length: 250001 } }, "payload_too_large");

// Execute the strict public schema with a real positive payload and adversarial mutations.
const validationContext = {
  String,
  Number,
  Boolean,
  Array,
  Object,
  Math,
  JSON,
  Error,
  isFinite
};
const validationFunctions = [
  "safeText",
  "normalizeTelegramContact",
  "publicRequestError",
  "buildValidationErrorResponse",
  "normalizeSubmissionRequestId",
  "validateCheckAttemptRequest",
  "validateSubmissionRequest",
  "validateSubmissionAnswers",
  "buildValidatedBlockResults",
  "validateTestId",
  "assertPublicTestEnabled",
  "validateEmail",
  "validateBrowserFingerprint",
  "validateTelegramForRequest",
  "validateBoundedText",
  "validateIdentifier",
  "validateOptionalIdentifier",
  "validateEnum",
  "validateBoolean",
  "validateNumber",
  "validateInteger",
  "assertReportedNumber",
  "assertAllowedObjectKeys",
  "isPlainObject",
  "calculateServerPenalty",
  "calculateServerTrustScore",
  "getServerRecommendation",
  "getAdminBadge"
].map(name => extractFunction(backend, name)).join("\n");

vm.runInNewContext(
  'const BACKEND_VERSION = "security-test";\n' +
  'const SUCCESS_THRESHOLD = ' + JSON.stringify(backendConstants.SUCCESS_THRESHOLD) + ';\n' +
  'const MAX_ANSWERS_PER_RESULT = ' + JSON.stringify(backendConstants.MAX_ANSWERS_PER_RESULT) + ';\n' +
  'const SCORE_VERIFICATION_CLIENT_REPORTED = ' + JSON.stringify(backendConstants.SCORE_VERIFICATION_CLIENT_REPORTED) + ';\n' +
  'const PUBLIC_DEV_TEST_ENABLED = ' + JSON.stringify(backendConstants.PUBLIC_DEV_TEST_ENABLED) + ';\n' +
  'const TEST_TITLES_BY_ID = ' + JSON.stringify(backendConstants.TEST_TITLES_BY_ID) + ';\n' +
  'const EXPECTED_ANSWERS_BY_TEST_ID = ' + JSON.stringify(backendConstants.EXPECTED_ANSWERS_BY_TEST_ID) + ';\n' +
  'const ALLOWED_ENGLISH_LEVELS = ' + JSON.stringify(backendConstants.ALLOWED_ENGLISH_LEVELS) + ';\n' +
  'const ALLOWED_CANDIDATE_SOURCES = ' + JSON.stringify(backendConstants.ALLOWED_CANDIDATE_SOURCES) + ';\n' +
  'const ALLOWED_CANDIDATE_EXPERIENCE = ' + JSON.stringify(backendConstants.ALLOWED_CANDIDATE_EXPERIENCE) + ';\n' +
  'const TEST_VERSIONS_BY_ID = ' + JSON.stringify(backendConstants.TEST_VERSIONS_BY_ID) + ';\n' +
  'const BANK_VERSIONS_BY_ID = ' + JSON.stringify(backendConstants.BANK_VERSIONS_BY_ID) + ';\n' +
  'const ALLOWED_BLOCKS_BY_TEST_ID = ' + JSON.stringify(backendConstants.ALLOWED_BLOCKS_BY_TEST_ID) + ';\n' +
  validationFunctions,
  validationContext
);

function buildRealBankPayload(bank, selectedQuestions, caseName) {
  const answers = selectedQuestions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options : [];
    let correctIndex = Number(question.correct);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = options.indexOf(question.correctAnswer);
    }
    assert(correctIndex >= 0 && correctIndex < options.length, bank.testId + " question must have a resolvable correct option");
    const points = Number(question.points || 1);
    const difficulty = ["easy", "medium", "hard", "calc", "case"].includes(String(question.difficulty || "").toLowerCase())
      ? String(question.difficulty).toLowerCase()
      : "medium";
    return {
      number: index + 1,
      questionId: String(question.id || ""),
      topic: String(question.topic || ""),
      block: String(question.block || ""),
      difficulty,
      question: String(question.text || question.question || ""),
      selectedAnswer: String(options[correctIndex]),
      correctAnswer: String(options[correctIndex]),
      isCorrect: true,
      timedOut: false,
      status: "Верно",
      points,
      earnedPoints: points,
      timeLimit: Number(question.timeLimit || question.timer || question.seconds || 60),
      timeSpent: 5,
      comment: String(question.comment || question.explanation || "")
    };
  });
  const rawTotal = answers.reduce((sum, answer) => sum + answer.points, 0);
  const blockResults = {};
  answers.forEach(answer => {
    if (!blockResults[answer.block]) {
      const sourceName = bank.blocks && bank.blocks[answer.block];
      blockResults[answer.block] = {
        name: String(sourceName && sourceName.name || sourceName || answer.block),
        weight: 0,
        earned: 0,
        total: 0,
        percent: 100
      };
    }
    blockResults[answer.block].earned += answer.earnedPoints;
    blockResults[answer.block].total += answer.points;
  });
  Object.keys(blockResults).forEach(block => {
    blockResults[block].weight = blockResults[block].total / rawTotal;
  });

  return {
    action: "saveResult",
    requestId: "sc_security-" + bank.testId + "-" + caseName,
    testId: bank.testId,
    testVersion: backendConstants.TEST_VERSIONS_BY_ID[bank.testId],
    bankVersion: bank.version,
    testTitle: backendConstants.TEST_TITLES_BY_ID[bank.testId],
    name: "Security Candidate",
    email: "security@example.com",
    telegram: "@security_user",
    englishLevel: "B2",
    candidateSource: "HH.ru",
    candidateExperience: "Нет опыта",
    employerShareConsent: false,
    browserFingerprint: "deadbeef",
    score: 100,
    total: 100,
    rawScore: rawTotal,
    rawTotal,
    unansweredCount: 0,
    percent: 100,
    finalScore: 100,
    penalty: 0,
    badge: "Junior Strong",
    passStatus: "passed",
    finalDecision: "Успешно",
    recommendation: "Рекомендуется к интервью",
    tabSwitches: 0,
    trustScore: 100,
    blockResults,
    answers
  };
}

const realPayloadCases = [];
banks.forEach(bank => {
  const expectedCount = backendConstants.EXPECTED_ANSWERS_BY_TEST_ID[bank.testId];
  realPayloadCases.push(buildRealBankPayload(bank, bank.questions.slice(0, expectedCount), "first"));
  if (bank.testId === "ca-junior") {
    realPayloadCases.push(buildRealBankPayload(bank, bank.questions.slice(expectedCount, expectedCount * 2), "second"));
  }
});
assert.equal(realPayloadCases.length, 7, "six banks plus the second half of CA must be validated");
realPayloadCases.forEach(payload => {
  const result = validationContext.validateSubmissionRequest(payload);
  if (payload.testId === "dev-quick") {
    assert.equal(result.ok, false, "technical dev payload must be rejected in public mode");
    assert.equal(result.response.failureCode, "test_not_public");
  } else {
    assert.equal(result.ok, true, payload.testId + " real-bank payload must pass strict validation");
    assert.equal(result.data.answers.length, backendConstants.EXPECTED_ANSWERS_BY_TEST_ID[payload.testId]);
  }
});

const devPayload = {
  action: "saveResult",
  requestId: "sc_securitytest0001",
  testId: "dev-quick",
  testVersion: "DEV Quick v1.0",
  bankVersion: "Dev Quick Smoke Test v1.0",
  testTitle: "untrusted title",
  name: "Security Candidate",
  email: "SECURITY@EXAMPLE.COM",
  telegram: "https://t.me/security_user",
  englishLevel: "B2",
  candidateSource: "HH.ru",
  candidateExperience: "Нет опыта",
  employerShareConsent: false,
  browserFingerprint: "deadbeef",
  score: 100,
  total: 100,
  rawScore: 100,
  rawTotal: 100,
  unansweredCount: 0,
  percent: 100,
  finalScore: 100,
  penalty: 0,
  badge: "untrusted badge",
  passStatus: "passed",
  finalDecision: "untrusted decision",
  recommendation: "untrusted recommendation",
  tabSwitches: 0,
  trustScore: 100,
  blockResults: {
    smoke: { name: "Smoke test", weight: 1, earned: 100, total: 100, percent: 100 }
  },
  answers: [{
    number: 1,
    questionId: "dev_quick_001",
    topic: "Smoke test",
    block: "smoke",
    difficulty: "easy",
    question: "Security smoke question",
    selectedAnswer: "Correct option",
    correctAnswer: "Correct option",
    isCorrect: true,
    timedOut: false,
    status: "Верно",
    points: 100,
    earnedPoints: 100,
    timeLimit: 60,
    timeSpent: 5,
    comment: "Smoke explanation"
  }]
};

const privateDevSubmission = validationContext.validateSubmissionRequest(devPayload);
assert.equal(privateDevSubmission.ok, false);
assert.equal(privateDevSubmission.response.failureCode, "test_not_public");

const privateDevAttempt = validationContext.validateCheckAttemptRequest({
  action: "checkAttempt",
  testId: "dev-quick",
  email: "security@example.com",
  browserFingerprint: "deadbeef"
});
assert.equal(privateDevAttempt.ok, false);
assert.equal(privateDevAttempt.response.failureCode, "test_not_public");

const validPayload = clone(realPayloadCases.find(payload => payload.testId === "fa-junior"));
Object.assign(validPayload, {
  requestId: "sc_securitytest0001",
  testTitle: "untrusted title",
  name: "Security Candidate",
  email: "SECURITY@EXAMPLE.COM",
  telegram: "https://t.me/security_user",
  badge: "untrusted badge",
  finalDecision: "untrusted decision",
  recommendation: "untrusted recommendation"
});
const validated = validationContext.validateSubmissionRequest(validPayload);
assert.equal(validated.ok, true, "known, internally consistent submission must pass");
assert.equal(validated.data.email, "security@example.com", "email must be normalized");
assert.equal(validated.data.telegram, "@security_user", "Telegram must be normalized");
assert.equal(validated.data.testTitle, "Financial Analyst Junior", "test title must come from the server allowlist");
assert.equal(validated.data.badge, "Junior Strong", "badge must be rebuilt by the server");
assert.equal(validated.data.scoreVerification, "client-reported-unverified", "accepted score must remain explicitly unverified");

function expectSubmissionFailure(mutator, failureCode) {
  const payload = clone(validPayload);
  mutator(payload);
  const result = validationContext.validateSubmissionRequest(payload);
  assert.equal(result.ok, false, "submission mutation must be rejected");
  assert.equal(result.response.failureCode, failureCode);
  assert.equal(result.response.retryable, false);
}

expectSubmissionFailure(payload => { payload.requestId = "../../private"; }, "invalid_request_id");
expectSubmissionFailure(payload => { payload.testId = "../../private"; }, "invalid_test_id");
expectSubmissionFailure(payload => { payload.bankVersion = "forged-version"; }, "unsupported_test_version");
expectSubmissionFailure(payload => { payload.name = "x".repeat(121); }, "invalid_field");
expectSubmissionFailure(payload => { payload.email = "bad\nmail@example.com"; }, "invalid_email");
expectSubmissionFailure(payload => { payload.browserFingerprint = "../../secret"; }, "invalid_browser_fingerprint");
expectSubmissionFailure(payload => { payload.englishLevel = "admin"; }, "invalid_enum");
expectSubmissionFailure(payload => { payload.employerShareConsent = "true"; }, "invalid_boolean");
expectSubmissionFailure(payload => { payload.answers = []; }, "invalid_answers_count");
expectSubmissionFailure(payload => { payload.answers[0].earnedPoints = 0; }, "inconsistent_answer_score");
expectSubmissionFailure(payload => { payload.finalScore = 0; }, "inconsistent_result");
expectSubmissionFailure(payload => { payload.answers[0].question = "x".repeat(1001); }, "invalid_field");
expectSubmissionFailure(payload => { payload.answers[0].admin = true; }, "unknown_field");
expectSubmissionFailure(payload => { payload.answers[0].block = "__proto__"; }, "invalid_enum");
expectSubmissionFailure(payload => { payload.admin = true; }, "unknown_field");

const validAttemptCheck = validationContext.validateCheckAttemptRequest({
  action: "checkAttempt",
  testId: "fa-junior",
  email: "CANDIDATE@EXAMPLE.COM",
  browserFingerprint: "1234abcd"
});
assert.equal(validAttemptCheck.ok, true);
assert.equal(validAttemptCheck.data.email, "candidate@example.com");
assert.equal(validationContext.validateCheckAttemptRequest({ action: "checkAttempt", testId: "unknown", email: "x@y.z", browserFingerprint: "1234abcd" }).response.failureCode, "invalid_test_id");
assert.equal(validationContext.validateCheckAttemptRequest({ action: "checkAttempt", testId: "fa-junior", email: "x@y.z", browserFingerprint: "not-a-hash" }).response.failureCode, "invalid_browser_fingerprint");
assert.equal(validationContext.validateCheckAttemptRequest({ action: "checkAttempt", testId: "fa-junior", email: "x@y.z", browserFingerprint: "1234abcd", password: "leak" }).response.failureCode, "unknown_field");

// Fixed-window limits use hashed identifiers and start rejecting at the configured boundary.
const rateCache = new Map();
const rateContext = {
  String,
  Number,
  Math,
  Date,
  console: { error() {} },
  sha256Hex: () => "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  CacheService: {
    getScriptCache: () => ({
      get: key => rateCache.has(key) ? rateCache.get(key) : null,
      put: (key, value) => rateCache.set(key, String(value))
    })
  }
};
vm.runInNewContext(extractFunction(backend, "consumeRateLimit"), rateContext);
assert.equal(rateContext.consumeRateLimit("save-result", "private@example.com", 2, 60).allowed, true);
assert.equal(rateContext.consumeRateLimit("save-result", "private@example.com", 2, 60).allowed, true);
assert.equal(rateContext.consumeRateLimit("save-result", "private@example.com", 2, 60).allowed, false);
assert.equal(Array.from(rateCache.keys()).some(key => key.includes("private@example.com")), false, "rate-limit keys must not contain raw identifiers");

const reportSanitizerContext = { String };
vm.runInNewContext(extractFunction(backend, "safeText"), reportSanitizerContext);
assert.equal(reportSanitizerContext.safeText("Name\r\nADMIN_PASSWORD=secret\tvalue"), "Name ADMIN_PASSWORD=secret value", "TXT fields must not inject extra lines");

console.log("Security tests passed: routes, health, CSP, schema, payload bounds, XSS boundary, rate limiting, scopes and score-integrity labels.");
