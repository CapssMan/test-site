#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SPECS = Object.freeze({
  "fa-junior": { version: "FA Junior v6.0", prefix: "fa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "ca-junior": { version: "CA Junior v6.0", prefix: "ca6", count: 80, distribution: { easy: 20, medium: 28, calc: 20, case: 10, hard: 2 } },
  "fpa-junior": { version: "FP&A Junior v6.0", prefix: "fpa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "acc-junior": { version: "ACC Junior v6.0", prefix: "acc6", count: 40, distribution: { easy: 12, medium: 16, calc: 7, case: 4, hard: 1 } },
  "bi-junior": { version: "BI Junior v6.0", prefix: "bi6", count: 40, distribution: { easy: 10, medium: 16, calc: 8, case: 5, hard: 1 } }
});

const PROFILE = Object.freeze({
  easy: { timeLimit: 50, points: 3 },
  medium: { timeLimit: 60, points: 4 },
  calc: { timeLimit: 75, points: 5 },
  case: { timeLimit: 90, points: 5 },
  hard: { timeLimit: 105, points: 6 }
});
const PRIVATE_FIELDS = new Set(["correct", "correctIndex", "correctOptionId", "comment", "explanation", "answer", "solution"]);

function parseArgs(argv) {
  const result = { source: "", privateDir: "", publicDir: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`${name} requires a value`);
    if (name === "--source") result.source = path.resolve(value);
    else if (name === "--private-dir") result.privateDir = path.resolve(value);
    else if (name === "--public-dir") result.publicDir = path.resolve(value);
    else throw new Error(`Unknown argument: ${name}`);
  }
  if (!result.source || !result.privateDir || !result.publicDir) throw new Error("--source, --private-dir and --public-dir are required");
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function onlyJsonFile(directory) {
  const files = fs.readdirSync(directory).filter(name => name.endsWith(".json"));
  assert.equal(files.length, 1, `${directory}: expected one bank JSON`);
  return path.join(directory, files[0]);
}

function canonicalPublic(privateBank) {
  return {
    schemaVersion: privateBank.schemaVersion,
    testId: privateBank.testId,
    testVersion: privateBank.testVersion,
    bankVersion: privateBank.bankVersion,
    questionsPerAttempt: privateBank.questionsPerAttempt,
    blocks: privateBank.blocks,
    questions: privateBank.questions.map(question => ({
      id: question.id, topic: question.topic, block: question.block, difficulty: question.difficulty,
      timeLimit: question.timeLimit, points: question.points, text: question.text,
      context: question.context, options: question.options
    }))
  };
}

