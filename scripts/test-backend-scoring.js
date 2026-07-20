#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backendPath = path.join(root, "apps-script", "Code.gs");
const backend = fs.readFileSync(backendPath, "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

function realmJson(context, value) {
  context.__json = JSON.stringify(value);
  return vm.runInContext("JSON.parse(__json)", context);
}

const validationContext = {
  String, Number, Boolean, Array, Object, JSON, Math, isFinite,
  normalizeTelegramContact(value) { return String(value || "").trim(); }
};
vm.createContext(validationContext);
const validationConstants = `
  const BACKEND_VERSION = "test";
  const AUTHORITATIVE_API_VERSION = "attempt-v1";
  const MAX_ANSWERS_PER_RESULT = 40;
  const PUBLIC_DEV_TEST_ENABLED = false;
  const TEST_TITLES_BY_ID = { "fa-junior": "FA", "ca-junior": "CA", "dev-quick": "DEV" };
  const BANK_VERSIONS_BY_ID = { "fa-junior": "FA Junior v3.0", "ca-junior": "CA Junior v3.0", "dev-quick": "DEV Quick v2.0" };
  const ALLOWED_ENGLISH_LEVELS = ["B2"];
  const ALLOWED_CANDIDATE_SOURCES = ["career"];
  const ALLOWED_CANDIDATE_EXPERIENCE = ["junior"];
`;
const validationFunctions = [
  "buildValidationErrorResponse", "publicRequestError", "isPlainObject", "assertAllowedObjectKeys",
  "validateIdentifier", "validateEnum", "validateBoolean", "validateNumber", "validateInteger",
  "validateBoundedText", "validateEmail", "validateBrowserFingerprint", "validateTelegramForRequest",
  "validateTestId", "assertPublicTestEnabled", "validateAuthoritativeAnswers",
  "validateAuthoritativeSubmissionRequest"
];
vm.runInContext(
  validationConstants + validationFunctions.map(name => extractTopLevelFunction(backend, name)).join("\n\n") +
    "\nthis.__validation = { validateAuthoritativeSubmissionRequest };",
  validationContext,
  { filename: backendPath }
);

const validRequest = {
  action: "saveResult",
  apiVersion: "attempt-v1",
  requestId: "scs_" + "a".repeat(24),
  attemptId: "att_" + "b".repeat(32),
  attemptToken: "a".repeat(90) + "." + "b".repeat(90) + "." + "c".repeat(90),
  testId: "fa-junior",
  bankVersion: "FA Junior v3.0",
  name: "Candidate",
  email: "candidate@example.test",
  telegram: "",
  englishLevel: "B2",
  candidateSource: "career",
  candidateExperience: "junior",
  employerShareConsent: false,
  browserFingerprint: "deadbeef",
  tabSwitches: 0,
  clientBuild: "2026.07.20.10",
  answers: [{ questionId: "q_001", optionId: null, timedOut: false, timeSpent: 10 }]
};

const accepted = validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, validRequest));
assert.equal(accepted.ok, true, "minimal authoritative answer-only payload must validate");
assert.deepEqual(
  Object.keys(accepted.data.answers[0]),
  ["questionId", "optionId", "timedOut", "timeSpent"],
  "validated answers must contain only the opaque answer contract"
);

const forbiddenTopLevel = [
  "score", "rawScore", "rawTotal", "percent", "finalScore", "penalty", "trustScore",
  "badge", "passStatus", "finalDecision", "recommendation", "blockResults", "scoreVerification"
];
forbiddenTopLevel.forEach(field => {
  const forged = { ...validRequest, [field]: field === "blockResults" ? {} : 100 };
  const result = validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, forged));
  assert.equal(result.ok, false, `client-forged ${field} must be rejected`);
  assert.equal(result.response.failureCode, "unknown_field", `client-forged ${field} must fail closed`);
});

