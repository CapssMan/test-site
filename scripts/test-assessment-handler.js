"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ASSESSMENT_API_VERSION,
  PRIVACY_CONSENT_VERSION,
  TESTS,
  buildDeterministicInviteCode,
  hashIdentity,
  hashInviteCode,
  hmacHex,
  validatePrivateBank
} = require("../cloud/assessment-core");
const { createAssessmentHandler } = require("../cloud/assessment-handler");
const { RANKING_PROOF_API_VERSION, RANKING_PROOF_VERSION } = require("../cloud/ranking-profile-core");

const root = path.resolve(__dirname, "..");
const now = new Date("2026-07-27T10:00:00.000Z");
const signingSecret = "s".repeat(64);
const identitySecret = "h".repeat(64);
const inviteSecret = "i".repeat(64);
const testId = "fa-junior";
const email = "candidate@example.ru";

function privateBank() {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", testId + ".json"), "utf8"));
  bank.questions.forEach(question => {
    question.correctOptionId = question.options[0].id;
    question.comment = "Тестовый закрытый комментарий.";
  });
  return bank;
}

class MemoryStore {
  constructor(bank, digest) {
    this.settings = { legal_pilot_approved: "true", attempt_issuance_enabled: "true" };
    this.bank = bank;
    this.digest = digest;
    this.invites = new Map();
    this.inviteGroups = new Map();
    this.groupClaims = new Map();
    this.sessions = new Map();
    this.results = new Map();
    this.feedback = new Map();
    this.audit = [];
    this.failNextInsertResult = false;
  }

  async getRuntimeSettings() { return this.settings; }
  async getBankMetadata(requestTestId, bankVersion) {
    return requestTestId === testId && bankVersion === TESTS[testId].bankVersion
      ? { objectKey: "banks/v4/fa-junior.json", privateDigest: this.digest.privateDigest, publicDigest: this.digest.publicDigest, active: true }
      : null;
  }
  async getInviteByCodeHash(codeHash) { return Array.from(this.invites.values()).find(invite => invite.codeHash === codeHash) || null; }
  async getInviteById(inviteId) { return this.invites.get(inviteId) || null; }
  async getInviteGroupByCodeHash(codeHash) { return Array.from(this.inviteGroups.values()).find(group => group.codeHash === codeHash) || null; }
  async getInviteGroupClaim(groupId, identityHash) { return this.groupClaims.get(groupId + "|" + identityHash) || null; }
  async claimInviteGroupSeat(claim) {
    const key = claim.groupId + "|" + claim.identityHash;
    if (this.groupClaims.has(key)) return this.groupClaims.get(key);
    const group = this.inviteGroups.get(claim.groupId);
    if (!group || group.state !== "issued" || group.usedCount >= group.maxUses) return null;
    const stored = Object.assign({}, claim);
    this.groupClaims.set(key, stored);
    group.usedCount += 1;
    return stored;
  }
  async upsertInvite(invite) { this.invites.set(invite.inviteId, Object.assign({}, invite)); }
  async getSessionByInviteId(inviteId) { return Array.from(this.sessions.values()).find(session => session.inviteId === inviteId) || null; }
  async getSessionByAttemptId(attemptId) { return this.sessions.get(attemptId) || null; }
  async listRecentSessions(requestTestId, identityHash) {
    return Array.from(this.sessions.values()).filter(session => session.testId === requestTestId && session.identityHash === identityHash);
  }
  async insertSession(session) {
    if (Array.from(this.sessions.values()).some(existing => existing.inviteId === session.inviteId)) throw new Error("duplicate_invite_session");
    this.sessions.set(session.attemptId, Object.assign({}, session));
  }
  async markInviteActive(inviteId, attemptId, activatedAt) {
    const invite = this.invites.get(inviteId);
    if (invite && invite.state === "issued") Object.assign(invite, { state: "active", attemptId, activatedAt });
  }
  async reserveSession(row) {
    const session = this.sessions.get(row.attemptId);
    if (session && session.state === "active") Object.assign(session, {
      state: "reserved",
      saveRequestId: row.saveRequestId,
      submissionHash: row.submissionHash,
      reservedAt: row.reservedAt,
      completedAt: row.completedAt,
      resultCode: row.resultCode,
      result: row.result
    });
  }
  async completeSession(attemptId, result, completedAt, purgeAt) {
    const session = this.sessions.get(attemptId);
    Object.assign(session, { state: "completed", result, completedAt, purgeAt });
  }
  async completeInvite(inviteId, attemptId, completedAt, purgeAt) {
    const invite = this.invites.get(inviteId);
    Object.assign(invite, { state: "completed", attemptId, completedAt, purgeAt });
  }
  async getResultByCode(code) { return this.results.get(code) || null; }
  async getResultByRequestId(requestId) { return Array.from(this.results.values()).find(result => result.requestId === requestId) || null; }
  async insertResult(result) {
    if (this.failNextInsertResult) {
      this.failNextInsertResult = false;
      throw new Error("injected_result_write_failure");
    }
    if (this.results.has(result.code)) throw new Error("duplicate_result");
    this.results.set(result.code, Object.assign({}, result));
  }
  async getFeedbackByAttemptId(attemptId) { return this.feedback.get(attemptId) || null; }
  async upsertFeedback(row) { this.feedback.set(row.attemptId, Object.assign({}, row)); }
  async appendAudit(event) { this.audit.push(event); }
}

