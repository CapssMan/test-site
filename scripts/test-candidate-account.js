"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ACCOUNT_API_VERSION,
  ACCOUNT_CONSENT_VERSION,
  PUBLIC_PROFILE_CONSENT_VERSION,
  hashAccountEmail,
  hashProviderSubject,
  hashSessionToken,
  validateUpdate
} = require("../cloud/account-core");
const { createAccountHandler } = require("../cloud/account-handler");

const root = path.resolve(__dirname, "..");
const origin = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
const now = new Date("2026-08-08T12:00:00.000Z");
const identitySecret = "identity-secret-for-account-tests-123456789";
const sessionSecret = "session-secret-for-account-tests-1234567890";
const clientId = "1234567890abcdefghij1234567890ab";
const redirectUri = origin + "/account.html";

function createStore(enabled) {
  const state = { accounts: new Map(), sessions: new Map(), attempts: new Map() };
  return {
    state,
    async getRuntimeSettings() { return { account_registration_enabled: enabled ? "true" : "false", profile_publication_enabled: "false" }; },
    async getAccountByProviderSubject(provider, subjectHash) { return [...state.accounts.values()].find(row => row.provider === provider && row.providerSubjectHash === subjectHash) || null; },
    async getAccountByEmailHash(emailHash) { return [...state.accounts.values()].find(row => row.emailHash === emailHash) || null; },
    async getAccountByProfileId(profileId) { return state.accounts.get(profileId) || null; },
    async upsertAccount(row) { state.accounts.set(row.profileId, { ...row, accountConsentedAt: row.accountConsentedAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }); },
    async insertSession(row) { state.sessions.set(row.tokenHash, { ...row, expiresAt: row.expiresAt.toISOString() }); },
    async getSessionByTokenHash(tokenHash) { return state.sessions.get(tokenHash) || null; },
    async deleteSession(_profileId, tokenHash) { state.sessions.delete(tokenHash); },
    async updateProfile(profileId, changes) { const current = state.accounts.get(profileId); state.accounts.set(profileId, { ...current, ...changes }); },
    async listProfileAttempts(profileId) { return [...state.attempts.values()].filter(row => row.profileId === profileId); },
    async deleteAccount(profileId) { state.accounts.delete(profileId); for (const [key, value] of state.sessions) if (value.profileId === profileId) state.sessions.delete(key); }
  };
}