["isCorrect", "correctAnswer", "points", "earnedPoints", "comment", "question"].forEach(field => {
  const forged = JSON.parse(JSON.stringify(validRequest));
  forged.answers[0][field] = field === "isCorrect" ? true : "forged";
  const result = validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, forged));
  assert.equal(result.ok, false, `answer-level forged ${field} must be rejected`);
  assert.equal(result.response.failureCode, "unknown_field");
});

const legacyRequest = { ...validRequest, requestId: "sc_1234567890abcdef" };
assert.equal(
  validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, legacyRequest)).response.failureCode,
  "invalid_request_id",
  "authoritative save must reject legacy sc_ request ids"
);
const wrongPrefix = { ...validRequest, requestId: "scs_" + "A".repeat(24) };
assert.equal(validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, wrongPrefix)).ok, false);
const duplicateAnswers = JSON.parse(JSON.stringify(validRequest));
duplicateAnswers.answers.push({ ...duplicateAnswers.answers[0] });
assert.equal(
  validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, duplicateAnswers)).response.failureCode,
  "duplicate_question"
);
const devRequest = { ...validRequest, testId: "dev-quick", bankVersion: "DEV Quick v2.0" };
assert.equal(
  validationContext.__validation.validateAuthoritativeSubmissionRequest(realmJson(validationContext, devRequest)).response.failureCode,
  "test_not_public",
  "dev-quick must stay unavailable through the public authoritative endpoint"
);

const scoringContext = { String, Number, Boolean, Array, Object, JSON, Math, isFinite };
vm.createContext(scoringContext);
const scoringConstants = `
  const SUCCESS_THRESHOLD = 80;
  const SCORE_VERIFICATION_SERVER = "server-verified";
  const AUTHORITATIVE_SCORING_VERSION = "authoritative-v1";
  const TELEMETRY_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
  const EXPECTED_ANSWERS_BY_TEST_ID = { "fixture": 5 };
`;
const scoringFunctions = [
  "publicRequestError", "calculateServerPenalty", "calculateServerTrustScore", "getAdminBadge",
  "getAuthoritativeBlockName", "getAuthoritativeRecommendation", "calculateAuthoritativeScore"
];
vm.runInContext(
  scoringConstants + scoringFunctions.map(name => extractTopLevelFunction(backend, name)).join("\n\n") +
    "\nthis.__scoring = { calculateAuthoritativeScore };",
  scoringContext,
  { filename: backendPath }
);

const bank = {
  testId: "fixture",
  bankVersion: "Fixture v1",
  blocks: { core: "Core" },
  questions: Array.from({ length: 5 }, (_, index) => ({
    id: `q_${index + 1}`,
    topic: "Fixture",
    block: "core",
    difficulty: "medium",
    timeLimit: 60,
    points: 20,
    text: `Question ${index + 1}`,
    context: "",
    options: [
      { id: `q${index + 1}_correct`, text: "Correct" },
      { id: `q${index + 1}_wrong_a`, text: "Wrong A" },
      { id: `q${index + 1}_wrong_b`, text: "Wrong B" },
      { id: `q${index + 1}_wrong_c`, text: "Wrong C" }
    ],
    correctOptionId: `q${index + 1}_correct`,
    comment: "Private rationale"
  }))
};
const session = { questionIds: bank.questions.map(question => question.id) };

function score(answerOptionIds, tabSwitches = 0) {
  const data = {
    testId: "fixture",
    tabSwitches,
    answers: bank.questions.map((question, index) => ({
      questionId: question.id,
      optionId: answerOptionIds[index],
      timedOut: answerOptionIds[index] === null,
      timeSpent: 12
    }))
  };
  return scoringContext.__scoring.calculateAuthoritativeScore(
    realmJson(scoringContext, data), realmJson(scoringContext, session), realmJson(scoringContext, bank)
  );
}

