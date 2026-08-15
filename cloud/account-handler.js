"use strict";

const { resolveAllowedOrigin } = require("./cors-origin");
const {
  ACCOUNT_API_VERSION,
  ACCOUNT_CONSENT_VERSION,
  PUBLIC_PROFILE_CONSENT_VERSION,
  SESSION_TTL_MS,
  ACCOUNT_RETENTION_MS,
  parseBody,
  randomToken,
  randomProfileId,
  hashSessionToken,
  hashProviderSubject,
  hashAccountEmail,
  normalizeEmail,
  maskEmail,
  extractBearerToken,
  validateExchange,
  validateSimpleAction,
  validateUpdate,
  validateDelete
} = require("./account-core");

function getMethod(event) {
  return String(event && (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method)) || "GET").toUpperCase();
}

function jsonResponse(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type,Authorization,Cache-Control,Pragma",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "X-Content-Type-Options": "nosniff"
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload)
  };
}

function validDate(value) {
  const result = value instanceof Date ? value : new Date(value || "");
  return Number.isFinite(result.getTime()) ? result : null;
}

function plusMs(now, milliseconds) {
  return new Date(now.getTime() + milliseconds);
}

const SELF_SERVICE_TEST_IDS = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior"];
const ACCOUNT_BACKEND_VERSION = "yandex-account-recovery-2026-08-15-1";
const RETAKE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
const ACTIVE_ATTEMPT_TTL_MS = 6 * 60 * 60 * 1000;

function buildTestAccess(attempts, now, enabled) {
  const currentTime = validDate(now) || new Date();
  const rows = Array.isArray(attempts) ? attempts.slice() : [];
  return SELF_SERVICE_TEST_IDS.map(testId => {
    if (!enabled) return { testId, status: "closed", availableAt: "", lastResultCode: "", lastPercent: 0 };
    const matching = rows.filter(item => item && item.testId === testId).sort((left, right) => {
      return Date.parse(String(right.completedAt || right.startedAt || "")) - Date.parse(String(left.completedAt || left.startedAt || ""));
    });
    const active = matching.find(item => item.state === "active" && validDate(item.startedAt));
    if (active) {
      const activeUntil = plusMs(validDate(active.startedAt), ACTIVE_ATTEMPT_TTL_MS);
      if (currentTime < activeUntil) {
        return { testId, status: "in_progress", availableAt: activeUntil.toISOString(), lastResultCode: "", lastPercent: 0 };
      }
    }
    const completed = matching.find(item => item.state === "completed" && validDate(item.completedAt));
    if (completed) {
      const nextEligibleAt = plusMs(validDate(completed.completedAt), RETAKE_WINDOW_MS);
      return {
        testId,
        status: currentTime >= nextEligibleAt ? "available" : "cooldown",
        availableAt: nextEligibleAt.toISOString(),
        lastResultCode: String(completed.resultCode || ""),
        lastPercent: Number(completed.percent || 0)
      };
    }
    return { testId, status: "available", availableAt: "", lastResultCode: "", lastPercent: 0 };
  });
}

function publicProfile(account, attempts) {
  return {
    profileId: account.profileId,
    emailMasked: account.emailMasked,
    publicAlias: account.publicAlias,
    visibility: account.visibility,
    jobStatus: account.jobStatus,
    region: account.region,
    workFormat: account.workFormat,
    experienceBand: account.experienceBand,
    accountConsentVersion: account.accountConsentVersion,
    publicConsentVersion: account.publicConsentVersion,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    results: (attempts || []).filter(item => item.state === "completed").map(item => ({
      testId: item.testId,
      resultCode: item.resultCode,
      percent: item.percent,
      bankVersion: item.bankVersion,
      completedAt: item.completedAt
    }))
  };
}