function beginPayload(inviteCode) {
  return {
    action: "beginAttempt",
    apiVersion: ASSESSMENT_API_VERSION,
    beginRequestId: "scb_" + "a".repeat(24),
    testId,
    inviteCode,
    email,
    browserFingerprint: "deadbeef",
    clientBuild: "2026.07.27.16",
    privacyConsent: true,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

function savePayload(begin, answers) {
  return {
    action: "saveResult",
    apiVersion: ASSESSMENT_API_VERSION,
    requestId: "scs_" + "b".repeat(24),
    attemptId: begin.attemptId,
    attemptToken: begin.attemptToken,
    testId,
    bankVersion: TESTS[testId].bankVersion,
    name: "Кандидат Тестовый",
    email,
    telegram: "@candidate_test",
    englishLevel: "B2",
    candidateSource: "Другое",
    candidateExperience: "Стажировка",
    employerShareConsent: false,
    browserFingerprint: "deadbeef",
    tabSwitches: 0,
    clientBuild: "2026.07.27.16",
    answers,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

async function post(handler, body) {
  const response = await handler({ httpMethod: "POST", body: JSON.stringify(body) }, { token: { access_token: "x".repeat(40) } });
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

(async function main() {
  const bank = privateBank();
  const digest = validatePrivateBank(bank);
  const store = new MemoryStore(bank, digest);
  const reports = new Map();
  const bankStorage = { async readJson() { return bank; } };
  const reportStorage = {
    async readText(key) { return reports.has(key) ? reports.get(key) : null; },
    async writeText(key, value, _context, options) {
      assert.equal(options.createOnly, true);
      if (reports.has(key)) return { created: false };
      reports.set(key, value);
      return { created: true };
    }
  };
  const identityHash = hashIdentity(identitySecret, testId, email);
  const inviteId = "inv_" + "1".repeat(32);
  const inviteCode = buildDeterministicInviteCode(inviteSecret, inviteId, testId, identityHash);
  store.invites.set(inviteId, {
    inviteId,
    testId,
    codeHash: hashInviteCode(inviteSecret, inviteCode),
    identityHash,
    state: "issued",
    allowRetake: false,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  const handler = createAssessmentHandler({
    store,
    bankStorage,
    reportStorage,
    signingSecret,
    identitySecret,
    inviteSecret,
    allowedOrigin: "https://capssman.github.io",
    now: () => new Date(now)
  });

  const health = await handler({ httpMethod: "GET" }, {});
  assert.equal(JSON.parse(health.body).storage, "yandex-cloud");
  const begin = await post(handler, beginPayload(inviteCode));
  assert.equal(begin.ok, true);
  assert.equal(begin.status, "ready");
  assert.equal(begin.questionIds.length, 40);
  const resumed = await post(handler, beginPayload(inviteCode));
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.attemptId, begin.attemptId);
  assert.equal(resumed.attemptToken, begin.attemptToken);

  const questions = new Map(bank.questions.map(question => [question.id, question]));
  const answers = begin.questionIds.map(questionId => ({
    questionId,
    optionId: questions.get(questionId).correctOptionId,
    timedOut: false,
    timeSpent: 30
  }));
  const save = savePayload(begin, answers);
  store.failNextInsertResult = true;
  const interrupted = await post(handler, save);
  assert.equal(interrupted.failureCode, "temporary_storage_error");
  assert.equal(store.sessions.get(begin.attemptId).state, "reserved");
  assert.equal(reports.size, 1);
  assert.equal(store.results.size, 0);

  const recovered = await post(handler, save);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.scoreVerification, "server-verified");
  assert.equal(recovered.percent, 100);
  assert.equal(recovered.reportCreated, true);
  assert.match(recovered.resultCode, /^FA-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
  assert.equal(store.results.size, 1);
  assert.equal(reports.size, 1);
  const replay = await post(handler, save);
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  assert.equal(replay.resultCode, recovered.resultCode);

  const feedbackPayload = {
    action: "saveFeedback",
    apiVersion: ASSESSMENT_API_VERSION,
    attemptId: begin.attemptId,
    attemptToken: begin.attemptToken,
    resultCode: recovered.resultCode,
    testId,
    overallRating: 4,
    clarityRating: 5,
    difficulty: "balanced",
    technicalIssue: false,
    comment: "Понятный тест, полезные кейсы."
  };
  const feedback = await post(handler, feedbackPayload);
  assert.equal(feedback.ok, true);
  assert.equal(feedback.status, "saved");
  assert.equal(store.feedback.size, 1);
  assert.equal(store.feedback.get(begin.attemptId).comment, feedbackPayload.comment);
  for (const forbidden of ["attemptId", "attemptToken", "resultCode", "email", "name", "comment"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(feedback, forbidden), false);
  }
  const feedbackUpdate = await post(handler, Object.assign({}, feedbackPayload, { overallRating: 5, comment: "Обновлённый отзыв." }));
  assert.equal(feedbackUpdate.status, "updated");
  assert.equal(store.feedback.size, 1);
  assert.equal(store.feedback.get(begin.attemptId).overallRating, 5);
  const wrongFeedback = await post(handler, Object.assign({}, feedbackPayload, { resultCode: "FA-AAAAA" }));
  assert.equal(wrongFeedback.ok, false);
  assert.equal(store.feedback.size, 1);
  const rankingProof = await post(handler, {
    action: "rankingProof",
    apiVersion: RANKING_PROOF_API_VERSION,
    attemptId: begin.attemptId,
    attemptToken: begin.attemptToken,
    resultCode: recovered.resultCode
  });
  assert.equal(rankingProof.ok, true);
  assert.equal(rankingProof.proofVersion, RANKING_PROOF_VERSION);
  assert.equal(rankingProof.resultCode, recovered.resultCode);
  assert.equal(rankingProof.percent, 100);
  assert.match(rankingProof.rankingSubjectHandle, /^rsh_[a-f0-9]{64}$/);
  for (const forbidden of ["email", "name", "telegram", "answers", "attemptId", "attemptToken"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(rankingProof, forbidden), false);
  }
  const rejectedProof = await post(handler, {
    action: "rankingProof",
    apiVersion: RANKING_PROOF_API_VERSION,
    attemptId: begin.attemptId,
    attemptToken: begin.attemptToken.slice(0, -1) + "x",
    resultCode: recovered.resultCode
  });
  assert.equal(rejectedProof.ok, false);
  assert.equal(rejectedProof.failureCode, "ranking_proof_unavailable");
  const conflict = await post(handler, Object.assign({}, save, { name: "Другой кандидат" }));
  assert.equal(conflict.failureCode, "submission_conflict");
  assert.equal(store.results.size, 1);

  const groupId = "grp_" + "3".repeat(32);
  const groupIdentity = hmacHex(inviteSecret, "group-code-identity-v1|" + groupId);
  const groupCode = buildDeterministicInviteCode(inviteSecret, groupId, testId, groupIdentity);
  store.inviteGroups.set(groupId, {
    groupId,
    testId,
    codeHash: hashInviteCode(inviteSecret, groupCode),
    purpose: "University pilot",
    maxUses: 1,
    usedCount: 0,
    validForHours: 24,
    state: "issued",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    purgeAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  });
  const groupBegin = await post(handler, Object.assign(beginPayload(groupCode), {
    beginRequestId: "scb_" + "d".repeat(24), email: "student-one@example.ru"
  }));
  assert.equal(groupBegin.ok, true);
  assert.equal(store.inviteGroups.get(groupId).usedCount, 1);
  const groupFull = await post(handler, Object.assign(beginPayload(groupCode), {
    beginRequestId: "scb_" + "e".repeat(24), email: "student-two@example.ru"
  }));
  assert.equal(groupFull.failureCode, "attempt_unavailable");
  assert.equal(store.inviteGroups.get(groupId).usedCount, 1);

  store.settings.attempt_issuance_enabled = "false";
  const secondInviteId = "inv_" + "2".repeat(32);
  const secondCode = buildDeterministicInviteCode(inviteSecret, secondInviteId, testId, identityHash);
  store.invites.set(secondInviteId, {
    inviteId: secondInviteId, testId, codeHash: hashInviteCode(inviteSecret, secondCode), identityHash,
    state: "issued", allowRetake: true, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  const gated = await post(handler, Object.assign(beginPayload(secondCode), { beginRequestId: "scb_" + "c".repeat(24) }));
  assert.equal(gated.failureCode, "attempt_unavailable");

  console.log("Assessment handler checks passed: gated issuance, server scoring, recovery, replay safety and YDB-backed ranking proof.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
