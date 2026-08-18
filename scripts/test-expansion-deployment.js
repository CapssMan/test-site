#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(root, "scripts", "deploy-yandex-expansion-v1.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const publicDeploy = fs.readFileSync(path.join(root, "scripts", "deploy-yandex-public-site.ps1"), "utf8");

assert.match(deploy, /param\(\[switch\]\$PublishExpansion\)/);
assert.match(deploy, /Explicit -PublishExpansion confirmation is required/);
for (const [testId, version, privateFolder, objectKey, audit] of [
  ["tourism-junior", "Tourism & Hospitality Operations Junior v1.1", "skillcheck-private-tourism-r1", "banks\/tourism-v1\/tourism-junior.json", "audit-tourism-bank.js"],
  ["software-junior", "Software Development Junior v1.0", "skillcheck-private-software-r1", "banks\/software-v1\/software-junior.json", "audit-software-bank.js"],
  ["product-project-junior", "Product / Project Management Junior v1.0", "skillcheck-private-product-project-r1", "banks\/product-project-v1\/product-project-junior.json", "audit-product-project-bank.js"]
]) {
  assert(deploy.includes(`TestId = "${testId}"`));
  assert(deploy.includes(`Version = "${version}"`));
  assert(deploy.includes(privateFolder));
  assert.match(deploy, new RegExp(objectKey));
  assert(deploy.includes(audit));
  assert(gateway.includes(`- ${testId}`));
  assert(publicDeploy.includes(`data/${testId}.json`));
}
for (const [source, target, mode] of [
  ["assessment-v13", "assessment-v14", "assessment"],
  ["account-v5", "account-v6", "account"],
  ["admin-v11", "admin-v12", "admin"],
  ["employer-v3", "employer-v4", "employer"]
]) {
  assert(deploy.includes(`Source = "${source}"; Target = "${target}"; Mode = "${mode}"`));
  assert.equal((gateway.match(new RegExp(`tag: "${target}"`, "g")) || []).length, 2);
}
assert.match(deploy, /Set-AttemptGates "false" "false"/);
assert.match(deploy, /state = Utf8\('active'\).*state = Utf8\('reserved'\)/);
assert.match(deploy, /Get-FileHash[\s\S]*SHA256/);
assert.match(deploy, /private_digest[\s\S]*public_digest/);
assert.match(deploy, /disabled_statickey_auth -ne \$true/);
for (const gate of [
  "profile_publication_enabled", "employer_workspace_enabled", "employer_contact_enabled",
  "employer_chat_enabled", "candidate_credentials_enabled", "employer_company_profiles_enabled"
]) assert(deploy.includes(gate));
assert.match(deploy, /deploy-yandex-public-site\.ps1"\) -SkipGatewayUpdate/);
assert.match(deploy, /Live ranking verification failed/);
assert.match(deploy, /Live public-bank verification failed/);
assert.match(deploy, /eight production directions are available/);
assert.match(deploy, /Gateway was updated before failure; issuance remains closed/);
assert.match(deploy, /--no-logging/);
assert.doesNotMatch(deploy, /version delete|Lockbox|lockbox|secret create|system:allUsers|--public/);
assert(!fs.existsSync(path.join(root, "skillcheck-private-tourism-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-software-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-product-project-r1")));

console.log("Expansion deployment checks passed: three private banks, paused issuance, checksum verification, four rollback-safe runtimes and closed employer gates.");
