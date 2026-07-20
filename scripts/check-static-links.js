#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith(".html")).sort();
const productionTestIds = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior"];
const allTestIds = productionTestIds.concat(["dev-quick"]);
let checkedLinks = 0;

function stripQueryAndFragment(value) {
  return String(value || "").split("#", 1)[0].split("?", 1)[0];
}

htmlFiles.forEach(fileName => {
  const html = fs.readFileSync(path.join(root, fileName), "utf8");
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1].trim();
    if (!reference || reference.startsWith("#") || /^(?:https?:|mailto:|tel:|data:)/i.test(reference)) continue;
    const localPath = stripQueryAndFragment(reference);
    if (!localPath) continue;
    assert(!localPath.includes(".."), fileName + " contains a parent-directory link: " + reference);
    assert(fs.existsSync(path.join(root, localPath)), fileName + " contains a missing local link: " + reference);
    checkedLinks++;
  }
});

const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
allTestIds.forEach(testId => {
  const dataFile = "data/" + testId + ".json";
  assert(fs.existsSync(path.join(root, dataFile)), "Missing public bank: " + dataFile);
  assert(candidate.includes('questionsFile: "' + dataFile + '"'), "test.html does not map " + testId + " to its bank");
  const bank = JSON.parse(fs.readFileSync(path.join(root, dataFile), "utf8"));
  assert.equal(bank.testId, testId, dataFile + " testId does not match its filename");
});
productionTestIds.forEach(testId => {
  assert(index.includes('href="test.html?test=' + testId + '"'), "index.html does not link production test: " + testId);
});
assert(!index.includes("test.html?test=dev-quick"), "dev-quick must not be linked from the public index");

console.log(
  "Static links passed: " + checkedLinks + " local HTML references and " +
  allTestIds.length + " exact data-bank mappings."
);
