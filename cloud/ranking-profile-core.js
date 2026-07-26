"use strict";

const crypto = require("node:crypto");
const {
  MAX_RESULT_AGE_DAYS,
  RANKING_CONSENT_VERSION,
  TECHNICAL_RESULT_CODES,
  isSupportedTest,
  normalizeAlias
} = require("./ranking-core");

const PROFILE_API_VERSION = "ranking-profile-v1";
const RANKING_PROOF_API_VERSION = "ranking-proof-v1";
const RANKING_PROOF_VERSION = "ranking-result-v1";
const RANKING_PROOF_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_REQUEST_BODY_CHARS = 16000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, name) {
  if (!isPlainObject(value)) throw new Error("invalid_" + name);
  const actual = Object.keys(value).sort().join(",");
  if (actual !== expected.slice().sort().join(",")) throw new Error("invalid_" + name);
}

function parseEventBody(event) {
  let body = event && event.body;
  if (event && event.isBase64Encoded === true && typeof body === "string") {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  if (isPlainObject(body)) return body;
  if (typeof body !== "string" || body.length < 2 || body.length > MAX_REQUEST_BODY_CHARS) {
    throw new Error("invalid_body");
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (_error) {
    throw new Error("invalid_body");
  }
  if (!isPlainObject(parsed)) throw new Error("invalid_body");
  return parsed;
}

function validatePublishRequest(value) {
  assertExactKeys(value, [
    "action", "apiVersion", "publicAlias", "publicConsent",
    "publicConsentVersion", "resultProof"
  ], "publish_request");
  if (value.action !== "publish" || value.apiVersion !== PROFILE_API_VERSION || value.publicConsent !== true ||
      value.publicConsentVersion !== RANKING_CONSENT_VERSION) {
    throw new Error("invalid_publish_request");
  }
  const publicAlias = normalizeAlias(value.publicAlias);
  if (!publicAlias) throw new Error("invalid_alias");
  const proof = value.resultProof;
  assertExactKeys(proof, ["attemptId", "attemptToken", "resultCode"], "result_proof");
  const attemptId = String(proof.attemptId || "");
  const attemptToken = String(proof.attemptToken || "");
  const resultCode = String(proof.resultCode || "").toUpperCase();
  if (!/^att_[a-f0-9]{32,64}$/.test(attemptId) || attemptToken.length < 80 ||
      attemptToken.length > 3000 || attemptToken.split(".").length !== 3 ||
      !/^(FA|CA|FPA|ACC|BI)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(resultCode)) {
    throw new Error("invalid_result_proof");
  }
  return { publicAlias, attemptId, attemptToken, resultCode };
}

function validateWithdrawRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "managementToken", "publicProfileId", "testId"], "withdraw_request");
  const testId = String(value.testId || "");
  const publicProfileId = String(value.publicProfileId || "");
  const managementToken = String(value.managementToken || "");
  if (value.action !== "withdraw" || value.apiVersion !== PROFILE_API_VERSION || !isSupportedTest(testId) ||
      !/^profile_[a-f0-9]{32}$/.test(publicProfileId) || !/^scm_[A-Za-z0-9_-]{43}$/.test(managementToken)) {
    throw new Error("invalid_withdraw_request");
  }
  return { testId, publicProfileId, managementToken };
}

function validateAuthorityProof(value, expected, now) {
  if (!isPlainObject(value) || value.ok !== true || value.apiVersion !== RANKING_PROOF_API_VERSION ||
      value.proofVersion !== RANKING_PROOF_VERSION || value.passStatus !== "passed" ||
      value.scoreVerification !== "server-verified" || value.technical !== false) {
    throw new Error("result_proof_rejected");
  }
  const testId = String(value.testId || "");
  const bankVersion = String(value.bankVersion || "").trim();
  const resultCode = String(value.resultCode || "").toUpperCase();
  const subjectHandle = String(value.rankingSubjectHandle || "");
  const percent = Number(value.percent);
  const completedAtMs = Date.parse(String(value.completedAt || ""));
  const nowMs = (now instanceof Date ? now : new Date()).getTime();
  if (!isSupportedTest(testId) || !bankVersion || bankVersion.length > 100 || resultCode !== expected.resultCode ||
      TECHNICAL_RESULT_CODES.has(resultCode) || !/^rsh_[a-f0-9]{64}$/.test(subjectHandle) ||
      !Number.isFinite(percent) || percent < 80 || percent > 100 || !Number.isFinite(completedAtMs) ||
      completedAtMs > nowMs + 5 * 60 * 1000 || nowMs - completedAtMs > RANKING_PROOF_MAX_AGE_MS) {
    throw new Error("result_proof_rejected");
  }
  return {
    testId,
    bankVersion,
    resultCode,
    rankingSubjectHandle: subjectHandle,
    percent: Math.round(percent * 10) / 10,
    completedAt: new Date(completedAtMs)
  };
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function createManagementToken() {
  return "scm_" + crypto.randomBytes(32).toString("base64url");
}

function hashManagementToken(token) {
  return sha256Hex("ranking-management-v1|" + String(token || ""));
}

function buildManagedProfile(authorityProof, publishRequest, options) {
  const settings = options || {};
  const now = settings.now instanceof Date ? settings.now : new Date();
  const managementToken = settings.managementToken || createManagementToken();
  const publicProfileId = "profile_" + sha256Hex(
    "ranking-profile-v1|" + authorityProof.testId + "|" + authorityProof.rankingSubjectHandle
  ).slice(0, 32);
  const expiresAt = new Date(now.getTime() + MAX_RESULT_AGE_DAYS * 24 * 60 * 60 * 1000);
  return {
    managementToken,
    profile: {
      testId: authorityProof.testId,
      publicProfileId,
      resultCode: authorityProof.resultCode,
      publicAlias: publishRequest.publicAlias,
      publicOptIn: true,
      publicConsentActive: true,
      publicConsentVersion: RANKING_CONSENT_VERSION,
      bankVersion: authorityProof.bankVersion,
      status: "passed",
      scoreVerification: "server-verified",
      percent: authorityProof.percent,
      completedAt: authorityProof.completedAt,
      technical: false,
      managementTokenHash: hashManagementToken(managementToken),
      consentedAt: now,
      expiresAt,
      updatedAt: now
    }
  };
}

module.exports = {
  MAX_REQUEST_BODY_CHARS,
  PROFILE_API_VERSION,
  RANKING_PROOF_API_VERSION,
  RANKING_PROOF_MAX_AGE_MS,
  RANKING_PROOF_VERSION,
  assertExactKeys,
  buildManagedProfile,
  createManagementToken,
  hashManagementToken,
  isPlainObject,
  parseEventBody,
  validateAuthorityProof,
  validatePublishRequest,
  validateWithdrawRequest
};
