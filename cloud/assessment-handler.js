"use strict";

const {
  ASSESSMENT_API_VERSION,
  ASSESSMENT_BACKEND_VERSION,
  ATTEMPT_ACTIVE_TTL_MS,
  AUDIT_RETENTION_MS,
  AUTHORITATIVE_SCORING_VERSION,
  INVITE_AND_SESSION_RETENTION_MS,
  RECOVERY_TTL_MS,
  RESULT_RETENTION_MS,
  SCORE_VERIFICATION_SERVER,
  SUCCESS_THRESHOLD,
  TELEMETRY_VERIFICATION_CLIENT_REPORTED,
  TESTS,
  calculateScore,
  generateResultCode,
  hashFingerprint,
  hashIdentity,
  hashInviteCode,
  hmacHex,
  parseBody,
  publicError,
  questionSetHash,
  randomHex,
  selectQuestionIds,
  sha256Hex,
  signAttemptToken,
  timingSafeEqual,
  validateBeginRequest,
  validatePrivateBank,
  validateSaveRequest,
  verifyAttemptToken
} = require("./assessment-core");
const { TECHNICAL_RESULT_CODES } = require("./ranking-core");
const {
  RANKING_PROOF_API_VERSION,
  RANKING_PROOF_MAX_AGE_MS,
  RANKING_PROOF_VERSION,
  assertExactKeys
} = require("./ranking-profile-core");
const { resolveAllowedOrigin } = require("./cors-origin");
const { buildTxtReport } = require("./report-core");

const RETAKE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
const MAX_RESULT_CODE_ATTEMPTS = 12;

function getMethod(event) {
  return String(event && (
    event.httpMethod ||
    (event.requestContext && event.requestContext.http && event.requestContext.http.method)
  ) || "GET").toUpperCase();
}

function jsonResponse(statusCode, payload, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "X-Content-Type-Options": "nosniff"
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload)
  };
}

function plusMs(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isFinite(date.getTime()) ? date : null;
}

function unavailableResponse() {
  return {
    ok: false,
    status: "unavailable",
    retryable: false,
    failureCode: "attempt_unavailable",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    message: "Не удалось начать попытку. Проверьте приглашение или обратитесь к организатору."
  };
}

function conflictResponse() {
  return {
    ok: false,
    status: "error",
    retryable: false,
    failureCode: "submission_conflict",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    message: "Не удалось проверить целостность повторной отправки. Обновите страницу теста."
  };
}

function storageErrorResponse() {
  return {
    ok: false,
    status: "error",
    retryable: true,
    failureCode: "temporary_storage_error",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    message: "Сервис временно недоступен. Повторите действие позже."
  };
}

function validationResponse(error) {
  return {
    ok: false,
    status: "invalid_request",
    retryable: false,
    failureCode: String(error && error.failureCode || "invalid_request"),
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    message: String(error && error.publicMessage || "Запрос не прошёл проверку.")
  };
}

function buildBeginResponse(session, bank, signingSecret, resumed) {
  return {
    ok: true,
    status: "ready",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    apiVersion: ASSESSMENT_API_VERSION,
    attemptId: String(session.attemptId || ""),
    attemptToken: signAttemptToken(session, signingSecret),
    expiresAt: new Date(session.tokenExpiresAt).toISOString(),
    testId: String(session.testId || ""),
    testVersion: String(session.testVersion || ""),
    bankVersion: String(session.bankVersion || ""),
    publicDigest: String(bank.publicDigest || ""),
    questionIds: (session.questionIds || []).slice(),
    privacyConsentVersion: String(session.privacyConsentVersion || ""),
    privacyConsentedAt: new Date(session.privacyConsentedAt).toISOString(),
    resumed: Boolean(resumed)
  };
}

