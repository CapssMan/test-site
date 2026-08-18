"use strict";

const { resolveAllowedOrigin } = require("./cors-origin");
const {
  ACCOUNT_API_VERSION,
  ACCOUNT_CONSENT_VERSION,
  PUBLIC_PROFILE_CONSENT_VERSION,
  EXTENDED_PROFILE_CONSENT_VERSION,
  SESSION_TTL_MS,
  ACCOUNT_RETENTION_MS,
  parseBody,
  randomToken,
  randomProfileId,
  hashSessionToken,
  hashProviderSubject,
  hashAccountEmail,
  normalizeEmail,
  maskEmail,
  extractBearerToken,
  validateExchange,
  validateSimpleAction,
  validateUpdate,
  validateDelete
} = require("./account-core");
const {
  OPEN_INVITATION_STATUSES,
  effectiveInvitationStatus,
  validateCandidateInvitationAction
} = require("./invitation-core");
const {
  CREDENTIAL_RETENTION_MS,
  createCredentialId,
  publicCandidateCredential,
  validateCandidateCredentialAction
} = require("./trust-core");
const {
  CHAT_RETENTION_MS,
  createConversationId,
  createMessageId,
  publicConversation,
  publicMessage,
  validateChatAction
} = require("./chat-core");

function getMethod(event) {
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
      "X-Content-Type-Options": "nosniff"
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload)
  };
}

function validDate(value) {
  const result = value instanceof Date ? value : new Date(value || "");
  return Number.isFinite(result.getTime()) ? result : null;
}

function plusMs(now, milliseconds) {
  return new Date(now.getTime() + milliseconds);
}

const SELF_SERVICE_TEST_IDS = ["fa-junior", "ca-junior", "fpa-junior", "acc-junior", "bi-junior", "tourism-junior", "software-junior", "product-project-junior"];
const ACCOUNT_BACKEND_VERSION = "yandex-candidate-trust-chat-2026-08-17-1";
const RETAKE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
const ACTIVE_ATTEMPT_TTL_MS = 6 * 60 * 60 * 1000;

function buildTestAccess(attempts, now, enabled) {
  const currentTime = validDate(now) || new Date();
  const rows = Array.isArray(attempts) ? attempts.slice() : [];
  return SELF_SERVICE_TEST_IDS.map(testId => {
    if (!enabled) return { testId, status: "closed", availableAt: "", lastResultCode: "", lastPercent: 0 };
    const matching = rows.filter(item => item && item.testId === testId).sort((left, right) => {
      return Date.parse(String(right.completedAt || right.startedAt || "")) - Date.parse(String(left.completedAt || left.startedAt || ""));
    });
    const active = matching.find(item => item.state === "active" && validDate(item.startedAt));
    if (active) {
      const activeUntil = plusMs(validDate(active.startedAt), ACTIVE_ATTEMPT_TTL_MS);
      if (currentTime < activeUntil) {
        return { testId, status: "in_progress", availableAt: activeUntil.toISOString(), lastResultCode: "", lastPercent: 0 };
      }
    }
    const completed = matching.find(item => item.state === "completed" && validDate(item.completedAt));
    if (completed) {
      const nextEligibleAt = plusMs(validDate(completed.completedAt), RETAKE_WINDOW_MS);
      return {
        testId,
        status: currentTime >= nextEligibleAt ? "available" : "cooldown",
        availableAt: nextEligibleAt.toISOString(),
        lastResultCode: String(completed.resultCode || ""),
        lastPercent: Number(completed.percent || 0)
      };
    }
    return { testId, status: "available", availableAt: "", lastResultCode: "", lastPercent: 0 };
  });
}