const allCorrect = score(bank.questions.map(question => question.correctOptionId)).result;
assert.deepEqual(
  [allCorrect.rawScore, allCorrect.rawTotal, allCorrect.percent, allCorrect.finalScore, allCorrect.penalty, allCorrect.passStatus],
  [100, 100, 100, 100, 0, "passed"],
  "all-correct scoring must be server authoritative"
);
const none = score(Array(5).fill(null)).result;
assert.deepEqual([none.rawScore, none.rawTotal, none.percent, none.finalScore, none.unansweredCount], [0, 100, 0, 0, 5]);
assert.equal(none.passStatus, "failed");
const threshold = score(bank.questions.map((question, index) => index < 4 ? question.correctOptionId : `q${index + 1}_wrong_a`)).result;
assert.deepEqual([threshold.rawScore, threshold.percent, threshold.finalScore, threshold.passStatus], [80, 80, 80, "passed"]);
assert.equal(threshold.scoreVerification, "server-verified");
assert.equal(threshold.scoringAlgorithmVersion, "authoritative-v1");
assert.equal(threshold.telemetryVerification, "client-reported-unverified");

const noisyTelemetry = score(bank.questions.map((question, index) => index < 4 ? question.correctOptionId : `q${index + 1}_wrong_a`), 99).result;
assert.equal(noisyTelemetry.finalScore, 80, "client-reported telemetry must not change the knowledge score");
assert.equal(noisyTelemetry.penalty, 0, "applied score penalty must remain zero");
assert(noisyTelemetry.advisoryPenalty > 0, "telemetry may produce a clearly advisory penalty");
assert.equal(noisyTelemetry.badge, threshold.badge, "server badge must not depend on client-reported tab switches");

assert.throws(
  () => score(["alien_option", null, null, null, null]),
  error => Boolean(error && error.publicRequestError && error.failureCode === "invalid_option"),
  "option ids outside their question must fail closed"
);

const selectionContext = {
  String, Number, Array, Object, Math,
  sha256Hex(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
};
vm.createContext(selectionContext);
vm.runInContext(
  extractTopLevelFunction(backend, "selectAuthoritativeQuestionIds") +
    "\nthis.__select = selectAuthoritativeQuestionIds;",
  selectionContext,
  { filename: backendPath }
);
const caPrivateShape = realmJson(selectionContext, {
  questionsPerAttempt: 40,
  questions: Array.from({ length: 80 }, (_, index) => ({ id: `ca_${String(index + 1).padStart(3, "0")}` }))
});
const manifestA = selectionContext.__select(caPrivateShape, "att_" + "1".repeat(32), "2".repeat(32));
const manifestB = selectionContext.__select(caPrivateShape, "att_" + "1".repeat(32), "2".repeat(32));
assert.equal(manifestA.length, 40, "CA session must receive exactly 40 of 80 questions");
assert.equal(new Set(manifestA).size, 40, "CA manifest must not contain duplicates");
assert.deepEqual(Array.from(manifestA), Array.from(manifestB), "CA manifest selection must be deterministic for one session seed");
assert(manifestA.every(id => /^ca_\d{3}$/.test(id)), "CA manifest must contain only normalized bank ids");

const missingBankContext = {
  String, Number, Object, Array, JSON, Error,
  BANK_VERSIONS_BY_ID: { "fa-junior": "FA Junior v3.0" },
  getAuthoritativePrivateBankPath() { return "disk:/skillcheck/private/banks/fa-junior/fa-junior-v3-0.json"; },
  readTextFromYandexDisk() { return null; }
};
vm.createContext(missingBankContext);
vm.runInContext(extractTopLevelFunction(backend, "loadAuthoritativePrivateBank"), missingBankContext, { filename: backendPath });
assert.throws(
  () => missingBankContext.loadAuthoritativePrivateBank("fa-junior", "FA Junior v3.0"),
  /private bank is missing/i,
  "missing private key must fail closed and must never synthesize an empty bank"
);

const sanitizeAdminSource = extractTopLevelFunction(backend, "sanitizeAdminResult");
assert.match(sanitizeAdminSource, /row\.scoreVerification === SCORE_VERIFICATION_SERVER/);
assert.match(sanitizeAdminSource, /SCORE_VERIFICATION_CLIENT_REPORTED/, "legacy rows must remain explicitly unverified");

console.log("Stage 10A authoritative scoring tests passed (validation, 0/80/100%, CA manifest and fail-closed bank).");
