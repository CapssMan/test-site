#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const publicPath = path.join(root, "data", "product-project-junior.json");
const privatePath = process.argv[2] || path.resolve(root, "..", "skillcheck-private-product-project-r1", "product-project-junior.json");
const publicBank = JSON.parse(fs.readFileSync(publicPath, "utf8"));
const privateBank = JSON.parse(fs.readFileSync(privatePath, "utf8"));
const sha256 = value => crypto.createHash("sha256").update(String(value), "utf8").digest("hex");

const { publicDigest, ...publicCore } = publicBank;
assert.equal(publicBank.testId, "product-project-junior");
assert.equal(publicBank.bankVersion, "Product / Project Management Junior v1.0");
assert.equal(publicBank.questions.length, 40);
assert.equal(publicBank.questionsPerAttempt, 40);
assert.equal(Object.keys(publicBank.blocks).length, 8);
assert.equal(publicDigest, sha256(JSON.stringify(publicCore)));
assert.equal(privateBank.publicDigest, publicDigest);
assert.equal(privateBank.questions.length, publicBank.questions.length);

const expectedDistribution = { case: 9, medium: 16, easy: 10, calc: 4, hard: 1 };
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
  correctPositions[question.options.findIndex(option => option.id === privateQuestion.correctOptionId)] += 1;
});

assert.deepEqual(distribution, expectedDistribution);
Object.values(blocks).forEach(count => assert.equal(count, 5));
assert.deepEqual(correctPositions, [10, 10, 10, 10]);
assert(totalSeconds >= 2600 && totalSeconds <= 3000);

console.log(JSON.stringify({ questions: 40, blocks, distribution, correctPositions, totalPoints, estimatedMinutes: Math.round(totalSeconds / 60), publicDigest }, null, 2));
