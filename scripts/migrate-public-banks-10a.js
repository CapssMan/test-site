#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const PUBLIC_SCHEMA_VERSION = 2;
const OPTION_ID_HEX_LENGTH = 20;
const OPTION_ID_NAMESPACE = "skillcheck-option-v1";

const BANK_SPECS = Object.freeze({
  "fa-junior": {
    testVersion: "FA Junior v3.0",
    bankVersion: "FA Junior v3.0",
    legacyVersions: ["FA Junior v2.3"],
    questions: 40,
    questionsPerAttempt: 40
  },
  "ca-junior": {
    testVersion: "CA Junior v3.0",
    bankVersion: "CA Junior v3.0",
    legacyVersions: ["CA Junior v2.0"],
    questions: 80,
    questionsPerAttempt: 40
  },
  "fpa-junior": {
    testVersion: "FP&A Junior v3.0",
    bankVersion: "FP&A Junior v3.0",
    legacyVersions: ["FP&A Junior v2.0"],
    questions: 40,
    questionsPerAttempt: 40
  },
  "acc-junior": {
    testVersion: "ACC Junior v3.0",
    bankVersion: "ACC Junior v3.0",
    legacyVersions: ["ACC Junior v2.0"],
    questions: 40,
    questionsPerAttempt: 40
  },
  "bi-junior": {
    testVersion: "BI Junior v3.0",
    bankVersion: "BI Junior v3.0",
    legacyVersions: ["BI Junior v2.0"],
    questions: 40,
    questionsPerAttempt: 40
  },
  "dev-quick": {
    testVersion: "DEV Quick v2.0",
    bankVersion: "DEV Quick v2.0",
    legacyVersions: ["Dev Quick Smoke Test v1.0"],
    questions: 1,
    questionsPerAttempt: 1
  }
});

const PUBLIC_BANK_KEYS = new Set([
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions", "publicDigest"
]);
const PUBLIC_BANK_KEY_ORDER = [
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions", "publicDigest"
];
const PUBLIC_CANONICAL_KEY_ORDER = [
  "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
  "blocks", "questions"
];
const PUBLIC_QUESTION_KEYS = new Set([
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text",
  "context", "options"
]);
const PUBLIC_QUESTION_KEY_ORDER = [
  "id", "topic", "block", "difficulty", "timeLimit", "points", "text",
  "context", "options"
];
const PUBLIC_OPTION_KEYS = new Set(["id", "text"]);
const PUBLIC_OPTION_KEY_ORDER = ["id", "text"];
const PRIVATE_FIELD_NAMES = new Set([
  "correct", "correctindex", "correctanswer", "correctoption", "correctoptionid",
  "comment", "explanation", "answer", "answerkey", "solution", "solutions",
  "rationale", "iscorrect", "private", "privatekey"
]);

function fail(message) {
  throw new Error(message);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function serializeJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function canonicalPublicBank(value) {
  const canonical = {};
  PUBLIC_CANONICAL_KEY_ORDER.forEach(key => { canonical[key] = value[key]; });
  return canonical;
}

function computePublicDigest(value) {
  return sha256Hex(JSON.stringify(canonicalPublicBank(value)));
}

function normalizeFieldName(key) {
  return String(key || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function isPrivateFieldName(key) {
  const normalized = normalizeFieldName(key);
  return PRIVATE_FIELD_NAMES.has(normalized) || normalized.startsWith("private");
}

function stripPrivateFields(value) {
  if (Array.isArray(value)) return value.map(stripPrivateFields);
  if (!isPlainObject(value)) return value;

  const result = {};
  Object.keys(value).forEach(key => {
    if (!isPrivateFieldName(key)) result[key] = stripPrivateFields(value[key]);
  });
  return result;
}

function assertNoPrivateFields(value, location) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrivateFields(item, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;

  Object.keys(value).forEach(key => {
    if (isPrivateFieldName(key)) fail(`${location}.${key}: private field is forbidden in a public bank`);
    assertNoPrivateFields(value[key], `${location}.${key}`);
  });
}

function assertExactKeys(value, allowedKeys, location) {
  if (!isPlainObject(value)) fail(`${location}: expected an object`);
  const unexpected = Object.keys(value).filter(key => !allowedKeys.has(key));
  if (unexpected.length) fail(`${location}: unexpected public keys: ${unexpected.join(", ")}`);
}

function assertKeyOrder(value, expectedKeys, location) {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    fail(`${location}: expected key order ${expectedKeys.join(", ")}; got ${actualKeys.join(", ")}`);
  }
}

function assertPathInside(parentPath, childPath, description) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  fail(`${description} must stay inside ${path.resolve(parentPath)}: ${path.resolve(childPath)}`);
}

function assertPathOutside(parentPath, childPath, description) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    fail(`${description} must be outside the Git worktree: ${path.resolve(childPath)}`);
  }
}

