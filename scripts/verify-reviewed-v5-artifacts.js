#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SPECS = Object.freeze({
  "fa-junior": { version: "FA Junior v5.0", prefix: "fa5", count: 40, changed: 5 },
  "ca-junior": { version: "CA Junior v5.0", prefix: "ca5", count: 80, changed: 16 },
  "fpa-junior": { version: "FP&A Junior v5.0", prefix: "fpa5", count: 40, changed: 20 },
  "acc-junior": { version: "ACC Junior v5.0", prefix: "acc5", count: 40, changed: 21 },
  "bi-junior": { version: "BI Junior v5.0", prefix: "bi5", count: 40, changed: 18 }
});

const PRIVATE_FIELDS = new Set(["correct", "correctIndex", "correctOptionId", "comment", "explanation", "rationale", "answer"]);
const WEAK_DISTRACTOR_PATTERNS = [
  /количеств[оа] страниц/i,
  /числ[оа] цветов/i,
  /средн(?:ее|яя) числ[оа] букв/i,
  /бумажн\w+ визит/i,
  /температур\w+ на складе/i,
  /цвет строки/i,
  /размер файла в килобайтах/i
];

function parseArgs(argv) {
  const result = { privateDir: "", publicDir: "", baselinePrivateDir: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`${name} requires a value`);
    if (name === "--private-dir") result.privateDir = path.resolve(value);
    else if (name === "--public-dir") result.publicDir = path.resolve(value);
    else if (name === "--baseline-private-dir") result.baselinePrivateDir = path.resolve(value);
    else throw new Error(`Unknown argument: ${name}`);
  }
  if (!result.privateDir || !result.publicDir || !result.baselinePrivateDir) {
    throw new Error("--private-dir, --public-dir and --baseline-private-dir are required");
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertNoPrivateFields(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoPrivateFields(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(key => {
    assert(!PRIVATE_FIELDS.has(key), `${location}.${key}: private field leaked`);
    assertNoPrivateFields(value[key], `${location}.${key}`);
  });
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

function semanticFingerprint(question) {
  return JSON.stringify({
    topic: question.topic,
    block: question.block,
    difficulty: question.difficulty,
    timeLimit: question.timeLimit,
    points: question.points,
    text: question.text,
    context: question.context,
    options: question.options.map(option => option.text).slice().sort(),
    correctText: question.options.find(option => option.id === question.correctOptionId)?.text || "",
    comment: question.comment
  });
}

function onlyJsonFile(directory) {
  const files = fs.readdirSync(directory).filter(name => name.endsWith(".json"));
  assert.equal(files.length, 1, `${directory}: expected exactly one bank JSON`);
  return path.join(directory, files[0]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(args.privateDir, "review-manifest.json");
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const pending = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-review-pending.v5.json"), "utf8"));
  const anchors = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-anchors.v5.json"), "utf8"));
  assert.equal(manifest.releaseId, "review-v5-2026-07-31-ai-r1");
  assert.match(manifest.reviewType, /not independent human SME/i);
  assert.equal(manifest.banks.length, 5);
  assert.equal(pending.releaseId, manifest.releaseId);

  const globalQuestionIds = new Set();
  const globalOptionIds = new Set();
  let totalQuestions = 0;
  let totalChanged = 0;
  let totalMedium = 0;
  let totalLow = 0;

  for (const [testId, spec] of Object.entries(SPECS)) {
    const manifestEntry = manifest.banks.find(bank => bank.testId === testId);
    assert(manifestEntry, `${testId}: manifest entry missing`);
    const privatePath = onlyJsonFile(path.join(args.privateDir, testId));
    const baselinePath = onlyJsonFile(path.join(args.baselinePrivateDir, testId));
    const publicPath = path.join(args.publicDir, `${testId}.json`);
    const privateText = fs.readFileSync(privatePath, "utf8");
    const publicText = fs.readFileSync(publicPath, "utf8");
    const privateBank = JSON.parse(privateText);
    const publicBank = JSON.parse(publicText);
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

    assert.equal(privateBank.schemaVersion, 2);
    assert.equal(privateBank.testId, testId);
    assert.equal(privateBank.testVersion, spec.version);
    assert.equal(privateBank.bankVersion, spec.version);
    assert.equal(privateBank.questions.length, spec.count);
    assert.equal(publicBank.questions.length, spec.count);
    assert.equal(publicBank.publicDigest, privateBank.publicDigest);
    assert.deepEqual(publicBank, { ...canonicalPublic(privateBank), publicDigest: privateBank.publicDigest });
    assert.equal(privateBank.publicDigest, sha256(JSON.stringify(canonicalPublic(privateBank))));
    assertNoPrivateFields(publicBank, testId);
    assert.equal(sha256(privateText), manifestEntry.privateFileSha256);
    assert.equal(Buffer.byteLength(privateText), manifestEntry.privateFileBytes);
    assert.equal(sha256(publicText), manifestEntry.publicFileSha256);
    assert.equal(Buffer.byteLength(publicText), manifestEntry.publicFileBytes);
    const privateDigest = sha256(JSON.stringify(privateBank));
    assert.equal(privateDigest, manifestEntry.privateDigest);
    assert.equal(anchors[`${testId}|${spec.version}`], privateDigest);
    assert.deepEqual(pending.banks[testId], {
      bankVersion: spec.version,
      questionCount: spec.count,
      publicDigest: privateBank.publicDigest,
      privateDigest
    });

    let changed = 0;
    const correctPositions = [0, 0, 0, 0];
    privateBank.questions.forEach((question, index) => {
      assert.equal(question.id, `${spec.prefix}_${String(index + 1).padStart(3, "0")}`);
      assert(!globalQuestionIds.has(question.id), `${question.id}: duplicate question id`);
      globalQuestionIds.add(question.id);
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options.map(option => option.text.trim().toLowerCase())).size, 4, `${question.id}: duplicate option text`);
      assert.deepEqual(question.options.map(option => option.id), question.options.map(option => option.id).slice().sort(), `${question.id}: option ids must be sorted`);
      question.options.forEach(option => {
        assert.match(option.id, /^opt_[a-f0-9]{20}$/);
        assert(!globalOptionIds.has(option.id), `${option.id}: duplicate option id`);
        globalOptionIds.add(option.id);
        WEAK_DISTRACTOR_PATTERNS.forEach(pattern => assert(!pattern.test(option.text), `${question.id}: weak distractor pattern ${pattern}`));
      });
      const position = question.options.findIndex(option => option.id === question.correctOptionId);
      assert(position >= 0, `${question.id}: correct option missing`);
      correctPositions[position] += 1;
      assert(!baseline.questions.some(old => old.id === question.id), `${question.id}: v4 id reused`);
      if (semanticFingerprint(question) !== semanticFingerprint(baseline.questions[index])) changed += 1;
    });
    assert.equal(changed, spec.changed, `${testId}: unexpected semantic change count`);
    assert.deepEqual(correctPositions, manifestEntry.correctPositions);
    assert(Math.max(...correctPositions) <= Math.ceil(spec.count * 0.4), `${testId}: answer-position side channel`);
    assert.equal(manifestEntry.reviewedQuestionCount, spec.count);
    assert.equal(manifestEntry.changedQuestionCount, spec.changed);
    totalQuestions += spec.count;
    totalChanged += changed;
    totalMedium += manifestEntry.mediumFindingsResolved;
    totalLow += manifestEntry.lowFindingsResolved;
    console.log(`${testId}: questions=${spec.count} changed=${changed} parity=PASS secrecy=PASS positions=${correctPositions.join("/")}`);
  }

  assert.equal(totalQuestions, 240);
  assert.equal(totalChanged, 80);
  assert.equal(totalMedium, 16);
  assert.equal(totalLow, 64);
  console.log(`Reviewed v5 verification passed: banks=5 questions=${totalQuestions} changed=${totalChanged} medium=${totalMedium} low=${totalLow}.`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}
