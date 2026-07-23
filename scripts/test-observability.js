#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

const functionNames = [
  "getAdminDiagnostics",
  "buildProtectedDiagnostics",
  "buildProtectedDiagnosticStoreStatus",
  "buildProtectedDiagnosticReportsStatus",
  "newestProtectedDiagnosticRowTimestamp",
  "newestProtectedDiagnosticTimestamp",
  "normalizeProtectedDiagnosticTimestamp",
  "buildProtectedDiagnosticError"
];
const diagnosticSource = functionNames.map(name => extractTopLevelFunction(backend, name)).join("\n\n");

function makeHarness(options = {}) {
  const paths = {
    "admin-results": "disk:/skillcheck/admin/results.json",
    attempts: "disk:/skillcheck/private/attempts.json",
    "attempt-sessions": "disk:/skillcheck/private/attempt-sessions-v1.json",
    invites: "disk:/skillcheck/private/invites-v1.json"
  };
  const rows = {
    "admin-results": [{ code: "FA-SECRET", name: "Private Person", email: "private@example.com", date: "2026-07-20T10:00:00.000Z" }],
    attempts: [{ attemptId: "att_private", date: "2026-07-20T11:00:00.000Z" }],
    "attempt-sessions": [{ attemptId: "att_private", updatedAt: "2026-07-20T12:00:00.000Z" }],
    invites: [{ inviteId: "inv_private", issuedAt: "2026-07-20T09:00:00.000Z" }]
  };
  const propertyValues = {
    YANDEX_DISK_TOKEN: "super-secret-oauth-token",
    ATTEMPT_HASH_SALT: "super-secret-salt",
    ADMIN_PASSWORD: "correct-password",
    ATTEMPT_SIGNING_SECRET_V1: "signing-secret",
    INVITE_CODE_SECRET_V1: "invite-secret",
    IDENTITY_HASH_SECRET_V1: "identity-secret",
    LEGAL_PILOT_APPROVED: "false",
    ATTEMPT_ISSUANCE_ENABLED: "false"
  };
  const state = { reads: 0 };
  const context = {
    String, Number, Boolean, Array, Object, JSON, Math, Date, Error, RegExp,
    BACKEND_VERSION: "yandex-disk-mvp-2026-07-23-15",
    AUTHORITATIVE_API_VERSION: "attempt-v2",
    CANDIDATE_FRONTEND_BUILD: "2026.07.21.13",
    ADMIN_FRONTEND_BUILD: "2026.07.21.13",
    RETENTION_AUTOMATION_ENABLED: false,
    PROTECTED_DIAGNOSTIC_PROPERTY_NAMES: [
      "YANDEX_DISK_TOKEN", "YANDEX_DISK_REPORTS_FOLDER", "ATTEMPT_HASH_SALT", "ADMIN_PASSWORD",
      "ATTEMPT_SIGNING_SECRET_V1", "INVITE_CODE_SECRET_V1", "IDENTITY_HASH_SECRET_V1",
      "LEGAL_PILOT_APPROVED", "ATTEMPT_ISSUANCE_ENABLED"
    ],
    PropertiesService: {
      getScriptProperties() {
        return { getProperty(name) { return Object.prototype.hasOwnProperty.call(propertyValues, name) ? propertyValues[name] : null; } };
      }
    },
    isAdminPasswordValid(password) { return password === "correct-password"; },
    probeYandexDiskAccess() {
      return options.probeFailure
        ? { ok: false, statusCode: 401, errorMessage: "OAuth super-secret-oauth-token failed at disk:/skillcheck/private" }
        : { ok: true, statusCode: 200, errorMessage: "" };
    },
    getOperationalStoreKeys() { return Object.keys(paths); },
    getOperationalStoreDescriptor(key) { return { storeKey: key, label: key, path: paths[key] }; },
    getYandexResourceMetadata(storagePath) {
      if (storagePath === "disk:/skillcheck/reports") {
        return { exists: true, type: "dir", modified: "2026-07-20T12:30:00.000Z", publicKey: "", publicUrl: "", shared: false };
      }
      return { exists: true, type: "file", size: storagePath.length * 10, modified: "2026-07-20T12:15:00.000Z", publicKey: "", publicUrl: "", shared: false };
    },
    readRequiredJsonArray(storagePath) {
      state.reads++;
      const key = Object.keys(paths).find(item => paths[item] === storagePath);
      if (options.failingStore === key) throw new Error("Yandex API error OAuth super-secret-oauth-token disk:/skillcheck/private/attempts.json");
      return JSON.parse(JSON.stringify(rows[key]));
    },
    getReportsFolderPath() { return "disk:/skillcheck/reports"; },
    listYandexFolderContents() {
      return {
        exists: true,
        type: "dir",
        items: [
          { name: "FA-SECRET.txt", type: "file", path: "disk:/skillcheck/reports/FA-SECRET.txt", publicKey: "", publicUrl: "", shared: false },
          { name: "nested", type: "dir", path: "disk:/skillcheck/reports/nested", publicKey: "", publicUrl: "", shared: false }
        ]
      };
    },
    isLegalPilotApproved() { return false; },
    getScriptProperty(name) { return propertyValues[name] || null; }
  };
  vm.createContext(context);
  vm.runInContext(diagnosticSource, context);
  return { context, state };
}

