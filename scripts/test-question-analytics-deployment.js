#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-question-analytics.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");

assert.match(deploy, /\$sourceTag = "admin-v8"/);
assert.match(deploy, /\$targetTag = "admin-v9"/);
assert.match(deploy, /\$retiredTag = "admin-v6"/);
assert.match(deploy, /question-analytics\.js/);
assert.match(deploy, /test-question-analytics-ui\.js/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /version remove-tag/);
assert.doesNotMatch(deploy, /version delete/);
assert.match(deploy, /admin-v8 remains rollback/);
assert.equal((gateway.match(/tag: "admin-v10"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "assessment-v12"/g) || []).length, 2);

console.log("Question analytics deployment checks passed: admin-only successor, rollback and gateway boundary.");
