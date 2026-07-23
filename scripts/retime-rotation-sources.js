#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_SUFFIX = ".rotation-source.json";
const TEST_IDS = Object.freeze([
  "fa-junior",
  "ca-junior",
  "fpa-junior",
  "acc-junior",
  "bi-junior"
]);
const TARGET_RANGES = Object.freeze({
  easy: Object.freeze([40, 45]),
  medium: Object.freeze([45, 55]),
  calc: Object.freeze([60, 75]),
  case: Object.freeze([70, 85]),
  hard: Object.freeze([85, 100])
});

function fail(message) {
  throw new Error(message);
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`));
}

function assertOutsideRepo(candidate, label) {
  const resolvedRoot = fs.realpathSync.native(ROOT);
  const resolvedCandidate = fs.realpathSync.native(candidate);
  if (isInside(resolvedRoot, resolvedCandidate)) {
    fail(`${label} must stay outside the Git worktree: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

function parseArguments(argv) {
  const args = { sourceDir: "", apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir") {
      const value = argv[++index];
      if (!value) fail("--source-dir requires a value");
      args.sourceDir = path.resolve(value);
    } else if (argument === "--apply") {
      args.apply = true;
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  if (!args.sourceDir) fail("--source-dir is required");
  if (!fs.existsSync(args.sourceDir) || !fs.statSync(args.sourceDir).isDirectory()) {
    fail(`Rotation source directory is missing: ${args.sourceDir}`);
  }
  args.sourceDir = assertOutsideRepo(args.sourceDir, "Rotation source directory");
  return args;
}

function roundToFive(value) {
  return Math.round(value / 5) * 5;
}

function rankValue(question) {
  return question.timeLimit * 100 + Number(question.points || 0);
}

function retimeBank(bank, testId) {
  if (!bank || bank.testId !== testId || !Array.isArray(bank.questions) || !bank.questions.length) {
    fail(`${testId}: invalid rotation source metadata`);
  }
  const groups = new Map();
  bank.questions.forEach((question, index) => {
    if (!question || !Object.prototype.hasOwnProperty.call(TARGET_RANGES, question.difficulty) ||
        !Number.isInteger(question.timeLimit) || question.timeLimit < 15 || question.timeLimit > 300) {
      fail(`${testId}: invalid difficulty/timeLimit at question ${index + 1}`);
    }
    const group = groups.get(question.difficulty) || [];
    group.push({ question, index, rank: rankValue(question) });
    groups.set(question.difficulty, group);
  });

  const previousTotal = bank.questions.reduce((sum, question) => sum + question.timeLimit, 0);
  groups.forEach((group, difficulty) => {
    const [targetMin, targetMax] = TARGET_RANGES[difficulty];
    const rankMin = Math.min(...group.map(item => item.rank));
    const rankMax = Math.max(...group.map(item => item.rank));
    group.forEach(item => {
      const ratio = rankMax === rankMin ? 0.5 : (item.rank - rankMin) / (rankMax - rankMin);
      item.question.timeLimit = roundToFive(targetMin + ratio * (targetMax - targetMin));
    });
  });
  const nextTotal = bank.questions.reduce((sum, question) => sum + question.timeLimit, 0);
  const expectedAttemptSeconds = Math.round(nextTotal * bank.questionsPerAttempt / bank.questions.length);
  return { bank, previousTotal, nextTotal, expectedAttemptSeconds };
}

function replaceFileAtomically(filePath, content) {
  const temporaryPath = `${filePath}.retime-tmp`;
  const previousPath = `${filePath}.retime-prev`;
  if (fs.existsSync(temporaryPath) || fs.existsSync(previousPath)) {
    fail(`Refusing to overwrite a previous retiming recovery file near ${filePath}`);
  }
  fs.writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  try {
    JSON.parse(fs.readFileSync(temporaryPath, "utf8"));
    fs.renameSync(filePath, previousPath);
    try {
      fs.renameSync(temporaryPath, filePath);
      JSON.parse(fs.readFileSync(filePath, "utf8"));
      fs.unlinkSync(previousPath);
    } catch (error) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fs.renameSync(previousPath, filePath);
      throw error;
    }
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const plans = TEST_IDS.map(testId => {
    const filePath = path.join(args.sourceDir, testId + SOURCE_SUFFIX);
    if (!fs.existsSync(filePath)) fail(`Rotation source file is missing for ${testId}`);
    const realPath = fs.realpathSync.native(filePath);
    if (!isInside(args.sourceDir, realPath)) fail(`Rotation source file escapes source directory for ${testId}`);
    assertOutsideRepo(realPath, `Rotation source file for ${testId}`);
    const bank = JSON.parse(fs.readFileSync(realPath, "utf8"));
    return { testId, filePath: realPath, ...retimeBank(bank, testId) };
  });

  if (args.apply) {
    plans.forEach(plan => replaceFileAtomically(plan.filePath, JSON.stringify(plan.bank, null, 2) + "\n"));
  }
  plans.forEach(plan => {
    const beforeMinutes = (plan.previousTotal / 60).toFixed(1);
    const fullMinutes = (plan.nextTotal / 60).toFixed(1);
    const attemptMinutes = (plan.expectedAttemptSeconds / 60).toFixed(1);
    console.log(`${plan.testId} before=${beforeMinutes}m full=${fullMinutes}m expectedAttempt=${attemptMinutes}m`);
  });
  console.log(args.apply ? "Rotation source timing updated." : "Dry run only; pass --apply to update sources.");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { TARGET_RANGES, TEST_IDS, retimeBank, parseArguments };
