"use strict";

const { createRankingHandler, jsonResponse } = require("./ranking-handler");
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

  return createRankingHandler({
    store: createYdbRankingStore(query(driver)),
    allowedOrigin: String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
  });
}

async function handler(event) {
  try {
    if (!runtimePromise) runtimePromise = createRuntime();
    const rankingHandler = await runtimePromise;
    return await rankingHandler(event);
  } catch (_error) {
    runtimePromise = null;
    return jsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN));
  }
}

module.exports = { createRuntime, handler };
