#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-group-link-copy.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");

assert.match(deploy, /\$sourceTag = "admin-v9"/);
assert.match(deploy, /\$targetTag = "admin-v10"/);
assert.match(deploy, /\$retiredTag = "admin-v7"/);
assert.match(deploy, /version remove-tag/);
assert.doesNotMatch(deploy, /version delete/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /admin-v9 remains rollback/);
assert.equal((gateway.match(/tag: "admin-v10"/g) || []).length, 2);
assert.match(admin, /Build 2026\.08\.03\.2/);

console.log("Group-link copy deployment checks passed: admin-v10 route, admin-v9 rollback and current frontend build.");
