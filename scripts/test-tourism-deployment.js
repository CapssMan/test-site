#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-tourism-v1.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");

assert.match(deploy, /param\(\[switch\]\$PublishTourism\)/);
assert.match(deploy, /Explicit -PublishTourism confirmation is required/);
assert.match(deploy, /Set-AttemptGates "false" "false"/);
assert.match(deploy, /Active assessment sessions block tourism cutover/);
assert.match(deploy, /anonymous_access_flags\.read/);
assert.match(deploy, /disabled_statickey_auth/);
assert.match(deploy, /banks\/tourism-v1\/tourism-junior\.json/);
assert.match(deploy, /Get-FileHash[\s\S]*SHA256/);
assert.match(deploy, /UPSERT INTO assessment_banks/);
assert.match(deploy, /UPSERT INTO active_bank_versions/);
assert.match(deploy, /deploy-yandex-public-site\.ps1/);
assert.match(deploy, /profile_publication_enabled -ne "false"/);
assert.match(deploy, /employer_workspace_enabled -ne "false"/);
assert.match(deploy, /employer_contact_enabled -ne "false"/);
assert.doesNotMatch(deploy, /Lockbox|lockbox/);
assert.doesNotMatch(deploy, /serverless function version delete|function delete/);
for (const tag of ["assessment-v14", "account-v6", "admin-v12", "employer-v4"]) {
  assert.equal((gateway.match(new RegExp(`tag: "${tag}"`, "g")) || []).length, 2, `${tag} must own both gateway methods`);
}
assert.match(gateway, /- tourism-junior/);
console.log("Tourism deployment checks passed: additive bank, paused issuance, checksum verification, rollback versions and closed employer gates.");
