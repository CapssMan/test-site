"use strict";

const crypto = require("crypto");

const ACCOUNT_API_VERSION = "candidate-account-v1";
const ACCOUNT_CONSENT_VERSION = "skillcheck-account-2026-08-16-v3";
const LEGACY_ACCOUNT_CONSENT_VERSION = "skillcheck-account-2026-08-09-v2";
const PUBLIC_PROFILE_CONSENT_VERSION = "skillcheck-profile-discovery-2026-08-08-v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ACCOUNT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_BODY_CHARS = 12000;
const VISIBILITIES = new Set(["private", "discoverable"]);
const JOB_STATUSES = new Set(["hidden", "active", "open", "not_looking"]);
const WORK_FORMATS = new Set(["", "office", "hybrid", "remote"]);
const EXPERIENCE_BANDS = new Set(["", "student", "under_1", "1_3", "3_plus"]);

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(label + "_invalid");
  const expected = new Set(allowed);
  if (Object.keys(value).some(key => !expected.has(key))) throw new Error(label + "_invalid");
}

function parseBody(event) {
  let raw = event && event.body;
  if (event && event.isBase64Encoded) raw = Buffer.from(String(raw || ""), "base64").toString("utf8");
  if (typeof raw !== "string" || raw.length < 2 || raw.length > MAX_BODY_CHARS) throw new Error("invalid_request");
  const parsed = JSON.parse(raw);
  if (!isPlainObject(parsed)) throw new Error("invalid_request");
  return parsed;
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", String(secret)).update(String(value), "utf8").digest("hex");
}

function randomToken() {
  return "sca_" + crypto.randomBytes(32).toString("base64url");
}

function randomProfileId(secret, providerSubject) {
  return "acct_" + hmacHex(secret, "account-profile-v1|yandex|" + providerSubject).slice(0, 32);
}

function hashSessionToken(secret, token) {
  return hmacHex(secret, "account-session-v1|" + String(token || ""));
}

function hashProviderSubject(secret, subject) {
  return hmacHex(secret, "account-provider-v1|yandex|" + String(subject || ""));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashAccountEmail(secret, email) {
  return hmacHex(secret, "account-email-v1|" + normalizeEmail(email));
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return email.slice(0, 1) + "***@" + email.slice(at + 1);
}

function extractBearerToken(event) {
  const headers = event && event.headers || {};
  const value = String(headers.Authorization || headers.authorization || "");
  const match = /^Bearer (sca_[A-Za-z0-9_-]{43})$/.exec(value);
  return match ? match[1] : "";
}

function safeText(value, max, pattern) {

  const text = String(value || "").trim();
  if (text.length > max || (text && pattern && !pattern.test(text))) throw new Error("invalid_profile");
  return text;
}

function safeMultilineText(value, max) {
  const text = String(value || "").trim().replace(/\r\n?/g, "\n");
  if (text.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new Error("invalid_profile");
  }
  return text;
}

function validateExchange(value) {
  assertExactKeys(value, ["action", "apiVersion", "code", "codeVerifier", "state", "accountConsent"], "exchange");
  const code = String(value.code || "");
  const codeVerifier = String(value.codeVerifier || "");
  const state = String(value.state || "");
  if (value.action !== "exchangeYandexCode" || value.apiVersion !== ACCOUNT_API_VERSION || value.accountConsent !== ACCOUNT_CONSENT_VERSION ||
      code.length < 8 || code.length > 2048 || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw new Error("invalid_exchange");
  return { code, codeVerifier, state };
}

function validateSimpleAction(value, action) {
  assertExactKeys(value, ["action", "apiVersion"], action);
  if (value.action !== action || value.apiVersion !== ACCOUNT_API_VERSION) throw new Error("invalid_request");
}

function validateUpdate(value) {
  assertExactKeys(value, ["action", "apiVersion", "publicAlias", "visibility", "jobStatus", "region", "workFormat", "experienceBand", "currentRole", "targetRole", "experienceSummary", "professionalTools", "confirmAvailability", "accountConsent", "publicConsent"], "update");
  if (value.action !== "updateProfile" || value.apiVersion !== ACCOUNT_API_VERSION ||
      !VISIBILITIES.has(value.visibility) || !JOB_STATUSES.has(value.jobStatus) ||
      !WORK_FORMATS.has(value.workFormat) || !EXPERIENCE_BANDS.has(value.experienceBand)) throw new Error("invalid_profile");
  const hasCareerFields = ["currentRole", "targetRole", "experienceSummary", "professionalTools", "confirmAvailability", "accountConsent"]
    .some(key => Object.prototype.hasOwnProperty.call(value, key));
  const accountConsent = String(value.accountConsent || "");
  if (hasCareerFields && accountConsent !== ACCOUNT_CONSENT_VERSION) throw new Error("account_consent_required");
  const currentRole = value.currentRole === undefined ? undefined : safeText(value.currentRole, 100, /^[^<>\u0000-\u001f]+$/);
  const targetRole = value.targetRole === undefined ? undefined : safeText(value.targetRole, 100, /^[^<>\u0000-\u001f]+$/);
  const experienceSummary = value.experienceSummary === undefined ? undefined : safeMultilineText(value.experienceSummary, 1000);
  const professionalTools = value.professionalTools === undefined ? undefined : safeText(value.professionalTools, 300, /^[^<>\u0000-\u001f]+$/);
  if (accountConsent && accountConsent !== ACCOUNT_CONSENT_VERSION && accountConsent !== LEGACY_ACCOUNT_CONSENT_VERSION) throw new Error("invalid_account_consent");
  if (value.confirmAvailability !== undefined && typeof value.confirmAvailability !== "boolean") throw new Error("invalid_profile");
  const publicAlias = safeText(value.publicAlias, 40, /^[^<>\u0000-\u001f]+$/);
  const region = safeText(value.region, 80, /^[^<>\u0000-\u001f]+$/);
  if (value.visibility !== "private" && !publicAlias) throw new Error("public_alias_required");
  if (value.visibility === "discoverable" && value.publicConsent !== PUBLIC_PROFILE_CONSENT_VERSION) throw new Error("public_consent_required");
  if (value.visibility !== "discoverable" && value.publicConsent !== "") throw new Error("invalid_public_consent");
  return { publicAlias, visibility: value.visibility, jobStatus: value.jobStatus, region, workFormat: value.workFormat,
    experienceBand: value.experienceBand, currentRole, targetRole, experienceSummary, professionalTools,
    confirmAvailability: value.confirmAvailability === true, accountConsent, publicConsent: value.publicConsent };
}

function validateDelete(value) {
  assertExactKeys(value, ["action", "apiVersion", "confirmation"], "delete");
  if (value.action !== "deleteAccount" || value.apiVersion !== ACCOUNT_API_VERSION || value.confirmation !== "УДАЛИТЬ") {
    throw new Error("invalid_delete_confirmation");
  }
}

module.exports = {
  ACCOUNT_API_VERSION,
  ACCOUNT_CONSENT_VERSION,
  LEGACY_ACCOUNT_CONSENT_VERSION,
  PUBLIC_PROFILE_CONSENT_VERSION,
  SESSION_TTL_MS,
  ACCOUNT_RETENTION_MS,
  MAX_BODY_CHARS,
  parseBody,
  hmacHex,
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
};
