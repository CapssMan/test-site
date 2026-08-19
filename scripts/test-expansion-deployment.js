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
  ["product-project-junior", "Product / Project Management Junior v1.0", "skillcheck-private-product-project-r1", "banks\/product-project-v1\/product-project-junior.json", "audit-product-project-bank.js"],
  ["sales-junior", "Sales / Business Development Junior v1.0", "skillcheck-private-sales-r1", "banks\/sales-v1\/sales-junior.json", "audit-sales-bank.js"],
  ["logistics-procurement-junior", "Logistics / Procurement Junior v1.0", "skillcheck-private-logistics-r1", "banks\/logistics-v1\/logistics-procurement-junior.json", "audit-logistics-bank.js"],
  ["digital-marketing-junior", "Digital Marketing Junior v1.0", "skillcheck-private-digital-marketing-r1", "banks\/digital-marketing-v1\/digital-marketing-junior.json", "audit-digital-marketing-bank.js"]
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
  ["employer-v3", "employer-v4", "employer"],
  ["read-v6", "read-v7", "read"],
  ["write-v8", "write-v9", "write"]
]) {
  assert(deploy.includes(`Source = "${source}"; Target = "${target}"; Mode = "${mode}"`));
  assert.equal((gateway.match(new RegExp(`tag: "${target}"`, "g")) || []).length, target.startsWith("read-") || target.startsWith("write-") ? 1 : 2);
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
assert.match(deploy, /eleven production directions are available/);
assert.match(deploy, /Gateway was updated before failure; issuance remains closed/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /version remove-tag/);
assert.match(deploy, /Old runtime version was not preserved/);
assert.match(deploy, /Intermediate API Gateway cutover failed/);
assert.match(deploy, /Final API Gateway cutover failed/);
for (const tag of ["account-v4", "employer-v2", "admin-v10"]) assert(deploy.includes(`"${tag}"`));
assert.doesNotMatch(deploy, /version delete|Lockbox|lockbox|secret create|system:allUsers|--public/);
assert(!fs.existsSync(path.join(root, "skillcheck-private-tourism-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-software-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-product-project-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-sales-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-logistics-r1")));
assert(!fs.existsSync(path.join(root, "skillcheck-private-digital-marketing-r1")));

console.log("Expansion deployment checks passed: six private banks, paused issuance, checksum verification, six live successor runtimes and closed employer gates.");
