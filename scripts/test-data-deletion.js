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
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeHarness(options = {}) {
  const code = "FA-ABCDE";
  const attemptId = "att_" + "a".repeat(32);
  const inviteId = "inv_" + "b".repeat(32);
  const paths = {
    admin: "disk:/skillcheck/admin/results.json",
    attempts: "disk:/skillcheck/private/attempts.json",
    sessions: "disk:/skillcheck/private/attempt-sessions-v1.json",
    invites: "disk:/skillcheck/private/invites-v1.json",
    log: "disk:/skillcheck/private/deletion-log-v1.json",
    backups: "disk:/skillcheck/private/deletion-backups",
    reports: "disk:/skillcheck/reports"
  };
  const state = {
    arrays: {
      [paths.admin]: [{ code, attemptId, requestId: "scs_" + "c".repeat(24), status: "passed", email: undefined }],
      [paths.attempts]: [{ code, attemptId, emailHash: "private-email-hash", fingerprintHash: "private-fingerprint-hash" }],
      [paths.sessions]: [{ code, attemptId, inviteId, identityHash: "private-identity-hash" }],
      [paths.invites]: [{ inviteId, attemptId, emailHash: "private-invite-email-hash" }],
      [paths.log]: []
    },
    files: { [paths.reports + "/" + code + ".txt"]: "PRIVATE REPORT FOR candidate@example.test" },
    writes: [],
    errors: [],
    failBackupPurgeOnce: Boolean(options.failBackupPurgeOnce),
    backupPurgeFailed: false
  };

  const context = {
    String, Number, Boolean, Array, Object, JSON, Math, Date, Error, RegExp, isFinite,
    console: { log() {}, error(message) { state.errors.push(String(message)); } },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
    Utilities: { sleep() {} },
    getAdminFilePath() { return paths.admin; },
    getAttemptsFilePath() { return paths.attempts; },
    getAttemptSessionsFilePath() { return paths.sessions; },
    getInvitesFilePath() { return paths.invites; },
    getDeletionLogFilePath() { return paths.log; },
    getDeletionBackupsFolderPath() { return paths.backups; },
    getReportsFolderPath() { return paths.reports; },
    joinDiskPath(folder, name) { return folder.replace(/\/$/, "") + "/" + name; },
    readRequiredJsonArray(storagePath) {
      if (!Array.isArray(state.arrays[storagePath])) throw new Error("missing fixture store");
      return clone(state.arrays[storagePath]);
    },
    writeRequiredJsonArray(storagePath, rows) {
      state.arrays[storagePath] = clone(rows);
      state.writes.push(storagePath);
    },
    readJsonFromYandexDisk(storagePath, fallback) {
      if (!Object.prototype.hasOwnProperty.call(state.arrays, storagePath)) state.arrays[storagePath] = clone(fallback);
      return clone(state.arrays[storagePath]);
    },
    writeJsonToYandexDisk(storagePath, rows) {
      state.arrays[storagePath] = clone(rows);
      state.writes.push(storagePath);
    },
    readTextFromYandexDisk(storagePath) {
      if (storagePath === paths.log) return JSON.stringify(state.arrays[paths.log]);
      return Object.prototype.hasOwnProperty.call(state.files, storagePath) ? state.files[storagePath] : null;
    },
    uploadTextToYandexDisk(storagePath, content) { state.files[storagePath] = String(content); },
    deleteYandexDiskFileIfExists(storagePath) {
      if (storagePath.startsWith(paths.backups + "/") && state.failBackupPurgeOnce && !state.backupPurgeFailed) {
        state.backupPurgeFailed = true;
        throw new Error("injected backup purge failure");
      }
      if (!Object.prototype.hasOwnProperty.call(state.files, storagePath)) return false;
      delete state.files[storagePath];
      return true;
    },
    getYandexResourceMetadata(storagePath) {
      const exists = Object.prototype.hasOwnProperty.call(state.files, storagePath);
      return { exists, type: exists ? "file" : "missing", size: exists ? String(state.files[storagePath]).length : null, modified: exists ? "2026-07-20T10:00:00.000Z" : "" };
    },
    ensureYandexFolderExists() {},
    collectOperationalBackupDeletionEntries() { return []; },
    scrubOperationalBackupsForDeletion() {},
    assertAuthoritativePrivateStorageNotShared() {},
    assertAllowedObjectKeys(value, allowed) {
      if (!value || Object.keys(value).some(key => !allowed.includes(key))) throw new Error("unknown field");
    },
    buildClientUpgradeRequiredResponse() { return { ok: false, failureCode: "client_upgrade_required" }; },
    buildValidationErrorResponse(failureCode, message) { return { ok: false, status: "invalid_request", failureCode, message }; },
    buildSubmissionConflictResponse() { return { ok: false, failureCode: "submission_conflict" }; },
    buildAuthoritativeStorageErrorResponse() { return { ok: false, failureCode: "temporary_storage_error" }; },
    isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); },
    sha256Hex(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); },
    hmacSha256Bytes(secret, value) { return crypto.createHmac("sha256", String(secret)).update(String(value)).digest(); },
    base64UrlEncodeText(value) { return Buffer.from(String(value), "utf8").toString("base64url"); },
    base64UrlEncodeBytes(value) { return Buffer.from(value).toString("base64url"); },
    base64UrlDecodeText(value) { return Buffer.from(String(value), "base64url").toString("utf8"); },
    timingSafeEqual(left, right) {
      const a = Buffer.from(String(left));
      const b = Buffer.from(String(right));
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
    getRequiredProperty(name) { if (name !== "ATTEMPT_SIGNING_SECRET_V1") throw new Error("unexpected property"); return "fixture-signing-secret"; }
  };
  vm.createContext(context);
  const constants = `
    const AUTHORITATIVE_API_VERSION = "attempt-v2";
    const BACKEND_VERSION = "test";
    const DELETION_PREVIEW_TTL_SECONDS = 600;
    const RETENTION_AUTOMATION_ENABLED = false;
  `;
  const functions = [
    "normalizeResultCode", "normalizeDeletionScope", "normalizeDeletionRequestId", "getDeletionBackupPath", "assertDeletionBackupNotShared",
    "uniqueDeletionIds", "buildDeletionSnapshot", "buildDeletionStateDigest", "buildDeletionCounts",
    "buildDeletionPreviewToken", "verifyDeletionPreviewToken", "adminPreviewResultDeletion",
    "readDeletionLog", "writeDeletionLog", "upsertDeletionLogEntry", "buildDeletionResultResponse",
    "parseDeletionBackup", "removeDeletionTargetsFromStores", "adminDeleteResult", "getRetentionPolicyStatusForOwner", "resumePendingDeletionForOwner"
  ];
  vm.runInContext(constants + functions.map(name => extractTopLevelFunction(backend, name)).join("\n\n") + `
    this.__api = { adminPreviewResultDeletion, adminDeleteResult, getRetentionPolicyStatusForOwner, resumePendingDeletionForOwner };
  `, context, { filename: backendPath });
  return { code, paths, state, api: context.__api };
}

