#!/usr/bin/env node
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
const { hashAccountEmail, hashSessionToken } = require("../cloud/account-core");

const root = path.resolve(__dirname, "..");
const origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
const signingSecret = "s".repeat(64);
const identitySecret = "h".repeat(64);
const inviteSecret = "i".repeat(64);
const accountSessionSecret = "a".repeat(64);
const testId = "fa-junior";
let currentNow = new Date("2026-08-09T10:00:00.000Z");

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isFinite(date.getTime()) ? date : null;
}

function privateBank() {
  const bank = JSON.parse(fs.readFileSync(path.join(root, "data", testId + ".json"), "utf8"));
  bank.questions.forEach(question => {
    question.correctOptionId = question.options[0].id;
    question.comment = "Закрытый комментарий self-service теста.";
  });
  return bank;
}

class MemoryStore {
  constructor(bank, digest) {
    this.bank = bank;
    this.digest = digest;
    this.settings = {
      legal_pilot_approved: "true",
      attempt_issuance_enabled: "true",
      account_self_service_enabled: "true",
      account_required_for_attempts: "true"
    };
    this.accounts = new Map();
    this.accountSessions = new Map();
    this.invites = new Map();
    this.groups = new Map();
    this.groupClaims = new Map();
    this.sessions = new Map();
    this.profileAttempts = new Map();
    this.selfSlots = new Map();
    this.results = new Map();
    this.audit = [];
  }

  async getRuntimeSettings() { return this.settings; }
  async getBankMetadata(requestTestId, bankVersion) {
    return requestTestId === testId && bankVersion === TESTS[testId].bankVersion
      ? { objectKey: "banks/v6/fa-junior.json", privateDigest: this.digest.privateDigest, publicDigest: this.digest.publicDigest, active: true }
      : null;
  }
  async getInviteByCodeHash(codeHash) { return [...this.invites.values()].find(row => row.codeHash === codeHash) || null; }
  async getInviteById(inviteId) { return this.invites.get(inviteId) || null; }
  async getInviteGroupByCodeHash(codeHash) { return [...this.groups.values()].find(row => row.codeHash === codeHash) || null; }
  async getInviteGroupClaim(groupId, identityHash) { return this.groupClaims.get(groupId + "|" + identityHash) || null; }
  async claimInviteGroupSeat(row) {
    const key = row.groupId + "|" + row.identityHash;
    if (this.groupClaims.has(key)) return this.groupClaims.get(key);
    const group = this.groups.get(row.groupId);
    if (!group || group.state !== "issued" || group.usedCount >= group.maxUses) return null;
    const stored = { ...row };
    this.groupClaims.set(key, stored);
    group.usedCount += 1;
    return stored;
  }
  async upsertInvite(row) { this.invites.set(row.inviteId, { ...row }); }
  async getSessionByInviteId(inviteId) { return [...this.sessions.values()].find(row => row.inviteId === inviteId) || null; }
  async getSessionByAttemptId(attemptId) { return this.sessions.get(attemptId) || null; }
  async listRecentSessions(requestTestId, identityHash, since) {
    const cutoff = asDate(since);
    return [...this.sessions.values()].filter(row => {
      const stamp = asDate(row.completedAt || row.startedAt);
      return row.testId === requestTestId && row.identityHash === identityHash && stamp && (!cutoff || stamp >= cutoff);
    });
  }
  async insertSession(row) {
    if ([...this.sessions.values()].some(existing => existing.inviteId === row.inviteId)) throw new Error("duplicate_invite_session");
    this.sessions.set(row.attemptId, { ...row });
  }
  async markInviteActive(inviteId, attemptId, activatedAt) {
    const invite = this.invites.get(inviteId);
    if (invite && invite.state === "issued") Object.assign(invite, { state: "active", attemptId, activatedAt });
  }
  async reserveSession(row) {
    const session = this.sessions.get(row.attemptId);
    if (session && session.state === "active") Object.assign(session, { ...row, state: "reserved" });
  }
  async completeSession(attemptId, result, completedAt, purgeAt) {
    Object.assign(this.sessions.get(attemptId), { state: "completed", result, completedAt, purgeAt });
  }
  async completeInvite(inviteId, attemptId, completedAt, purgeAt) {
    Object.assign(this.invites.get(inviteId), { state: "completed", attemptId, completedAt, purgeAt });
  }
  async getResultByCode(code) { return this.results.get(code) || null; }
  async getResultByRequestId(requestId) { return [...this.results.values()].find(row => row.requestId === requestId) || null; }
  async insertResult(row) { this.results.set(row.code, { ...row }); }
  async appendAudit(row) { this.audit.push(row); }

