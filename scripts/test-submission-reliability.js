#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const nextIndented = source.indexOf("\n    function ", start + marker.length);
  const nextBackend = source.indexOf("\nfunction ", start + marker.length);
  const ends = [nextIndented, nextBackend].filter(index => index >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : source.length).trim();
}

assert.match(frontend, /const FRONTEND_BUILD = "2026\.07\.20\.12"/);
assert.match(backend, /const BACKEND_VERSION = "yandex-disk-mvp-2026-07-20-13"/);
assert.match(frontend, /const MAX_AUTOMATIC_RETRIES = 2/);
assert.match(frontend, /const AUTOMATIC_RETRY_DELAYS_MS = \[1500, 4000\]/);
assert.match(frontend, /const MAX_PENDING_RESULT_TTL_MS = 6 \* 60 \* 60 \* 1000/);

const finish = extractTopLevelFunction(frontend, "finishTest");
assert(
  finish.indexOf("persistPendingResult(payload)") < finish.indexOf("sendResult(payload"),
  "payload must be stored before its first network send"
);
const send = extractTopLevelFunction(frontend, "sendResult");
assert.match(send, /resultSubmissionInFlight \|\| resultSaved/);
assert.match(send, /sendResultAttempt\(data, 0\)/);
assert.match(send, /clearPendingResult\(data\.testId, data\.requestId\)/);
const retry = extractTopLevelFunction(frontend, "sendResultAttempt");
assert.match(retry, /retryIndex >= MAX_AUTOMATIC_RETRIES/);
assert.match(retry, /waitForSubmissionRetry\(delay\)/);
assert.match(retry, /postJsonOnce\(data\)/, "retry must resend the exact same request object");
assert.match(extractTopLevelFunction(frontend, "postJsonOnce"), /NETWORK_TIMEOUT_MS/);
assert.match(frontend, /window\.addEventListener\("online"/);

const pending = extractTopLevelFunction(frontend, "persistPendingResult");
assert.match(pending, /sessionStorage\.setItem/);
assert.doesNotMatch(pending, /localStorage\.setItem/);
const envelope = extractTopLevelFunction(frontend, "buildPendingResultEnvelope");
assert.match(envelope, /Math\.min\(now \+ MAX_PENDING_RESULT_TTL_MS, attemptExpiry/);
const validateEnvelope = extractTopLevelFunction(frontend, "validatePendingResultEnvelope");
assert.match(validateEnvelope, /\^scs_\[a-z0-9\]\{24,40\}\$/);
assert.match(validateEnvelope, /optionId,questionId,timeSpent,timedOut/);
assert.doesNotMatch(validateEnvelope, /correctAnswer|isCorrect|earnedPoints|finalScore/);

const beginState = extractTopLevelFunction(frontend, "getOrCreateBeginState");
assert.match(beginState, /sessionStorage\.setItem/);
assert.match(beginState, /\^scb_\[a-z0-9\]\{24,40\}\$/);
assert.doesNotMatch(beginState, /localStorage/);
const activeSession = extractTopLevelFunction(frontend, "persistAttemptSession");
assert.match(activeSession, /sessionStorage\.setItem/);
assert.match(activeSession, /attemptToken:\s*attempt\.attemptToken/);
assert.doesNotMatch(activeSession, /email|browserFingerprint|inviteCode/);

const save = extractTopLevelFunction(backend, "saveAuthoritativeTestResult");
assert(save.indexOf('session.state = "reserved"') < save.indexOf("uploadTextToYandexDisk"), "reservation must commit before report I/O");
assert(save.indexOf("writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions)") < save.indexOf("appendAdminResult"), "reservation must persist before admin write");
assert.match(save, /session\.state === "completed"/);
assert.match(save, /session\.state === "reserved"/);
assert.match(save, /AUTHORITATIVE_RECOVERY_TTL_MS/);
assert.match(save, /findAdminResultByRequestId\(data\.requestId\)/);
assert.match(save, /repairLegacyAttemptProjection|upsertAttemptRecord/, "admin-row recovery must repair the legacy projection");
assert.match(save, /buildSubmissionConflictResponse\(\)/);
assert.match(save, /buildAuthoritativeSavedResultResponse\(session, session\.result, true\)/);
assert.doesNotMatch(save, /CacheService/, "single-use/recovery state must be persistent");
assert.match(save, /generateUniqueResultCode\(session\.testId, sessions\)/, "reserved session codes must participate in collision checks");
const resultCodeGenerator = extractTopLevelFunction(backend, "generateUniqueResultCode");
assert.match(resultCodeGenerator, /reservedSessions/);
assert.match(resultCodeGenerator, /existingCodes\[String\(session\.code\)\]/);
const appendAdmin = extractTopLevelFunction(backend, "appendAdminResult");
assert.match(appendAdmin, /Admin result identity conflict/);

const response = extractTopLevelFunction(backend, "buildAuthoritativeSavedResultResponse");
assert.match(response, /scoreVerification:\s*SCORE_VERIFICATION_SERVER/);
assert.match(response, /scoringAlgorithmVersion:\s*AUTHORITATIVE_SCORING_VERSION/);
assert.match(response, /telemetryVerification:\s*TELEMETRY_VERIFICATION_CLIENT_REPORTED/);
assert.doesNotMatch(response, /reportPath|payloadHash|submissionHash|attemptToken/);

assert.doesNotMatch(
  extractTopLevelFunction(backend, "saveAuthoritativeTestResult"),
  /console\.(?:log|error)\([^\n]*(?:email|telegram|browserFingerprint|attemptToken|answers)/i,
  "backend logs must never include request PII or token"
);

console.log("Submission reliability checks passed: bounded same-payload retry, 6h session scope, persistent reservation and repair path.");
