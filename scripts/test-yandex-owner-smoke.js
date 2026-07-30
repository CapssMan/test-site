"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const handler = fs.readFileSync(path.join(root, "cloud", "owner-smoke-handler.js"), "utf8");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-owner-smoke.ps1"), "utf8");
const assessment = fs.readFileSync(path.join(root, "cloud", "assessment-handler.js"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const { assertGatesClosed, createSmokeStore } = require("../cloud/owner-smoke-handler");

assert.match(handler, /OWNER_SMOKE_ACTION = "run-owner-smoke-v1"/);
assert.match(handler, /OWNER_SMOKE_PHASES = new Set/);
assert.match(handler, /OWNER_SMOKE_FAILURE_CODES = new Set/);
assert.match(handler, /OWNER_SMOKE_OPERATIONS = new Set/);
assert.match(handler, /OWNER_SMOKE_FAILURE_KINDS/);
assert.match(handler, /classifyDependencyError/);
assert.match(handler, /failureKind = OWNER_SMOKE_FAILURE_KINDS\.has/);
assert.match(handler, /createTracedDependency/);
assert.match(handler, /operation = OWNER_SMOKE_OPERATIONS\.has/);
assert.match(handler, /failureCode = OWNER_SMOKE_FAILURE_CODES\.has/);
assert.match(handler, /OWNER_SMOKE_PHASES\.has\(error && error\.smokePhase\)/);
assert.doesNotMatch(handler, /(?:message|stack)\s*:\s*error/);
assert.match(handler, /assertGatesClosed\(actualBefore\)/);
assert.match(handler, /legal_pilot_approved: "true", attempt_issuance_enabled: "true"/);
assert.match(handler, /target\.insertResult\(Object\.assign\(\{\}, row, \{ technical: true \}\)\)/);
assert.match(handler, /stored\.technical !== true/);
assert.match(handler, /scoreVerification !== "server-verified"/);
assert.match(handler, /Number\(stored\.percent\) !== 100/);
assert.match(handler, /storage\.deleteObject\(reportObjectKey/);
assert.match(handler, /adminStore\.deleteAssessmentData/);
assert.match(handler, /getInviteById\(inviteId\)[\s\S]*getSessionByInviteId\(inviteId\)/);
assert.match(handler, /assertGatesClosed\(await store\.getRuntimeSettings\(\)\)/);
assert.doesNotMatch(handler, /UPDATE assessment_runtime_settings|UPSERT INTO assessment_runtime_settings/);

assert.match(deploy, /entrypoint owner-smoke-handler\.handler/);
assert.match(deploy, /--tag assessment-v6/);
assert.doesNotMatch(deploy, /--tag assessment-v1/);
assert.match(deploy, /Unrouted clean successor for owner-smoke cleanup/);
assert.match(deploy, /entrypoint index\.handler/);
assert.match(deploy, /if \(\$smokeSucceeded\) \{ throw \$cleanupError \}/);
assert.match(deploy, /Temporary IAM-only owner smoke; never routed through API Gateway/);
assert.match(deploy, /serverless function invoke --id \$functionId --tag \$tag --data-file \$eventPath/);
assert.doesNotMatch(deploy, /serverless function invoke[^\n]+--data\s/);
assert.match(deploy, /serverless function version delete --id \$versionId --force/);
assert.match(deploy, /Assert-ClosedState/);
assert.match(deploy, /failureCode -ne "attempt_unavailable"/);
assert.doesNotMatch(gateway, /owner-smoke|run-owner-smoke/);
assert.doesNotMatch(assessment, /ownerSmoke|OWNER_SMOKE|run-owner-smoke/);

(async function verifyScopedStoreOverride() {
  const actualSettings = {
    legal_pilot_approved: "false",
    attempt_issuance_enabled: "false",
    retention_automation_enabled: "true"
  };
  let inserted;
  const baseStore = {
    async getRuntimeSettings() { return Object.assign({}, actualSettings); },
    async insertResult(row) { inserted = row; }
  };
  assert.doesNotThrow(() => assertGatesClosed(actualSettings));
  assert.throws(() => assertGatesClosed(Object.assign({}, actualSettings, { attempt_issuance_enabled: "true" })), /gates_not_closed/);
  const smokeStore = createSmokeStore(baseStore);
  const temporary = await smokeStore.getRuntimeSettings();
  assert.equal(temporary.legal_pilot_approved, "true");
  assert.equal(temporary.attempt_issuance_enabled, "true");
  assert.deepEqual(await baseStore.getRuntimeSettings(), actualSettings, "real gate state must remain unchanged");
  await smokeStore.insertResult({ technical: false, code: "FA-SMOKE" });
  assert.equal(inserted.technical, true);
  console.log("Yandex owner-smoke checks passed: IAM-only temporary version, technical marking, exact cleanup and no public gate bypass.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
