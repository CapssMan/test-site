#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OPTION_ID_NAMESPACE = "skillcheck-option-v1";
const SOURCE_SUFFIX = ".rotation-source.json";
const ROTATION_BASELINE_COMMIT = "14b914ff32570218c95ae2a2f03e96a64a60e5a1";
const ROTATION_RELEASE_ID = "rotation-v4-2026-07-21-r3";

const SPECS = Object.freeze({
  "fa-junior": {
    version: "FA Junior v4.0", count: 40, attempt: 40, idPrefix: "fa4",
    blocks: ["excel", "finance", "reporting", "budget", "sql", "accounting"]
  },
  "ca-junior": {
    version: "CA Junior v4.0", count: 80, attempt: 40, idPrefix: "ca4",
    blocks: ["logic", "pnl", "balance", "cashflow", "debt", "excel", "cases", "final"]
  },
  "fpa-junior": {
    version: "FP&A Junior v4.0", count: 40, attempt: 40, idPrefix: "fpa4",
    blocks: ["budget", "planfact", "forecast", "margin", "capex", "unit", "data", "commentary"]
  },
  "acc-junior": {
    version: "ACC Junior v4.0", count: 40, attempt: 40, idPrefix: "acc4",
    blocks: ["entries", "assets", "revenue", "vat", "amort", "closing", "docs", "excel"]
  },
  "bi-junior": {
    version: "BI Junior v4.0", count: 40, attempt: 40, idPrefix: "bi4",
    blocks: ["sql", "joins", "dates", "model", "quality", "powerbi", "metrics", "business"]
  }
});

const TOP_KEYS = [
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions"
];
const SOURCE_QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context",
  "options", "correctIndex", "comment"
];
const PRIVATE_QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context",
  "options", "correctOptionId", "comment"
];
const PUBLIC_QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context", "options"
];
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard", "calc", "case"]);

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, location) {
  if (!isPlainObject(value)) fail(`${location}: expected object`);
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${location}: expected keys/order ${expected.join(", ")}; got ${actual.join(", ")}`);
  }
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function serialize(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function optionId(testId, questionId, optionText) {
  return "opt_" + sha256Hex(`${OPTION_ID_NAMESPACE}|${testId}|${questionId}|${optionText}`).slice(0, 20);
}

function versionSlug(version) {
  const slug = String(version || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) fail("Bank version slug is empty");
  return slug.slice(0, 80);
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`));
}

function resolveExistingOrParent(candidate) {
  const absolute = path.resolve(candidate);
  if (fs.existsSync(absolute)) return fs.realpathSync.native(absolute);
  const parent = path.dirname(absolute);
  if (!fs.existsSync(parent)) fail(`Parent directory is missing: ${parent}`);
  return path.join(fs.realpathSync.native(parent), path.basename(absolute));
}

