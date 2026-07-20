#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const testPage = fs.readFileSync(path.join(root, "test.html"), "utf8");
const indexPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
const adminPage = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\n    function ", start + marker.length);
  const backendNext = source.indexOf("\nfunction ", start + marker.length);
  const ends = [next, backendNext].filter(index => index >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : source.length).trim();
}

const scripts = Array.from(testPage.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]);
assert.equal(scripts.length, 1, "candidate page must contain one application script");
new vm.Script(scripts[0], { filename: "test.html" });
new vm.Script(backend, { filename: "Code.gs" });

assert.match(testPage, /const API_VERSION = "attempt-v1"/);
assert.match(testPage, /const FRONTEND_BUILD = "2026\.07\.20\.11"/, "candidate build must be current");
assert.match(testPage, /<label for="inviteCode">[\s\S]*?<input[^>]+id="inviteCode"[^>]+required/i, "invite code must be required");
assert.match(testPage, /<label for="name">[\s\S]*?<input[^>]+id="name"[^>]+required/i);
assert.match(testPage, /<label for="email">[\s\S]*?<input[^>]+id="email"[^>]+required/i);
assert.match(testPage, /id="privacyConsent"[^>]+required/i);
assert.match(testPage, /id="ageConsent"[^>]+required/i);
assert.doesNotMatch(testPage, /id="startButton"[^>]+onclick=/i);
assert.doesNotMatch(testPage, /id="nextButton"[^>]+onclick=/i);
assert.match(testPage, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/i);
assert.match(testPage, /window\.addEventListener\("beforeunload"/);
assert.match(testPage, /fragmentParams\.get\("invite"\)/, "invite bearer must be read from the URL fragment");
assert.match(testPage, /history\.replaceState\([^\n]+cleanLocation/, "invite fragment must be removed immediately");
assert.doesNotMatch(adminPage, /searchParams\.set\("invite"/, "admin must not put invite bearer codes in query parameters");
assert.match(adminPage, /url\.hash\s*=\s*"invite="/, "admin invite links must use a fragment bearer");
assert.doesNotMatch(adminPage, /data\.inviteUrl\s*\|\|/, "admin must ignore backend-provided URLs");
assert.doesNotMatch(testPage, /function\s+checkAttempt\s*\(/, "public email/retake oracle must be removed from the client");

const loadQuestions = extractTopLevelFunction(testPage, "loadQuestions");
assert.match(loadQuestions, /cache:\s*"no-store"/);
assert.match(loadQuestions, /credentials:\s*"omit"/);
assert.doesNotMatch(loadQuestions, /err\.message[^\n]*setAttemptStatus|questionsFile[^\n]*setAttemptStatus/, "load failures must stay generic");

const normalizeBank = extractTopLevelFunction(testPage, "normalizePublicQuestionBank");
assert.match(normalizeBank, /schemaVersion\) !== 2/);
assert.match(normalizeBank, /Unexpected public bank fields/);
assert.match(normalizeBank, /Private answer data found in public bank/);
assert.match(normalizeBank, /optionList\.length !== 4/);
assert.match(normalizeBank, /verifyPublicQuestionBankDigest\(source\)/);
assert.match(extractTopLevelFunction(testPage, "verifyPublicQuestionBankDigest"), /crypto\.subtle\.digest\("SHA-256"/);

const begin = extractTopLevelFunction(testPage, "beginAttempt");
["action", "apiVersion", "beginRequestId", "testId", "inviteCode", "email", "browserFingerprint", "clientBuild"]
  .forEach(field => assert.match(begin, new RegExp(field + "\\s*:"), "begin payload missing " + field));
assert.match(begin, /action:\s*"beginAttempt"/);
assert.match(begin, /postJsonOnce\(payload\)/);
assert.match(begin, /attempt\.questionIds\.map/, "client must use the exact server question manifest");
assert.match(begin, /clearInviteSecret\(\)/, "invite secret must be cleared once the attempt starts");
assert.doesNotMatch(begin, /selectRandomQuestions|Math\.random\(\)[\s\S]*question/, "client must not choose the question set");

const validateBegin = extractTopLevelFunction(testPage, "validateBeginAttemptResponse");
assert.match(validateBegin, /result\.status !== "ready"/);
assert.match(validateBegin, /result\.apiVersion !== API_VERSION/);
assert.match(validateBegin, /\^att_\[a-f0-9\]\{32\}\$/);
assert.match(validateBegin, /MAX_ATTEMPT_TTL_MS \+ RESPONSE_CLOCK_SKEW_MS/);
assert.match(validateBegin, /publicDigest/);
assert.match(validateBegin, /questionIds\.length !== loadedQuestionBank\.questionsPerAttempt/);
assert.match(validateBegin, /seenIds\[questionId\]/);

const saveAnswer = extractTopLevelFunction(testPage, "saveCurrentAnswer");
assert.match(saveAnswer, /questionId:\s*question\.id/);
assert.match(saveAnswer, /optionId:\s*optionId/);
assert.match(saveAnswer, /timedOut:\s*Boolean\(timedOut\)/);
assert.match(saveAnswer, /timeSpent:/);
assert.doesNotMatch(saveAnswer, /correct|earnedPoints|score|points\s*:/i, "answer capture must not score locally");

const savePayload = extractTopLevelFunction(testPage, "buildSaveResultPayload");
assert.match(savePayload, /action:\s*"saveResult"/);
assert.match(savePayload, /apiVersion:\s*API_VERSION/);
assert.match(savePayload, /requestId:\s*generateOpaqueRequestId\("scs_"\)/);
assert.match(savePayload, /attemptToken:\s*currentAttempt\.attemptToken/);
["score", "rawScore", "rawTotal", "percent", "finalScore", "penalty", "badge", "passStatus", "trustScore", "blockResults", "isCorrect", "correctAnswer"]
  .forEach(field => assert.doesNotMatch(savePayload, new RegExp("\\b" + field + "\\s*:"), "client payload must not contain " + field));

const finish = extractTopLevelFunction(testPage, "finishTest");
assert.match(finish, /Сервер[\s\S]*закрытому ключу/i, "pre-response UI must be a neutral server-calculation state");
assert.doesNotMatch(finish, /calculateTestResult|finalScore|passStatus/, "finish must not calculate or preview a score");

const normalizeVerified = extractTopLevelFunction(testPage, "normalizeVerifiedServerResult");
assert.match(normalizeVerified, /scoreVerification[^\n]+"server-verified"/);
assert.match(normalizeVerified, /scoringAlgorithmVersion[^\n]+"authoritative-v1"/);
assert.match(normalizeVerified, /telemetryVerification[^\n]+"client-reported-unverified"/);
assert.match(normalizeVerified, /result\.apiVersion[^\n]+API_VERSION/);
assert.match(normalizeVerified, /result\.attemptId[^\n]+submittedData\.attemptId/);
assert.match(normalizeVerified, /result\.testId[^\n]+submittedData\.testId/);
assert.match(normalizeVerified, /result\.bankVersion[^\n]+submittedData\.bankVersion/);
assert.match(normalizeVerified, /penalty[^\n]+!== 0/);
assert.match(normalizeVerified, /expectedPercent/);
assert.match(normalizeVerified, /expectedPassStatus/);
assert.match(normalizeVerified, /invalid_result_invariants/);
assert.match(extractTopLevelFunction(testPage, "showVerifiedResult"), /verification-badge/);

const send = extractTopLevelFunction(testPage, "sendResult");
assert.match(send, /resultSubmissionInFlight \|\| resultSaved/);
assert(
  finish.indexOf("persistPendingResult(payload)") < finish.indexOf("sendResult(payload"),
  "answer-only request must be persisted before transport"
);
assert.match(send, /normalizeVerifiedServerResult\(result, data\)/, "verified response must be bound to the submitted attempt");
assert.match(extractTopLevelFunction(testPage, "postJsonOnce"), /new AbortController\(\)/);
assert.match(extractTopLevelFunction(testPage, "sendResultAttempt"), /MAX_AUTOMATIC_RETRIES/);

assert.match(extractTopLevelFunction(testPage, "persistPendingResult"), /sessionStorage\.setItem/);
assert.doesNotMatch(extractTopLevelFunction(testPage, "persistPendingResult"), /localStorage\.setItem/);
assert.match(extractTopLevelFunction(testPage, "buildPendingResultEnvelope"), /Math\.min\(now \+ MAX_PENDING_RESULT_TTL_MS, attemptExpiry/);
assert.match(extractTopLevelFunction(testPage, "persistAttemptSession"), /sessionStorage\.setItem/);
assert.doesNotMatch(testPage, /localStorage\.setItem\([^\n]*(?:attemptToken|inviteCode|email|answers|browserFingerprint)/i, "PII/tokens must never enter localStorage");

const helperContext = {};
vm.createContext(helperContext);
vm.runInContext(
  extractTopLevelFunction(testPage, "pluralizeRu") + "\n" +
  extractTopLevelFunction(testPage, "isValidEmail") + "\n" +
  "this.__helpers = { pluralizeRu, isValidEmail };",
  helperContext
);
assert.equal(helperContext.__helpers.pluralizeRu(1, "вопрос", "вопроса", "вопросов"), "вопрос");
assert.equal(helperContext.__helpers.pluralizeRu(22, "вопрос", "вопроса", "вопросов"), "вопроса");
assert.equal(helperContext.__helpers.isValidEmail("candidate@example.com"), true);
assert.equal(helperContext.__helpers.isValidEmail("candidate@invalid"), false);

["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior"].forEach(testId => {
  assert.match(indexPage, new RegExp('href="test\\.html\\?test=' + testId + '"'), "home must retain " + testId);
});
assert.match(indexPage, /<div class="stat-number">240<\/div>/, "home must show the production bank size");

const doPost = extractTopLevelFunction(backend, "doPost");
assert.match(doPost, /action === "beginAttempt"/);
assert.match(doPost, /action === "saveResult"/);
assert.match(doPost, /saveAuthoritativeTestResult/);
assert.match(doPost, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/);

console.log("Candidate UX tests passed: invite flow, server manifest, answer-only payload, verified rendering and session-only retry.");
