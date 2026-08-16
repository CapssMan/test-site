"use strict";

const { createAccountHandler } = require("./account-handler");
const { createAdminHandler } = require("./admin-handler");
const { createEmployerHandler } = require("./employer-handler");
const { createAssessmentHandler, jsonResponse: assessmentJsonResponse, storageErrorResponse } = require("./assessment-handler");
const { createObjectStorageClient } = require("./object-storage-client");
const { createRankingHandler, jsonResponse } = require("./ranking-handler");
const { createRankingProfileHandler, privateJsonResponse } = require("./ranking-profile-handler");
const { createYdbAssessmentStore } = require("./ydb-assessment-store");
const { createYdbAdminStore } = require("./ydb-admin-store");
const { createYdbAccountStore } = require("./ydb-account-store");
const { createYdbEmployerStore } = require("./ydb-employer-store");
const { createYdbInvitationStore } = require("./ydb-invitation-store");
const { createYdbTrustStore } = require("./ydb-trust-store");
const { createYdbChatStore } = require("./ydb-chat-store");
const { createYdbRankingStore } = require("./ydb-ranking-store");
const { DEFAULT_ALLOWED_ORIGINS, readAllowedOriginsFromEnvironment, resolveAllowedOrigin } = require("./cors-origin");

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
  const allowedOrigins = readAllowedOriginsFromEnvironment(process.env);
  const runtimeMode = String(process.env.RUNTIME_MODE || "read");
  if (runtimeMode === "read") return createRankingHandler({ store: createYdbRankingStore(sql), allowedOrigins });
  if (runtimeMode === "account") {
    return createAccountHandler({
      store: Object.assign(createYdbAccountStore(sql), createYdbInvitationStore(sql), createYdbTrustStore(sql), createYdbChatStore(sql)),
      allowedOrigins,
      clientId: String(process.env.YANDEX_ID_CLIENT_ID || ""),
      redirectUri: String(process.env.YANDEX_ID_REDIRECT_URI || ""),
      identitySecret: String(process.env.IDENTITY_HASH_SECRET_V1 || ""),
      sessionSecret: String(process.env.ACCOUNT_SESSION_SECRET_V1 || "")
    });
  }
  if (runtimeMode === "employer") {
    const employerStore = Object.assign(createYdbAccountStore(sql), createYdbEmployerStore(sql), createYdbInvitationStore(sql), createYdbTrustStore(sql), createYdbChatStore(sql));
    return createEmployerHandler({
      store: employerStore,
      allowedOrigins,
      sessionSecret: String(process.env.ACCOUNT_SESSION_SECRET_V1 || ""),
      talentSecret: String(process.env.IDENTITY_HASH_SECRET_V1 || "")
    });
  }
  if (runtimeMode === "write") {
    return createRankingProfileHandler({
      store: createYdbRankingStore(sql),
      allowedOrigins,
      authorityUrl: String(process.env.RESULT_AUTHORITY_URL || "")
    });
  }
  if (runtimeMode === "assessment") {
    const privateStorage = createObjectStorageClient({ bucket: String(process.env.PRIVATE_BUCKET || "") });
    const assessmentStore = Object.assign(createYdbAssessmentStore(sql), createYdbAccountStore(sql));
    return createAssessmentHandler({
      store: assessmentStore,
      bankStorage: privateStorage,
      reportStorage: privateStorage,
      allowedOrigins,
      signingSecret: String(process.env.ATTEMPT_SIGNING_SECRET_V1 || ""),
      identitySecret: String(process.env.IDENTITY_HASH_SECRET_V1 || ""),
      inviteSecret: String(process.env.INVITE_CODE_SECRET_V1 || ""),
      accountSessionSecret: String(process.env.ACCOUNT_SESSION_SECRET_V1 || "")
    });
  }
  if (runtimeMode === "admin") {
    const privateStorage = createObjectStorageClient({ bucket: String(process.env.PRIVATE_BUCKET || "") });
    const store = Object.assign(createYdbAssessmentStore(sql), createYdbAdminStore(sql), createYdbAccountStore(sql), createYdbEmployerStore(sql), createYdbTrustStore(sql));
    const propertyNames = ["YDB_CONNECTION_STRING", "PRIVATE_BUCKET", "ADMIN_PASSWORD_PBKDF2_V1", "INVITE_CODE_SECRET_V1", "IDENTITY_HASH_SECRET_V1", "DELETION_SIGNING_SECRET_V1"];
    return createAdminHandler({
      store,
      storage: privateStorage,
      allowedOrigins,
      adminPasswordRecord: String(process.env.ADMIN_PASSWORD_PBKDF2_V1 || ""),
      inviteSecret: String(process.env.INVITE_CODE_SECRET_V1 || ""),
      identitySecret: String(process.env.IDENTITY_HASH_SECRET_V1 || ""),
      deletionSecret: String(process.env.DELETION_SIGNING_SECRET_V1 || ""),
      propertyPresence: propertyNames.map(name => ({ name, present: Boolean(process.env[name]), required: true }))
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
    let allowedOrigin = DEFAULT_ALLOWED_ORIGINS[0];
    try { allowedOrigin = resolveAllowedOrigin(event, readAllowedOriginsFromEnvironment(process.env)); } catch (_corsError) {}
    const runtimeMode = String(process.env.RUNTIME_MODE || "read");
    if (runtimeMode === "write") {
      return privateJsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
    }
    if (runtimeMode === "account") {
      return assessmentJsonResponse(503, { ok: false, error: "account_temporarily_unavailable" }, allowedOrigin);
    }
    if (runtimeMode === "employer") {
      return assessmentJsonResponse(503, { ok: false, error: "employer_temporarily_unavailable" }, allowedOrigin);
    }
    if (runtimeMode === "assessment" || runtimeMode === "admin") {
      return assessmentJsonResponse(503, storageErrorResponse(), allowedOrigin);
    }
    return jsonResponse(503, { ok: false, error: "ranking_temporarily_unavailable" }, allowedOrigin);
  }
}

module.exports = { createRuntime, handler };
