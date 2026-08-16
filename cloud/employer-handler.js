"use strict";

const { resolveAllowedOrigin } = require("./cors-origin");
const { extractBearerToken, hashSessionToken } = require("./account-core");
const {
  EMPLOYER_API_VERSION,
  MAX_SHORTLIST_SIZE,
  ROLE_TEMPLATES,
  buildTalentCandidate,
  createShortlistId,
  parseBody,
  publicRoleTemplates,
  rankTalent,
  validateAction
} = require("./employer-core");
const {
  INVITATION_RETENTION_MS,
  OPEN_INVITATION_STATUSES,
  assertInvitationDeadline,
  createInvitationId,
  effectiveInvitationStatus
} = require("./invitation-core");
const { publicOrganization } = require("./trust-core");
const {
  CHAT_RETENTION_MS,
  createMessageId,
  publicConversation,
  publicMessage
} = require("./chat-core");

const EMPLOYER_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const EMPLOYER_BACKEND_VERSION = "yandex-employer-trust-chat-2026-08-17-1";

function method(event) {
  return String(event && (event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method)) || "GET").toUpperCase();
}

function jsonResponse(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type,Authorization,Cache-Control,Pragma",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload)
  };
}

function plusMs(now, milliseconds) {
  return new Date(now.getTime() + milliseconds);
}

function publicEmployer(employer, organization) {
  return {
    employerId: employer.employerId,
    organizationName: employer.organizationName,
    verificationStatus: employer.verificationStatus,
    role: employer.role || "recruiter",
    organization: publicOrganization(organization)
  };
}

function publicShortlist(shortlist, itemCount) {
  return {
    shortlistId: shortlist.shortlistId,
    name: shortlist.name,
    roleTemplateId: shortlist.roleTemplateId,
    roleTitle: ROLE_TEMPLATES[shortlist.roleTemplateId] ? ROLE_TEMPLATES[shortlist.roleTemplateId].title : "Финансы",
    itemCount: Number(itemCount || 0),
    updatedAt: shortlist.updatedAt
  };
}

function publicEmployerInvitation(invitation, now) {
  return {
    invitationId: invitation.invitationId,
    talentProfileId: invitation.talentProfileId,
    candidateAlias: invitation.candidateAlias,
    shortlistId: invitation.shortlistId,
    organizationName: invitation.organizationName,
    roleTitle: invitation.roleTitle,
    roleSummary: invitation.roleSummary,
    workFormat: invitation.workFormat,
    region: invitation.region,
    compensation: invitation.compensation,
    status: effectiveInvitationStatus(invitation, now),
    responseDeadline: invitation.responseDeadline instanceof Date ? invitation.responseDeadline.toISOString() : invitation.responseDeadline,
    createdAt: invitation.createdAt instanceof Date ? invitation.createdAt.toISOString() : invitation.createdAt,
    viewedAt: invitation.viewedAt instanceof Date ? invitation.viewedAt.toISOString() : invitation.viewedAt,
    respondedAt: invitation.respondedAt instanceof Date ? invitation.respondedAt.toISOString() : invitation.respondedAt,
    updatedAt: invitation.updatedAt instanceof Date ? invitation.updatedAt.toISOString() : invitation.updatedAt
  };
}

