#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bankIds = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior"];
const expectedCounts = { "fa-junior": 40, "ca-junior": 80, "fpa-junior": 40, "acc-junior": 40, "bi-junior": 40 };
const allowedDifficulties = new Set(["easy", "medium", "hard", "calc", "case"]);
const globalIds = new Map();
const globalTexts = new Map();
const results = [];
let totalErrors = 0;
let totalWarnings = 0;

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
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
  const relativePath = `data/${bankId}.json`;
  const bank = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  const blockDefinitions = bank.blocks && typeof bank.blocks === "object" ? bank.blocks : {};
  const issues = [];
  const ids = new Map();
  const texts = new Map();
  const optionIds = new Set();
  const timeLimits = [];
  const points = [];

  if (bank.schemaVersion !== 2) addIssue(issues, "error", "meta.schemaVersion", "expected public schema 2");
  if (bank.testId !== bankId) addIssue(issues, "error", "meta.testId", `expected ${bankId}, got ${String(bank.testId || "<missing>")}`);
  if (!bank.testVersion || bank.testVersion !== bank.bankVersion) addIssue(issues, "error", "meta.version", "testVersion/bankVersion mismatch");
  if (!/^[a-f0-9]{64}$/.test(bank.publicDigest || "")) addIssue(issues, "error", "meta.publicDigest", "missing SHA-256 digest");
  if (questions.length !== expectedCounts[bankId]) addIssue(issues, "error", "questions", `expected ${expectedCounts[bankId]}, got ${questions.length}`);
  if (bank.questionsPerAttempt !== 40) addIssue(issues, "error", "meta.questionsPerAttempt", "production attempts must contain 40 questions");
  if (!Object.keys(blockDefinitions).length) addIssue(issues, "error", "meta.blocks", "block definitions are missing");

  questions.forEach((question, index) => {
    const location = `#${index + 1}${question.id ? ` (${question.id})` : ""}`;
    const id = String(question.id || "").trim();
    const text = String(question.text || "").trim();
    const normalizedQuestion = normalizeText(text);
    const options = Array.isArray(question.options) ? question.options : [];
    const normalizedOptions = options.map(option => normalizeText(option && option.text));
    const timeLimit = Number(question.timeLimit);
    const pointValue = Number(question.points);

    if (!id) addIssue(issues, "error", location, "missing stable question id");
    else {
      if (ids.has(id)) addIssue(issues, "error", location, `duplicate id; first seen at #${ids.get(id)}`);
      else ids.set(id, index + 1);
      if (globalIds.has(id)) addIssue(issues, "error", location, `id duplicates ${globalIds.get(id)}`);
      else globalIds.set(id, `${bankId} #${index + 1}`);
    }

    if (!text) addIssue(issues, "error", location, "question text is empty");
    else if (texts.has(normalizedQuestion)) addIssue(issues, "error", location, `duplicate question text; first seen at #${texts.get(normalizedQuestion)}`);
    else {
      texts.set(normalizedQuestion, index + 1);
      if (globalTexts.has(normalizedQuestion)) addIssue(issues, "warning", location, `same text also appears at ${globalTexts.get(normalizedQuestion)}`);
      else globalTexts.set(normalizedQuestion, `${bankId} #${index + 1}`);
    }

    if (options.length !== 4) addIssue(issues, "error", location, `expected 4 opaque options, got ${options.length}`);
    if (normalizedOptions.some(option => !option)) addIssue(issues, "error", location, "one or more options are empty");
    if (new Set(normalizedOptions).size !== normalizedOptions.length) addIssue(issues, "error", location, "answer options are not unique");
    const sortedIds = options.map(option => String(option && option.id || ""));
    if (JSON.stringify(sortedIds) !== JSON.stringify(sortedIds.slice().sort())) addIssue(issues, "error", location, "opaque option ids are not sorted");
    options.forEach((option, optionIndex) => {
      if (!option || !/^opt_[a-f0-9]{20}$/.test(option.id || "") || optionIds.has(option.id)) {
        addIssue(issues, "error", `${location} option ${optionIndex + 1}`, "invalid/duplicate opaque option id");
      }
      if (option) optionIds.add(option.id);
    });
    ["correct", "correctIndex", "correctAnswer", "correctOptionId", "comment", "explanation"].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(question, field)) addIssue(issues, "error", location, `private field ${field} leaked publicly`);
    });

    if (!Number.isFinite(timeLimit) || timeLimit <= 0) addIssue(issues, "error", location, `invalid timeLimit ${String(question.timeLimit)}`);
    else {
      timeLimits.push(timeLimit);
      if (timeLimit < 15 || timeLimit > 300) addIssue(issues, "warning", location, `unusual timeLimit ${timeLimit}`);
    }
    if (!Number.isFinite(pointValue) || pointValue <= 0) addIssue(issues, "error", location, `invalid points ${String(question.points)}`);
    else points.push(pointValue);

    const block = String(question.block || "").trim();
    if (!block || !Object.prototype.hasOwnProperty.call(blockDefinitions, block)) addIssue(issues, "error", location, `unknown block ${block || "<missing>"}`);
    const difficulty = String(question.difficulty || "").trim().toLowerCase();
    if (!allowedDifficulties.has(difficulty)) addIssue(issues, "error", location, `invalid difficulty ${difficulty || "<missing>"}`);
    if (typeof question.topic !== "string" || typeof question.context !== "string") addIssue(issues, "error", location, "topic/context must be strings");
  });

  const usedBlocks = new Set(questions.map(question => String(question.block || "")).filter(Boolean));
  Object.keys(blockDefinitions).forEach(block => {
    if (!usedBlocks.has(block)) addIssue(issues, "warning", `meta.blocks.${block}`, "block has no questions");
  });

  results.push({
    bankId,
    relativePath,
    questions: questions.length,
    idCount: ids.size,
    contextCount: questions.filter(question => String(question.context || "").trim()).length,
    blockDistribution: countBy(questions.map(question => question.block)),
    difficultyDistribution: countBy(questions.map(question => question.difficulty)),
    timeLimit: { min: Math.min(...timeLimits), max: Math.max(...timeLimits), average: average(timeLimits) },
    points: { min: Math.min(...points), max: Math.max(...points), average: average(points) },
    issues
  });
}

results.forEach(result => {
  console.log([
    result.relativePath,
    `questions=${result.questions}`,
    `attempt=40`,
    `ids=${result.idCount}/${result.questions}`,
    `contexts=${result.contextCount}/${result.questions}`,
    `errors=${result.issues.filter(issue => issue.type === "error").length}`,
    `warnings=${result.issues.filter(issue => issue.type === "warning").length}`,
    `time=${result.timeLimit.min}-${result.timeLimit.max}s`,
    `points=${result.points.min}-${result.points.max}`
  ].join(" "));
  result.issues.forEach(issue => console.log(`  ${issue.type.toUpperCase()} ${issue.location}: ${issue.message}`));
});

console.log(`TOTAL banks=${results.length} questions=${results.reduce((sum, result) => sum + result.questions, 0)} errors=${totalErrors} warnings=${totalWarnings}`);
if (process.argv.includes("--json")) console.log(JSON.stringify({ results, totalErrors, totalWarnings }, null, 2));
if (totalErrors > 0) process.exitCode = 1;
