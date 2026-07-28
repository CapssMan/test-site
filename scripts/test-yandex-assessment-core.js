"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ASSESSMENT_API_VERSION,
  ATTEMPT_ACTIVE_TTL_MS,
  PRIVACY_CONSENT_VERSION,
  TESTS,
  buildDeterministicInviteCode,
  calculateScore,
  hashFingerprint,
  hashIdentity,
  hashInviteCode,
  normalizeInviteCode,
  questionSetHash,
  selectQuestionIds,
  signAttemptToken,
  validateBeginRequest,
  validatePrivateBank,
  validateSaveRequest,
  verifyAttemptToken
} = require("../cloud/assessment-core");

const root = path.resolve(__dirname, "..");
const signingSecret = "s".repeat(64);
const inviteSecret = "i".repeat(64);
const identitySecret = "h".repeat(64);
const now = new Date("2026-07-27T10:00:00.000Z");

function privateBank(testId) {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", testId + ".json"), "utf8"));
  bank.questions.forEach(question => {
    question.correctOptionId = question.options[0].id;
    question.comment = "Тестовый закрытый комментарий.";
  });
  return bank;
}

function beginPayload(testId, inviteCode) {
  return {
    action: "beginAttempt",
    apiVersion: ASSESSMENT_API_VERSION,
    beginRequestId: "scb_" + "a".repeat(24),
    clientBuild: "2026.07.27.16",
    testId,
    inviteCode,
    email: "candidate@example.ru",
    browserFingerprint: "deadbeef",
    privacyConsent: true,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

function savePayload(testId, attemptId, token, answers) {
  return {
    action: "saveResult",
    apiVersion: ASSESSMENT_API_VERSION,
    requestId: "scs_" + "b".repeat(24),
    attemptId,
    attemptToken: token,
    testId,
    bankVersion: TESTS[testId].bankVersion,
    name: "Кандидат Тестовый",
    email: "candidate@example.ru",
    telegram: "@candidate_test",
    englishLevel: "B2",
    candidateSource: "Другое",
    candidateExperience: "Стажировка",
    employerShareConsent: false,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true,
    browserFingerprint: "deadbeef",
    tabSwitches: 0,
    clientBuild: "2026.07.27.16",
    answers
  };
}

(function main() {
  Object.keys(TESTS).forEach(testId => {
    const bank = privateBank(testId);
    const validation = validatePrivateBank(bank);
    assert.equal(validation.publicDigest, bank.publicDigest);
    assert.match(validation.privateDigest, /^[a-f0-9]{64}$/);

    const selected = selectQuestionIds(bank, "att_" + "1".repeat(32), "2".repeat(32));
    assert.equal(selected.length, TESTS[testId].attempt);
    assert.equal(new Set(selected).size, selected.length);
    assert.deepEqual(selected, selectQuestionIds(bank, "att_" + "1".repeat(32), "2".repeat(32)));
  });

  const testId = "fa-junior";
  const identityHash = hashIdentity(identitySecret, testId, "candidate@example.ru");
  const inviteId = "inv_" + "3".repeat(32);
  const inviteCode = buildDeterministicInviteCode(inviteSecret, inviteId, testId, identityHash);
  assert.match(inviteCode, /^SC1(?:-[A-F0-9]{4}){8}$/);
  assert.equal(normalizeInviteCode(inviteCode), inviteCode.replace(/-/g, ""));
  assert.match(hashInviteCode(inviteSecret, inviteCode), /^[a-f0-9]{64}$/);
  assert.match(hashFingerprint(identitySecret, testId, "deadbeef"), /^[a-f0-9]{64}$/);
  assert.equal(validateBeginRequest(beginPayload(testId, inviteCode)).email, "candidate@example.ru");
  assert.throws(() => validateBeginRequest(Object.assign(beginPayload(testId, inviteCode), { extra: true })), /invalid_request/);
  assert.throws(() => validateBeginRequest(Object.assign(beginPayload(testId, inviteCode), { privacyConsentVersion: "old" })), /privacy_consent_required/);

  const bank = privateBank(testId);
  const attemptId = "att_" + "4".repeat(32);
  const questionIds = selectQuestionIds(bank, attemptId, "5".repeat(32));
  const session = {
    attemptId,
    tokenJti: "6".repeat(32),
    testId,
    bankVersion: TESTS[testId].bankVersion,
    questionIds,
    questionSetHash: questionSetHash(testId, TESTS[testId].bankVersion, questionIds),
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    tokenIssuedAt: now.toISOString(),
    tokenExpiresAt: new Date(now.getTime() + ATTEMPT_ACTIVE_TTL_MS).toISOString()
  };
  const token = signAttemptToken(session, signingSecret);
  assert.equal(verifyAttemptToken(token, signingSecret, { now }).valid, true);
  assert.equal(verifyAttemptToken(token.slice(0, -1) + "x", signingSecret, { now }).valid, false);
  assert.equal(verifyAttemptToken(token, signingSecret, { now: new Date(now.getTime() + ATTEMPT_ACTIVE_TTL_MS + 1000) }).valid, false);
  assert.equal(verifyAttemptToken(token, signingSecret, { now: new Date(now.getTime() + ATTEMPT_ACTIVE_TTL_MS + 1000), allowExpired: true }).valid, true);

  const questionMap = new Map(bank.questions.map(question => [question.id, question]));
  const allCorrect = questionIds.map(questionId => ({ questionId, optionId: questionMap.get(questionId).correctOptionId, timedOut: false, timeSpent: 30 }));
  const request = validateSaveRequest(savePayload(testId, attemptId, token, allCorrect));
  const scored = calculateScore(request, session, bank);
  assert.equal(scored.result.percent, 100);
  assert.equal(scored.result.passStatus, "passed");
  assert.equal(scored.result.scoreVerification, "server-verified");
  assert.equal(scored.result.badge, "Junior Strong");
  assert.equal(scored.answerDetails.length, 40);

  const unanswered = validateSaveRequest(savePayload(testId, attemptId, token,
    questionIds.map(questionId => ({ questionId, optionId: null, timedOut: true, timeSpent: 45 }))));
  const failed = calculateScore(unanswered, session, bank);
  assert.equal(failed.result.percent, 0);
  assert.equal(failed.result.passStatus, "failed");
  assert.equal(failed.result.unansweredCount, 40);

  console.log("Yandex assessment core checks passed: contracts, private-bank integrity, deterministic sampling, tokens and authoritative scoring.");
})();