function normalizeQuestionId(testId, sourceId, questionIndex, migrated) {
  if (testId === "ca-junior") {
    if (migrated) {
      const migratedId = String(sourceId || "");
      if (!/^ca_\d{3}$/.test(migratedId)) {
        fail(`${testId} question ${questionIndex + 1}: expected migrated id ca_NNN`);
      }
      const numericPart = Number(migratedId.slice(3));
      if (numericPart !== questionIndex + 1 || numericPart < 1 || numericPart > 80) {
        fail(`${testId} question ${questionIndex + 1}: non-sequential migrated id ${migratedId}`);
      }
      return migratedId;
    }

    const numericId = Number(sourceId);
    if (!Number.isInteger(numericId) || numericId !== questionIndex + 1 || numericId < 1 || numericId > 80) {
      fail(`${testId} question ${questionIndex + 1}: expected legacy numeric id ${questionIndex + 1}`);
    }
    return `ca_${String(numericId).padStart(3, "0")}`;
  }

  const questionId = String(sourceId || "");
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(questionId)) {
    fail(`${testId} question ${questionIndex + 1}: invalid id ${JSON.stringify(sourceId)}`);
  }
  return questionId;
}

function createOptionId(testId, questionId, optionText) {
  const digest = sha256Hex(`${OPTION_ID_NAMESPACE}|${testId}|${questionId}|${optionText}`);
  return `opt_${digest.slice(0, OPTION_ID_HEX_LENGTH)}`;
}

function copyDisplayQuestionFields(source, questionId) {
  return {
    id: questionId,
    topic: hasOwn(source, "topic") ? cloneJson(source.topic) : "",
    block: cloneJson(source.block),
    difficulty: cloneJson(source.difficulty),
    timeLimit: cloneJson(source.timeLimit),
    points: cloneJson(source.points),
    text: cloneJson(source.text),
    context: hasOwn(source, "context") ? cloneJson(source.context) : ""
  };
}

function getLegacyCorrectIndex(question, optionTexts, location) {
  let correctIndex = null;

  if (hasOwn(question, "correct")) correctIndex = question.correct;
  else if (hasOwn(question, "correctIndex")) correctIndex = question.correctIndex;
  else if (hasOwn(question, "correctAnswer")) correctIndex = optionTexts.indexOf(question.correctAnswer);

  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionTexts.length) {
    fail(`${location}: invalid or missing legacy correct answer`);
  }
  if (hasOwn(question, "correctAnswer") && optionTexts[correctIndex] !== question.correctAnswer) {
    fail(`${location}: correct index and correctAnswer disagree`);
  }
  return correctIndex;
}

function validateLegacyMetadata(source, spec, filePath) {
  if (!isPlainObject(source)) fail(`${filePath}: expected a JSON object`);
  if (!spec.legacyVersions.includes(String(source.version || ""))) {
    fail(`${filePath}: unsupported legacy version ${JSON.stringify(source.version)}`);
  }
  if (source.totalQuestions !== spec.questions) {
    fail(`${filePath}: totalQuestions must be ${spec.questions}`);
  }
  const sourceQuestionsPerAttempt = hasOwn(source, "questionsPerAttempt")
    ? source.questionsPerAttempt
    : source.questionsPerTest;
  if (sourceQuestionsPerAttempt !== undefined && sourceQuestionsPerAttempt !== spec.questionsPerAttempt) {
    fail(`${filePath}: legacy questions-per-attempt must be ${spec.questionsPerAttempt}`);
  }
  if (!isPlainObject(source.blocks) || !Object.keys(source.blocks).length) {
    fail(`${filePath}: blocks must be a non-empty object`);
  }
  if (!Array.isArray(source.questions) || source.questions.length !== spec.questions) {
    fail(`${filePath}: expected ${spec.questions} questions`);
  }
}

