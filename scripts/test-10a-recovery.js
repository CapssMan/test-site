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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeHarness(failureStage = "") {
  const paths = { sessions: "sessions", invites: "invites", attempts: "attempts" };
  const attemptId = "att_" + "a".repeat(32);
  const requestId = "scs_" + "b".repeat(24);
  const now = Date.now();
  const state = {
    stores: {
      sessions: [{
        schemaVersion: 2,
        attemptId,
        inviteId: "inv_" + "c".repeat(32),
        beginRequestId: "scb_" + "d".repeat(24),
        state: "active",
        testId: "fa-junior",
        bankVersion: "FA Junior v4.0",
        publicDigest: "e".repeat(64),
        questionIds: ["q_1"],
        questionSetHash: "f".repeat(64),
        identityHash: "identity-hash-only",
        fingerprintHash: "fingerprint-hash-only",
        tokenNonce: "1".repeat(32),
        tokenIssuedAt: new Date(now - 60000).toISOString(),
        tokenExpiresAt: new Date(now + 3600000).toISOString(),
        privacyConsentVersion: "skillcheck-pd-consent-2026-07-20-v1",
        privacyConsentedAt: new Date(now - 60000).toISOString(),
        ageConfirmed: true,
        saveRequestId: "",
        submissionHash: "",
        reservedAt: "",
        code: "",
        result: null,
        completedAt: ""
      }],
      invites: [{ inviteId: "inv_" + "c".repeat(32), state: "active", attemptId }],
      attempts: []
    },
    admin: [],
    failureStage,
    failedOnce: false,
    generatedCodes: 0,
    uploads: 0,
    writes: [],
    errors: []
  };

  const data = {
    requestId,
    attemptId,
    attemptToken: "signed-attempt-token-secret",
    testId: "fa-junior",
    bankVersion: "FA Junior v4.0",
    name: "Private Candidate",
    email: "private.candidate@example.test",
    telegram: "@private_candidate",
    englishLevel: "B2",
    candidateSource: "career",
    candidateExperience: "junior",
    employerShareConsent: false,
    privacyConsentVersion: "skillcheck-pd-consent-2026-07-20-v1",
    ageConfirmed: true,
    browserFingerprint: "deadbeef",
    tabSwitches: 9,
    clientBuild: "fixture",
    answers: [{ questionId: "q_1", optionId: null, timedOut: false, timeSpent: 10 }]
  };

  function submissionHash(payload) {
    return crypto.createHash("sha256").update(JSON.stringify({
      requestInvariant: {
        attemptId: payload.attemptId,
        testId: payload.testId,
        bankVersion: payload.bankVersion,
        name: payload.name,
        email: payload.email,
        telegram: payload.telegram,
        browserFingerprint: payload.browserFingerprint,
        answers: payload.answers
      }
    })).digest("hex");
  }

  function failOnce(stage) {
    if (state.failureStage === stage && !state.failedOnce) {
      state.failedOnce = true;
      throw new Error("injected " + stage + " failure");
    }
  }

  const context = {
    String, Number, Boolean, Array, Object, JSON, Math, Date, Error, isFinite,
    console: { error(...args) { state.errors.push(args.map(String).join(" ")); } },
    LockService: {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    assertAuthoritativeConfigurationReady() {},
    assertAuthoritativePrivateStorageNotShared() {},
    verifyAttemptToken() {
      const session = state.stores.sessions[0];
      return {
        valid: true,
        claims: {
          exp: Math.floor(new Date(session.tokenExpiresAt).getTime() / 1000),
          iat: Math.floor(new Date(session.tokenIssuedAt).getTime() / 1000)
        }
      };
    },
    normalizeTelegramContact(value) { return String(value || ""); },
    buildAuthoritativeSubmissionHash: submissionHash,
    ensureSkillCheckFolders() {},
    getAttemptSessionsFilePath() { return paths.sessions; },
    getInvitesFilePath() { return paths.invites; },
    getAttemptsFilePath() { return paths.attempts; },
    readRequiredJsonArray(storagePath) { return clone(state.stores[storagePath]); },
    writeRequiredJsonArray(storagePath, rows) {
      if (storagePath === paths.sessions) {
        const nextState = rows[0] && rows[0].state;
        if (nextState === "reserved") failOnce("reservation");
        if (nextState === "completed") failOnce("completion");
      }
      state.stores[storagePath] = clone(rows);
      state.writes.push({ storagePath, rows: clone(rows) });
    },
    timingSafeEqual(left, right) { return String(left || "") === String(right || ""); },
    validateTokenAgainstSession(tokenResult, session) {
      return Boolean(tokenResult && tokenResult.valid && session && session.attemptId === data.attemptId);
    },
    hashAuthoritativeIdentity(testId, email) {
      return testId === data.testId && String(email).toLowerCase() === data.email ? "identity-hash-only" : "other";
    },
    hashAuthoritativeFingerprint(testId, fingerprint) {
      return testId === data.testId && String(fingerprint) === data.browserFingerprint ? "fingerprint-hash-only" : "other";
    },
    loadAuthoritativePrivateBank() {
      return { publicDigest: "e".repeat(64) };
    },
    calculateAuthoritativeScore() {
      return {
        result: {
          rawScore: 100,
          rawTotal: 100,
          unansweredCount: 0,
          percent: 100,
          finalScore: 100,
          penalty: 0,
          advisoryPenalty: 15,
          tabSwitches: data.tabSwitches,
          trustScore: 70,
          badge: "Junior Strong",
          passStatus: "passed",
          status: "passed",
          decision: "passed",
          finalDecision: "passed",
          recommendation: "Interview",
          blockResults: {},
          scoreVerification: "server-verified",
          scoringAlgorithmVersion: "authoritative-v1",
          telemetryVerification: "client-reported-unverified",
          reportCreated: false
        },
        answerDetails: []
      };
    },
    generateUniqueResultCode() {
      state.generatedCodes += 1;
      return "FA-10ATEST";
    },
    joinDiskPath(folder, fileName) { return folder + "/" + fileName; },
    getReportsFolderPath() { return "reports"; },
    buildTxtReport() { return "server report"; },
    uploadTextToYandexDisk() { state.uploads += 1; failOnce("txt"); },
    appendAdminResult(row) {
      failOnce("admin");
      const index = state.admin.findIndex(item => item.requestId === row.requestId);
      if (index >= 0) state.admin[index] = clone(row);
      else state.admin.push(clone(row));
    },
    upsertAttemptRecord(row) {
      failOnce("legacy");
      const rows = state.stores.attempts;
      const index = rows.findIndex(item => item.requestId === row.requestId);
      if (index >= 0) rows[index] = clone(row);
      else rows.push(clone(row));
    },
    hashAttemptIdentifiers() { return { emailHash: "legacy-email-hash", fingerprintHash: "legacy-fingerprint-hash" }; },
    findAdminResultByRequestId(value) { return state.admin.find(item => item.requestId === value) || null; },
    maskRequestIdForLog(value) { return "..." + String(value).slice(-8); },
    publicRequestError(code, message) {
      const error = new Error(message);
      error.publicRequestError = true;
      error.failureCode = code;
      error.publicMessage = message;
      return error;
    }
  };
  vm.createContext(context);
  const constants = `
    const BACKEND_VERSION = "test";
    const AUTHORITATIVE_API_VERSION = "attempt-v2";
    const AUTHORITATIVE_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
    const MAX_GENERATED_REPORT_CHARS = 200000;
    const TEST_TITLES_BY_ID = { "fa-junior": "FA" };
    const SCORE_VERIFICATION_SERVER = "server-verified";
    const AUTHORITATIVE_SCORING_VERSION = "authoritative-v1";
    const TELEMETRY_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
  `;
  vm.runInContext(
    constants + [
      "buildAttemptUnavailableResponse", "buildAuthoritativeStorageErrorResponse",
      "buildValidationErrorResponse", "buildSubmissionConflictResponse",
      "buildAuthoritativeSavedResultResponse", "consumeInviteForSession", "saveAuthoritativeTestResult"
    ].map(name => {
      const source = extractTopLevelFunction(backend, name);
      return name === "saveAuthoritativeTestResult"
        ? source.replace(
          'console.error("Authoritative result submission failed; request=" + maskRequestIdForLog(requestIdForLog));',
          'console.error("Authoritative result submission failed; request=" + maskRequestIdForLog(requestIdForLog) + "; test=" + String(error && error.stack || error));'
        )
        : source;
    }).join("\n\n") +
      "\nthis.__save = saveAuthoritativeTestResult;",
    context,
    { filename: backendPath }
  );
  return { state, data, context, save: payload => context.__save(clone(payload)), submissionHash };
}

const normal = makeHarness();
const first = normal.save(normal.data);
assert.equal(first.ok, true, JSON.stringify({ first, errors: normal.state.errors }));
assert.equal(first.replayed, false);
assert.equal(first.code, "FA-10ATEST");
assert.equal(normal.state.stores.sessions[0].state, "completed");
assert.equal(normal.state.stores.invites[0].state, "completed", "a consumed single-use invite must use the completed state");
assert.equal(normal.state.stores.attempts.length, 1, "successful save must preserve the rollback/retake projection");
assert.equal(normal.state.admin.length, 1);
assert.equal(normal.state.generatedCodes, 1);

const replay = normal.save(normal.data);
assert.equal(replay.ok, true);
assert.equal(replay.replayed, true);
assert.equal(replay.code, first.code, "exact replay must return the originally reserved code");
assert.equal(normal.state.generatedCodes, 1, "exact replay must not allocate another code");
const changedRequest = normal.save({ ...normal.data, requestId: "scs_" + "9".repeat(24) });
assert.equal(changedRequest.failureCode, "submission_conflict", "completed token is single-use across request ids");
const changedPayload = normal.save({ ...normal.data, name: "Changed Candidate" });
assert.equal(changedPayload.failureCode, "submission_conflict", "same request id cannot replay a changed payload");

const fingerprintSwap = makeHarness();
const swappedFingerprint = fingerprintSwap.save({ ...fingerprintSwap.data, browserFingerprint: "cafebabe" });
assert.equal(swappedFingerprint.failureCode, "attempt_unavailable", "save must reject a fingerprint different from begin");
assert.equal(fingerprintSwap.state.stores.sessions[0].state, "active");

const serializedSession = JSON.stringify(normal.state.stores.sessions[0]);
[normal.data.name, normal.data.email, normal.data.telegram, normal.data.browserFingerprint, normal.data.attemptToken]
  .forEach(secretValue => assert(!serializedSession.includes(secretValue), "persistent session must not contain raw PII/token: " + secretValue));

for (const stage of ["reservation", "txt", "admin", "completion"]) {
  const harness = makeHarness(stage);
  const failed = harness.save(harness.data);
  assert.equal(failed.failureCode, "temporary_storage_error", stage + " failure must be safely retryable");
  if (stage === "reservation") assert.equal(harness.state.stores.sessions[0].state, "active");
  else assert.equal(harness.state.stores.sessions[0].state, "reserved");
  harness.state.failureStage = "";
  const recovered = harness.save(harness.data);
  assert.equal(recovered.ok, true, stage + " exact retry must recover");
  assert.equal(recovered.code, "FA-10ATEST");
  assert.equal(harness.state.stores.sessions[0].state, "completed");
  assert.equal(harness.state.stores.invites[0].state, "completed");
  assert.equal(harness.state.admin.length, 1);
  assert.equal(harness.state.stores.attempts.length, 1);
  assert.equal(
    harness.state.generatedCodes,
    stage === "reservation" ? 2 : 1,
    stage === "reservation"
      ? "a failed reservation write may safely discard the uncommitted candidate code"
      : stage + " retry must reuse the persisted reserved code"
  );
}

// The critical crash window: admin upsert succeeded but the legacy projection did
// not. Exact retry must repair all three stores, not merely return the admin row.
const legacyFailure = makeHarness("legacy");
assert.equal(legacyFailure.save(legacyFailure.data).failureCode, "temporary_storage_error");
assert.equal(legacyFailure.state.admin.length, 1);
assert.equal(legacyFailure.state.stores.attempts.length, 0);
assert.equal(legacyFailure.state.stores.sessions[0].state, "reserved");
legacyFailure.state.stores.invites[0].state = "revoked";
legacyFailure.state.failureStage = "";
const repaired = legacyFailure.save(legacyFailure.data);
assert.equal(repaired.ok, true);
assert.equal(repaired.replayed, true);
assert.equal(legacyFailure.state.stores.attempts.length, 1, "admin-row recovery must repair the legacy attempt projection");
assert.equal(legacyFailure.state.stores.sessions[0].state, "completed", "admin-row recovery must complete the session");
assert.equal(legacyFailure.state.stores.invites[0].state, "completed", "admin-row recovery must complete the invite");

const revokedUncommitted = makeHarness();
const revokedSession = revokedUncommitted.state.stores.sessions[0];
revokedSession.state = "reserved";
revokedSession.saveRequestId = revokedUncommitted.data.requestId;
revokedSession.submissionHash = revokedUncommitted.submissionHash(revokedUncommitted.data);
revokedSession.reservedAt = new Date(Date.now() - 60000).toISOString();
revokedSession.code = "FA-10ATEST";
revokedSession.result = { rawScore: 100, rawTotal: 100, finalScore: 100 };
revokedUncommitted.state.stores.invites[0].state = "revoked";
const revokedRejected = revokedUncommitted.save(revokedUncommitted.data);
assert.equal(revokedRejected.failureCode, "attempt_unavailable", "revoked uncommitted reservation must fail closed");
assert.equal(revokedUncommitted.state.admin.length, 0);
assert.equal(revokedUncommitted.state.stores.sessions[0].state, "reserved");

const expiredActive = makeHarness();
expiredActive.state.stores.sessions[0].tokenExpiresAt = new Date(Date.now() - 60000).toISOString();
assert.equal(expiredActive.save(expiredActive.data).failureCode, "attempt_unavailable", "expired active attempt must fail");
assert.equal(expiredActive.state.stores.sessions[0].state, "active");

const expiredReserved = makeHarness();
const reservedSession = expiredReserved.state.stores.sessions[0];
reservedSession.state = "reserved";
reservedSession.tokenExpiresAt = new Date(Date.now() - 60000).toISOString();
reservedSession.saveRequestId = expiredReserved.data.requestId;
reservedSession.submissionHash = expiredReserved.submissionHash(expiredReserved.data);
reservedSession.reservedAt = new Date(Date.now() - 60000).toISOString();
reservedSession.code = "FA-10ATEST";
reservedSession.result = { rawScore: 100, rawTotal: 100, finalScore: 100 };
assert.equal(expiredReserved.save(expiredReserved.data).ok, true, "exact reserved retry may recover after token expiry within 24 hours");

const staleReserved = makeHarness();
const staleSession = staleReserved.state.stores.sessions[0];
staleSession.state = "reserved";
staleSession.tokenExpiresAt = new Date(Date.now() - 60000).toISOString();
staleSession.saveRequestId = staleReserved.data.requestId;
staleSession.submissionHash = staleReserved.submissionHash(staleReserved.data);
staleSession.reservedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
staleSession.code = "FA-10ATEST";
staleSession.result = { rawScore: 100, rawTotal: 100, finalScore: 100 };
assert.equal(staleReserved.save(staleReserved.data).failureCode, "attempt_unavailable", "reserved recovery must close after 24 hours");

const beginSource = extractTopLevelFunction(backend, "beginAuthoritativeAttempt");
assert.match(
  beginSource,
  /existingSession\.beginRequestId\s*!==\s*data\.beginRequestId|data\.beginRequestId\s*!==\s*existingSession\.beginRequestId/,
  "an active invite may resume only for the exact beginRequestId"
);
assert.doesNotMatch(beginSource, /CacheService/, "begin state must be persistent, not cache-only");
assert.match(beginSource, /fingerprintHash:\s*fingerprintHash/, "begin must persist only a keyed fingerprint hash");
assert.doesNotMatch(beginSource, /browserFingerprint:\s*data\.browserFingerprint/, "begin must not persist the raw fingerprint");

const doGetSource = extractTopLevelFunction(backend, "doGet");
const doPostSource = extractTopLevelFunction(backend, "doPost");
assert.match(doGetSource, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/, "legacy GET checkAttempt must be closed");
assert.match(doPostSource, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/, "legacy POST checkAttempt must be closed");
const unavailableSource = extractTopLevelFunction(backend, "buildAttemptUnavailableResponse");
assert.doesNotMatch(unavailableSource, /email|foundPrevious|daysLeft|nextDate|expired|revoked|used|retake/i, "public invite failures must remain neutral");

const revokeSource = extractTopLevelFunction(backend, "adminRevokeInvite");
assert.match(revokeSource, /\^scr_\[a-z0-9\]\{24,40\}\$/, "revoke must require an exact scr_ id");
assert.match(revokeSource, /revokeRequestId === requestId[\s\S]*replayed:\s*true/, "same revoke request must be idempotent");
assert.match(revokeSource, /buildSubmissionConflictResponse/, "changed revoke request must conflict");

const createInviteSource = extractTopLevelFunction(backend, "adminCreateInvite");
assert.match(createInviteSource, /ATTEMPT_ISSUANCE_ENABLED|isAuthoritativeIssuanceEnabled/, "admin invite creation must honor the production issuance gate");
assert.match(createInviteSource, /pilot_locked|buildPilotLockedResponse/, "locked issuance must not return a working invite code");
assert.match(extractTopLevelFunction(backend, "adminListInvites"), /issuanceEnabled/, "admin list may expose only the safe issuance boolean");

const bootstrapSource = extractTopLevelFunction(backend, "bootstrapAuthoritativeBanksFromLegacyPages");
assert.match(
  bootstrapSource,
  /permanently disabled after the v4 content rotation/,
  "legacy production bootstrap must stay fail-closed after content rotation"
);

console.log("Stage 10A recovery tests passed (single-use, exact replay, injected crash windows and neutral legacy boundary).");