function publicProfile(account, attempts) {
  return {
    profileId: account.profileId,
    emailMasked: account.emailMasked,
    publicAlias: account.publicAlias,
    visibility: account.visibility,
    jobStatus: account.jobStatus,
    region: account.region,
    workFormat: account.workFormat,
    experienceBand: account.experienceBand,
    currentRole: account.currentRole,
    targetRole: account.targetRole,
    experienceSummary: account.experienceSummary,
    professionalTools: account.professionalTools,
    availabilityConfirmedAt: account.availabilityConfirmedAt,
    accountConsentVersion: account.accountConsentVersion,
    publicConsentVersion: account.publicConsentVersion,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    results: (attempts || []).filter(item => item.state === "completed").map(item => ({
      testId: item.testId,
      resultCode: item.resultCode,
      percent: item.percent,
      bankVersion: item.bankVersion,
      completedAt: item.completedAt
    }))
  };
}

function publicCandidateInvitation(invitation, now) {
  return {
    invitationId: invitation.invitationId,
    organizationName: invitation.organizationName,
    roleTitle: invitation.roleTitle,
    roleSummary: invitation.roleSummary,
    workFormat: invitation.workFormat,
    region: invitation.region,
    compensation: invitation.compensation,
    status: effectiveInvitationStatus(invitation, now),
    responseDeadline: invitation.responseDeadline,
    createdAt: invitation.createdAt,
    viewedAt: invitation.viewedAt,
    respondedAt: invitation.respondedAt,
    updatedAt: invitation.updatedAt
  };
}