function createCommonMetadata(source, spec) {
  return {
    schemaVersion: PUBLIC_SCHEMA_VERSION,
    testId: source.testId,
    testVersion: spec.testVersion,
    bankVersion: spec.bankVersion,
    questionsPerAttempt: spec.questionsPerAttempt,
    blocks: cloneJson(source.blocks)
  };
}

function migrateLegacyBank(source, spec, filePath) {
  validateLegacyMetadata(source, spec, filePath);
  const testId = String(source.testId || "");
  const privateBank = createCommonMetadata(source, spec);
  const publicDraft = createCommonMetadata(source, spec);
  const seenQuestionIds = new Set();
  const seenOptionIds = new Set();

  privateBank.questions = [];
  publicDraft.questions = [];

  source.questions.forEach((question, questionIndex) => {
    const location = `${filePath} question ${questionIndex + 1}`;
    if (!isPlainObject(question)) fail(`${location}: expected an object`);
    const questionId = normalizeQuestionId(testId, question.id, questionIndex, false);
    if (seenQuestionIds.has(questionId)) fail(`${location}: duplicate question id ${questionId}`);
    seenQuestionIds.add(questionId);

    if (typeof question.text !== "string" || !question.text.trim()) fail(`${location}: text is required`);
    if (typeof question.block !== "string" || !hasOwn(source.blocks, question.block)) {
      fail(`${location}: unknown block ${JSON.stringify(question.block)}`);
    }
    if (typeof question.difficulty !== "string" || !question.difficulty) fail(`${location}: difficulty is required`);
    if (!Number.isFinite(question.timeLimit) || question.timeLimit <= 0) fail(`${location}: invalid timeLimit`);
    if (!Number.isFinite(question.points) || question.points <= 0) fail(`${location}: invalid points`);
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      fail(`${location}: exactly four legacy options are required`);
    }

    const optionTexts = question.options.map((option, optionIndex) => {
      if (typeof option !== "string" || !option.trim()) fail(`${location} option ${optionIndex + 1}: text is required`);
      return option;
    });
    const correctIndex = getLegacyCorrectIndex(question, optionTexts, location);
    const optionObjects = optionTexts.map(optionText => ({
      id: createOptionId(testId, questionId, optionText),
      text: optionText
    }));
    const localOptionIds = new Set(optionObjects.map(option => option.id));
    if (localOptionIds.size !== optionObjects.length) fail(`${location}: duplicate option text/id`);
    optionObjects.forEach(option => {
      if (seenOptionIds.has(option.id)) fail(`${location}: global option id collision ${option.id}`);
      seenOptionIds.add(option.id);
    });
    const correctOptionId = optionObjects[correctIndex].id;
    const sortedOptions = optionObjects.slice().sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

    const privateQuestion = copyDisplayQuestionFields(question, questionId);
    privateQuestion.options = cloneJson(sortedOptions);
    privateQuestion.correctOptionId = correctOptionId;
    privateQuestion.comment = hasOwn(question, "comment")
      ? cloneJson(question.comment)
      : (hasOwn(question, "explanation") ? cloneJson(question.explanation) : "");

    const publicQuestion = copyDisplayQuestionFields(question, questionId);
    publicQuestion.options = cloneJson(sortedOptions);
    privateBank.questions.push(privateQuestion);
    publicDraft.questions.push(publicQuestion);
  });

  const publicCanonical = stripPrivateFields(publicDraft);
  const publicDigest = computePublicDigest(publicCanonical);
  const publicBank = Object.assign({}, publicCanonical, { publicDigest });
  privateBank.publicDigest = publicDigest;
  validatePrivatePublicParity(source, privateBank, publicBank, spec, filePath);
  validatePublicBank(publicBank, spec, filePath);

  return { privateBank, publicBank };
}