  async getSessionByTokenHash(tokenHash) { return this.accountSessions.get(tokenHash) || null; }
  async getAccountByProfileId(profileId) { return this.accounts.get(profileId) || null; }
  async listRecentProfileAttempts(profileId, requestTestId, since) {
    const cutoff = asDate(since);
    return [...this.profileAttempts.values()].filter(row => {
      const stamp = asDate(row.completedAt || row.startedAt);
      return row.profileId === profileId && row.testId === requestTestId && stamp && (!cutoff || stamp >= cutoff);
    });
  }
  async getProfileAttemptByAttemptId(attemptId) { return this.profileAttempts.get(attemptId) || null; }
  async upsertProfileAttempt(row) { this.profileAttempts.set(row.attemptId, { ...row }); }
  async completeProfileAttempt(row) {
    const current = this.profileAttempts.get(row.attemptId);
    if (current) Object.assign(current, { ...row, state: "completed" });
  }
  async getSelfServiceSlot(profileId, requestTestId) { return this.selfSlots.get(profileId + "|" + requestTestId) || null; }
  async claimSelfServiceSlot(row) {
    const key = row.profileId + "|" + row.testId;
    const current = this.selfSlots.get(key);
    const now = asDate(row.now);
    const eligible = !current ||
      (current.state === "active" && asDate(current.expiresAt) <= now) ||
      (current.state === "completed" && asDate(current.eligibleAfter) <= now);
    if (eligible) {
      const stored = { ...row, attemptId: "", state: "active" };
      this.selfSlots.set(key, stored);
      return stored;
    }
    return current;
  }
  async activateSelfServiceSlot(row) {
    const current = this.selfSlots.get(row.profileId + "|" + row.testId);
    if (current && current.inviteId === row.inviteId && current.beginRequestId === row.beginRequestId && current.state === "active") {
      Object.assign(current, { attemptId: row.attemptId, expiresAt: row.expiresAt, updatedAt: row.updatedAt });
    }
  }
  async completeSelfServiceSlot(row) {
    const current = this.selfSlots.get(row.profileId + "|" + row.testId);
    if (current && current.attemptId === row.attemptId && current.state === "active") {
      Object.assign(current, { state: "completed", eligibleAfter: row.eligibleAfter, expiresAt: row.completedAt, updatedAt: row.completedAt, purgeAt: row.purgeAt });
    }
  }
}

function addAccount(store, email, marker) {
  const profileId = "acct_" + marker.repeat(32);
  const token = "sca_" + marker.repeat(43);
  store.accounts.set(profileId, { profileId, status: "active", emailHash: hashAccountEmail(identitySecret, email), emailMasked: marker + "***@example.ru" });
  store.accountSessions.set(hashSessionToken(accountSessionSecret, token), { profileId, expiresAt: new Date(currentNow.getTime() + 12 * 60 * 60 * 1000) });
  return { profileId, token };
}

