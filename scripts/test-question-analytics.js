#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { AUTHORITATIVE_SCORING_VERSION, SCORE_VERIFICATION_SERVER, TESTS } = require("../cloud/assessment-core");
const { buildQuestionAnalytics } = require("../cloud/question-analytics");

function result(index, overrides) {
  return Object.assign({
    code: "FA-AAA" + String(index).padStart(2, "0"),
    testId: "fa-junior",
    bankVersion: TESTS["fa-junior"].bankVersion,
    scoreVerification: SCORE_VERIFICATION_SERVER,
    scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
    technical: false,
    answerDetails: [{
      questionId: "fa_001",
      topic: "Отчётность",
      block: "reporting",
      difficulty: "medium",
      question: "Какой показатель нужен?",
      isCorrect: index % 4 !== 0,
      timedOut: index === 1 || index === 2,
      status: index === 1 ? "Время вышло" : (index % 4 !== 0 ? "Верно" : "Неверно"),
      timeSpent: index <= 2 ? 60 : 30,
      timeLimit: 60
    }]
  }, overrides || {});
}

const rows = Array.from({ length: 20 }, (_, index) => result(index + 1));
rows.push(result(21, { code: "FA-X5P66" }));
rows.push(result(22, { bankVersion: "FA Junior v5.0" }));
rows.push(result(23, { technical: true }));
rows.push(result(24, { scoreVerification: "client-reported-unverified" }));
rows.push(result(25, { answerDetails: [{ questionId: "fa_001", isCorrect: true, timedOut: false, timeSpent: 9999, timeLimit: 60 }] }));

const analytics = buildQuestionAnalytics(rows);
assert.equal(analytics.length, 5);
const financial = analytics.find(item => item.testId === "fa-junior");
assert.equal(financial.completedAttempts, 20);
assert.equal(financial.itemResponses, 20);
assert.equal(financial.observedQuestions, 1);
assert.equal(financial.questions[0].sampleSize, 20);
assert.equal(financial.questions[0].correctRate, 75);
assert.equal(financial.questions[0].timeoutRate, 10);
assert.equal(financial.questions[0].unansweredRate, 5);
assert.equal(financial.questions[0].averageTimeSpent, 33);
assert.equal(financial.questions[0].averageTimeLimit, 60);
assert.equal(financial.questions[0].averageTimeRatio, 55);
assert.equal(financial.questions[0].sampleStatus, "stable");
assert.deepEqual(financial.questions[0].signals, ["balanced"]);
assert.equal(analytics.find(item => item.testId === "ca-junior").completedAttempts, 0);

const hard = buildQuestionAnalytics(Array.from({ length: 10 }, (_, index) => result(index + 30, {
  code: "CA-BBB" + String(index).padStart(2, "0"),
  testId: "ca-junior",
  bankVersion: TESTS["ca-junior"].bankVersion,
  answerDetails: [{
    questionId: "ca_001", topic: "Risk", block: "risk", difficulty: "case", question: "Кейс",
    isCorrect: index < 2, timedOut: index < 3, status: index < 3 ? "Время вышло" : "Неверно", timeSpent: 90, timeLimit: 90
  }]
}))).find(item => item.testId === "ca-junior");
assert.deepEqual(hard.questions[0].signals, ["too_hard", "time_pressure", "high_skip_rate"]);
assert.equal(hard.questions[0].sampleStatus, "initial");

console.log("Question analytics checks passed: current-bank anonymized aggregates, technical exclusion and evidence thresholds.");
