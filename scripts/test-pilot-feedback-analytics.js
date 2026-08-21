#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ASSESSMENT_API_VERSION, validateFeedbackRequest } = require("../cloud/assessment-core");
const { buildPilotAnalytics } = require("../cloud/pilot-analytics");

const root = path.resolve(__dirname, "..");
const token = "a".repeat(40) + "." + "b".repeat(80) + "." + "c".repeat(43);
const valid = validateFeedbackRequest({
  action: "saveFeedback", apiVersion: ASSESSMENT_API_VERSION,
  attemptId: "att_" + "1".repeat(32), attemptToken: token,
  resultCode: "SW-ABCDE", testId: "software-junior",
  overallRating: 4, clarityRating: 5, difficulty: "balanced",
  technicalIssue: false, comment: "Полезный тест"
});
assert.equal(valid.comment, "Полезный тест");
assert.throws(() => validateFeedbackRequest({ ...valid, action: "saveFeedback", apiVersion: ASSESSMENT_API_VERSION, extra: true }), /invalid_request/);
assert.throws(() => validateFeedbackRequest({ ...valid, action: "saveFeedback", apiVersion: ASSESSMENT_API_VERSION, overallRating: 6 }), /invalid_feedback_rating/);
assert.throws(() => validateFeedbackRequest({ ...valid, action: "saveFeedback", apiVersion: ASSESSMENT_API_VERSION, resultCode: "FA-ABCDE" }), /invalid_result_code/);

const now = new Date("2026-08-21T12:00:00.000Z");
const profileA = "acct_" + "a".repeat(32), profileB = "acct_" + "b".repeat(32);
const attemptA = "att_" + "1".repeat(32), attemptB = "att_" + "2".repeat(32);
const analytics = buildPilotAnalytics({
  accounts: [
    { profileId: profileA, status: "active", targetRole: "Аналитик", experienceBand: "Стажировка" },
    { profileId: profileB, status: "active" },
    { profileId: "acct_" + "c".repeat(32), status: "deleted" }
  ],
  attempts: [
    { profileId: profileA, attemptId: attemptA, testId: "fa-junior", state: "completed", resultCode: "FA-ABCDE" },
    { profileId: profileB, attemptId: attemptB, testId: "fa-junior", state: "active", resultCode: "" },
    { profileId: "acct_" + "c".repeat(32), attemptId: "att_" + "3".repeat(32), testId: "fa-junior", state: "completed", resultCode: "FA-BCDEF" }
  ],
  results: [
    { code: "FA-ABCDE", attemptId: attemptA, testId: "fa-junior", percent: 84, technical: false },
    { code: "FA-BCDEF", attemptId: "att_" + "3".repeat(32), testId: "fa-junior", percent: 100, technical: true }
  ],
  feedback: [
    { attemptId: attemptA, resultCode: "FA-ABCDE", testId: "fa-junior", overallRating: 4, clarityRating: 3,
      difficulty: "hard", technicalIssue: true, comment: "  Нужна понятнее таблица.\u0000  ", submittedAt: now.toISOString(), updatedAt: now.toISOString() }
  ],
  rankingProfiles: [
    { resultCode: "FA-ABCDE", publicOptIn: true, publicConsentActive: true, technical: false, expiresAt: "2027-01-01T00:00:00.000Z" }
  ]
}, { now });
assert.equal(analytics.privacy, "aggregate-and-pseudonymous-feedback");
assert.deepEqual(analytics.funnel, {
  registeredCandidates: 2, profiledCandidates: 1, startedCandidates: 2, startedAttempts: 2,
  completedCandidates: 1, completedAttempts: 1, recordedResults: 1, feedbackResponses: 1, publishedProfiles: 1
});
const finance = analytics.tests.find(item => item.testId === "fa-junior");
assert.equal(finance.completionRate, 50);
assert.equal(finance.averageScore, 84);
assert.equal(finance.technicalIssues, 1);
assert.equal(finance.difficulty.hard, 1);
assert.equal(analytics.recentFeedback[0].comment, "Нужна понятнее таблица.");
for (const forbidden of ["profileId", "attemptId", "resultCode", "email", "name", "telegram", "answers"]) {
  assert.equal(JSON.stringify(analytics).includes('"' + forbidden + '"'), false, "analytics leaks " + forbidden);
}

const schema = fs.readFileSync(path.join(root, "cloud/schema/020_pilot_feedback.sql"), "utf8");
assert.match(schema, /CREATE TABLE IF NOT EXISTS assessment_feedback/);
assert.match(schema, /PRIMARY KEY \(attempt_id\)/);
assert.match(schema, /WITH \(TTL = Interval\("PT0S"\) ON purge_at\)/);
assert.doesNotMatch(schema, /candidate_(?:name|email)|telegram/i);
const assessment = fs.readFileSync(path.join(root, "cloud/assessment-handler.js"), "utf8");
assert.match(assessment, /FEEDBACK_SUBMISSION_WINDOW_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
assert.match(assessment, /result\.scoreVerification !== SCORE_VERIFICATION_SERVER/);
assert.match(assessment, /pilot_feedback_saved/);
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
assert.match(admin, /id="pilotContent"/);
assert.match(admin, /privacy !== "aggregate-and-pseudonymous-feedback"/);
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
assert.match(candidate, /id="feedbackForm"/);
assert.match(candidate, /Отзыв добровольный, не влияет на балл/);
assert.match(candidate, /Не указывайте здесь персональные данные/);
assert.match(candidate, /action: "saveFeedback"/);
console.log("Pilot feedback and analytics checks passed: verified-attempt binding, 30-day submission, no-PII funnel, TTL schema and candidate/admin UI.");
