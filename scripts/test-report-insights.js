#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

const context = {
  String, Number, Boolean, Array, Object, Math,
  TEST_TITLES_BY_ID: { "fa-junior": "Financial Analyst Junior" },
  SCORE_VERIFICATION_SERVER: "server-verified",
  AUTHORITATIVE_SCORING_VERSION: "authoritative-v1",
  safeText(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
      .replace(/\r?\n/g, " ")
      .trim();
  }
};
vm.createContext(context);
vm.runInContext(
  extractTopLevelFunction(backend, "buildReportSkillInsights") + "\n" +
    extractTopLevelFunction(backend, "buildTxtReport") +
    "\nthis.__insights = buildReportSkillInsights; this.__report = buildTxtReport;",
  context
);

const blocks = JSON.parse(JSON.stringify({
  strong: { name: "Сильный блок", percent: 90, earned: 9, total: 10, weight: 0.25 },
  stable: { name: "Стабильный блок", percent: 75, earned: 15, total: 20, weight: 0.5 },
  weak: { name: "Слабый блок", percent: 50, earned: 5, total: 10, weight: 0.25 }
}));
const insights = context.__insights(blocks);
assert.deepEqual(Array.from(insights.strengths, block => block.name), ["Сильный блок"]);
assert.deepEqual(Array.from(insights.developmentAreas, block => block.name), ["Слабый блок"]);
assert.deepEqual(Array.from(insights.interviewChecks, block => block.name), ["Слабый блок"]);

const report = context.__report({
  code: "FA-TEST1",
  testId: "fa-junior",
  completedAt: "2026-07-26T12:00:00.000Z",
  scoreVerification: "server-verified",
  name: "Тестовый Кандидат",
  email: "candidate@example.com",
  ageConfirmed: true,
  rawScore: 29,
  rawTotal: 40,
  finalScore: 80,
  percent: 80,
  status: "passed",
  recommendation: "Рекомендуется к интервью",
  blockResults: blocks,
  answers: []
});
assert.match(report, /СИЛЬНЫЕ СТОРОНЫ[\s\S]*Сильный блок: 90%/);
assert.match(report, /ЗОНЫ РАЗВИТИЯ[\s\S]*Слабый блок: 50%/);
assert.match(report, /ЧТО ПРОВЕРИТЬ НА ИНТЕРВЬЮ[\s\S]*Слабый блок \(50%\)/);
assert.match(report, /не самостоятельное доказательство профессиональной пригодности/);
assert.doesNotMatch(report, /undefined|NaN/);

const uniformlyStrong = context.__insights(JSON.parse(JSON.stringify({
  a: { name: "A", percent: 95 },
  b: { name: "B", percent: 85 }
})));
assert.equal(uniformlyStrong.developmentAreas.length, 0);
assert.deepEqual(Array.from(uniformlyStrong.interviewChecks, block => block.name), ["B", "A"]);

console.log("TXT report insight checks passed: strengths, development areas and interview prompts.");
