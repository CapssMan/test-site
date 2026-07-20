#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scriptsDirectory = path.join(root, "scripts");
const fixedChecks = [
  "check-repository-secrets.js",
  "check-static-links.js",
  "check-js-syntax.js",
  "validate-tests.js",
  "audit-question-banks.js"
];
const testFiles = fs.readdirSync(scriptsDirectory)
  .filter(name => /^test-[a-z0-9-]+\.js$/.test(name))
  .sort();
const commands = fixedChecks.concat(testFiles);
const startedAt = Date.now();

console.log("SkillCheck CI: " + fixedChecks.length + " validators, " + testFiles.length + " test files.");

for (const fileName of commands) {
  const relativePath = path.join("scripts", fileName);
  const started = Date.now();
  process.stdout.write("\n[CI] " + relativePath + "\n");
  const result = spawnSync(process.execPath, [relativePath], {
    cwd: root,
    env: Object.assign({}, process.env, { CI: "true", NODE_ENV: "test" }),
    stdio: "inherit",
    timeout: 120000,
    windowsHide: true
  });
  if (result.error) {
    console.error("[CI] Runner error in " + relativePath + ": " + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("[CI] Failed: " + relativePath + " (exit " + String(result.status) + ")");
    process.exit(result.status || 1);
  }
  console.log("[CI] Passed in " + (Date.now() - started) + " ms.");
}

console.log(
  "\nSkillCheck CI passed: " + commands.length + " checks in " +
  ((Date.now() - startedAt) / 1000).toFixed(1) + " s."
);