function buildSavedResponse(session, result, replayed) {
  const source = result || {};
  return {
    ok: true,
    status: "ok",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    apiVersion: ASSESSMENT_API_VERSION,
    attemptId: String(session.attemptId || ""),
    resultCode: String(session.resultCode || source.code || ""),
    code: String(session.resultCode || source.code || ""),
    testId: String(session.testId || source.testId || ""),
    bankVersion: String(session.bankVersion || source.bankVersion || ""),
    rawScore: Number(source.rawScore || 0),
    rawTotal: Number(source.rawTotal || 0),
    unansweredCount: Number(source.unansweredCount || 0),
    percent: Number(source.percent || 0),
    finalScore: Number(source.finalScore || 0),
    penalty: 0,
    advisoryPenalty: Number(source.advisoryPenalty || 0),
    tabSwitches: Number(source.tabSwitches || 0),
    trustScore: Number(source.trustScore || 0),
    badge: String(source.badge || ""),
    passStatus: source.passStatus === "passed" || source.status === "passed" ? "passed" : "failed",
    decision: String(source.decision || source.finalDecision || (source.status === "passed" ? "Успешно" : "Неуспешно")),
    finalDecision: String(source.finalDecision || source.decision || (source.status === "passed" ? "Успешно" : "Неуспешно")),
    recommendation: String(source.recommendation || ""),
    blockResults: source.blockResults || {},
    scoreVerification: SCORE_VERIFICATION_SERVER,
    scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
    telemetryVerification: TELEMETRY_VERIFICATION_CLIENT_REPORTED,
    privacyConsentVersion: String(session.privacyConsentVersion || source.privacyConsentVersion || ""),
    privacyConsentedAt: String(session.privacyConsentedAt || source.privacyConsentedAt || ""),
    reportCreated: source.reportCreated === true,
    replayed: Boolean(replayed),
    message: "Сохраните код результата: " + String(session.resultCode || source.code || "")
  };
}

function canonicalSubmission(request) {
  return {
    schemaVersion: 1,
    attemptId: request.attemptId,
    testId: request.testId,
    bankVersion: request.bankVersion,
    name: request.name,
    email: request.email,
    telegram: request.telegram,
    englishLevel: request.englishLevel,
    candidateSource: request.candidateSource,
    candidateExperience: request.candidateExperience,
    employerShareConsent: false,
    privacyConsentVersion: request.privacyConsentVersion,
    ageConfirmed: true,
    browserFingerprint: request.browserFingerprint,
    tabSwitches: request.tabSwitches,
    clientBuild: request.clientBuild,
    answers: request.answers.slice().sort((left, right) => left.questionId.localeCompare(right.questionId)).map(answer => ({
      questionId: answer.questionId,
      optionId: answer.optionId,
      timedOut: answer.timedOut,
      timeSpent: answer.timeSpent
    }))
  };
}

function submissionHash(request, signingSecret) {
  return hmacHex(signingSecret, "submission-v1|" + JSON.stringify(canonicalSubmission(request)));
}

function tokenMatchesSession(tokenResult, session) {
  if (!tokenResult || tokenResult.valid !== true || !session) return false;
  const claims = tokenResult.claims || {};
  const issued = validDate(session.tokenIssuedAt);
  const expires = validDate(session.tokenExpiresAt);
  return Boolean(issued && expires) &&
    claims.attemptId === session.attemptId &&
    claims.tid === session.testId &&
    claims.bv === session.bankVersion &&
    claims.pcv === session.privacyConsentVersion &&
    timingSafeEqual(claims.qsh, session.questionSetHash) &&
    timingSafeEqual(claims.jti, session.tokenJti) &&
    Number(claims.iat) === Math.floor(issued.getTime() / 1000) &&
    Number(claims.exp) === Math.floor(expires.getTime() / 1000);
}

function validateRankingProofRequest(value) {
  assertExactKeys(value, ["action", "apiVersion", "attemptId", "attemptToken", "resultCode"], "ranking_proof_request");
  const attemptId = String(value.attemptId || "");
  const attemptToken = String(value.attemptToken || "");
  const resultCode = String(value.resultCode || "").toUpperCase();
  if (value.action !== "rankingProof" || value.apiVersion !== RANKING_PROOF_API_VERSION ||
      !/^att_[a-f0-9]{32,64}$/.test(attemptId) || attemptToken.length < 80 || attemptToken.length > 3000 ||
      attemptToken.split(".").length !== 3 ||
      !/^(FA|CA|FPA|ACC|BI)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(resultCode)) {
    throw new Error("invalid_ranking_proof_request");
  }
  return { attemptId, attemptToken, resultCode };
}

