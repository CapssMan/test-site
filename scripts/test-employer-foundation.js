#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PUBLIC_PROFILE_CONSENT_VERSION, hashSessionToken, randomToken } = require("../cloud/account-core");
const {
  EMPLOYER_API_VERSION,
  MAX_SHORTLIST_SIZE,
  buildTalentCandidate,
  normalizeSearch,
  publicTalentId,
  rankTalent,
  validateAction
} = require("../cloud/employer-core");
const { createEmployerHandler } = require("../cloud/employer-handler");

const origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
const now = new Date("2026-08-09T09:00:00.000Z");
const sessionSecret = "employer-session-secret-for-tests-123456789";
const talentSecret = "employer-talent-secret-for-tests-1234567890";
const token = randomToken();
const profileId = "acct_" + "a".repeat(32);

function candidate(overrides) {
  return Object.assign({
    profileId,
    status: "active",
    emailHash: "private-email-hash",
    emailMasked: "c***@example.ru",
    publicAlias: "Кандидат К.",
    visibility: "discoverable",
    jobStatus: "active",
    region: "Москва",
    workFormat: "hybrid",
    experienceBand: "1_3",
    publicConsentVersion: PUBLIC_PROFILE_CONSENT_VERSION,
    updatedAt: now.toISOString()
  }, overrides || {});
}

function attempts(profile, score) {
  return [{ profileId: profile, testId: "fa-junior", state: "completed", resultCode: "FA-ABCDE", percent: score, bankVersion: "FA v6", completedAt: "2026-08-08T09:00:00.000Z" }];
}

function event(method, body, authToken) {
  return { httpMethod: method, headers: { Origin: origin, ...(authToken ? { Authorization: "Bearer " + authToken } : {}) }, body: body ? JSON.stringify(body) : undefined };
}

function createStore(settingsOverrides) {
  const account = candidate({ visibility: "private", publicConsentVersion: "" });
  const talentAccount = candidate();
  const state = {
    settings: Object.assign({ employer_workspace_enabled: "true", employer_contact_enabled: "false", profile_publication_enabled: "true" }, settingsOverrides || {}),
    account,
    talentAccount,
    session: { profileId: account.profileId, tokenHash: hashSessionToken(sessionSecret, token), expiresAt: "2026-08-09T18:00:00.000Z" },
    employer: { employerId: "emp_" + "b".repeat(24), identityProfileId: account.profileId, organizationName: "Проверенная компания", organizationDomain: "example.ru", verificationStatus: "verified", status: "active" },
    shortlists: new Map(),
    items: new Map()
  };
  return {
    state,
    async getRuntimeSettings() { return state.settings; },
    async getSessionByTokenHash(hash) { return hash === state.session.tokenHash ? state.session : null; },
    async getAccountByProfileId(id) { return id === state.account.profileId ? state.account : null; },
    async getEmployerByIdentityProfileId(id) { return id === state.account.profileId ? state.employer : null; },
    async listDiscoverableAccounts() { return [state.talentAccount]; },
    async listProfileAttempts(id) { return id === state.talentAccount.profileId ? attempts(id, 91) : []; },
    async createShortlist(row) { state.shortlists.set(row.shortlistId, { ...row, updatedAt: row.updatedAt.toISOString() }); },
    async listShortlists() { return Array.from(state.shortlists.values()); },
    async getShortlist(_employerId, shortlistId) { return state.shortlists.get(shortlistId) || null; },
    async listShortlistItems(_employerId, shortlistId) { return state.items.get(shortlistId) || []; },
    async addShortlistItem(row) { const rows = state.items.get(row.shortlistId) || []; rows.push({ ...row }); state.items.set(row.shortlistId, rows); },
    async removeShortlistItem(_employerId, shortlistId, talentProfileId) { state.items.set(shortlistId, (state.items.get(shortlistId) || []).filter(item => item.talentProfileId !== talentProfileId)); }
  };
}

