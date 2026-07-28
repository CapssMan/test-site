"use strict";

const { createAssessmentHandler, jsonResponse: assessmentJsonResponse, storageErrorResponse } = require("./assessment-handler");
const { createObjectStorageClient } = require("./object-storage-client");
const { createRankingHandler, jsonResponse } = require("./ranking-handler");
const { createRankingProfileHandler, privateJsonResponse } = require("./ranking-profile-handler");
const { createYdbAssessmentStore } = require("./ydb-assessment-store");
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

  const sql = query(driver);
  const allowedOrigin = String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
  const runtimeMode = String(process.env.RUNTIME_MODE || "read");
  if (runtimeMode === "read") return createRankingHandler({ store: createYdbRankingStore(sql), allowedOrigin });
  if (runtimeMode === "write") {
    return createRankingProfileHandler({
      store: createYdbRankingStore(sql),
      allowedOrigin,
      authorityUrl: String(process.env.RESULT_AUTHORITY_URL || "")
    });
  }
  if (runtimeMode === "assessment") {
    const privateStorage = createObjectStorageClient({ bucket: String(process.env.PRIVATE_BUCKET || "") });
    return createAssessmentHandler({
      store: createYdbAssessmentStore(sql),
      bankStorage: privateStorage,
      reportStorage: privateStorage,
      allowedOrigin,
      signingSecret: String(process.env.ATTEMPT_SIGNING_SECRET_V1 || ""),
      identitySecret: String(process.env.IDENTITY_HASH_SECRET_V1 || ""),
      inviteSecret: String(process.env.INVITE_CODE_SECRET_V1 || "")
    });
  }
  throw new Error("invalid_runtime_mode");
}

async function handler(event, context) {
  try {
    if (!runtimePromise) runtimePromise = createRuntime();
    const runtimeHandler = await runtimePromise;
    return await runtimeHandler(event, context);
  } catch (_error) {
    runtimePromise = null;
    const allowedOrigin = String(process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
    const runtimeMode = String(process.env.RUNTIME_MODE || "read");
    if (runtimeMode === "write") {
      return privateJsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
    }
    if (runtimeMode === "assessment") {
      return assessmentJsonResponse(503, storageErrorResponse(), allowedOrigin);
    }
    return jsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
  }
}

module.exports = { createRuntime, handler };
