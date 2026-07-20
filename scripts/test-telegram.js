const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const testHtml = fs.readFileSync(path.join(root, "test.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const privacyHtml = fs.readFileSync(path.join(root, "privacy.html"), "utf8");

function extractFunction(source, name, indentation) {
  const prefix = indentation + "function " + name + "(";
  const start = source.indexOf(prefix);
  assert.notEqual(start, -1, "Function not found: " + name);

  const closing = "\n" + indentation + "}";
  const end = source.indexOf(closing, start);
  assert.notEqual(end, -1, "Function end not found: " + name);
  return source.slice(start + indentation.length, end + closing.length);
}

const frontendSource = extractFunction(testHtml, "normalizeTelegramContact", "    ");
const backendSource = extractFunction(backend, "normalizeTelegramContact", "");
const frontendContext = {};
const backendContext = {
  safeText(value) {
    return String(value === undefined || value === null ? "" : value).replace(/\r/g, " ").trim();
  }
};

vm.runInNewContext(frontendSource, frontendContext);
vm.runInNewContext(backendSource, backendContext);

const validCases = [
  ["@skillcheck_user", "@skillcheck_user"],
  ["skillcheck_user", "@skillcheck_user"],
  ["t.me/skillcheck_user", "@skillcheck_user"],
  ["https://t.me/skillcheck_user", "@skillcheck_user"],
  ["  https://www.t.me/SkillCheck_2026  ", "@SkillCheck_2026"],
  ["", ""],
  ["   ", ""]
];

validCases.forEach(([input, expected]) => {
  assert.equal(frontendContext.normalizeTelegramContact(input), expected, "frontend: " + input);
  assert.equal(backendContext.normalizeTelegramContact(input), expected, "backend: " + input);
});

["@", "name with spaces", "https://example.com/user", "имя"].forEach(input => {
  assert.throws(() => frontendContext.normalizeTelegramContact(input), /Telegram/);
  assert.throws(() => backendContext.normalizeTelegramContact(input), /Telegram/);
});

const emailPosition = testHtml.indexOf('id="email"');
const telegramPosition = testHtml.indexOf('id="telegram"');
assert(emailPosition >= 0 && telegramPosition > emailPosition, "Telegram field must follow email");

const adminWriter = extractFunction(backend, "appendAdminResult", "");
const attemptWriter = extractFunction(backend, "saveAttemptHash", "");
const reportFormatter = extractFunction(backend, "buildTxtReport", "");
assert(!/telegram/i.test(adminWriter), "Telegram must not be written to admin results");
assert(!/telegram/i.test(attemptWriter), "Telegram must not be written to attempts");
assert(/Telegram:/.test(reportFormatter), "Successful TXT formatter must support Telegram");
assert(!/telegram/i.test(adminHtml), "Admin UI must not expose Telegram");
assert(/Полный TXT[^<]*предоставленные кандидатом контакты/.test(privacyHtml), "Privacy storage rule is missing");

console.log("Telegram stage checks: OK");