function comparableOptionMap(options, location) {
  const result = new Map();
  options.forEach(option => {
    if (!isPlainObject(option) || typeof option.id !== "string" || typeof option.text !== "string") {
      fail(`${location}: invalid option object`);
    }
    if (result.has(option.id)) fail(`${location}: duplicate option id ${option.id}`);
    result.set(option.id, option.text);
  });
  return result;
}

function validatePrivatePublicParity(source, privateBank, publicBank, spec, filePath) {
  if (JSON.stringify(privateBank.blocks) !== JSON.stringify(source.blocks) ||
      JSON.stringify(publicBank.blocks) !== JSON.stringify(source.blocks)) {
    fail(`${filePath}: block definitions changed during migration`);
  }
  if (privateBank.questions.length !== source.questions.length || publicBank.questions.length !== source.questions.length) {
    fail(`${filePath}: question count changed during migration`);
  }

  source.questions.forEach((legacyQuestion, index) => {
    const location = `${filePath} question ${index + 1}`;
    const privateQuestion = privateBank.questions[index];
    const publicQuestion = publicBank.questions[index];
    const expectedId = normalizeQuestionId(source.testId, legacyQuestion.id, index, false);
    if (privateQuestion.id !== expectedId || publicQuestion.id !== expectedId) {
      fail(`${location}: question id parity failed`);
    }

    const expectedDisplayValues = {
      topic: hasOwn(legacyQuestion, "topic") ? legacyQuestion.topic : "",
      block: legacyQuestion.block,
      difficulty: legacyQuestion.difficulty,
      timeLimit: legacyQuestion.timeLimit,
      points: legacyQuestion.points,
      text: legacyQuestion.text,
      context: hasOwn(legacyQuestion, "context") ? legacyQuestion.context : ""
    };
    Object.keys(expectedDisplayValues).forEach(field => {
      if (
        JSON.stringify(privateQuestion[field]) !== JSON.stringify(expectedDisplayValues[field]) ||
        JSON.stringify(publicQuestion[field]) !== JSON.stringify(expectedDisplayValues[field])
      ) {
        fail(`${location}: exact value changed for ${field}`);
      }
    });

    const privateOptions = comparableOptionMap(privateQuestion.options, `${location} private options`);
    const publicOptions = comparableOptionMap(publicQuestion.options, `${location} public options`);
    if (privateOptions.size !== legacyQuestion.options.length || publicOptions.size !== legacyQuestion.options.length) {
      fail(`${location}: option count changed`);
    }
    legacyQuestion.options.forEach(optionText => {
      const optionId = createOptionId(source.testId, expectedId, optionText);
      if (privateOptions.get(optionId) !== optionText || publicOptions.get(optionId) !== optionText) {
        fail(`${location}: option text/id parity failed`);
      }
    });

    const correctIndex = getLegacyCorrectIndex(legacyQuestion, legacyQuestion.options, location);
    const expectedCorrectOptionId = createOptionId(
      source.testId,
      expectedId,
      legacyQuestion.options[correctIndex]
    );
    if (privateQuestion.correctOptionId !== expectedCorrectOptionId || !privateOptions.has(expectedCorrectOptionId)) {
      fail(`${location}: correct answer parity failed`);
    }
    if (hasOwn(publicQuestion, "correctOptionId")) fail(`${location}: correct option leaked into public bank`);
  });

  if (privateBank.questions.length !== spec.questions) fail(`${filePath}: private question count mismatch`);
  if (privateBank.publicDigest !== publicBank.publicDigest ||
      privateBank.publicDigest !== computePublicDigest(publicBank)) {
    fail(`${filePath}: private/public digest parity failed`);
  }
  assertNoPrivateFields(publicBank, filePath);
}

