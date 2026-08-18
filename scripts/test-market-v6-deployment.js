#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bankDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-market-banks-v6.ps1"), "utf8");
const runtimeDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-market-runtime-v6.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const migration = fs.readFileSync(path.join(root, "cloud", "schema", "010_market_calibration_v6.sql"), "utf8");

for (const version of ["FA Junior v6.0", "CA Junior v6.0", "FP&A Junior v6.0", "ACC Junior v6.0", "BI Junior v6.0"]) {
  assert(bankDeploy.includes(version));
  assert(migration.includes(version));
}
assert.match(bankDeploy, /skillcheck-private-v6-market-r1/);
assert.match(bankDeploy, /verify-market-calibrated-v6\.js/);
assert.match(bankDeploy, /market-calibration-v6-2026-08-02-r1/);
assert.match(bankDeploy, /banks\/v6\/\$testId\.json/);
assert.match(bankDeploy, /bank-staging\/\$releaseId/);
assert.match(bankDeploy, /UPDATE assessment_banks SET active = false/);
assert.match(bankDeploy, /UPSERT INTO active_bank_versions/);
assert.match(bankDeploy, /legal_pilot_approved -ne "true"/);
assert.match(bankDeploy, /attempt_issuance_enabled -ne "false"/);
assert.match(bankDeploy, /A non-terminal assessment session blocks/);
assert.match(bankDeploy, /disabled_statickey_auth -ne \$true/);
assert.match(bankDeploy, /Download-And-Verify \$stageUri/);
assert.match(bankDeploy, /Download-And-Verify \$finalUri/);
assert.doesNotMatch(bankDeploy, /privateFileSha256\s*=\s*"[a-f0-9]{64}"/i);
assert.doesNotMatch(bankDeploy, /(?:OAuth|IAM|YDB)_?(?:TOKEN|KEY)\s*=\s*"[^"\s]+"/i);

for (const [source, targetTag] of [["assessment-v10", "assessment-v11"], ["admin-v7", "admin-v8"]]) {
  assert(runtimeDeploy.includes(`SourceTag = "${source}"; TargetTag = "${targetTag}"`));
}
for (const retired of ["assessment-v8", "admin-v5"]) assert(runtimeDeploy.includes(`"${retired}"`));
for (const tag of ["assessment-v14", "admin-v12", "read-v6", "write-v8"]) {
  assert(gateway.includes(`tag: "${tag}"`));
}
assert.match(runtimeDeploy, /--no-logging/);
assert.match(runtimeDeploy, /version remove-tag/);
assert.doesNotMatch(runtimeDeploy, /version delete/);
assert.match(runtimeDeploy, /immediate predecessors remain for rollback/i);

console.log("Market v6 deployment checks passed: private cutover, terminal-session gate, runtime successors and rollback boundary.");