function createEmployerHandler(dependencies) {
  const options = dependencies || {};
  const store = options.store;
  const allowedOrigins = options.allowedOrigins || options.allowedOrigin;
  const sessionSecret = String(options.sessionSecret || "");
  const talentSecret = String(options.talentSecret || "");
  const nowProvider = typeof options.now === "function" ? options.now : () => new Date();
  const required = ["getRuntimeSettings", "getSessionByTokenHash", "getAccountByProfileId", "getEmployerByIdentityProfileId", "listDiscoverableAccounts", "listProfileAttempts", "createShortlist", "listShortlists", "getShortlist", "listShortlistItems", "addShortlistItem", "removeShortlistItem"];
  if (!store || required.some(name => typeof store[name] !== "function")) throw new Error("employer_store_required");
  if (sessionSecret.length < 32 || talentSecret.length < 32) throw new Error("employer_secret_required");

  async function authenticate(event) {
    const token = extractBearerToken(event);
    if (!token) return null;
    const session = await store.getSessionByTokenHash(hashSessionToken(sessionSecret, token));
    const expiresAt = Date.parse(String(session && session.expiresAt || ""));
    if (!session || !Number.isFinite(expiresAt) || expiresAt <= nowProvider().getTime()) return null;
    const account = await store.getAccountByProfileId(session.profileId);
    if (!account || account.status !== "active") return null;
    const employer = await store.getEmployerByIdentityProfileId(account.profileId);
    return employer && employer.status === "active" && employer.verificationStatus === "verified" ? { account, employer } : { account, employer: null };
  }

  async function loadTalent(search) {
    const accounts = await store.listDiscoverableAccounts(100);
    const records = [];
    const profileByTalentId = new Map();
    const entryByTalentId = new Map();
    for (const account of accounts) {
      const attempts = await store.listProfileAttempts(account.profileId);
      let credentials = [];
      if (typeof store.listVerifiedCandidateCredentials === "function") {
        credentials = await store.listVerifiedCandidateCredentials(account.profileId);
      }
      let candidate = null;
      try {
        candidate = buildTalentCandidate(account, attempts, { talentSecret, roleTemplateId: search.roleTemplateId, search, now: nowProvider(), credentials });
      } catch (_error) {
        candidate = null;
      }
      if (candidate) {
        records.push(candidate);
        profileByTalentId.set(candidate.talentProfileId, account.profileId);
        entryByTalentId.set(candidate.talentProfileId, candidate);
      }
    }
    return { entries: rankTalent(records, search), profileByTalentId, entryByTalentId };
  }

  async function loadAllTalent() {
    return loadTalent({ roleTemplateId: "finance-general", query: "", minScore: 0, region: "", workFormat: "", experienceBand: "", jobStatus: "", limit: 50 });
  }

  async function shortlistsWithCounts(employerId) {
    const shortlists = await store.listShortlists(employerId);
    const result = [];
    for (const shortlist of shortlists) {
      const items = await store.listShortlistItems(employerId, shortlist.shortlistId);
      result.push(publicShortlist(shortlist, items.length));
    }
    return result;
  }

  return async function employerHandler(event) {
    let origin;
    try {
      origin = resolveAllowedOrigin(event, allowedOrigins);
    } catch (_error) {
      return jsonResponse(403, { ok: false, error: "origin_not_allowed" }, Array.isArray(allowedOrigins) ? allowedOrigins[0] : allowedOrigins);
    }
    const verb = method(event);
    if (verb === "OPTIONS") return jsonResponse(204, {}, origin);
    try {
      const settings = await store.getRuntimeSettings();
      if (verb === "GET") {
        return jsonResponse(200, {
          ok: true,
          backendVersion: EMPLOYER_BACKEND_VERSION,
          apiVersion: EMPLOYER_API_VERSION,
          enabled: settings.employer_workspace_enabled === "true",
          contactEnabled: settings.employer_contact_enabled === "true",
          companyProfilesEnabled: settings.employer_company_profiles_enabled === "true",
          credentialsEnabled: settings.candidate_credentials_enabled === "true",
          chatEnabled: settings.employer_chat_enabled === "true",
          invitationEnabled: settings.employer_invitation_enabled === "true",
          roleTemplates: publicRoleTemplates(),
          shortlistLimit: MAX_SHORTLIST_SIZE
        }, origin);
      }
      if (verb !== "POST") return jsonResponse(405, { ok: false, error: "method_not_allowed" }, origin);
      const body = parseBody(event);
      const action = validateAction(body, { contactsEnabled: settings.employer_contact_enabled === "true" });
      const auth = await authenticate(event);
      if (!auth) return jsonResponse(401, { ok: false, error: "authentication_required" }, origin);
      if (!auth.employer) return jsonResponse(403, { ok: false, error: "employer_verification_required" }, origin);
      if (settings.employer_workspace_enabled !== "true" || settings.profile_publication_enabled !== "true") {
        return jsonResponse(403, { ok: false, error: "employer_workspace_closed" }, origin);
      }
      let organization = null;
      if (settings.employer_company_profiles_enabled === "true") {
        if (typeof store.getOrganization !== "function") throw new Error("employer_organization_store_required");
        organization = await store.getOrganization(auth.employer.organizationId);
        if (!publicOrganization(organization)) return jsonResponse(403, { ok: false, error: "organization_verification_required" }, origin);
      }

      if (action.type === "search") {
        const talent = await loadTalent(action.search);
        return jsonResponse(200, {
          ok: true,
          apiVersion: EMPLOYER_API_VERSION,
          employer: publicEmployer(auth.employer, organization),
          roleTemplate: publicRoleTemplates().find(item => item.id === action.search.roleTemplateId),
          entries: talent.entries,
          count: talent.entries.length,
          generatedAt: nowProvider().toISOString(),
          notice: "Совпадение помогает сортировать shortlist и не является автоматическим решением о найме."
        }, origin);
      }

      if (action.type === "listShortlists") {
        return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, employer: publicEmployer(auth.employer, organization), shortlists: await shortlistsWithCounts(auth.employer.employerId) }, origin);
      }

      if (["listConversations", "listMessages", "sendMessage", "markConversationRead", "setConversationState"].includes(action.type)) {
        if (action.type === "listConversations" && settings.employer_chat_enabled !== "true") {
          return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, chatEnabled: false, conversations: [] }, origin);
        }
        if (settings.employer_chat_enabled !== "true") return jsonResponse(403, { ok: false, error: "employer_chat_closed" }, origin);
        if (typeof store.getEmployerConversation !== "function" || typeof store.listEmployerConversations !== "function") throw new Error("employer_chat_store_required");
        if (action.type === "listConversations") {
          const rows = await store.listEmployerConversations(auth.employer.employerId);
          return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, chatEnabled: true, conversations: rows.map(row => publicConversation(row, "employer")) }, origin);
        }
        const conversation = await store.getEmployerConversation(auth.employer.employerId, action.conversationId);
        if (!conversation) return jsonResponse(404, { ok: false, error: "conversation_not_found" }, origin);
        if (action.type === "listMessages") {
          const rows = await store.listConversationMessages(conversation.conversationId, action.limit);
          return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, conversation: publicConversation(conversation, "employer"), messages: rows.map(publicMessage) }, origin);
        }
        const now = nowProvider();
        if (action.type === "sendMessage") {
          if (conversation.state !== "open") return jsonResponse(409, { ok: false, error: "conversation_closed" }, origin);
          const message = await store.writeMessage({
            candidateProfileId: conversation.candidateProfileId, conversationId: conversation.conversationId,
            messageId: createMessageId(talentSecret, conversation.conversationId, "employer", action.clientMessageId),
            clientMessageId: action.clientMessageId, senderType: "employer", text: action.text,
            createdAt: now, purgeAt: plusMs(now, CHAT_RETENTION_MS)
          });
          return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, message: publicMessage(message) }, origin);
        }
        if (action.type === "markConversationRead") {
          await store.markConversationRead(auth.employer.employerId, conversation.conversationId, "employer", now);
          return jsonResponse(200, { ok: true, read: true }, origin);
        }
        if (action.state === "blocked") return jsonResponse(403, { ok: false, error: "candidate_only_action" }, origin);
        await store.setConversationState(auth.employer.employerId, conversation.conversationId, "employer", action.state, now, plusMs(now, CHAT_RETENTION_MS));
        return jsonResponse(200, { ok: true, state: action.state }, origin);
      }

      if (action.type === "createShortlist") {
        const now = nowProvider();
        const shortlist = { employerId: auth.employer.employerId, shortlistId: createShortlistId(), name: action.name, roleTemplateId: action.roleTemplateId, createdAt: now, updatedAt: now, purgeAt: plusMs(now, EMPLOYER_RETENTION_MS) };
        await store.createShortlist(shortlist);
        return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, shortlist: publicShortlist(shortlist, 0) }, origin);
      }

      if (action.type === "listInvitations") {
        if (settings.employer_invitation_enabled !== "true") return jsonResponse(403, { ok: false, error: "employer_invitation_closed" }, origin);
        if (typeof store.listEmployerInvitations !== "function") throw new Error("employer_invitation_store_required");
        const now = nowProvider();
        const invitations = (await store.listEmployerInvitations(auth.employer.employerId))
          .map(item => publicEmployerInvitation(item, now))
          .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
        return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, invitations }, origin);
      }

      const shortlist = await store.getShortlist(auth.employer.employerId, action.shortlistId);
      if (!shortlist) return jsonResponse(404, { ok: false, error: "shortlist_not_found" }, origin);

      if (action.type === "getShortlist") {
        const items = await store.listShortlistItems(auth.employer.employerId, shortlist.shortlistId);
        const talent = await loadAllTalent();
        const byId = talent.entryByTalentId;
        const entries = items.map(item => byId.get(item.talentProfileId)).filter(Boolean);
        return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, shortlist: publicShortlist(shortlist, items.length), entries, unavailableCount: items.length - entries.length }, origin);
      }

      if (action.type === "createInvitationBatch") {
        if (settings.employer_invitation_enabled !== "true") return jsonResponse(403, { ok: false, error: "employer_invitation_closed" }, origin);
        if (typeof store.listEmployerInvitations !== "function" || typeof store.upsertInvitation !== "function") throw new Error("employer_invitation_store_required");
        const now = nowProvider();
        const deadline = assertInvitationDeadline(action.responseDeadline, now);
        const items = await store.listShortlistItems(auth.employer.employerId, shortlist.shortlistId);
        if (!items.length) return jsonResponse(409, { ok: false, error: "shortlist_empty" }, origin);
        if (items.length > MAX_SHORTLIST_SIZE) return jsonResponse(409, { ok: false, error: "shortlist_limit_reached" }, origin);
        const talent = await loadAllTalent();
        const candidates = items.map(item => ({
          item,
          candidateProfileId: talent.profileByTalentId.get(item.talentProfileId),
          entry: talent.entryByTalentId.get(item.talentProfileId)
        }));
        if (candidates.some(candidate => !candidate.candidateProfileId || !candidate.entry)) {
          return jsonResponse(409, { ok: false, error: "shortlist_contains_unavailable_talent" }, origin);
        }
        const existing = await store.listEmployerInvitations(auth.employer.employerId);
        const existingById = new Map(existing.map(item => [item.invitationId, item]));
        const intended = candidates.map(candidate => ({
          ...candidate,
          invitationId: createInvitationId(talentSecret, auth.employer.employerId, action.requestId, candidate.candidateProfileId)
        }));
        const duplicate = intended.find(candidate => existing.some(item => item.invitationId !== candidate.invitationId &&
          item.candidateProfileId === candidate.candidateProfileId && OPEN_INVITATION_STATUSES.has(effectiveInvitationStatus(item, now))));
        if (duplicate) return jsonResponse(409, { ok: false, error: "active_invitation_exists" }, origin);
        const rows = [];
        for (const candidate of intended) {
          const previous = existingById.get(candidate.invitationId);
          if (previous) {
            rows.push(previous);
            continue;
          }
          const row = {
            candidateProfileId: candidate.candidateProfileId,
            invitationId: candidate.invitationId,
            employerId: auth.employer.employerId,
            shortlistId: shortlist.shortlistId,
            requestId: action.requestId,
            talentProfileId: candidate.item.talentProfileId,
            candidateAlias: candidate.entry.alias,
            organizationName: organization ? organization.displayName : auth.employer.organizationName,
            roleTitle: action.roleTitle,
            roleSummary: action.roleSummary,
            workFormat: action.workFormat,
            region: action.region,
            compensation: action.compensation,
            status: "sent",
            responseDeadline: deadline,
            createdAt: now,
            viewedAt: new Date(0),
            respondedAt: new Date(0),
            updatedAt: now,
            purgeAt: plusMs(now, INVITATION_RETENTION_MS)
          };
          await store.upsertInvitation(row);
          rows.push(row);
        }
        return jsonResponse(200, { ok: true, apiVersion: EMPLOYER_API_VERSION, createdCount: rows.length,
          invitations: rows.map(item => publicEmployerInvitation(item, now)) }, origin);
      }

      if (action.type === "addToShortlist") {
        const items = await store.listShortlistItems(auth.employer.employerId, shortlist.shortlistId);
        if (items.some(item => item.talentProfileId === action.talentProfileId)) return jsonResponse(200, { ok: true, state: "already_added", itemCount: items.length }, origin);
        if (items.length >= MAX_SHORTLIST_SIZE) return jsonResponse(409, { ok: false, error: "shortlist_limit_reached" }, origin);
        const talent = await loadAllTalent();
        const candidateProfileId = talent.profileByTalentId.get(action.talentProfileId);
        if (!candidateProfileId) return jsonResponse(404, { ok: false, error: "talent_not_available" }, origin);
        const now = nowProvider();
        await store.addShortlistItem({ employerId: auth.employer.employerId, shortlistId: shortlist.shortlistId, talentProfileId: action.talentProfileId, candidateProfileId, addedAt: now, purgeAt: plusMs(now, EMPLOYER_RETENTION_MS) });
        return jsonResponse(200, { ok: true, state: "added", itemCount: items.length + 1 }, origin);
      }

      if (action.type === "removeFromShortlist") {
        await store.removeShortlistItem(auth.employer.employerId, shortlist.shortlistId, action.talentProfileId, nowProvider());
        const items = await store.listShortlistItems(auth.employer.employerId, shortlist.shortlistId);
        return jsonResponse(200, { ok: true, state: "removed", itemCount: items.length }, origin);
      }
      return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
    } catch (error) {
      const errorCode = String(error && error.message || "");
      if (error instanceof SyntaxError || ["invalid_invitation_deadline", "invalid_chat_request", "invalid_chat_message", "contact_sharing_closed"].includes(errorCode) || /^(invalid_request|[a-z_]+_invalid)$/.test(errorCode)) {
        return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
      }
      return jsonResponse(503, { ok: false, error: "employer_temporarily_unavailable" }, origin);
    }
  };
}

module.exports = { EMPLOYER_BACKEND_VERSION, EMPLOYER_RETENTION_MS, createEmployerHandler, jsonResponse, publicEmployer, publicEmployerInvitation, publicShortlist };
