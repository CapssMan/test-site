#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TEST_FILES = [
  "data/fa-junior.json",
  "data/ca-junior.json",
  "data/fpa-junior.json",
  "data/acc-junior.json",
  "data/bi-junior.json"
];
const PRIVATE_KEYS = new Set([
  "correct", "correctindex", "correctanswer", "correctoption", "correctoptionid",
  "iscorrect", "answer", "answerkey", "comment", "explanation", "rationale",
  "solution", "solutions"
]);

function normalizedKey(value) {
  return String(value).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function findPrivateFields(value, location, result) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPrivateFields(item, `${location}[${index}]`, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.keys(value).forEach(key => {
    const normalized = normalizedKey(key);
    if (PRIVATE_KEYS.has(normalized) || normalized.startsWith("private")) result.push(`${location}.${key}`);
    findPrivateFields(value[key], `${location}.${key}`, result);
  });
}

let hasError = false;

for (const file of TEST_FILES) {
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  const privateFields = [];
  let structuralErrors = 0;
  let optionLengthSpreadSum = 0;

  if (bank.schemaVersion !== 2 || bank.testVersion !== bank.bankVersion || !/^[a-f0-9]{64}$/.test(bank.publicDigest || "")) {
    structuralErrors += 1;
    console.error(`${file}: invalid schema/version/publicDigest metadata`);
  }
  if (!Number.isInteger(bank.questionsPerAttempt) || bank.questionsPerAttempt < 1 || bank.questionsPerAttempt > questions.length) {
    structuralErrors += 1;
    console.error(`${file}: invalid questionsPerAttempt`);
  }

  findPrivateFields(bank, file, privateFields);
  privateFields.forEach(location => console.error(`${location}: private answer field is forbidden`));
  structuralErrors += privateFields.length;

  const questionIds = new Set();
  const optionIds = new Set();
  questions.forEach((question, index) => {
    const options = Array.isArray(question.options) ? question.options : [];
    if (!question.text || !question.id || questionIds.has(question.id)) {
      structuralErrors += 1;
      console.error(`${file} #${index + 1}: missing/duplicate question id or text`);
    }
    questionIds.add(question.id);
    if (!bank.blocks || !Object.prototype.hasOwnProperty.call(bank.blocks, question.block)) {
      structuralErrors += 1;
      console.error(`${file} #${index + 1}: unknown block ${String(question.block)}`);
    }
    if (options.length !== 4) {
      structuralErrors += 1;
      console.error(`${file} #${index + 1}: expected 4 opaque options, got ${options.length}`);
    }
    const lengths = [];
    options.forEach((option, optionIndex) => {
      if (!option || typeof option.text !== "string" || !option.text.trim() || !/^opt_[a-f0-9]{20}$/.test(option.id || "") || optionIds.has(option.id)) {
        structuralErrors += 1;
        console.error(`${file} #${index + 1} option #${optionIndex + 1}: invalid/duplicate opaque option`);
      }
      optionIds.add(option && option.id);
      lengths.push(String(option && option.text || "").length);
    });
    if (lengths.length) optionLengthSpreadSum += Math.max(...lengths) - Math.min(...lengths);
  });

  const averageOptionLengthSpread = questions.length
    ? Math.round(optionLengthSpreadSum / questions.length)
    : 0;
  console.log([
    `${file}:`,
    `questions=${questions.length}`,
    `attempt=${bank.questionsPerAttempt}`,
    `structuralErrors=${structuralErrors}`,
    `privateAnswerFields=${privateFields.length}`,
    `avgOptionLengthSpread=${averageOptionLengthSpread}`
  ].join(" "));
  if (structuralErrors > 0) hasError = true;
}

if (hasError) process.exitCode = 1;
