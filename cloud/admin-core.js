"use strict";

const crypto = require("node:crypto");
const {
  ASSESSMENT_API_VERSION,
  ASSESSMENT_BACKEND_VERSION,
  AUTHORITATIVE_SCORING_VERSION,
  SCORE_VERIFICATION_SERVER,
  TESTS,
  assertExactKeys,
  hmacHex,
  isPlainObject,
  publicError,
  sha256Hex,
  timingSafeEqual
} = require("./assessment-core");

const ADMIN_PASSWORD_ALGORITHM = "pbkdf2-sha256";
const ADMIN_PASSWORD_ITERATIONS = 310000;
const DELETION_PREVIEW_TTL_MS = 10 * 60 * 1000;
const MAX_ADMIN_REPORT_CHARS = 200000;
const RESULT_CODE_PATTERN = /^(FA|CA|FPA|ACC|BI)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/;

function normalizeResultCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return RESULT_CODE_PATTERN.test(code) ? code : "";
}

function createAdminPasswordRecord(password, salt, iterations) {
  const secret = String(password || "");
  const rounds = Number(iterations || ADMIN_PASSWORD_ITERATIONS);
  const saltBuffer = salt ? Buffer.from(salt) : crypto.randomBytes(24);
  if (secret.length < 12 || secret.length > 1024 || !Number.isInteger(rounds) || rounds < 200000 || rounds > 1000000 || saltBuffer.length < 16) {
    throw new Error("invalid_admin_password_record");
  }
  const derived = crypto.pbkdf2Sync(secret, saltBuffer, rounds, 32, "sha256");
  return [ADMIN_PASSWORD_ALGORITHM, rounds, saltBuffer.toString("base64url"), derived.toString("base64url")].join("$");
}

function verifyAdminPassword(password, record) {
  try {
    const secret = String(password || "");
    const parts = String(record || "").split("$");
    const rounds = Number(parts[1]);
    if (parts.length !== 4 || parts[0] !== ADMIN_PASSWORD_ALGORITHM || secret.length < 1 || secret.length > 1024 ||
        !Number.isInteger(rounds) || rounds < 200000 || rounds > 1000000) return false;
    const salt = Buffer.from(parts[2], "base64url");
    const expected = Buffer.from(parts[3], "base64url");
    if (salt.length < 16 || expected.length !== 32) return false;
    const actual = crypto.pbkdf2Sync(secret, salt, rounds, expected.length, "sha256");
    return crypto.timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
}

function boundedText(value, maximum, required, label) {
  const text = String(value == null ? "" : value).trim();
  if ((required && !text) || text.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw publicError("invalid_field", "Проверьте поле «" + label + "».");
  }
  return text;
}

function validateAdminEmail(value) {
  const email = boundedText(value, 254, true, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw publicError("invalid_email", "Проверьте email.");
  return email;
}

function validateCreateInviteRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "password", "requestId", "testId", "email", "validForHours", "purpose"], "adminCreateInvite");
  if (value.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
  const requestId = String(value.requestId || "").trim();
  const testId = String(value.testId || "");
  const hours = Number(value.validForHours);
  if (!/^sci_[a-z0-9]{24,40}$/.test(requestId)) throw publicError("invalid_request_id", "Некорректный идентификатор операции.");
  if (!Object.prototype.hasOwnProperty.call(TESTS, testId)) throw publicError("unsupported_test", "Тест недоступен.");
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) throw publicError("invalid_field", "Проверьте срок приглашения.");
  return { requestId, testId, email: validateAdminEmail(value.email), validForHours: hours, purpose: boundedText(value.purpose, 120, false, "Назначение приглашения") };
}

function validateCreateInviteGroupRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "password", "requestId", "testId", "maxUses", "validForHours", "purpose"], "adminCreateInviteGroup");
  if (value.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
  const requestId = String(value.requestId || "").trim();
  const testId = String(value.testId || "");
  const maxUses = Number(value.maxUses);
  const hours = Number(value.validForHours);
  if (!/^scg_[a-z0-9]{24,40}$/.test(requestId)) throw publicError("invalid_request_id", "Некорректный идентификатор операции.");
  if (!Object.prototype.hasOwnProperty.call(TESTS, testId)) throw publicError("unsupported_test", "Тест недоступен.");
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) throw publicError("invalid_field", "Проверьте лимит участников.");
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) throw publicError("invalid_field", "Проверьте срок приглашения.");
  return { requestId, testId, maxUses, validForHours: hours, purpose: boundedText(value.purpose, 120, false, "Назначение приглашения") };
}

function validateRevokeInviteGroupRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "password", "requestId", "groupId"], "adminRevokeInviteGroup");
  if (value.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
  const requestId = String(value.requestId || "").trim();
  const groupId = String(value.groupId || "").trim();
  if (!/^sgr_[a-z0-9]{24,40}$/.test(requestId)) throw publicError("invalid_request_id", "Некорректный идентификатор операции.");
  if (!/^grp_[a-f0-9]{32}$/.test(groupId)) throw publicError("invalid_invite", "Некорректное групповое приглашение.");
  return { requestId, groupId };
}

function validateRevokeInviteRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "password", "requestId", "inviteId"], "adminRevokeInvite");
  if (value.apiVersion !== ASSESSMENT_API_VERSION) throw publicError("client_upgrade_required", "Версия админки устарела. Обновите страницу.");
  const requestId = String(value.requestId || "").trim();
  const inviteId = String(value.inviteId || "").trim();
  if (!/^scr_[a-z0-9]{24,40}$/.test(requestId)) throw publicError("invalid_request_id", "Некорректный идентификатор операции.");
  if (!/^inv_[a-f0-9]{32}$/.test(inviteId)) throw publicError("invalid_invite", "Некорректное приглашение.");
  return { requestId, inviteId };
}

function validateDeletionScope(value) {
  const scope = String(value || "");
  return scope === "result_only" || scope === "full_attempt" ? scope : "";
}

function sanitizeAdminResult(row) {
  const source = isPlainObject(row) ? row : {};
  const testId = Object.prototype.hasOwnProperty.call(TESTS, source.testId) ? String(source.testId) : "unknown";
  const rawScore = Number(source.rawScore);
  const rawTotal = Number(source.rawTotal);
  const finalScore = Number(source.finalScore);
  const percent = Number(source.percent);
  const tabSwitches = Number(source.tabSwitches);
  const expectedPercent = rawTotal > 0 ? Math.round(rawScore * 100 / rawTotal) : -1;
  const expectedStatus = finalScore >= 80 ? "passed" : "failed";
  const verified = testId !== "unknown" && source.bankVersion === TESTS[testId].bankVersion &&
    source.scoreVerification === SCORE_VERIFICATION_SERVER && source.scoringAlgorithmVersion === AUTHORITATIVE_SCORING_VERSION &&
    Number.isFinite(rawScore) && Number.isFinite(rawTotal) && rawScore >= 0 && rawTotal > 0 && rawScore <= rawTotal &&
    Number.isFinite(finalScore) && Number.isFinite(percent) && finalScore === percent && percent === expectedPercent &&
    source.status === expectedStatus && Number.isInteger(tabSwitches) && tabSwitches >= 0;
  return {
    code: normalizeResultCode(source.code) || "INVALID",
    testId,
    testTitle: TESTS[testId] && TESTS[testId].title || "Неизвестный тест",
    finalScore: Number.isFinite(finalScore) ? finalScore : 0,
    percent: Number.isFinite(percent) ? percent : 0,
    tabSwitches: Number.isInteger(tabSwitches) && tabSwitches >= 0 ? tabSwitches : 0,
    date: String(source.completedAt || source.date || ""),
    status: source.status === "passed" ? "passed" : "failed",
    badge: String(source.badge || ""),
    reportCreated: source.reportCreated === true,
    bankVersion: String(source.bankVersion || ""),
    scoringAlgorithmVersion: String(source.scoringAlgorithmVersion || ""),
    telemetryVerification: String(source.telemetryVerification || ""),
    advisoryPenalty: Number(source.advisoryPenalty || 0),
    scoreVerification: verified ? SCORE_VERIFICATION_SERVER : "client-reported-unverified"
  };
}

function sanitizeAdminInvite(invite) {
  const source = isPlainObject(invite) ? invite : {};
  return {
    inviteId: /^inv_[a-f0-9]{32}$/.test(String(source.inviteId || "")) ? String(source.inviteId) : "INVALID",
    testId: Object.prototype.hasOwnProperty.call(TESTS, source.testId) ? String(source.testId) : "unknown",
    emailMasked: boundedText(source.emailMasked || "***", 254, false, "Email"),
    purpose: boundedText(source.purpose, 120, false, "Назначение приглашения"),
    state: ["issued", "active", "completed", "revoked", "expired"].includes(source.state) ? source.state : "unknown",
    issuedAt: String(source.issuedAt || ""),
    expiresAt: String(source.expiresAt || ""),
    activatedAt: String(source.activatedAt || ""),
    completedAt: String(source.completedAt || "")
  };
}

