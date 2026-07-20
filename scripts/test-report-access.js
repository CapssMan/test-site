const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "admin.html"), "utf8");
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

const doGetFunction = extractFunction(backend, "doGet");
assert.match(doGetFunction, /\["adminResults", "adminReport"[\s\S]*\.indexOf\(action\) !== -1/, "admin report GET route must be rejected by the admin POST-only gate");
assert.match(doGetFunction, /требуется POST-запрос/, "admin report GET route must be rejected");
assert.doesNotMatch(doGetFunction, /getAdminReport\(/, "GET must never call report retrieval");

const doPostFunction = extractFunction(backend, "doPost");
assert.match(doPostFunction, /action === "getAdminReport" \|\| action === "adminReport"/, "admin report must have a POST route");
assert.match(doPostFunction, /getAdminReport\(String\(data\.password/, "POST route must pass the admin password");

const requestReportFunction = extractFunction(frontend, "requestAdminReport");
const requestActionFunction = extractFunction(frontend, "requestAdminAction");
const downloadFunction = extractFunction(frontend, "downloadAdminReport");
assert.match(requestReportFunction, /requestAdminAction\("adminReport", password/, "frontend must use protected admin report action");
assert.match(requestActionFunction, /method:\s*"POST"/, "report request must use POST");
assert.doesNotMatch(requestActionFunction, /[?&](?:password|code)=/, "credentials and code must not be placed in URL");
assert.match(downloadFunction, /new Blob\(\["\\uFEFF", data\.reportText\]/, "report must be downloaded as a UTF-8 text blob");
assert.match(downloadFunction, /link\.download = normalizedCode \+ "\.txt"/, "download filename must be derived from validated code");
assert.doesNotMatch(downloadFunction, /innerHTML|insertAdjacentHTML|document\.write/, "full report must not be rendered into the admin page");
assert.match(frontend, /Отчёт содержит персональные данные/, "admin must warn about personal data in the full report");

const frontendContext = { String };
vm.runInNewContext(extractFunction(frontend, "normalizeResultCode"), frontendContext);
assert.equal(frontendContext.normalizeResultCode(" fa-23456 "), "FA-23456", "frontend normalizes a valid code");
assert.equal(frontendContext.normalizeResultCode("FA-AAAAA/../../private"), "", "frontend rejects path traversal");
assert.equal(frontendContext.normalizeResultCode("FA-00000"), "", "frontend rejects characters outside the code alphabet");

const versionMatch = /^const BACKEND_VERSION = "([^"]+)";/m.exec(backend);
assert(versionMatch, "backend version not found");

let storedResults = [];
let reportText = null;
let throwReportRead = false;
let jsonReadCount = 0;
let textReadCount = 0;
let lastTextPath = "";

const backendContext = {
  String,
  console: { log() {}, error() {} },
  isAdminPasswordValid: password => password === "correct-admin-password",
  getRequiredProperty: () => "correct-admin-password",
  getAdminFilePath: () => "disk:/skillcheck/admin/results.json",
  getReportsFolderPath: () => "disk:/skillcheck/reports",
  joinDiskPath: (folder, name) => folder.replace(/\/$/, "") + "/" + name,
  readJsonFromYandexDisk: () => {
    jsonReadCount += 1;
    return storedResults;
  },
  readTextFromYandexDisk: reportPath => {
    textReadCount += 1;
    lastTextPath = reportPath;
    if (throwReportRead) throw new Error("secret disk:/internal/path");
    return reportText;
  }
};

vm.runInNewContext(
  'const BACKEND_VERSION = "' + versionMatch[1] + '";\n' +
    "const MAX_ADMIN_REPORT_CHARS = 1000000;\n" +
    extractFunction(backend, "normalizeResultCode") + "\n" +
    extractFunction(backend, "buildUnavailableAdminReportResponse") + "\n" +
    extractFunction(backend, "getAdminReport"),
  backendContext
);

function resetReads() {
  jsonReadCount = 0;
  textReadCount = 0;
  lastTextPath = "";
  throwReportRead = false;
  reportText = null;
}

resetReads();
let response = backendContext.getAdminReport("wrong-password", "FA-23456");
assert.equal(response.ok, false, "wrong password must be rejected");
assert.equal(response.message, "Доступ запрещён.");
assert.equal(jsonReadCount, 0, "wrong password must be rejected before reading admin data");
assert.equal(textReadCount, 0, "wrong password must never read a report");

resetReads();
response = backendContext.getAdminReport("correct-admin-password", "../../private/report.txt");
assert.equal(response.status, "not_found", "invalid code gets a neutral response");
assert.equal(response.message, "Отчёт недоступен.");
assert.equal(jsonReadCount, 0, "invalid code must be rejected before storage access");
assert.equal(textReadCount, 0, "invalid code must never read a report path");

resetReads();
storedResults = [];
response = backendContext.getAdminReport("correct-admin-password", "FA-23456");
assert.equal(response.status, "not_found", "unknown code gets a neutral response");
assert.equal(textReadCount, 0, "unknown code must not probe the reports folder");

resetReads();
storedResults = [{ code: "FA-23456", status: "failed", reportCreated: false }];
response = backendContext.getAdminReport("correct-admin-password", "fa-23456");
assert.equal(response.status, "not_found", "failed result has no report");
assert.equal(textReadCount, 0, "failed result must not read a TXT");

resetReads();
storedResults = [{ code: "FA-23456", status: "passed", reportCreated: true, reportPath: "disk:/attacker/override.txt" }];
reportText = "Имя: Тестовый Кандидат\nEmail: private@example.com\n";
response = backendContext.getAdminReport("correct-admin-password", "fa-23456");
assert.equal(response.ok, true, "authorized admin can retrieve an existing report");
assert.equal(response.code, "FA-23456");
assert.equal(response.filename, "FA-23456.txt");
assert.equal(response.reportText, reportText);
assert.equal(lastTextPath, "disk:/skillcheck/reports/FA-23456.txt", "backend must derive the report path and ignore stored/client paths");
assert.equal(textReadCount, 1, "existing report is read once");

resetReads();
storedResults = [{ code: "FA-23456", status: "passed", reportCreated: true }];
reportText = "x".repeat(1000001);
response = backendContext.getAdminReport("correct-admin-password", "FA-23456");
assert.equal(response.status, "not_found", "oversized report gets a neutral response");
assert.equal(response.reportText, undefined, "oversized report content must not be returned");

resetReads();
throwReportRead = true;
response = backendContext.getAdminReport("correct-admin-password", "FA-23456");
assert.equal(response.status, "error", "storage failure is reported as a generic error");
assert.equal(response.message, "Не удалось получить отчёт.");
assert.doesNotMatch(JSON.stringify(response), /disk:|internal|secret/, "storage details must not leak to the client");

console.log("Report access tests passed: admin-only POST, code validation, neutral misses, derived path, size limit and generic errors.");
