#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OPTION_NAMESPACE = "skillcheck-option-v6-market-calibrated";

const SPECS = Object.freeze({
  "fa-junior": { version: "FA Junior v6.0", prefix: "fa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "ca-junior": { version: "CA Junior v6.0", prefix: "ca6", count: 80, distribution: { easy: 20, medium: 28, calc: 20, case: 10, hard: 2 } },
  "fpa-junior": { version: "FP&A Junior v6.0", prefix: "fpa6", count: 40, distribution: { easy: 10, medium: 14, calc: 10, case: 5, hard: 1 } },
  "acc-junior": { version: "ACC Junior v6.0", prefix: "acc6", count: 40, distribution: { easy: 12, medium: 16, calc: 7, case: 4, hard: 1 } },
  "bi-junior": { version: "BI Junior v6.0", prefix: "bi6", count: 40, distribution: { easy: 10, medium: 16, calc: 8, case: 5, hard: 1 } }
});

const CALIBRATION = Object.freeze({
  "fa-junior": {
    easy: [1, 3, 6, 8, 10, 16, 20, 25, 29, 31],
    medium: [4, 12, 13, 17, 22, 23, 26, 28, 30, 32, 34, 36, 37, 39],
    calc: [2, 11, 15, 18, 21, 24, 27, 33, 35, 38],
    case: [5, 7, 9, 14, 19],
    hard: [40]
  },
  "ca-junior": {
    easy: [1, 3, 5, 8, 11, 16, 18, 21, 30, 34, 37, 42, 45, 47, 51, 53, 54, 57, 58, 60],
    medium: [2, 6, 7, 10, 15, 23, 26, 28, 29, 33, 35, 41, 46, 48, 49, 50, 55, 56, 59, 64, 65, 68, 71, 72, 73, 75, 76, 79],
    calc: [13, 14, 17, 20, 22, 24, 27, 31, 32, 36, 38, 40, 43, 44, 52, 63, 67, 69, 70, 74],
    case: [4, 9, 12, 19, 25, 39, 62, 66, 77, 78],
    hard: [61, 80]
  },
  "fpa-junior": {
    easy: [1, 2, 3, 5, 9, 11, 22, 32, 33, 37],
    medium: [7, 10, 13, 15, 18, 21, 23, 25, 28, 31, 35, 36, 38, 39],
    calc: [6, 14, 16, 17, 19, 24, 26, 27, 30, 34],
    case: [4, 8, 12, 29, 40],
    hard: [20]
  },
  "acc-junior": {
    easy: [3, 4, 5, 6, 7, 8, 9, 12, 23, 30, 33, 37],
    medium: [1, 2, 13, 14, 15, 18, 19, 24, 25, 26, 29, 31, 32, 34, 35, 39],
    calc: [10, 16, 21, 28, 36, 38, 40],
    case: [11, 17, 22, 27],
    hard: [20]
  },
  "bi-junior": {
    easy: [2, 3, 5, 6, 8, 16, 21, 25, 31, 34],
    medium: [1, 4, 10, 11, 13, 15, 17, 18, 23, 24, 26, 30, 33, 37, 38, 39],
    calc: [9, 14, 19, 22, 29, 32, 35, 36],
    case: [7, 12, 20, 27, 40],
    hard: [28]
  }
});

const PROFILE = Object.freeze({
  easy: Object.freeze({ timeLimit: 50, points: 3 }),
  medium: Object.freeze({ timeLimit: 60, points: 4 }),
  calc: Object.freeze({ timeLimit: 75, points: 5 }),
  case: Object.freeze({ timeLimit: 90, points: 5 }),
  hard: Object.freeze({ timeLimit: 105, points: 6 })
});

const TEXT_PATCHES = Object.freeze({
  fa5_012: "Рассчитайте Net debt / EBITDA и определите, соблюдён ли лимит банка на отчётную дату.",
  fa5_014: "С чего лучше начать сверку, чтобы быстро найти причину расхождения между импортом и главной книгой?",
  fa5_022: "Рассчитайте влияние указанных изменений оборотного капитала на операционный денежный поток.",
  fa5_027: "Рассчитайте прогнозную месячную выручку подписочного сервиса по указанным правилам активной базы.",
  fa5_035: "Какое искажение запасов и себестоимости продаж видно из контрольного движения количества?",
  ca5_012: "Какую EBITDA использовать в базовом кредитном расчёте после указанных нормализующих корректировок?",
  ca5_024: "Рассчитайте долю дебиторской задолженности старше 90 дней и выберите обоснованный вывод.",
  ca5_031: "Рассчитайте операционный денежный поток упрощённым косвенным методом.",
  ca5_043: "Рассчитайте Net debt / EBITDA после снижения EBITDA на 10% и сравните результат с лимитом.",
  ca5_044: "Рассчитайте доступную залоговую стоимость после haircut и старшего обременения.",
  ca5_052: "Какая формула суммирует платежи клиента A за январь, включая строки с временем внутри даты?",
  ca5_061: "Какой главный кредитный риск показывает рост оптовой компании по приведённым данным?",
  ca5_077: "Что сделать аналитику при существенном расхождении управленческой и бухгалтерской выручки?",
  ca5_080: "Какое кредитное решение следует из приведённых показателей долга, потока и ближайшего погашения?",
  fpa5_007: "Какая формула рассчитывает ценовой эффект выручки в PVM-мосте после учёта объёма и микса?",
  fpa5_015: "Рассчитайте среднюю ошибку Forecast − Actual и определите направление систематического отклонения.",
  fpa5_019: "Насколько должен вырасти объём после скидки, чтобы сохранить прежнюю общую маржинальную прибыль?",
  fpa5_020: "Рассчитайте минимальную цену специального заказа, при которой общая прибыль не снизится.",
  fpa5_029: "Какой минимальный остаток денег получится в четырёхмесячном плане роста и в каком месяце?",
  fpa5_034: "Какую связь в прогнозе нужно исправить, чтобы устранить расхождение конечного остатка денег на 0,4 млн ₽?",
  acc5_010: "Рассчитайте резерв на конец периода, расход периода и чистую дебиторскую задолженность.",
  acc5_016: "Рассчитайте учебную сумму НДС к уплате по приведённым начислениям и допустимым вычетам.",
  acc5_020: "Найдите строку, в которой корректировка использована повторно, и определите сумму превышения.",
  acc5_021: "Рассчитайте первоначальную стоимость оборудования до начала амортизации.",
  acc5_028: "Какой вывод следует из несовпадения дебетового и кредитового оборотов в контрольной ОСВ?",
  acc5_036: "Какая формула суммирует июльские обороты группы счёта 60 по указанной выгрузке?",
  bi5_007: "Как соединить продажу с версией категории, действовавшей на дату продажи, без удвоения строки?",
  bi5_009: "Как подготовить строки заказов и оплаты перед JOIN, чтобы суммы не удвоились?",
  bi5_012: "Какое условие JOIN присвоит каждой операции тариф, действовавший на дату операции?",
  bi5_020: "Можно ли публиковать общий остаток на 31 июля, если один счёт нарушил правило свежести данных?",
  bi5_024: "С чего начать сверку выручки BI с главной книгой, чтобы локализовать расхождение?",
  bi5_027: "Как рассчитать долю продаж продукта, сохранив фильтры даты и региона, но сняв фильтр продукта?",
  bi5_028: "Какая причина лишнего доступа к региону подтверждается результатами проверки RLS?",
  bi5_039: "Почему общая маржа выросла, хотя маржа каждого сегмента снизилась?",
  bi5_040: "Какой рост активных клиентов использовать для бонуса, если правило заранее закреплено по старому определению?"
});

function parseArgs(argv) {
  const result = { source: "", privateOut: "", publicStage: "" };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`${name} requires a value`);
    if (name === "--source") result.source = path.resolve(value);
    else if (name === "--private-out") result.privateOut = path.resolve(value);
    else if (name === "--public-stage") result.publicStage = path.resolve(value);
    else throw new Error(`Unknown argument: ${name}`);
  }
  if (!result.source || !result.privateOut || !result.publicStage) throw new Error("--source, --private-out and --public-stage are required");
  return result;
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function assertPrivateBoundary(candidate, label) {
  if (isInside(ROOT, candidate)) throw new Error(`${label} must stay outside the Git worktree`);
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function optionId(testId, questionId, text) {
  return "opt_" + sha256Text(`${OPTION_NAMESPACE}|${testId}|${questionId}|${text}`).slice(0, 20);
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

function onlyJsonFile(directory) {
  const files = fs.readdirSync(directory).filter(name => name.endsWith(".json"));
  assert.equal(files.length, 1, `${directory}: expected one bank JSON`);
  return path.join(directory, files[0]);
}

function calibrationMap(testId, spec) {
  const result = new Map();
  for (const difficulty of Object.keys(PROFILE)) {
    const indexes = CALIBRATION[testId][difficulty];
    assert.equal(indexes.length, spec.distribution[difficulty], `${testId}: ${difficulty} target mismatch`);
    indexes.forEach(index => {
      assert(Number.isInteger(index) && index >= 1 && index <= spec.count, `${testId}: invalid index ${index}`);
      assert(!result.has(index), `${testId}: question ${index} calibrated twice`);
      result.set(index, difficulty);
    });
  }
  assert.equal(result.size, spec.count, `${testId}: every question must be calibrated`);
  return result;
}

function buildBank(source, testId, spec) {
  assert.equal(source.schemaVersion, 2);
  assert.equal(source.testId, testId);
  assert.equal(source.questions.length, spec.count);
  assert.equal(source.questionsPerAttempt, 40);
  const calibration = calibrationMap(testId, spec);
  const seenQuestionIds = new Set();
  const seenOptionIds = new Set();
  const questions = source.questions.map((oldQuestion, index) => {
    const difficulty = calibration.get(index + 1);
    const profile = PROFILE[difficulty];
    const newQuestionId = `${spec.prefix}_${String(index + 1).padStart(3, "0")}`;
    assert(!seenQuestionIds.has(newQuestionId));
    seenQuestionIds.add(newQuestionId);
    const correctText = oldQuestion.options.find(option => option.id === oldQuestion.correctOptionId)?.text;
    assert(correctText, `${oldQuestion.id}: correct answer missing`);
    const options = oldQuestion.options.map(option => ({
      id: optionId(testId, newQuestionId, option.text),
      text: option.text
    })).sort((left, right) => left.id.localeCompare(right.id));
    options.forEach(option => {
      assert.match(option.id, /^opt_[a-f0-9]{20}$/);
      assert(!seenOptionIds.has(option.id), `${option.id}: option collision`);
      seenOptionIds.add(option.id);
    });
    const correctOptionId = options.find(option => option.text === correctText)?.id;
    assert(correctOptionId, `${oldQuestion.id}: calibrated correct answer missing`);
    return {
      id: newQuestionId,
      topic: oldQuestion.topic,
      block: oldQuestion.block,
      difficulty,
      timeLimit: profile.timeLimit,
      points: profile.points,
      text: TEXT_PATCHES[oldQuestion.id] || oldQuestion.text,
      context: oldQuestion.context,
      options,
      correctOptionId,
      comment: oldQuestion.comment
    };
  });
  const privateBank = {
    schemaVersion: 2,
    testId,
    testVersion: spec.version,
    bankVersion: spec.version,
    questionsPerAttempt: 40,
    blocks: source.blocks,
    questions,
    publicDigest: ""
  };
  const publicCore = canonicalPublic(privateBank);
  privateBank.publicDigest = sha256Text(JSON.stringify(publicCore));
  const publicBank = { ...publicCore, publicDigest: privateBank.publicDigest };
  assert.equal(sha256Text(JSON.stringify(canonicalPublic(privateBank))), privateBank.publicDigest);
  return { privateBank, publicBank };
}

function writeJson(file, value) {
  const text = JSON.stringify(value, null, 2) + "\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
  return { text, bytes: Buffer.byteLength(text), fileSha256: sha256Bytes(Buffer.from(text, "utf8")) };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assertPrivateBoundary(args.privateOut, "Private output");
  assertPrivateBoundary(args.publicStage, "Public staging output");
  if (!fs.existsSync(args.source) || !fs.statSync(args.source).isDirectory()) throw new Error("Source v5 directory is missing");
  if (fs.existsSync(args.privateOut) || fs.existsSync(args.publicStage)) throw new Error("Output directory already exists");
  fs.mkdirSync(args.privateOut, { recursive: false });
  fs.mkdirSync(args.publicStage, { recursive: false });

  const manifest = {
    releaseId: "market-calibration-v6-2026-08-02-r1",
    reviewType: "AI-assisted market calibration; not independent human SME certification",
    targetCandidate: "strong university student in years 3-4 or entry-level specialist with up to one year of experience",
    sourcesCheckedAt: "2026-08-02",
    totalQuestions: 240,
    textSimplifications: Object.keys(TEXT_PATCHES).length,
    banks: []
  };
  const anchors = {};
  const pending = { releaseId: manifest.releaseId, banks: {} };
  const totals = { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 };

  for (const [testId, spec] of Object.entries(SPECS)) {
    const sourcePath = onlyJsonFile(path.join(args.source, testId));
    const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const { privateBank, publicBank } = buildBank(source, testId, spec);
    const privatePath = path.join(args.privateOut, testId, `${testId}-v6-0.json`);
    const publicPath = path.join(args.publicStage, `${testId}.json`);
    const privateFile = writeJson(privatePath, privateBank);
    const publicFile = writeJson(publicPath, publicBank);
    const privateDigest = sha256Text(JSON.stringify(privateBank));
    const actualDistribution = privateBank.questions.reduce((result, question) => {
      result[question.difficulty] += 1;
      totals[question.difficulty] += 1;
      return result;
    }, { easy: 0, medium: 0, calc: 0, case: 0, hard: 0 });
    assert.deepEqual(actualDistribution, spec.distribution);
    anchors[`${testId}|${spec.version}`] = privateDigest;
    pending.banks[testId] = {
      bankVersion: spec.version,
      questionCount: spec.count,
      publicDigest: privateBank.publicDigest,
      privateDigest
    };
    manifest.banks.push({
      testId,
      version: spec.version,
      questionCount: spec.count,
      difficultyDistribution: actualDistribution,
      privateFileSha256: privateFile.fileSha256,
      privateFileBytes: privateFile.bytes,
      publicFileSha256: publicFile.fileSha256,
      publicFileBytes: publicFile.bytes,
      privateDigest,
      publicDigest: privateBank.publicDigest
    });
    console.log(`${testId}: ${spec.version} questions=${spec.count} distribution=${JSON.stringify(actualDistribution)}`);
  }

  assert.deepEqual(totals, { easy: 62, medium: 88, calc: 55, case: 29, hard: 6 });
  writeJson(path.join(args.privateOut, "review-manifest.json"), manifest);
  writeJson(path.join(args.privateOut, "private-bank-anchors.v6.json"), anchors);
  writeJson(path.join(args.privateOut, "private-bank-review-pending.v6.json"), pending);
  console.log(`DONE: market-calibrated v6 banks built; totals=${JSON.stringify(totals)} textSimplifications=${Object.keys(TEXT_PATCHES).length}`);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
