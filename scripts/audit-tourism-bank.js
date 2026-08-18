#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicPath = path.join(root, "data", "tourism-junior.json");
const privatePath = process.argv[2] || path.resolve(root, "..", "skillcheck-private-tourism-r1", "tourism-junior.json");
const publicBank = JSON.parse(fs.readFileSync(publicPath, "utf8"));
const privateBank = JSON.parse(fs.readFileSync(privatePath, "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

const { publicDigest, ...publicCore } = publicBank;
assert.equal(publicBank.testId, "tourism-junior");
assert.equal(publicBank.bankVersion, "Tourism & Hospitality Operations Junior v1.1");
assert.equal(publicBank.questions.length, 40);
assert.equal(publicBank.questionsPerAttempt, 40);
assert.equal(Object.keys(publicBank.blocks).length, 8);
assert.equal(publicDigest, sha256(JSON.stringify(publicCore)));
assert.equal(privateBank.publicDigest, publicDigest);
assert.equal(privateBank.questions.length, publicBank.questions.length);

const distribution = {};
const blocks = {};
const correctPositions = [0, 0, 0, 0];
let totalPoints = 0;
let totalSeconds = 0;
const forbidden = /correct|answer|comment|explanation|solution|rationale/i;

function assertNoPrivateKeys(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoPrivateKeys(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbidden.test(key), `${location}.${key} leaks a private field`);
    assertNoPrivateKeys(child, `${location}.${key}`);
  }
}

assertNoPrivateKeys(publicBank, "publicBank");
publicBank.questions.forEach((question, index) => {
  const privateQuestion = privateBank.questions[index];
  assert.equal(privateQuestion.id, question.id);
  assert.equal(privateQuestion.options.length, 4);
  assert(privateQuestion.options.some(option => option.id === privateQuestion.correctOptionId));
  assert.equal(typeof privateQuestion.comment, "string");
  assert(privateQuestion.comment.length >= 40);
  distribution[question.difficulty] = (distribution[question.difficulty] || 0) + 1;
  blocks[question.block] = (blocks[question.block] || 0) + 1;
  totalPoints += question.points;
  totalSeconds += question.timeLimit;
  const position = question.options.findIndex(option => option.id === privateQuestion.correctOptionId);
  assert(position >= 0);
  correctPositions[position] += 1;
});

assert.deepEqual(distribution, { easy: 9, medium: 16, case: 6, calc: 8, hard: 1 });
Object.values(blocks).forEach(count => assert.equal(count, 5));
assert(Math.max(...correctPositions) <= 14, `answer-position imbalance: ${correctPositions.join("/")}`);
assert(totalSeconds >= 2500 && totalSeconds <= 3200);

console.log(JSON.stringify({
  questions: publicBank.questions.length,
  blocks,
  distribution,
  correctPositions,
  totalPoints,
  estimatedMinutes: Math.round(totalSeconds / 60),
  publicDigest
}, null, 2));
