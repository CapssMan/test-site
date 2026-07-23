#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  SPECS, ROTATION_BASELINE_COMMIT, ROTATION_RELEASE_ID, validateSource, buildBank, versionSlug
} = require("./build-rotated-banks.js");

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function argumentsFrom(argv) {
  const result = { sourceDir: "", privateDir: "", publicDir: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`${name} requires a value`);
    if (name === "--source-dir") result.sourceDir = path.resolve(value);
    else if (name === "--private-dir") result.privateDir = path.resolve(value);
    else if (name === "--public-dir") result.publicDir = path.resolve(value);
    else throw new Error(`Unknown argument: ${name}`);
  }
  if (!result.sourceDir || !result.privateDir || !result.publicDir) {
    throw new Error("--source-dir, --private-dir and --public-dir are required");
  }
  return result;
}

function assertNoPrivateFields(value, location) {
  const forbidden = new Set(["correct", "correctIndex", "correctOptionId", "comment", "rationale", "answer"]);
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoPrivateFields(item, `${location}[${index}]`));
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(key => {
    assert(!forbidden.has(key), `${location}.${key} leaks private authoring data`);
    assertNoPrivateFields(value[key], `${location}.${key}`);
  });
}

function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(path.join(args.privateDir, "rotation-manifest.json"), "utf8"));
  const pending = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-rotation-pending.v4.json"), "utf8"));
  const anchors = JSON.parse(fs.readFileSync(path.join(args.privateDir, "private-bank-anchors.v4.json"), "utf8"));
  assert.equal(pending.rotationId, ROTATION_RELEASE_ID);
  assert.equal(manifest.rotationBaselineCommit, ROTATION_BASELINE_COMMIT);
  assert.equal(manifest.banks.length, Object.keys(SPECS).length);
  let questions = 0;

  Object.entries(SPECS).forEach(([testId, spec]) => {
    const source = JSON.parse(fs.readFileSync(path.join(args.sourceDir, `${testId}.rotation-source.json`), "utf8"));
    const baseline = JSON.parse(execFileSync("git", ["show", `${ROTATION_BASELINE_COMMIT}:data/${testId}.json`], {
      cwd: path.resolve(__dirname, ".."), windowsHide: true
    }).toString("utf8"));
    validateSource(source, testId, spec, baseline);
    const built = buildBank(source, testId, spec, baseline);
    const publicBank = JSON.parse(fs.readFileSync(path.join(args.publicDir, `${testId}.json`), "utf8"));
    const privatePath = path.join(args.privateDir, testId, `${versionSlug(spec.version)}.json`);
    const privateText = fs.readFileSync(privatePath, "utf8");
    const privateBank = JSON.parse(privateText);
    assert.deepEqual(publicBank, built.publicBank, `${testId}: public artifact is not deterministic`);
    assert.deepEqual(privateBank, built.privateBank, `${testId}: private artifact is not deterministic`);
    assertNoPrivateFields(publicBank, testId);
    const privateDigest = sha256Hex(Buffer.from(JSON.stringify(privateBank), "utf8"));
    assert.equal(pending.banks[testId].privateDigest, privateDigest);
    assert.equal(anchors[`${testId}|${spec.version}`], privateDigest);
    assert.equal(pending.banks[testId].publicDigest, publicBank.publicDigest);
    questions += publicBank.questions.length;
  });

  console.log(`Rotated artifact verification passed: release=${ROTATION_RELEASE_ID} banks=${Object.keys(SPECS).length} questions=${questions}.`);
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}
