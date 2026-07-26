"use strict";

const { buildRankingResponse, isSupportedTest, normalizeLimit } = require("./ranking-core");

function jsonResponse(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": statusCode === 200 ? "public, max-age=60" : "no-store",
      "Access-Control-Allow-Origin": origin,
      "X-Content-Type-Options": "nosniff"
    },
    body: JSON.stringify(payload)
  };
}

function getMethod(event) {
  return String(event && (
    event.httpMethod ||
    (event.requestContext && event.requestContext.http && event.requestContext.http.method)
  ) || "GET").toUpperCase();
}

function createRankingHandler(dependencies) {
  const settings = dependencies || {};
  const store = settings.store;
  const allowedOrigin = String(settings.allowedOrigin || "https://skillcheck.example");
  const now = typeof settings.now === "function" ? settings.now : () => new Date();
  if (!store || typeof store.getActiveBankVersion !== "function" || typeof store.listRankingCandidates !== "function") {
    throw new Error("ranking_store_required");
  }

  return async function rankingHandler(event) {
    if (getMethod(event) !== "GET") {
      return jsonResponse(405, { ok: false, error: "method_not_allowed" }, allowedOrigin);
    }

    const query = event && event.queryStringParameters || {};
    const testId = String(query.testId || "");
    if (!isSupportedTest(testId)) {
      return jsonResponse(400, { ok: false, error: "unsupported_test" }, allowedOrigin);
    }

    try {
      const bankVersion = await store.getActiveBankVersion(testId);
      const records = await store.listRankingCandidates({ testId, bankVersion });
      const payload = buildRankingResponse(records, {
        testId,
        bankVersion,
        limit: normalizeLimit(query.limit),
        now: now()
      });
      return jsonResponse(200, payload, allowedOrigin);
    } catch (_error) {
      return jsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
    }
  };
}

module.exports = { createRankingHandler, getMethod, jsonResponse };