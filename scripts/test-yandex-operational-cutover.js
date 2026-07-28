"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cutover = fs.readFileSync(path.join(root, "docs", "YANDEX_OPERATIONAL_CUTOVER.md"), "utf8");
const exclusion = fs.readFileSync(path.join(root, "docs", "TECHNICAL_DATA_EXCLUSION.md"), "utf8");

assert.match(cutover, /переносится \*\*0 legacy-записей кандидатов\*\*/);
assert.match(cutover, /9 строк результатов и 9 anti-retake строк/);
assert.match(cutover, /0 приглашений, 0 сессий, 0 результатов и 0 рейтинговых профилей/);
assert.match(cutover, /Не копируются legacy results, attempts, sessions, invites, TXT-отчёты и operational backups/);
assert.match(cutover, /не удаляются/);
assert.match(cutover, /21-дневная retake-граница/);
assert.match(cutover, /legal_pilot_approved=false/);
assert.match(cutover, /attempt_issuance_enabled=false/);
assert.match(cutover, /останавливается/);

const knownCodes = exclusion.match(/`(?:DEV|FA)-[A-Z0-9]+`/g) || [];
assert.equal(new Set(knownCodes).size, 9, "technical exclusion must keep the exact nine-code boundary");
assert.doesNotMatch(cutover, /парол|password|token\s*[:=]|@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i);

console.log("Yandex operational cutover checks passed: zero eligible legacy candidates, exact technical exclusion and fail-closed gates.");
