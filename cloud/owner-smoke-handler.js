"use strict";

const crypto = require("node:crypto");
const {
  ASSESSMENT_API_VERSION,
  ASSESSMENT_BACKEND_VERSION,
  INVITE_AND_SESSION_RETENTION_MS,
  PRIVACY_CONSENT_VERSION,
  TESTS,
  buildDeterministicInviteCode,
  hashIdentity,
  hashInviteCode,
  hmacHex,
  validatePrivateBank
} = require("./assessment-core");
const { createAssessmentHandler } = require("./assessment-handler");
const { createObjectStorageClient } = require("./object-storage-client");
const { createYdbAdminStore } = require("./ydb-admin-store");
const { createYdbAssessmentStore } = require("./ydb-assessment-store");

const OWNER_SMOKE_ACTION = "run-owner-smoke-v1";
const OWNER_SMOKE_PURPOSE = "SkillCheck IAM-only owner smoke";
const TEST_ID = "fa-junior";
const OWNER_SMOKE_PHASES = new Set([
  "verify_gates_before",
  "insert_invite",
  "begin_attempt",
  "load_bank",
  "save_result",
  "verify_result",
  "verify_gates_after_result",
  "cleanup"
]);
const OWNER_SMOKE_FAILURE_CODES = new Set([
  "attempt_unavailable",
  "temporary_storage_error",
  "invalid_request",
  "client_upgrade_required",
  "privacy_consent_required",
  "invalid_begin_request_id",
  "invalid_fingerprint",
  "invalid_email",
  "unsupported_test",
  "invalid_field",
  "unsupported_action",
  "submission_conflict",
  "attempt_token_invalid"
]);
const OWNER_SMOKE_OPERATIONS = new Set([
  "store.getRuntimeSettings",
  "store.getInviteByCodeHash",
  "store.getInviteById",
  "store.getSessionByInviteId",
  "store.getSessionByAttemptId",
  "store.listRecentSessions",
  "store.getBankMetadata",
  "store.insertSession",
  "store.markInviteActive",
  "store.appendAudit",
  "store.reserveSession",
  "store.getResultByCode",
  "store.getResultByRequestId",
  "store.insertResult",
  "store.completeSession",
  "store.completeInvite",
  "bankStorage.readJson",
  "reportStorage.readText",
  "reportStorage.writeText"
]);
const OWNER_SMOKE_FAILURE_KINDS = new Set(["timeout", "type_error", "conflict", "authorization", "transient", "schema", "unknown"]);
let runtimePromise;