function event(method, body, token) {
  return {
    httpMethod: method,
    headers: { Origin: origin, ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  };
}

function fakeFetch(url, options) {
  if (url === "https://oauth.yandex.ru/token") {
    assert.match(String(options.body), /code_verifier=/);
    assert.doesNotMatch(String(options.body), /client_secret/);
    return Promise.resolve({ ok: true, async json() { return { access_token: "fake-account-token-12345" }; } });
  }
  assert.equal(url, "https://login.yandex.ru/info?format=json");
  assert.equal(options.headers.Authorization, "OAuth fake-account-token-12345");
  return Promise.resolve({ ok: true, async json() { return { id: "2411360937", client_id: clientId, default_email: "candidate@yandex.ru" }; } });
}

(async () => {
  const closedStore = createStore(false);
  const closed = createAccountHandler({ store: closedStore, fetchImpl: fakeFetch, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const closedConfig = JSON.parse((await closed(event("GET"))).body);
  assert.equal(closedConfig.enabled, false);
  assert.equal(closedConfig.scope, "login:email");
  const closedExchange = await closed(event("POST", { action: "exchangeYandexCode", apiVersion: ACCOUNT_API_VERSION, code: "valid-code", codeVerifier: "a".repeat(43), state: "b".repeat(43), accountConsent: ACCOUNT_CONSENT_VERSION }));
  assert.equal(closedExchange.statusCode, 403);

  const store = createStore(true);
  const handler = createAccountHandler({ store, fetchImpl: fakeFetch, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const exchangeResponse = await handler(event("POST", { action: "exchangeYandexCode", apiVersion: ACCOUNT_API_VERSION, code: "valid-code", codeVerifier: "a".repeat(43), state: "b".repeat(43), accountConsent: ACCOUNT_CONSENT_VERSION }));
  assert.equal(exchangeResponse.statusCode, 200);
  const exchange = JSON.parse(exchangeResponse.body);
  assert.match(exchange.sessionToken, /^sca_[A-Za-z0-9_-]{43}$/);
  assert.equal(exchange.email, "candidate@yandex.ru");
  assert.equal(exchange.profile.visibility, "private");
  assert.equal(exchange.profile.accountConsentVersion, ACCOUNT_CONSENT_VERSION);
  const account = [...store.state.accounts.values()][0];
  assert.equal(account.emailHash, hashAccountEmail(identitySecret, "candidate@yandex.ru"));
  assert.equal(account.providerSubjectHash, hashProviderSubject(identitySecret, "2411360937"));
  assert.equal(JSON.stringify(account).includes("candidate@yandex.ru"), false);
  assert.ok(store.state.sessions.has(hashSessionToken(sessionSecret, exchange.sessionToken)));

  const profileResponse = await handler(event("POST", { action: "getProfile", apiVersion: ACCOUNT_API_VERSION }, exchange.sessionToken));
  assert.equal(profileResponse.statusCode, 200);
  const discoverable = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "Кандидат", visibility: "discoverable", jobStatus: "active", region: "Москва", workFormat: "hybrid", experienceBand: "student", publicConsent: PUBLIC_PROFILE_CONSENT_VERSION }, exchange.sessionToken));
  assert.equal(discoverable.statusCode, 403);
  const privateUpdate = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "", visibility: "private", jobStatus: "hidden", region: "", workFormat: "", experienceBand: "", publicConsent: "" }, exchange.sessionToken));
  assert.equal(privateUpdate.statusCode, 200);
  assert.throws(() => validateUpdate({ action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "x", visibility: "discoverable", jobStatus: "active", region: "", workFormat: "", experienceBand: "", publicConsent: "" }));

  const accountPage = fs.readFileSync(path.join(root, "account.html"), "utf8");
  const indexPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const consent = fs.readFileSync(path.join(root, "account-consent.html"), "utf8");
  const assessment = fs.readFileSync(path.join(root, "cloud", "assessment-handler.js"), "utf8");
  const schema = fs.readFileSync(path.join(root, "cloud", "schema", "011_candidate_accounts.sql"), "utf8");
  const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
  const testPage = fs.readFileSync(path.join(root, "test.html"), "utf8");
  assert.match(accountPage, /code_challenge_method","S256"/);
  assert.match(accountPage, /sessionStorage/);
  assert.match(accountPage, /id="accountConsent"/);
  assert.match(indexPage, /href="account\.html">Личный кабинет<\/a>/);
  assert.doesNotMatch(accountPage, /value="link"/);
  assert.doesNotMatch(accountPage, /localStorage|client_secret|login:phone|login:birthday|login:avatar/);
  assert.match(consent, new RegExp(ACCOUNT_CONSENT_VERSION));
  assert.match(schema, /candidate_accounts/);
  assert.match(schema, /candidate_account_sessions/);
  assert.match(schema, /candidate_attempt_links/);
  assert.match(schema, /Utf8\('account_registration_enabled'\), Utf8\('false'\)/);
  assert.match(schema, /Utf8\('profile_publication_enabled'\), Utf8\('false'\)/);
  assert.match(assessment, /listRecentProfileAttempts\(accountContext\.profileId, request\.testId/);
  assert.match(assessment, /linkedAttempt\.profileId !== accountContext\.profileId/);
  assert.match(gateway, /\/v1\/account:/);
  assert.match(gateway, /Authorization/);
  assert.match(testPage, /requestOptions\.headers\.Authorization = "Bearer " \+ accountSession\.sessionToken/);
  assert.doesNotMatch(testPage, /localStorage\.setItem\([^\n]*account/i);

  console.log("Candidate account checks passed: Yandex PKCE, hashed identity, short session, gated visibility and profile-bound retake.");
})().catch(error => { console.error(error); process.exit(1); });