function buildRankingProofUnavailableResponse() {
  return {
    ok: false,
    status: "unavailable",
    backendVersion: ASSESSMENT_BACKEND_VERSION,
    apiVersion: RANKING_PROOF_API_VERSION,
    failureCode: "ranking_proof_unavailable"
  };
}
function recentSessionBlocksRetake(session, now) {
  if (!session) return false;
  if (session.state === "active") {
    const expires = validDate(session.tokenExpiresAt);
    return Boolean(expires && now < expires);
  }
  if (session.state === "reserved") {
    const reserved = validDate(session.reservedAt);
    return Boolean(reserved && now >= reserved && now.getTime() - reserved.getTime() < RECOVERY_TTL_MS);
  }
  if (session.state !== "completed") return false;
  const completed = validDate(session.completedAt || session.startedAt);
  return Boolean(completed && now >= completed && now.getTime() - completed.getTime() < RETAKE_WINDOW_MS);
}

function resultSummaryFromRecord(record) {
  return {
    rawScore: record.rawScore,
    rawTotal: record.rawTotal,
    unansweredCount: record.unansweredCount,
    percent: record.percent,
    finalScore: record.finalScore,
    penalty: 0,
    advisoryPenalty: record.advisoryPenalty,
    tabSwitches: record.tabSwitches,
    trustScore: record.trustScore,
    badge: record.badge,
    passStatus: record.status,
    status: record.status,
    decision: record.status === "passed" ? "Успешно" : "Неуспешно",
    finalDecision: record.status === "passed" ? "Успешно" : "Неуспешно",
    recommendation: record.recommendation,
    blockResults: record.blockResults,
    scoreVerification: record.scoreVerification,
    scoringAlgorithmVersion: record.scoringAlgorithmVersion,
    telemetryVerification: record.telemetryVerification,
    reportCreated: record.reportCreated === true
  };
}

function assertDependencies(settings) {
  const store = settings.store;
  const bankStorage = settings.bankStorage;
  const reportStorage = settings.reportStorage;
  const requiredStoreMethods = [
    "getRuntimeSettings", "getBankMetadata", "getInviteByCodeHash", "getInviteById",
    "getSessionByInviteId", "getSessionByAttemptId", "listRecentSessions", "insertSession",
    "markInviteActive", "reserveSession", "completeSession", "completeInvite",
    "getResultByCode", "getResultByRequestId", "insertResult", "appendAudit"
  ];
  if (!store || requiredStoreMethods.some(method => typeof store[method] !== "function")) throw new Error("assessment_store_required");
  if (!bankStorage || typeof bankStorage.readJson !== "function") throw new Error("bank_storage_required");
  if (!reportStorage || typeof reportStorage.readText !== "function" || typeof reportStorage.writeText !== "function") {
    throw new Error("report_storage_required");
  }
  ["signingSecret", "identitySecret", "inviteSecret"].forEach(key => {
    if (typeof settings[key] !== "string" || settings[key].length < 32) throw new Error("assessment_secret_required");
  });
}