const protectedHarness = makeHarness();
let response = protectedHarness.context.getAdminDiagnostics("wrong-password");
assert.equal(response.ok, false);
assert.equal(protectedHarness.state.reads, 0, "wrong password must be rejected before any storage read");

response = protectedHarness.context.getAdminDiagnostics("correct-password");
assert.equal(response.ok, true);
assert.equal(response.status, "healthy");
assert.equal(response.backendVersion, "yandex-disk-mvp-2026-07-23-15");
assert.equal(response.frontendVersions.candidate, "2026.07.21.13");
assert.equal(response.frontendVersions.admin, "2026.07.21.13");
assert.equal(response.yandexDisk.accessible, true);
assert.equal(response.stores.length, 4);
assert.equal(response.stores.find(item => item.key === "admin-results").rowCount, 1);
assert.equal(response.stores.find(item => item.key === "attempt-sessions").lastRecordAt, "2026-07-20T12:00:00.000Z");
assert.equal(response.reports.itemCount, 1);
assert.equal(response.lastWriteAt, "2026-07-20T12:30:00.000Z");
assert.equal(response.properties.find(item => item.name === "YANDEX_DISK_REPORTS_FOLDER").required, false);
assert.equal(response.properties.find(item => item.name === "YANDEX_DISK_TOKEN").required, true);

const serialized = JSON.stringify(response);
[
  "super-secret-oauth-token", "super-secret-salt", "signing-secret", "correct-password",
  "Private Person", "private@example.com", "FA-SECRET", "att_private", "inv_private", "disk:/skillcheck"
].forEach(secret => assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "diagnostics leaked: " + secret));

const failureHarness = makeHarness({ failingStore: "attempts" });
const failed = failureHarness.context.getAdminDiagnostics("correct-password");
assert.equal(failed.ok, false);
assert.equal(failed.status, "degraded");
assert.equal(failed.lastError.component, "attempts");
assert.equal(failed.lastError.code, "storage_unavailable");
assert.doesNotMatch(JSON.stringify(failed), /OAuth|super-secret|disk:\/skillcheck|attempts\.json/);

const publicHealth = extractTopLevelFunction(backend, "buildPublicHealthStatus");
const publicContext = { BACKEND_VERSION: "stage14" };
vm.createContext(publicContext);
vm.runInContext(publicHealth, publicContext);
assert.deepEqual(
  JSON.parse(JSON.stringify(publicContext.buildPublicHealthStatus())),
  { ok: true, status: "alive", service: "skillcheck-backend", backendVersion: "stage14" },
  "public health must remain intentionally minimal"
);

const doGet = extractTopLevelFunction(backend, "doGet");
const doPost = extractTopLevelFunction(backend, "doPost");
assert.match(doGet, /"adminDiagnostics"/);
assert.match(doGet, /требуется POST-запрос/);
assert.doesNotMatch(doGet, /getAdminDiagnostics\(/, "GET must never execute protected diagnostics");
assert.doesNotMatch(doGet + doPost, /verifyProtectedDiagnosticsForOwner\(/, "owner verification must not have a public route");
assert.match(doPost, /action === "adminDiagnostics"[\s\S]*guardAdminRequest\([\s\S]*getAdminDiagnostics/);
assert.match(doPost, /assertAllowedObjectKeys\(data, \["action", "apiVersion", "password"\], "adminDiagnostics"\)/);

assert.match(admin, /requestAdminAction\("adminDiagnostics", password, \{\}, 45000\)/);
assert.match(admin, /Значения properties, пути, идентификаторы и персональные данные не возвращаются/);
assert.match(admin, /const FRONTEND_BUILD = "2026\.07\.21\.13"/);
assert.doesNotMatch(admin, /[?&]password=/i, "admin password must never be placed in a URL");
assert.doesNotMatch(admin, /(?:localStorage|sessionStorage)\.(?:setItem|getItem)/, "admin password and diagnostics must not be persisted in browser storage");

console.log("Stage 14 observability checks passed: protected aggregates, minimal public health, fail-safe errors and no secret/PII leakage.");
