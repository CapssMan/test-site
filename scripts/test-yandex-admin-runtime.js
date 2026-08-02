"use strict";

const assert = require("node:assert/strict");
const {
  ASSESSMENT_API_VERSION,
  AUTHORITATIVE_SCORING_VERSION,
  PRIVACY_CONSENT_VERSION,
  SCORE_VERIFICATION_SERVER,
  TESTS,
  hashIdentity
} = require("../cloud/assessment-core");
const {
  createAdminPasswordRecord,
  verifyAdminPassword
} = require("../cloud/admin-core");
const { createAdminHandler } = require("../cloud/admin-handler");

const now = new Date("2026-07-28T09:00:00.000Z");
const password = "correct horse battery staple";
const passwordRecord = createAdminPasswordRecord(password, Buffer.alloc(24, 7), 200000);
const identitySecret = "h".repeat(64);
const inviteSecret = "i".repeat(64);
const deletionSecret = "d".repeat(64);
const code = "FA-ABCDE";
const attemptId = "att_" + "1".repeat(32);
const inviteId = "inv_" + "2".repeat(32);

class MemoryAdminStore {
  constructor() {
    this.settings = { legal_pilot_approved: "false", attempt_issuance_enabled: "false", retention_automation_enabled: "true" };
    this.results = new Map([[code, {
      code, requestId: "scs_" + "3".repeat(24), attemptId, testId: "fa-junior", testTitle: TESTS["fa-junior"].title,
      bankVersion: TESTS["fa-junior"].bankVersion, name: "Кандидат", email: "candidate@example.ru", telegram: "@candidate_test",
      englishLevel: "B2", candidateSource: "Другое", candidateExperience: "Стажировка",
      rawScore: 40, rawTotal: 40, unansweredCount: 0, finalScore: 100, percent: 100, tabSwitches: 0,
      advisoryPenalty: 0, trustScore: 100, status: "passed", badge: "Junior Strong", recommendation: "Рекомендуется к интервью",
      blockResults: { finance: { name: "Finance", earned: 40, total: 40, percent: 100, weight: 1 } },
      answerDetails: [{ questionId: "fa_001", topic: "Reporting", block: "reporting", difficulty: "medium",
        question: "Какой показатель нужен?", isCorrect: true, timedOut: false, status: "Верно", timeSpent: 30, timeLimit: 60 }],
      scoreVerification: SCORE_VERIFICATION_SERVER,
      scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION, telemetryVerification: "client-reported-unverified",
      privacyConsentVersion: PRIVACY_CONSENT_VERSION, privacyConsentedAt: now.toISOString(), ageConfirmed: true,
      reportCreated: true, reportObjectKey: "reports/" + code + ".txt", submissionHash: "4".repeat(64),
      completedAt: now.toISOString(), technical: false, purgeAt: "2027-07-28T09:00:00.000Z"
    }]]);
    this.sessions = new Map([[attemptId, { attemptId, inviteId, state: "completed", testId: "fa-junior", resultCode: code }]]);
    this.invites = new Map([[inviteId, {
      inviteId, requestId: "sci_" + "5".repeat(24), testId: "fa-junior", identityHash: "6".repeat(64), emailMasked: "c***@example.ru",
      purpose: "Pilot", state: "completed", issuedAt: now.toISOString(), expiresAt: "2026-07-29T09:00:00.000Z", attemptId, completedAt: now.toISOString()
    }]]);
    this.inviteGroups = new Map();
    this.rankings = [{ testId: "fa-junior", publicProfileId: "pub_1", resultCode: code, publicAlias: "Кандидат" }];
    this.operations = new Map();
    this.audit = [];
  }
  async getRuntimeSettings() { return this.settings; }
  async getBankMetadata(testId, version) { return testId === "fa-junior" && version === TESTS[testId].bankVersion ? { active: true } : null; }
  async getInviteByRequestId(requestId) { return Array.from(this.invites.values()).find(invite => invite.requestId === requestId) || null; }
  async getInviteById(id) { return this.invites.get(id) || null; }
  async listInvites() { return Array.from(this.invites.values()); }
  async upsertInvite(invite) { this.invites.set(invite.inviteId, Object.assign({}, invite)); }
  async revokeInvite(id, requestId, revokedAt, purgeAt) { Object.assign(this.invites.get(id), { state: "revoked", revokeRequestId: requestId, revokedAt, purgeAt }); }
  async getInviteGroupByRequestId(requestId) { return Array.from(this.inviteGroups.values()).find(group => group.requestId === requestId) || null; }
  async getInviteGroupById(groupId) { return this.inviteGroups.get(groupId) || null; }
  async listInviteGroups() { return Array.from(this.inviteGroups.values()); }
  async upsertInviteGroup(group) { this.inviteGroups.set(group.groupId, Object.assign({}, group)); }
  async revokeInviteGroup(groupId, requestId, revokedAt, purgeAt) { Object.assign(this.inviteGroups.get(groupId), { state: "revoked", revokeRequestId: requestId, revokedAt, purgeAt }); }
  async updateInviteGroupDescription(groupId, purpose) { Object.assign(this.inviteGroups.get(groupId), { purpose }); }
  async getSessionByAttemptId(id) { return this.sessions.get(id) || null; }
  async getResultByCode(resultCode) { return this.results.get(resultCode) || null; }
  async listResults() { return Array.from(this.results.values()); }
  async getDiagnostics() {
    return {
      results: { rowCount: this.results.size, lastRecordAt: now.toISOString() },
      sessions: { rowCount: this.sessions.size, lastRecordAt: now.toISOString() },
      invites: { rowCount: this.invites.size, lastRecordAt: now.toISOString() },
      reports: { rowCount: this.results.size, lastRecordAt: now.toISOString() }
    };
  }
  async listRankingProfilesByResultCode(resultCode) { return this.rankings.filter(profile => profile.resultCode === resultCode); }
  async deleteRankingProfile(testId, publicProfileId) { this.rankings = this.rankings.filter(profile => profile.testId !== testId || profile.publicProfileId !== publicProfileId); }
  async getDeletionOperation(requestId) { return this.operations.get(requestId) || null; }
  async upsertDeletionOperation(operation) { this.operations.set(operation.requestId, Object.assign({}, operation)); }
  async deleteAssessmentData(snapshot) {
    this.results.delete(snapshot.code);
    if (snapshot.scope === "full_attempt") {
      if (snapshot.session) this.sessions.delete(snapshot.session.attemptId);
      if (snapshot.invite) this.invites.delete(snapshot.invite.inviteId);
    }
  }
  async appendAudit(event) { this.audit.push(event); }
}

