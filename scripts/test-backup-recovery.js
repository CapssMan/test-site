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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeHarness(options = {}) {
  const paths = {
    admin: "disk:/skillcheck/admin/results.json",
    attempts: "disk:/skillcheck/private/attempts.json",
    sessions: "disk:/skillcheck/private/attempt-sessions-v1.json",
    invites: "disk:/skillcheck/private/invites-v1.json",
    backups: "disk:/skillcheck/private/backups-v1"
  };
  const initial = {
    [paths.admin]: [{ code: "FA-ABCDE", attemptId: "att_target", value: 1 }],
    [paths.attempts]: [{ code: "FA-ABCDE", attemptId: "att_target" }],
    [paths.sessions]: [{ code: "FA-ABCDE", attemptId: "att_target", inviteId: "inv_target" }],
    [paths.invites]: [{ attemptId: "att_target", inviteId: "inv_target" }]
  };
  const state = {
    files: Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value, null, 2)])),
    folders: new Set(["disk:/skillcheck", "disk:/skillcheck/admin", "disk:/skillcheck/private", paths.backups]),
    uuid: 0,
    issuanceEnabled: Boolean(options.issuanceEnabled),
    legalApproved: Boolean(options.legalApproved)
  };

  const context = {
    String, Number, Boolean, Array, Object, JSON, Math, Date, Error, RegExp, isFinite,
    console: { log() {}, error() {} },
    Utilities: {
      getUuid() {
        state.uuid++;
        return state.uuid.toString(16).padStart(8, "0") + "-0000-4000-8000-000000000000";
      }
    },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
    getAdminFilePath() { return paths.admin; },
    getAttemptsFilePath() { return paths.attempts; },
    getAttemptSessionsFilePath() { return paths.sessions; },
    getInvitesFilePath() { return paths.invites; },
    getOperationalBackupsFolderPath() { return paths.backups; },
    joinDiskPath(folder, name) { return String(folder).replace(/\/$/, "") + "/" + String(name).replace(/^\//, ""); },
    normalizeDiskPath(value) { return String(value || "").replace(/\/+/g, "/").replace(/^disk:\//, "disk:/"); },
    isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); },
    sha256Hex(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); },
    timingSafeEqual(left, right) {
      const a = Buffer.from(String(left));
      const b = Buffer.from(String(right));
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
    readTextFromYandexDisk(storagePath) {
      return Object.prototype.hasOwnProperty.call(state.files, storagePath) ? state.files[storagePath] : null;
    },
    uploadTextToYandexDisk(storagePath, text) {
      state.files[storagePath] = String(text);
      state.folders.add(storagePath.slice(0, storagePath.lastIndexOf("/")));
    },
    ensureYandexFolderExists(storagePath) { state.folders.add(storagePath); },
    ensureSkillCheckFolders() {
      state.folders.add(paths.backups);
      ["admin-results", "attempts", "attempt-sessions", "invites"].forEach(key => {
        state.folders.add(paths.backups + "/" + key);
        state.folders.add(paths.backups + "/corrupt/" + key);
      });
    },
    getYandexResourceMetadata(storagePath) {
      if (state.folders.has(storagePath)) return { exists: true, type: "dir", publicKey: "", publicUrl: "", shared: false };
      if (Object.prototype.hasOwnProperty.call(state.files, storagePath)) return { exists: true, type: "file", publicKey: "", publicUrl: "", shared: false };
      return { exists: false, type: "missing", publicKey: "", publicUrl: "", shared: false };
    },
    listYandexFolderContents(folder) {
      if (!state.folders.has(folder)) return { exists: false, type: "missing", items: [] };
      const prefix = folder.replace(/\/$/, "") + "/";
      const items = Object.keys(state.files).filter(file => file.startsWith(prefix) && !file.slice(prefix.length).includes("/"))
        .map(file => ({ name: file.slice(prefix.length), type: "file", path: file }));
      return { exists: true, type: "dir", items };
    },
    deleteYandexDiskFileIfExists(storagePath) {
      if (!Object.prototype.hasOwnProperty.call(state.files, storagePath)) return false;
      delete state.files[storagePath];
      return true;
    },
    getScriptProperty(name) {
      if (name === "ATTEMPT_ISSUANCE_ENABLED") return state.issuanceEnabled ? "true" : "false";
      if (name === "LEGAL_PILOT_APPROVED") return state.legalApproved ? "true" : "false";
      return "";
    },
    assertAuthoritativePrivateStorageNotShared() {}
  };
  vm.createContext(context);
  const constants = `
    const BACKEND_VERSION = "test";
    const LEGAL_PILOT_APPROVAL_PROPERTY = "LEGAL_PILOT_APPROVED";
    const OPERATIONAL_BACKUP_SCHEMA_VERSION = 1;
    const OPERATIONAL_BACKUP_LIMIT_PER_STORE = 12;
    const OPERATIONAL_CORRUPT_ARTIFACT_LIMIT_PER_STORE = 3;
    const MAX_OPERATIONAL_STORE_ROWS = 100000;
    const MAX_OPERATIONAL_STORE_CHARS = 20 * 1024 * 1024;
  `;
  const functions = [
    "assertExactPrivateKeys", "getOperationalStoreKeys", "getOperationalStoreDescriptor", "getOperationalStoreDescriptorByPath",
    "getOperationalBackupStoreFolder", "getOperationalCorruptStoreFolder", "normalizeOperationalStoreRows",
    "parseOperationalBackupEnvelope", "buildOperationalBackupEnvelope", "buildOperationalBackupFileName",
    "listOperationalBackupFiles", "rotateOperationalBackupFiles", "writeOperationalBackupSnapshot",
    "listCorruptOperationalArtifacts", "captureCorruptOperationalArtifact", "readRequiredJsonArray", "writeRequiredJsonArray",
    "createOperationalBackupsForOwner", "getOperationalBackupStatusForOwner", "restoreOperationalStoreForOwner",
    "normalizeDeletionScope", "uniqueDeletionIds", "buildOperationalBackupDeletionCriteria", "operationalBackupRowMatchesDeletion",
    "collectOperationalBackupDeletionEntries", "scrubOperationalBackupsForDeletion"
  ];
  vm.runInContext(constants + functions.map(name => extractTopLevelFunction(backend, name)).join("\n\n") + `
    this.__api = {
      writeRequiredJsonArray, readRequiredJsonArray, restoreOperationalStoreForOwner,
      createOperationalBackupsForOwner, getOperationalBackupStatusForOwner,
      collectOperationalBackupDeletionEntries, scrubOperationalBackupsForDeletion,
      listOperationalBackupFiles, parseOperationalBackupEnvelope
    };
  `, context, { filename: backendPath });
  return { paths, state, api: context.__api };
}

function backupFiles(harness, storeKey) {
  return harness.api.listOperationalBackupFiles(storeKey).map(item => item.name);
}

const normal = makeHarness();
normal.api.writeRequiredJsonArray(normal.paths.admin, [
  { code: "FA-ABCDE", attemptId: "att_target", value: 1 },
  { code: "CA-ABCDE", attemptId: "att_other", value: 2 }
]);
assert.equal(backupFiles(normal, "admin-results").length, 1, "write must snapshot the previous valid state");
const firstBackupName = backupFiles(normal, "admin-results")[0];
const firstBackupText = normal.state.files[normal.paths.backups + "/admin-results/" + firstBackupName];
const firstEnvelope = normal.api.parseOperationalBackupEnvelope(firstBackupText, "admin-results", normal.paths.admin);
assert.equal(firstEnvelope.reason, "before-write");
assert.equal(firstEnvelope.rowCount, 1);
assert.equal(JSON.parse(normal.state.files[normal.paths.admin]).length, 2);

normal.api.writeRequiredJsonArray(normal.paths.admin, JSON.parse(normal.state.files[normal.paths.admin]));
assert.equal(backupFiles(normal, "admin-results").length, 1, "identical write must not create redundant backup");
for (let index = 0; index < 15; index++) {
  normal.api.writeRequiredJsonArray(normal.paths.admin, [{ code: "FA-ABCDE", attemptId: "att_target", value: 100 + index }]);
}
assert.equal(backupFiles(normal, "admin-results").length, 12, "rotation must remain bounded");

const corruptWrite = makeHarness();
corruptWrite.state.files[corruptWrite.paths.admin] = "{broken";
assert.throws(() => corruptWrite.api.writeRequiredJsonArray(corruptWrite.paths.admin, [{ code: "FA-ABCDE" }]), /corrupt/);
assert.equal(corruptWrite.state.files[corruptWrite.paths.admin], "{broken", "normal write must fail closed on corruption");

const recovery = makeHarness();
recovery.api.writeRequiredJsonArray(recovery.paths.admin, [{ code: "CA-ABCDE", attemptId: "att_other" }]);
const recoveryBackup = backupFiles(recovery, "admin-results")[0];
recovery.state.files[recovery.paths.admin] = "{damaged-json";
const restored = clone(recovery.api.restoreOperationalStoreForOwner("admin-results", recoveryBackup));
assert.equal(restored.ok, true);
assert.equal(restored.status, "restored");
assert.match(restored.corruptSafetyArtifact, /^corrupt_/);
assert.equal(JSON.parse(recovery.state.files[recovery.paths.admin])[0].code, "FA-ABCDE");
assert.equal(Object.keys(recovery.state.files).some(name => name.includes("/corrupt/admin-results/corrupt_")), true);

const tampered = makeHarness();
tampered.api.writeRequiredJsonArray(tampered.paths.admin, [{ code: "CA-ABCDE" }]);
const tamperedName = backupFiles(tampered, "admin-results")[0];
const tamperedPath = tampered.paths.backups + "/admin-results/" + tamperedName;
const tamperedEnvelope = JSON.parse(tampered.state.files[tamperedPath]);
tamperedEnvelope.rows[0].code = "BI-ABCDE";
tampered.state.files[tamperedPath] = JSON.stringify(tamperedEnvelope);
const activeBeforeTamperedRestore = tampered.state.files[tampered.paths.admin];
assert.throws(() => tampered.api.restoreOperationalStoreForOwner("admin-results", tamperedName), /integrity/);
assert.equal(tampered.state.files[tampered.paths.admin], activeBeforeTamperedRestore);

const gated = makeHarness({ issuanceEnabled: true });
gated.api.writeRequiredJsonArray(gated.paths.admin, [{ code: "CA-ABCDE" }]);
assert.throws(() => gated.api.restoreOperationalStoreForOwner("admin-results", backupFiles(gated, "admin-results")[0]), /closed pilot gates/);

const baseline = makeHarness();
const baselineResult = clone(baseline.api.createOperationalBackupsForOwner());
assert.equal(baselineResult.length, 4);
assert.deepEqual(baselineResult.map(row => row.storeKey), ["admin-results", "attempts", "attempt-sessions", "invites"]);
assert.equal(clone(baseline.api.getOperationalBackupStatusForOwner()).stores.every(store => store.count === 1), true);

const redaction = makeHarness();
redaction.api.createOperationalBackupsForOwner();
const criteria = { code: "FA-ABCDE", scope: "full_attempt", attemptIds: ["att_target"], inviteIds: ["inv_target"] };
const deletionEntries = clone(redaction.api.collectOperationalBackupDeletionEntries(criteria));
assert.equal(deletionEntries.length, 4, "all linked store backups must be discovered");
redaction.api.scrubOperationalBackupsForDeletion(Object.assign({}, criteria, { operationalBackupEntries: deletionEntries }));
assert.equal(clone(redaction.api.collectOperationalBackupDeletionEntries(criteria)).length, 0, "deleted identity must be absent from backups");
for (const storeKey of ["admin-results", "attempts", "attempt-sessions", "invites"]) {
  const name = backupFiles(redaction, storeKey)[0];
  const descriptorPath = redaction.paths[({ "admin-results": "admin", attempts: "attempts", "attempt-sessions": "sessions", invites: "invites" })[storeKey]];
  const envelope = redaction.api.parseOperationalBackupEnvelope(redaction.state.files[redaction.paths.backups + "/" + storeKey + "/" + name], storeKey, descriptorPath);
  assert.equal(envelope.reason, "deletion-redaction");
  assert.equal(envelope.rows.length, 0);
}

const doGet = extractTopLevelFunction(backend, "doGet");
const doPost = extractTopLevelFunction(backend, "doPost");
assert.doesNotMatch(doGet + doPost, /restoreOperationalStoreForOwner|createOperationalBackupsForOwner|getOperationalBackupStatusForOwner/);
assert.match(extractTopLevelFunction(backend, "writeRequiredJsonArray"), /writeOperationalBackupSnapshot[\s\S]*uploadTextToYandexDisk[\s\S]*readRequiredJsonArray/);
assert.match(extractTopLevelFunction(backend, "removeDeletionTargetsFromStores"), /skipBackup: true/);
assert.match(extractTopLevelFunction(backend, "adminDeleteResult"), /scrubOperationalBackupsForDeletion[\s\S]*collectOperationalBackupDeletionEntries/);
assert.match(extractTopLevelFunction(backend, "restoreOperationalStoreForOwner"), /ATTEMPT_ISSUANCE_ENABLED[\s\S]*LEGAL_PILOT_APPROVAL_PROPERTY[\s\S]*captureCorruptOperationalArtifact/);

console.log("Stage 13 backup checks passed: verified snapshot, bounded rotation, fail-closed writes, corruption recovery and deletion redaction.");
