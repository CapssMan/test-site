#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  EXPECTED_NAMES,
  assertCanonicalDirectory,
  assertStagingFiles,
  createJournal,
  isInside,
  recoverInterruptedTransaction,
  sha256Hex,
  transactionFilePaths,
  transactionPaths,
  writeExclusiveDurable
} = require("./promote-rotated-public-banks.js");

function createFixture(label) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `skillcheck-promoter-${label}-`));
  const plans = EXPECTED_NAMES.map(fileName => {
    const oldBytes = Buffer.from(`old:${fileName}\n`, "utf8");
    const newBytes = Buffer.from(`new:${fileName}\n`, "utf8");
    const paths = transactionPaths(dataDir, fileName);
    fs.writeFileSync(paths.target, oldBytes, { flag: "wx" });
    return {
      ...paths,
      oldBytes,
      newBytes,
      oldSha256: sha256Hex(oldBytes),
      newSha256: sha256Hex(newBytes)
    };
  });
  return { dataDir, plans, ...transactionFilePaths(dataDir) };
}

function seedPreparedTransaction(fixture) {
  fixture.plans.forEach(plan => writeExclusiveDurable(plan.temporary, plan.newBytes));
  writeExclusiveDurable(fixture.journal,
    Buffer.from(JSON.stringify(createJournal(fixture.plans), null, 2) + "\n", "utf8"));
}

function assertTargets(fixture, state) {
  fixture.plans.forEach(plan => {
    const expected = state === "old" ? plan.oldBytes : plan.newBytes;
    assert.deepEqual(fs.readFileSync(plan.target), expected, `${plan.fileName} must contain ${state} bytes`);
  });
}

function assertClean(fixture) {
  assert.equal(fs.existsSync(fixture.journal), false, "transaction journal must be removed");
  assert.equal(fs.existsSync(fixture.marker), false, "commit marker must be removed");
  fixture.plans.forEach(plan => {
    assert.equal(fs.existsSync(plan.temporary), false, `${plan.fileName} temporary must be removed`);
    assert.equal(fs.existsSync(plan.backup), false, `${plan.fileName} backup must be removed`);
  });
}

function withFixture(label, callback) {
  const fixture = createFixture(label);
  try {
    callback(fixture);
  } finally {
    fs.rmSync(fixture.dataDir, { recursive: true, force: true });
  }
}

const boundaryRoot = path.join(os.tmpdir(), "skillcheck-boundary-root");
assert.equal(isInside(boundaryRoot, path.join(boundaryRoot, "..stage", "file.json")), true,
  "a child named ..stage must remain inside its parent");

withFixture("prepared", fixture => {
  seedPreparedTransaction(fixture);
  assert.equal(recoverInterruptedTransaction(fixture.dataDir), "rolled-back");
  assertTargets(fixture, "old");
  assertClean(fixture);
});

withFixture("partial", fixture => {
  seedPreparedTransaction(fixture);
  fs.renameSync(fixture.plans[0].target, fixture.plans[0].backup);
  fs.renameSync(fixture.plans[1].target, fixture.plans[1].backup);
  fs.renameSync(fixture.plans[1].temporary, fixture.plans[1].target);
  assert.equal(recoverInterruptedTransaction(fixture.dataDir), "rolled-back");
  assertTargets(fixture, "old");
  assertClean(fixture);
});

withFixture("committed", fixture => {
  seedPreparedTransaction(fixture);
  fixture.plans.forEach(plan => {
    fs.renameSync(plan.target, plan.backup);
    fs.renameSync(plan.temporary, plan.target);
  });
  writeExclusiveDurable(fixture.marker, Buffer.from("committed\n", "utf8"));
  assert.equal(recoverInterruptedTransaction(fixture.dataDir), "committed-cleaned");
  assertTargets(fixture, "new");
  assertClean(fixture);
});

withFixture("corrupt", fixture => {
  seedPreparedTransaction(fixture);
  fixture.plans.forEach(plan => {
    fs.renameSync(plan.target, plan.backup);
    fs.renameSync(plan.temporary, plan.target);
  });
  fs.writeFileSync(fixture.plans[0].target, "corrupted\n", "utf8");
  writeExclusiveDurable(fixture.marker, Buffer.from("committed\n", "utf8"));
  assert.throws(() => recoverInterruptedTransaction(fixture.dataDir), /committed target digest mismatch/);
  assert.equal(fs.existsSync(fixture.journal), true, "failed recovery must retain its journal");
  assert.equal(fs.existsSync(fixture.marker), true, "failed recovery must retain its commit marker");
});

const originalReadDirectory = fs.readdirSync;
try {
  fs.readdirSync = function mockedReadDirectory(directory, options) {
    if (directory !== "synthetic-stage") return originalReadDirectory.call(fs, directory, options);
    return EXPECTED_NAMES.map((name, index) => ({
      name,
      isFile() { return index !== 0; },
      isSymbolicLink() { return index === 0; }
    }));
  };
  assert.throws(() => assertStagingFiles("synthetic-stage"), /regular rotated bank files|non-symlink/);
} finally {
  fs.readdirSync = originalReadDirectory;
}

const canonicalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skillcheck-promoter-path-"));
try {
  const realDirectory = path.join(canonicalRoot, "real-data");
  const junctionDirectory = path.join(canonicalRoot, "data-junction");
  fs.mkdirSync(realDirectory);
  assert.equal(assertCanonicalDirectory(realDirectory, realDirectory, canonicalRoot, "Fixture data"),
    fs.realpathSync.native(realDirectory));
  fs.symlinkSync(realDirectory, junctionDirectory, "junction");
  assert.throws(() => assertCanonicalDirectory(junctionDirectory, junctionDirectory, canonicalRoot, "Fixture data"),
    /regular directory|canonical location/);
} finally {
  fs.rmSync(canonicalRoot, { recursive: true, force: true });
}

console.log("Rotation promoter tests passed: path hardening and crash recovery are fail-closed.");
