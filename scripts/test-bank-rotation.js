#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  SPECS, ROTATION_BASELINE_COMMIT, ROTATION_RELEASE_ID, validateSource, buildBank, canonicalPublic, parseArguments
} = require("./build-rotated-banks.js");

const root = path.resolve(__dirname, "..");
const dataDirectory = path.join(root, "data");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const builder = fs.readFileSync(path.join(root, "scripts", "build-rotated-banks.js"), "utf8");
const promoter = fs.readFileSync(path.join(root, "scripts", "promote-rotated-public-banks.js"), "utf8");

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function tokens(value) {
  return new Set(normalizeText(value).replace(/[^\p{L}\p{N}%]+/gu, " ").split(" ").filter(token => token.length > 2));
}

function jaccard(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  let intersection = 0;
  a.forEach(token => { if (b.has(token)) intersection += 1; });
  return a.size || b.size ? intersection / (a.size + b.size - intersection) : 1;
}

function gitJson(revision, fileName) {
  return JSON.parse(execFileSync("git", ["show", `${revision}:data/${fileName}`], {
    cwd: root,
    windowsHide: true
  }).toString("utf8"));
}

assert.equal(ROTATION_BASELINE_COMMIT, "14b914ff32570218c95ae2a2f03e96a64a60e5a1");
execFileSync("git", ["cat-file", "-e", `${ROTATION_BASELINE_COMMIT}^{commit}`], { cwd: root, windowsHide: true });

let rotatedQuestionCount = 0;
Object.entries(SPECS).forEach(([testId, spec]) => {
  const fileName = `${testId}.json`;
  const current = JSON.parse(fs.readFileSync(path.join(dataDirectory, fileName), "utf8"));
  const baseline = gitJson(ROTATION_BASELINE_COMMIT, fileName);
  rotatedQuestionCount += current.questions.length;

  assert.equal(current.testVersion, spec.version, `${testId} test version must be rotated`);
  assert.equal(current.bankVersion, spec.version, `${testId} bank version must be rotated`);
  assert.equal(current.questions.length, spec.count, `${testId} rotated pool size changed unexpectedly`);
  assert.equal(current.questionsPerAttempt, spec.attempt, `${testId} attempt size changed unexpectedly`);
  assert.notEqual(current.publicDigest, baseline.publicDigest, `${testId} public digest did not rotate`);
  assert.equal(current.publicDigest, sha256Hex(JSON.stringify(canonicalPublic(current))));
  assert.deepEqual(
    current.questions.map(question => question.id),
    Array.from({ length: spec.count }, (_, index) => `${spec.idPrefix}_${String(index + 1).padStart(3, "0")}`)
  );

  const oldQuestionIds = new Set(baseline.questions.map(question => String(question.id)));
  const oldOptionIds = new Set(baseline.questions.flatMap(question => question.options.map(option => option.id)));
  const oldQuestionTexts = new Set(baseline.questions.map(question => normalizeText(question.text)));
  const oldOptionTexts = new Set(baseline.questions.flatMap(question => question.options.map(option => normalizeText(option.text))));
  const similarities = [];
  current.questions.forEach(question => {
    assert(!oldQuestionIds.has(question.id), `${testId}/${question.id} reuses a compromised question id`);
    assert(!oldQuestionTexts.has(normalizeText(question.text)), `${testId}/${question.id} reuses compromised prompt text`);
    const maximum = baseline.questions.reduce((value, oldQuestion) => Math.max(value, jaccard(question.text, oldQuestion.text)), 0);
    assert(maximum < 0.78, `${testId}/${question.id} is too close to a compromised prompt (${maximum.toFixed(3)})`);
    similarities.push(maximum);
    question.options.forEach(option => {
      assert(!oldOptionIds.has(option.id), `${testId}/${question.id} reuses a compromised option id`);
      assert(!oldOptionTexts.has(normalizeText(option.text)), `${testId}/${question.id} reuses compromised option text`);
    });
  });
  assert(similarities.reduce((sum, value) => sum + value, 0) / similarities.length < 0.55);
});
assert.equal(rotatedQuestionCount, 240, "all 240 production questions must rotate together");
assert.deepEqual(
  JSON.parse(fs.readFileSync(path.join(dataDirectory, "dev-quick.json"), "utf8")),
  gitJson(ROTATION_BASELINE_COMMIT, "dev-quick.json"),
  "dev-quick is a frozen smoke fixture and must not rotate with production content"
);

