#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const scriptFiles = fs.readdirSync(path.join(root, "scripts"))
  .filter(name => name.endsWith(".js"))
  .sort()
  .map(name => path.join("scripts", name));
const sourceFiles = ["apps-script/Code.gs"].concat(scriptFiles);
let compiledBlocks = 0;

function compile(source, filename) {
  const normalized = String(source).replace(/^#![^\r\n]*(?:\r?\n|$)/, "");
  new vm.Script(normalized, { filename });
  compiledBlocks++;
}

sourceFiles.forEach(fileName => {
  compile(fs.readFileSync(path.join(root, fileName), "utf8"), fileName);
});

const htmlFiles = fs.readdirSync(root).filter(name => name.endsWith(".html")).sort();
htmlFiles.forEach(fileName => {
  const html = fs.readFileSync(path.join(root, fileName), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, index) => compile(match[1], fileName + "#inline-" + String(index + 1)));
});

console.log(
  "JavaScript syntax passed: " + sourceFiles.length + " source files, " +
  htmlFiles.length + " HTML files, " + compiledBlocks + " compiled blocks."
);
