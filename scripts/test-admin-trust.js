#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { ASSESSMENT_API_VERSION } = require("../cloud/assessment-core");
const { createAdminPasswordRecord } = require("../cloud/admin-core");
const { hashAccountEmail } = require("../cloud/account-core");
const { createAdminHandler } = require("../cloud/admin-handler");
const { createOrganizationId } = require("../cloud/trust-core");

const now = new Date("2026-08-17T12:00:00.000Z");
const password = "admin-trust-password-long-enough";
const identitySecret = "i".repeat(64);
const candidateProfileId = "acct_" + "1".repeat(32);
const employerProfileId = "acct_" + "2".repeat(32);
const credentialId = "cred_" + "3".repeat(24);

function baseStore() {
  const credential = { candidateProfileId, credentialId, credentialType: "certificate", title: "Финансовое моделирование", issuer: "Университет", description: "Итоговый проект", issuedYear: "2026", evidenceUrl: "https://university.example/proof", visibility: "employer", verificationStatus: "pending", verificationNote: "", createdAt: now.toISOString(), updatedAt: now.toISOString(), purgeAt: "2027-08-17T12:00:00.000Z" };
  const organizations = new Map(), employers = new Map(), audit = [];
  return {
    organizations, employers, audit, credential,
    async getRuntimeSettings() { return {}; }, async getBankMetadata() { return null; }, async getInviteByRequestId() { return null; }, async getInviteById() { return null; }, async listInvites() { return []; }, async upsertInvite() {}, async revokeInvite() {}, async getInviteGroupByRequestId() { return null; }, async getInviteGroupById() { return null; }, async listInviteGroups() { return []; }, async upsertInviteGroup() {}, async revokeInviteGroup() {}, async updateInviteGroupDescription() {}, async getSessionByAttemptId() { return null; }, async getResultByCode() { return null; }, async listResults() { return []; }, async getDiagnostics() { return { results: {}, sessions: {}, invites: {}, reports: {} }; }, async listRankingProfilesByResultCode() { return []; }, async deleteRankingProfile() {}, async getDeletionOperation() { return null; }, async upsertDeletionOperation() {}, async deleteAssessmentData() {}, async appendAudit(row) { audit.push(row); },
    async listCredentialReviewQueue(status) { return this.credential && this.credential.verificationStatus === status ? [this.credential] : []; },
    async getCandidateCredential(profileId, id) { return this.credential && this.credential.candidateProfileId === profileId && this.credential.credentialId === id ? this.credential : null; },
    async setCredentialVerification(_profileId, _id, status, note, updatedAt, purgeAt) { this.credential = { ...this.credential, verificationStatus: status, verificationNote: note, updatedAt, purgeAt }; return this.credential; },
    async getOrganization(id) { return organizations.get(id) || null; },
    async getOrganizationByDomain(domain) { return Array.from(organizations.values()).find(item => item.domain === domain) || null; },
    async upsertOrganization(row) { organizations.set(row.organizationId, row); },
    async getAccountByEmailHash(hash) { return hash === hashAccountEmail(identitySecret, "hr@example.ru") ? { profileId: employerProfileId, status: "active" } : null; },
    async getEmployerByIdentityProfileId(id) { return Array.from(employers.values()).find(item => item.identityProfileId === id) || null; },
    async upsertEmployerAccount(row) { employers.set(row.employerId, row); }
  };
}

const storage = { async readText() { return null; }, async readJson() { return null; }, async writeJson() { return { created: true }; }, async deleteObject() { return true; } };

async function post(handler, action, fields) {
  const response = await handler({ httpMethod: "POST", headers: { Origin: "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net" }, body: JSON.stringify({ action, apiVersion: ASSESSMENT_API_VERSION, password, ...fields }) }, {});
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

(async () => {
  const store = baseStore();
  const handler = createAdminHandler({ store, storage, adminPasswordRecord: createAdminPasswordRecord(password, Buffer.alloc(24, 9), 200000), identitySecret, inviteSecret: "v".repeat(64), deletionSecret: "d".repeat(64), allowedOrigins: ["https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"], now: () => new Date(now) });

  const queue = await post(handler, "adminTrustReviewQueue", {});
  assert.equal(queue.credentials.length, 1);
  assert.equal(queue.credentials[0].evidenceUrl, "https://university.example/proof");
  const reviewed = await post(handler, "adminReviewCredential", { profileId: candidateProfileId, credentialId, decision: "verified", note: "Проверено по ссылке" });
  assert.equal(reviewed.credential.verificationStatus, "verified");

  const organization = await post(handler, "adminUpsertOrganization", { displayName: "Example", legalName: "ООО «Экзампл»", domain: "example.ru", websiteUrl: "https://example.ru/careers", description: "Финансовые технологии" });
  assert.equal(organization.organization.verificationStatus, "verified");
  assert.equal(organization.organization.organizationId, createOrganizationId(identitySecret, "example.ru"));

  const employer = await post(handler, "adminAuthorizeEmployer", { email: "hr@example.ru", domain: "example.ru", role: "recruiter" });
  assert.equal(employer.employer.verificationStatus, "verified");
  assert.equal(employer.employer.emailMasked, "h***@example.ru");
  assert.equal(store.employers.size, 1);
  assert.equal(store.audit.length, 3);

  const invalidWebsite = await post(handler, "adminUpsertOrganization", { displayName: "Fake", legalName: "ООО «Фейк»", domain: "example.ru", websiteUrl: "https://unrelated.ru", description: "" });
  assert.equal(invalidWebsite.failureCode, "invalid_website");
  console.log("Admin trust checks passed: private evidence review, verified organization, Yandex-account employer authorization and domain-bound website validation.");
})().catch(error => { console.error(error); process.exitCode = 1; });