function beginPayload(email, beginRequestId, inviteCode = "") {
  return {
    action: "beginAttempt",
    apiVersion: ASSESSMENT_API_VERSION,
    beginRequestId,
    testId,
    inviteCode,
    email,
    browserFingerprint: "deadbeef",
    clientBuild: "2026.08.09.1",
    privacyConsent: true,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

function savePayload(begin, email, answers) {
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
    telegram: "",
    englishLevel: "B2",
    candidateSource: "Другое",
    candidateExperience: "Стажировка",
    employerShareConsent: false,
    browserFingerprint: "deadbeef",
    tabSwitches: 0,
    clientBuild: "2026.08.09.1",
    answers,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

async function post(handler, body, token = "") {
  const response = await handler({
    httpMethod: "POST",
    headers: { Origin: origin, ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body)
  }, { token: { access_token: "x".repeat(40) } });
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

(async function main() {
  const bank = privateBank();
  const digest = validatePrivateBank(bank);
  const store = new MemoryStore(bank, digest);
  const bankStorage = { async readJson() { return bank; } };
  const reports = new Map();
  const reportStorage = {
    async readText(key) { return reports.get(key) || null; },
    async writeText(key, value) { reports.set(key, value); return { created: true }; }
  };
  const handler = createAssessmentHandler({
    store,
    bankStorage,
    reportStorage,
    signingSecret,
    identitySecret,
    inviteSecret,
    accountSessionSecret,
    allowedOrigin: origin,
    now: () => new Date(currentNow)
  });

  const email = "candidate@example.ru";
  const account = addAccount(store, email, "c");
  const firstRequestId = "scb_" + "a".repeat(24);
  const noAccount = await post(handler, beginPayload(email, firstRequestId));
  assert.equal(noAccount.failureCode, "attempt_unavailable");
  assert.equal(store.selfSlots.size, 0);

  const begin = await post(handler, beginPayload(email, firstRequestId), account.token);
  assert.equal(begin.ok, true);
  assert.equal(begin.questionIds.length, 40);
  const slot = await store.getSelfServiceSlot(account.profileId, testId);
  assert.equal(slot.state, "active");
  assert.equal(slot.attemptId, begin.attemptId);

  const resumed = await post(handler, beginPayload(email, firstRequestId), account.token);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.attemptId, begin.attemptId);
  const duplicate = await post(handler, beginPayload(email, "scb_" + "d".repeat(24)), account.token);
  assert.equal(duplicate.failureCode, "attempt_unavailable");
  assert.equal(store.sessions.size, 1);

  const questions = new Map(bank.questions.map(question => [question.id, question]));
  const answers = begin.questionIds.map(questionId => ({ questionId, optionId: questions.get(questionId).correctOptionId, timedOut: false, timeSpent: 30 }));
  const saved = await post(handler, savePayload(begin, email, answers), account.token);
  assert.equal(saved.ok, true);
  assert.equal(saved.percent, 100);
  assert.equal((await store.getSelfServiceSlot(account.profileId, testId)).state, "completed");
  assert.equal((await store.getProfileAttemptByAttemptId(begin.attemptId)).state, "completed");

  const cooled = await post(handler, beginPayload(email, "scb_" + "e".repeat(24)), account.token);
  assert.equal(cooled.failureCode, "attempt_unavailable");
  currentNow = new Date(currentNow.getTime() + 21 * 24 * 60 * 60 * 1000 + 1000);
  store.accountSessions.get(hashSessionToken(accountSessionSecret, account.token)).expiresAt = new Date(currentNow.getTime() + 12 * 60 * 60 * 1000);
  const afterCooldown = await post(handler, beginPayload(email, "scb_" + "f".repeat(24)), account.token);
  assert.equal(afterCooldown.ok, true);
  assert.notEqual(afterCooldown.attemptId, begin.attemptId);

  const studentEmail = "student@example.ru";
  const student = addAccount(store, studentEmail, "u");
  const groupId = "grp_" + "9".repeat(32);
  const groupIdentity = hmacHex(inviteSecret, "group-code-identity-v1|" + groupId);
  const groupCode = buildDeterministicInviteCode(inviteSecret, groupId, testId, groupIdentity);
  store.groups.set(groupId, {
    groupId,
    testId,
    codeHash: hashInviteCode(inviteSecret, groupCode),
    purpose: "University cohort",
    maxUses: 30,
    usedCount: 0,
    validForHours: 24,
    state: "issued",
    issuedAt: currentNow,
    expiresAt: new Date(currentNow.getTime() + 24 * 60 * 60 * 1000),
    purgeAt: new Date(currentNow.getTime() + 90 * 24 * 60 * 60 * 1000)
  });
  const groupRequest = beginPayload(studentEmail, "scb_" + "g".repeat(24), groupCode);
  assert.equal((await post(handler, groupRequest)).failureCode, "attempt_unavailable");
  assert.equal(store.groups.get(groupId).usedCount, 0);
  const groupBegin = await post(handler, groupRequest, student.token);
  assert.equal(groupBegin.ok, true);
  assert.equal(store.groups.get(groupId).usedCount, 1);

  console.log("Account self-service checks passed: required Yandex session, atomic attempt, idempotent resume, 21-day cooldown and optional cohort attribution.");
})().catch(error => { console.error(error); process.exit(1); });
