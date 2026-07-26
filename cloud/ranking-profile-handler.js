"use strict";

const {
  PROFILE_API_VERSION,
  RANKING_PROOF_API_VERSION,
  buildManagedProfile,
  hashManagementToken,
  parseEventBody,
  validateAuthorityProof,
  validatePublishRequest,
  validateWithdrawRequest
} = require("./ranking-profile-core");
const { getMethod } = require("./ranking-handler");

const AUTHORITY_TIMEOUT_MS = 7000;

function privateJsonResponse(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    },
    body: JSON.stringify(payload)
  };
}

async function fetchAuthorityProof(authorityUrl, request, fetchImpl) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(authorityUrl)) {
    throw new Error("invalid_authority_url");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTHORITY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(authorityUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rankingProof",
        apiVersion: RANKING_PROOF_API_VERSION,
        attemptId: request.attemptId,
        attemptToken: request.attemptToken,
        resultCode: request.resultCode
      }),
      redirect: "follow",
      signal: controller.signal
    });
    if (!response || response.ok !== true) throw new Error("result_proof_rejected");
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function createRankingProfileHandler(dependencies) {
  const settings = dependencies || {};
  const store = settings.store;
  const allowedOrigin = String(settings.allowedOrigin || "https://skillcheck.example");
  const authorityUrl = String(settings.authorityUrl || "");
  const fetchImpl = settings.fetchImpl || globalThis.fetch;
  const now = typeof settings.now === "function" ? settings.now : () => new Date();
  if (!store || typeof store.upsertRankingProfile !== "function" || typeof store.withdrawRankingProfile !== "function") {
    throw new Error("ranking_write_store_required");
  }
  if (typeof fetchImpl !== "function") throw new Error("fetch_required");

  return async function rankingProfileHandler(event) {
    if (getMethod(event) !== "POST") {
      return privateJsonResponse(405, { ok: false, error: "method_not_allowed" }, allowedOrigin);
    }
    let body;
    try {
      body = parseEventBody(event);
    } catch (_error) {
      return privateJsonResponse(400, { ok: false, error: "invalid_request" }, allowedOrigin);
    }

    if (body.action === "publish") {
      try {
        const request = validatePublishRequest(body);
        const authorityResponse = await fetchAuthorityProof(authorityUrl, request, fetchImpl);
        const proof = validateAuthorityProof(authorityResponse, request, now());
        const managed = buildManagedProfile(proof, request, { now: now() });
        await store.upsertRankingProfile(managed.profile);
        return privateJsonResponse(200, {
          ok: true,
          apiVersion: PROFILE_API_VERSION,
          state: "published",
          testId: managed.profile.testId,
          publicProfileId: managed.profile.publicProfileId,
          publicAlias: managed.profile.publicAlias,
          expiresAt: managed.profile.expiresAt.toISOString(),
          managementToken: managed.managementToken
        }, allowedOrigin);
      } catch (error) {
        const message = String(error && error.message || "");
        const validationError = /^invalid_/.test(message);
        const rejected = message === "result_proof_rejected";
        return privateJsonResponse(validationError ? 400 : (rejected ? 403 : 503), {
          ok: false,
          error: validationError ? "invalid_request" : (rejected ? "result_proof_rejected" : "ranking_temporarily_unavailable")
        }, allowedOrigin);
      }
    }

    if (body.action === "withdraw") {
      try {
        const request = validateWithdrawRequest(body);
        await store.withdrawRankingProfile({
          testId: request.testId,
          publicProfileId: request.publicProfileId,
          managementTokenHash: hashManagementToken(request.managementToken)
        });
        return privateJsonResponse(200, {
          ok: true,
          apiVersion: PROFILE_API_VERSION,
          state: "withdrawn"
        }, allowedOrigin);
      } catch (error) {
        const message = String(error && error.message || "");
        return privateJsonResponse(/^invalid_/.test(message) ? 400 : 503, {
          ok: false,
          error: /^invalid_/.test(message) ? "invalid_request" : "ranking_temporarily_unavailable"
        }, allowedOrigin);
      }
    }

    return privateJsonResponse(400, { ok: false, error: "invalid_request" }, allowedOrigin);
  };
}

module.exports = { AUTHORITY_TIMEOUT_MS, createRankingProfileHandler, fetchAuthorityProof, privateJsonResponse };
