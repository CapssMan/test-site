#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const handler = fs.readFileSync(path.join(root, "cloud", "admin-handler.js"), "utf8");

assert.match(admin, /Build 2026\.08\.21\.1/);
assert.match(admin, /id="calibrationHeading">Калибровка вопросов по пилоту/);
assert.match(admin, /requestAdminAction\("adminQuestionAnalytics", password, \{\}, 45000\)/);
assert.match(admin, /privacy !== "aggregate-no-candidate-data"/);
assert.match(admin, /Первичный сигнал появляется от 10 ответов на вопрос, устойчивый — от 20/);
assert.match(admin, /Персональные данные и ответы отдельных кандидатов не возвращаются/);
assert.doesNotMatch(admin, /selectedAnswer|correctAnswer/);
assert.match(handler, /else if \(body\.action === "adminQuestionAnalytics"\)/);
assert.match(handler, /tests: buildQuestionAnalytics\(results\)/);
assert.match(handler, /privacy: "aggregate-no-candidate-data"/);

console.log("Question analytics UI checks passed: protected aggregate endpoint, evidence thresholds and no individual answer fields.");
