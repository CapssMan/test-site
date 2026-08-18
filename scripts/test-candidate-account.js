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
const { createAccountHandler, buildTestAccess } = require("../cloud/account-handler");

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
    async getRuntimeSettings() { return { account_registration_enabled: enabled ? "true" : "false", profile_publication_enabled: "false", account_self_service_enabled: enabled ? "true" : "false", account_required_for_attempts: enabled ? "true" : "false" }; },
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
  assert.equal(closedConfig.backendVersion, "yandex-candidate-trust-chat-2026-08-17-1");
  assert.equal(closedConfig.scope, "login:email");
  assert.equal(closedConfig.selfServiceEnabled, false);
  assert.equal(closedConfig.accountRequiredForAttempts, false);
  const closedExchange = await closed(event("POST", { action: "exchangeYandexCode", apiVersion: ACCOUNT_API_VERSION, code: "valid-code", codeVerifier: "a".repeat(43), state: "b".repeat(43), accountConsent: ACCOUNT_CONSENT_VERSION }));
  assert.equal(closedExchange.statusCode, 403);

  const diagnosticPayload = { action: "exchangeYandexCode", apiVersion: ACCOUNT_API_VERSION, code: "valid-code", codeVerifier: "a".repeat(43), state: "b".repeat(43), accountConsent: ACCOUNT_CONSENT_VERSION };
  const tokenFailure = createAccountHandler({ store: createStore(true), fetchImpl: async () => { throw new Error("provider_down"); }, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const tokenFailureResponse = await tokenFailure(event("POST", diagnosticPayload));
  assert.equal(tokenFailureResponse.statusCode, 503);
  assert.equal(JSON.parse(tokenFailureResponse.body).error, "identity_token_unavailable");

  const profileFailure = createAccountHandler({ store: createStore(true), fetchImpl: async url => {
    if (url === "https://oauth.yandex.ru/token") return { ok: true, async json() { return { access_token: "fake-account-token-12345" }; } };
    throw new Error("provider_profile_down");
  }, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const profileFailureResponse = await profileFailure(event("POST", diagnosticPayload));
  assert.equal(profileFailureResponse.statusCode, 503);
  assert.equal(JSON.parse(profileFailureResponse.body).error, "identity_profile_unavailable");

  const writeFailureStore = createStore(true);
  writeFailureStore.upsertAccount = async () => { throw new Error("ydb_write_failed"); };
  const writeFailure = createAccountHandler({ store: writeFailureStore, fetchImpl: fakeFetch, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const writeFailureResponse = await writeFailure(event("POST", diagnosticPayload));
  assert.equal(writeFailureResponse.statusCode, 503);
  assert.equal(JSON.parse(writeFailureResponse.body).error, "account_write_unavailable");

  const store = createStore(true);
  const handler = createAccountHandler({ store, fetchImpl: fakeFetch, clientId, redirectUri, identitySecret, sessionSecret, allowedOrigins: [origin], now: () => now });
  const exchangeResponse = await handler(event("POST", { action: "exchangeYandexCode", apiVersion: ACCOUNT_API_VERSION, code: "valid-code", codeVerifier: "a".repeat(43), state: "b".repeat(43), accountConsent: ACCOUNT_CONSENT_VERSION }));
  assert.equal(exchangeResponse.statusCode, 200);
  const exchange = JSON.parse(exchangeResponse.body);
  assert.equal(exchange.selfServiceEnabled, true);
  assert.equal(exchange.testAccess.length, 9);
  assert.ok(exchange.testAccess.every(item => item.status === "available"));
  assert.match(exchange.sessionToken, /^sca_[A-Za-z0-9_-]{43}$/);
  assert.equal(exchange.email, "candidate@yandex.ru");
  assert.equal(exchange.profile.visibility, "private");
  assert.equal(exchange.profile.accountConsentVersion, ACCOUNT_CONSENT_VERSION);
  assert.equal(exchange.profile.currentRole, "");
  assert.equal(exchange.profile.targetRole, "");
  assert.equal(exchange.profile.experienceSummary, "");
  assert.equal(exchange.profile.professionalTools, "");
  assert.equal(exchange.profile.availabilityConfirmedAt, new Date(0).toISOString());
  const account = [...store.state.accounts.values()][0];
  assert.equal(account.emailHash, hashAccountEmail(identitySecret, "candidate@yandex.ru"));
  assert.equal(account.providerSubjectHash, hashProviderSubject(identitySecret, "2411360937"));
  assert.equal(JSON.stringify(account).includes("candidate@yandex.ru"), false);
  assert.ok(store.state.sessions.has(hashSessionToken(sessionSecret, exchange.sessionToken)));

  const profileResponse = await handler(event("POST", { action: "getProfile", apiVersion: ACCOUNT_API_VERSION }, exchange.sessionToken));
  const profile = JSON.parse(profileResponse.body);
  assert.equal(profile.selfServiceEnabled, true);
  assert.equal(profile.testAccess.find(item => item.testId === "fa-junior").status, "available");
  store.state.attempts.set("attempt-1", { profileId: account.profileId, testId: "fa-junior", attemptId: "att_" + "e".repeat(32), state: "completed", resultCode: "FA-ABCDE", percent: 88, bankVersion: "FA Junior v6.0", startedAt: new Date(now.getTime() - 3600000).toISOString(), completedAt: now.toISOString() });
  const cooledProfile = JSON.parse((await handler(event("POST", { action: "getProfile", apiVersion: ACCOUNT_API_VERSION }, exchange.sessionToken))).body);
  const cooledAccess = cooledProfile.testAccess.find(item => item.testId === "fa-junior");
  assert.equal(cooledAccess.status, "cooldown");
  assert.equal(cooledAccess.availableAt, new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString());
  assert.equal(buildTestAccess([], now, false).every(item => item.status === "closed"), true);
  assert.equal(buildTestAccess([{ testId: "fa-junior", state: "completed", completedAt: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString() }], now, true).find(item => item.testId === "fa-junior").status, "available");
  assert.equal(buildTestAccess([{ testId: "fa-junior", state: "active", startedAt: now.toISOString() }], now, true).find(item => item.testId === "fa-junior").status, "in_progress");
  assert.equal(buildTestAccess([{ testId: "fa-junior", state: "completed", completedAt: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString() }], now, false).find(item => item.testId === "fa-junior").status, "closed");
  assert.equal(profileResponse.statusCode, 200);
  const careerUpdate = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION,
    publicAlias: "Кандидат", visibility: "private", jobStatus: "open", region: "Москва", workFormat: "hybrid",
    experienceBand: "under_1", currentRole: "Стажёр FDD", targetRole: "Финансовый аналитик",
    experienceSummary: "Учебная финансовая модель и практика анализа отчётности.",
    professionalTools: "Excel, Power BI, SQL", confirmAvailability: true,
    accountConsent: ACCOUNT_CONSENT_VERSION, publicConsent: "" }, exchange.sessionToken));
  assert.equal(careerUpdate.statusCode, 200);
  const careerProfile = JSON.parse(careerUpdate.body).profile;
  assert.equal(careerProfile.currentRole, "Стажёр FDD");
  assert.equal(careerProfile.targetRole, "Финансовый аналитик");
  assert.equal(careerProfile.professionalTools, "Excel, Power BI, SQL");
  assert.equal(careerProfile.availabilityConfirmedAt, now.toISOString());
  assert.equal(careerProfile.accountConsentVersion, ACCOUNT_CONSENT_VERSION);
  const discoverable = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "Кандидат", visibility: "discoverable", jobStatus: "active", region: "Москва", workFormat: "hybrid", experienceBand: "student", publicConsent: PUBLIC_PROFILE_CONSENT_VERSION }, exchange.sessionToken));
  assert.equal(discoverable.statusCode, 403);
  const privateUpdate = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "", visibility: "private", jobStatus: "hidden", region: "", workFormat: "", experienceBand: "", publicConsent: "" }, exchange.sessionToken));
  assert.equal(privateUpdate.statusCode, 200);
  assert.throws(() => validateUpdate({ action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "x", visibility: "discoverable", jobStatus: "active", region: "", workFormat: "", experienceBand: "", publicConsent: "" }));
  const missingCareerConsent = await handler(event("POST", { action: "updateProfile", apiVersion: ACCOUNT_API_VERSION,
    publicAlias: "", visibility: "private", jobStatus: "open", region: "", workFormat: "", experienceBand: "",
    currentRole: "Аналитик", targetRole: "", experienceSummary: "", professionalTools: "",
    confirmAvailability: false, accountConsent: "", publicConsent: "" }, exchange.sessionToken));
  assert.equal(missingCareerConsent.statusCode, 400);

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
  assert.match(accountPage, /async function fetchAccountConfig\(\)/);
  assert.match(accountPage, /attempt<3/);
  assert.match(accountPage, /accountServiceUnavailable/);
  assert.match(accountPage, /Повторить проверку/);
  assert.match(accountPage, /UNIFIED_PREVIEW_ORIGIN="https:\/\/[^"\s]+\.apigw\.yandexcloud\.net"/);
  assert.match(accountPage, /UNIFIED_PREVIEW_PREFIX="\/preview-unified"/);
  assert.match(accountPage, /IS_UNIFIED_PREVIEW/);
  assert.match(accountPage, /CALLBACK_STATE\.startsWith\("u_"\)/);
  assert.match(accountPage, /UNIFIED_PREVIEW_ORIGIN\+UNIFIED_PREVIEW_PREFIX\+"\/account\.html"/);
  assert.match(accountPage, /IS_UNIFIED_PREVIEW\?"\/v1\/account"/);
  assert.match(accountPage, /state=\(IS_UNIFIED_PREVIEW\?"u_":"s_"\)\+randomBase64Url\(32\)/);
  assert.match(accountPage, /window\.location\.origin!==PRIMARY_SITE_ORIGIN/);
  assert.match(accountPage, /LOCAL_PREVIEW_HOSTS\.has\(window\.location\.hostname\)/);
  assert.match(accountPage, /window\.location\.replace\(PRIMARY_SITE_ORIGIN\+"\/account\.html"/);
  assert.match(accountPage, /if\(!SHOULD_FORWARD_UNIFIED_CALLBACK&&!SHOULD_USE_PRIMARY_ORIGIN\)boot\(\)/);
  assert.match(accountPage, /ACC-OFFLINE/);
  assert.match(accountPage, /ACC-HTTP-/);
  assert.match(accountPage, /ACC-NET/);
  assert.match(accountPage, /ACC-STORAGE/);
  assert.match(accountPage, /ACC-OAUTH-TOKEN/);
  assert.match(accountPage, /ACC-OAUTH-PROFILE/);
  assert.match(accountPage, /ACC-YDB-WRITE/);
  assert.match(accountPage, /accountErrorMessage/);
  assert.match(indexPage, /href="account\.html">Личный кабинет<\/a>/);
  assert.doesNotMatch(accountPage, /value="link"/);
  assert.doesNotMatch(accountPage, /localStorage|client_secret|login:phone|login:birthday|login:avatar/);
  assert.match(consent, new RegExp(ACCOUNT_CONSENT_VERSION));
  const selfServiceSchema = fs.readFileSync(path.join(root, "cloud", "schema", "014_candidate_self_service.sql"), "utf8");
  assert.match(schema, /candidate_accounts/);
  assert.match(schema, /candidate_account_sessions/);
  assert.match(schema, /candidate_attempt_links/);
  assert.match(schema, /Utf8\('account_registration_enabled'\), Utf8\('false'\)/);
  assert.match(schema, /Utf8\('profile_publication_enabled'\), Utf8\('false'\)/);
  assert.match(accountPage, /safeReturnTarget/);
  assert.match(accountPage, /id="testAccessList"/);
  assert.match(accountPage, /test\.html\?test=/);
  assert.match(assessment, /listRecentProfileAttempts\(accountContext\.profileId, request\.testId/);
  assert.match(assessment, /linkedAttempt\.profileId !== accountContext\.profileId/);
  assert.match(gateway, /\/v1\/account:/);
  assert.match(gateway, /Authorization/);
  assert.match(selfServiceSchema, /candidate_self_service_slots/);
  assert.match(selfServiceSchema, /account_self_service_enabled/);
  assert.match(selfServiceSchema, /account_required_for_attempts/);
  assert.match(testPage, /requestOptions\.headers\.Authorization = "Bearer " \+ accountSession\.sessionToken/);
  assert.doesNotMatch(testPage, /localStorage\.setItem\([^\n]*account/i);

  console.log("Candidate account checks passed: Yandex PKCE, self-service test access, short session, gated visibility and profile-bound retake.");
})().catch(error => { console.error(error); process.exit(1); });
