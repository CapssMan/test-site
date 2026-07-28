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
  validatePrivateBank
} = require("../cloud/assessment-core");
const { createAssessmentHandler } = require("../cloud/assessment-handler");

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
    this.sessions = new Map();
    this.results = new Map();
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

  const conflict = await post(handler, Object.assign({}, save, { name: "Другой кандидат" }));
  assert.equal(conflict.failureCode, "submission_conflict");
  assert.equal(store.results.size, 1);

  store.settings.attempt_issuance_enabled = "false";
  const secondInviteId = "inv_" + "2".repeat(32);
  const secondCode = buildDeterministicInviteCode(inviteSecret, secondInviteId, testId, identityHash);
  store.invites.set(secondInviteId, {
    inviteId: secondInviteId, testId, codeHash: hashInviteCode(inviteSecret, secondCode), identityHash,
    state: "issued", allowRetake: true, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  const gated = await post(handler, Object.assign(beginPayload(secondCode), { beginRequestId: "scb_" + "c".repeat(24) }));
  assert.equal(gated.failureCode, "attempt_unavailable");

  console.log("Assessment handler checks passed: gated issuance, deterministic resume, server scoring, create-only reports, interrupted-write recovery and replay safety.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
