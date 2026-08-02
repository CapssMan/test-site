"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");
const functionBlock = frontend.match(/function splitMarkdownTableRow[\s\S]+?(?=\n    function sanitizeQuestionContext)/);
assert.ok(functionBlock, "Markdown context renderer must remain present");

const sandbox = {
  escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
};
vm.createContext(sandbox);
vm.runInContext(functionBlock[0], sandbox);

let markdownTableCount = 0;
for (const fileName of ["fa-junior.json", "ca-junior.json", "fpa-junior.json", "acc-junior.json", "bi-junior.json"]) {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", fileName), "utf8"));
  for (const question of bank.questions) {
    const context = String(question.context || "");
    const lines = context.replace(/\r\n?/g, "\n").split("\n");
    const expectedTables = lines.filter((line, index) => {
      const cells = sandbox.splitMarkdownTableRow(line);
      return cells.length > 0 && index + 1 < lines.length &&
        sandbox.isMarkdownTableSeparator(lines[index + 1], cells.length);
    }).length;
    if (!expectedTables) continue;
    markdownTableCount += expectedTables;
    const rendered = sandbox.renderMarkdownQuestionContext(context);
    assert.equal((rendered.match(/<table class="context-table">/g) || []).length, expectedTables, `${fileName}:${question.id}`);
    assert.doesNotMatch(rendered, /\|\s*:?-{3,}/, `${fileName}:${question.id} leaked Markdown separator`);
    assert.match(rendered, /<thead><tr><th>/, `${fileName}:${question.id} missing semantic header`);
    assert.match(rendered, /<tbody>/, `${fileName}:${question.id} missing semantic body`);
  }
}

assert.equal(markdownTableCount, 92, "all current Markdown tables must render");
const hostile = sandbox.renderMarkdownQuestionContext("| Поле | Значение |\n|---|---|\n| <img src=x onerror=alert(1)> | безопасно |");
assert.doesNotMatch(hostile, /<img\b/i);
assert.match(hostile, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.match(frontend, /const FRONTEND_BUILD = "2026\.07\.31\.5"/);
assert.match(frontend, /postBeginAttemptWithRetry\(payload, 0\)/);
assert.match(frontend, /новое место не расходуется/);

console.log(`Question context rendering checks passed: ${markdownTableCount} Markdown tables and idempotent begin retry.`);
