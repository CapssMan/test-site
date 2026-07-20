const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const match = new RegExp("function\\s+" + name + "\\s*\\(").exec(source);
  assert(match, "Function not found: " + name);
  const openingBrace = source.indexOf("{", match.index);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }

  throw new Error("Function end not found: " + name);
}

const deterministicMath = Object.create(Math);
let randomState = 17;
deterministicMath.random = function() {
  randomState = (randomState * 48271) % 2147483647;
  return randomState / 2147483647;
};

const frontendContext = { Math: deterministicMath, Number, Object, Array, Boolean, isNaN };
const frontendFunctions = [
  "shuffleArray",
  "selectRandomQuestions",
  "normalizeQuestionBank",
  "getQuestionsPerAttempt",
  "normalizeQuestion",
  "prepareQuestions",
  "calculatePenalty",
  "getBadge",
  "calculateTrustScore",
  "getCandidateRecommendation",
  "calculateTestResult"
].map(name => extractFunction(frontend, name)).join("\n");

vm.runInNewContext(
  "const QUESTIONS_PER_ATTEMPT = 40;\nconst SUCCESS_THRESHOLD = 80;\n" + frontendFunctions,
  frontendContext
);

assert.deepEqual(
  [0, 1, 2, 3, 4, 20].map(frontendContext.calculatePenalty),
  [0, 3, 7, 7, 15, 15],
  "tab-switch penalties"
);
assert.equal(
  frontendContext.normalizeQuestionBank({ questions: [{ id: "active" }, { id: "inactive", active: false }] }).questions.length,
  1,
  "inactive questions must be excluded"
);

function answer(points, earnedPoints, selectedAnswer = "Ответ", status = earnedPoints ? "Верно" : "Неверно") {
  return { points, earnedPoints, selectedAnswer, status };
}

const blocks = {
  finance: { name: "Финансы", weight: 0.6 },
  excel: { name: "Excel", weight: 0.4 }
};

const perfectAnswers = [answer(4, 4), answer(3, 3), answer(3, 3)];
const perfect = frontendContext.calculateTestResult(
  perfectAnswers,
  0,
  blocks,
  { finance: { earned: 7, total: 7 }, excel: { earned: 3, total: 3 } }
);
assert.deepEqual(
  [perfect.rawScore, perfect.rawTotal, perfect.percent, perfect.penalty, perfect.finalScore],
  [10, 10, 100, 0, 100],
  "100% scenario"
);
assert.equal(perfect.passStatus, "passed");
assert.equal(perfect.badge, "Junior Strong");
assert.equal(perfect.trustScore, 100);
assert.equal(perfect.recommendation, "Рекомендуется к интервью");
assert.equal(perfect.blockResults.finance.percent, 100);

const zero = frontendContext.calculateTestResult(
  [answer(5, 0, "Нет ответа", "Время вышло"), answer(5, 0, "Нет ответа", "Нет ответа")],
  0,
  blocks,
  { finance: { earned: 0, total: 5 }, excel: { earned: 0, total: 5 } }
);
assert.deepEqual([zero.percent, zero.finalScore, zero.passStatus], [0, 0, "failed"], "0% scenario");
assert.equal(zero.badge, "Not Confirmed");
assert.equal(zero.recommendation, "Не рекомендуется без дополнительной проверки");

const thresholdAnswers = [answer(2, 2), answer(2, 2), answer(2, 2), answer(2, 2), answer(2, 0)];
const threshold = frontendContext.calculateTestResult(
  thresholdAnswers,
  0,
  blocks,
  { finance: { earned: 4, total: 6 }, excel: { earned: 4, total: 4 } }
);
assert.equal(threshold.percent, 80, "exact threshold percent");
assert.equal(threshold.finalScore, 80, "exact threshold final score");
assert.equal(threshold.passStatus, "passed", "exact threshold must pass");
assert.equal(threshold.finalDecision, "Успешно");

const penalized = frontendContext.calculateTestResult(
  thresholdAnswers,
  1,
  blocks,
  { finance: { earned: 4, total: 6 }, excel: { earned: 4, total: 4 } }
);
assert.equal(penalized.penalty, 3);
assert.equal(penalized.finalScore, 77);
assert.equal(penalized.passStatus, "failed", "penalty must be able to turn a pass into a fail");

const empty = frontendContext.calculateTestResult([], 4, blocks, {});
assert.deepEqual([empty.rawScore, empty.rawTotal, empty.percent, empty.finalScore], [0, 0, 0, 0]);
assert(Number.isFinite(empty.finalScore), "empty result must not become NaN");

const malformedHigh = frontendContext.calculateTestResult(
  [answer(1, 2)],
  0,
  blocks,
  { finance: { earned: 2, total: 1 }, excel: { earned: 0, total: 0 } }
);
assert.equal(malformedHigh.percent, 100, "percent must be capped at 100");
assert.equal(malformedHigh.finalScore, 100, "final score must be capped at 100");
assert.equal(malformedHigh.blockResults.finance.percent, 100, "block percent must be capped at 100");