function createAccountHandler(dependencies) {
  const options = dependencies || {};
  const store = options.store;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const clientId = String(options.clientId || "");
  const redirectUri = String(options.redirectUri || "");
  const identitySecret = String(options.identitySecret || "");
  const sessionSecret = String(options.sessionSecret || "");
  const allowedOrigins = options.allowedOrigins || options.allowedOrigin;
  const nowProvider = typeof options.now === "function" ? options.now : () => new Date();
  if (!store || typeof store.getRuntimeSettings !== "function" || typeof fetchImpl !== "function") throw new Error("account_dependencies_required");
  if (identitySecret.length < 32 || sessionSecret.length < 32) throw new Error("account_secret_required");

  async function providerRequest(url, requestOptions, errorCode) {
    try {
      return await fetchImpl(url, requestOptions);
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function providerJson(reply, errorCode) {
    try {
      return await reply.json();
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function storageRequest(operation, errorCode) {
    try {
      return await operation();
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function authenticate(event) {
    const token = extractBearerToken(event);
    if (!token) return null;
    const tokenHash = hashSessionToken(sessionSecret, token);
    const session = await store.getSessionByTokenHash(tokenHash);
    const now = nowProvider();
    const expiry = validDate(session && session.expiresAt);
    if (!session || !expiry || now >= expiry) return null;
    const account = await store.getAccountByProfileId(session.profileId);
    return account && account.status === "active" ? { account, session, tokenHash } : null;
  }

  function buildConfig(settings) {
    const configured = /^[A-Za-z0-9]{20,80}$/.test(clientId) && /^https:\/\//.test(redirectUri);
    return {
      backendVersion: ACCOUNT_BACKEND_VERSION,
      ok: true,
      apiVersion: ACCOUNT_API_VERSION,
      provider: "yandex",
      enabled: configured && settings.account_registration_enabled === "true",
      clientId: configured ? clientId : "",
      redirectUri: configured ? redirectUri : "",
      scope: "login:email",
      accountConsentVersion: ACCOUNT_CONSENT_VERSION,
      publicProfileConsentVersion: PUBLIC_PROFILE_CONSENT_VERSION,
      publicProfileEnabled: settings.profile_publication_enabled === "true",
      selfServiceEnabled: settings.account_self_service_enabled === "true",
      accountRequiredForAttempts: settings.account_required_for_attempts === "true"
    };
  }

  async function exchange(body, settings) {
    const request = validateExchange(body);
    if (settings.account_registration_enabled !== "true") {
      return { statusCode: 403, payload: { ok: false, error: "account_registration_closed" } };
    }
    const tokenReply = await providerRequest("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: request.code,
        client_id: clientId,
        code_verifier: request.codeVerifier,
        redirect_uri: redirectUri
      }).toString()
    }, "identity_token_unavailable");
    if (!tokenReply.ok) return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    const tokenData = await providerJson(tokenReply, "identity_token_invalid_response");
    const accessToken = String(tokenData && tokenData.access_token || "");
    if (accessToken.length < 20 || accessToken.length > 4096) throw new Error("identity_token_invalid_response");
    const infoReply = await providerRequest("https://login.yandex.ru/info?format=json", {
      method: "GET",
      headers: { Authorization: "OAuth " + accessToken, Accept: "application/json" }
    }, "identity_profile_unavailable");
    if (!infoReply.ok) return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    const info = await providerJson(infoReply, "identity_profile_invalid_response");
    const subject = String(info && info.id || "");
    const providerClient = String(info && info.client_id || "");
    const email = normalizeEmail(info && info.default_email);
    if (!/^\d{3,30}$/.test(subject) || providerClient !== clientId || !/^[^@\s]{1,64}@[^@\s]{1,190}$/.test(email)) {
      return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    }
    const now = nowProvider();
    const subjectHash = hashProviderSubject(identitySecret, subject);
    const emailHash = hashAccountEmail(identitySecret, email);
    let account = await storageRequest(() => store.getAccountByProviderSubject("yandex", subjectHash), "account_lookup_unavailable");
    const emailAccount = await storageRequest(() => store.getAccountByEmailHash(emailHash), "account_lookup_unavailable");
    if (emailAccount && (!account || emailAccount.profileId !== account.profileId)) {
      return { statusCode: 409, payload: { ok: false, error: "account_conflict" } };
    }
    if (!account) {
      account = {
        profileId: randomProfileId(identitySecret, subject), status: "active", provider: "yandex",
        providerSubjectHash: subjectHash, emailHash, emailMasked: maskEmail(email), publicAlias: "",
        visibility: "private", jobStatus: "hidden", region: "", workFormat: "", experienceBand: "",
        accountConsentVersion: ACCOUNT_CONSENT_VERSION, accountConsentedAt: now,
        publicConsentVersion: "", publicConsentedAt: new Date(0), createdAt: now, lastLoginAt: now,
        updatedAt: now, purgeAt: plusMs(now, ACCOUNT_RETENTION_MS)
      };
    } else {
      account = { ...account, emailHash, emailMasked: maskEmail(email), accountConsentVersion: ACCOUNT_CONSENT_VERSION, accountConsentedAt: now, lastLoginAt: now, updatedAt: now, purgeAt: plusMs(now, ACCOUNT_RETENTION_MS) };
    }
    await storageRequest(() => store.upsertAccount(account), "account_write_unavailable");
    const token = randomToken();
    const expiresAt = plusMs(now, SESSION_TTL_MS);
    const attempts = await storageRequest(() => store.listProfileAttempts(account.profileId), "account_attempts_unavailable");
    await storageRequest(() => store.insertSession({ profileId: account.profileId, tokenHash: hashSessionToken(sessionSecret, token), issuedAt: now, expiresAt, lastSeenAt: now, purgeAt: expiresAt }), "account_session_unavailable");
    return {
      statusCode: 200,
      payload: {
        ok: true, apiVersion: ACCOUNT_API_VERSION, sessionToken: token, expiresAt: expiresAt.toISOString(), email,
        profile: publicProfile(account, attempts),
        selfServiceEnabled: settings.account_self_service_enabled === "true",
        testAccess: buildTestAccess(attempts, now, settings.account_self_service_enabled === "true")
      }
    };
  }

  return async function accountHandler(event) {
    let origin;
    try {
      origin = resolveAllowedOrigin(event, allowedOrigins);
    } catch (_error) {
      return jsonResponse(403, { ok: false, error: "origin_not_allowed" }, Array.isArray(allowedOrigins) ? allowedOrigins[0] : allowedOrigins);
    }
    const verb = getMethod(event);
    if (verb === "OPTIONS") return jsonResponse(204, {}, origin);
    try {
      const settings = await store.getRuntimeSettings();
      if (verb === "GET") return jsonResponse(200, buildConfig(settings), origin);
      if (verb !== "POST") return jsonResponse(405, { ok: false, error: "method_not_allowed" }, origin);
      const body = parseBody(event);
      if (body.action === "exchangeYandexCode") {
        const result = await exchange(body, settings);
        return jsonResponse(result.statusCode, result.payload, origin);
      }
      const auth = await authenticate(event);
      if (!auth) return jsonResponse(401, { ok: false, error: "authentication_required" }, origin);
      if (body.action === "getProfile") {
        validateSimpleAction(body, "getProfile");
        const attempts = await store.listProfileAttempts(auth.account.profileId);
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, profile: publicProfile(auth.account, attempts),
          publicProfileEnabled: settings.profile_publication_enabled === "true",
          selfServiceEnabled: settings.account_self_service_enabled === "true",
          testAccess: buildTestAccess(attempts, nowProvider(), settings.account_self_service_enabled === "true") }, origin);
      }
      if (body.action === "updateProfile") {
        const update = validateUpdate(body);
        if (update.visibility === "discoverable" && settings.profile_publication_enabled !== "true") {
          return jsonResponse(403, { ok: false, error: "profile_publication_closed" }, origin);
        }
        const now = nowProvider();
        await store.updateProfile(auth.account.profileId, { ...update, publicConsentVersion: update.publicConsent, publicConsentedAt: update.visibility === "discoverable" ? now : new Date(0), updatedAt: now, purgeAt: plusMs(now, ACCOUNT_RETENTION_MS) });
        const account = await store.getAccountByProfileId(auth.account.profileId);
        const attempts = await store.listProfileAttempts(account.profileId);
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, profile: publicProfile(account, attempts),
          selfServiceEnabled: settings.account_self_service_enabled === "true",
          testAccess: buildTestAccess(attempts, now, settings.account_self_service_enabled === "true") }, origin);
      }
      if (body.action === "logout") {
        validateSimpleAction(body, "logout");
        await store.deleteSession(auth.account.profileId, auth.tokenHash);
        return jsonResponse(200, { ok: true }, origin);
      }
      if (body.action === "deleteAccount") {
        validateDelete(body);
        await store.deleteAccount(auth.account.profileId);
        return jsonResponse(200, { ok: true, deleted: true }, origin);
      }
      return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
    } catch (error) {
      const clientErrors = new Set(["invalid_request", "exchange_invalid", "invalid_exchange", "getProfile_invalid", "update_invalid", "invalid_profile", "public_alias_required", "public_consent_required", "invalid_public_consent", "delete_invalid", "invalid_delete_confirmation"]);
      const serviceErrors = new Set(["identity_token_unavailable", "identity_token_invalid_response", "identity_profile_unavailable", "identity_profile_invalid_response", "account_lookup_unavailable", "account_write_unavailable", "account_attempts_unavailable", "account_session_unavailable"]);
      const errorCode = String(error && error.message || "");
      if (error instanceof SyntaxError || clientErrors.has(errorCode)) {
        return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
      }
      if (serviceErrors.has(errorCode)) return jsonResponse(503, { ok: false, error: errorCode }, origin);
      return jsonResponse(503, { ok: false, error: "account_temporarily_unavailable" }, origin);
    }
  };
}

module.exports = { createAccountHandler, jsonResponse, publicProfile, buildTestAccess };
