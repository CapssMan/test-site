"use strict";

const { TESTS } = require("./assessment-core");

function safeDate(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function safeIso(value) {
  const time = safeDate(value);
  return time ? new Date(time).toISOString() : "";
}

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? Math.round(finite.reduce((sum, value) => sum + value, 0) * 10 / finite.length) / 10 : null;
}

function profileIsFilled(account) {
  const fields = [account.region, account.workFormat, account.experienceBand, account.currentRole,
    account.targetRole, account.experienceSummary, account.professionalTools];
  return fields.filter(value => String(value || "").trim()).length >= 2;
}

function boundedComment(value) {
  return String(value || "").trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 1000);
}

function buildPilotAnalytics(input, options) {
  const source = input || {};
  const now = options && options.now instanceof Date ? options.now : new Date();
  const accounts = (source.accounts || []).filter(item => item && item.status === "active" && /^acct_[a-f0-9]{32}$/.test(String(item.profileId || "")));
  const accountIds = new Set(accounts.map(item => item.profileId));
  const attempts = (source.attempts || []).filter(item => item && accountIds.has(item.profileId) &&
    Object.prototype.hasOwnProperty.call(TESTS, item.testId) && /^att_[a-f0-9]{32,64}$/.test(String(item.attemptId || "")));
  const attemptIds = new Set(attempts.map(item => item.attemptId));
  const completedAttempts = attempts.filter(item => item.state === "completed" && item.resultCode);
  const completedAttemptIds = new Set(completedAttempts.map(item => item.attemptId));
  const results = (source.results || []).filter(item => item && completedAttemptIds.has(item.attemptId) &&
    item.technical !== true && Object.prototype.hasOwnProperty.call(TESTS, item.testId));
  const resultCodes = new Set(results.map(item => item.code));
  const feedback = (source.feedback || []).filter(item => item && completedAttemptIds.has(item.attemptId) &&
    resultCodes.has(item.resultCode) && Object.prototype.hasOwnProperty.call(TESTS, item.testId));
  const rankings = (source.rankingProfiles || []).filter(item => item && resultCodes.has(item.resultCode) &&
    item.publicOptIn === true && item.publicConsentActive === true && item.technical !== true &&
    (!safeDate(item.expiresAt) || safeDate(item.expiresAt) > now.getTime()));

  const startedCandidates = new Set(attempts.map(item => item.profileId));
  const completedCandidates = new Set(completedAttempts.map(item => item.profileId));
  const byTest = Object.keys(TESTS).map(testId => {
    const testAttempts = attempts.filter(item => item.testId === testId);
    const testCompleted = completedAttempts.filter(item => item.testId === testId);
    const testResults = results.filter(item => item.testId === testId);
    const testFeedback = feedback.filter(item => item.testId === testId);
    const difficulty = { too_easy: 0, easy: 0, balanced: 0, hard: 0, too_hard: 0 };
    testFeedback.forEach(item => { if (Object.prototype.hasOwnProperty.call(difficulty, item.difficulty)) difficulty[item.difficulty] += 1; });
    return {
      testId,
      title: TESTS[testId].title,
      startedAttempts: testAttempts.length,
      completedAttempts: testCompleted.length,
      completionRate: testAttempts.length ? Math.round(testCompleted.length * 1000 / testAttempts.length) / 10 : 0,
      recordedResults: testResults.length,
      averageScore: average(testResults.map(item => item.percent)),
      feedbackResponses: testFeedback.length,
      averageOverallRating: average(testFeedback.map(item => item.overallRating)),
      averageClarityRating: average(testFeedback.map(item => item.clarityRating)),
      technicalIssues: testFeedback.filter(item => item.technicalIssue === true).length,
      difficulty
    };
  });

  return {
    privacy: "aggregate-and-pseudonymous-feedback",
    generatedAt: now.toISOString(),
    funnel: {
      registeredCandidates: accounts.length,
      profiledCandidates: accounts.filter(profileIsFilled).length,
      startedCandidates: startedCandidates.size,
      startedAttempts: attempts.length,
      completedCandidates: completedCandidates.size,
      completedAttempts: completedAttempts.length,
      recordedResults: results.length,
      feedbackResponses: feedback.length,
      publishedProfiles: rankings.length
    },
    tests: byTest,
    recentFeedback: feedback.slice().sort((left, right) => safeDate(right.updatedAt || right.submittedAt) - safeDate(left.updatedAt || left.submittedAt)).slice(0, 100).map(item => ({
      testId: item.testId,
      overallRating: Number(item.overallRating),
      clarityRating: Number(item.clarityRating),
      difficulty: String(item.difficulty || ""),
      technicalIssue: item.technicalIssue === true,
      comment: boundedComment(item.comment),
      submittedAt: safeIso(item.updatedAt || item.submittedAt)
    }))
  };
}

module.exports = { average, boundedComment, buildPilotAnalytics, profileIsFilled, safeIso };