function assertNoPrivateFields(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoPrivateFields(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(key => {
    assert(!PRIVATE_FIELDS.has(key), `${location}.${key}: private field leaked`);
    assertNoPrivateFields(value[key], `${location}.${key}`);
  });
}

function distribution(questions) {
  return questions.reduce((result, question) => {
    result[question.difficulty] = (result[question.difficulty] || 0) + 1;
    return result;
  }, { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestText = fs.readFileSync(path.join(args.privateDir, "review-manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const anchors = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-anchors.v6.json"), "utf8"));
  const pending = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-review-pending.v6.json"), "utf8"));
  assert.equal(manifest.releaseId, "market-calibration-v6-2026-08-02-r1");
  assert.equal(manifest.totalQuestions, 240);
  assert.equal(manifest.textSimplifications, 35);
  assert.match(manifest.reviewType, /not independent human SME/i);
  assert.equal(manifest.banks.length, 5);
  const globalQuestionIds = new Set();
  const globalOptionIds = new Set();
  const totalDistribution = { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 };
  let changedTexts = 0;
  let totalQuestions = 0;

  for (const [testId, spec] of Object.entries(SPECS)) {
    const source = JSON.parse(fs.readFileSync(onlyJsonFile(path.join(args.source, testId)), "utf8"));
    const privatePath = onlyJsonFile(path.join(args.privateDir, testId));
    const publicPath = path.join(args.publicDir, `${testId}.json`);
    const privateText = fs.readFileSync(privatePath, "utf8");
    const publicText = fs.readFileSync(publicPath, "utf8");
    const privateBank = JSON.parse(privateText);
    const publicBank = JSON.parse(publicText);
    const entry = manifest.banks.find(item => item.testId === testId);
    assert(entry, `${testId}: manifest entry missing`);
    assert.equal(privateBank.schemaVersion, 2);
    assert.equal(privateBank.testVersion, spec.version);
    assert.equal(privateBank.bankVersion, spec.version);
    assert.equal(privateBank.questionsPerAttempt, 40);
    assert.equal(privateBank.questions.length, spec.count);
    assert.equal(publicBank.publicDigest, privateBank.publicDigest);
    assert.deepEqual(publicBank, { ...canonicalPublic(privateBank), publicDigest: privateBank.publicDigest });
    assert.equal(privateBank.publicDigest, sha256(JSON.stringify(canonicalPublic(privateBank))));
    assertNoPrivateFields(publicBank, testId);
    assert.equal(sha256(privateText), entry.privateFileSha256);
    assert.equal(Buffer.byteLength(privateText), entry.privateFileBytes);
    assert.equal(sha256(publicText), entry.publicFileSha256);
    assert.equal(Buffer.byteLength(publicText), entry.publicFileBytes);
    const privateDigest = sha256(JSON.stringify(privateBank));
    assert.equal(privateDigest, entry.privateDigest);
    assert.equal(anchors[`${testId}|${spec.version}`], privateDigest);
    assert.deepEqual(pending.banks[testId], {
      bankVersion: spec.version,
      questionCount: spec.count,
      publicDigest: privateBank.publicDigest,
      privateDigest
    });
    const actualDistribution = distribution(privateBank.questions);
    assert.deepEqual(actualDistribution, spec.distribution);
    Object.keys(totalDistribution).forEach(key => { totalDistribution[key] += actualDistribution[key]; });

    privateBank.questions.forEach((question, index) => {
      const oldQuestion = source.questions[index];
      assert.equal(question.id, `${spec.prefix}_${String(index + 1).padStart(3, "0")}`);
      assert(!globalQuestionIds.has(question.id));
      globalQuestionIds.add(question.id);
      assert.deepEqual({ timeLimit: question.timeLimit, points: question.points }, PROFILE[question.difficulty]);
      assert.equal(question.topic, oldQuestion.topic);
      assert.equal(question.block, oldQuestion.block);
      assert.equal(question.context, oldQuestion.context);
      assert.equal(question.comment, oldQuestion.comment);
      const oldCorrectText = oldQuestion.options.find(option => option.id === oldQuestion.correctOptionId)?.text;
      const newCorrectText = question.options.find(option => option.id === question.correctOptionId)?.text;
      assert.equal(newCorrectText, oldCorrectText, `${question.id}: answer-key meaning changed`);
      assert.deepEqual(question.options.map(option => option.text).slice().sort(), oldQuestion.options.map(option => option.text).slice().sort());
      assert.deepEqual(question.options.map(option => option.id), question.options.map(option => option.id).slice().sort());
      question.options.forEach(option => {
        assert.match(option.id, /^opt_[a-f0-9]{20}$/);
        assert(!globalOptionIds.has(option.id));
        globalOptionIds.add(option.id);
      });
      if (question.text !== oldQuestion.text) changedTexts += 1;
    });
    totalQuestions += privateBank.questions.length;
    const points = privateBank.questions.reduce((sum, question) => sum + question.points, 0);
    const hardPoints = privateBank.questions.filter(question => question.difficulty === "hard").reduce((sum, question) => sum + question.points, 0);
    assert(hardPoints / points < 0.04, `${testId}: hard layer has too much scoring weight`);
    console.log(`${testId}: questions=${spec.count} distribution=${JSON.stringify(actualDistribution)} hardWeight=${(100 * hardPoints / points).toFixed(1)}% parity=PASS secrecy=PASS`);
  }

  assert.equal(totalQuestions, 240);
  assert.equal(changedTexts, 35);
  assert.deepEqual(totalDistribution, { easy: 62, medium: 88, calc: 55, case: 29, hard: 6 });
  console.log(`Market calibration v6 verified: questions=${totalQuestions} textSimplifications=${changedTexts} distribution=${JSON.stringify(totalDistribution)}.`);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
