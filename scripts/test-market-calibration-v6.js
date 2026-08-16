#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const specs = Object.freeze({
  "fa-junior": { version: "FA Junior v6.0", prefix: "fa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "ca-junior": { version: "CA Junior v6.0", prefix: "ca6", count: 80, distribution: { easy: 20, medium: 28, calc: 20, case: 10, hard: 2 } },
  "fpa-junior": { version: "FP&A Junior v6.0", prefix: "fpa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "acc-junior": { version: "ACC Junior v6.0", prefix: "acc6", count: 40, distribution: { easy: 12, medium: 16, calc: 7, case: 4, hard: 1 } },
  "bi-junior": { version: "BI Junior v6.0", prefix: "bi6", count: 40, distribution: { easy: 10, medium: 16, calc: 8, case: 5, hard: 1 } }
});
const profiles = Object.freeze({
  easy: { timeLimit: 50, points: 3 },
  medium: { timeLimit: 60, points: 4 },
  calc: { timeLimit: 75, points: 5 },
  case: { timeLimit: 90, points: 5 },
  hard: { timeLimit: 105, points: 6 }
});

function digest(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function canonicalPublic(bank) {
  return {
    schemaVersion: bank.schemaVersion,
    testId: bank.testId,
    testVersion: bank.testVersion,
    bankVersion: bank.bankVersion,
    questionsPerAttempt: bank.questionsPerAttempt,
    blocks: bank.blocks,
    questions: bank.questions.map(question => ({
      id: question.id,
      topic: question.topic,
      block: question.block,
      difficulty: question.difficulty,
      timeLimit: question.timeLimit,
      points: question.points,
      text: question.text,
      context: question.context,
      options: question.options
    }))
  };
}

let totalQuestions = 0;
const totalDistribution = { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 };

for (const [testId, spec] of Object.entries(specs)) {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", `${testId}.json`), "utf8"));
  assert.equal(bank.testId, testId);
  assert.equal(bank.testVersion, spec.version);
  assert.equal(bank.bankVersion, spec.version);
  assert.equal(bank.questions.length, spec.count);
  assert.equal(bank.questionsPerAttempt, 40);
  assert.equal(bank.publicDigest, digest(JSON.stringify(canonicalPublic(bank))));
  const distribution = { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 };
  const ids = new Set();
  const optionIds = new Set();
  let hardPoints = 0;
  let totalPoints = 0;

  bank.questions.forEach((question, index) => {
    assert.equal(question.id, `${spec.prefix}_${String(index + 1).padStart(3, "0")}`);
    assert(!ids.has(question.id));
    ids.add(question.id);
    assert(profiles[question.difficulty], `${question.id}: unsupported difficulty`);
    assert.equal(question.timeLimit, profiles[question.difficulty].timeLimit);
    assert.equal(question.points, profiles[question.difficulty].points);
    assert(!Object.hasOwn(question, "correctOptionId"));
    assert(!Object.hasOwn(question, "correct"));
    assert(!Object.hasOwn(question, "comment"));
    assert.equal(question.options.length, 4);
    question.options.forEach(option => {
      assert.match(option.id, /^opt_[a-f0-9]{20}$/);
      assert(!optionIds.has(option.id), `${testId}: duplicate option id ${option.id}`);
      optionIds.add(option.id);
    });
    distribution[question.difficulty] += 1;
    totalDistribution[question.difficulty] += 1;
    totalPoints += question.points;
    if (question.difficulty === "hard") hardPoints += question.points;
  });

  assert.deepEqual(distribution, spec.distribution);
  assert(hardPoints / totalPoints < 0.04, `${testId}: hard questions weigh too much`);
  totalQuestions += bank.questions.length;
}

assert.equal(totalQuestions, 240);
assert.deepEqual(totalDistribution, { easy: 62, medium: 88, calc: 55, case: 29, hard: 6 });

const core = fs.readFileSync(path.join(root, "cloud", "assessment-core.js"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
Object.values(specs).forEach(spec => {
  assert(core.includes(spec.version));
  assert(candidate.includes(spec.version));
  assert(admin.includes(spec.version));
});
assert.match(candidate, /Build 2026\.08\.09\.1/);
assert.match(admin, /Build 2026\.08\.17\.1/);

const method = fs.readFileSync(path.join(root, "docs", "MARKET_CALIBRATION_V6.md"), "utf8");
assert.match(method, /сильного студента 3–4 курса/i);
assert.match(method, /10–30 завершений каждого теста/i);
assert.match(method, /не копирует задания других платформ/i);
assert.match(method, /психометрически валидированным/i);

console.log("Market calibration v6 checks passed: 240 questions, junior-weighted distribution, timing, scoring and public secrecy.");
