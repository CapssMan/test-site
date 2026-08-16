#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { ACCOUNT_API_VERSION, ACCOUNT_CONSENT_VERSION, EXTENDED_PROFILE_CONSENT_VERSION, PUBLIC_PROFILE_CONSENT_VERSION, hashSessionToken } = require("../cloud/account-core");
const { createAccountHandler } = require("../cloud/account-handler");
const { EMPLOYER_API_VERSION } = require("../cloud/employer-core");
const { createEmployerHandler } = require("../cloud/employer-handler");
const { createConversationId } = require("../cloud/chat-core");

const origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
const now = new Date("2026-08-17T10:00:00.000Z");
const sessionSecret = "extended-session-secret-12345678901234567890";
const identitySecret = "extended-identity-secret-1234567890123456789";
const employerToken = "sca_" + "a".repeat(43);
const candidateToken = "sca_" + "b".repeat(43);
const employerProfileId = "acct_" + "1".repeat(32);
const candidateProfileId = "acct_" + "2".repeat(32);
const employerId = "emp_" + "3".repeat(24);
const organizationId = "org_" + "4".repeat(24);
const invitationId = "inv_" + "5".repeat(32);

function event(method, body, token) {
  return { httpMethod: method, headers: { Origin: origin, ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined };
}

function createStore() {
  const employerAccount = { profileId: employerProfileId, status: "active", emailMasked: "h***@example.ru" };
  const candidateAccount = { profileId: candidateProfileId, status: "active", emailMasked: "c***@example.ru", publicAlias: "Кандидат К.", visibility: "discoverable", jobStatus: "active", region: "Москва", workFormat: "hybrid", experienceBand: "under_1", currentRole: "Стажёр", targetRole: "Финансовый аналитик", experienceSummary: "Финансовая модель", professionalTools: "Excel", availabilityConfirmedAt: now.toISOString(), accountConsentVersion: ACCOUNT_CONSENT_VERSION, publicConsentVersion: PUBLIC_PROFILE_CONSENT_VERSION, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  const verifiedCredential = { candidateProfileId, credentialId: "cred_" + "6".repeat(24), credentialType: "certificate", title: "Финансовое моделирование", issuer: "Университет", description: "Итоговый проект", issuedYear: "2026", evidenceUrl: "https://example.ru/private-proof", visibility: "employer", verificationStatus: "verified", verificationNote: "", createdAt: now.toISOString(), updatedAt: now.toISOString(), purgeAt: now.toISOString() };
  const invitation = { candidateProfileId, invitationId, employerId, shortlistId: "short_" + "7".repeat(24), talentProfileId: "talent_" + "8".repeat(32), candidateAlias: "Кандидат К.", organizationName: "Проверенная компания", roleTitle: "Финансовый аналитик", roleSummary: "Следующий этап", workFormat: "hybrid", region: "Москва", compensation: "Обсуждается", status: "interested", responseDeadline: new Date(now.getTime() + 86400000), createdAt: now, viewedAt: now, respondedAt: now, updatedAt: now };
  const state = { credentials: new Map([[verifiedCredential.credentialId, verifiedCredential]]), conversations: new Map(), messages: new Map() };
  return {
    state,
    async getRuntimeSettings() { return { account_registration_enabled: "true", account_self_service_enabled: "true", account_required_for_attempts: "true", attempt_issuance_enabled: "true", profile_publication_enabled: "true", employer_workspace_enabled: "true", employer_invitation_enabled: "true", candidate_credentials_enabled: "true", employer_company_profiles_enabled: "true", employer_chat_enabled: "true", employer_contact_enabled: "false" }; },
    async getSessionByTokenHash(hash) { if (hash === hashSessionToken(sessionSecret, employerToken)) return { profileId: employerProfileId, expiresAt: new Date(now.getTime() + 86400000) }; if (hash === hashSessionToken(sessionSecret, candidateToken)) return { profileId: candidateProfileId, expiresAt: new Date(now.getTime() + 86400000) }; return null; },
    async getAccountByProfileId(id) { return id === employerProfileId ? employerAccount : id === candidateProfileId ? candidateAccount : null; },
    async getEmployerByIdentityProfileId(id) { return id === employerProfileId ? { employerId, identityProfileId: id, organizationId, organizationName: "Проверенная компания", role: "recruiter", verificationStatus: "verified", status: "active" } : null; },
    async getOrganization(id) { return id === organizationId ? { organizationId, displayName: "Проверенная компания", legalName: "ООО «Проверенная компания»", domain: "example.ru", websiteUrl: "https://example.ru", description: "Финансовые технологии", verificationStatus: "verified", status: "active" } : null; },
    async listDiscoverableAccounts() { return [candidateAccount]; },
    async listProfileAttempts(id) { return id === candidateProfileId ? [{ testId: "fa-junior", state: "completed", resultCode: "FA-ABCDE", percent: 92, bankVersion: "FA v6", completedAt: now.toISOString() }] : []; },
    async listCandidateCredentials(id) { return id === candidateProfileId ? [...state.credentials.values()] : []; },
    async listVerifiedCandidateCredentials(id) { return id === candidateProfileId ? [...state.credentials.values()].filter(row => row.verificationStatus === "verified") : []; },
    async getCandidateCredential(id, credentialId) { const row = state.credentials.get(credentialId); return row && row.candidateProfileId === id ? row : null; },
    async upsertCandidateCredential(row) { state.credentials.set(row.credentialId, { ...row }); },
    async deleteCandidateCredential(id, credentialId) { const row = state.credentials.get(credentialId); if (row && row.candidateProfileId === id) state.credentials.delete(credentialId); },
    async deleteAllCandidateCredentials() { state.credentials.clear(); },
    async listCandidateInvitations(id) { return id === candidateProfileId ? [invitation] : []; },
    async getCandidateInvitation(id, requestedId) { return id === candidateProfileId && requestedId === invitationId ? invitation : null; },
    async markInvitationViewed() { return invitation; },
    async respondInvitation() { return invitation; },
    async createConversation(row) { if (!state.conversations.has(row.conversationId)) state.conversations.set(row.conversationId, { ...row }); return state.conversations.get(row.conversationId); },
    async listCandidateConversations(id) { return [...state.conversations.values()].filter(row => row.candidateProfileId === id); },
    async listEmployerConversations(id) { return [...state.conversations.values()].filter(row => row.employerId === id); },
    async getCandidateConversation(id, conversationId) { const row = state.conversations.get(conversationId); return row && row.candidateProfileId === id ? row : null; },
    async getEmployerConversation(id, conversationId) { const row = state.conversations.get(conversationId); return row && row.employerId === id ? row : null; },
    async listConversationMessages(conversationId) { return state.messages.get(conversationId) || []; },
    async writeMessage(row) { const rows = state.messages.get(row.conversationId) || []; if (!rows.some(item => item.messageId === row.messageId)) rows.push({ ...row }); state.messages.set(row.conversationId, rows); return row; },
    async markConversationRead(id, conversationId, viewerType) { const row = state.conversations.get(conversationId); if (row) row[viewerType === "candidate" ? "candidateUnreadCount" : "employerUnreadCount"] = 0; },
    async setConversationState(id, conversationId, viewerType, value) { const row = state.conversations.get(conversationId); if (row) row.state = value; },
    async deleteCandidateChats() { state.conversations.clear(); state.messages.clear(); },
    async createShortlist() {}, async listShortlists() { return []; }, async getShortlist() { return null; }, async listShortlistItems() { return []; }, async addShortlistItem() {}, async removeShortlistItem() {}, async listEmployerInvitations() { return [invitation]; }, async upsertInvitation() {}, async deleteSession() {}, async deleteAccount() {}, async updateProfile() {},
    async getAccountByProviderSubject() { return null; }, async getAccountByEmailHash() { return null; }, async upsertAccount() {}, async insertSession() {}
  };
}

(async () => {
  const store = createStore();
  const account = createAccountHandler({ store, fetchImpl: async () => { throw new Error("unused"); }, clientId: "1234567890abcdefghij1234567890ab", redirectUri: origin + "/account.html", identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const employer = createEmployerHandler({ store, sessionSecret, talentSecret: identitySecret, allowedOrigins: [origin], now: () => now });

  const profile = JSON.parse((await account(event("POST", { action: "getProfile", apiVersion: ACCOUNT_API_VERSION }, candidateToken))).body);
  assert.equal(profile.credentialsEnabled, true);
  assert.equal(profile.credentials[0].verificationStatus, "verified");
  assert.equal(profile.chatEnabled, true);
  assert.equal(profile.conversations.length, 1);
  const conversationId = createConversationId(identitySecret, invitationId);
  assert.equal(profile.conversations[0].conversationId, conversationId);

  const createdCredential = JSON.parse((await account(event("POST", { action: "upsertCredential", apiVersion: ACCOUNT_API_VERSION, credentialId: "", credentialType: "project", title: "Финансовая модель", issuer: "Учебный проект", description: "Три сценария", issuedYear: "2026", evidenceUrl: "https://example.ru/project", visibility: "employer", accountConsent: EXTENDED_PROFILE_CONSENT_VERSION }, candidateToken))).body);
  assert.equal(createdCredential.credential.verificationStatus, "pending");

  const employerConfig = JSON.parse((await employer(event("GET"))).body);
  assert.equal(employerConfig.companyProfilesEnabled, true);
  assert.equal(employerConfig.chatEnabled, true);
  assert.equal(employerConfig.contactEnabled, false);
  const search = JSON.parse((await employer(event("POST", { action: "searchTalent", apiVersion: EMPLOYER_API_VERSION, roleTemplateId: "financial-analyst", query: "", minScore: 0, region: "", workFormat: "", experienceBand: "", jobStatus: "", limit: 25 }, employerToken))).body);
  assert.equal(search.employer.organization.displayName, "Проверенная компания");
  assert.equal(search.entries[0].credentials.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(search.entries[0].credentials[0], "evidenceUrl"), false);

  const employerConversations = JSON.parse((await employer(event("POST", { action: "listConversations", apiVersion: EMPLOYER_API_VERSION }, employerToken))).body);
  assert.equal(employerConversations.conversations[0].candidateAlias, "Кандидат К.");
  const sent = JSON.parse((await employer(event("POST", { action: "sendMessage", apiVersion: EMPLOYER_API_VERSION, conversationId, clientMessageId: "chat_req_" + "9".repeat(32), text: "Добрый день! Расскажем о следующем этапе здесь." }, employerToken))).body);
  assert.equal(sent.message.senderType, "employer");
  const messages = JSON.parse((await account(event("POST", { action: "listMessages", apiVersion: ACCOUNT_API_VERSION, conversationId, limit: 50 }, candidateToken))).body);
  assert.equal(messages.messages[0].text.includes("следующем этапе"), true);
  const contactAttempt = await account(event("POST", { action: "sendMessage", apiVersion: ACCOUNT_API_VERSION, conversationId, clientMessageId: "chat_req_" + "a".repeat(32), text: "Моя почта candidate@example.ru" }, candidateToken));
  assert.equal(contactAttempt.statusCode, 400);
  const employerBlock = await employer(event("POST", { action: "setConversationState", apiVersion: EMPLOYER_API_VERSION, conversationId, state: "blocked" }, employerToken));
  assert.equal(employerBlock.statusCode, 403);

  console.log("Verified profiles and chat checks passed: private evidence, verified company, verified-only badges, accepted-invitation chat, contact gate and candidate-only blocking.");
})().catch(error => { console.error(error); process.exit(1); });
