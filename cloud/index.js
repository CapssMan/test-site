"use strict";

const { createRankingHandler, jsonResponse } = require("./ranking-handler");
const { createRankingProfileHandler, privateJsonResponse } = require("./ranking-profile-handler");
const { createYdbRankingStore } = require("./ydb-ranking-store");

const DEFAULT_ALLOWED_ORIGIN = "https://capssman.github.io";
let runtimePromise;

async function createRuntime() {
  const connectionString = String(process.env.YDB_CONNECTION_STRING || "").trim();
  if (!/^grpcs:\/\//.test(connectionString)) throw new Error("secure_ydb_connection_required");

  const [{ Driver }, { query }, { MetadataCredentialsProvider }] = await Promise.all([
    import("@ydbjs/core"),
    import("@ydbjs/query"),
    import("@ydbjs/auth/metadata")
  ]);
  const driver = new Driver(connectionString, {
    credentialsProvider: new MetadataCredentialsProvider()
  });
  await driver.ready();

  const store = createYdbRankingStore(query(driver));
  const allowedOrigin = String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
  const runtimeMode = String(process.env.RUNTIME_MODE || "read");
  if (runtimeMode === "read") return createRankingHandler({ store, allowedOrigin });
  if (runtimeMode === "write") {
    return createRankingProfileHandler({
      store,
      allowedOrigin,
      authorityUrl: String(process.env.RESULT_AUTHORITY_URL || "")
    });
  }
  throw new Error("invalid_runtime_mode");
}

async function handler(event) {
  try {
    if (!runtimePromise) runtimePromise = createRuntime();
    const runtimeHandler = await runtimePromise;
    return await runtimeHandler(event);
  } catch (_error) {
    runtimePromise = null;
    const allowedOrigin = String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
    return String(process.env.RUNTIME_MODE || "read") === "write"
      ? privateJsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin)
      : jsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
  }
}

module.exports = { createRuntime, handler };