function validatePublicBank(publicBank, spec, filePath) {
  assertExactKeys(publicBank, PUBLIC_BANK_KEYS, filePath);
  assertKeyOrder(publicBank, PUBLIC_BANK_KEY_ORDER, filePath);
  assertNoPrivateFields(publicBank, filePath);
  if (publicBank.schemaVersion !== PUBLIC_SCHEMA_VERSION) fail(`${filePath}: schemaVersion must be 2`);
  if (publicBank.testVersion !== spec.testVersion || publicBank.bankVersion !== spec.bankVersion ||
      publicBank.testVersion !== publicBank.bankVersion) {
    fail(`${filePath}: expected public version ${spec.bankVersion}`);
  }
  if (publicBank.questionsPerAttempt !== spec.questionsPerAttempt) {
    fail(`${filePath}: invalid public question counts`);
  }
  if (!isPlainObject(publicBank.blocks) || !Object.keys(publicBank.blocks).length) {
    fail(`${filePath}: public blocks must be a non-empty object`);
  }
  if (!Array.isArray(publicBank.questions) || publicBank.questions.length !== spec.questions) {
    fail(`${filePath}: expected ${spec.questions} public questions`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(publicBank.publicDigest || "")) ||
      publicBank.publicDigest !== computePublicDigest(publicBank)) {
    fail(`${filePath}: invalid publicDigest`);
  }

  const seenQuestionIds = new Set();
  const seenOptionIds = new Set();
  publicBank.questions.forEach((question, questionIndex) => {
    const location = `${filePath} question ${questionIndex + 1}`;
    assertExactKeys(question, PUBLIC_QUESTION_KEYS, location);
    assertKeyOrder(question, PUBLIC_QUESTION_KEY_ORDER, location);
    const expectedId = normalizeQuestionId(publicBank.testId, question.id, questionIndex, true);
    if (question.id !== expectedId || seenQuestionIds.has(question.id)) fail(`${location}: invalid/duplicate id`);
    seenQuestionIds.add(question.id);
    if (typeof question.text !== "string" || !question.text.trim()) fail(`${location}: text is required`);
    if (typeof question.topic !== "string" || typeof question.context !== "string") {
      fail(`${location}: topic/context must be strings`);
    }
    if (typeof question.block !== "string" || !hasOwn(publicBank.blocks, question.block)) {
      fail(`${location}: unknown block ${JSON.stringify(question.block)}`);
    }
    if (typeof question.difficulty !== "string" || !question.difficulty) fail(`${location}: difficulty is required`);
    if (!Number.isFinite(question.timeLimit) || question.timeLimit <= 0) fail(`${location}: invalid timeLimit`);
    if (!Number.isFinite(question.points) || question.points <= 0) fail(`${location}: invalid points`);
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      fail(`${location}: exactly four public options are required`);
    }

    let previousOptionId = "";
    question.options.forEach((option, optionIndex) => {
      assertExactKeys(option, PUBLIC_OPTION_KEYS, `${location} option ${optionIndex + 1}`);
      assertKeyOrder(option, PUBLIC_OPTION_KEY_ORDER, `${location} option ${optionIndex + 1}`);
      if (typeof option.text !== "string" || !option.text.trim()) fail(`${location}: option text is required`);
      const expectedOptionId = createOptionId(publicBank.testId, question.id, option.text);
      if (option.id !== expectedOptionId || !/^opt_[a-f0-9]{20}$/.test(option.id)) {
        fail(`${location}: invalid deterministic option id ${JSON.stringify(option.id)}`);
      }
      if (previousOptionId && previousOptionId >= option.id) fail(`${location}: options are not sorted by id`);
      previousOptionId = option.id;
      if (seenOptionIds.has(option.id)) fail(`${location}: duplicate global option id ${option.id}`);
      seenOptionIds.add(option.id);
    });
  });
}

function isMigratedPublicBank(source) {
  return source && source.schemaVersion === PUBLIC_SCHEMA_VERSION;
}

