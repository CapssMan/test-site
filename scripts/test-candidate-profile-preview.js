"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "..", "account.html"), "utf8");
const requiredIds = [
  "employerPreviewTitle", "previewAvatar", "previewAlias", "previewRole", "previewMeta",
  "previewResults", "previewTools", "profileStrengthTitle", "strengthResult", "strengthRole",
  "strengthExperience", "strengthTools"
];
for (const id of requiredIds) assert.match(page, new RegExp('id="' + id + '"'), "missing candidate preview node: " + id);

assert.match(page, /Карточка для работодателя/);
assert.match(page, /Это локальный предпросмотр\. Карточка не опубликована и не раскрывает контакты\./);
assert.match(page, /function draftProfile\(\)/);
assert.match(page, /function previewInitials\(value\)/);
assert.match(page, /function updateEmployerPreview\(profile\)/);
assert.match(page, /resultRows\(profile\)\.slice\(0,2\)/);
assert.match(page, /professionalTools[\s\S]{0,180}slice\(0,5\)/);
assert.match(page, /updateProfileSummary\(profile\);[\s\S]{0,80}updateEmployerPreview\(profile\);/);
assert.match(page, /\["publicAlias","visibility","jobStatus","region","workFormat","experienceBand","currentRole","targetRole","experienceSummary","professionalTools"\][\s\S]{0,220}updateEmployerPreview\(profile\)/);
assert.match(page, /\.preview-head b\{[^}]*font-size:10px/);
assert.match(page, /\.strength-item\{[^}]*font-size:10px/);

const previewFunction = page.match(/function updateEmployerPreview\(profile\)\{([\s\S]*?)\n    \}\n    function updateAvailability/);
assert(previewFunction, "candidate employer preview function boundary is missing");
assert.doesNotMatch(previewFunction[1], /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|innerHTML/i);
assert.match(previewFunction[1], /textContent=/);
assert.match(previewFunction[1], /replaceChildren\(\)/);

console.log("Candidate profile preview checks passed: live safe card, bounded results/tools, completion guidance and no network/storage side effects.");
