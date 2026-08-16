"use strict";

const crypto = require("node:crypto");

const CREDENTIAL_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const CREDENTIAL_TYPES = Object.freeze({
  education: "Образование",
  employment: "Опыт работы",
  project: "Проект",
  certificate: "Сертификат",
  olympiad: "Олимпиада / конкурс",
  award: "Награда"
});
const CREDENTIAL_VISIBILITIES = new Set(["private", "employer"]);
const CREDENTIAL_STATUSES = new Set(["self_reported", "pending", "verified", "rejected"]);

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(label + "_invalid");
  const expected = new Set(allowed);
  if (Object.keys(value).some(key => !expected.has(key))) throw new Error(label + "_invalid");
}

function safeText(value, max, required) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if ((required && text.length < 2) || text.length > max || /[<>\u0000-\u001f\u007f]/.test(text)) throw new Error("invalid_credential");
  return text;
}

function safeMultiline(value, max) {
  const text = String(value || "").trim().replace(/\r\n?/g, "\n");
  if (text.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error("invalid_credential");
  return text;
}

function safeEvidenceUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length > 500) throw new Error("invalid_credential");
  let parsed;
  try { parsed = new URL(text); } catch (_error) { throw new Error("invalid_credential"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("invalid_credential");
  return text;
}

function createCredentialId() {
  return "cred_" + crypto.randomBytes(12).toString("hex");
}

function validateCredentialId(value) {
  const id = String(value || "");
  if (!/^cred_[a-f0-9]{24}$/.test(id)) throw new Error("invalid_credential");
  return id;
}

function validateCandidateCredentialAction(value, apiVersion, consentVersion, currentYear) {
  const common = ["action", "apiVersion"];
  if (!isPlainObject(value) || value.apiVersion !== apiVersion) throw new Error("invalid_request");
  if (value.action === "listCredentials") {
    assertAllowedKeys(value, common, "credential_list");
    return { type: "listCredentials" };
  }
  if (value.action === "deleteCredential") {
    assertAllowedKeys(value, common.concat(["credentialId"]), "credential_delete");
    return { type: "deleteCredential", credentialId: validateCredentialId(value.credentialId) };
  }
  if (value.action !== "upsertCredential") throw new Error("invalid_request");
  assertAllowedKeys(value, common.concat(["credentialId", "credentialType", "title", "issuer", "description", "issuedYear", "evidenceUrl", "visibility", "accountConsent"]), "credential_upsert");
  if (value.accountConsent !== consentVersion || !Object.prototype.hasOwnProperty.call(CREDENTIAL_TYPES, value.credentialType) || !CREDENTIAL_VISIBILITIES.has(value.visibility)) {
    throw new Error("invalid_credential");
  }
  const year = String(value.issuedYear || "").trim();
  const maxYear = Number.isInteger(currentYear) ? currentYear + 1 : new Date().getUTCFullYear() + 1;
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1950 || Number(year) > maxYear)) throw new Error("invalid_credential");
  return {
    type: "upsertCredential",
    credentialId: value.credentialId ? validateCredentialId(value.credentialId) : "",
    credentialType: value.credentialType,
    title: safeText(value.title, 140, true),
    issuer: safeText(value.issuer, 140, false),
    description: safeMultiline(value.description, 800),
    issuedYear: year,
    evidenceUrl: safeEvidenceUrl(value.evidenceUrl),
    visibility: value.visibility
  };
}

function publicCandidateCredential(row) {
  return {
    credentialId: String(row.credentialId || ""),
    credentialType: String(row.credentialType || ""),
    credentialTypeLabel: CREDENTIAL_TYPES[row.credentialType] || "Достижение",
    title: String(row.title || ""),
    issuer: String(row.issuer || ""),
    description: String(row.description || ""),
    issuedYear: String(row.issuedYear || ""),
    evidenceUrl: String(row.evidenceUrl || ""),
    visibility: String(row.visibility || "private"),
    verificationStatus: CREDENTIAL_STATUSES.has(row.verificationStatus) ? row.verificationStatus : "self_reported",
    verificationNote: String(row.verificationNote || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || "")
  };
}

function publicEmployerCredentials(rows) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && row.visibility === "employer" && row.verificationStatus === "verified").map(row => ({
    credentialType: String(row.credentialType || ""),
    credentialTypeLabel: CREDENTIAL_TYPES[row.credentialType] || "Достижение",
    title: String(row.title || ""),
    issuer: String(row.issuer || ""),
    description: String(row.description || ""),
    issuedYear: String(row.issuedYear || ""),
    verificationStatus: "verified"
  })).slice(0, 12);
}

function createOrganizationId(secret, domain) {
  const normalized = String(domain || "").trim().toLowerCase();
  if (String(secret || "").length < 32 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(normalized)) throw new Error("organization_identity_invalid");
  return "org_" + crypto.createHmac("sha256", String(secret)).update("employer-organization-v1|" + normalized).digest("hex").slice(0, 24);
}

function publicOrganization(row) {
  if (!row || row.status !== "active" || row.verificationStatus !== "verified") return null;
  return {
    organizationId: String(row.organizationId || ""),
    displayName: String(row.displayName || ""),
    legalName: String(row.legalName || ""),
    domain: String(row.domain || ""),
    websiteUrl: String(row.websiteUrl || ""),
    description: String(row.description || ""),
    verificationStatus: "verified"
  };
}

module.exports = {
  CREDENTIAL_RETENTION_MS,
  CREDENTIAL_STATUSES,
  CREDENTIAL_TYPES,
  createCredentialId,
  createOrganizationId,
  publicCandidateCredential,
  publicEmployerCredentials,
  publicOrganization,
  validateCandidateCredentialAction,
  validateCredentialId
};