function preview(harness, scope = "full_attempt") {
  return clone(harness.api.adminPreviewResultDeletion({
    action: "adminDeletionPreview", apiVersion: "attempt-v2", password: "fixture", code: harness.code, scope
  }));
}

function commit(harness, previewResult, scope = "full_attempt", requestId = "scd_" + "d".repeat(32)) {
  return clone(harness.api.adminDeleteResult({
    action: "adminDeleteResult", apiVersion: "attempt-v2", password: "fixture", code: harness.code, scope,
    requestId, confirmationCode: harness.code, previewToken: previewResult.previewToken
  }));
}

const full = makeHarness();
const fullPreview = preview(full);
assert.equal(fullPreview.ok, true);
assert.equal(fullPreview.found, true);
assert.deepEqual(fullPreview.counts, { adminRows: 1, attemptRows: 1, sessions: 1, invites: 1, report: 1 });
assert.equal(fullPreview.retentionAutomationEnabled, false);
const fullResult = commit(full, fullPreview);
assert.equal(fullResult.ok, true, JSON.stringify({ fullResult, errors: full.state.errors }));
assert.equal(fullResult.backupPurged, true);
assert.equal(full.state.arrays[full.paths.admin].length, 0);
assert.equal(full.state.arrays[full.paths.attempts].length, 0);
assert.equal(full.state.arrays[full.paths.sessions].length, 0);
assert.equal(full.state.arrays[full.paths.invites].length, 0);
assert.equal(Object.keys(full.state.files).length, 0, "report and transaction backup must both be absent after success");
assert.equal(full.state.arrays[full.paths.log].length, 1);
assert.equal(full.state.arrays[full.paths.log][0].state, "completed");
assert.equal(full.state.arrays[full.paths.log][0].backupPurged, true);
assert.doesNotMatch(JSON.stringify(full.state.arrays[full.paths.log]), /candidate@example|emailHash|identityHash|fingerprintHash|PRIVATE REPORT/);
const replay = commit(full, fullPreview);
assert.equal(replay.ok, true);
assert.equal(replay.replayed, true);

