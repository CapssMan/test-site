#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bankDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-reviewed-banks-v5.ps1"), "utf8");
const runtimeDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-runtime-v5.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const core = fs.readFileSync(path.join(root, "cloud", "assessment-core.js"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const migration = fs.readFileSync(path.join(root, "cloud", "schema", "009_reviewed_banks_v5.sql"), "utf8");

const versions = ["FA Junior v5.0", "CA Junior v5.0", "FP&A Junior v5.0", "ACC Junior v5.0", "BI Junior v5.0"];
for (const version of versions) {
  assert(core.includes(version), `assessment core missing ${version}`);
  assert(candidate.includes(version), `candidate page missing ${version}`);
  assert(admin.includes(version), `admin page missing ${version}`);
  assert(migration.includes(version), `ranking pointer migration missing ${version}`);
}
assert.match(candidate, /Build 2026\.07\.31\.4/);
assert.match(admin, /Build 2026\.07\.31\.4/);

assert.match(bankDeploy, /skillcheck-private-v5-ai-r1/);
assert.match(bankDeploy, /skillcheck-private-v4-r3/);
assert.match(bankDeploy, /verify-reviewed-v5-artifacts\.js/);
assert.match(bankDeploy, /review-v5-2026-07-31-ai-r1/);
assert.match(bankDeploy, /banks\/v5\/\$testId\.json/);
assert.match(bankDeploy, /bank-staging\/\$releaseId/);
assert.match(bankDeploy, /UPDATE assessment_banks SET active = false/);
assert.match(bankDeploy, /UPSERT INTO assessment_banks/);
assert.match(bankDeploy, /UPSERT INTO active_bank_versions/);
assert.match(bankDeploy, /WHERE active = true/);
assert.match(bankDeploy, /legal_pilot_approved -ne "false"/);
assert.match(bankDeploy, /attempt_issuance_enabled -ne "false"/);
assert.match(bankDeploy, /disabled_statickey_auth -ne \$true/);
assert.match(bankDeploy, /Download-And-Verify \$stageUri/);
assert.match(bankDeploy, /Download-And-Verify \$finalUri/);
assert.doesNotMatch(bankDeploy, /privateFileSha256\s*=\s*"[a-f0-9]{64}"/i);
assert.doesNotMatch(bankDeploy, /(?:OAuth|IAM|YDB)_?(?:TOKEN|KEY)\s*=\s*"[^"\s]+"/i);

for (const [source, target] of [["assessment-v7", "assessment-v8"], ["admin-v4", "admin-v5"], ["read-v5", "read-v6"], ["write-v7", "write-v8"]]) {
  assert(runtimeDeploy.includes(`SourceTag = "${source}"; TargetTag = "${target}"`));
}
for (const tag of ["assessment-v9", "admin-v6", "read-v6", "write-v8"]) {
  assert(gateway.includes(`tag: "${tag}"`));
}
assert.match(runtimeDeploy, /--no-logging/);
assert.match(runtimeDeploy, /version remove-tag/);
assert.doesNotMatch(runtimeDeploy, /version delete/);
assert.match(runtimeDeploy, /prior tags remain available for rollback/i);
assert(fs.existsSync(path.join(__dirname, "deploy-yandex-private-banks.ps1")), "frozen v4 deployment evidence missing");

console.log("Reviewed v5 deployment checks passed: versioned private cutover, ranking pointers, runtime tags and closed gates.");