const bootstrapStart = backend.indexOf("function bootstrapAuthoritativeBanksFromLegacyPages(");
const bootstrapEnd = backend.indexOf("\nfunction ", bootstrapStart + 20);
const bootstrapSource = backend.slice(bootstrapStart, bootstrapEnd);
assert.match(bootstrapSource, /permanently disabled after the v4 content rotation/);
assert.doesNotMatch(bootstrapSource, /UrlFetchApp|writeJsonToYandexDisk|PRIVATE_BANK_DIGESTS_V1/);
const legacyBuilderStart = backend.indexOf("function buildPrivateBankFromLegacySource(");
const legacyBuilderEnd = backend.indexOf("\nfunction ", legacyBuilderStart + 20);
assert.match(backend.slice(legacyBuilderStart, legacyBuilderEnd), /testId !== "dev-quick"/);
assert.equal(ROTATION_RELEASE_ID, "rotation-v4-2026-07-21-r3");
assert.match(backend, new RegExp(`const CURRENT_PUBLIC_BANK_RELEASE_ID = "${ROTATION_RELEASE_ID}"`));
const issuanceStart = backend.indexOf("function setAuthoritativeAttemptIssuanceEnabled(");
const issuanceEnd = backend.indexOf("\nfunction ", issuanceStart + 20);
assert.match(backend.slice(issuanceStart, issuanceEnd), /PUBLIC_BANK_RELEASE_PROPERTY[\s\S]*CURRENT_PUBLIC_BANK_RELEASE_ID/,
  "issuance must require an explicit attestation for the live public v4 release");