function createAccountHandler(dependencies) {
  const options = dependencies || {};
  const store = options.store;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const clientId = String(options.clientId || "");
  const redirectUri = String(options.redirectUri || "");
  const identitySecret = String(options.identitySecret || "");
  const sessionSecret = String(options.sessionSecret || "");
  const allowedOrigins = options.allowedOrigins || options.allowedOrigin;
  const nowProvider = typeof options.now === "function" ? options.now : () => new Date();
  if (!store || typeof store.getRuntimeSettings !== "function" || typeof fetchImpl !== "function") throw new Error("account_dependencies_required");
  if (identitySecret.length < 32 || sessionSecret.length < 32) throw new Error("account_secret_required");

  async function providerRequest(url, requestOptions, errorCode) {
    try {
      return await fetchImpl(url, requestOptions);
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function providerJson(reply, errorCode) {
    try {
      return await reply.json();
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function storageRequest(operation, errorCode) {
    try {
      return await operation();
    } catch (_error) {
      throw new Error(errorCode);
    }
  }

  async function authenticate(event) {
    const token = extractBearerToken(event);
    if (!token) return null;
    const tokenHash = hashSessionToken(sessionSecret, token);
    const session = await store.getSessionByTokenHash(tokenHash);
    const now = nowProvider();
    const expiry = validDate(session && session.expiresAt);
    if (!session || !expiry || now >= expiry) return null;
    const account = await store.getAccountByProfileId(session.profileId);
    return account && account.status === "active" ? { account, session, tokenHash } : null;
  }

  async function loadCandidateInvitations(profileId, settings) {
    if (settings.employer_invitation_enabled !== "true") return [];
    if (typeof store.listCandidateInvitations !== "function") throw new Error("account_invitation_unavailable");
    const now = nowProvider();
    const rows = await storageRequest(() => store.listCandidateInvitations(profileId), "account_invitation_unavailable");
    return rows.map(row => publicCandidateInvitation(row, now))
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  async function loadCredentials(profileId, settings) {
    if (settings.candidate_credentials_enabled !== "true") return [];
    if (typeof store.listCandidateCredentials !== "function") throw new Error("account_credentials_unavailable");
    const rows = await storageRequest(() => store.listCandidateCredentials(profileId), "account_credentials_unavailable");
    return rows.map(publicCandidateCredential);
  }

  async function ensureCandidateConversations(profileId, settings) {
    if (settings.employer_chat_enabled !== "true") return;
    if (typeof store.listCandidateInvitations !== "function" || typeof store.createConversation !== "function") throw new Error("account_chat_unavailable");
    const invitations = await storageRequest(() => store.listCandidateInvitations(profileId), "account_chat_unavailable");
    const now = nowProvider();
    for (const invitation of invitations.filter(item => ["interested", "details"].includes(effectiveInvitationStatus(item, now)))) {
      await storageRequest(() => store.createConversation({
        candidateProfileId: profileId,
        conversationId: createConversationId(identitySecret, invitation.invitationId),
        invitationId: invitation.invitationId,
        employerId: invitation.employerId,
        organizationId: invitation.organizationId || "",
        organizationName: invitation.organizationName,
        candidateAlias: invitation.candidateAlias,
        roleTitle: invitation.roleTitle,
        state: "open",
        candidateUnreadCount: 0,
        employerUnreadCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
        purgeAt: plusMs(now, CHAT_RETENTION_MS)
      }), "account_chat_unavailable");
    }
  }

  async function loadCandidateConversations(profileId, settings) {
    if (settings.employer_chat_enabled !== "true") return [];
    if (typeof store.listCandidateConversations !== "function") throw new Error("account_chat_unavailable");
    await ensureCandidateConversations(profileId, settings);
    const rows = await storageRequest(() => store.listCandidateConversations(profileId), "account_chat_unavailable");
    return rows.map(row => publicConversation(row, "candidate"));
  }

  function buildConfig(settings) {
    const configured = /^[A-Za-z0-9]{20,80}$/.test(clientId) && /^https:\/\//.test(redirectUri);
    return {
      backendVersion: ACCOUNT_BACKEND_VERSION,
      ok: true,
      apiVersion: ACCOUNT_API_VERSION,
      provider: "yandex",
      enabled: configured && settings.account_registration_enabled === "true",
      clientId: configured ? clientId : "",
      redirectUri: configured ? redirectUri : "",
      scope: "login:email",
      accountConsentVersion: ACCOUNT_CONSENT_VERSION,
      extendedProfileConsentVersion: EXTENDED_PROFILE_CONSENT_VERSION,
      publicProfileConsentVersion: PUBLIC_PROFILE_CONSENT_VERSION,
      publicProfileEnabled: settings.profile_publication_enabled === "true",
      selfServiceEnabled: settings.account_self_service_enabled === "true",
      invitationEnabled: settings.employer_invitation_enabled === "true",
      credentialsEnabled: settings.candidate_credentials_enabled === "true",
      chatEnabled: settings.employer_chat_enabled === "true",
      contactEnabled: settings.employer_contact_enabled === "true",
      accountRequiredForAttempts: settings.account_required_for_attempts === "true"
    };
  }

  async function exchange(body, settings) {
    const request = validateExchange(body);
    if (settings.account_registration_enabled !== "true") {
      return { statusCode: 403, payload: { ok: false, error: "account_registration_closed" } };
    }
    const tokenReply = await providerRequest("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: request.code,
        client_id: clientId,
        code_verifier: request.codeVerifier,
        redirect_uri: redirectUri
      }).toString()
    }, "identity_token_unavailable");
    if (!tokenReply.ok) return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    const tokenData = await providerJson(tokenReply, "identity_token_invalid_response");
    const accessToken = String(tokenData && tokenData.access_token || "");
    if (accessToken.length < 20 || accessToken.length > 4096) throw new Error("identity_token_invalid_response");
    const infoReply = await providerRequest("https://login.yandex.ru/info?format=json", {
      method: "GET",
      headers: { Authorization: "OAuth " + accessToken, Accept: "application/json" }
    }, "identity_profile_unavailable");
    if (!infoReply.ok) return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    const info = await providerJson(infoReply, "identity_profile_invalid_response");
    const subject = String(info && info.id || "");
    const providerClient = String(info && info.client_id || "");
    const email = normalizeEmail(info && info.default_email);
    if (!/^\d{3,30}$/.test(subject) || providerClient !== clientId || !/^[^@\s]{1,64}@[^@\s]{1,190}$/.test(email)) {
      return { statusCode: 403, payload: { ok: false, error: "identity_verification_failed" } };
    }
    const now = nowProvider();
    const subjectHash = hashProviderSubject(identitySecret, subject);
    const emailHash = hashAccountEmail(identitySecret, email);
    let account = await storageRequest(() => store.getAccountByProviderSubject("yandex", subjectHash), "account_lookup_unavailable");
    const emailAccount = await storageRequest(() => store.getAccountByEmailHash(emailHash), "account_lookup_unavailable");
    if (emailAccount && (!account || emailAccount.profileId !== account.profileId)) {
      return { statusCode: 409, payload: { ok: false, error: "account_conflict" } };
    }
    if (!account) {
      account = {
        profileId: randomProfileId(identitySecret, subject), status: "active", provider: "yandex",
        providerSubjectHash: subjectHash, emailHash, emailMasked: maskEmail(email), publicAlias: "",
        visibility: "private", jobStatus: "hidden", region: "", workFormat: "", experienceBand: "",
        currentRole: "", targetRole: "", experienceSummary: "", professionalTools: "", availabilityConfirmedAt: new Date(0),
        accountConsentVersion: ACCOUNT_CONSENT_VERSION, accountConsentedAt: now,
        publicConsentVersion: "", publicConsentedAt: new Date(0), createdAt: now, lastLoginAt: now,
        updatedAt: now, purgeAt: plusMs(now, ACCOUNT_RETENTION_MS)
      };
    } else {
      account = { ...account, emailHash, emailMasked: maskEmail(email), accountConsentVersion: ACCOUNT_CONSENT_VERSION, accountConsentedAt: now, lastLoginAt: now, updatedAt: now, purgeAt: plusMs(now, ACCOUNT_RETENTION_MS) };
      account = { ...account, availabilityConfirmedAt: validDate(account.availabilityConfirmedAt) || new Date(0) };
    }
    await storageRequest(() => store.upsertAccount(account), "account_write_unavailable");
    const token = randomToken();
    const expiresAt = plusMs(now, SESSION_TTL_MS);
    const attempts = await storageRequest(() => store.listProfileAttempts(account.profileId), "account_attempts_unavailable");
    await storageRequest(() => store.insertSession({ profileId: account.profileId, tokenHash: hashSessionToken(sessionSecret, token), issuedAt: now, expiresAt, lastSeenAt: now, purgeAt: expiresAt }), "account_session_unavailable");
    return {
      statusCode: 200,
      payload: {
        ok: true, apiVersion: ACCOUNT_API_VERSION, sessionToken: token, expiresAt: expiresAt.toISOString(), email,
        profile: publicProfile(account, attempts),
        invitationEnabled: settings.employer_invitation_enabled === "true",
        credentialsEnabled: settings.candidate_credentials_enabled === "true",
        chatEnabled: settings.employer_chat_enabled === "true",
        selfServiceEnabled: settings.account_self_service_enabled === "true",
        testAccess: buildTestAccess(attempts, now, settings.account_self_service_enabled === "true")
      }
    };
  }

  return async function accountHandler(event) {
    let origin;
    try {
      origin = resolveAllowedOrigin(event, allowedOrigins);
    } catch (_error) {
      return jsonResponse(403, { ok: false, error: "origin_not_allowed" }, Array.isArray(allowedOrigins) ? allowedOrigins[0] : allowedOrigins);
    }
    const verb = getMethod(event);
    if (verb === "OPTIONS") return jsonResponse(204, {}, origin);
    try {
      const settings = await store.getRuntimeSettings();
      if (verb === "GET") return jsonResponse(200, buildConfig(settings), origin);
      if (verb !== "POST") return jsonResponse(405, { ok: false, error: "method_not_allowed" }, origin);
      const body = parseBody(event);
      if (body.action === "exchangeYandexCode") {
        const result = await exchange(body, settings);
        return jsonResponse(result.statusCode, result.payload, origin);
      }
      const auth = await authenticate(event);
      if (!auth) return jsonResponse(401, { ok: false, error: "authentication_required" }, origin);
      if (body.action === "getProfile") {
        validateSimpleAction(body, "getProfile");
        const attempts = await store.listProfileAttempts(auth.account.profileId);
        const invitations = await loadCandidateInvitations(auth.account.profileId, settings);
        const credentials = await loadCredentials(auth.account.profileId, settings);
        const conversations = await loadCandidateConversations(auth.account.profileId, settings);
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, profile: publicProfile(auth.account, attempts),
          publicProfileEnabled: settings.profile_publication_enabled === "true",
          invitationEnabled: settings.employer_invitation_enabled === "true",
          invitations,
          credentialsEnabled: settings.candidate_credentials_enabled === "true",
          credentials,
          chatEnabled: settings.employer_chat_enabled === "true",
          contactEnabled: settings.employer_contact_enabled === "true",
          conversations,
          selfServiceEnabled: settings.account_self_service_enabled === "true",
          testAccess: buildTestAccess(attempts, nowProvider(), settings.account_self_service_enabled === "true") }, origin);
      }
      if (["listCredentials", "upsertCredential", "deleteCredential"].includes(body.action)) {
        const action = validateCandidateCredentialAction(body, ACCOUNT_API_VERSION, EXTENDED_PROFILE_CONSENT_VERSION, nowProvider().getUTCFullYear());
        if (action.type === "listCredentials") {
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION,
            credentialsEnabled: settings.candidate_credentials_enabled === "true",
            credentials: await loadCredentials(auth.account.profileId, settings) }, origin);
        }
        if (settings.candidate_credentials_enabled !== "true") return jsonResponse(403, { ok: false, error: "candidate_credentials_closed" }, origin);
        if (typeof store.getCandidateCredential !== "function" || typeof store.upsertCandidateCredential !== "function" || typeof store.deleteCandidateCredential !== "function") throw new Error("account_credentials_unavailable");
        if (action.type === "deleteCredential") {
          await storageRequest(() => store.deleteCandidateCredential(auth.account.profileId, action.credentialId), "account_credentials_unavailable");
          return jsonResponse(200, { ok: true, deleted: true }, origin);
        }
        const previous = action.credentialId ? await storageRequest(() => store.getCandidateCredential(auth.account.profileId, action.credentialId), "account_credentials_unavailable") : null;
        if (action.credentialId && !previous) return jsonResponse(404, { ok: false, error: "credential_not_found" }, origin);
        const now = nowProvider();
        const credential = {
          candidateProfileId: auth.account.profileId,
          credentialId: action.credentialId || createCredentialId(),
          credentialType: action.credentialType,
          title: action.title,
          issuer: action.issuer,
          description: action.description,
          issuedYear: action.issuedYear,
          evidenceUrl: action.evidenceUrl,
          visibility: action.visibility,
          verificationStatus: action.evidenceUrl ? "pending" : "self_reported",
          verificationNote: "",
          createdAt: previous ? previous.createdAt : now,
          updatedAt: now,
          purgeAt: plusMs(now, CREDENTIAL_RETENTION_MS)
        };
        await storageRequest(() => store.upsertCandidateCredential(credential), "account_credentials_unavailable");
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, credential: publicCandidateCredential(credential) }, origin);
      }
      if (["listConversations", "listMessages", "sendMessage", "markConversationRead", "setConversationState"].includes(body.action)) {
        const action = validateChatAction(body, ACCOUNT_API_VERSION, settings.employer_contact_enabled === "true");
        if (action.type === "listConversations") {
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION,
            chatEnabled: settings.employer_chat_enabled === "true",
            conversations: await loadCandidateConversations(auth.account.profileId, settings) }, origin);
        }
        if (settings.employer_chat_enabled !== "true") return jsonResponse(403, { ok: false, error: "employer_chat_closed" }, origin);
        if (typeof store.getCandidateConversation !== "function") throw new Error("account_chat_unavailable");
        const conversation = await storageRequest(() => store.getCandidateConversation(auth.account.profileId, action.conversationId), "account_chat_unavailable");
        if (!conversation) return jsonResponse(404, { ok: false, error: "conversation_not_found" }, origin);
        if (action.type === "listMessages") {
          const rows = await storageRequest(() => store.listConversationMessages(conversation.conversationId, action.limit), "account_chat_unavailable");
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, conversation: publicConversation(conversation, "candidate"), messages: rows.map(publicMessage) }, origin);
        }
        const now = nowProvider();
        if (action.type === "sendMessage") {
          if (conversation.state !== "open") return jsonResponse(409, { ok: false, error: "conversation_closed" }, origin);
          const message = await storageRequest(() => store.writeMessage({
            candidateProfileId: auth.account.profileId, conversationId: conversation.conversationId,
            messageId: createMessageId(identitySecret, conversation.conversationId, "candidate", action.clientMessageId),
            clientMessageId: action.clientMessageId, senderType: "candidate", text: action.text,
            createdAt: now, purgeAt: plusMs(now, CHAT_RETENTION_MS)
          }), "account_chat_unavailable");
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, message: publicMessage(message) }, origin);
        }
        if (action.type === "markConversationRead") {
          await storageRequest(() => store.markConversationRead(auth.account.profileId, conversation.conversationId, "candidate", now), "account_chat_unavailable");
          return jsonResponse(200, { ok: true, read: true }, origin);
        }
        await storageRequest(() => store.setConversationState(auth.account.profileId, conversation.conversationId, "candidate", action.state, now, plusMs(now, CHAT_RETENTION_MS)), "account_chat_unavailable");
        return jsonResponse(200, { ok: true, state: action.state }, origin);
      }
      if (["listInvitations", "markInvitationViewed", "respondInvitation"].includes(body.action)) {
        const action = validateCandidateInvitationAction(body, ACCOUNT_API_VERSION);
        if (action.type === "listInvitations") {
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION,
            invitationEnabled: settings.employer_invitation_enabled === "true",
            invitations: await loadCandidateInvitations(auth.account.profileId, settings) }, origin);
        }
        if (settings.employer_invitation_enabled !== "true") return jsonResponse(403, { ok: false, error: "employer_invitation_closed" }, origin);
        if (typeof store.getCandidateInvitation !== "function") throw new Error("account_invitation_unavailable");
        const now = nowProvider();
        let invitation = await storageRequest(() => store.getCandidateInvitation(auth.account.profileId, action.invitationId), "account_invitation_unavailable");
        if (!invitation) return jsonResponse(404, { ok: false, error: "invitation_not_found" }, origin);
        const effectiveStatus = effectiveInvitationStatus(invitation, now);
        if (effectiveStatus === "expired") return jsonResponse(409, { ok: false, error: "invitation_expired" }, origin);
        if (action.type === "markInvitationViewed") {
          if (invitation.status === "sent") {
            if (typeof store.markInvitationViewed !== "function") throw new Error("account_invitation_unavailable");
            invitation = await storageRequest(() => store.markInvitationViewed(auth.account.profileId, action.invitationId, now), "account_invitation_unavailable");
          }
          return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, invitation: publicCandidateInvitation(invitation, now) }, origin);
        }
        if (!OPEN_INVITATION_STATUSES.has(invitation.status) || invitation.status === "interested" || invitation.status === "details") {
          if (invitation.status === action.response) {
            if (["interested", "details"].includes(action.response)) await ensureCandidateConversations(auth.account.profileId, settings);
            return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, invitation: publicCandidateInvitation(invitation, now) }, origin);
          }
          return jsonResponse(409, { ok: false, error: "invitation_already_responded" }, origin);
        }
        if (typeof store.respondInvitation !== "function") throw new Error("account_invitation_unavailable");
        invitation = await storageRequest(() => store.respondInvitation(auth.account.profileId, action.invitationId, action.response, now), "account_invitation_unavailable");
        if (["interested", "details"].includes(action.response)) await ensureCandidateConversations(auth.account.profileId, settings);
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, invitation: publicCandidateInvitation(invitation, now) }, origin);
      }
      if (body.action === "updateProfile") {
        const update = validateUpdate(body);
        if (update.visibility === "discoverable" && settings.profile_publication_enabled !== "true") {
          return jsonResponse(403, { ok: false, error: "profile_publication_closed" }, origin);
        }
        const now = nowProvider();
        const wasAvailable = auth.account.jobStatus === "active" || auth.account.jobStatus === "open";
        const isAvailable = update.jobStatus === "active" || update.jobStatus === "open";
        const acceptedCurrentConsent = update.accountConsent === ACCOUNT_CONSENT_VERSION;
        const availabilityConfirmedAt = isAvailable
          ? ((!wasAvailable || update.confirmAvailability) ? now : (validDate(auth.account.availabilityConfirmedAt) || now))
          : new Date(0);
        await store.updateProfile(auth.account.profileId, {
          ...update,
          currentRole: update.currentRole === undefined ? auth.account.currentRole : update.currentRole,
          targetRole: update.targetRole === undefined ? auth.account.targetRole : update.targetRole,
          experienceSummary: update.experienceSummary === undefined ? auth.account.experienceSummary : update.experienceSummary,
          professionalTools: update.professionalTools === undefined ? auth.account.professionalTools : update.professionalTools,
          availabilityConfirmedAt,
          accountConsentVersion: acceptedCurrentConsent ? ACCOUNT_CONSENT_VERSION : auth.account.accountConsentVersion,
          accountConsentedAt: acceptedCurrentConsent ? now : auth.account.accountConsentedAt,
          publicConsentVersion: update.publicConsent,
          publicConsentedAt: update.visibility === "discoverable" ? now : new Date(0),
          updatedAt: now,
          purgeAt: plusMs(now, ACCOUNT_RETENTION_MS)
        });
        const account = await store.getAccountByProfileId(auth.account.profileId);
        const attempts = await store.listProfileAttempts(account.profileId);
        return jsonResponse(200, { ok: true, apiVersion: ACCOUNT_API_VERSION, profile: publicProfile(account, attempts),
          selfServiceEnabled: settings.account_self_service_enabled === "true",
          testAccess: buildTestAccess(attempts, now, settings.account_self_service_enabled === "true") }, origin);
      }
      if (body.action === "logout") {
        validateSimpleAction(body, "logout");
        await store.deleteSession(auth.account.profileId, auth.tokenHash);
        return jsonResponse(200, { ok: true }, origin);
      }
      if (body.action === "deleteAccount") {
        validateDelete(body);
        if (typeof store.deleteCandidateChats === "function") await storageRequest(() => store.deleteCandidateChats(auth.account.profileId), "account_delete_unavailable");
        if (typeof store.deleteAllCandidateCredentials === "function") await storageRequest(() => store.deleteAllCandidateCredentials(auth.account.profileId), "account_delete_unavailable");
        await store.deleteAccount(auth.account.profileId);
        return jsonResponse(200, { ok: true, deleted: true }, origin);
      }
      return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
    } catch (error) {
      const clientErrors = new Set(["invalid_request", "exchange_invalid", "invalid_exchange", "getProfile_invalid", "update_invalid", "invalid_profile", "invalid_credential", "invalid_chat_request", "invalid_chat_message", "contact_sharing_closed", "public_alias_required", "public_consent_required", "invalid_public_consent", "account_consent_required", "invalid_account_consent", "delete_invalid", "invalid_delete_confirmation"]);
      const serviceErrors = new Set(["identity_token_unavailable", "identity_token_invalid_response", "identity_profile_unavailable", "identity_profile_invalid_response", "account_lookup_unavailable", "account_write_unavailable", "account_attempts_unavailable", "account_session_unavailable", "account_invitation_unavailable", "account_credentials_unavailable", "account_chat_unavailable", "account_delete_unavailable"]);
      const errorCode = String(error && error.message || "");
      if (error instanceof SyntaxError || clientErrors.has(errorCode)) {
        return jsonResponse(400, { ok: false, error: "invalid_request" }, origin);
      }
      if (serviceErrors.has(errorCode)) return jsonResponse(503, { ok: false, error: errorCode }, origin);
      return jsonResponse(503, { ok: false, error: "account_temporarily_unavailable" }, origin);
    }
  };
}

module.exports = { createAccountHandler, jsonResponse, publicCandidateInvitation, publicProfile, buildTestAccess };
