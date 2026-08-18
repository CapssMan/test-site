"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-account-recovery.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");

assert.match(deploy, /Explicit -Deploy confirmation is required/);
assert.match(deploy, /\$sourceTag = "account-v2"/);
assert.match(deploy, /version remove-tag/);
assert.match(deploy, /version set-tag/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /account-v2 tag was restored to the previous version/);
assert.match(deploy, /deploy-yandex-public-site\.ps1/);
assert.match(deploy, /yandex-account-recovery-2026-08-15-2/);
assert.match(deploy, /ACC-YDB-WRITE/);
assert.doesNotMatch(deploy, /Lockbox|--public|system:allUsers/);
assert.equal((gateway.match(/tag: "account-v6"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "account-v2"/g) || []).length, 0);

console.log("Account recovery deployment checks passed: quota-neutral account-v2 replacement, no-PII diagnostics, public-page verification and automatic tag rollback.");