function parseArguments(argv) {
  const files = [];
  let privateOutputDirectory = "";

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--private-out") {
      if (!argv[index + 1]) fail("--private-out requires a directory");
      privateOutputDirectory = argv[++index];
    } else if (argument.startsWith("--private-out=")) {
      privateOutputDirectory = argument.slice("--private-out=".length);
    } else if (argument.startsWith("--")) {
      fail(`unknown option ${argument}`);
    } else {
      files.push(argument);
    }
  }

  const resolvedFiles = (files.length
    ? files
    : fs.readdirSync(DATA_DIR).filter(file => file.endsWith(".json")).sort().map(file => path.join(DATA_DIR, file))
  ).map(file => path.resolve(file));

  resolvedFiles.forEach(file => {
    assertPathInside(DATA_DIR, file, "Public bank input");
    if (path.extname(file).toLowerCase() !== ".json") fail(`Public bank must be JSON: ${file}`);
  });

  const resolvedPrivateOutputDirectory = privateOutputDirectory
    ? path.resolve(privateOutputDirectory)
    : "";
  if (resolvedPrivateOutputDirectory) {
    assertPathOutside(REPO_ROOT, resolvedPrivateOutputDirectory, "Private bank output");
  }

  return { files: resolvedFiles, privateOutputDirectory: resolvedPrivateOutputDirectory };
}

function privateFileName(testId, version) {
  const versionSlug = version.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${testId}.${versionSlug}.private.json`;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const plans = args.files.map(filePath => {
    const sourceText = fs.readFileSync(filePath, "utf8");
    let source;
    try {
      source = JSON.parse(sourceText);
    } catch (error) {
      fail(`${filePath}: invalid JSON`);
    }

    const testId = String(source && source.testId || "");
    const spec = BANK_SPECS[testId];
    if (!spec) fail(`${filePath}: unsupported testId ${JSON.stringify(testId)}`);

    if (isMigratedPublicBank(source)) {
      const publicBank = hasOwn(source, "publicDigest")
        ? source
        : Object.assign({}, source, { publicDigest: computePublicDigest(source) });
      validatePublicBank(publicBank, spec, filePath);
      const status = hasOwn(source, "publicDigest") ? "validated-noop" : "migrated-digest";
      return {
        filePath,
        testId,
        spec,
        status,
        publicBank,
        publicText: status === "validated-noop" ? sourceText : serializeJson(publicBank),
        privateBank: null,
        privateText: ""
      };
    }

    const artifacts = migrateLegacyBank(source, spec, filePath);
    const publicText = serializeJson(artifacts.publicBank);
    const privateText = serializeJson(artifacts.privateBank);
    if (publicText !== serializeJson(artifacts.publicBank) || privateText !== serializeJson(artifacts.privateBank)) {
      fail(`${filePath}: serialization is not deterministic`);
    }
    return {
      filePath,
      testId,
      spec,
      status: "migrated",
      publicBank: artifacts.publicBank,
      publicText,
      privateBank: artifacts.privateBank,
      privateText
    };
  });

  if (args.privateOutputDirectory) {
    fs.mkdirSync(args.privateOutputDirectory, { recursive: true });
  }

  plans.forEach(plan => {
    if (plan.status !== "validated-noop") fs.writeFileSync(plan.filePath, plan.publicText, "utf8");
    if (args.privateOutputDirectory && plan.privateBank) {
      const outputPath = path.join(
        args.privateOutputDirectory,
        privateFileName(plan.testId, plan.spec.bankVersion)
      );
      assertPathOutside(REPO_ROOT, outputPath, "Private bank output");
      fs.writeFileSync(outputPath, plan.privateText, { encoding: "utf8", flag: "wx" });
    }

    const publicDigest = plan.publicBank.publicDigest;
    const privateDigest = plan.privateBank ? sha256Hex(JSON.stringify(plan.privateBank)) : "not-reconstructed";
    const optionCount = plan.publicBank.questions.reduce((sum, question) => sum + question.options.length, 0);
    console.log([
      path.relative(REPO_ROOT, plan.filePath).replace(/\\/g, "/"),
      `status=${plan.status}`,
      `version=${JSON.stringify(plan.spec.bankVersion)}`,
      `questions=${plan.publicBank.questions.length}`,
      `options=${optionCount}`,
      `publicDigest=${publicDigest}`,
      `privateDigest=${privateDigest}`
    ].join(" "));
  });
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}