(async () => {
  const search = normalizeSearch({ action: "searchTalent", apiVersion: EMPLOYER_API_VERSION, roleTemplateId: "financial-analyst", query: "", minScore: 80, region: "", workFormat: "", experienceBand: "", jobStatus: "", limit: 25 });
  const built = buildTalentCandidate(candidate(), attempts(profileId, 91), { talentSecret, roleTemplateId: search.roleTemplateId, search, now });
  assert.match(built.talentProfileId, /^talent_[a-f0-9]{32}$/);
  assert.equal(built.alias, "Кандидат К.");
  assert.equal(built.experienceLabel, "1–3 года");
  assert.equal(built.results[0].score, 91);
  assert.equal(Object.prototype.hasOwnProperty.call(built, "profileId"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(built, "emailHash"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(built.results[0], "resultCode"), false);
  assert.equal(publicTalentId(talentSecret, profileId), built.talentProfileId);
  assert.equal(buildTalentCandidate(candidate({ visibility: "private" }), attempts(profileId, 91), { talentSecret, roleTemplateId: search.roleTemplateId, search, now }), null);
  assert.equal(buildTalentCandidate(candidate({ publicConsentVersion: "old" }), attempts(profileId, 91), { talentSecret, roleTemplateId: search.roleTemplateId, search, now }), null);
  assert.equal(buildTalentCandidate(candidate({ jobStatus: "not_looking" }), attempts(profileId, 91), { talentSecret, roleTemplateId: search.roleTemplateId, search, now }), null);
  assert.equal(buildTalentCandidate(candidate(), attempts(profileId, 75), { talentSecret, roleTemplateId: search.roleTemplateId, search, now }), null);
  const student = buildTalentCandidate(candidate({ profileId: "acct_" + "c".repeat(32), experienceBand: "student" }), attempts("acct_" + "c".repeat(32), 91), { talentSecret, roleTemplateId: search.roleTemplateId, search, now });
  assert.ok(built.matchBreakdown.experience > student.matchBreakdown.experience);
  assert.deepEqual(rankTalent([student, built], search).map(item => item.alias), ["Кандидат К.", "Кандидат К."]);
  assert.throws(() => normalizeSearch({ action: "searchTalent", apiVersion: EMPLOYER_API_VERSION, roleTemplateId: "unknown", query: "", minScore: 0, region: "", workFormat: "", experienceBand: "", jobStatus: "", limit: 25 }));
  assert.throws(() => validateAction({ action: "requestContact", apiVersion: EMPLOYER_API_VERSION, talentProfileId: built.talentProfileId }));

  const store = createStore();
  const handler = createEmployerHandler({ store, sessionSecret, talentSecret, allowedOrigins: [origin], now: () => now });
  const configResponse = await handler(event("GET"));
  const config = JSON.parse(configResponse.body);
  assert.equal(configResponse.statusCode, 200);
  assert.equal(config.enabled, true);
  assert.equal(config.contactEnabled, false);
  assert.equal(config.shortlistLimit, MAX_SHORTLIST_SIZE);
  assert.ok(config.roleTemplates.length >= 6);

  const searchBody = { action: "searchTalent", apiVersion: EMPLOYER_API_VERSION, roleTemplateId: "financial-analyst", query: "", minScore: 0, region: "", workFormat: "", experienceBand: "", jobStatus: "", limit: 25 };
  assert.equal((await handler(event("POST", searchBody))).statusCode, 401);
  const unverified = createStore();
  unverified.state.employer = null;
  const unverifiedHandler = createEmployerHandler({ store: unverified, sessionSecret, talentSecret, allowedOrigins: [origin], now: () => now });
  assert.equal((await unverifiedHandler(event("POST", searchBody, token))).statusCode, 403);
  const closed = createStore({ employer_workspace_enabled: "false" });
  const closedHandler = createEmployerHandler({ store: closed, sessionSecret, talentSecret, allowedOrigins: [origin], now: () => now });
  assert.equal((await closedHandler(event("POST", searchBody, token))).statusCode, 403);

  const foundResponse = await handler(event("POST", searchBody, token));
  assert.equal(foundResponse.statusCode, 200);
  const found = JSON.parse(foundResponse.body);
  assert.equal(found.count, 1);
  assert.equal(found.employer.organizationName, "Проверенная компания");
  assert.equal(JSON.stringify(found).includes("private-email-hash"), false);
  assert.equal(JSON.stringify(found).includes("FA-ABCDE"), false);
  assert.equal(JSON.stringify(found).includes(profileId), false);

  const createdResponse = await handler(event("POST", { action: "createShortlist", apiVersion: EMPLOYER_API_VERSION, name: "Финансовые аналитики", roleTemplateId: "financial-analyst" }, token));
  assert.equal(createdResponse.statusCode, 200);
  const created = JSON.parse(createdResponse.body).shortlist;
  assert.match(created.shortlistId, /^short_[a-f0-9]{24}$/);
  const talentProfileId = found.entries[0].talentProfileId;
  const added = await handler(event("POST", { action: "addToShortlist", apiVersion: EMPLOYER_API_VERSION, shortlistId: created.shortlistId, talentProfileId }, token));
  assert.equal(added.statusCode, 200);
  assert.equal(JSON.parse(added.body).itemCount, 1);
  const duplicate = await handler(event("POST", { action: "addToShortlist", apiVersion: EMPLOYER_API_VERSION, shortlistId: created.shortlistId, talentProfileId }, token));
  assert.equal(JSON.parse(duplicate.body).state, "already_added");
  const shortlistResponse = await handler(event("POST", { action: "getShortlist", apiVersion: EMPLOYER_API_VERSION, shortlistId: created.shortlistId }, token));
  const shortlist = JSON.parse(shortlistResponse.body);
  assert.equal(shortlist.entries.length, 1);
  assert.equal(shortlist.unavailableCount, 0);
  const removed = await handler(event("POST", { action: "removeFromShortlist", apiVersion: EMPLOYER_API_VERSION, shortlistId: created.shortlistId, talentProfileId }, token));
  assert.equal(JSON.parse(removed.body).itemCount, 0);

  const root = path.resolve(__dirname, "..");
  const schema = fs.readFileSync(path.join(root, "cloud", "schema", "012_employer_workspace.sql"), "utf8");
  assert.match(schema, /employer_accounts/);
  assert.match(schema, /employer_shortlists/);
  assert.match(schema, /employer_shortlist_items/);
  assert.match(schema, /Utf8\('employer_workspace_enabled'\), Utf8\('false'\)/);
  assert.match(schema, /Utf8\('employer_contact_enabled'\), Utf8\('false'\)/);
  console.log("Employer foundation checks passed: verified access, consent-gated talent search, explainable ordering, shortlist cap contract and no contact disclosure.");
})().catch(error => { console.error(error); process.exit(1); });