function assertOutsideRepo(candidate, label) {
  const resolvedRoot = fs.realpathSync.native(ROOT);
  const resolvedCandidate = resolveExistingOrParent(candidate);
  if (isInside(resolvedRoot, resolvedCandidate)) {
    fail(`${label} must stay outside the Git worktree: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

function loadBaseline(testId) {
  let bytes;
  try {
    bytes = execFileSync("git", ["show", `${ROTATION_BASELINE_COMMIT}:data/${testId}.json`], {
      cwd: ROOT,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024
    });
  } catch (error) {
    fail(`Pinned rotation baseline is unavailable for ${testId}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

function canonicalPublic(privateBank) {
  return {
    schemaVersion: 2,
    testId: privateBank.testId,
    testVersion: privateBank.testVersion,
    bankVersion: privateBank.bankVersion,
    questionsPerAttempt: privateBank.questionsPerAttempt,
    blocks: JSON.parse(JSON.stringify(privateBank.blocks)),
    questions: privateBank.questions.map(question => {
      const result = {};
      PUBLIC_QUESTION_KEYS.forEach(key => {
        result[key] = key === "options"
          ? question.options.map(option => ({ id: option.id, text: option.text }))
          : question[key];
      });
      return result;
    })
  };
}

function publicDigest(publicBank) {
  return sha256Hex(JSON.stringify(publicBank));
}

function tokenSet(value) {
  return new Set(normalizeText(value).replace(/[^\p{L}\p{N}%]+/gu, " ").split(" ").filter(token => token.length > 2));
}

function jaccard(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  a.forEach(token => { if (b.has(token)) intersection += 1; });
  return intersection / (a.size + b.size - intersection);
}

function validateSource(source, testId, spec, baseline) {
  const fileLabel = `${testId}${SOURCE_SUFFIX}`;
  assertExactKeys(source, TOP_KEYS, fileLabel);
  if (source.schemaVersion !== 2 || source.testId !== testId ||
      source.testVersion !== spec.version || source.bankVersion !== spec.version ||
      source.questionsPerAttempt !== spec.attempt || !isPlainObject(source.blocks) ||
      !Array.isArray(source.questions) || source.questions.length !== spec.count) {
    fail(`${fileLabel}: invalid rotated bank metadata`);
  }
  const blockKeys = Object.keys(source.blocks);
  if (JSON.stringify(blockKeys) !== JSON.stringify(spec.blocks) ||
      blockKeys.some(key => typeof source.blocks[key] !== "string" || !source.blocks[key].trim())) {
    fail(`${fileLabel}: invalid block definitions`);
  }

  const baselineQuestions = new Set((baseline.questions || []).map(question => normalizeText(question.text)));
  const baselineOptions = new Set((baseline.questions || []).flatMap(question =>
    (question.options || []).map(option => normalizeText(option.text))
  ));
  const questionTexts = new Set();
  const maximumSimilarities = [];
  let uniqueLongestCorrect = 0;
  let uniqueShortestCorrect = 0;
  let uniqueLongestCorrectPoints = 0;
  let totalPoints = 0;
  let largeCorrectLengthGap = 0;

  source.questions.forEach((question, index) => {
    const location = `${fileLabel}.questions[${index}]`;
    assertExactKeys(question, SOURCE_QUESTION_KEYS, location);
    const expectedId = `${spec.idPrefix}_${String(index + 1).padStart(3, "0")}`;
    if (question.id !== expectedId || typeof question.topic !== "string" || question.topic.length > 160 ||
        !Object.prototype.hasOwnProperty.call(source.blocks, question.block) ||
        !ALLOWED_DIFFICULTIES.has(question.difficulty) || !Number.isInteger(question.timeLimit) ||
        question.timeLimit < 15 || question.timeLimit > 300 || !Number.isFinite(question.points) ||
        question.points <= 0 || question.points > 10 || typeof question.text !== "string" ||
        !question.text.trim() || question.text.length > 5000 || typeof question.context !== "string" ||
        question.context.length > 5000 || typeof question.comment !== "string" ||
        !question.comment.trim() || question.comment.length > 5000 || !Array.isArray(question.options) ||
        question.options.length !== 4 || !Number.isInteger(question.correctIndex) ||
        question.correctIndex < 0 || question.correctIndex > 3) {
      fail(`${location}: invalid rotated question`);
    }
    const normalizedQuestion = normalizeText(question.text);
    if (questionTexts.has(normalizedQuestion) || baselineQuestions.has(normalizedQuestion)) {
      fail(`${location}: question text is duplicated or reused from the compromised bank`);
    }
    questionTexts.add(normalizedQuestion);
    const mostSimilarLegacy = (baseline.questions || []).reduce((maximum, legacyQuestion) =>
      Math.max(maximum, jaccard(question.text, legacyQuestion.text)), 0);
    if (mostSimilarLegacy >= 0.78) {
      fail(`${location}: too similar to a compromised-bank question (${mostSimilarLegacy.toFixed(3)})`);
    }
    maximumSimilarities.push(mostSimilarLegacy);

    const localOptions = new Set();
    question.options.forEach((option, optionIndex) => {
      if (typeof option !== "string" || !option.trim() || option.length > 1200) {
        fail(`${location}.options[${optionIndex}]: invalid option text`);
      }
      const normalizedOption = normalizeText(option);
      if (localOptions.has(normalizedOption) || baselineOptions.has(normalizedOption)) {
        fail(`${location}.options[${optionIndex}]: option is duplicated or reused from the compromised bank`);
      }
      localOptions.add(normalizedOption);
    });
    const optionLengths = question.options.map(option => Array.from(option).length);
    const correctLength = optionLengths[question.correctIndex];
    const longest = Math.max(...optionLengths);
    const shortest = Math.min(...optionLengths);
    const otherLongest = Math.max(...optionLengths.filter((_value, optionIndex) => optionIndex !== question.correctIndex));
    if (correctLength === longest && optionLengths.filter(length => length === longest).length === 1) {
      uniqueLongestCorrect += 1;
      uniqueLongestCorrectPoints += question.points;
    }
    if (correctLength === shortest && optionLengths.filter(length => length === shortest).length === 1) {
      uniqueShortestCorrect += 1;
    }
    if (correctLength > otherLongest && (correctLength - otherLongest >= 10 || correctLength >= otherLongest * 1.15)) {
      largeCorrectLengthGap += 1;
    }
    totalPoints += question.points;
  });

  const averageSimilarity = maximumSimilarities.reduce((sum, value) => sum + value, 0) / maximumSimilarities.length;
  if (averageSimilarity >= 0.55) {
    fail(`${fileLabel}: average maximum legacy similarity ${averageSimilarity.toFixed(3)} is too high`);
  }
  if (uniqueLongestCorrect > Math.floor(spec.count * 0.25) ||
      uniqueLongestCorrectPoints > totalPoints * 0.25 || largeCorrectLengthGap > Math.floor(spec.count * 0.15)) {
    fail(`${fileLabel}: answer-length side channel is too strong: ` +
      `uniqueLongest=${uniqueLongestCorrect}/${spec.count}; points=${uniqueLongestCorrectPoints}/${totalPoints}; ` +
      `largeGap=${largeCorrectLengthGap}`);
  }
  if (uniqueShortestCorrect > Math.floor(spec.count * 0.35)) {
    fail(`${fileLabel}: shortest-answer position is too predictable: ${uniqueShortestCorrect}/${spec.count}`);
  }
  const longestHeuristicExpectedPercent = totalPoints
    ? 100 * (uniqueLongestCorrectPoints + (totalPoints - uniqueLongestCorrectPoints) * 0.25) / totalPoints
    : 0;
  return {
    averageSimilarity,
    maximumSimilarity: Math.max(...maximumSimilarities),
    uniqueLongestCorrect,
    uniqueShortestCorrect,
    largeCorrectLengthGap,
    longestHeuristicExpectedPercent
  };
}

function buildBank(source, testId, spec, baseline) {
  const seenOptionIds = new Set();
  const legacyQuestionIds = new Set((baseline && baseline.questions || []).map(question => String(question.id)));
  const legacyOptionIds = new Set((baseline && baseline.questions || []).flatMap(question =>
    (question.options || []).map(option => String(option.id || ""))
  ));
  const questions = source.questions.map(question => {
    if (legacyQuestionIds.has(question.id)) fail(`${testId}: rotated question id intersects the compromised bank`);
    const optionObjects = question.options.map(text => ({ id: optionId(testId, question.id, text), text }));
    const correctOptionId = optionObjects[question.correctIndex].id;
    const sortedOptions = optionObjects.slice().sort((left, right) => left.id.localeCompare(right.id));
    sortedOptions.forEach(option => {
      if (seenOptionIds.has(option.id)) fail(`${testId}: global option id collision ${option.id}`);
      if (legacyOptionIds.has(option.id)) fail(`${testId}: rotated option id intersects the compromised bank`);
      seenOptionIds.add(option.id);
    });
    const result = {};
    PRIVATE_QUESTION_KEYS.forEach(key => {
      if (key === "options") result[key] = sortedOptions;
      else if (key === "correctOptionId") result[key] = correctOptionId;
      else result[key] = question[key];
    });
    return result;
  });
  const privateBank = {
    schemaVersion: 2,
    testId,
    testVersion: spec.version,
    bankVersion: spec.version,
    questionsPerAttempt: spec.attempt,
    blocks: JSON.parse(JSON.stringify(source.blocks)),
    questions,
    publicDigest: ""
  };
  const publicBank = canonicalPublic(privateBank);
  privateBank.publicDigest = publicDigest(publicBank);
  const correctPositions = [0, 0, 0, 0];
  privateBank.questions.forEach(question => {
    correctPositions[question.options.findIndex(option => option.id === question.correctOptionId)] += 1;
  });
  if (Math.max(...correctPositions) > Math.ceil(spec.count * 0.4)) {
    fail(`${testId}: delivered correct-answer position distribution is too predictable: ${correctPositions.join("/")}`);
  }
  return {
    privateBank,
    publicBank: { ...publicBank, publicDigest: privateBank.publicDigest },
    correctPositions
  };
}

function parseArguments(argv) {
  const result = { sourceDir: "", privateOut: "", publicStage: "" };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const takeValue = name => {
      const value = argv[++index];
      if (!value) fail(`${name} requires a value`);
      return path.resolve(value);
    };
    if (argument === "--source-dir") result.sourceDir = takeValue("--source-dir");
    else if (argument === "--private-out") result.privateOut = takeValue("--private-out");
    else if (argument === "--public-stage") result.publicStage = takeValue("--public-stage");
    else fail(`Unknown argument: ${argument}`);
  }
  if (!result.sourceDir || !result.privateOut || !result.publicStage) {
    fail("--source-dir, --private-out and --public-stage are required");
  }
  result.sourceDir = assertOutsideRepo(result.sourceDir, "Rotation source directory");
  result.privateOut = assertOutsideRepo(result.privateOut, "Private output directory");
  result.publicStage = assertOutsideRepo(result.publicStage, "Public staging directory");
  const resolvedPaths = [result.sourceDir, result.privateOut, result.publicStage];
  for (let left = 0; left < resolvedPaths.length; left++) {
    for (let right = left + 1; right < resolvedPaths.length; right++) {
      if (isInside(resolvedPaths[left], resolvedPaths[right]) || isInside(resolvedPaths[right], resolvedPaths[left])) {
        fail("Rotation source, private output and public staging directories must be separate");
      }
    }
  }
  return result;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!fs.existsSync(args.sourceDir)) fail(`Rotation source directory is missing: ${args.sourceDir}`);
  if (!fs.statSync(args.sourceDir).isDirectory()) fail(`Rotation source path is not a directory: ${args.sourceDir}`);
  if (fs.existsSync(args.privateOut)) fail(`Private output directory already exists: ${args.privateOut}`);
  if (fs.existsSync(args.publicStage)) fail(`Public staging directory already exists: ${args.publicStage}`);

  const plans = Object.entries(SPECS).map(([testId, spec]) => {
    const sourcePath = path.join(args.sourceDir, testId + SOURCE_SUFFIX);
    if (!fs.existsSync(sourcePath)) fail(`Rotation source file is missing for ${testId}`);
    const realSourcePath = fs.realpathSync.native(sourcePath);
    if (!isInside(args.sourceDir, realSourcePath)) {
      fail(`Rotation source file escapes the approved source directory for ${testId}`);
    }
    assertOutsideRepo(realSourcePath, `Rotation source file for ${testId}`);
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const baseline = loadBaseline(testId);
    const rotation = validateSource(source, testId, spec, baseline);
    const artifacts = buildBank(source, testId, spec, baseline);
    return { testId, spec, sourcePath, rotation, ...artifacts };
  });

  fs.mkdirSync(args.privateOut, { recursive: false });
  fs.mkdirSync(args.publicStage, { recursive: false });
  assertOutsideRepo(fs.realpathSync.native(args.privateOut), "Created private output directory");
  assertOutsideRepo(fs.realpathSync.native(args.publicStage), "Created public staging directory");
  const anchors = {};
  const pendingRotation = { schemaVersion: 1, rotationId: ROTATION_RELEASE_ID, banks: {} };
  const manifest = {
    schemaVersion: 1,
    rotationBaselineCommit: ROTATION_BASELINE_COMMIT,
    generatedAt: new Date().toISOString(),
    banks: []
  };
  plans.forEach(plan => {
    const privateFolder = path.join(args.privateOut, plan.testId);
    fs.mkdirSync(privateFolder, { recursive: false });
    const privatePath = path.join(privateFolder, versionSlug(plan.spec.version) + ".json");
    const privateText = serialize(plan.privateBank);
    const publicText = serialize(plan.publicBank);
    fs.writeFileSync(privatePath, privateText, { encoding: "utf8", flag: "wx" });
    fs.writeFileSync(path.join(args.publicStage, `${plan.testId}.json`), publicText, { encoding: "utf8", flag: "wx" });
    const privateDigest = sha256Hex(JSON.stringify(plan.privateBank));
    anchors[`${plan.testId}|${plan.spec.version}`] = privateDigest;
    pendingRotation.banks[plan.testId] = {
      bankVersion: plan.spec.version,
      questionCount: plan.spec.count,
      publicDigest: plan.privateBank.publicDigest,
      privateDigest
    };
    manifest.banks.push({
      testId: plan.testId,
      version: plan.spec.version,
      questionCount: plan.spec.count,
      publicDigest: plan.privateBank.publicDigest,
      privateDigest,
      privateFileSha256: sha256Hex(privateText),
      privateFileBytes: Buffer.byteLength(privateText, "utf8"),
      publicFileSha256: sha256Hex(publicText),
      publicFileBytes: Buffer.byteLength(publicText, "utf8"),
      averageLegacySimilarity: Number(plan.rotation.averageSimilarity.toFixed(4)),
      maximumLegacySimilarity: Number(plan.rotation.maximumSimilarity.toFixed(4)),
      uniqueLongestCorrect: plan.rotation.uniqueLongestCorrect,
      uniqueShortestCorrect: plan.rotation.uniqueShortestCorrect,
      largeCorrectLengthGap: plan.rotation.largeCorrectLengthGap,
      longestHeuristicExpectedPercent: Number(plan.rotation.longestHeuristicExpectedPercent.toFixed(2)),
      correctPositions: plan.correctPositions
    });
  });
  fs.writeFileSync(path.join(args.privateOut, "private-bank-anchors.v4.json"), serialize(anchors), { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(path.join(args.privateOut, "private-bank-rotation-pending.v4.json"), serialize(pendingRotation), { encoding: "utf8", flag: "wx" });
  fs.writeFileSync(path.join(args.privateOut, "rotation-manifest.json"), serialize(manifest), { encoding: "utf8", flag: "wx" });
  manifest.banks.forEach(bank => console.log(
    `${bank.testId} version=${JSON.stringify(bank.version)} questions=${bank.questionCount} ` +
    `publicDigest=${bank.publicDigest} privateDigest=${bank.privateDigest} ` +
    `legacySimilarity=${bank.averageLegacySimilarity}/${bank.maximumLegacySimilarity} ` +
    `lengthHeuristic=${bank.longestHeuristicExpectedPercent}% ` +
    `correctPositions=${bank.correctPositions.join("/")}`
  ));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  SPECS, ROTATION_BASELINE_COMMIT, ROTATION_RELEASE_ID, validateSource, buildBank, optionId, publicDigest,
  canonicalPublic, isInside, parseArguments, versionSlug
};