function plusMs(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function parseHttpResponse(response) {
  if (!response || response.statusCode !== 200) throw new Error("owner_smoke_http_failed");
  const value = JSON.parse(String(response.body || "{}"));
  if (!value || value.ok !== true) {
    const failure = new Error("owner_smoke_application_failed");
    failure.smokeFailureCode = OWNER_SMOKE_FAILURE_CODES.has(value && value.failureCode) ? value.failureCode : "unknown";
    throw failure;
  }
  return value;
}

function classifyDependencyError(error) {
  const text = String(error && (error.name || "") ) + " " + String(error && (error.message || ""));
  if (/timeout|deadline|cancel/i.test(text)) return "timeout";
  if (/type|cast|jsondocument|expected|mismatch/i.test(text)) return "type_error";
  if (/already|precondition|constraint|duplicate|conflict/i.test(text)) return "conflict";
  if (/unauthor|permission|access denied|forbidden/i.test(text)) return "authorization";
  if (/unavailable|overload|transport|connection|network/i.test(text)) return "transient";
  if (/scheme|column|table|index/i.test(text)) return "schema";
  return "unknown";
}

function createTracedDependency(target, trace, prefix) {
  return new Proxy(target, {
    get(source, property) {
      const value = source[property];
      if (typeof value !== "function") return value;
      return async function tracedOperation(...args) {
        try {
          return await value.apply(source, args);
        } catch (error) {
          if (!trace.failedOperation) {
            trace.failedOperation = prefix + "." + String(property);
            trace.failureKind = classifyDependencyError(error);
          }
          throw error;
        }
      };
    }
  });
}

function createSmokeStore(store) {
  return new Proxy(store, {
    get(target, property) {
      if (property === "getRuntimeSettings") {
        return async function smokeRuntimeSettings() {
          const actual = await target.getRuntimeSettings();
          return Object.assign({}, actual, { legal_pilot_approved: "true", attempt_issuance_enabled: "true" });
        };
      }
      if (property === "insertResult") {
        return async function insertTechnicalResult(row) {
          return target.insertResult(Object.assign({}, row, { technical: true }));
        };
      }
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function assertGatesClosed(settings) {
  if (!settings || settings.legal_pilot_approved !== "false" || settings.attempt_issuance_enabled !== "false" ||
      settings.retention_automation_enabled !== "true") throw new Error("owner_smoke_gates_not_closed");
}

function createOwnerSmokeRunner(dependencies) {
  const settings = dependencies || {};
  const store = settings.store;
  const adminStore = settings.adminStore;
  const storage = settings.storage;
  const signingSecret = String(settings.signingSecret || "");
  const identitySecret = String(settings.identitySecret || "");
  const inviteSecret = String(settings.inviteSecret || "");
  const nowProvider = typeof settings.now === "function" ? settings.now : () => new Date();
  if (!store || !adminStore || !storage || [signingSecret, identitySecret, inviteSecret].some(value => value.length < 32)) {
    throw new Error("owner_smoke_dependencies_missing");
  }

  return async function runOwnerSmoke(context) {
    let phase = "verify_gates_before";
    const actualBefore = await store.getRuntimeSettings();
    assertGatesClosed(actualBefore);
    const now = nowProvider();
    const nonce = randomHex(32);
    const email = "owner-smoke-" + nonce.slice(0, 12) + "@example.invalid";
    const requestId = "smk_" + nonce;
    const inviteId = "inv_" + hmacHex(inviteSecret, "invite-id-v1|" + requestId).slice(0, 32);
    const identityHash = hashIdentity(identitySecret, TEST_ID, email);
    const inviteCode = buildDeterministicInviteCode(inviteSecret, inviteId, TEST_ID, identityHash);
    const fingerprint = nonce.slice(0, 8);
    let resultCode = "";
    let reportObjectKey = "";
    let primaryError = null;
    let primaryPhase = "";
    let primaryFailureCode = "";
    let primaryOperation = "";
    let primaryFailureKind = "";
    const smokeTrace = { failedOperation: "", failureKind: "" };
    let outcome = null;

    try {
      phase = "insert_invite";
      await store.upsertInvite({
        inviteId,
        requestId,
        testId: TEST_ID,
        codeHash: hashInviteCode(inviteSecret, inviteCode),
        identityHash,
        emailMasked: "o***@example.invalid",
        purpose: OWNER_SMOKE_PURPOSE,
        allowRetake: true,
        validForHours: 1,
        state: "issued",
        issuedAt: now,
        expiresAt: plusMs(now, 60 * 60 * 1000),
        purgeAt: plusMs(now, INVITE_AND_SESSION_RETENTION_MS)
      });

      const smokeStore = createSmokeStore(createTracedDependency(store, smokeTrace, "store"));
      const assessment = createAssessmentHandler({
        store: smokeStore,
        bankStorage: createTracedDependency(storage, smokeTrace, "bankStorage"),
        reportStorage: createTracedDependency(storage, smokeTrace, "reportStorage"),
        signingSecret,
        identitySecret,
        inviteSecret,
        allowedOrigin: "https://capssman.github.io",
        now: nowProvider
      });
      phase = "begin_attempt";
      const begin = parseHttpResponse(await assessment({
        httpMethod: "POST",
        body: JSON.stringify({
          action: "beginAttempt",
          apiVersion: ASSESSMENT_API_VERSION,
          beginRequestId: "scb_" + randomHex(24),
          testId: TEST_ID,
          inviteCode,
          email,
          browserFingerprint: fingerprint,
          clientBuild: "owner-smoke-iam-v1",
          privacyConsent: true,
          privacyConsentVersion: PRIVACY_CONSENT_VERSION,
          ageConfirmed: true
        })
      }, context));

      phase = "load_bank";
      const metadata = await store.getBankMetadata(TEST_ID, TESTS[TEST_ID].bankVersion);
      const rawBank = metadata && await storage.readJson(metadata.objectKey, context);
      const validated = rawBank && validatePrivateBank(rawBank, metadata.privateDigest);
      if (!validated || validated.publicDigest !== metadata.publicDigest) throw new Error("owner_smoke_bank_invalid");
      const questions = new Map(validated.bank.questions.map(question => [String(question.id), question]));
      const answers = begin.questionIds.map(questionId => {
        const question = questions.get(String(questionId));
        if (!question) throw new Error("owner_smoke_question_missing");
        return { questionId: String(questionId), optionId: String(question.correctOptionId), timedOut: false, timeSpent: 1 };
      });

      phase = "save_result";
      const saved = parseHttpResponse(await assessment({
        httpMethod: "POST",
        body: JSON.stringify({
          action: "saveResult",
          apiVersion: ASSESSMENT_API_VERSION,
          requestId: "scs_" + randomHex(24),
          attemptId: begin.attemptId,
          attemptToken: begin.attemptToken,
          testId: TEST_ID,
          bankVersion: TESTS[TEST_ID].bankVersion,
          name: "Owner Smoke",
          email,
          telegram: "",
          englishLevel: "B2",
          candidateSource: "HH.ru",
          candidateExperience: "\u0421\u0442\u0430\u0436\u0438\u0440\u043e\u0432\u043a\u0430",
          employerShareConsent: false,
          browserFingerprint: fingerprint,
          tabSwitches: 0,
          clientBuild: "owner-smoke-iam-v1",
          answers,
          privacyConsentVersion: PRIVACY_CONSENT_VERSION,
          ageConfirmed: true
        })
      }, context));

      phase = "verify_result";
      resultCode = String(saved.resultCode || "");
      const stored = await store.getResultByCode(resultCode);
      reportObjectKey = stored && String(stored.reportObjectKey || "");
      const report = reportObjectKey && await storage.readText(reportObjectKey, context);
      if (!stored || stored.technical !== true || stored.scoreVerification !== "server-verified" || Number(stored.percent) !== 100 ||
          saved.reportCreated !== true || !report || !report.includes(resultCode)) throw new Error("owner_smoke_verification_failed");
      phase = "verify_gates_after_result";
      assertGatesClosed(await store.getRuntimeSettings());
      outcome = {
        ok: true,
        backendVersion: ASSESSMENT_BACKEND_VERSION,
        testId: TEST_ID,
        bankVersion: TESTS[TEST_ID].bankVersion,
        percent: 100,
        scoreVerification: "server-verified",
        technical: true,
        reportVerified: true
      };
    } catch (error) {
      primaryError = error;
      primaryPhase = phase;
      primaryFailureCode = error && error.smokeFailureCode || "";
      primaryOperation = smokeTrace.failedOperation;
      primaryFailureKind = smokeTrace.failureKind;
    }

    try {
      phase = "cleanup";
      const session = await store.getSessionByInviteId(inviteId);
      if (!resultCode && session) resultCode = String(session.resultCode || "");
      if (!reportObjectKey && resultCode) reportObjectKey = "reports/" + resultCode + ".txt";
      if (reportObjectKey) await storage.deleteObject(reportObjectKey, context);
      await adminStore.deleteAssessmentData({
        code: resultCode,
        scope: "full_attempt",
        session: { inviteId },
        invite: { inviteId }
      });
      if (await store.getInviteById(inviteId) || await store.getSessionByInviteId(inviteId) ||
          (resultCode && await store.getResultByCode(resultCode)) || (reportObjectKey && await storage.readText(reportObjectKey, context) !== null)) {
        throw new Error("owner_smoke_cleanup_failed");
      }
      assertGatesClosed(await store.getRuntimeSettings());
    } catch (cleanupError) {
      if (!primaryError) {
        primaryError = cleanupError;
        primaryPhase = phase;
        primaryFailureCode = cleanupError && cleanupError.smokeFailureCode || "";
        primaryOperation = smokeTrace.failedOperation;
        primaryFailureKind = smokeTrace.failureKind;
      primaryFailureKind = smokeTrace.failureKind;
      }
    }

    if (primaryError) {
      const failure = new Error("owner_smoke_failed");
      failure.smokePhase = primaryPhase;
      failure.smokeFailureCode = primaryFailureCode;
      failure.smokeOperation = primaryOperation;
      failure.smokeFailureKind = primaryFailureKind;
      throw failure;
    }
    return Object.assign({}, outcome, { cleaned: true, sharedGatesClosed: true });
  };
}

async function createRuntime() {
  const connectionString = String(process.env.YDB_CONNECTION_STRING || "").trim();
  const bucket = String(process.env.PRIVATE_BUCKET || "").trim();
  if (!/^grpcs:\/\//.test(connectionString) || !bucket) throw new Error("owner_smoke_runtime_config_missing");
  const [{ Driver }, { query }, { MetadataCredentialsProvider }] = await Promise.all([
    import("@ydbjs/core"),
    import("@ydbjs/query"),
    import("@ydbjs/auth/metadata")
  ]);
  const driver = new Driver(connectionString, { credentialsProvider: new MetadataCredentialsProvider() });
  await driver.ready();
  const sql = query(driver);
  const store = createYdbAssessmentStore(sql);
  return createOwnerSmokeRunner({
    store,
    adminStore: createYdbAdminStore(sql),
    storage: createObjectStorageClient({ bucket }),
    signingSecret: String(process.env.ATTEMPT_SIGNING_SECRET_V1 || ""),
    identitySecret: String(process.env.IDENTITY_HASH_SECRET_V1 || ""),
    inviteSecret: String(process.env.INVITE_CODE_SECRET_V1 || "")
  });
}

async function handler(event, context) {
  try {
    if (!event || Object.keys(event).sort().join(",") !== "action" || event.action !== OWNER_SMOKE_ACTION) {
      return { ok: false, status: "invalid_request" };
    }
    if (!runtimePromise) runtimePromise = createRuntime();
    return await (await runtimePromise)(context);
  } catch (error) {
    runtimePromise = null;
    const phase = OWNER_SMOKE_PHASES.has(error && error.smokePhase) ? error.smokePhase : "runtime_setup";
    const failureCode = OWNER_SMOKE_FAILURE_CODES.has(error && error.smokeFailureCode) ? error.smokeFailureCode : "unknown";
    const operation = OWNER_SMOKE_OPERATIONS.has(error && error.smokeOperation) ? error.smokeOperation : "unknown";
    const failureKind = OWNER_SMOKE_FAILURE_KINDS.has(error && error.smokeFailureKind) ? error.smokeFailureKind : "unknown";
    return { ok: false, status: "owner_smoke_failed", phase, failureCode, operation, failureKind };
  }
}

module.exports = { OWNER_SMOKE_ACTION, OWNER_SMOKE_PURPOSE, assertGatesClosed, createOwnerSmokeRunner, createSmokeStore, handler, parseHttpResponse };
