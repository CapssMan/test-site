#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(root, "scripts", "deploy-yandex-pilot-feedback.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

assert.match(deploy, /param\(\[switch\]\$PublishPilotFeedback\)/);
assert.match(deploy, /Explicit -PublishPilotFeedback confirmation is required/);
for (const [source, target] of [["assessment-v14", "assessment-v15"], ["admin-v12", "admin-v13"]]) {
  assert.equal((gateway.match(new RegExp(`tag: "${source}"`, "g")) || []).length, 2);
  assert(deploy.includes(`SourceTag = "${source}"`));
  assert(deploy.includes(`TargetTag = "${target}"`));
  assert.match(deploy, new RegExp(`tag: "${source}"[\\s\\S]*tag: "${target}"`));
}
assert.match(deploy, /020_pilot_feedback\.sql/);
assert.match(deploy, /Set-AttemptGates "false" "false"/);
assert.match(deploy, /state = Utf8\('active'\).*state = Utf8\('reserved'\)/);
assert.match(deploy, /privacy-consent and feedback cutover/);
assert.match(deploy, /pilot-analytics\.js/);
assert.match(deploy, /deploy-yandex-public-site\.ps1"\) -SkipGatewayUpdate/);
assert.match(deploy, /skillcheck-pd-consent-2026-08-21-v6/);
assert.match(deploy, /yandex-pilot-feedback-2026-08-21-1/);
assert(candidate.includes('id="feedbackBlock"'));
assert(admin.includes('id="pilotContent"'));
assert(deploy.includes('id="feedbackBlock"'));
assert(deploy.includes('id="pilotContent"'));
assert.match(deploy, /API Gateway was restored to assessment-v14 and admin-v12/);
assert.match(deploy, /new attempt issuance stays closed/);
for (const gate of ["profile_publication_enabled", "employer_workspace_enabled", "employer_invitation_enabled", "employer_contact_enabled", "candidate_credentials_enabled", "employer_company_profiles_enabled", "employer_chat_enabled"]) assert(deploy.includes(gate));
assert.match(deploy, /--no-logging/);
assert.doesNotMatch(deploy, /version delete|version remove-tag|Lockbox|lockbox|secret create|system:allUsers|--public/);
console.log("Pilot-feedback deployment checks passed: explicit approval, additive schema, drained sessions, temporary gateway cutover, rollback and closed product gates.");