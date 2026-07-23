#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dataDirectory = path.join(root, "data");
const migrationPath = path.join(root, "scripts", "migrate-public-banks-10a.js");
const migrationSource = fs.readFileSync(migrationPath, "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");

const CANONICAL_BANK_KEYS = [
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt", "blocks", "questions"
];
const PUBLIC_BANK_KEYS = CANONICAL_BANK_KEYS.concat("publicDigest");
const QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context", "options"
];
const OPTION_KEYS = ["id", "text"];
const FORBIDDEN_NORMALIZED_KEYS = new Set([
  "correct", "correctindex", "correctanswer", "correctoption", "correctoptionid", "iscorrect",
  "answer", "answerkey", "comment", "explanation", "rationale", "solution", "solutions", "private", "privatekey"
]);

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionId(testId, questionId, text) {
  return "opt_" + sha256Hex(`skillcheck-option-v1|${testId}|${questionId}|${text}`).slice(0, 20);
}

function exactKeys(value, expected, location) {
  assert.deepEqual(Object.keys(value), expected, location + " has an unexpected schema/key order");
}

function assertNoForbiddenKeys(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(key => {
    const normalized = String(key).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    assert(!FORBIDDEN_NORMALIZED_KEYS.has(normalized) && !normalized.startsWith("private"),
      `${location}.${key} leaks an answer/private field`);
    assertNoForbiddenKeys(value[key], `${location}.${key}`);
  });
}

function canonicalPublicBank(bank) {
  const result = {};
  CANONICAL_BANK_KEYS.forEach(key => { result[key] = bank[key]; });
  return result;
}

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = backend.indexOf(marker);
  assert(start >= 0, "Backend function not found: " + name);
  const next = backend.indexOf("\nfunction ", start + marker.length);
  return backend.slice(start, next < 0 ? backend.length : next).trim();
}

const specs = {
  "fa-junior": { version: "FA Junior v4.0", count: 40, prefix: "fa4" },
  "ca-junior": { version: "CA Junior v4.0", count: 80, prefix: "ca4" },
  "fpa-junior": { version: "FP&A Junior v4.0", count: 40, prefix: "fpa4" },
  "acc-junior": { version: "ACC Junior v4.0", count: 40, prefix: "acc4" },
  "bi-junior": { version: "BI Junior v4.0", count: 40, prefix: "bi4" },
  "dev-quick": { version: "DEV Quick v2.0", count: 1, prefix: "dev_quick" }
};
const bankFiles = fs.readdirSync(dataDirectory).filter(name => name.endsWith(".json")).sort();
assert.deepEqual(bankFiles,
  ["acc-junior.json", "bi-junior.json", "ca-junior.json", "dev-quick.json", "fa-junior.json", "fpa-junior.json"]);

const banks = bankFiles.map(fileName => ({
  fileName,
  bank: JSON.parse(fs.readFileSync(path.join(dataDirectory, fileName), "utf8"))
}));
banks.forEach(({ fileName, bank }) => {
  const spec = specs[bank.testId];
  assert(spec, fileName + " has an unknown test id");
  exactKeys(bank, PUBLIC_BANK_KEYS, fileName);
  assert.equal(bank.schemaVersion, 2);
  assert.equal(bank.testVersion, spec.version);
  assert.equal(bank.bankVersion, spec.version);
  assert.equal(bank.questions.length, spec.count);
  assert.equal(bank.publicDigest, sha256Hex(JSON.stringify(canonicalPublicBank(bank))));
  assertNoForbiddenKeys(bank, fileName);
  const seenQuestions = new Set();
  const seenOptions = new Set();
  bank.questions.forEach((question, index) => {
    exactKeys(question, QUESTION_KEYS, `${fileName}.questions[${index}]`);
    assert.equal(question.id, `${spec.prefix}_${String(index + 1).padStart(3, "0")}`);
    assert(!seenQuestions.has(question.id));
    seenQuestions.add(question.id);
    assert.equal(question.options.length, 4);
    const ids = question.options.map(option => option.id);
    assert.deepEqual(ids, ids.slice().sort());
    question.options.forEach(option => {
      exactKeys(option, OPTION_KEYS, `${fileName}/${question.id}/${option.id}`);
      assert.equal(option.id, optionId(bank.testId, question.id, option.text));
      assert(!seenOptions.has(option.id));
      seenOptions.add(option.id);
    });
  });
});

// Historical v3 migration remains a frozen regression helper for the public/private
// schema only. Production v4 can never be generated from this legacy path.
const migrationBody = migrationSource.slice(0, migrationSource.lastIndexOf("try {\n  main();"));
const migrationContext = {
  require,
  __dirname: path.dirname(migrationPath),
  process: { argv: [], exitCode: 0 },
  console: { log() {}, error() {} }
};
vm.createContext(migrationContext);
vm.runInContext(migrationBody + "\nthis.__migration = { BANK_SPECS, migrateLegacyBank };", migrationContext);
const legacy = {
  testId: "dev-quick", version: "Dev Quick Smoke Test v1.0", totalQuestions: 1, questionsPerTest: 1,
  blocks: { smoke: "Smoke" },
  questions: [{
    id: "dev_quick_001", topic: "Fixture", block: "smoke", difficulty: "easy", timeLimit: 60,
    points: 100, text: "Synthetic fixture", context: "No answer here",
    options: ["Zulu", "Alpha", "Mike", "Bravo"], correct: 2, comment: "private rationale"
  }]
};
migrationContext.__legacyJson = JSON.stringify(legacy);
vm.runInContext("this.__legacy = JSON.parse(__legacyJson);", migrationContext);
const migrated = migrationContext.__migration.migrateLegacyBank(
  migrationContext.__legacy, migrationContext.__migration.BANK_SPECS["dev-quick"], "synthetic.json"
);
assertNoForbiddenKeys(migrated.publicBank, "synthetic.publicBank");
assert.equal(migrated.privateBank.questions[0].comment, "private rationale");
assert.equal(migrated.privateBank.questions[0].correctOptionId, optionId("dev-quick", "dev_quick_001", "Mike"));
assert.deepEqual(migrated.publicBank.questions[0].options, migrated.privateBank.questions[0].options);

