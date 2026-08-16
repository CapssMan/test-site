#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { ACCOUNT_API_VERSION, ACCOUNT_CONSENT_VERSION, PUBLIC_PROFILE_CONSENT_VERSION, hashSessionToken } = require("../cloud/account-core");
const { createAccountHandler } = require("../cloud/account-handler");
const { EMPLOYER_API_VERSION, publicTalentId } = require("../cloud/employer-core");
const { createEmployerHandler } = require("../cloud/employer-handler");
const { createInvitationId, validateCandidateInvitationAction, validateEmployerInvitationAction } = require("../cloud/invitation-core");

const origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
const now = new Date("2026-08-16T09:00:00.000Z");
const sessionSecret = "session-secret-for-invitation-tests-123456789";
const talentSecret = "talent-secret-for-invitation-tests-1234567890";
const employerToken = "sca_" + "a".repeat(43);
const candidateToken = "sca_" + "b".repeat(43);
const employerProfileId = "acct_" + "1".repeat(32);
const candidateProfileId = "acct_" + "2".repeat(32);
const employerId = "emp_" + "3".repeat(24);
const shortlistId = "short_" + "4".repeat(24);
const talentProfileId = publicTalentId(talentSecret, candidateProfileId);

function event(method, body, token) {
  return { httpMethod: method, headers: { Origin: origin, ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined };
}

function createStore(invitationEnabled) {
  const employerAccount = { profileId: employerProfileId, status: "active", emailMasked: "h***@example.ru" };
  const candidateAccount = {
    profileId: candidateProfileId, status: "active", emailMasked: "c***@example.ru", publicAlias: "Кандидат К.",
    visibility: "discoverable", jobStatus: "active", region: "Москва", workFormat: "hybrid", experienceBand: "under_1",
    currentRole: "Стажёр", targetRole: "Финансовый аналитик", experienceSummary: "Финансовая модель", professionalTools: "Excel",
    availabilityConfirmedAt: now.toISOString(), accountConsentVersion: ACCOUNT_CONSENT_VERSION,
    publicConsentVersion: PUBLIC_PROFILE_CONSENT_VERSION, createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
  const state = { invitations: new Map() };
  return {
    state,
    async getRuntimeSettings() { return { employer_workspace_enabled: "true", employer_contact_enabled: "false", employer_invitation_enabled: invitationEnabled ? "true" : "false", profile_publication_enabled: "true", account_registration_enabled: "true", account_self_service_enabled: "true", account_required_for_attempts: "true" }; },
    async getSessionByTokenHash(hash) {
      if (hash === hashSessionToken(sessionSecret, employerToken)) return { profileId: employerProfileId, expiresAt: new Date(now.getTime() + 86400000).toISOString() };
      if (hash === hashSessionToken(sessionSecret, candidateToken)) return { profileId: candidateProfileId, expiresAt: new Date(now.getTime() + 86400000).toISOString() };
      return null;
    },
    async getAccountByProfileId(id) { return id === employerProfileId ? employerAccount : id === candidateProfileId ? candidateAccount : null; },
    async getEmployerByIdentityProfileId(id) { return id === employerProfileId ? { employerId, identityProfileId: id, organizationName: "Проверенная компания", verificationStatus: "verified", status: "active" } : null; },
    async listDiscoverableAccounts() { return [candidateAccount]; },
    async listProfileAttempts(id) { return id === candidateProfileId ? [{ profileId: id, testId: "fa-junior", state: "completed", resultCode: "FA-ABCDE", percent: 91, bankVersion: "FA v6", completedAt: now.toISOString() }] : []; },
    async createShortlist() {},
    async listShortlists() { return [{ employerId, shortlistId, name: "Финансовые аналитики", roleTemplateId: "financial-analyst", updatedAt: now.toISOString() }]; },
    async getShortlist(id, shortId) { return id === employerId && shortId === shortlistId ? { employerId, shortlistId, name: "Финансовые аналитики", roleTemplateId: "financial-analyst", updatedAt: now.toISOString() } : null; },
    async listShortlistItems() { return [{ employerId, shortlistId, talentProfileId, candidateProfileId }]; },
    async addShortlistItem() {},
    async removeShortlistItem() {},
    async upsertInvitation(row) { state.invitations.set(row.invitationId, { ...row }); },
    async listEmployerInvitations(id) { return [...state.invitations.values()].filter(row => row.employerId === id); },
    async listCandidateInvitations(id) { return [...state.invitations.values()].filter(row => row.candidateProfileId === id); },
    async getCandidateInvitation(id, invitationId) { const row = state.invitations.get(invitationId); return row && row.candidateProfileId === id ? row : null; },
    async markInvitationViewed(id, invitationId, viewedAt) { const row = await this.getCandidateInvitation(id, invitationId); if (row.status === "sent") Object.assign(row, { status: "viewed", viewedAt, updatedAt: viewedAt }); return row; },
    async respondInvitation(id, invitationId, response, respondedAt) { const row = await this.getCandidateInvitation(id, invitationId); if (["sent", "viewed"].includes(row.status)) Object.assign(row, { status: response, respondedAt, updatedAt: respondedAt }); return row; }
  };
}

(async () => {
  const requestId = "invite_req_" + "6".repeat(32);
  const request = { action: "createInvitationBatch", apiVersion: EMPLOYER_API_VERSION, shortlistId, requestId,
    roleTitle: "Финансовый аналитик", roleSummary: "Анализ отчётности и подготовка финансовой модели.",
    workFormat: "hybrid", region: "Москва", compensation: "от 90 000 ₽", responseDeadline: new Date(now.getTime() + 7 * 86400000).toISOString() };
  assert.equal(validateEmployerInvitationAction(request, EMPLOYER_API_VERSION).type, "createInvitationBatch");
  assert.equal(validateCandidateInvitationAction({ action: "respondInvitation", apiVersion: ACCOUNT_API_VERSION, invitationId: "inv_" + "7".repeat(32), response: "details" }, ACCOUNT_API_VERSION).response, "details");
  assert.throws(() => validateCandidateInvitationAction({ action: "respondInvitation", apiVersion: ACCOUNT_API_VERSION, invitationId: "inv_" + "7".repeat(32), response: "accept_and_share_phone" }, ACCOUNT_API_VERSION));

  const store = createStore(true);
  const employer = createEmployerHandler({ store, sessionSecret, talentSecret, allowedOrigins: [origin], now: () => now });
  const employerConfig = JSON.parse((await employer(event("GET"))).body);
  assert.equal(employerConfig.backendVersion, "yandex-employer-invitations-2026-08-16-1");
  assert.equal(employerConfig.invitationEnabled, true);
  assert.equal(employerConfig.contactEnabled, false);
  const createdResponse = await employer(event("POST", request, employerToken));
  assert.equal(createdResponse.statusCode, 200);
  const created = JSON.parse(createdResponse.body);
  assert.equal(created.createdCount, 1);
  const invitation = created.invitations[0];
  assert.equal(invitation.invitationId, createInvitationId(talentSecret, employerId, requestId, candidateProfileId));
  assert.equal(invitation.status, "sent");
  assert.equal(JSON.stringify(created).includes(candidateProfileId), false);
  assert.equal(/email|phone|телефон/i.test(JSON.stringify(created)), false);
  const retried = JSON.parse((await employer(event("POST", request, employerToken))).body);
  assert.equal(retried.invitations[0].invitationId, invitation.invitationId);
  assert.equal(store.state.invitations.size, 1);
  const duplicateResponse = await employer(event("POST", { ...request, requestId: "invite_req_" + "8".repeat(32) }, employerToken));
  assert.equal(duplicateResponse.statusCode, 409);
  assert.equal(JSON.parse(duplicateResponse.body).error, "active_invitation_exists");

  const account = createAccountHandler({ store, fetchImpl: async () => { throw new Error("unused"); }, clientId: "1234567890abcdefghij1234567890ab", redirectUri: origin + "/account.html", identitySecret: talentSecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const listed = JSON.parse((await account(event("POST", { action: "listInvitations", apiVersion: ACCOUNT_API_VERSION }, candidateToken))).body);
  assert.equal(listed.invitationEnabled, true);
  assert.equal(listed.invitations[0].organizationName, "Проверенная компания");
  assert.equal(Object.prototype.hasOwnProperty.call(listed.invitations[0], "employerId"), false);
  const viewed = JSON.parse((await account(event("POST", { action: "markInvitationViewed", apiVersion: ACCOUNT_API_VERSION, invitationId: invitation.invitationId }, candidateToken))).body);
  assert.equal(viewed.invitation.status, "viewed");
  const responded = JSON.parse((await account(event("POST", { action: "respondInvitation", apiVersion: ACCOUNT_API_VERSION, invitationId: invitation.invitationId, response: "interested" }, candidateToken))).body);
  assert.equal(responded.invitation.status, "interested");
  const employerList = JSON.parse((await employer(event("POST", { action: "listInvitations", apiVersion: EMPLOYER_API_VERSION }, employerToken))).body);
  assert.equal(employerList.invitations[0].status, "interested");
  assert.equal(employerList.invitations[0].candidateAlias, "Кандидат К.");

  const closedStore = createStore(false);
  const closedEmployer = createEmployerHandler({ store: closedStore, sessionSecret, talentSecret, allowedOrigins: [origin], now: () => now });
  assert.equal(JSON.parse((await closedEmployer(event("GET"))).body).invitationEnabled, false);
  const closedCreate = await closedEmployer(event("POST", request, employerToken));
  assert.equal(closedCreate.statusCode, 403);
  assert.equal(JSON.parse(closedCreate.body).error, "employer_invitation_closed");

  console.log("Employer invitation checks passed: 1-10 shortlist batch, idempotency, anti-spam, candidate responses, status sync and no contact disclosure.");
})().catch(error => { console.error(error); process.exit(1); });
