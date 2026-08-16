"use strict";

const crypto = require("node:crypto");

const INVITATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_INVITATION_DEADLINE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_INVITATION_DEADLINE_MS = 60 * 60 * 1000;
const CANDIDATE_RESPONSES = new Set(["interested", "details", "declined"]);
const OPEN_INVITATION_STATUSES = new Set(["sent", "viewed", "interested", "details"]);
const WORK_FORMATS = new Set(["office", "hybrid", "remote", "flexible"]);

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(value, allowed) {
  if (!isPlainObject(value)) throw new Error("invalid_request");
  const expected = new Set(allowed);
  if (Object.keys(value).some(key => !expected.has(key))) throw new Error("invalid_request");
}

function safeText(value, min, max) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max || /[<>\u0000-\u001f]/.test(text)) throw new Error("invalid_request");
  return text;
}

function validateShortlistId(value) {
  const id = String(value || "");
  if (!/^short_[a-f0-9]{24}$/.test(id)) throw new Error("invalid_request");
  return id;
}

function validateInvitationId(value) {
  const id = String(value || "");
  if (!/^inv_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_request");
  return id;
}

function validateRequestId(value) {
  const id = String(value || "");
  if (!/^invite_req_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_request");
  return id;
}

function createInvitationId(secret, employerId, requestId, candidateProfileId) {
  if (String(secret || "").length < 32 || !/^emp_[a-f0-9]{24}$/.test(String(employerId || "")) ||
      !/^invite_req_[a-f0-9]{32}$/.test(String(requestId || "")) || !/^acct_[a-f0-9]{32}$/.test(String(candidateProfileId || ""))) {
    throw new Error("invitation_identity_invalid");
  }
  return "inv_" + crypto.createHmac("sha256", String(secret)).update("employer-invitation-v1|" + employerId + "|" + requestId + "|" + candidateProfileId).digest("hex").slice(0, 32);
}

function validateEmployerInvitationAction(value, apiVersion) {
  const common = ["action", "apiVersion"];
  if (!isPlainObject(value) || value.apiVersion !== apiVersion) throw new Error("invalid_request");
  if (value.action === "listInvitations") {
    assertAllowedKeys(value, common);
    return { type: "listInvitations" };
  }
  if (value.action !== "createInvitationBatch") throw new Error("invalid_request");
  assertAllowedKeys(value, common.concat(["shortlistId", "requestId", "roleTitle", "roleSummary", "workFormat", "region", "compensation", "responseDeadline"]));
  const workFormat = String(value.workFormat || "");
  if (!WORK_FORMATS.has(workFormat)) throw new Error("invalid_request");
  const deadline = new Date(String(value.responseDeadline || ""));
  if (!Number.isFinite(deadline.getTime())) throw new Error("invalid_request");
  return {
    type: "createInvitationBatch",
    shortlistId: validateShortlistId(value.shortlistId),
    requestId: validateRequestId(value.requestId),
    roleTitle: safeText(value.roleTitle, 2, 120),
    roleSummary: safeText(value.roleSummary, 10, 800),
    workFormat,
    region: safeText(value.region, 0, 120),
    compensation: safeText(value.compensation, 2, 120),
    responseDeadline: deadline
  };
}

function assertInvitationDeadline(deadline, now) {
  const current = now instanceof Date ? now : new Date();
  const value = deadline instanceof Date ? deadline : new Date(deadline || "");
  const delta = value.getTime() - current.getTime();
  if (!Number.isFinite(delta) || delta < MIN_INVITATION_DEADLINE_MS || delta > MAX_INVITATION_DEADLINE_MS) throw new Error("invalid_invitation_deadline");
  return value;
}

function validateCandidateInvitationAction(value, apiVersion) {
  const common = ["action", "apiVersion"];
  if (!isPlainObject(value) || value.apiVersion !== apiVersion) throw new Error("invalid_request");
  if (value.action === "listInvitations") {
    assertAllowedKeys(value, common);
    return { type: "listInvitations" };
  }
  if (value.action === "markInvitationViewed") {
    assertAllowedKeys(value, common.concat(["invitationId"]));
    return { type: "markInvitationViewed", invitationId: validateInvitationId(value.invitationId) };
  }
  if (value.action === "respondInvitation") {
    assertAllowedKeys(value, common.concat(["invitationId", "response"]));
    const response = String(value.response || "");
    if (!CANDIDATE_RESPONSES.has(response)) throw new Error("invalid_request");
    return { type: "respondInvitation", invitationId: validateInvitationId(value.invitationId), response };
  }
  throw new Error("invalid_request");
}

function effectiveInvitationStatus(row, now) {
  const status = String(row && row.status || "");
  const deadline = Date.parse(String(row && row.responseDeadline || ""));
  const current = now instanceof Date ? now.getTime() : Date.now();
  return OPEN_INVITATION_STATUSES.has(status) && Number.isFinite(deadline) && deadline <= current ? "expired" : status;
}

module.exports = {
  CANDIDATE_RESPONSES,
  INVITATION_RETENTION_MS,
  MAX_INVITATION_DEADLINE_MS,
  MIN_INVITATION_DEADLINE_MS,
  OPEN_INVITATION_STATUSES,
  assertInvitationDeadline,
  createInvitationId,
  effectiveInvitationStatus,
  validateCandidateInvitationAction,
  validateEmployerInvitationAction,
  validateInvitationId
};