const selectedTimeout = [answer(1, 1, "Выбранный ответ", "Верно")];
selectedTimeout[0].timedOut = true;
assert.equal(
  frontendContext.calculateTrustScore(80, 0, selectedTimeout),
  85,
  "a selected answer at timeout must not count as unanswered"
);
assert.equal(frontendContext.getCandidateRecommendation(90, 90, 90, 3), "Результат требует осторожной интерпретации");
assert.equal(frontendContext.getBadge(85, 1), "Junior Strong");
assert.equal(frontendContext.getBadge(85, 2), "Junior Confirmed");
assert.equal(frontendContext.getBadge(60, 4), "Borderline");

const bankFiles = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior", "dev-quick"];
bankFiles.forEach(testId => {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", testId + ".json"), "utf8"));
  const activeQuestions = bank.questions.filter(question => question.active !== false);
  const snapshot = JSON.stringify(activeQuestions);
  const prepared = frontendContext.prepareQuestions(activeQuestions);
  const expectedCount = Math.min(40, activeQuestions.length);
  const identities = prepared.map(question => question.id || question.text);

  assert.equal(prepared.length, expectedCount, testId + ": question count");
  assert.equal(new Set(identities).size, prepared.length, testId + ": no duplicates in attempt");
  assert.equal(JSON.stringify(activeQuestions), snapshot, testId + ": source bank must not be mutated");
  prepared.forEach(question => {
    assert.equal(question.options[question.correct], question.correctAnswerText, testId + ": shuffled correct index");
  });
});

const saveAnswerSource = extractFunction(frontend, "saveCurrentAnswer");
assert(/timedOut:\s*Boolean\(isTimeout\)/.test(saveAnswerSource), "timeout flag must be explicit");
assert(/isUnanswered\s*\?\s*\(isTimeout\s*\?\s*"Время вышло"/.test(saveAnswerSource), "only unanswered timeout gets timeout status");
const timerSource = extractFunction(frontend, "renderCurrentQuestion");
assert(/questionTimeLeft--/.test(timerSource) && /saveCurrentAnswer\(true\)/.test(timerSource), "timer must autosave and advance");
assert(!/previousQuestion|prevButton|Назад/.test(frontend), "test must not allow returning to previous questions");

const finishSource = extractFunction(frontend, "finishTest");
["rawScore", "rawTotal", "percent", "finalScore", "penalty", "badge", "trustScore", "blockResults", "recommendation"]
  .forEach(field => assert(new RegExp(field + "\\s*:").test(finishSource), "payload field missing: " + field));

const backendContext = {
  Number,
  Object,
  Array,
  Math,
  TEST_TITLES_BY_ID: { "fa-junior": "Financial Analyst Junior" },
  safeText(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\r/g, " ").trim();
  }
};
vm.runInNewContext(extractFunction(backend, "buildTxtReport"), backendContext);

const report = backendContext.buildTxtReport({
  code: "FA-AUDIT",
  testId: "fa-junior",
  testTitle: "Financial Analyst Junior",
  completedAt: "2026-07-20T12:00:00.000Z",
  name: "Audit Candidate",
  email: "audit@example.test",
  rawScore: 8,
  rawTotal: 10,
  percent: 80,
  finalScore: 77,
  penalty: 3,
  tabSwitches: 1,
  trustScore: 75,
  badge: "Junior Confirmed",
  status: "failed",
  recommendation: "Можно рассмотреть",
  blockResults: {
    finance: { name: "Финансы", weight: 0.6, earned: 4, total: 6, percent: 67 }
  },
  answers: [{
    question: "Аудит-вопрос",
    selectedAnswer: "Ответ A",
    correctAnswer: "Ответ B",
    isCorrect: false,
    status: "Неверно",
    earnedPoints: 0,
    points: 2,
    timeSpent: 12,
    timeLimit: 45
  }]
});

[
  "Сырой результат: 8/10",
  "Итоговый балл: 77",
  "Процент: 80",
  "Штрафы: 3",
  "Уходы со вкладки: 1",
  "Trust Score: 75",
  "Плашка: Junior Confirmed",
  "Статус: failed",
  "Финансы: 67% (4/6 баллов, вес 60%)",
  "Статус ответа: Неверно",
  "Время: 12/45 сек."
].forEach(expected => assert(report.includes(expected), "TXT field missing: " + expected));

const backendSaveSource = extractFunction(backend, "saveTestResult");
assert(/finalScore\s*>=\s*SUCCESS_THRESHOLD/.test(backendSaveSource), "backend pass threshold must use final score");

console.log("Scoring stage checks: OK");
