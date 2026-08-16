#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-account-self-service.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const schema = fs.readFileSync(path.join(root, "cloud", "schema", "014_candidate_self_service.sql"), "utf8");
const accountCore = fs.readFileSync(path.join(root, "cloud", "account-core.js"), "utf8");
const assessmentCore = fs.readFileSync(path.join(root, "cloud", "assessment-core.js"), "utf8");
const privacy = fs.readFileSync(path.join(root, "privacy.html"), "utf8");
const accountConsent = fs.readFileSync(path.join(root, "account-consent.html"), "utf8");

assert.match(deploy, /\[switch\]\$OpenSelfService/);
assert.match(deploy, /Explicit -OpenSelfService confirmation is required/);
assert.match(deploy, /\$assessmentSourceTag = "assessment-v12"/);
assert.match(deploy, /\$accountSourceTag = "account-v1"/);
assert.match(deploy, /\$assessmentTargetTag = "assessment-v13"/);
assert.match(deploy, /\$accountTargetTag = "account-v2"/);
assert.match(deploy, /014_candidate_self_service\.sql/);
assert.match(deploy, /Set-RolloutGates "false" "false" "false"/);
assert.match(deploy, /assessment_sessions WHERE state = Utf8\('active'\) OR state = Utf8\('reserved'\)/);
assert.match(deploy, /attempt_issuance_enabled -notin @\("true", "false"\)/);
assert.match(deploy, /deploy-yandex-public-site\.ps1/);
assert.match(deploy, /Set-RolloutGates "true" "true" "true"/);
assert.match(deploy, /account_registration_enabled -ne "true"/);
assert.match(deploy, /profile_publication_enabled -ne "false"/);
assert.match(deploy, /employer_contact_enabled -ne "false"/);
assert.match(deploy, /employer_workspace_enabled -ne "false"/);
assert.match(deploy, /ACCOUNT_SESSION_SECRET_V1 -cne/);
assert.match(deploy, /IDENTITY_HASH_SECRET_V1 -cne/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /catch \{[\s\S]*Set-RolloutGates "false" "false" "false"/);
assert.doesNotMatch(deploy, /remove-tag|New-Secret|New-SessionSecret|client_secret|Lockbox|lockbox/);
assert.doesNotMatch(deploy, /Write-Host[^\n]*(?:environment|secret|password)/i);

assert.equal((gateway.match(/tag: "assessment-v13"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "account-v5"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "assessment-v12"/g) || []).length, 0);
assert.equal((gateway.match(/tag: "account-v1"/g) || []).length, 0);
assert.match(schema, /CREATE TABLE IF NOT EXISTS candidate_self_service_slots/);
assert.match(schema, /PRIMARY KEY \(profile_id, test_id\)/);
assert.match(schema, /Utf8\('account_self_service_enabled'\), Utf8\('false'\)/);
assert.match(schema, /Utf8\('account_required_for_attempts'\), Utf8\('false'\)/);
assert.match(accountCore, /skillcheck-account-2026-08-16-v3/);
assert.match(assessmentCore, /yandex-cloud-self-service-2026-08-09-1/);
assert.match(privacy, /skillcheck-privacy-2026-08-17-v12/);
assert.match(accountConsent, /skillcheck-account-2026-08-16-v3/);

console.log("Account self-service deployment checks passed: explicit cutover, paused issuance, additive schema, preserved secrets and closed employer gates.");
