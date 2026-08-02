"use strict";

const { SCORE_VERIFICATION_SERVER, TESTS, isPlainObject } = require("./assessment-core");
const { TECHNICAL_RESULT_CODES } = require("./ranking-core");

const MIN_INITIAL_SAMPLE = 10;
const MIN_STABLE_SAMPLE = 20;
const DIFFICULTIES = new Set(["easy", "medium", "calc", "case", "hard"]);

function roundedRate(numerator, denominator) {
  return denominator > 0 ? Math.round(numerator * 1000 / denominator) / 10 : 0;
}

function boundedText(value, maximum) {
  const text = String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  return text.slice(0, maximum);
}

function calibrationSignals(item) {
  if (item.sampleSize < MIN_INITIAL_SAMPLE) return ["insufficient_sample"];
  const signals = [];
  if (item.correctRate < 35) signals.push("too_hard");
  else if (item.correctRate > 90) signals.push("too_easy");
  if (item.timeoutRate >= 20 || item.averageTimeRatio >= 90) signals.push("time_pressure");
  if (item.unansweredRate >= 15) signals.push("high_skip_rate");
  if (!signals.length) signals.push("balanced");
  return signals;
}

function createTestSummary(testId) {
  return {
    testId,
    bankVersion: TESTS[testId].bankVersion,
    completedAttempts: 0,
    itemResponses: 0,
    questions: new Map()
  };
}

function buildQuestionAnalytics(results) {
  const summaries = Object.keys(TESTS).reduce((output, testId) => {
    output[testId] = createTestSummary(testId);
    return output;
  }, Object.create(null));

  (Array.isArray(results) ? results : []).forEach(result => {
    if (!isPlainObject(result)) return;
    const testId = String(result.testId || "");
    const summary = summaries[testId];
    if (!summary || result.technical === true || TECHNICAL_RESULT_CODES.has(String(result.code || "").toUpperCase()) ||
        String(result.bankVersion || "") !== summary.bankVersion ||
        String(result.scoreVerification || "") !== SCORE_VERIFICATION_SERVER || !Array.isArray(result.answerDetails)) return;

    const uniqueQuestions = new Set();
    const accepted = [];
    result.answerDetails.forEach(detail => {
      if (!isPlainObject(detail)) return;
      const questionId = String(detail.questionId || "");
      const timeSpent = Number(detail.timeSpent);
      const timeLimit = Number(detail.timeLimit);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(questionId) || uniqueQuestions.has(questionId) ||
          typeof detail.isCorrect !== "boolean" || typeof detail.timedOut !== "boolean" ||
          !Number.isFinite(timeSpent) || timeSpent < 0 || timeSpent > 3600 ||
          !Number.isFinite(timeLimit) || timeLimit < 1 || timeLimit > 3600) return;
      uniqueQuestions.add(questionId);
      accepted.push({ detail, questionId, timeSpent, timeLimit });
    });
    if (!accepted.length) return;

    summary.completedAttempts += 1;
    accepted.forEach(({ detail, questionId, timeSpent, timeLimit }) => {
      let item = summary.questions.get(questionId);
      if (!item) {
        item = {
          questionId,
          topic: boundedText(detail.topic, 120),
          block: boundedText(detail.block, 80),
          difficulty: DIFFICULTIES.has(String(detail.difficulty || "")) ? String(detail.difficulty) : "medium",
          question: boundedText(detail.question, 500),
          sampleSize: 0,
          correctCount: 0,
          timeoutCount: 0,
          unansweredCount: 0,
          timeSpentTotal: 0,
          timeLimitTotal: 0
        };
        summary.questions.set(questionId, item);
      }
      item.sampleSize += 1;
      item.correctCount += detail.isCorrect ? 1 : 0;
      item.timeoutCount += detail.timedOut ? 1 : 0;
      item.unansweredCount += String(detail.status || "") === "Нет ответа" || String(detail.status || "") === "Время вышло" ? 1 : 0;
      item.timeSpentTotal += timeSpent;
      item.timeLimitTotal += timeLimit;
      summary.itemResponses += 1;
    });
  });

  return Object.values(summaries).map(summary => {
    const questions = Array.from(summary.questions.values()).map(item => {
      const averageTimeSpent = item.sampleSize ? Math.round(item.timeSpentTotal / item.sampleSize * 10) / 10 : 0;
      const averageTimeLimit = item.sampleSize ? Math.round(item.timeLimitTotal / item.sampleSize * 10) / 10 : 0;
      const output = {
        questionId: item.questionId,
        topic: item.topic,
        block: item.block,
        difficulty: item.difficulty,
        question: item.question,
        sampleSize: item.sampleSize,
        correctRate: roundedRate(item.correctCount, item.sampleSize),
        timeoutRate: roundedRate(item.timeoutCount, item.sampleSize),
        unansweredRate: roundedRate(item.unansweredCount, item.sampleSize),
        averageTimeSpent,
        averageTimeLimit,
        averageTimeRatio: averageTimeLimit > 0 ? Math.round(averageTimeSpent * 1000 / averageTimeLimit) / 10 : 0,
        sampleStatus: item.sampleSize >= MIN_STABLE_SAMPLE ? "stable" : (item.sampleSize >= MIN_INITIAL_SAMPLE ? "initial" : "insufficient")
      };
      output.signals = calibrationSignals(output);
      return output;
    }).sort((left, right) => left.questionId.localeCompare(right.questionId));
    return {
      testId: summary.testId,
      bankVersion: summary.bankVersion,
      completedAttempts: summary.completedAttempts,
      itemResponses: summary.itemResponses,
      observedQuestions: questions.length,
      questions
    };
  });
}

module.exports = {
  MIN_INITIAL_SAMPLE,
  MIN_STABLE_SAMPLE,
  buildQuestionAnalytics,
  calibrationSignals,
  roundedRate
};
