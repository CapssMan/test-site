const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const bankIds = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior"];
const allowedDifficulties = new Set(["easy", "medium", "hard", "calc", "case"]);
const globalIds = new Map();
const globalTexts = new Map();
const results = [];
let totalErrors = 0;
let totalWarnings = 0;

function extractAssignedObject(source, variableName) {
  const marker = "const " + variableName + " =";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Assignment not found: ${variableName}`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace, index + 1);
  }

  throw new Error(`Object end not found: ${variableName}`);
}

const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");
const testConfig = vm.runInNewContext("(" + extractAssignedObject(frontend, "TEST_CONFIG") + ")");

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function average(values) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function countBy(values) {
  return values.reduce((result, value) => {
    const key = value === undefined || value === null || value === "" ? "<missing>" : String(value);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function addIssue(collection, type, location, message) {
  collection.push({ type, location, message });
  if (type === "error") totalErrors += 1;
  else totalWarnings += 1;
}

for (const bankId of bankIds) {
  const relativePath = path.join("data", bankId + ".json");
  const fullPath = path.join(root, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const bank = JSON.parse(source);
  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  const blockDefinitions = bank.blocks && typeof bank.blocks === "object" ? bank.blocks : {};
  const issues = [];
  const ids = new Map();
  const texts = new Map();
  const timeLimits = [];
  const points = [];
  let correctLongest = 0;

  if (bank.testId !== bankId) {
    addIssue(issues, "error", "meta.testId", `expected ${bankId}, got ${String(bank.testId || "<missing>")}`);
  }
  if (!String(bank.version || bank.bankVersion || "").trim()) {
    addIssue(issues, "error", "meta.version", "missing version");
  }
  if (!Number.isInteger(bank.totalQuestions) || bank.totalQuestions !== questions.length) {
    addIssue(issues, "error", "meta.totalQuestions", `expected ${questions.length}, got ${String(bank.totalQuestions)}`);
  }
  if (!questions.length) {
    addIssue(issues, "error", "questions", "bank is empty");
  }
  if (!Object.keys(blockDefinitions).length) {
    addIssue(issues, "error", "meta.blocks", "block definitions are missing");
  }

  const frontendConfig = testConfig[bankId];
  if (!frontendConfig) {
    addIssue(issues, "error", "test.html TEST_CONFIG", "test configuration is missing");
  } else {
    if (String(frontendConfig.questionsFile || "").replace(/\\/g, "/") !== relativePath.replace(/\\/g, "/")) {
      addIssue(issues, "error", "test.html questionsFile", `expected ${relativePath.replace(/\\/g, "/")}`);
    }
    const bankBlockKeys = Object.keys(blockDefinitions).sort();
    const configBlockKeys = Object.keys(frontendConfig.blocks || {}).sort();
    if (JSON.stringify(bankBlockKeys) !== JSON.stringify(configBlockKeys)) {
      addIssue(issues, "error", "test.html blocks", `config keys ${configBlockKeys.join(",")} do not match bank keys ${bankBlockKeys.join(",")}`);
    }
  }

  questions.forEach((question, index) => {
    const location = `#${index + 1}${question.id ? ` (${question.id})` : ""}`;
    const id = String(question.id || "").trim();
    const text = String(question.text || question.question || "").trim();
    const normalizedQuestion = normalizeText(text);
    const options = Array.isArray(question.options) ? question.options : [];
    const normalizedOptions = options.map(normalizeText);
    const correct = question.correct;
    const timeLimit = Number(question.timeLimit);
    const pointValue = Number(question.points);

    if (!id) {
      addIssue(issues, "error", location, "missing stable question id");
    } else {
      if (ids.has(id)) addIssue(issues, "error", location, `duplicate id; first seen at #${ids.get(id)}`);
      else ids.set(id, index + 1);

      if (globalIds.has(id)) {
        addIssue(issues, "error", location, `id duplicates ${globalIds.get(id)}`);
      } else {
        globalIds.set(id, `${bankId} #${index + 1}`);
      }
    }

    if (!text) {
      addIssue(issues, "error", location, "question text is empty");
    } else if (texts.has(normalizedQuestion)) {
      addIssue(issues, "error", location, `duplicate question text; first seen at #${texts.get(normalizedQuestion)}`);
    } else {
      texts.set(normalizedQuestion, index + 1);
      if (globalTexts.has(normalizedQuestion)) {
        addIssue(issues, "warning", location, `same text also appears at ${globalTexts.get(normalizedQuestion)}`);
      } else {
        globalTexts.set(normalizedQuestion, `${bankId} #${index + 1}`);
      }
    }

    if (options.length < 2) {
      addIssue(issues, "error", location, `expected at least 2 options, got ${options.length}`);
    }
    if (normalizedOptions.some(option => !option)) {
      addIssue(issues, "error", location, "one or more options are empty");
    }
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      addIssue(issues, "error", location, "answer options are not unique");
    }
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      addIssue(issues, "error", location, `invalid correct index ${String(correct)}`);
    } else {
      const lengths = options.map(option => String(option).trim().length);
      const longest = Math.max(...lengths);
      if (lengths[correct] === longest && lengths.filter(length => length === longest).length === 1) {
        correctLongest += 1;
      }
    }

    if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
      addIssue(issues, "error", location, `invalid timeLimit ${String(question.timeLimit)}`);
    } else {
      timeLimits.push(timeLimit);
      if (timeLimit < 15 || timeLimit > 300) {
        addIssue(issues, "warning", location, `unusual timeLimit ${timeLimit}`);
      }
    }

    if (!Number.isFinite(pointValue) || pointValue <= 0) {
      addIssue(issues, "error", location, `invalid points ${String(question.points)}`);
    } else {
      points.push(pointValue);
      if (!Number.isInteger(pointValue)) addIssue(issues, "warning", location, `fractional points ${pointValue}`);
    }

    const block = String(question.block || "").trim();
    if (!block) addIssue(issues, "error", location, "missing block");
    else if (!Object.prototype.hasOwnProperty.call(blockDefinitions, block)) {
      addIssue(issues, "error", location, `block ${block} is absent from bank.blocks`);
    }

    const difficulty = String(question.difficulty || "").trim().toLowerCase();
    if (!allowedDifficulties.has(difficulty)) {
      addIssue(issues, "error", location, `invalid difficulty ${String(question.difficulty || "<missing>")}`);
    }

    if (question.active !== undefined && typeof question.active !== "boolean") {
      addIssue(issues, "error", location, `active must be boolean, got ${typeof question.active}`);
    }
    if (question.context !== undefined && typeof question.context !== "string") {
      addIssue(issues, "error", location, `context must be string, got ${typeof question.context}`);
    }
    if (question.comment !== undefined && typeof question.comment !== "string") {
      addIssue(issues, "error", location, `comment must be string, got ${typeof question.comment}`);
    }
  });

  const usedBlocks = new Set(questions.map(question => String(question.block || "").trim()).filter(Boolean));
  Object.keys(blockDefinitions).forEach(block => {
    if (!usedBlocks.has(block)) addIssue(issues, "warning", `meta.blocks.${block}`, "block has no questions");
  });

  const activeCount = questions.filter(question => question.active !== false).length;
  const explicitlyInactive = questions.filter(question => question.active === false).length;
  const correctDistribution = countBy(questions.map(question => question.correct));
  results.push({
    bankId,
    relativePath: relativePath.replace(/\\/g, "/"),
    questions: questions.length,
    activeCount,
    explicitlyInactive,
    idCount: ids.size,
    commentCount: questions.filter(question => String(question.comment || "").trim()).length,
    contextCount: questions.filter(question => String(question.context || "").trim()).length,
    blockDistribution: countBy(questions.map(question => question.block)),
    difficultyDistribution: countBy(questions.map(question => question.difficulty)),
    correctDistribution,
    correctLongest,
    timeLimit: { min: Math.min(...timeLimits), max: Math.max(...timeLimits), average: average(timeLimits) },
    points: { min: Math.min(...points), max: Math.max(...points), average: average(points) },
    issues
  });
}

results.forEach(result => {
  console.log([
    result.relativePath,
    `questions=${result.questions}`,
    `active=${result.activeCount}`,
    `ids=${result.idCount}/${result.questions}`,
    `comments=${result.commentCount}/${result.questions}`,
    `errors=${result.issues.filter(issue => issue.type === "error").length}`,
    `warnings=${result.issues.filter(issue => issue.type === "warning").length}`,
    `time=${result.timeLimit.min}-${result.timeLimit.max}s`,
    `points=${result.points.min}-${result.points.max}`,
    `correctLongest=${result.correctLongest}`
  ].join(" "));
  result.issues.forEach(issue => console.log(`  ${issue.type.toUpperCase()} ${issue.location}: ${issue.message}`));
});

console.log(`TOTAL banks=${results.length} questions=${results.reduce((sum, result) => sum + result.questions, 0)} errors=${totalErrors} warnings=${totalWarnings}`);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ results, totalErrors, totalWarnings }, null, 2));
}

if (totalErrors > 0) process.exitCode = 1;
