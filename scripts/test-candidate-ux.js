const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const testPage = fs.readFileSync(path.join(root, "test.html"), "utf8");
const indexPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const match = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(").exec(source);
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

const scripts = Array.from(testPage.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]);
assert(scripts.length, "candidate page must contain JavaScript");
scripts.forEach(source => new vm.Script(source));

assert.doesNotMatch(testPage, /<base\s+target=["']_blank["']/i, "candidate links must not force a new tab");
assert.doesNotMatch(indexPage, /<base\s+target=["']_blank["']/i, "home links must not force a new tab");
assert.match(testPage, /<label for="name">[\s\S]*?<input[^>]+id="name"[^>]+required/i, "name must have a required label");
assert.match(testPage, /<label for="email">[\s\S]*?<input[^>]+id="email"[^>]+required/i, "email must have a required label");
assert.match(testPage, /id="privacyConsent"[^>]+required/i, "privacy consent must be required");
assert.match(testPage, /id="ageConsent"[^>]+required/i, "age confirmation must be required");
assert.match(testPage, /id="employerShareConsent"[\s\S]{0,160}<b>Необязательно:<\/b>/i, "employer sharing must be explicitly optional");
assert.doesNotMatch(testPage, /id="startButton"[^>]+onclick=/i, "start button must not use an inline handler");
assert.doesNotMatch(testPage, /id="nextButton"[^>]+onclick=/i, "next button must not use an inline handler");
assert.match(testPage, /const FRONTEND_BUILD = "2026\.07\.20\.7"/, "candidate build must be current");
assert.match(testPage, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/i, "progress must expose ARIA state");
assert.match(testPage, /Результат является предварительной оценкой отдельных навыков/, "result must include the hiring disclaimer");
assert.match(testPage, /window\.addEventListener\("beforeunload"/, "candidate must be warned before leaving an active or pending attempt");

const loadQuestions = extractFunction(testPage, "loadQuestions");
assert.match(loadQuestions, /cache:\s*"no-store"/, "question bank must be loaded without stale cache");
assert.doesNotMatch(loadQuestions, /questionsFile[^\n]*setAttemptStatus|Файл:|err\.message[^\n]*setAttemptStatus/, "load error must not reveal internal configuration");

const checkAttempt = extractFunction(testPage, "checkAttempt");
assert.match(checkAttempt, /method:\s*"POST"/, "retake check must use POST");
assert.match(checkAttempt, /new AbortController\(\)/, "retake check must have a timeout controller");
assert.doesNotMatch(checkAttempt, /createElement\(["']script["']\)|callback=|[?&]email=/, "retake check must not expose candidate data in a URL");

const nextQuestion = extractFunction(testPage, "nextQuestion");
const saveCurrentAnswer = extractFunction(testPage, "saveCurrentAnswer");
assert.match(nextQuestion, /questionTransitionInProgress \|\| currentQuestionSaved \|\| testFinished/, "question transition must reject duplicate actions");
assert.match(saveCurrentAnswer, /if \(currentQuestionSaved\) return false/, "answer must be recorded once");

const sendResult = extractFunction(testPage, "sendResult");
assert.match(sendResult, /resultSubmissionInFlight \|\| resultSaved/, "result send must reject duplicate clicks");
assert.match(extractFunction(testPage, "postResultOnce"), /new AbortController\(\)/, "result send must have a timeout controller");
assert.match(sendResult, /pendingResultData = data/, "calculated result must remain available for retry");
assert.match(sendResult, /retryButton\.hidden = !retryable/, "retryable send failure must expose retry");
assert.doesNotMatch(sendResult, /reportPath|savedAttempt|savedAdmin/, "candidate response UI must not expose storage internals");
assert.match(extractFunction(testPage, "generateSubmissionRequestId"), /sc_/, "each result must get an idempotency key");

const expectedCards = [
  ["fa-junior", "~40 мин", "6 блоков"],
  ["ca-junior", "~35 мин", "8 блоков"],
  ["fpa-junior", "~40 мин", "8 блоков"],
  ["acc-junior", "~35 мин", "8 блоков"],
  ["bi-junior", "~40 мин", "8 блоков"]
];
expectedCards.forEach(([testId, minutes, blocks]) => {
  assert.match(indexPage, new RegExp('href="test\\.html\\?test=' + testId + '"'), "home must link to " + testId);
  const cardStart = indexPage.lastIndexOf('<article class="test-card">', indexPage.indexOf('test=' + testId));
  const cardEnd = indexPage.indexOf("</article>", cardStart);
  const card = indexPage.slice(cardStart, cardEnd);
  assert(card.includes(minutes), testId + " must show accurate time");
  assert(card.includes(blocks), testId + " must show accurate block count");
});
assert.match(indexPage, /<div class="stat-number">240<\/div>/, "home must show the exact production bank size");

const helperContext = { Math, Number, String };
vm.runInNewContext(
  extractFunction(testPage, "estimateAttemptMinutes") + "\n" +
  extractFunction(testPage, "pluralizeRu") + "\n" +
  extractFunction(testPage, "isValidEmail"),
  helperContext
);
assert.equal(helperContext.estimateAttemptMinutes([{ timeLimit: 60 }, { timeLimit: 90 }], 40), 50);
assert.equal(helperContext.pluralizeRu(1, "вопрос", "вопроса", "вопросов"), "вопрос");
assert.equal(helperContext.pluralizeRu(22, "вопрос", "вопроса", "вопросов"), "вопроса");
assert.equal(helperContext.pluralizeRu(15, "вопрос", "вопроса", "вопросов"), "вопросов");
assert.equal(helperContext.isValidEmail("candidate@example.com"), true);
assert.equal(helperContext.isValidEmail("candidate@invalid"), false);

const doPost = extractFunction(backend, "doPost");
assert.match(doPost, /data\.action === "checkAttempt"/, "backend must accept retake checks via POST");
assert.match(doPost, /checkAttemptHash\(/, "POST retake route must use the existing server check");

const saveTestResult = extractFunction(backend, "saveTestResult");
assert(saveTestResult.indexOf("findAdminResultByRequestId") < saveTestResult.indexOf("checkAttemptHash"), "idempotency lookup must happen before retake rejection");
assert.match(saveTestResult, /buildSavedResultResponse\(existingResult, true\)/, "replay must return the existing result");
assert.match(saveTestResult, /requestId:\s*requestId/, "admin record must persist the idempotency key");
assert.doesNotMatch(extractFunction(backend, "buildSavedResultResponse"), /reportPath|savedAttempt|savedAdmin/, "public save response must not reveal storage internals");

let storedRows = [];
const backendContext = {
  String,
  Number,
  Boolean,
  getAdminFilePath: () => "disk:/skillcheck/admin/results.json",
  readJsonFromYandexDisk: () => storedRows
};
vm.runInNewContext(
  extractFunction(backend, "normalizeSubmissionRequestId") + "\n" +
  extractFunction(backend, "findAdminResultByRequestId") + "\n" +
  extractFunction(backend, "buildSavedResultResponse"),
  backendContext
);
assert.equal(backendContext.normalizeSubmissionRequestId("sc_1234567890abcdef"), "sc_1234567890abcdef");
assert.equal(backendContext.normalizeSubmissionRequestId("../../secret"), "");
storedRows = [{ requestId: "sc_1234567890abcdef", code: "FA-23456", testId: "fa-junior", finalScore: 81, percent: 84, status: "passed", reportCreated: true, reportPath: "disk:/secret" }];
const existing = backendContext.findAdminResultByRequestId("sc_1234567890abcdef");
assert.equal(existing.code, "FA-23456");
const replay = backendContext.buildSavedResultResponse(existing, true);
assert.equal(replay.replayed, true);
assert.equal(replay.resultCode, "FA-23456");
assert.equal(Object.hasOwn(replay, "reportPath"), false);

console.log("Candidate UX tests passed.");