function createAssessmentHandler(dependencies) {
  const settings = dependencies || {};
  assertDependencies(settings);
  const store = settings.store;
  const bankStorage = settings.bankStorage;
  const reportStorage = settings.reportStorage;
  const signingSecret = settings.signingSecret;
  const identitySecret = settings.identitySecret;
  const inviteSecret = settings.inviteSecret;
  const allowedOrigins = settings.allowedOrigins || settings.allowedOrigin || "https://capssman.github.io";
  const nowProvider = typeof settings.now === "function" ? settings.now : () => new Date();

  async function loadBank(testId, bankVersion, context) {
    const metadata = await store.getBankMetadata(testId, bankVersion);
    if (!metadata || metadata.active !== true || !metadata.objectKey || !/^[a-f0-9]{64}$/.test(metadata.privateDigest) ||
        !/^[a-f0-9]{64}$/.test(metadata.publicDigest)) throw new Error("assessment_bank_unavailable");
    const bank = await bankStorage.readJson(metadata.objectKey, context);
    if (!bank) throw new Error("assessment_bank_unavailable");
    const validated = validatePrivateBank(bank, metadata.privateDigest);
    if (!timingSafeEqual(validated.publicDigest, metadata.publicDigest)) throw new Error("assessment_bank_public_digest_mismatch");
    return validated.bank;
  }

  async function audit(eventType, subjectHash, outcome, now) {
    try {
      await store.appendAudit({
        eventDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        eventId: "evt_" + randomHex(32),
        eventType,
        subjectHash: String(subjectHash || "system"),
        outcome: String(outcome || "ok"),
        createdAt: now,
        purgeAt: plusMs(now, AUDIT_RETENTION_MS)
      });
    } catch (_error) {
      // A temporary audit-write failure must not create a duplicate attempt or result.
    }
  }

  async function ensureInviteActive(invite, session, now) {
    if (invite.state !== "active" || invite.attemptId !== session.attemptId) {
      await store.markInviteActive(invite.inviteId, session.attemptId, now);
    }
    const confirmed = await store.getInviteById(invite.inviteId);
    if (!confirmed || confirmed.state !== "active" || confirmed.attemptId !== session.attemptId) {
      throw new Error("invite_activation_not_confirmed");
    }
  }

  async function beginAttempt(request, context) {
    const now = nowProvider();
    const runtimeSettings = await store.getRuntimeSettings();
    if (runtimeSettings.legal_pilot_approved !== "true" || runtimeSettings.attempt_issuance_enabled !== "true") {
      return unavailableResponse();
    }
    const codeHash = hashInviteCode(inviteSecret, request.inviteCode);
    const identityHash = hashIdentity(identitySecret, request.testId, request.email);
    const fingerprintHash = hashFingerprint(identitySecret, request.testId, request.browserFingerprint);
    const invite = await store.getInviteByCodeHash(codeHash);
    const inviteExpiry = invite && validDate(invite.expiresAt);
    if (!invite || invite.testId !== request.testId || !timingSafeEqual(invite.identityHash, identityHash) ||
        !["issued", "active"].includes(invite.state) || !inviteExpiry || now >= inviteExpiry) return unavailableResponse();

    let existing = await store.getSessionByInviteId(invite.inviteId);
    if (existing) {
      const expires = validDate(existing.tokenExpiresAt);
      if (existing.state !== "active" || existing.beginRequestId !== request.beginRequestId || existing.testId !== request.testId ||
          existing.privacyConsentVersion !== request.privacyConsentVersion || existing.ageConfirmed !== true || !expires || now >= expires ||
          !timingSafeEqual(existing.identityHash, identityHash) || !timingSafeEqual(existing.fingerprintHash, fingerprintHash)) {
        return unavailableResponse();
      }
      const bank = await loadBank(existing.testId, existing.bankVersion, context);
      await ensureInviteActive(invite, existing, now);
      await audit("attempt_resumed", identityHash, "ok", now);
      return buildBeginResponse(existing, bank, signingSecret, true);
    }

    if (!invite.allowRetake) {
      const recent = await store.listRecentSessions(request.testId, identityHash, plusMs(now, -RETAKE_WINDOW_MS));
      if (recent.some(session => recentSessionBlocksRetake(session, now))) return unavailableResponse();
    }

    const config = TESTS[request.testId];
    const bank = await loadBank(request.testId, config.bankVersion, context);
    const attemptId = "att_" + randomHex(32);
    const questionIds = selectQuestionIds(bank, attemptId, randomHex(32));
    if (questionIds.length !== config.attempt) throw new Error("question_selection_failed");
    const session = {
      attemptId,
      inviteId: invite.inviteId,
      beginRequestId: request.beginRequestId,
      state: "active",
      testId: request.testId,
      testVersion: config.testVersion,
      bankVersion: config.bankVersion,
      publicDigest: bank.publicDigest,
      questionIds,
      questionSetHash: questionSetHash(request.testId, config.bankVersion, questionIds),
      identityHash,
      fingerprintHash,
      tokenJti: randomHex(32),
      tokenIssuedAt: now,
      tokenExpiresAt: plusMs(now, ATTEMPT_ACTIVE_TTL_MS),
      startedAt: now,
      privacyConsentVersion: request.privacyConsentVersion,
      privacyConsentedAt: now,
      ageConfirmed: true,
      purgeAt: plusMs(now, INVITE_AND_SESSION_RETENTION_MS)
    };
    try {
      await store.insertSession(session);
    } catch (_error) {
      existing = await store.getSessionByInviteId(invite.inviteId);
      if (!existing || existing.beginRequestId !== request.beginRequestId) throw _error;
    }
    const confirmedSession = existing || session;
    await ensureInviteActive(invite, confirmedSession, now);
    await audit("attempt_started", identityHash, "ok", now);
    return buildBeginResponse(confirmedSession, bank, signingSecret, Boolean(existing));
  }

  async function chooseResultCode(testId) {
    for (let index = 0; index < MAX_RESULT_CODE_ATTEMPTS; index += 1) {
      const code = generateResultCode(testId);
      if (!await store.getResultByCode(code)) return code;
    }
    throw new Error("result_code_space_unavailable");
  }

  async function recoverStoredResult(session, request, hash, now) {
    const stored = await store.getResultByRequestId(request.requestId);
    if (!stored) return null;
    if (stored.attemptId !== session.attemptId || stored.bankVersion !== session.bankVersion ||
        !timingSafeEqual(stored.submissionHash, hash) || stored.scoreVerification !== SCORE_VERIFICATION_SERVER) {
      return conflictResponse();
    }
    const result = resultSummaryFromRecord(stored);
    await store.completeSession(session.attemptId, result, validDate(stored.completedAt) || now, plusMs(validDate(stored.completedAt) || now, INVITE_AND_SESSION_RETENTION_MS));
    await store.completeInvite(session.inviteId, session.attemptId, validDate(stored.completedAt) || now, plusMs(validDate(stored.completedAt) || now, INVITE_AND_SESSION_RETENTION_MS));
    const repaired = Object.assign({}, session, { state: "completed", resultCode: stored.code, result, completedAt: stored.completedAt });
    return buildSavedResponse(repaired, result, true);
  }

  async function persistReport(reportKey, reportText, context) {
    const write = await reportStorage.writeText(reportKey, reportText, context, {
      contentType: "text/plain; charset=utf-8",
      createOnly: true
    });
    if (write && write.created === false) {
      const existing = await reportStorage.readText(reportKey, context);
      if (existing === null || !timingSafeEqual(sha256Hex(existing), sha256Hex(reportText))) {
        throw new Error("report_recovery_conflict");
      }
    }
  }

  async function verifyRankingProof(request) {
    const now = nowProvider();
    const tokenResult = verifyAttemptToken(request.attemptToken, signingSecret, { now, allowExpired: true });
    if (!tokenResult.valid) return buildRankingProofUnavailableResponse();
    const session = await store.getSessionByAttemptId(request.attemptId);
    if (!session || session.state !== "completed" || session.resultCode !== request.resultCode ||
        session.testId === "dev-quick" || TECHNICAL_RESULT_CODES.has(request.resultCode) ||
        !tokenMatchesSession(tokenResult, session) || !/^[a-f0-9]{64}$/.test(String(session.identityHash || ""))) {
      return buildRankingProofUnavailableResponse();
    }
    const result = await store.getResultByCode(request.resultCode);
    const completedAt = validDate(result && result.completedAt || session.completedAt);
    const ageMs = completedAt ? now.getTime() - completedAt.getTime() : NaN;
    if (!result || result.attemptId !== session.attemptId || result.testId !== session.testId ||
        result.bankVersion !== session.bankVersion || result.status !== "passed" ||
        result.scoreVerification !== SCORE_VERIFICATION_SERVER || result.technical === true ||
        !Number.isFinite(Number(result.percent)) || Number(result.percent) < SUCCESS_THRESHOLD || Number(result.percent) > 100 ||
        !Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > RANKING_PROOF_MAX_AGE_MS) {
      return buildRankingProofUnavailableResponse();
    }
    return {
      ok: true,
      status: "verified",
      backendVersion: ASSESSMENT_BACKEND_VERSION,
      apiVersion: RANKING_PROOF_API_VERSION,
      proofVersion: RANKING_PROOF_VERSION,
      testId: session.testId,
      bankVersion: session.bankVersion,
      resultCode: request.resultCode,
      percent: Number(result.percent),
      completedAt: completedAt.toISOString(),
      passStatus: "passed",
      scoreVerification: SCORE_VERIFICATION_SERVER,
      rankingSubjectHandle: "rsh_" + hmacHex(identitySecret, "ranking-subject-v1|" + session.testId + "|" + session.identityHash),
      technical: false
    };
  }
  async function saveResult(request, context) {
    const now = nowProvider();
    const tokenResult = verifyAttemptToken(request.attemptToken, signingSecret, { now, allowExpired: true });
    if (!tokenResult.valid) return unavailableResponse();
    let session = await store.getSessionByAttemptId(request.attemptId);
    const identityHash = hashIdentity(identitySecret, request.testId, request.email);
    const fingerprintHash = hashFingerprint(identitySecret, request.testId, request.browserFingerprint);
    if (!session || session.testId !== request.testId || session.bankVersion !== request.bankVersion ||
        session.privacyConsentVersion !== request.privacyConsentVersion || session.ageConfirmed !== true ||
        !tokenMatchesSession(tokenResult, session) || !timingSafeEqual(session.identityHash, identityHash) ||
        !timingSafeEqual(session.fingerprintHash, fingerprintHash)) return unavailableResponse();

    const hash = submissionHash(request, signingSecret);
    if (session.state === "completed") {
      if (session.saveRequestId !== request.requestId || !timingSafeEqual(session.submissionHash, hash)) return conflictResponse();
      const completed = validDate(session.completedAt || session.reservedAt);
      if (!completed || now.getTime() - completed.getTime() > RECOVERY_TTL_MS) return unavailableResponse();
      await store.completeInvite(session.inviteId, session.attemptId, completed, plusMs(completed, INVITE_AND_SESSION_RETENTION_MS));
      return buildSavedResponse(session, session.result, true);
    }
    if (!["active", "reserved"].includes(session.state)) return unavailableResponse();
    if (session.state === "active" && now.getTime() >= Number(tokenResult.claims.exp) * 1000) return unavailableResponse();
    if (session.state === "reserved") {
      if (session.saveRequestId !== request.requestId || !timingSafeEqual(session.submissionHash, hash)) return conflictResponse();
      const reserved = validDate(session.reservedAt);
      if (!reserved || now.getTime() - reserved.getTime() > RECOVERY_TTL_MS) return unavailableResponse();
      const recovered = await recoverStoredResult(session, request, hash, now);
      if (recovered) return recovered;
    }

    const invite = await store.getInviteById(session.inviteId);
    if (!invite || invite.state !== "active" || invite.attemptId !== session.attemptId) return unavailableResponse();
    const bank = await loadBank(session.testId, session.bankVersion, context);
    if (!timingSafeEqual(session.publicDigest, bank.publicDigest)) throw new Error("session_bank_digest_mismatch");
    const calculated = calculateScore(request, session, bank);
    let result = calculated.result;
    let completedAt = validDate(session.completedAt);

    if (session.state === "active") {
      completedAt = now;
      const code = await chooseResultCode(session.testId);
      await store.reserveSession({
        attemptId: session.attemptId,
        saveRequestId: request.requestId,
        submissionHash: hash,
        reservedAt: now,
        completedAt,
        resultCode: code,
        result
      });
      session = await store.getSessionByAttemptId(session.attemptId);
      if (!session || session.state === "active") throw new Error("result_reservation_not_confirmed");
      if (session.saveRequestId !== request.requestId || !timingSafeEqual(session.submissionHash, hash)) return conflictResponse();
    } else {
      completedAt = validDate(session.completedAt || session.reservedAt);
      if (!completedAt || !session.resultCode || !session.result ||
          Number(session.result.rawScore) !== Number(result.rawScore) || Number(session.result.rawTotal) !== Number(result.rawTotal) ||
          Number(session.result.finalScore) !== Number(result.finalScore)) return conflictResponse();
    }

    const recovered = await recoverStoredResult(session, request, hash, now);
    if (recovered) return recovered;
    const reportObjectKey = result.passStatus === "passed" ? "reports/" + session.resultCode + ".txt" : "";
    if (reportObjectKey) {
      const report = buildTxtReport(Object.assign({}, request, result, {
        code: session.resultCode,
        testTitle: TESTS[session.testId].title,
        completedAt: completedAt.toISOString(),
        privacyConsentedAt: String(session.privacyConsentedAt),
        answerDetails: calculated.answerDetails
      }));
      await persistReport(reportObjectKey, report, context);
      result = Object.assign({}, result, { reportCreated: true });
    }

    const resultRecord = Object.assign({}, request, result, {
      code: session.resultCode,
      testTitle: TESTS[session.testId].title,
      answerDetails: calculated.answerDetails,
      submissionHash: hash,
      privacyConsentedAt: validDate(session.privacyConsentedAt),
      reportObjectKey,
      completedAt,
      technical: false,
      purgeAt: plusMs(completedAt, RESULT_RETENTION_MS)
    });
    try {
      await store.insertResult(resultRecord);
    } catch (_error) {
      const stored = await store.getResultByRequestId(request.requestId);
      if (!stored || stored.attemptId !== session.attemptId || !timingSafeEqual(stored.submissionHash, hash)) throw _error;
      result = resultSummaryFromRecord(stored);
    }
    await store.completeSession(session.attemptId, result, completedAt, plusMs(completedAt, INVITE_AND_SESSION_RETENTION_MS));
    await store.completeInvite(session.inviteId, session.attemptId, completedAt, plusMs(completedAt, INVITE_AND_SESSION_RETENTION_MS));
    const completedSession = Object.assign({}, session, { state: "completed", result, completedAt: completedAt.toISOString() });
    await audit("result_saved", identityHash, result.passStatus, completedAt);
    return buildSavedResponse(completedSession, result, false);
  }

  return async function assessmentHandler(event, context) {
    const allowedOrigin = resolveAllowedOrigin(event, allowedOrigins);
    const method = getMethod(event);
    if (method === "OPTIONS") return jsonResponse(204, {}, allowedOrigin);
    if (method === "GET") {
      return jsonResponse(200, {
        ok: true,
        backendVersion: ASSESSMENT_BACKEND_VERSION,
        apiVersion: ASSESSMENT_API_VERSION,
        storage: "yandex-cloud",
        candidateIssuance: "gated"
      }, allowedOrigin);
    }
    if (method !== "POST") {
      return jsonResponse(405, { ok: false, status: "method_not_allowed", failureCode: "method_not_allowed" }, allowedOrigin);
    }
    let body;
    try {
      body = parseBody(event);
      let payload;
      if (body.action === "beginAttempt") payload = await beginAttempt(validateBeginRequest(body), context);
      else if (body.action === "saveResult") payload = await saveResult(validateSaveRequest(body), context);
      else if (body.action === "rankingProof") payload = await verifyRankingProof(validateRankingProofRequest(body));
      else throw publicError("unsupported_action", "Действие не поддерживается.");
      return jsonResponse(200, payload, allowedOrigin);
    } catch (error) {
      if (error && error.publicRequestError) return jsonResponse(200, validationResponse(error), allowedOrigin);
      return jsonResponse(200, storageErrorResponse(), allowedOrigin);
    }
  };
}

module.exports = {
  MAX_RESULT_CODE_ATTEMPTS,
  RETAKE_WINDOW_MS,
  buildBeginResponse,
  buildSavedResponse,
  buildRankingProofUnavailableResponse,
  canonicalSubmission,
  conflictResponse,
  createAssessmentHandler,
  getMethod,
  jsonResponse,
  recentSessionBlocksRetake,
  resultSummaryFromRecord,
  storageErrorResponse,
  submissionHash,
  tokenMatchesSession,
  unavailableResponse,
  validationResponse
};
