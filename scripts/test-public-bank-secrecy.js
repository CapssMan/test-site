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
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions"
];
const PUBLIC_BANK_KEYS = CANONICAL_BANK_KEYS.concat("publicDigest");
const QUESTION_KEYS = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text",
  "context", "options"
];
const OPTION_KEYS = ["id", "text"];
const FORBIDDEN_NORMALIZED_KEYS = new Set([
  "correct", "correctindex", "correctanswer", "correctoption", "correctoptionid",
  "iscorrect", "answer", "answerkey", "comment", "explanation", "rationale",
  "solution", "solutions", "private", "privatekey"
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

function normalizedKey(value) {
  return String(value).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function assertExactKeyOrder(value, expected, location) {
  assert.deepEqual(Object.keys(value), expected, location + " has an unexpected schema/key order");
}

function assertNoForbiddenKeys(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.keys(value).forEach(key => {
    const normalized = normalizedKey(key);
    assert(
      !FORBIDDEN_NORMALIZED_KEYS.has(normalized) && !normalized.startsWith("private"),
      `${location}.${key} leaks an answer/private field`
    );
    assertNoForbiddenKeys(value[key], `${location}.${key}`);
  });
}

function canonicalPublicBank(bank) {
  const canonical = {};
  CANONICAL_BANK_KEYS.forEach(key => {
    canonical[key] = bank[key];
  });
  return canonical;
}

const bankFiles = fs.readdirSync(dataDirectory).filter(name => name.endsWith(".json")).sort();
assert.deepEqual(
  bankFiles,
  ["acc-junior.json", "bi-junior.json", "ca-junior.json", "dev-quick.json", "fa-junior.json", "fpa-junior.json"],
  "only the six intentional public banks may be shipped"
);

const banks = bankFiles.map(fileName => ({
  fileName,
  bank: JSON.parse(fs.readFileSync(path.join(dataDirectory, fileName), "utf8"))
}));

banks.forEach(({ fileName, bank }) => {
  assertExactKeyOrder(bank, PUBLIC_BANK_KEYS, fileName);
  assert.equal(bank.schemaVersion, 2, fileName + " must use public schema v2");
  assert.equal(bank.testVersion, bank.bankVersion, fileName + " versions must be identical");
  assert.match(bank.publicDigest, /^[a-f0-9]{64}$/, fileName + " needs a SHA-256 public digest");
  assert.equal(
    bank.publicDigest,
    sha256Hex(JSON.stringify(canonicalPublicBank(bank))),
    fileName + " publicDigest must cover the canonical public payload and exclude itself"
  );
  assertNoForbiddenKeys(bank, fileName);
  assert(Array.isArray(bank.questions) && bank.questions.length > 0, fileName + " must contain questions");

  const seenQuestions = new Set();
  const seenOptions = new Set();
  bank.questions.forEach((question, questionIndex) => {
    const location = `${fileName}.questions[${questionIndex}]`;
    assertExactKeyOrder(question, QUESTION_KEYS, location);
    assert(!seenQuestions.has(question.id), location + " duplicates a question id");
    seenQuestions.add(question.id);
    assert.equal(question.options.length, 4, location + " must expose exactly four opaque options");
    const optionIds = question.options.map(option => option.id);
    assert.deepEqual(optionIds, optionIds.slice().sort(), location + " option ids must be sorted");
    question.options.forEach((option, optionIndex) => {
      const optionLocation = `${location}.options[${optionIndex}]`;
      assertExactKeyOrder(option, OPTION_KEYS, optionLocation);
      assert.equal(option.id, optionId(bank.testId, question.id, option.text), optionLocation + " id is not deterministic");
      assert(!seenOptions.has(option.id), optionLocation + " duplicates an option id");
      seenOptions.add(option.id);
    });
  });
});

const caBank = banks.find(item => item.bank.testId === "ca-junior").bank;
assert.equal(caBank.questions.length, 80, "CA public bank must expose the complete 80-question pool");
assert.equal(caBank.questionsPerAttempt, 40, "CA attempt manifest must select exactly 40 of 80 questions");
assert.deepEqual(
  caBank.questions.map(question => question.id),
  Array.from({ length: 80 }, (_, index) => `ca_${String(index + 1).padStart(3, "0")}`),
  "CA ids must be normalized and stable"
);

// Execute migration functions without running the CLI. This proves that a synthetic
// legacy bank yields public/private artifacts with identical display content and a
// private-only answer key.
const migrationBody = migrationSource.slice(0, migrationSource.lastIndexOf("try {\n  main();"));
const migrationContext = {
  require,
  __dirname: path.dirname(migrationPath),
  process: { argv: [], exitCode: 0 },
  console: { log() {}, error() {} }
};
vm.createContext(migrationContext);
vm.runInContext(
  migrationBody +
    "\nthis.__migration = { BANK_SPECS, migrateLegacyBank, createOptionId, sha256Hex };",
  migrationContext,
  { filename: migrationPath }
);
const migration = migrationContext.__migration;
const legacy = {
  testId: "dev-quick",
  version: "Dev Quick Smoke Test v1.0",
  totalQuestions: 1,
  questionsPerTest: 1,
  blocks: { smoke: "Smoke" },
  questions: [{
    id: "dev_quick_001",
    topic: "Fixture",
    block: "smoke",
    difficulty: "easy",
    timeLimit: 60,
    points: 100,
    text: "Synthetic fixture",
    context: "No answer here",
    options: ["Zulu", "Alpha", "Mike", "Bravo"],
    correct: 2,
    comment: "private rationale"
  }]
};
migrationContext.__legacyJson = JSON.stringify(legacy);
vm.runInContext("this.__legacy = JSON.parse(__legacyJson);", migrationContext);
const migrated = migration.migrateLegacyBank(migrationContext.__legacy, migration.BANK_SPECS["dev-quick"], "synthetic.json");
assertNoForbiddenKeys(migrated.publicBank, "synthetic.publicBank");
assert.equal(migrated.privateBank.schemaVersion, 2, "private artifact must extend public schema v2");
assert.equal(migrated.publicBank.publicDigest, migrated.privateBank.publicDigest, "public/private digests must match");
assert.equal(
  migrated.publicBank.publicDigest,
  sha256Hex(JSON.stringify(canonicalPublicBank(migrated.publicBank))),
  "synthetic digest must use the public canonical representation"
);
assert.equal(migrated.privateBank.questions[0].comment, "private rationale");
assert.equal(
  migrated.privateBank.questions[0].correctOptionId,
  optionId("dev-quick", "dev_quick_001", "Mike"),
  "legacy correct index must map to the opaque option id"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(migrated.publicBank.questions[0].options)),
  JSON.parse(JSON.stringify(migrated.privateBank.questions[0].options)),
  "public/private option manifests must stay identical"
);
assert.equal(migrated.privateBank.questions[0].options.length, 4, "private artifact must retain exactly four options");

// The offline migration and the Apps Script bootstrap must generate byte-for-byte
// equivalent private artifacts. Otherwise the immutable existing-bank parity gate
// could reject a valid cutover or, worse, score against a different answer key.
const backendParityContext = {
  String, Number, Boolean, Array, Math, Error,
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest(_algorithm, source) {
      return Array.from(crypto.createHash("sha256").update(String(source), "utf8").digest())
        .map(value => value > 127 ? value - 256 : value);
    }
  },
  timingSafeEqual(left, right) { return String(left || "") === String(right || ""); }
};
vm.createContext(backendParityContext);
const backendFunctions = [
  "isPlainObject", "sha256Hex", "normalizeAuthoritativeQuestionId", "buildAuthoritativeOptionId",
  "buildAuthoritativePublicBank", "calculateAuthoritativePublicDigest",
  "assertExactPrivateKeys", "assertAllowedLegacyKeys", "getExpectedAuthoritativeQuestionId",
  "validateAuthoritativePrivateBankObject",
  "loadAuthoritativePrivateBankShapeOnly", "buildPrivateBankFromLegacySource"
];
vm.runInContext(
  `
    const OPTION_ID_NAMESPACE = "skillcheck-option-v1";
    const BANK_VERSIONS_BY_ID = { "dev-quick": "DEV Quick v2.0" };
    const TEST_VERSIONS_BY_ID_AUTHORITATIVE = { "dev-quick": "DEV Quick v2.0" };
    const LEGACY_BANK_VERSIONS_BY_TEST_ID = { "dev-quick": "Dev Quick Smoke Test v1.0" };
    const EXPECTED_ANSWERS_BY_TEST_ID = { "dev-quick": 1 };
    const EXPECTED_BANK_QUESTIONS_BY_TEST_ID = { "dev-quick": 1 };
    const ALLOWED_BLOCKS_BY_TEST_ID = { "dev-quick": ["smoke"] };
  ` + backendFunctions.map(name => {
    const marker = "function " + name + "(";
    const start = backend.indexOf(marker);
    assert(start >= 0, "Backend parity function not found: " + name);
    const next = backend.indexOf("\nfunction ", start + marker.length);
    return backend.slice(start, next < 0 ? backend.length : next).trim();
  }).join("\n\n") +
    "\nthis.__backendBank = { buildPrivateBankFromLegacySource, loadAuthoritativePrivateBankShapeOnly };",
  backendParityContext,
  { filename: path.join(root, "apps-script", "Code.gs") }
);
backendParityContext.__legacyJson = JSON.stringify(legacy);
vm.runInContext(
  "this.__shapeValidator = loadAuthoritativePrivateBankShapeOnly; loadAuthoritativePrivateBankShapeOnly = function(bank) { return bank; };",
  backendParityContext
);
vm.runInContext(
  "this.__builtPrivate = buildPrivateBankFromLegacySource('dev-quick', JSON.parse(__legacyJson));",
  backendParityContext
);
vm.runInContext("loadAuthoritativePrivateBankShapeOnly = this.__shapeValidator;", backendParityContext);
const backendPrivate = backendParityContext.__builtPrivate;
const backendShapeDiagnostics = vm.runInContext(`({
  plain: isPlainObject(__builtPrivate),
  schema: __builtPrivate.schemaVersion,
  testVersion: __builtPrivate.testVersion,
  expectedTestVersion: TEST_VERSIONS_BY_ID_AUTHORITATIVE[__builtPrivate.testId],
  bankVersion: __builtPrivate.bankVersion,
  expectedBankVersion: BANK_VERSIONS_BY_ID[__builtPrivate.testId],
  questionCount: __builtPrivate.questions.length,
  expectedQuestionCount: EXPECTED_BANK_QUESTIONS_BY_TEST_ID[__builtPrivate.testId],
  optionCount: __builtPrivate.questions[0].options.length,
  correctPresent: __builtPrivate.questions[0].options.some(option => option.id === __builtPrivate.questions[0].correctOptionId)
})`, backendParityContext);
assert.equal(backendShapeDiagnostics.plain, true, JSON.stringify(backendShapeDiagnostics));
assert.equal(backendShapeDiagnostics.schema, 2, JSON.stringify(backendShapeDiagnostics));
assert.equal(backendShapeDiagnostics.testVersion, backendShapeDiagnostics.expectedTestVersion);
assert.equal(backendShapeDiagnostics.bankVersion, backendShapeDiagnostics.expectedBankVersion);
assert.equal(backendShapeDiagnostics.questionCount, backendShapeDiagnostics.expectedQuestionCount);
assert.equal(backendShapeDiagnostics.optionCount, 4);
assert.equal(backendShapeDiagnostics.correctPresent, true);
vm.runInContext("loadAuthoritativePrivateBankShapeOnly(__builtPrivate);", backendParityContext);
assert.deepEqual(
  JSON.parse(JSON.stringify(backendPrivate)),
  JSON.parse(JSON.stringify(migrated.privateBank)),
  "offline migration and backend bootstrap must produce the same schema/order/digest/answer key"
);

// Exercise the backend transformer against every legacy bank from the immutable
// pre-10A release, then compare its public projection with the checked-out banks.
const productionIds = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior", "dev-quick"];
const immutableCommitMatch = backend.match(/const LEGACY_PUBLIC_BANK_COMMIT = "([a-f0-9]{40})";/);
assert(immutableCommitMatch, "backend must pin the full immutable legacy commit");
const immutableCommit = immutableCommitMatch[1];
const digestMapMatch = backend.match(/const LEGACY_PUBLIC_BANK_SHA256_BY_TEST_ID = (\{[\s\S]*?\n\});/);
assert(digestMapMatch, "backend must contain the immutable legacy digest map");
const immutableDigests = JSON.parse(digestMapMatch[1]);
assert.deepEqual(Object.keys(immutableDigests).sort(), productionIds.slice().sort());
const legacyBankBytes = Object.fromEntries(productionIds.map(testId => [
  testId,
  execFileSync("git", ["show", `${immutableCommit}:data/${testId}.json`], { cwd: root })
]));
productionIds.forEach(testId => {
  assert.equal(
    crypto.createHash("sha256").update(legacyBankBytes[testId]).digest("hex"),
    immutableDigests[testId],
    testId + " immutable legacy bytes must match the backend bootstrap anchor"
  );
});
const legacyBanks = Object.fromEntries(productionIds.map(testId => [
  testId,
  JSON.parse(legacyBankBytes[testId].toString("utf8"))
]));
const versions = Object.fromEntries(banks.map(item => [item.bank.testId, item.bank.bankVersion]));
const legacyVersions = Object.fromEntries(productionIds.map(testId => [testId, legacyBanks[testId].version]));
const questionCounts = Object.fromEntries(productionIds.map(testId => [testId, legacyBanks[testId].questions.length]));
const attemptCounts = Object.fromEntries(banks.map(item => [item.bank.testId, item.bank.questionsPerAttempt]));
const allowedBlocks = Object.fromEntries(productionIds.map(testId => [testId, Object.keys(legacyBanks[testId].blocks)]));
let privateAnchorSource = null;
const fullBackendContext = {
  String, Number, Boolean, Array, Math, Error,
  Utilities: backendParityContext.Utilities,
  timingSafeEqual(left, right) { return String(left || "") === String(right || ""); },
  getScriptProperty(name) {
    assert.equal(name, "PRIVATE_BANK_DIGESTS_V1");
    return privateAnchorSource;
  }
};
vm.createContext(fullBackendContext);
const fullFunctions = [
  "isPlainObject", "sha256Hex", "normalizeAuthoritativeQuestionId", "buildAuthoritativeOptionId",
  "buildAuthoritativePublicBank", "calculateAuthoritativePublicDigest", "assertExactPrivateKeys",
  "assertAllowedLegacyKeys", "getExpectedAuthoritativeQuestionId", "validateAuthoritativePrivateBankObject",
  "getPrivateBankAnchorKey", "getPrivateBankArtifactDigest", "parsePrivateBankTrustAnchors",
  "assertPrivateBankTrustAnchor", "loadAuthoritativePrivateBankShapeOnly", "buildPrivateBankFromLegacySource"
];
vm.runInContext(
  `
    const OPTION_ID_NAMESPACE = "skillcheck-option-v1";
    const BANK_VERSIONS_BY_ID = ${JSON.stringify(versions)};
    const TEST_VERSIONS_BY_ID_AUTHORITATIVE = ${JSON.stringify(versions)};
    const LEGACY_BANK_VERSIONS_BY_TEST_ID = ${JSON.stringify(legacyVersions)};
    const EXPECTED_ANSWERS_BY_TEST_ID = ${JSON.stringify(attemptCounts)};
    const EXPECTED_BANK_QUESTIONS_BY_TEST_ID = ${JSON.stringify(questionCounts)};
    const ALLOWED_BLOCKS_BY_TEST_ID = ${JSON.stringify(allowedBlocks)};
  ` + fullFunctions.map(name => {
    const marker = "function " + name + "(";
    const start = backend.indexOf(marker);
    assert(start >= 0, "Full backend parity function not found: " + name);
    const next = backend.indexOf("\nfunction ", start + marker.length);
    return backend.slice(start, next < 0 ? backend.length : next).trim();
  }).join("\n\n") +
    "\nthis.__banks = { buildPrivateBankFromLegacySource, buildAuthoritativePublicBank, validateAuthoritativePrivateBankObject, assertPrivateBankTrustAnchor, getPrivateBankArtifactDigest, getPrivateBankAnchorKey };",
  fullBackendContext,
  { filename: path.join(root, "apps-script", "Code.gs") }
);

const generatedPrivateBanks = {};
productionIds.forEach(testId => {
  fullBackendContext.__sourceJson = JSON.stringify(legacyBanks[testId]);
  fullBackendContext.__testId = testId;
  vm.runInContext(
    "this.__generated = buildPrivateBankFromLegacySource(__testId, JSON.parse(__sourceJson));",
    fullBackendContext
  );
  const privateArtifact = JSON.parse(JSON.stringify(fullBackendContext.__generated));
  generatedPrivateBanks[testId] = privateArtifact;
  assert.equal(privateArtifact.schemaVersion, 2);
  assert(privateArtifact.questions.every(question => question.options.length === 4));
  const canonical = JSON.parse(JSON.stringify(fullBackendContext.__banks.buildAuthoritativePublicBank(fullBackendContext.__generated)));
  const projected = { ...canonical, publicDigest: privateArtifact.publicDigest };
  const checkedOut = banks.find(item => item.bank.testId === testId).bank;
  assert.deepEqual(projected, checkedOut, testId + " backend legacy transform must match the shipped public canonical/digest");
});

function expectLegacyReject(label, mutate) {
  const fixture = cloneJson(legacyBanks["dev-quick"]);
  mutate(fixture);
  fullBackendContext.__sourceJson = JSON.stringify(fixture);
  assert.throws(
    () => vm.runInContext("buildPrivateBankFromLegacySource('dev-quick', JSON.parse(__sourceJson))", fullBackendContext),
    undefined,
    "legacy bootstrap must reject " + label
  );
}

expectLegacyReject("wrong source testId", source => { source.testId = "fa-junior"; });
expectLegacyReject("wrong legacy version", source => { source.version = "DEV Quick v2.0"; });
expectLegacyReject("wrong total count", source => { source.totalQuestions = 2; });
expectLegacyReject("unknown bank key", source => { source.unexpected = true; });
expectLegacyReject("missing block", source => { delete source.blocks.smoke; });
expectLegacyReject("extra block", source => { source.blocks.extra = "Extra"; });
expectLegacyReject("inactive question", source => { source.questions[0].active = false; });
expectLegacyReject("unknown question key", source => { source.questions[0].unexpected = true; });
expectLegacyReject("empty text", source => { source.questions[0].text = ""; });
expectLegacyReject("invalid difficulty", source => { source.questions[0].difficulty = "impossible"; });
expectLegacyReject("invalid time", source => { source.questions[0].timeLimit = 0; });
expectLegacyReject("invalid points", source => { source.questions[0].points = 0; });
expectLegacyReject("three options", source => { source.questions[0].options.pop(); });
expectLegacyReject("answer outside options", source => { source.questions[0].correct = 9; });

function expectPrivateReject(label, mutate) {
  const fixture = cloneJson(generatedPrivateBanks["dev-quick"]);
  mutate(fixture);
  fullBackendContext.__privateJson = JSON.stringify(fixture);
  assert.throws(
    () => vm.runInContext("validateAuthoritativePrivateBankObject(JSON.parse(__privateJson), 'dev-quick', 'DEV Quick v2.0')", fullBackendContext),
    undefined,
    "private loader must reject " + label
  );
}

expectPrivateReject("unknown bank key", bank => { bank.unexpected = true; });
expectPrivateReject("missing block", bank => { delete bank.blocks.smoke; });
expectPrivateReject("extra block", bank => { bank.blocks.extra = "Extra"; });
expectPrivateReject("unknown question key", bank => { bank.questions[0].unexpected = true; });
expectPrivateReject("empty text", bank => { bank.questions[0].text = ""; });
expectPrivateReject("invalid difficulty", bank => { bank.questions[0].difficulty = "impossible"; });
expectPrivateReject("invalid time", bank => { bank.questions[0].timeLimit = 0; });
expectPrivateReject("invalid points", bank => { bank.questions[0].points = 0; });
expectPrivateReject("wrong option count", bank => { bank.questions[0].options.pop(); });
expectPrivateReject("wrong option order", bank => { bank.questions[0].options.reverse(); });
expectPrivateReject("unknown option key", bank => { bank.questions[0].options[0].unexpected = true; });
expectPrivateReject("correctOptionId outside options", bank => { bank.questions[0].correctOptionId = "opt_" + "0".repeat(20); });
expectPrivateReject("wrong public digest", bank => { bank.publicDigest = "0".repeat(64); });

const anchoredPrivate = generatedPrivateBanks["dev-quick"];
const anchorKey = fullBackendContext.__banks.getPrivateBankAnchorKey(anchoredPrivate.testId, anchoredPrivate.bankVersion);
const anchorDigest = fullBackendContext.__banks.getPrivateBankArtifactDigest(anchoredPrivate);
privateAnchorSource = JSON.stringify({ [anchorKey]: anchorDigest });
fullBackendContext.__privateJson = JSON.stringify(anchoredPrivate);
vm.runInContext("assertPrivateBankTrustAnchor(JSON.parse(__privateJson))", fullBackendContext);
privateAnchorSource = null;
assert.throws(() => vm.runInContext("assertPrivateBankTrustAnchor(JSON.parse(__privateJson))", fullBackendContext), /anchors are missing/i);
privateAnchorSource = JSON.stringify({ [anchorKey]: "0".repeat(64) });
assert.throws(() => vm.runInContext("assertPrivateBankTrustAnchor(JSON.parse(__privateJson))", fullBackendContext), /anchor mismatch/i);
const tamperedAnswerKey = cloneJson(anchoredPrivate);
tamperedAnswerKey.questions[0].correctOptionId = tamperedAnswerKey.questions[0].options.find(option => option.id !== tamperedAnswerKey.questions[0].correctOptionId).id;
privateAnchorSource = JSON.stringify({ [anchorKey]: anchorDigest });
fullBackendContext.__privateJson = JSON.stringify(tamperedAnswerKey);
vm.runInContext("validateAuthoritativePrivateBankObject(JSON.parse(__privateJson), 'dev-quick', 'DEV Quick v2.0')", fullBackendContext);
assert.throws(() => vm.runInContext("assertPrivateBankTrustAnchor(JSON.parse(__privateJson))", fullBackendContext), /anchor mismatch/i, "answer-key tampering must fail even when publicDigest is unchanged");

const bootstrapSource = (() => {
  const marker = "function bootstrapAuthoritativeBanksFromLegacyPages(";
  const start = backend.indexOf(marker);
  const next = backend.indexOf("\nfunction ", start + marker.length);
  return backend.slice(start, next).trim();
})();
assert.match(bootstrapSource, /if \(existingAnchors\)[\s\S]*throw new Error\("Existing private bank trust anchor conflicts/);
assert.match(bootstrapSource, /else\s*\{[\s\S]*setProperty\("PRIVATE_BANK_DIGESTS_V1"/, "bootstrap may set anchors only when absent");

// Repository-level secret boundary: names of Script Properties are expected in
// source, but values and mutable private storage artifacts must never be tracked.
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
tracked.forEach(fileName => {
  const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();
  assert(!/private\/banks\//.test(normalizedPath), fileName + " must not track private banks");
  assert(!/(^|\/)(invites-v1|attempt-sessions-v1|attempts)\.json$/.test(normalizedPath), fileName + " must not track private state");
  assert(!/(^|\/)\.clasp\.json$/.test(normalizedPath), fileName + " must not track clasp binding");
  assert(!/(^|\/)(token[^/]*\.json|\.env)$/.test(normalizedPath), fileName + " must not track credentials");
});

const trackedText = tracked
  .filter(fileName => /\.(?:js|gs|html|md|json|txt)$/i.test(fileName))
  .map(fileName => fs.readFileSync(path.join(root, fileName), "utf8"))
  .join("\n");
assert.doesNotMatch(trackedText, /OAuth\s+[A-Za-z0-9_-]{35,}/, "tracked source must not contain a Yandex OAuth token value");
assert.doesNotMatch(trackedText, /ya29\.[A-Za-z0-9_-]{20,}/, "tracked source must not contain an OAuth bearer token");
assert.doesNotMatch(trackedText, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "tracked source must not contain a private key");

assert.match(backend, /const PUBLIC_DEV_TEST_ENABLED = false;/, "dev-quick must stay publicly disabled");
assert.doesNotMatch(candidate, /localStorage\.setItem\([^\n]*(?:attemptToken|inviteCode|email|answers)/i, "candidate must not put attempt PII/secrets in localStorage");

console.log(`Stage 10A public-bank secrecy tests passed (${banks.length} banks, ${banks.reduce((sum, item) => sum + item.bank.questions.length, 0)} questions).`);
