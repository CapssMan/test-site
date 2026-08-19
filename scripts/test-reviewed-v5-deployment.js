#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bankDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-reviewed-banks-v5.ps1"), "utf8");
const runtimeDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-runtime-v5.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const migration = fs.readFileSync(path.join(root, "cloud", "schema", "009_reviewed_banks_v5.sql"), "utf8");

for (const version of ["FA Junior v5.0", "CA Junior v5.0", "FP&A Junior v5.0", "ACC Junior v5.0", "BI Junior v5.0"]) {
  assert(migration.includes(version), `historical pointer migration missing ${version}`);
}
assert.match(bankDeploy, /skillcheck-private-v5-ai-r1/);
assert.match(bankDeploy, /skillcheck-private-v4-r3/);
assert.match(bankDeploy, /verify-reviewed-v5-artifacts\.js/);
assert.match(bankDeploy, /review-v5-2026-07-31-ai-r1/);
assert.match(bankDeploy, /banks\/v5\/\$testId\.json/);
assert.match(bankDeploy, /bank-staging\/\$releaseId/);
assert.match(bankDeploy, /UPDATE assessment_banks SET active = false/);
assert.match(bankDeploy, /UPSERT INTO assessment_banks/);
assert.match(bankDeploy, /UPSERT INTO active_bank_versions/);
assert.match(bankDeploy, /disabled_statickey_auth -ne \$true/);
assert.doesNotMatch(bankDeploy, /(?:OAuth|IAM|YDB)_?(?:TOKEN|KEY)\s*=\s*"[^"\s]+"/i);

for (const [source, target] of [["assessment-v7", "assessment-v8"], ["admin-v4", "admin-v5"], ["read-v5", "read-v6"], ["write-v7", "write-v8"]]) {
  assert(runtimeDeploy.includes(`SourceTag = "${source}"; TargetTag = "${target}"`));
}
for (const tag of ["read-v7", "write-v9"]) assert(gateway.includes(`tag: "${tag}"`));
assert.match(runtimeDeploy, /--no-logging/);
assert.match(runtimeDeploy, /version remove-tag/);
assert.doesNotMatch(runtimeDeploy, /version delete/);
assert(fs.existsSync(path.join(__dirname, "deploy-yandex-private-banks.ps1")), "frozen v4 deployment evidence missing");

console.log("Historical reviewed v5 deployment evidence checks passed.");
