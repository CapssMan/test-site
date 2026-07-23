#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { SPECS, ROTATION_RELEASE_ID, optionId } = require("./build-rotated-banks.js");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const TRANSACTION_FILE = ".rotation-v4.transaction.json";
const COMMIT_MARKER_FILE = ".rotation-v4.commit";
const EXPECTED_NAMES = Object.freeze(Object.keys(SPECS).map(testId => `${testId}.json`).sort());
const BANK_KEYS = [
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions", "publicDigest"
];
const QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context", "options"
];
const OPTION_KEYS = ["id", "text"];

function fail(message) {
  throw new Error(message);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, keys, label) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]" ||
      JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) {
    fail(`${label}: invalid schema/key order`);
  }
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." &&
    !relative.startsWith(`..${path.sep}`));
}

function samePath(left, right) {
  const normalize = value => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function assertRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular non-symlink file`);
  return stat;
}

function readRegularFile(filePath, label) {
  assertRegularFile(filePath, label);
  const descriptor = fs.openSync(filePath, "r");
  try {
    if (!fs.fstatSync(descriptor).isFile()) fail(`${label} changed while it was being read`);
    return fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeExclusiveDurable(filePath, bytes) {
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertCanonicalDirectory(candidate, expected, allowedRoot, label) {
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`${label} must be a regular directory`);
  const real = fs.realpathSync.native(candidate);
  if (!isInside(allowedRoot, real) || !samePath(real, expected)) {
    fail(`${label} resolves outside its canonical location: ${real}`);
  }
  return real;
}

function assertTrustedDataDir(dataDir = DATA_DIR) {
  const rootReal = fs.realpathSync.native(ROOT);
  return assertCanonicalDirectory(dataDir, path.join(rootReal, "data"), rootReal, "Tracked data path");
}

function assertExternalDirectory(candidate, label) {
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`${label} must be a regular directory`);
  const real = fs.realpathSync.native(candidate);
  if (isInside(fs.realpathSync.native(ROOT), real)) {
    fail(`${label} must stay outside the Git worktree: ${real}`);
  }
  return real;
}

function assertExternalFile(candidate, label) {
  assertRegularFile(candidate, label);
  const real = fs.realpathSync.native(candidate);
  if (isInside(fs.realpathSync.native(ROOT), real)) {
    fail(`${label} must stay outside the Git worktree: ${real}`);
  }
  return real;
}

function parseArguments(argv) {
  const result = { publicStage: "", manifest: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!value) fail(`${argument} requires a value`);
    if (argument === "--public-stage") result.publicStage = path.resolve(value);
    else if (argument === "--manifest") result.manifest = path.resolve(value);
    else fail(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!result.publicStage || !result.manifest) fail("--public-stage and --manifest are required");
  result.publicStage = assertExternalDirectory(result.publicStage, "Rotation public staging directory");
  result.manifest = assertExternalFile(result.manifest, "Rotation manifest");
  return result;
}

function canonicalPublic(bank) {
  const result = {};
  BANK_KEYS.slice(0, -1).forEach(key => { result[key] = bank[key]; });
  return result;
}

function validateBank(bank, testId, spec) {
  exactKeys(bank, BANK_KEYS, testId);
  if (bank.schemaVersion !== 2 || bank.testId !== testId || bank.testVersion !== spec.version ||
      bank.bankVersion !== spec.version || bank.questionsPerAttempt !== spec.attempt ||
      !Array.isArray(bank.questions) || bank.questions.length !== spec.count ||
      !bank.blocks || Object.prototype.toString.call(bank.blocks) !== "[object Object]" ||
      JSON.stringify(Object.keys(bank.blocks)) !== JSON.stringify(spec.blocks)) {
    fail(`${testId}: invalid public metadata`);
  }
  const seenQuestions = new Set();
  const seenOptions = new Set();
  bank.questions.forEach((question, index) => {
    exactKeys(question, QUESTION_KEYS, `${testId}.questions[${index}]`);
    const expectedId = `${spec.idPrefix}_${String(index + 1).padStart(3, "0")}`;
    if (question.id !== expectedId || seenQuestions.has(question.id) || !Array.isArray(question.options) ||
        question.options.length !== 4 || !Object.prototype.hasOwnProperty.call(bank.blocks, question.block) ||
        !["easy", "medium", "hard", "calc", "case"].includes(question.difficulty) ||
        !Number.isInteger(question.timeLimit) || question.timeLimit < 15 || question.timeLimit > 300 ||
        !Number.isFinite(question.points) || question.points <= 0 || question.points > 10 ||
        typeof question.topic !== "string" || question.topic.length > 160 ||
        typeof question.text !== "string" || !question.text.trim() || question.text.length > 5000 ||
        typeof question.context !== "string" || question.context.length > 5000) {
      fail(`${testId}: invalid public question manifest`);
    }
    seenQuestions.add(question.id);
    let previous = "";
    question.options.forEach((option, optionIndex) => {
      exactKeys(option, OPTION_KEYS, `${testId}.questions[${index}].options[${optionIndex}]`);
      if (!/^opt_[a-f0-9]{20}$/.test(option.id) || seenOptions.has(option.id) ||
          (previous && option.id <= previous) || typeof option.text !== "string" || !option.text.trim()) {
        fail(`${testId}: invalid public option manifest`);
      }
      if (option.id !== optionId(testId, question.id, option.text)) {
        fail(`${testId}: public option id is not deterministic`);
      }
      seenOptions.add(option.id);
      previous = option.id;
    });
  });
  if (!/^[a-f0-9]{64}$/.test(bank.publicDigest) ||
      bank.publicDigest !== sha256Hex(Buffer.from(JSON.stringify(canonicalPublic(bank)), "utf8"))) {
    fail(`${testId}: invalid public digest`);
  }
}

function assertStagingFiles(stageDirectory) {
  const entries = fs.readdirSync(stageDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  if (JSON.stringify(entries.map(entry => entry.name)) !== JSON.stringify(EXPECTED_NAMES) ||
      entries.some(entry => !entry.isFile() || entry.isSymbolicLink())) {
    fail("Public staging directory must contain exactly five regular rotated bank files");
  }
  entries.forEach(entry => assertRegularFile(path.join(stageDirectory, entry.name), `${entry.name} staging entry`));
  return entries;
}

function transactionPaths(dataDir, fileName) {
  return {
    fileName,
    target: path.join(dataDir, fileName),
    temporary: path.join(dataDir, `.${fileName}.rotation-v4.tmp`),
    backup: path.join(dataDir, `.${fileName}.rotation-v4.bak`)
  };
}

function transactionFilePaths(dataDir) {
  return {
    journal: path.join(dataDir, TRANSACTION_FILE),
    marker: path.join(dataDir, COMMIT_MARKER_FILE)
  };
}

function readTransaction(dataDir) {
  const { journal } = transactionFilePaths(dataDir);
  const transaction = JSON.parse(readRegularFile(journal, "Rotation transaction journal").toString("utf8"));
  exactKeys(transaction, ["schemaVersion", "releaseId", "files"], "Rotation transaction journal");
  if (transaction.schemaVersion !== 1 || transaction.releaseId !== ROTATION_RELEASE_ID ||
      !Array.isArray(transaction.files) || transaction.files.length !== EXPECTED_NAMES.length) {
    fail("Rotation transaction journal metadata is invalid");
  }
  transaction.files.forEach((entry, index) => {
    exactKeys(entry, ["name", "oldSha256", "newSha256"], `Rotation transaction file ${index}`);
    if (entry.name !== EXPECTED_NAMES[index] || !/^[a-f0-9]{64}$/.test(entry.oldSha256) ||
        !/^[a-f0-9]{64}$/.test(entry.newSha256)) {
      fail(`Rotation transaction file ${index} is invalid`);
    }
  });
  return transaction;
}

function digestRegularFile(filePath, label) {
  return sha256Hex(readRegularFile(filePath, label));
}

function collectTransactionArtifacts(dataDir) {
  return EXPECTED_NAMES.map(name => transactionPaths(dataDir, name));
}

function recoverInterruptedTransaction(dataDir) {
  const { journal, marker } = transactionFilePaths(dataDir);
  const artifacts = collectTransactionArtifacts(dataDir);
  const hasJournal = fs.existsSync(journal);
  const hasMarker = fs.existsSync(marker);

  if (!hasJournal) {
    const backups = artifacts.filter(plan => fs.existsSync(plan.backup));
    const temporaries = artifacts.filter(plan => fs.existsSync(plan.temporary));
    if (hasMarker) {
      assertRegularFile(marker, "Rotation commit marker");
      if (backups.length || temporaries.length || artifacts.some(plan => !fs.existsSync(plan.target))) {
        fail("Commit marker exists without its journal while transaction artifacts are incomplete");
      }
      fs.unlinkSync(marker);
      return "committed-marker-cleaned";
    }
    if (backups.length) fail("Orphaned rotation backups exist without a transaction journal");
    temporaries.forEach(plan => {
      assertRegularFile(plan.temporary, `${plan.fileName} orphaned temporary`);
      fs.unlinkSync(plan.temporary);
    });
    return temporaries.length ? "orphaned-temporaries-cleaned" : "clean";
  }

  const transaction = readTransaction(dataDir);
  const entries = Object.fromEntries(transaction.files.map(entry => [entry.name, entry]));
  if (hasMarker) {
    assertRegularFile(marker, "Rotation commit marker");
    const validationErrors = [];
    artifacts.forEach(plan => {
      try {
        if (!fs.existsSync(plan.target) ||
            digestRegularFile(plan.target, `${plan.fileName} committed target`) !== entries[plan.fileName].newSha256) {
          fail(`${plan.fileName}: committed target digest mismatch`);
        }
        if (fs.existsSync(plan.backup)) assertRegularFile(plan.backup, `${plan.fileName} backup`);
        if (fs.existsSync(plan.temporary)) assertRegularFile(plan.temporary, `${plan.fileName} temporary`);
      } catch (error) {
        validationErrors.push(error.message);
      }
    });
    if (validationErrors.length) fail(`Committed rotation recovery failed: ${validationErrors.join("; ")}`);

    const cleanupErrors = [];
    artifacts.forEach(plan => {
      [plan.backup, plan.temporary].forEach(filePath => {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (error) { cleanupErrors.push(error.message); }
      });
    });
    if (cleanupErrors.length) fail(`Committed rotation cleanup failed: ${cleanupErrors.join("; ")}`);
    fs.unlinkSync(journal);
    fs.unlinkSync(marker);
    return "committed-cleaned";
  }

  const validationErrors = [];
  artifacts.forEach(plan => {
    const entry = entries[plan.fileName];
    try {
      if (fs.existsSync(plan.backup)) {
        if (digestRegularFile(plan.backup, `${plan.fileName} rollback backup`) !== entry.oldSha256) {
          fail(`${plan.fileName}: rollback backup digest mismatch`);
        }
        if (fs.existsSync(plan.target)) assertRegularFile(plan.target, `${plan.fileName} rollback target`);
      } else if (!fs.existsSync(plan.target) ||
          digestRegularFile(plan.target, `${plan.fileName} rollback target`) !== entry.oldSha256) {
        fail(`${plan.fileName}: old target is unavailable for rollback`);
      }
      if (fs.existsSync(plan.temporary) &&
          digestRegularFile(plan.temporary, `${plan.fileName} rollback temporary`) !== entry.newSha256) {
        fail(`${plan.fileName}: rollback temporary digest mismatch`);
      }
    } catch (error) {
      validationErrors.push(error.message);
    }
  });
  if (validationErrors.length) fail(`Rotation rollback validation failed: ${validationErrors.join("; ")}`);

  const rollbackErrors = [];
  artifacts.slice().reverse().forEach(plan => {
    try {
      if (fs.existsSync(plan.backup)) {
        if (fs.existsSync(plan.target)) fs.unlinkSync(plan.target);
        fs.renameSync(plan.backup, plan.target);
      }
      if (fs.existsSync(plan.temporary)) fs.unlinkSync(plan.temporary);
    } catch (error) {
      rollbackErrors.push(`${plan.fileName}: ${error.message}`);
    }
  });
  artifacts.forEach(plan => {
    try {
      if (!fs.existsSync(plan.target) ||
          digestRegularFile(plan.target, `${plan.fileName} restored target`) !== entries[plan.fileName].oldSha256) {
        fail(`${plan.fileName}: restored target digest mismatch`);
      }
    } catch (error) {
      rollbackErrors.push(error.message);
    }
  });
  if (rollbackErrors.length) fail(`Rotation rollback was incomplete: ${rollbackErrors.join("; ")}`);
  fs.unlinkSync(journal);
  return "rolled-back";
}

function createJournal(plans) {
  return {
    schemaVersion: 1,
    releaseId: ROTATION_RELEASE_ID,
    files: plans.slice().sort((left, right) => left.fileName.localeCompare(right.fileName)).map(plan => ({
      name: plan.fileName,
      oldSha256: plan.oldSha256,
      newSha256: plan.newSha256
    }))
  };
}

function main() {
  const dataDir = assertTrustedDataDir(DATA_DIR);
  recoverInterruptedTransaction(dataDir);
  const args = parseArguments(process.argv.slice(2));
  const manifestBytes = readRegularFile(args.manifest, "Rotation manifest");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.banks) ||
      manifest.banks.length !== Object.keys(SPECS).length) {
    fail("Rotation manifest is invalid");
  }
  const manifestIds = manifest.banks.map(bank => bank && bank.testId).sort();
  if (JSON.stringify(manifestIds) !== JSON.stringify(Object.keys(SPECS).sort())) {
    fail("Rotation manifest must contain each production bank exactly once");
  }
  const manifestById = Object.fromEntries(manifest.banks.map(bank => [bank.testId, bank]));
  assertStagingFiles(args.publicStage);

  const plans = Object.entries(SPECS).map(([testId, spec]) => {
    const fileName = `${testId}.json`;
    const sourcePath = path.join(args.publicStage, fileName);
    const sourceReal = fs.realpathSync.native(sourcePath);
    if (!isInside(args.publicStage, sourceReal)) fail(`${testId}: staging file escapes its directory`);
    const bytes = readRegularFile(sourceReal, `${testId} staging file`);
    const bank = JSON.parse(bytes.toString("utf8"));
    const entry = manifestById[testId];
    validateBank(bank, testId, spec);
    if (!entry || entry.version !== spec.version || entry.publicDigest !== bank.publicDigest ||
        entry.publicFileSha256 !== sha256Hex(bytes) || entry.publicFileBytes !== bytes.length) {
      fail(`${testId}: public staging file does not match the rotation manifest`);
    }
    const paths = transactionPaths(dataDir, fileName);
    const targetReal = fs.realpathSync.native(paths.target);
    if (!isInside(dataDir, targetReal) || !samePath(targetReal, paths.target)) {
      fail(`${testId}: tracked target resolves outside the canonical data directory`);
    }
    const oldBytes = readRegularFile(paths.target, `${testId} tracked target`);
    return {
      testId,
      bytes,
      newSha256: sha256Hex(bytes),
      oldSha256: sha256Hex(oldBytes),
      ...paths
    };
  });

  const { journal, marker } = transactionFilePaths(dataDir);
  try {
    plans.forEach(plan => {
      if (fs.existsSync(plan.temporary) || fs.existsSync(plan.backup)) {
        fail(`${plan.testId}: stale rotation transaction artifact exists after recovery`);
      }
      writeExclusiveDurable(plan.temporary, plan.bytes);
    });
    writeExclusiveDurable(journal, Buffer.from(JSON.stringify(createJournal(plans), null, 2) + "\n", "utf8"));
    plans.forEach(plan => {
      fs.renameSync(plan.target, plan.backup);
      fs.renameSync(plan.temporary, plan.target);
    });
    plans.forEach(plan => {
      if (digestRegularFile(plan.target, `${plan.testId} promoted target`) !== plan.newSha256) {
        fail(`${plan.testId}: promoted target digest mismatch`);
      }
    });
    writeExclusiveDurable(marker, Buffer.from(`${ROTATION_RELEASE_ID}\n`, "utf8"));
    recoverInterruptedTransaction(dataDir);
  } catch (error) {
    try {
      recoverInterruptedTransaction(dataDir);
    } catch (recoveryError) {
      error.message += `; recovery retained for retry: ${recoveryError.message}`;
    }
    throw error;
  }
  console.log(`Promoted ${plans.length} rotated public banks (${plans.reduce((sum, plan) => sum + SPECS[plan.testId].count, 0)} questions).`);
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
  COMMIT_MARKER_FILE,
  EXPECTED_NAMES,
  TRANSACTION_FILE,
  assertCanonicalDirectory,
  assertStagingFiles,
  assertTrustedDataDir,
  createJournal,
  isInside,
  parseArguments,
  recoverInterruptedTransaction,
  sha256Hex,
  transactionFilePaths,
  transactionPaths,
  validateBank,
  writeExclusiveDurable
};
