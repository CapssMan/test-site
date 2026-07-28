"use strict";

const {
  ASSESSMENT_API_VERSION,
  ASSESSMENT_BACKEND_VERSION,
  AUDIT_RETENTION_MS,
  INVITE_AND_SESSION_RETENTION_MS,
  PRIVACY_CONSENT_VERSION,
  TESTS,
  assertExactKeys,
  buildDeterministicInviteCode,
  hashIdentity,
  hashInviteCode,
  hmacHex,
  maskEmail,
  parseBody,
  publicError,
  sha256Hex,
  timingSafeEqual
} = require("./assessment-core");
const { resolveAllowedOrigin } = require("./cors-origin");
const { getMethod, jsonResponse, storageErrorResponse } = require("./assessment-handler");
const {
  MAX_ADMIN_REPORT_CHARS,
  accessDeniedResponse,
  adminValidationResponse,
  deletionStateDigest,
  normalizeResultCode,
  sanitizeAdminInvite,
  sanitizeAdminResult,
  signDeletionPreview,
  validateCreateInviteRequest,
  validateDeletionScope,
  validateRevokeInviteRequest,
  verifyAdminPassword,
  verifyDeletionPreview
} = require("./admin-core");

const MAX_ADMIN_RESULTS = 5000;

function plusMs(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function exactAction(body, keys) {
  assertExactKeys(body, keys, body.action || "admin");
  if (body.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
}

function createAdminHandler(dependencies) {
  const settings = dependencies || {};
  const store = settings.store;
  const storage = settings.storage;
  const requiredMethods = [
    "getRuntimeSettings", "getBankMetadata", "getInviteByRequestId", "getInviteById", "listInvites", "upsertInvite", "revokeInvite",
    "getSessionByAttemptId", "getResultByCode", "listResults", "getDiagnostics", "listRankingProfilesByResultCode",
    "deleteRankingProfile", "getDeletionOperation", "upsertDeletionOperation", "deleteAssessmentData", "appendAudit"
  ];
  if (!store || requiredMethods.some(method => typeof store[method] !== "function")) throw new Error("admin_store_required");
  if (!storage || ["readText", "readJson", "writeJson", "deleteObject"].some(method => typeof storage[method] !== "function")) {
    throw new Error("admin_storage_required");
  }
  if (typeof settings.adminPasswordRecord !== "string" || typeof settings.inviteSecret !== "string" ||
      typeof settings.identitySecret !== "string" || typeof settings.deletionSecret !== "string" ||
      settings.inviteSecret.length < 32 || settings.identitySecret.length < 32 || settings.deletionSecret.length < 32) {
    throw new Error("admin_secret_required");
  }
  const adminPasswordRecord = settings.adminPasswordRecord;
  const inviteSecret = settings.inviteSecret;
  const identitySecret = settings.identitySecret;
  const deletionSecret = settings.deletionSecret;
  const allowedOrigins = settings.allowedOrigins || settings.allowedOrigin || "https://capssman.github.io";
  const nowProvider = typeof settings.now === "function" ? settings.now : () => new Date();
  const propertyPresence = Array.isArray(settings.propertyPresence) ? settings.propertyPresence : [];

  async function audit(eventType, subjectHash, outcome, now) {
    try {
      await store.appendAudit({
        eventDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        eventId: "evt_" + require("node:crypto").randomBytes(16).toString("hex"),
        eventType,
        subjectHash: String(subjectHash || "admin"),
        outcome: String(outcome || "ok"),
        createdAt: now,
        purgeAt: plusMs(now, AUDIT_RETENTION_MS)
      });
    } catch (_error) {}
  }

  async function adminResults() {
    const results = await store.listResults(MAX_ADMIN_RESULTS);
    return { ok: true, status: "ok", backendVersion: ASSESSMENT_BACKEND_VERSION, loadedAt: nowProvider().toISOString(), results: results.map(sanitizeAdminResult) };
  }

  async function adminReport(body, context) {
    const code = normalizeResultCode(body.code);
    if (!code) return { ok: false, status: "not_found", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Отчёт недоступен." };
    const result = await store.getResultByCode(code);
    if (!result || result.status !== "passed" || result.reportCreated !== true || !result.reportObjectKey) {
      return { ok: false, status: "not_found", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Отчёт недоступен." };
    }
    const reportText = await storage.readText(result.reportObjectKey, context);
    if (reportText === null || reportText.length > MAX_ADMIN_REPORT_CHARS) {
      return { ok: false, status: "not_found", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Отчёт недоступен." };
    }
    return { ok: true, status: "ok", backendVersion: ASSESSMENT_BACKEND_VERSION, code, filename: code + ".txt", contentType: "text/plain;charset=UTF-8", reportText };
  }

  async function adminInvites() {
    const now = nowProvider();
    const runtime = await store.getRuntimeSettings();
    const invites = (await store.listInvites(1000)).map(invite => {
      const expiry = new Date(invite.expiresAt || "").getTime();
      const state = invite.state === "issued" && Number.isFinite(expiry) && now.getTime() >= expiry ? "expired" : invite.state;
      return sanitizeAdminInvite(Object.assign({}, invite, { state }));
    });
    return {
      ok: true,
      status: "ok",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      issuanceEnabled: runtime.attempt_issuance_enabled === "true",
      legalPilotApproved: runtime.legal_pilot_approved === "true",
      privacyConsentVersion: PRIVACY_CONSENT_VERSION,
      invites
    };
  }

  async function adminCreateInvite(body) {
    const request = validateCreateInviteRequest(body);
    const runtime = await store.getRuntimeSettings();
    if (runtime.legal_pilot_approved !== "true" || runtime.attempt_issuance_enabled !== "true") {
      return { ok: false, status: "pilot_locked", retryable: false, failureCode: "pilot_locked", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Выпуск приглашений заблокирован до готовности пилота." };
    }
    const bank = await store.getBankMetadata(request.testId, TESTS[request.testId].bankVersion);
    if (!bank || bank.active !== true) return storageErrorResponse();
    const identityHash = hashIdentity(identitySecret, request.testId, request.email);
    const inviteId = "inv_" + hmacHex(inviteSecret, "invite-id-v1|" + request.requestId).slice(0, 32);
    let invite = await store.getInviteByRequestId(request.requestId) || await store.getInviteById(inviteId);
    if (invite) {
      if (invite.testId !== request.testId || !timingSafeEqual(invite.identityHash, identityHash) ||
          invite.purpose !== request.purpose || Number(invite.validForHours) !== request.validForHours) return { ok: false, status: "error", retryable: false, failureCode: "submission_conflict", message: "Повторный запрос не совпадает с исходным." };
      return buildInviteResponse(invite, true);
    }
    const now = nowProvider();
    const code = buildDeterministicInviteCode(inviteSecret, inviteId, request.testId, identityHash);
    invite = {
      inviteId,
      requestId: request.requestId,
      testId: request.testId,
      codeHash: hashInviteCode(inviteSecret, code),
      identityHash,
      emailMasked: maskEmail(request.email),
      purpose: request.purpose,
      allowRetake: false,
      validForHours: request.validForHours,
      state: "issued",
      issuedAt: now,
      expiresAt: plusMs(now, request.validForHours * 60 * 60 * 1000),
      purgeAt: plusMs(now, INVITE_AND_SESSION_RETENTION_MS)
    };
    await store.upsertInvite(invite);
    await audit("invite_issued", identityHash, "ok", now);
    return buildInviteResponse(invite, false);
  }

  function buildInviteResponse(invite, replayed) {
    return {
      ok: true,
      status: "issued",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      inviteId: invite.inviteId,
      inviteCode: buildDeterministicInviteCode(inviteSecret, invite.inviteId, invite.testId, invite.identityHash),
      testId: invite.testId,
      emailMasked: invite.emailMasked,
      purpose: invite.purpose,
      expiresAt: String(invite.expiresAt instanceof Date ? invite.expiresAt.toISOString() : invite.expiresAt),
      replayed: Boolean(replayed)
    };
  }

  async function adminRevokeInvite(body) {
    const request = validateRevokeInviteRequest(body);
    const invite = await store.getInviteById(request.inviteId);
    if (!invite) return { ok: false, status: "not_found", failureCode: "invite_not_found", message: "Приглашение не найдено." };
    if (invite.state === "completed") return { ok: true, status: "completed", inviteId: request.inviteId, requestId: request.requestId, replayed: false, backendVersion: ASSESSMENT_BACKEND_VERSION };
    if (invite.state === "revoked") {
      return invite.revokeRequestId === request.requestId
        ? { ok: true, status: "revoked", inviteId: request.inviteId, requestId: request.requestId, replayed: true, backendVersion: ASSESSMENT_BACKEND_VERSION }
        : { ok: false, status: "error", retryable: false, failureCode: "submission_conflict", message: "Повторный запрос не совпадает с исходным." };
    }
    const now = nowProvider();
    await store.revokeInvite(invite.inviteId, request.requestId, now, plusMs(now, INVITE_AND_SESSION_RETENTION_MS));
    await audit("invite_revoked", hmacHex(identitySecret, invite.inviteId), "ok", now);
    return { ok: true, status: "revoked", inviteId: invite.inviteId, requestId: request.requestId, replayed: false, backendVersion: ASSESSMENT_BACKEND_VERSION };
  }

  async function adminDiagnostics() {
    const now = nowProvider();
    const [runtime, diagnostics] = await Promise.all([store.getRuntimeSettings(), store.getDiagnostics()]);
    const stores = [
      ["admin-results", diagnostics.results],
      ["attempts", diagnostics.sessions],
      ["attempt-sessions", diagnostics.sessions],
      ["invites", diagnostics.invites]
    ].map(([key, item]) => ({ key, state: "ok", sizeBytes: null, rowCount: item.rowCount, lastModifiedAt: item.lastRecordAt, lastRecordAt: item.lastRecordAt }));
    const lastDates = stores.map(item => new Date(item.lastRecordAt || "").getTime()).filter(Number.isFinite);
    return {
      ok: true,
      status: "healthy",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      frontendVersions: { candidate: "2026.07.27", admin: "2026.07.27" },
      backendTime: now.toISOString(),
      checkedAt: now.toISOString(),
      durationMs: 0,
      yandexDisk: { accessible: true, statusCode: 200 },
      gates: {
        legalPilotApproved: runtime.legal_pilot_approved === "true",
        attemptIssuanceEnabled: runtime.attempt_issuance_enabled === "true",
        retentionAutomationEnabled: runtime.retention_automation_enabled === "true"
      },
      properties: propertyPresence,
      missingRequiredProperties: propertyPresence.filter(item => item.required && !item.present).map(item => item.name),
      stores,
      reports: { state: "ok", itemCount: diagnostics.reports.rowCount, lastModifiedAt: diagnostics.reports.lastRecordAt },
      lastWriteAt: lastDates.length ? new Date(Math.max(...lastDates)).toISOString() : "",
      lastError: null
    };
  }

  async function buildDeletionSnapshot(code, scope, context, includeReportText) {
    const result = await store.getResultByCode(code);
    if (!result) return { found: false, code, scope };
    const session = scope === "full_attempt" ? await store.getSessionByAttemptId(result.attemptId) : null;
    const invite = session && session.inviteId ? await store.getInviteById(session.inviteId) : null;
    const rankingProfiles = await store.listRankingProfilesByResultCode(code);
    let reportText = null;
    if (result.reportCreated && result.reportObjectKey) reportText = await storage.readText(result.reportObjectKey, context);
    return {
      found: true,
      code,
      scope,
      result,
      session,
      invite,
      rankingProfiles,
      reportHash: reportText === null ? "" : sha256Hex(reportText),
      reportText: includeReportText ? reportText : undefined
    };
  }

  function deletionCounts(snapshot) {
    return {
      adminRows: snapshot && snapshot.result ? 1 : 0,
      report: snapshot && snapshot.reportHash ? 1 : 0,
      attemptRows: snapshot && snapshot.scope === "full_attempt" && snapshot.session ? 1 : 0,
      sessions: snapshot && snapshot.scope === "full_attempt" && snapshot.session ? 1 : 0,
      invites: snapshot && snapshot.scope === "full_attempt" && snapshot.invite ? 1 : 0
    };
  }

  async function adminDeletionPreview(body, context) {
    exactAction(body, ["action", "apiVersion", "password", "code", "scope"]);
    const code = normalizeResultCode(body.code);
    const scope = validateDeletionScope(body.scope);
    if (!code || !scope) throw publicError("invalid_deletion_request", "Проверьте код и область удаления.");
    const now = nowProvider();
    const snapshot = await buildDeletionSnapshot(code, scope, context, false);
    if (!snapshot.found) return { ok: true, status: "preview", backendVersion: ASSESSMENT_BACKEND_VERSION, apiVersion: ASSESSMENT_API_VERSION, found: false, counts: deletionCounts(snapshot) };
    return {
      ok: true,
      status: "preview",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      found: true,
      counts: deletionCounts(snapshot),
      previewToken: signDeletionPreview(snapshot, deletionSecret, now),
      expiresAt: plusMs(now, 10 * 60 * 1000).toISOString()
    };
  }

  async function adminDeleteResult(body, context) {
    exactAction(body, ["action", "apiVersion", "password", "code", "scope", "requestId", "confirmationCode", "previewToken"]);
    const code = normalizeResultCode(body.code);
    const scope = validateDeletionScope(body.scope);
    const requestId = String(body.requestId || "").trim();
    if (!code || !scope || !/^scd_[a-f0-9]{32}$/.test(requestId) || normalizeResultCode(body.confirmationCode) !== code) {
      throw publicError("invalid_deletion_request", "Проверьте код подтверждения и параметры удаления.");
    }
    const now = nowProvider();
    let operation = await store.getDeletionOperation(requestId);
    if (operation && (operation.code !== code || operation.scope !== scope)) {
      return { ok: false, status: "error", failureCode: "submission_conflict", message: "Запрос удаления не совпадает с исходным." };
    }
    if (operation && operation.state === "completed" && operation.backupPurged) return buildDeletedResponse(operation, true);

    let snapshot;
    let backup;
    const backupObjectKey = operation && operation.backupObjectKey || "deletion-backups/" + requestId + ".json";
    if (operation) {
      backup = await storage.readJson(backupObjectKey, context);
      if (!backup || backup.digest !== operation.previewDigest || !backup.snapshot) throw new Error("deletion_backup_unavailable");
      snapshot = backup.snapshot;
    } else {
      const verified = verifyDeletionPreview(body.previewToken, deletionSecret, { now });
      if (!verified.valid || verified.payload.code !== code || verified.payload.scope !== scope) {
        return { ok: false, status: "error", failureCode: "deletion_preview_expired", message: "Повторите предварительную проверку и введите точный код результата." };
      }
      snapshot = await buildDeletionSnapshot(code, scope, context, true);
      if (!snapshot.found) return { ok: false, status: "not_found", failureCode: "deletion_target_not_found", message: "Данные по этому коду не найдены." };
      const digest = deletionStateDigest(snapshot);
      if (!timingSafeEqual(digest, verified.payload.digest)) {
        return { ok: false, status: "error", failureCode: "deletion_preview_expired", message: "Состояние изменилось. Выполните предварительную проверку заново." };
      }
      backup = { schemaVersion: 1, requestId, createdAt: now.toISOString(), digest, snapshot };
      const write = await storage.writeJson(backupObjectKey, backup, context, { createOnly: true });
      if (write && write.created === false) {
        const existing = await storage.readJson(backupObjectKey, context);
        if (!existing || !timingSafeEqual(sha256Hex(JSON.stringify(existing)), sha256Hex(JSON.stringify(backup)))) throw new Error("deletion_backup_conflict");
      }
      operation = {
        requestId, code, scope, previewDigest: digest, state: "backed_up", backupObjectKey,
        backupPurged: false, startedAt: now, completedAt: now, purgeAt: plusMs(now, AUDIT_RETENTION_MS)
      };
      await store.upsertDeletionOperation(operation);
    }

    await store.deleteAssessmentData(snapshot);
    for (const profile of snapshot.rankingProfiles || []) await store.deleteRankingProfile(profile.testId, profile.publicProfileId);
    if (snapshot.result && snapshot.result.reportObjectKey) await storage.deleteObject(snapshot.result.reportObjectKey, context);
    if (await store.getResultByCode(code)) throw new Error("deletion_result_verification_failed");
    if (scope === "full_attempt" && snapshot.session && await store.getSessionByAttemptId(snapshot.session.attemptId)) throw new Error("deletion_session_verification_failed");
    if ((await store.listRankingProfilesByResultCode(code)).length) throw new Error("deletion_ranking_verification_failed");
    if (snapshot.result && snapshot.result.reportObjectKey && await storage.readText(snapshot.result.reportObjectKey, context) !== null) throw new Error("deletion_report_verification_failed");
    operation = Object.assign({}, operation, { state: "data_deleted", completedAt: now });
    await store.upsertDeletionOperation(operation);
    await storage.deleteObject(backupObjectKey, context);
    if (await storage.readJson(backupObjectKey, context) !== null) throw new Error("deletion_backup_purge_failed");
    operation = Object.assign({}, operation, { state: "completed", backupPurged: true, completedAt: now });
    await store.upsertDeletionOperation(operation);
    await audit("result_deleted", hmacHex(identitySecret, code), scope, now);
    return buildDeletedResponse(operation, false);
  }

  function buildDeletedResponse(operation, replayed) {
    return {
      ok: true,
      status: "deleted",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      code: operation.code,
      scope: operation.scope,
      requestId: operation.requestId,
      backupPurged: operation.backupPurged === true,
      replayed: Boolean(replayed)
    };
  }

  return async function adminHandler(event, context) {
    const allowedOrigin = resolveAllowedOrigin(event, allowedOrigins);
    const method = getMethod(event);
    if (method === "OPTIONS") return jsonResponse(204, {}, allowedOrigin);
    if (method === "GET") return jsonResponse(200, { ok: true, status: "alive", backendVersion: ASSESSMENT_BACKEND_VERSION }, allowedOrigin);
    if (method !== "POST") return jsonResponse(405, { ok: false, status: "method_not_allowed" }, allowedOrigin);
    try {
      const body = parseBody(event);
      if (!verifyAdminPassword(body.password, adminPasswordRecord)) return jsonResponse(200, accessDeniedResponse(), allowedOrigin);
      let response;
      if (body.action === "adminResults") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminResults(); }
      else if (body.action === "adminReport") { exactAction(body, ["action", "apiVersion", "password", "code"]); response = await adminReport(body, context); }
      else if (body.action === "adminInvites") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminInvites(); }
      else if (body.action === "adminDiagnostics") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminDiagnostics(); }
      else if (body.action === "adminCreateInvite") response = await adminCreateInvite(body);
      else if (body.action === "adminRevokeInvite") response = await adminRevokeInvite(body);
      else if (body.action === "adminDeletionPreview") response = await adminDeletionPreview(body, context);
      else if (body.action === "adminDeleteResult") response = await adminDeleteResult(body, context);
      else throw publicError("unsupported_action", "Действие не поддерживается.");
      return jsonResponse(200, response, allowedOrigin);
    } catch (error) {
      if (error && error.publicRequestError) return jsonResponse(200, adminValidationResponse(error), allowedOrigin);
      return jsonResponse(200, storageErrorResponse(), allowedOrigin);
    }
  };
}

module.exports = { MAX_ADMIN_RESULTS, createAdminHandler };