class MemoryStorage {
  constructor() { this.objects = new Map([["reports/" + code + ".txt", "PRIVATE REPORT"]]); }
  async readText(key) { return this.objects.has(key) ? String(this.objects.get(key)) : null; }
  async readJson(key) { return this.objects.has(key) ? JSON.parse(String(this.objects.get(key))) : null; }
  async writeJson(key, value, _context, options) {
    if (options && options.createOnly && this.objects.has(key)) return { created: false };
    this.objects.set(key, JSON.stringify(value));
    return { created: true };
  }
  async deleteObject(key) { this.objects.delete(key); return true; }
}

async function post(handler, action, requestPassword, fields) {
  const body = Object.assign({}, fields || {}, { action, apiVersion: ASSESSMENT_API_VERSION, password: requestPassword });
  const response = await handler({ httpMethod: "POST", body: JSON.stringify(body) }, {});
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

(async function main() {
  assert.equal(verifyAdminPassword(password, passwordRecord), true);
  assert.equal(verifyAdminPassword("wrong", passwordRecord), false);
  const store = new MemoryAdminStore();
  const storage = new MemoryStorage();
  const handler = createAdminHandler({
    store, storage, adminPasswordRecord: passwordRecord, identitySecret, inviteSecret, deletionSecret,
    now: () => new Date(now),
    propertyPresence: [{ name: "PRIVATE_BUCKET", present: true, required: true }]
  });

  const denied = await post(handler, "adminResults", "wrong", {});
  assert.equal(denied.message, "Доступ запрещён.");
  const results = await post(handler, "adminResults", password, {});
  assert.equal(results.results.length, 1);
  assert.equal(results.results[0].scoreVerification, "server-verified");
  const analytics = await post(handler, "adminQuestionAnalytics", password, {});
  assert.equal(analytics.privacy, "aggregate-no-candidate-data");
  assert.equal(analytics.minimumInitialSample, 10);
  assert.equal(analytics.minimumStableSample, 20);
  assert.equal(analytics.tests.length, 5);
  const financialAnalytics = analytics.tests.find(test => test.testId === "fa-junior");
  assert.equal(financialAnalytics.completedAttempts, 1);
  assert.equal(financialAnalytics.questions[0].questionId, "fa_001");
  assert.equal(financialAnalytics.questions[0].correctRate, 100);
  assert.equal(JSON.stringify(analytics).includes("candidate@example.ru"), false);
  assert.equal(JSON.stringify(analytics).includes("@candidate_test"), false);
  const report = await post(handler, "adminReport", password, { code });
  assert.equal(report.reportText, "PRIVATE REPORT");
  const diagnostics = await post(handler, "adminDiagnostics", password, {});
  assert.equal(diagnostics.status, "healthy");
  assert.equal(diagnostics.gates.attemptIssuanceEnabled, false);

  const inviteRequest = {
    requestId: "sci_" + "7".repeat(24), testId: "fa-junior", email: "new@example.ru", validForHours: 24, purpose: "Pilot"
  };
  const locked = await post(handler, "adminCreateInvite", password, inviteRequest);
  assert.equal(locked.failureCode, "pilot_locked");
  store.settings.legal_pilot_approved = "true";
  store.settings.attempt_issuance_enabled = "true";
  const issued = await post(handler, "adminCreateInvite", password, inviteRequest);
  assert.match(issued.inviteId, /^inv_[a-f0-9]{32}$/);
  assert.match(issued.inviteCode, /^SC1(?:-[A-F0-9]{4}){8}$/);
  const replayedInvite = await post(handler, "adminCreateInvite", password, inviteRequest);
  assert.equal(replayedInvite.replayed, true);
  const revoke = await post(handler, "adminRevokeInvite", password, { requestId: "scr_" + "8".repeat(24), inviteId: issued.inviteId });
  assert.equal(revoke.status, "revoked");
  assert.match(hashIdentity(identitySecret, "fa-junior", "new@example.ru"), /^[a-f0-9]{64}$/);
  const groupRequest = {
    requestId: "scg_" + "a".repeat(24), testId: "fa-junior", maxUses: 30, validForHours: 168, purpose: "University pilot"
  };
  const issuedGroup = await post(handler, "adminCreateInviteGroup", password, groupRequest);
  assert.match(issuedGroup.groupId, /^grp_[a-f0-9]{32}$/);
  assert.match(issuedGroup.inviteCode, /^SC1(?:-[A-F0-9]{4}){8}$/);
  assert.equal(issuedGroup.maxUses, 30);
  const replayedGroup = await post(handler, "adminCreateInviteGroup", password, groupRequest);
  assert.equal(replayedGroup.replayed, true);
  const listed = await post(handler, "adminInvites", password, {});
  assert.equal(listed.inviteGroups.length, 1);
  const groupBeforeEdit = Object.assign({}, store.inviteGroups.get(issuedGroup.groupId));
  const editedGroup = await post(handler, "adminUpdateInviteGroupDescription", password, {
    requestId: "sge_" + "c".repeat(24), groupId: issuedGroup.groupId, purpose: "Экономический факультет, поток 1"
  });
  assert.equal(editedGroup.status, "updated");
  assert.equal(editedGroup.purpose, "Экономический факультет, поток 1");
  assert.equal(editedGroup.replayed, false);
  const groupAfterEdit = store.inviteGroups.get(issuedGroup.groupId);
  for (const field of ["testId", "maxUses", "usedCount", "validForHours", "state", "issuedAt", "expiresAt", "purgeAt", "codeHash"]) {
    assert.deepEqual(groupAfterEdit[field], groupBeforeEdit[field], field + " must not change during description edit");
  }
  const replayedEdit = await post(handler, "adminUpdateInviteGroupDescription", password, {
    requestId: "sge_" + "c".repeat(24), groupId: issuedGroup.groupId, purpose: "Экономический факультет, поток 1"
  });
  assert.equal(replayedEdit.replayed, true);
  const rejectedScopeExpansion = await post(handler, "adminUpdateInviteGroupDescription", password, {
    requestId: "sge_" + "d".repeat(24), groupId: issuedGroup.groupId, purpose: "Попытка", maxUses: 100
  });
  assert.equal(rejectedScopeExpansion.ok, false);
  const revokedGroup = await post(handler, "adminRevokeInviteGroup", password, { requestId: "sgr_" + "b".repeat(24), groupId: issuedGroup.groupId });
  assert.equal(revokedGroup.status, "revoked");

  const preview = await post(handler, "adminDeletionPreview", password, { code, scope: "full_attempt" });
  assert.equal(preview.found, true);
  assert.equal(preview.counts.adminRows, 1);
  const deletionRequestId = "scd_" + "9".repeat(32);
  const deleted = await post(handler, "adminDeleteResult", password, {
    code, scope: "full_attempt", requestId: deletionRequestId, confirmationCode: code, previewToken: preview.previewToken
  });
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.backupPurged, true);
  assert.equal(store.results.size, 0);
  assert.equal(store.sessions.size, 0);
  assert.equal(store.rankings.length, 0);
  assert.equal(storage.objects.size, 0);
  const deletionReplay = await post(handler, "adminDeleteResult", password, {
    code, scope: "full_attempt", requestId: deletionRequestId, confirmationCode: code, previewToken: preview.previewToken
  });
  assert.equal(deletionReplay.replayed, true);

  console.log("Yandex admin runtime checks passed: PBKDF2 auth, aggregate question analytics, results, reports, diagnostics, description-only group edits, replay-safe revocation and verified deletion.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
