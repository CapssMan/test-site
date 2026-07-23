#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

const context = {
  String, Boolean, Object, Array, RegExp, Error,
  getReportsFolderPath() { throw new Error("root override expected"); },
  getAdminFilePath() { throw new Error("root override expected"); },
  getAttemptsFilePath() { throw new Error("root override expected"); },
  getInvitesFilePath() { throw new Error("root override expected"); },
  getAttemptSessionsFilePath() { throw new Error("root override expected"); },
  getPrivateBanksFolderPath() { throw new Error("root override expected"); },
  getDeletionLogFilePath() { throw new Error("root override expected"); },
  getDeletionBackupsFolderPath() { throw new Error("root override expected"); },
  getOperationalBackupsFolderPath() { throw new Error("root override expected"); }
};
vm.createContext(context);
vm.runInContext(`
  const YANDEX_APP_FOLDER_MIGRATION_SOURCE_ROOT = "disk:/skillcheck";
  const YANDEX_APP_FOLDER_MIGRATION_TARGET_ROOT = "app:/skillcheck";
  ${extractTopLevelFunction(backend, "normalizeDiskPath")}
  ${extractTopLevelFunction(backend, "validateSkillCheckDiskPath")}
  ${extractTopLevelFunction(backend, "joinDiskPath")}
  ${extractTopLevelFunction(backend, "getParentDiskPath")}
  ${extractTopLevelFunction(backend, "getSkillCheckStorageRootForPath")}
  ${extractTopLevelFunction(backend, "getYandexStoragePathPropertyMap")}
  this.__api = { normalizeDiskPath, validateSkillCheckDiskPath, joinDiskPath, getParentDiskPath,
    getSkillCheckStorageRootForPath, getYandexStoragePathPropertyMap };
`, context, { filename: "Code.gs" });

assert.equal(context.__api.validateSkillCheckDiskPath("app:/skillcheck/private/banks"), "app:/skillcheck/private/banks");
assert.equal(context.__api.validateSkillCheckDiskPath("disk:/skillcheck/admin/results.json"), "disk:/skillcheck/admin/results.json");
assert.throws(() => context.__api.validateSkillCheckDiskPath("app:/outside"));
assert.throws(() => context.__api.validateSkillCheckDiskPath("disk:/skillcheck/../secret"));
assert.equal(context.__api.getParentDiskPath("app:/skillcheck/private/attempts.json"), "app:/skillcheck/private");
assert.equal(context.__api.getParentDiskPath("app:/skillcheck"), "app:/");
assert.equal(context.__api.getSkillCheckStorageRootForPath("app:/skillcheck/reports"), "app:/skillcheck");
const appPaths = context.__api.getYandexStoragePathPropertyMap("app:/skillcheck");
assert.equal(appPaths.YANDEX_DISK_ADMIN_FILE, "app:/skillcheck/admin/results.json");
assert.equal(appPaths.YANDEX_DISK_PRIVATE_BANKS_FOLDER, "app:/skillcheck/private/banks");
assert.equal(Object.keys(appPaths).length, 9, "every configurable storage path must move atomically");
assert.match(backend, /const DEFAULT_YANDEX_ADMIN_FILE = "app:\/skillcheck\/admin\/results\.json"/,
  "fresh configuration must default to the least-privilege app-folder root");

const ensureFolder = extractTopLevelFunction(backend, "ensureYandexFolderExistsWithToken");
assert.match(ensureFolder, /root = normalizedPath\.indexOf\("app:\/"\)/);
assert.match(ensureFolder, /yandexApiRequestWithToken\("put"[\s\S]*token\)/);
const accessProbe = extractTopLevelFunction(backend, "probeYandexDiskAccess");
assert.match(accessProbe, /getConfiguredSkillCheckStorageRoot/);
assert.match(accessProbe, /\/v1\/disk\/resources\?path=/);
assert.doesNotMatch(accessProbe, /fetch\("https:\/\/cloud-api\.yandex\.net\/v1\/disk\/"/,
  "least-privilege token must not require disk.info scope");
assert.match(extractTopLevelFunction(backend, "yandexApiRequestWithToken"), /429, 500, 502, 503, 504[\s\S]*Utilities\.sleep/,
  "transient Yandex failures must be retried with backoff");
const mirror = extractTopLevelFunction(backend, "mirrorYandexStorageTree");
assert.match(mirror, /inventoryYandexStorageTree\(sourceRoot, sourceToken, true\)/);
assert.match(mirror, /existing\.size === file\.size[\s\S]*existing\.md5[\s\S]*return/,
  "a retry must skip files already copied with the same server checksum");
assert.match(mirror, /inventoryYandexStorageTree\(targetRoot, targetToken, false\)/,
  "target verification should use Yandex checksums instead of downloading every file again");

const stage = extractTopLevelFunction(backend, "stageYandexAppFolderMigrationForOwner");
assert(stage.indexOf("assertYandexCredentialMigrationGatesClosed") < stage.indexOf("getRequiredProperty"));
assert.match(stage, /YANDEX_APP_FOLDER_MIGRATION_NEXT_TOKEN_PROPERTY/);
assert.match(stage, /mirrorYandexStorageTree/);
assert.match(stage, /YANDEX_APP_FOLDER_MIGRATION_MANIFEST_PROPERTY/);

const promote = extractTopLevelFunction(backend, "promoteYandexAppFolderMigrationForOwner");
const promotionVerifyIndex = promote.indexOf("verifyYandexAppFolderMigrationForOwner");
const promotionTokenSwitchIndex = promote.indexOf('setProperty("YANDEX_DISK_TOKEN"');
assert(promotionVerifyIndex < promotionTokenSwitchIndex);
assert(promote.indexOf("setYandexStoragePathProperties") < promote.indexOf("validateActiveYandexStorageForOwner"));
assert.match(promote, /catch \(error\)[\s\S]*setProperty\("YANDEX_DISK_TOKEN", oldToken\)/,
  "failed promotion must restore the old credential");

const rollback = extractTopLevelFunction(backend, "rollbackYandexAppFolderMigrationForOwner");
const rollbackMirrorIndex = rollback.indexOf("mirrorYandexStorageTree");
const rollbackTokenSwitchIndex = rollback.indexOf('setProperty("YANDEX_DISK_TOKEN", rollbackToken)');
assert(rollbackMirrorIndex < rollbackTokenSwitchIndex);
assert.match(rollback, /validateActiveYandexStorageForOwner/);

const retire = extractTopLevelFunction(backend, "retireYandexDiskRollbackCredentialForOwner");
assert(retire.indexOf("validateActiveYandexStorageForOwner") < retire.indexOf("deleteProperty"));
assert.match(
  extractTopLevelFunction(backend, "validateActiveYandexStorageForOwner"),
  /loadAuthoritativePrivateBank\(testId, BANK_VERSIONS_BY_ID\[testId\]\)/,
  "post-cutover validation must load every bank with its exact authoritative version"
);

const doGet = extractTopLevelFunction(backend, "doGet");
const doPost = extractTopLevelFunction(backend, "doPost");
assert.doesNotMatch(doGet + doPost, /YandexAppFolderMigration|YandexCredentialMigration|RollbackCredential/,
  "credential migration must remain owner-only and absent from the public web API");
assert.doesNotMatch(backend, /YANDEX_DISK_(?:NEXT|ROLLBACK)_TOKEN\s*=\s*["'][A-Za-z0-9._~+\/=]{20,}/,
  "credential values must never be committed");

console.log("Yandex credential migration checks passed: app-folder paths, closed gates, verified promotion and rollback safety.");
