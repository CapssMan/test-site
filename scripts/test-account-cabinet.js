#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "account.html"), "utf8");
const scripts = Array.from(page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]);

assert.equal(scripts.length, 1, "account cabinet must have one application script");
new vm.Script(scripts[0], { filename: "account.html" });

[
  "loginView", "dashboardView", "dashboardTitle", "completedMetric", "bestMetric", "availableMetric",
  "jobMetric", "nextActionTitle", "nextActionButton", "testAccessList", "resultList", "profileEditor",
  "profileProgressBar", "saveButton", "logoutButton", "deleteButton"
].forEach(id => assert.match(page, new RegExp('id="' + id + '"'), "cabinet missing #" + id));

assert.match(page, /После входа вы попадёте в личный кабинет/);
assert.match(page, /\.guest-panel\{margin:0 auto 76px;/, "guest login panel must remain centered inside the shared shell");
assert.doesNotMatch(page, /\.guest-panel\{margin:0 0 76px;/, "guest login panel must not reset the shell's horizontal auto margins");
assert.match(page, /renderDashboard\(result\.profile,result\.email,result\.testAccess\)/);
assert.doesNotMatch(page, /location\.replace\(returnTo\)/, "OAuth callback must land in the cabinet, not bypass it");
assert.match(page, /highlightedTestId=testIdFromReturnTarget\(flow\.returnTo\)/);
assert.match(page, /card\.dataset\.highlighted="true"/);
assert.match(page, /test\.html\?test=/);
assert.match(page, /profileCompletion/);
assert.match(page, /new Set\(results\.map\(row=>row\.testId\)\)/);
assert.match(page, /publicProfileEnabled/);
assert.match(page, /discoverableOption\.disabled=/);
assert.match(page, /profile_publication_closed/);
assert.match(page, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/);
assert.match(page, /@media\(max-width:680px\)/);
assert.match(page, /@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(page, /localStorage|login:phone|login:birthday|login:avatar|client_secret/);

console.log("Account cabinet checks passed: Yandex lands in dashboard, selected test is highlighted, profile visibility stays gated and desktop/mobile states are present.");