const privateAnchorState = { source: null };
const backendContext = {
  String, Number, Boolean, Array, Math, Error,
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" },
    computeDigest(_algorithm, source) {
      return Array.from(crypto.createHash("sha256").update(String(source), "utf8").digest())
        .map(value => value > 127 ? value - 256 : value);
    }
  },
  timingSafeEqual(left, right) { return String(left || "") === String(right || ""); },
  getScriptProperty(name) {
    assert.equal(name, "PRIVATE_BANK_DIGESTS_V1");
    return privateAnchorState.source;
  }
};
vm.createContext(backendContext);
const privateFunctions = [
  "isPlainObject", "sha256Hex", "normalizeAuthoritativeQuestionId", "buildAuthoritativeOptionId",
  "buildAuthoritativePublicBank", "calculateAuthoritativePublicDigest", "assertExactPrivateKeys",
  "assertAllowedLegacyKeys", "getExpectedAuthoritativeQuestionId", "validateAuthoritativePrivateBankObject",
  "getPrivateBankAnchorKey", "getPrivateBankArtifactDigest", "parsePrivateBankTrustAnchors",
  "assertPrivateBankTrustAnchor", "loadAuthoritativePrivateBankShapeOnly", "buildPrivateBankFromLegacySource"
];
vm.runInContext(`
  const OPTION_ID_NAMESPACE = "skillcheck-option-v1";
  const BANK_VERSIONS_BY_ID = { "dev-quick": "DEV Quick v2.0" };
  const TEST_VERSIONS_BY_ID_AUTHORITATIVE = BANK_VERSIONS_BY_ID;
  const LEGACY_BANK_VERSIONS_BY_TEST_ID = { "dev-quick": "Dev Quick Smoke Test v1.0" };
  const EXPECTED_ANSWERS_BY_TEST_ID = { "dev-quick": 1 };
  const EXPECTED_BANK_QUESTIONS_BY_TEST_ID = { "dev-quick": 1 };
  const ALLOWED_BLOCKS_BY_TEST_ID = { "dev-quick": ["smoke"] };
` + privateFunctions.map(extractFunction).join("\n\n") +
  "\nthis.__privateApi = { buildPrivateBankFromLegacySource, validateAuthoritativePrivateBankObject, assertPrivateBankTrustAnchor, getPrivateBankArtifactDigest, getPrivateBankAnchorKey };",
backendContext, { filename: path.join(root, "apps-script", "Code.gs") });
backendContext.__legacyJson = JSON.stringify(legacy);
const privateBank = vm.runInContext("buildPrivateBankFromLegacySource('dev-quick', JSON.parse(__legacyJson))", backendContext);
backendContext.__privateBank = privateBank;
vm.runInContext("validateAuthoritativePrivateBankObject(__privateBank, 'dev-quick', 'DEV Quick v2.0')", backendContext);
const anchorKey = backendContext.__privateApi.getPrivateBankAnchorKey("dev-quick", "DEV Quick v2.0");
const anchorDigest = backendContext.__privateApi.getPrivateBankArtifactDigest(privateBank);
privateAnchorState.source = JSON.stringify({ [anchorKey]: anchorDigest });
vm.runInContext("assertPrivateBankTrustAnchor(__privateBank)", backendContext);
const tampered = cloneJson(privateBank);
tampered.questions[0].correctOptionId = tampered.questions[0].options.find(option => option.id !== tampered.questions[0].correctOptionId).id;
backendContext.__tampered = tampered;
assert.throws(() => vm.runInContext("assertPrivateBankTrustAnchor(__tampered)", backendContext), /anchor mismatch/i);

const bootstrapSource = extractFunction("bootstrapAuthoritativeBanksFromLegacyPages");
assert.match(bootstrapSource, /permanently disabled after the v4 content rotation/);
assert.doesNotMatch(bootstrapSource, /UrlFetchApp|writeJsonToYandexDisk/);
assert.match(extractFunction("buildPrivateBankFromLegacySource"), /testId !== "dev-quick"/);

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
tracked.forEach(fileName => {
  const normalized = fileName.replace(/\\/g, "/").toLowerCase();
  assert(!/private\/banks\//.test(normalized), fileName + " must not track private banks");
  assert(!normalized.endsWith(".rotation-source.json"), fileName + " must not track authoring sources");
  assert(!/(^|\/)(invites-v1|attempt-sessions-v1|attempts)\.json$/.test(normalized));
  assert(!/(^|\/)\.clasp\.json$/.test(normalized));
});
const trackedText = tracked.filter(name => /\.(?:js|gs|html|md|json|txt)$/i.test(name))
  .map(name => fs.readFileSync(path.join(root, name), "utf8")).join("\n");
assert.doesNotMatch(trackedText, /OAuth\s+[A-Za-z0-9_-]{35,}/);
assert.doesNotMatch(trackedText, /ya29\.[A-Za-z0-9_-]{20,}/);
assert.doesNotMatch(trackedText, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
assert.match(backend, /const PUBLIC_DEV_TEST_ENABLED = false;/);
assert.doesNotMatch(candidate, /localStorage\.setItem\([^\n]*(?:attemptToken|inviteCode|email|answers)/i);

console.log(`Public-bank secrecy tests passed (${banks.length} banks, ${banks.reduce((sum, item) => sum + item.bank.questions.length, 0)} questions).`);
