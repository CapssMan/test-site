#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, ".github", "workflows", "ci.yml");
assert(fs.existsSync(workflowPath), "CI workflow is missing");

const workflow = fs.readFileSync(workflowPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const runner = fs.readFileSync(path.join(root, "scripts", "run-ci.js"), "utf8");

assert.match(workflow, /^name: SkillCheck CI$/m);
assert.match(workflow, /^\s{2}push:$/m);
assert.match(workflow, /^\s{2}pull_request:$/m);
assert.match(workflow, /^\s{2}workflow_dispatch:$/m);
assert.doesNotMatch(workflow, /pull_request_target|schedule:|deployment|environment:/);
assert.match(workflow, /^permissions:\s*\n\s{2}contents: read$/m, "workflow must have read-only repository permissions");
assert.doesNotMatch(workflow, /\b(?:contents|actions|checks|packages|pull-requests): write\b/);
assert.match(workflow, /uses: actions\/checkout@[a-f0-9]{40} # v6/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /uses: actions\/setup-node@[a-f0-9]{40} # v6/);
assert.match(workflow, /node-version: "24"/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/);
assert.match(workflow, /run: npm test/);
assert.doesNotMatch(workflow, /\$\{\{\s*secrets\.|clasp|script\.google\.com|YANDEX_DISK|ADMIN_PASSWORD/i);

assert.equal(packageJson.private, true);
assert.equal(packageJson.scripts.test, "node scripts/run-ci.js");
assert.equal(packageLock.lockfileVersion, 3);
assert.equal(Object.keys(packageLock.packages).length, 1, "CI must remain dependency-free except for the root package");

[
  "check-repository-secrets.js", "check-static-links.js", "check-js-syntax.js",
  "validate-tests.js", "audit-question-banks.js"
].forEach(name => assert(runner.includes('"' + name + '"'), "CI runner is missing " + name));
assert.match(runner, /\^test-\[a-z0-9-\]\+\\\.js\$/);
assert.match(runner, /spawnSync\(process\.execPath/);

console.log("CI configuration checks passed: read-only permissions, locked dependency-free install and complete local runner.");
