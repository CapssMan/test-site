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
const { buildQuestionAnalytics } = require("./question-analytics");
const {
  MAX_ADMIN_REPORT_CHARS,
  accessDeniedResponse,
  adminValidationResponse,
  deletionStateDigest,
  normalizeResultCode,
  sanitizeAdminInviteGroup,
  sanitizeAdminInvite,
  sanitizeAdminResult,
  signDeletionPreview,
  validateCreateInviteGroupRequest,
  validateCreateInviteRequest,
  validateDeletionScope,
  validateRevealInviteGroupRequest,
  validateRevokeInviteGroupRequest,
  validateRevokeInviteRequest,
  validateUpdateInviteGroupDescriptionRequest,
  verifyAdminPassword,
  verifyDeletionPreview
} = require("./admin-core");
const { hashAccountEmail } = require("./account-core");
const { CREDENTIAL_RETENTION_MS, createOrganizationId, publicCandidateCredential, publicOrganization } = require("./trust-core");

const MAX_ADMIN_RESULTS = 5000;

function plusMs(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function exactAction(body, keys) {
  assertExactKeys(body, keys, body.action || "admin");
  if (body.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
}

function adminText(value, max, required, label) {
  const text = String(value || "").trim().replace(/\r\n?/g, "\n");
  if ((required && text.length < 2) || text.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw publicError("invalid_field", "Проверьте поле «" + label + "».");
  return text;
}

function adminDomain(value) {
  const domain = String(value || "").trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(domain)) throw publicError("invalid_domain", "Проверьте домен компании.");
  return domain;
}

function adminWebsite(value, domain) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch (_error) { throw publicError("invalid_website", "Проверьте HTTPS-сайт компании."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (host !== domain && !host.endsWith("." + domain))) throw publicError("invalid_website", "Сайт должен использовать HTTPS и соответствовать домену компании.");
  return url.toString();
}

function adminProfileId(value) { const id = String(value || ""); if (!/^acct_[a-f0-9]{32}$/.test(id)) throw publicError("invalid_profile_id", "Некорректный профиль кандидата."); return id; }
function adminCredentialId(value) { const id = String(value || ""); if (!/^cred_[a-f0-9]{24}$/.test(id)) throw publicError("invalid_credential_id", "Некорректная регалия."); return id; }

function createAdminHandler(dependencies) {
  const settings = dependencies || {};
  const store = settings.store;
  const storage = settings.storage;
  const requiredMethods = [
    "getRuntimeSettings", "getBankMetadata", "getInviteByRequestId", "getInviteById", "listInvites", "upsertInvite", "revokeInvite",
    "getInviteGroupByRequestId", "getInviteGroupById", "listInviteGroups", "upsertInviteGroup", "revokeInviteGroup", "updateInviteGroupDescription",
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

  async function adminQuestionAnalytics() {
    const results = await store.listResults(MAX_ADMIN_RESULTS);
    return {
      ok: true,
      status: "ok",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      generatedAt: nowProvider().toISOString(),
      privacy: "aggregate-no-candidate-data",
      minimumInitialSample: 10,
      minimumStableSample: 20,
      tests: buildQuestionAnalytics(results)
    };
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
    const inviteGroups = (await store.listInviteGroups(1000)).map(group => {
      const expiry = new Date(group.expiresAt || "").getTime();
      let state = group.state === "issued" && Number.isFinite(expiry) && now.getTime() >= expiry ? "expired" : group.state;
      if (state === "issued" && Number(group.usedCount) >= Number(group.maxUses)) state = "full";
      return sanitizeAdminInviteGroup(Object.assign({}, group, { state }));
    });
    return {
      ok: true,
      status: "ok",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      issuanceEnabled: runtime.attempt_issuance_enabled === "true",
      legalPilotApproved: runtime.legal_pilot_approved === "true",
      privacyConsentVersion: PRIVACY_CONSENT_VERSION,
      invites,
      inviteGroups
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

  function groupCodeIdentity(group) {
    return hmacHex(inviteSecret, "group-code-identity-v1|" + group.groupId);
  }

  function buildInviteGroupResponse(group, replayed) {
    return {
      ok: true,
      status: "issued",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: ASSESSMENT_API_VERSION,
      groupId: group.groupId,
      inviteCode: buildDeterministicInviteCode(inviteSecret, group.groupId, group.testId, groupCodeIdentity(group)),
      testId: group.testId,
      purpose: group.purpose,
      maxUses: Number(group.maxUses),
      usedCount: Number(group.usedCount || 0),
      expiresAt: String(group.expiresAt instanceof Date ? group.expiresAt.toISOString() : group.expiresAt),
      replayed: Boolean(replayed)
    };
  }

  async function adminRevealInviteGroup(body) {
    const request = validateRevealInviteGroupRequest(body);
    const group = await store.getInviteGroupById(request.groupId);
    const now = nowProvider();
    const expiresAt = group && new Date(group.expiresAt || "");
    if (!group || group.state !== "issued" || !Number.isFinite(expiresAt.getTime()) || now >= expiresAt ||
        !Number.isInteger(Number(group.maxUses)) || Number(group.usedCount) >= Number(group.maxUses)) {
      return { ok: false, status: "unavailable", retryable: false, failureCode: "invite_group_unavailable", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Действующая групповая ссылка недоступна." };
    }
    const inviteCode = buildDeterministicInviteCode(inviteSecret, group.groupId, group.testId, groupCodeIdentity(group));
    if (!timingSafeEqual(String(group.codeHash || ""), hashInviteCode(inviteSecret, inviteCode))) throw new Error("invite_group_code_integrity_failed");
    await audit("invite_group_link_revealed", hmacHex(identitySecret, group.groupId), "ok", now);
    return {
      ok: true, status: "available", backendVersion: ASSESSMENT_BACKEND_VERSION, apiVersion: ASSESSMENT_API_VERSION,
      groupId: group.groupId, testId: group.testId, inviteCode, expiresAt: expiresAt.toISOString()
    };
  }

  async function adminCreateInviteGroup(body) {
    const request = validateCreateInviteGroupRequest(body);
    const runtime = await store.getRuntimeSettings();
    if (runtime.legal_pilot_approved !== "true" || runtime.attempt_issuance_enabled !== "true") {
      return { ok: false, status: "pilot_locked", retryable: false, failureCode: "pilot_locked", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Выпуск приглашений заблокирован до готовности пилота." };
    }
    const bank = await store.getBankMetadata(request.testId, TESTS[request.testId].bankVersion);
    if (!bank || bank.active !== true) return storageErrorResponse();
    const groupId = "grp_" + hmacHex(inviteSecret, "invite-group-id-v1|" + request.requestId).slice(0, 32);
    let group = await store.getInviteGroupByRequestId(request.requestId) || await store.getInviteGroupById(groupId);
    if (group) {
      if (group.testId !== request.testId || group.purpose !== request.purpose ||
          Number(group.maxUses) !== request.maxUses || Number(group.validForHours) !== request.validForHours) {
        return { ok: false, status: "error", retryable: false, failureCode: "submission_conflict", message: "Повторный запрос не совпадает с исходным." };
      }
      return buildInviteGroupResponse(group, true);
    }
    const now = nowProvider();
    const expiresAt = plusMs(now, request.validForHours * 60 * 60 * 1000);
    group = {
      groupId,
      requestId: request.requestId,
      testId: request.testId,
      codeHash: "",
      purpose: request.purpose,
      maxUses: request.maxUses,
      usedCount: 0,
      validForHours: request.validForHours,
      state: "issued",
      issuedAt: now,
      expiresAt,
      purgeAt: plusMs(now, INVITE_AND_SESSION_RETENTION_MS)
    };
    group.codeHash = hashInviteCode(inviteSecret, buildDeterministicInviteCode(inviteSecret, group.groupId, group.testId, groupCodeIdentity(group)));
    await store.upsertInviteGroup(group);
    await audit("invite_group_issued", hmacHex(identitySecret, group.groupId), "ok", now);
    return buildInviteGroupResponse(group, false);
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

  async function adminRevokeInviteGroup(body) {
    const request = validateRevokeInviteGroupRequest(body);
    const group = await store.getInviteGroupById(request.groupId);
    if (!group) return { ok: false, status: "not_found", failureCode: "invite_group_not_found", message: "Групповое приглашение не найдено." };
    if (group.state === "revoked") {
      return group.revokeRequestId === request.requestId
        ? { ok: true, status: "revoked", groupId: request.groupId, requestId: request.requestId, replayed: true, backendVersion: ASSESSMENT_BACKEND_VERSION }
        : { ok: false, status: "error", retryable: false, failureCode: "submission_conflict", message: "Повторный запрос не совпадает с исходным." };
    }
    const now = nowProvider();
    await store.revokeInviteGroup(group.groupId, request.requestId, now, plusMs(now, INVITE_AND_SESSION_RETENTION_MS));
    await audit("invite_group_revoked", hmacHex(identitySecret, group.groupId), "ok", now);
    return { ok: true, status: "revoked", groupId: group.groupId, requestId: request.requestId, replayed: false, backendVersion: ASSESSMENT_BACKEND_VERSION };
  }

  async function adminUpdateInviteGroupDescription(body) {
    const request = validateUpdateInviteGroupDescriptionRequest(body);
    const group = await store.getInviteGroupById(request.groupId);
    if (!group) {
      return { ok: false, status: "not_found", failureCode: "invite_group_not_found", message: "Групповое приглашение не найдено." };
    }
    if (String(group.purpose || "") === request.purpose) {
      return {
        ok: true, status: "updated", groupId: group.groupId, requestId: request.requestId,
        purpose: request.purpose, replayed: true, backendVersion: ASSESSMENT_BACKEND_VERSION
      };
    }
    const now = nowProvider();
    await store.updateInviteGroupDescription(group.groupId, request.purpose);
    await audit("invite_group_description_updated", hmacHex(identitySecret, group.groupId), "ok", now);
    return {
      ok: true, status: "updated", groupId: group.groupId, requestId: request.requestId,
      purpose: request.purpose, replayed: false, backendVersion: ASSESSMENT_BACKEND_VERSION
    };
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

  async function adminTrustReviewQueue(body) {
    exactAction(body, ["action", "apiVersion", "password"]);
    if (typeof store.listCredentialReviewQueue !== "function") throw new Error("admin_trust_store_required");
    const credentials = await store.listCredentialReviewQueue("pending", 100);
    return { ok: true, status: "ok", credentials: credentials.map(item => ({ candidateProfileId: item.candidateProfileId, ...publicCandidateCredential(item) })) };
  }

  async function adminReviewCredential(body) {
    exactAction(body, ["action", "apiVersion", "password", "profileId", "credentialId", "decision", "note"]);
    if (typeof store.getCandidateCredential !== "function" || typeof store.setCredentialVerification !== "function") throw new Error("admin_trust_store_required");
    const profileId = adminProfileId(body.profileId), credentialId = adminCredentialId(body.credentialId);
    const decision = String(body.decision || "");
    if (!["verified", "rejected"].includes(decision)) throw publicError("invalid_decision", "Выберите результат проверки.");
    const note = adminText(body.note, 500, decision === "rejected", "Комментарий проверки");
    const existing = await store.getCandidateCredential(profileId, credentialId);
    if (!existing) throw publicError("credential_not_found", "Регалия не найдена.");
    const now = nowProvider(), updated = await store.setCredentialVerification(profileId, credentialId, decision, note, now, plusMs(now, CREDENTIAL_RETENTION_MS));
    await audit("credential_" + decision, profileId, "ok", now);
    return { ok: true, status: "ok", credential: { candidateProfileId: profileId, ...publicCandidateCredential(updated) } };
  }

  async function adminUpsertOrganization(body) {
    exactAction(body, ["action", "apiVersion", "password", "displayName", "legalName", "domain", "websiteUrl", "description"]);
    if (typeof store.getOrganization !== "function" || typeof store.getOrganizationByDomain !== "function" || typeof store.upsertOrganization !== "function") throw new Error("admin_trust_store_required");
    const domain = adminDomain(body.domain), websiteUrl = adminWebsite(body.websiteUrl, domain), now = nowProvider();
    const organizationId = createOrganizationId(identitySecret, domain), existing = await store.getOrganizationByDomain(domain);
    if (existing && existing.organizationId !== organizationId) throw publicError("organization_conflict", "Домен уже связан с другой организацией.");
    const organization = { organizationId, displayName: adminText(body.displayName, 120, true, "Публичное название"), legalName: adminText(body.legalName, 200, true, "Юридическое название"), domain, websiteUrl, description: adminText(body.description, 600, false, "Описание"), verificationStatus: "verified", status: "active", createdAt: existing ? new Date(existing.createdAt) : now, updatedAt: now, purgeAt: plusMs(now, CREDENTIAL_RETENTION_MS) };
    await store.upsertOrganization(organization);await audit("organization_verified", organizationId, "ok", now);
    return { ok: true, status: "ok", organization: publicOrganization(organization) };
  }

  async function adminAuthorizeEmployer(body) {
    exactAction(body, ["action", "apiVersion", "password", "email", "domain", "role"]);
    if (typeof store.getAccountByEmailHash !== "function" || typeof store.getOrganization !== "function" || typeof store.upsertEmployerAccount !== "function") throw new Error("admin_employer_store_required");
    const email = String(body.email || "").trim().toLowerCase(), domain = adminDomain(body.domain), role = String(body.role || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw publicError("invalid_email", "Проверьте email аккаунта Яндекс.");
    if (!["admin", "recruiter"].includes(role)) throw publicError("invalid_role", "Выберите роль работодателя.");
    const account = await store.getAccountByEmailHash(hashAccountEmail(identitySecret, email));
    if (!account || account.status !== "active") throw publicError("account_not_found", "Аккаунт с таким email не найден. Сначала войдите через Яндекс.");
    const organization = await store.getOrganization(createOrganizationId(identitySecret, domain));
    if (!publicOrganization(organization)) throw publicError("organization_not_verified", "Сначала подтвердите компанию.");
    const now = nowProvider(), existing = typeof store.getEmployerByIdentityProfileId === "function" ? await store.getEmployerByIdentityProfileId(account.profileId) : null;
    const employer = { employerId: existing ? existing.employerId : "emp_" + hmacHex(identitySecret, "employer-account-v1|" + account.profileId).slice(0, 24), identityProfileId: account.profileId, organizationName: organization.displayName, organizationDomain: organization.domain, organizationId: organization.organizationId, role, verificationStatus: "verified", status: "active", createdAt: existing ? new Date(existing.createdAt) : now, updatedAt: now, purgeAt: plusMs(now, CREDENTIAL_RETENTION_MS) };
    await store.upsertEmployerAccount(employer);await audit("employer_authorized", employer.employerId, "ok", now);
    return { ok: true, status: "ok", employer: { employerId: employer.employerId, emailMasked: maskEmail(email), organization: publicOrganization(organization), role, verificationStatus: "verified" } };
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
      else if (body.action === "adminQuestionAnalytics") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminQuestionAnalytics(); }
      else if (body.action === "adminReport") { exactAction(body, ["action", "apiVersion", "password", "code"]); response = await adminReport(body, context); }
      else if (body.action === "adminInvites") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminInvites(); }
      else if (body.action === "adminDiagnostics") { exactAction(body, ["action", "apiVersion", "password"]); response = await adminDiagnostics(); }
      else if (body.action === "adminCreateInvite") response = await adminCreateInvite(body);
      else if (body.action === "adminCreateInviteGroup") response = await adminCreateInviteGroup(body);
      else if (body.action === "adminRevealInviteGroup") response = await adminRevealInviteGroup(body);
      else if (body.action === "adminRevokeInvite") response = await adminRevokeInvite(body);
      else if (body.action === "adminRevokeInviteGroup") response = await adminRevokeInviteGroup(body);
      else if (body.action === "adminUpdateInviteGroupDescription") response = await adminUpdateInviteGroupDescription(body);
      else if (body.action === "adminTrustReviewQueue") response = await adminTrustReviewQueue(body);
      else if (body.action === "adminReviewCredential") response = await adminReviewCredential(body);
      else if (body.action === "adminUpsertOrganization") response = await adminUpsertOrganization(body);
      else if (body.action === "adminAuthorizeEmployer") response = await adminAuthorizeEmployer(body);
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