const resultOnly = makeHarness();
const resultOnlyPreview = preview(resultOnly, "result_only");
const resultOnlyResult = commit(resultOnly, resultOnlyPreview, "result_only", "scd_" + "e".repeat(32));
assert.equal(resultOnlyResult.ok, true);
assert.equal(resultOnly.state.arrays[resultOnly.paths.admin].length, 0);
assert.equal(resultOnly.state.arrays[resultOnly.paths.attempts].length, 1);
assert.equal(resultOnly.state.arrays[resultOnly.paths.sessions].length, 1);
assert.equal(resultOnly.state.arrays[resultOnly.paths.invites].length, 1);

const invalidToken = makeHarness();
const invalidPreview = preview(invalidToken);
invalidPreview.previewToken = invalidPreview.previewToken.slice(0, -1) + "x";
const invalidResult = commit(invalidToken, invalidPreview, "full_attempt", "scd_" + "f".repeat(32));
assert.equal(invalidResult.failureCode, "deletion_preview_expired");
assert.equal(invalidToken.state.arrays[invalidToken.paths.admin].length, 1);
assert.equal(Object.keys(invalidToken.state.files).length, 1);

const recovery = makeHarness({ failBackupPurgeOnce: true });
const recoveryPreview = preview(recovery);
const recoveryRequestId = "scd_" + "1".repeat(32);
const firstRecovery = commit(recovery, recoveryPreview, "full_attempt", recoveryRequestId);
assert.equal(firstRecovery.failureCode, "deletion_incomplete");
assert.equal(recovery.state.arrays[recovery.paths.admin].length, 0, "primary deletion should already be verified");
assert.equal(Object.keys(recovery.state.files).length, 1, "only the transaction backup should remain after injected purge failure");
const completedRecovery = clone(recovery.api.resumePendingDeletionForOwner(recoveryRequestId));
assert.equal(completedRecovery.ok, true);
assert.equal(completedRecovery.backupPurged, true);
assert.equal(Object.keys(recovery.state.files).length, 0);

const missing = makeHarness();
missing.state.arrays[missing.paths.admin] = [];
missing.state.arrays[missing.paths.attempts] = [];
missing.state.arrays[missing.paths.sessions] = [];
missing.state.arrays[missing.paths.invites] = [];
delete missing.state.files[missing.paths.reports + "/" + missing.code + ".txt"];
const missingPreview = preview(missing);
assert.equal(missingPreview.found, false);
assert.equal(missingPreview.previewToken, "");

assert.match(admin, /id="deletionPreviewForm"/);
assert.match(admin, /id="deletionConfirmForm"/);
assert.match(admin, /requestAdminAction\("adminDeletionPreview"/);
assert.match(admin, /requestAdminAction\("adminDeleteResult"/);
assert.match(admin, /generateApiRequestId\("scd_"\)/);
assert.match(admin, /Введите точный код ещё раз/);
assert.match(admin, /deletion_preview_expired[\s\S]*resetDeletionPreview\(false\)/);
assert.match(extractTopLevelFunction(backend, "doGet"), /adminDeletionPreview[\s\S]*adminDeleteResult[\s\S]*methodNotAllowedResponse/);
const deletionPost = extractTopLevelFunction(backend, "doPost");
assert.match(deletionPost, /guardAdminRequest\(String\(data\.password \|\| ""\), "deletion-preview"\)[\s\S]*adminPreviewResultDeletion/);
assert.match(deletionPost, /guardAdminRequest\(String\(data\.password \|\| ""\), "deletion-commit"\)[\s\S]*adminDeleteResult/);
assert.match(extractTopLevelFunction(backend, "deleteYandexDiskFileIfExists"), /permanently=true[\s\S]*getYandexResourceMetadata/);
assert.match(extractTopLevelFunction(backend, "adminDeleteResult"), /ensureYandexFolderExists\(getDeletionBackupsFolderPath\(\)\)/);
assert.match(extractTopLevelFunction(backend, "getRetentionPolicyStatusForOwner"), /manual-deletion-only/);
assert.match(extractTopLevelFunction(backend, "resumePendingDeletionForOwner"), /readDeletionLog[\s\S]*adminDeleteResult/);

console.log("Stage 12 deletion checks passed: preview, full/result-only deletion, backup purge, replay and purge-failure recovery.");
