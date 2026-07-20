#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const nextIndented = source.indexOf("\n    function ", start + marker.length);
  const nextBackend = source.indexOf("\nfunction ", start + marker.length);
  const ends = [nextIndented, nextBackend].filter(index => index >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : source.length).trim();
}

assert.doesNotMatch(frontend, /function\s+checkAttempt\s*\(/, "candidate must not query an email/fingerprint retake oracle");
assert.doesNotMatch(frontend, /formatBlockedAttemptMessage|daysLeft|nextDate/, "candidate must not reveal retake history");
assert.doesNotMatch(frontend, /localStorage\.setItem\([^\n]*(?:email|fingerprint|attemptToken|invite)/i, "local retake markers must contain no identity or secret");

const completionMarker = extractTopLevelFunction(frontend, "saveLocalCompletionMarker");
assert.match(completionMarker, /skillcheck_attempt_[^\n]+safeTestId\(testId\)/);
assert.match(completionMarker, /completedAt:/);
assert.match(completionMarker, /informationalOnly:\s*true/);
assert.doesNotMatch(completionMarker, /email|fingerprint|nextAttemptAt|attemptToken|invite/i, "completion marker is informational only");
assert.match(frontend, /DOMContentLoaded[\s\S]{0,1200}sanitizeLegacyRetakeMarkers\(\)/, "legacy identifying markers must be scrubbed at startup");

const doGet = extractTopLevelFunction(backend, "doGet");
const doPost = extractTopLevelFunction(backend, "doPost");
assert.match(doGet, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/);
assert.match(doPost, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/);
assert.doesNotMatch(doGet, /checkAttemptHash\(/, "GET must not perform an identity lookup");

const unavailable = extractTopLevelFunction(backend, "buildAttemptUnavailableResponse");
assert.match(unavailable, /failureCode:\s*"attempt_unavailable"/);
assert.doesNotMatch(unavailable, /email|daysLeft|nextDate|foundPrevious|expired|revoked|retake|used/i, "all invite/retake failures must be indistinguishable publicly");

const begin = extractTopLevelFunction(backend, "beginAuthoritativeAttempt");
assert.match(begin, /LockService\.getScriptLock\(\)/, "retake decision and issuance must be serialized");
assert.match(begin, /hasRecentAuthoritativeRetake\(/, "fresh controlled invite must honor server retake history");
assert.match(begin, /!invite\.allowRetake/, "only explicit owner smoke bypass may skip retake policy");
assert.match(begin, /readRequiredJsonArray\(getAttemptSessionsFilePath\(\)/, "retake state must be persistent");
assert.match(begin, /existingSession\.beginRequestId[^\n]+data\.beginRequestId|data\.beginRequestId[^\n]+existingSession\.beginRequestId/, "resume must require the exact begin id");
assert.doesNotMatch(begin, /daysLeft|nextDate|foundPrevious/, "begin response must not disclose prior history");

const recent = extractTopLevelFunction(backend, "hasRecentAuthoritativeRetake");
assert.match(recent, /RETAKE_WINDOW_MS/);
assert.match(recent, /session\.state !== "completed"/, "only completed authoritative attempts trigger retake lock");
assert.match(recent, /getAttemptsFilePath\(\)/, "legacy completed projection must remain part of rollback-safe retake policy");
assert.doesNotMatch(recent, /return\s*\{[^}]*daysLeft|nextDate/, "internal retake check returns only a boolean");

const ownerInvite = extractTopLevelFunction(backend, "createOwnerSmokeInvite");
assert.match(ownerInvite, /allowRetake:\s*true/, "only the internal owner smoke helper may bypass retake");
const publicInvite = extractTopLevelFunction(backend, "adminCreateInvite");
assert.match(publicInvite, /allowRetake:\s*false/, "normal pilot invites cannot bypass retake");

assert.match(backend, /const PUBLIC_DEV_TEST_ENABLED = false;/);
assert.match(extractTopLevelFunction(backend, "assertPublicTestEnabled"), /dev-quick/);

console.log("Retake stage checks passed: controlled invite, persistent server policy, neutral failures and no client oracle.");