function sanitizeAdminInviteGroup(group) {
  const source = isPlainObject(group) ? group : {};
  const maxUses = Number(source.maxUses);
  const usedCount = Number(source.usedCount);
  return {
    groupId: /^grp_[a-f0-9]{32}$/.test(String(source.groupId || "")) ? String(source.groupId) : "INVALID",
    testId: Object.prototype.hasOwnProperty.call(TESTS, source.testId) ? String(source.testId) : "unknown",
    purpose: boundedText(source.purpose, 120, false, "Назначение приглашения"),
    maxUses: Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= 100 ? maxUses : 0,
    usedCount: Number.isInteger(usedCount) && usedCount >= 0 ? Math.min(usedCount, maxUses) : 0,
    state: ["issued", "revoked", "expired", "full"].includes(source.state) ? source.state : "unknown",
    issuedAt: String(source.issuedAt || ""),
    expiresAt: String(source.expiresAt || ""),
    revokedAt: String(source.revokedAt || "")
  };
}

function deletionStateDigest(snapshot) {
  const source = snapshot || {};
  return sha256Hex(JSON.stringify({
    version: 1,
    code: String(source.code || ""),
    scope: String(source.scope || ""),
    result: source.result ? { code: source.result.code, attemptId: source.result.attemptId, submissionHash: source.result.submissionHash, completedAt: source.result.completedAt } : null,
    session: source.session ? { attemptId: source.session.attemptId, inviteId: source.session.inviteId, state: source.session.state, resultCode: source.session.resultCode } : null,
    invite: source.invite ? { inviteId: source.invite.inviteId, state: source.invite.state, attemptId: source.invite.attemptId } : null,
    rankingProfiles: (source.rankingProfiles || []).map(item => [item.testId, item.publicProfileId, item.resultCode]).sort(),
    reportHash: String(source.reportHash || "")
  }));
}

function signDeletionPreview(snapshot, secret, now) {
  const issued = now instanceof Date ? now : new Date();
  const payload = {
    v: 1,
    code: snapshot.code,
    scope: snapshot.scope,
    digest: deletionStateDigest(snapshot),
    iat: Math.floor(issued.getTime() / 1000),
    exp: Math.floor((issued.getTime() + DELETION_PREVIEW_TTL_MS) / 1000)
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + hmacHex(secret, "deletion-preview-v1|" + encoded);
}

function verifyDeletionPreview(token, secret, options) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return { valid: false };
    if (!timingSafeEqual(parts[1], hmacHex(secret, "deletion-preview-v1|" + parts[0]))) return { valid: false };
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    assertExactKeys(payload, ["v", "code", "scope", "digest", "iat", "exp"], "deletion_preview");
    const now = options && options.now instanceof Date ? options.now : new Date();
    if (payload.v !== 1 || !normalizeResultCode(payload.code) || !validateDeletionScope(payload.scope) ||
        !/^[a-f0-9]{64}$/.test(String(payload.digest || "")) || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) ||
        payload.exp <= payload.iat || payload.iat > Math.floor(now.getTime() / 1000) + 60 || payload.exp <= Math.floor(now.getTime() / 1000)) return { valid: false };
    return { valid: true, payload };
  } catch (_error) {
    return { valid: false };
  }
}

function accessDeniedResponse() {
  return { ok: false, status: "error", backendVersion: ASSESSMENT_BACKEND_VERSION, message: "Доступ запрещён." };
}

function adminValidationResponse(error) {
  return { ok: false, status: "invalid_request", retryable: false, failureCode: String(error && error.failureCode || "invalid_request"), backendVersion: ASSESSMENT_BACKEND_VERSION, message: String(error && error.publicMessage || "Запрос не прошёл проверку.") };
}

module.exports = {
  ADMIN_PASSWORD_ALGORITHM,
  ADMIN_PASSWORD_ITERATIONS,
  DELETION_PREVIEW_TTL_MS,
  MAX_ADMIN_REPORT_CHARS,
  accessDeniedResponse,
  adminValidationResponse,
  boundedText,
  createAdminPasswordRecord,
  deletionStateDigest,
  normalizeResultCode,
  sanitizeAdminInviteGroup,
  sanitizeAdminInvite,
  sanitizeAdminResult,
  signDeletionPreview,
  validateCreateInviteGroupRequest,
  validateCreateInviteRequest,
  validateDeletionScope,
  validateRevokeInviteGroupRequest,
  validateRevokeInviteRequest,
  verifyAdminPassword,
  verifyDeletionPreview
};