[
  "parsePendingPrivateBankRotation", "verifyPrivateBankRotationForOwner",
  "promotePrivateBankRotationForOwner", "abortPrivateBankRotationForOwner"
].forEach(functionName => assert.match(backend, new RegExp(`function ${functionName}\\(`)));
assert.match(promoter, /function recoverInterruptedTransaction\(/);
assert.match(promoter, /COMMIT_MARKER_FILE/);
assert.match(promoter, /oldSha256/);
assert.match(promoter, /newSha256/);
assert.match(builder, /realpathSync\.native/);
assert.match(builder, /flag: "wx"/);

function extractBackendFunction(name) {
  const marker = `function ${name}(`;
  const start = backend.indexOf(marker);
  assert(start >= 0, "Backend function not found: " + name);
  const next = backend.indexOf("\nfunction ", start + marker.length);
  return backend.slice(start, next < 0 ? backend.length : next).trim();
}

const drainContext = {
  Date,
  AUTHORITATIVE_RECOVERY_TTL_MS: 24 * 60 * 60 * 1000,
  sessions: [],
  invites: [],
  getAttemptSessionsFilePath() { return "sessions"; },
  getInvitesFilePath() { return "invites"; },
  readRequiredJsonArray(pathName) { return pathName === "sessions" ? drainContext.sessions : drainContext.invites; }
};
vm.createContext(drainContext);
vm.runInContext(extractBackendFunction("assertPrivateBankRotationHasNoLiveAttempts") +
  "\nthis.__assertDrained = assertPrivateBankRotationHasNoLiveAttempts;", drainContext);
drainContext.sessions = [];
drainContext.invites = [];
drainContext.__assertDrained();
drainContext.sessions = [{ state: "active", tokenExpiresAt: new Date(Date.now() + 60000).toISOString() }];
assert.throws(() => drainContext.__assertDrained(), /drained or revoked/);
drainContext.sessions = [{ state: "active", tokenExpiresAt: new Date(Date.now() - 60000).toISOString() }];
drainContext.__assertDrained();
drainContext.sessions = [{ state: "reserved", reservedAt: new Date().toISOString() }];
assert.throws(() => drainContext.__assertDrained(), /drained or revoked/);
drainContext.sessions = [];
drainContext.invites = [{ state: "issued", expiresAt: new Date(Date.now() + 60000).toISOString() }];
assert.throws(() => drainContext.__assertDrained(), /drained or revoked/);

const promotionState = { writes: [], deletes: [], failVerification: false };
const promotionBanks = Object.entries(SPECS).map(([testId, spec]) => ({
  testId,
  bankVersion: spec.version,
  privateDigest: sha256Hex(`private:${testId}`)
}));
const promotionContext = {
  BACKEND_VERSION: "rotation-test",
  PRIVATE_BANK_ROTATION_PENDING_PROPERTY: "PRIVATE_BANK_ROTATION_PENDING_V1",
  LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  parsePendingPrivateBankRotation() { return { rotationId: "rotation-v4-unit", banks: {} }; },
  verifyPendingPrivateBankRotationUnlocked() {
    if (promotionState.failVerification) throw new Error("verification failed");
    return { banks: promotionBanks };
  },
  parsePrivateBankTrustAnchors() { return { "dev-quick|DEV Quick v2.0": "a".repeat(64) }; },
  getPrivateBankAnchorKey(testId, version) { return `${testId}|${version}`; },
  timingSafeEqual(left, right) { return String(left) === String(right); },
  PropertiesService: {
    getScriptProperties() {
      return {
        setProperty(name, value) { promotionState.writes.push({ name, value }); },
        deleteProperty(name) { promotionState.deletes.push(name); }
      };
    }
  }
};
vm.createContext(promotionContext);
vm.runInContext(extractBackendFunction("promotePrivateBankRotationForOwner") +
  "\nthis.__promoteRotation = promotePrivateBankRotationForOwner;", promotionContext);
const promotionResult = promotionContext.__promoteRotation();
assert.equal(promotionResult.status, "promoted");
assert.equal(promotionState.writes.length, 1, "anchor promotion must be one Script Property write");
const promotedAnchors = JSON.parse(promotionState.writes[0].value);
assert.equal(Object.keys(promotedAnchors).length, 6, "old anchors plus all five v4 anchors must be committed together");
promotionBanks.forEach(bank => assert.equal(promotedAnchors[`${bank.testId}|${bank.bankVersion}`], bank.privateDigest));
assert.deepEqual(promotionState.deletes, ["PRIVATE_BANK_ROTATION_PENDING_V1"]);
promotionState.failVerification = true;
assert.throws(() => promotionContext.__promoteRotation(), /verification failed/);
assert.equal(promotionState.writes.length, 1, "failed verification must leave anchors unchanged");

const syntheticSpec = {
  version: "Synthetic v4.0", count: 1, attempt: 1, idPrefix: "syn4", blocks: ["core"]
};
const syntheticBaseline = {
  questions: [{ id: "syn_001", text: "Legacy prompt about a red ledger", options: [
    { id: "opt_old_a", text: "Legacy alpha" }, { id: "opt_old_b", text: "Legacy beta" },
    { id: "opt_old_c", text: "Legacy gamma" }, { id: "opt_old_d", text: "Legacy delta" }
  ] }]
};
const syntheticSource = {
  schemaVersion: 2,
  testId: "synthetic",
  testVersion: "Synthetic v4.0",
  bankVersion: "Synthetic v4.0",
  questionsPerAttempt: 1,
  blocks: { core: "Core" },
  questions: [{
    id: "syn4_001", topic: "Fixture", block: "core", difficulty: "case", timeLimit: 60,
    points: 1, text: "A new reconciliation scenario uses blue invoices and a timing difference.",
    context: "Invoice register and bank statement have different cut-off dates.",
    options: [
      "Apply the documented cut-off rule",
      "Delete the unmatched register row",
      "Average the two reported balances",
      "Ignore the delayed cash settlement"
    ],
    correctIndex: 0, comment: "The cut-off date explains the timing difference."
  }]
};
validateSource(syntheticSource, "synthetic", syntheticSpec, syntheticBaseline);
const builtA = buildBank(syntheticSource, "synthetic", syntheticSpec, syntheticBaseline);
const builtB = buildBank(syntheticSource, "synthetic", syntheticSpec, syntheticBaseline);
assert.deepEqual(builtA, builtB, "rotated generation must be deterministic");
assert.equal(builtA.privateBank.publicDigest, builtA.publicBank.publicDigest);
assert.equal(builtA.privateBank.questions[0].correctOptionId,
  builtA.privateBank.questions[0].options.find(option => option.text === syntheticSource.questions[0].options[0]).id);
assert.throws(() => validateSource({ ...syntheticSource, questions: [] }, "synthetic", syntheticSpec, syntheticBaseline));
const nearDuplicate = JSON.parse(JSON.stringify(syntheticSource));
nearDuplicate.questions[0].text = syntheticBaseline.questions[0].text;
assert.throws(() => validateSource(nearDuplicate, "synthetic", syntheticSpec, syntheticBaseline), /duplicated|reused/);
const lengthLeak = JSON.parse(JSON.stringify(syntheticSource));
lengthLeak.questions[0].options[0] += " with an excessively detailed explanation that reveals the keyed choice";
assert.throws(() => validateSource(lengthLeak, "synthetic", syntheticSpec, syntheticBaseline), /answer-length side channel/);
assert.throws(() => parseArguments([
  "--source-dir", root,
  "--private-out", path.join(os.tmpdir(), "skillcheck-private-refusal"),
  "--public-stage", path.join(os.tmpdir(), "skillcheck-public-refusal")
]), /outside the Git worktree/);
assert.throws(() => parseArguments([
  "--source-dir", path.join(root, "..stage"),
  "--private-out", path.join(os.tmpdir(), "skillcheck-private-boundary-refusal"),
  "--public-stage", path.join(os.tmpdir(), "skillcheck-public-boundary-refusal")
]), /outside the Git worktree/, "a child named ..stage must not bypass containment");

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
tracked.forEach(fileName => {
  const normalized = fileName.replace(/\\/g, "/").toLowerCase();
  assert(!normalized.endsWith(".rotation-source.json"), `${fileName} exposes rotation authoring data`);
  assert(!/(^|\/)rotation-source\//.test(normalized), `${fileName} exposes rotation authoring data`);
  assert(!/(^|\/)private-banks\//.test(normalized), `${fileName} exposes private bank data`);
});

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skillcheck-rotation-fail-"));
const incompleteSource = path.join(temporaryRoot, "source");
const privateOut = path.join(temporaryRoot, "private");
const publicStage = path.join(temporaryRoot, "public");
fs.mkdirSync(incompleteSource);
fs.writeFileSync(path.join(incompleteSource, "fa-junior.rotation-source.json"), "{}\n", "utf8");
const failedBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-rotated-banks.js"),
  "--source-dir", incompleteSource, "--private-out", privateOut, "--public-stage", publicStage
], { cwd: root, encoding: "utf8", windowsHide: true });
assert.notEqual(failedBuild.status, 0, "incomplete rotation source must fail");
assert.equal(fs.existsSync(privateOut), false, "failed validation must not create private output");
assert.equal(fs.existsSync(publicStage), false, "failed validation must not create public staging");
fs.rmSync(temporaryRoot, { recursive: true, force: true });

console.log("Content rotation tests passed: five v4 banks, 240 new questions, frozen dev fixture.");
