"use strict";

const crypto = require("node:crypto");

const ASSESSMENT_API_VERSION = "attempt-v2";
const ASSESSMENT_BACKEND_VERSION = "yandex-cloud-assessment-2026-07-31-v5-review1";
const PRIVACY_CONSENT_VERSION = "skillcheck-pd-consent-2026-07-29-v4";
const AUTHORITATIVE_SCORING_VERSION = "authoritative-v1";
const SCORE_VERIFICATION_SERVER = "server-verified";
const TELEMETRY_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
const SUCCESS_THRESHOLD = 80;
const ATTEMPT_ACTIVE_TTL_MS = 6 * 60 * 60 * 1000;
const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_AND_SESSION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RESULT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const AUDIT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_POST_BODY_CHARS = 250000;
const MAX_ANSWERS = 40;
const RESULT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const TESTS = Object.freeze({
  "fa-junior": Object.freeze({ title: "Financial Analyst Junior", testVersion: "FA Junior v5.0", bankVersion: "FA Junior v5.0", questions: 40, attempt: 40, prefix: "FA" }),
  "ca-junior": Object.freeze({ title: "Credit Analyst Junior", testVersion: "CA Junior v5.0", bankVersion: "CA Junior v5.0", questions: 80, attempt: 40, prefix: "CA" }),
  "fpa-junior": Object.freeze({ title: "FP&A / Budget Analyst Junior", testVersion: "FP&A Junior v5.0", bankVersion: "FP&A Junior v5.0", questions: 40, attempt: 40, prefix: "FPA" }),
  "acc-junior": Object.freeze({ title: "Accounting / Reporting Junior", testVersion: "ACC Junior v5.0", bankVersion: "ACC Junior v5.0", questions: 40, attempt: 40, prefix: "ACC" }),
  "bi-junior": Object.freeze({ title: "Finance BI / Data Analyst Junior", testVersion: "BI Junior v5.0", bankVersion: "BI Junior v5.0", questions: 40, attempt: 40, prefix: "BI" })
});

const ALLOWED_ENGLISH_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const ALLOWED_CANDIDATE_SOURCES = new Set(["HH.ru", "Telegram", "LinkedIn", "Знакомый / рекомендация", "Работодатель", "Другое"]);
const ALLOWED_CANDIDATE_EXPERIENCE = new Set(["Нет опыта", "Стажировка", "До 6 месяцев", "6-12 месяцев", "1+ год"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, keys, label) {
  if (!isPlainObject(value) || Object.keys(value).sort().join(",") !== keys.slice().sort().join(",")) {
    throw publicError("invalid_request", "Некорректный формат запроса " + label + ".");
  }
}

function publicError(code, message) {
  const error = new Error(String(code || "invalid_request"));
  error.publicRequestError = true;
  error.failureCode = String(code || "invalid_request");
  error.publicMessage = String(message || "Некорректный запрос.");
  return error;
}

function parseBody(event) {
  let body = event && event.body;
  if (event && event.isBase64Encoded === true && typeof body === "string") {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  if (isPlainObject(body)) return body;
  if (typeof body !== "string" || body.length < 2 || body.length > MAX_POST_BODY_CHARS) {
    throw publicError("invalid_request", "Некорректный формат запроса.");
  }
  try {
    const parsed = JSON.parse(body);
    if (!isPlainObject(parsed)) throw new Error("not_object");
    return parsed;
  } catch (_error) {
    throw publicError("invalid_request", "Некорректный формат запроса.");
  }
}

function boundedText(value, max, required, label) {
  const text = String(value == null ? "" : value).trim();
  if ((required && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw publicError("invalid_field", "Проверьте поле «" + label + "».");
  }
  return text;
}

function validateEmail(value) {
  const email = boundedText(value, 254, true, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw publicError("invalid_email", "Проверьте email.");
  return email;
}

function validateFingerprint(value) {
  const fingerprint = boundedText(value, 200, true, "Идентификатор браузера");
  if (!/^[a-f0-9]{8}$/.test(fingerprint.toLowerCase())) {
    throw publicError("invalid_fingerprint", "Не удалось проверить браузерную сессию.");
  }
  return fingerprint.toLowerCase();
}

function validateEnum(value, allowed, label) {
  const text = String(value || "");
  if (!allowed.has(text)) throw publicError("invalid_field", "Проверьте поле «" + label + "».");
  return text;
}

function validateTelegram(value) {
  const text = boundedText(value, 100, false, "Telegram");
  if (text && !/^@[A-Za-z0-9_]{5,32}$/.test(text)) throw publicError("invalid_telegram", "Проверьте Telegram.");
  return text;
}

function validateTestId(value) {
  const testId = String(value || "");
  if (!Object.prototype.hasOwnProperty.call(TESTS, testId)) throw publicError("unsupported_test", "Тест недоступен.");
  return testId;
}

function normalizeInviteCode(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");
  return /^SC1[A-F0-9]{32}$/.test(normalized) ? normalized : "";
}

function validateBeginRequest(value) {
  assertExactKeys(value, [
    "action", "apiVersion", "beginRequestId", "testId", "inviteCode", "email",
    "browserFingerprint", "clientBuild", "privacyConsent", "privacyConsentVersion", "ageConfirmed"
  ], "beginAttempt");
  if (value.action !== "beginAttempt" || value.apiVersion !== ASSESSMENT_API_VERSION) {
    throw publicError("client_upgrade_required", "Версия страницы устарела. Обновите страницу.");
  }
  const beginRequestId = String(value.beginRequestId || "").trim();
  if (!/^scb_[a-z0-9]{24,40}$/.test(beginRequestId)) throw publicError("invalid_begin_request_id", "Некорректный идентификатор начала попытки.");
  const inviteCode = normalizeInviteCode(value.inviteCode);
  if (!inviteCode) throw publicError("attempt_unavailable", "Попытка недоступна.");
  if (value.privacyConsent !== true || value.ageConfirmed !== true || value.privacyConsentVersion !== PRIVACY_CONSENT_VERSION) {
    throw publicError("privacy_consent_required", "Обновите страницу и подтвердите актуальное согласие.");
  }
  return {
    beginRequestId,
    testId: validateTestId(value.testId),
    inviteCode,
    email: validateEmail(value.email),
    browserFingerprint: validateFingerprint(value.browserFingerprint),
    clientBuild: boundedText(value.clientBuild, 100, true, "Версия страницы"),
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true
  };
}

function validateAnswers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ANSWERS) {
    throw publicError("invalid_answers", "Ответы имеют неверный формат.");
  }
  const seen = new Set();
  return value.map(source => {
    assertExactKeys(source, ["questionId", "optionId", "timedOut", "timeSpent"], "answer");
    const questionId = String(source.questionId || "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(questionId) || seen.has(questionId)) throw publicError("invalid_answer", "Один из ответов имеет неверный формат.");
    seen.add(questionId);
    const optionId = source.optionId === null ? null : String(source.optionId || "");
    if (optionId !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(optionId)) throw publicError("invalid_answer", "Один из ответов имеет неверный формат.");
    const timeSpent = Number(source.timeSpent);
    if (typeof source.timedOut !== "boolean" || !Number.isFinite(timeSpent) || timeSpent < 0 || timeSpent > 3600) {
      throw publicError("invalid_answer", "Один из ответов имеет неверный формат.");
    }
    return { questionId, optionId, timedOut: source.timedOut, timeSpent };
  });
}

function validateSaveRequest(value) {
  assertExactKeys(value, [
    "action", "apiVersion", "requestId", "attemptId", "attemptToken", "testId", "bankVersion",
    "name", "email", "telegram", "englishLevel", "candidateSource", "candidateExperience",
    "employerShareConsent", "browserFingerprint", "tabSwitches", "clientBuild", "answers",
    "privacyConsentVersion", "ageConfirmed"
  ], "saveResult");
  if (value.action !== "saveResult" || value.apiVersion !== ASSESSMENT_API_VERSION) {
    throw publicError("client_upgrade_required", "Версия страницы устарела. Обновите страницу.");
  }
  const requestId = String(value.requestId || "").trim();
  const attemptId = String(value.attemptId || "").trim();
  const attemptToken = String(value.attemptToken || "").trim();
  if (!/^scs_[a-z0-9]{24,40}$/.test(requestId)) throw publicError("invalid_request_id", "Некорректный идентификатор отправки.");
  if (!/^att_[a-f0-9]{32,64}$/.test(attemptId) || attemptToken.length < 80 || attemptToken.length > 3000 || attemptToken.split(".").length !== 3) {
    throw publicError("invalid_attempt", "Некорректная попытка.");
  }
  const testId = validateTestId(value.testId);
  if (value.bankVersion !== TESTS[testId].bankVersion) throw publicError("unsupported_test_version", "Версия теста устарела. Обновите страницу.");
  if (value.employerShareConsent !== false) throw publicError("employer_sharing_unavailable", "Передача работодателю в текущем MVP выключена.");
  if (value.privacyConsentVersion !== PRIVACY_CONSENT_VERSION || value.ageConfirmed !== true) {
    throw publicError("privacy_consent_required", "Обновите страницу и подтвердите актуальное согласие.");
  }
  const tabSwitches = Number(value.tabSwitches);
  if (!Number.isInteger(tabSwitches) || tabSwitches < 0 || tabSwitches > 1000) throw publicError("invalid_field", "Проверьте количество уходов со вкладки.");
  return {
    requestId,
    attemptId,
    attemptToken,
    testId,
    bankVersion: TESTS[testId].bankVersion,
    name: boundedText(value.name, 120, true, "Имя"),
    email: validateEmail(value.email),
    telegram: validateTelegram(value.telegram),
    englishLevel: validateEnum(value.englishLevel, ALLOWED_ENGLISH_LEVELS, "Уровень английского"),
    candidateSource: validateEnum(value.candidateSource, ALLOWED_CANDIDATE_SOURCES, "Источник кандидата"),
    candidateExperience: validateEnum(value.candidateExperience, ALLOWED_CANDIDATE_EXPERIENCE, "Опыт кандидата"),
    employerShareConsent: false,
    browserFingerprint: validateFingerprint(value.browserFingerprint),
    tabSwitches,
    clientBuild: boundedText(value.clientBuild, 100, true, "Версия страницы"),
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    ageConfirmed: true,
    answers: validateAnswers(value.answers)
  };
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", String(secret)).update(String(value), "utf8").digest("hex");
}

function timingSafeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashInviteCode(secret, inviteCode) {
  return hmacHex(secret, "invite-code-v1|" + normalizeInviteCode(inviteCode));
}

function hashIdentity(secret, testId, email) {
  return hmacHex(secret, "identity-v1|" + testId + "|" + String(email || "").trim().toLowerCase());
}

function hashFingerprint(secret, testId, fingerprint) {
  return hmacHex(secret, "fingerprint-v1|" + testId + "|" + String(fingerprint || "").trim().toLowerCase());
}

function maskEmail(email) {
  const parts = String(email || "").trim().toLowerCase().split("@");
  return parts.length === 2 ? (parts[0].charAt(0) || "*") + "***@" + parts[1] : "***";
}

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(Number(length) / 2)).toString("hex").slice(0, Number(length));
}

function buildDeterministicInviteCode(secret, inviteId, testId, identityHash) {
  const raw = hmacHex(secret, "invite-value-v1|" + inviteId + "|" + testId + "|" + identityHash).slice(0, 32).toUpperCase();
  return "SC1-" + raw.match(/.{1,4}/g).join("-");
}

function questionSetHash(testId, bankVersion, questionIds) {
  return sha256Hex("question-set-v1|" + testId + "|" + bankVersion + "|" + questionIds.join("|"));
}

function signAttemptToken(session, secret) {
  const header = { alg: "HS256", kid: "attempt-v2", typ: "SC-ATTEMPT" };
  const claims = {
    v: 2,
    attemptId: session.attemptId,
    jti: session.tokenJti,
    tid: session.testId,
    bv: session.bankVersion,
    qsh: session.questionSetHash,
    pcv: session.privacyConsentVersion,
    iat: Math.floor(new Date(session.tokenIssuedAt).getTime() / 1000),
    exp: Math.floor(new Date(session.tokenExpiresAt).getTime() / 1000)
  };
  const input = Buffer.from(JSON.stringify(header)).toString("base64url") + "." + Buffer.from(JSON.stringify(claims)).toString("base64url");
  return input + "." + crypto.createHmac("sha256", secret).update(input, "utf8").digest("base64url");
}

function verifyAttemptToken(token, secret, options) {
  try {
    const segments = String(token || "").split(".");
    if (segments.length !== 3 || segments.some(segment => !/^[A-Za-z0-9_-]+$/.test(segment))) return { valid: false };
    const input = segments[0] + "." + segments[1];
    const expected = crypto.createHmac("sha256", secret).update(input, "utf8").digest("base64url");
    if (!timingSafeEqual(expected, segments[2])) return { valid: false };
    const header = JSON.parse(Buffer.from(segments[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    assertExactKeys(header, ["alg", "kid", "typ"], "token_header");
    assertExactKeys(claims, ["attemptId", "bv", "exp", "iat", "jti", "pcv", "qsh", "tid", "v"], "token_claims");
    const nowMs = options && options.now instanceof Date ? options.now.getTime() : Date.now();
    const allowExpired = Boolean(options && options.allowExpired);
    if (header.alg !== "HS256" || header.kid !== "attempt-v2" || header.typ !== "SC-ATTEMPT" || claims.v !== 2 ||
        !/^att_[a-f0-9]{32,64}$/.test(String(claims.attemptId || "")) || !/^[a-f0-9]{32,64}$/.test(String(claims.jti || "")) ||
        !/^[a-f0-9]{64}$/.test(String(claims.qsh || "")) || claims.pcv !== PRIVACY_CONSENT_VERSION ||
        !Object.prototype.hasOwnProperty.call(TESTS, String(claims.tid || "")) || TESTS[claims.tid].bankVersion !== claims.bv ||
        !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) || claims.exp <= claims.iat ||
        claims.iat > Math.floor(nowMs / 1000) + 60 || (!allowExpired && claims.exp <= Math.floor(nowMs / 1000))) return { valid: false };
    return { valid: true, header, claims };
  } catch (_error) {
    return { valid: false };
  }
}

function buildPublicBank(privateBank) {
  return {
    schemaVersion: Number(privateBank.schemaVersion),
    testId: String(privateBank.testId),
    testVersion: String(privateBank.testVersion),
    bankVersion: String(privateBank.bankVersion),
    questionsPerAttempt: Number(privateBank.questionsPerAttempt),
    blocks: JSON.parse(JSON.stringify(privateBank.blocks || {})),
    questions: privateBank.questions.map(question => ({
      id: String(question.id), topic: String(question.topic || ""), block: String(question.block),
      difficulty: String(question.difficulty), timeLimit: Number(question.timeLimit), points: Number(question.points),
      text: String(question.text), context: String(question.context || ""),
      options: question.options.map(option => ({ id: String(option.id), text: String(option.text) }))
    }))
  };
}

function validatePrivateBank(bank, expectedDigest) {
  if (!isPlainObject(bank) || bank.schemaVersion !== 2) throw new Error("invalid_private_bank");
  const testId = validateTestId(bank.testId);
  const config = TESTS[testId];
  if (bank.testVersion !== config.testVersion || bank.bankVersion !== config.bankVersion ||
      bank.questionsPerAttempt !== config.attempt || !Array.isArray(bank.questions) || bank.questions.length !== config.questions || !isPlainObject(bank.blocks)) {
    throw new Error("invalid_private_bank_metadata");
  }
  const seenQuestions = new Set();
  const seenOptions = new Set();
  bank.questions.forEach(question => {
    if (!isPlainObject(question) || !/^[A-Za-z0-9_-]{1,64}$/.test(String(question.id || "")) || seenQuestions.has(question.id) ||
        !Array.isArray(question.options) || question.options.length !== 4 || typeof question.correctOptionId !== "string" ||
        typeof question.comment !== "string" || question.comment.length > 5000) throw new Error("invalid_private_bank_question");
    seenQuestions.add(question.id);
    const localOptions = new Set();
    let previous = "";
    question.options.forEach(option => {
      const id = String(option && option.id || "");
      if (!/^opt_[a-f0-9]{20}$/.test(id) || localOptions.has(id) || seenOptions.has(id) || (previous && id <= previous) ||
          typeof option.text !== "string" || !option.text || option.text.length > 1200) throw new Error("invalid_private_bank_option");
      localOptions.add(id); seenOptions.add(id); previous = id;
    });
    if (!localOptions.has(question.correctOptionId)) throw new Error("invalid_private_bank_answer");
  });
  const publicDigest = sha256Hex(JSON.stringify(buildPublicBank(bank)));
  if (!timingSafeEqual(String(bank.publicDigest || ""), publicDigest)) throw new Error("private_bank_public_digest_mismatch");
  const privateDigest = sha256Hex(JSON.stringify(bank));
  if (expectedDigest && !timingSafeEqual(expectedDigest, privateDigest)) throw new Error("private_bank_digest_mismatch");
  return { bank, privateDigest, publicDigest };
}

function selectQuestionIds(bank, attemptId, nonce) {
  const groups = new Map();
  bank.questions.forEach(question => {
    const block = String(question.block || "");
    if (!groups.has(block)) groups.set(block, []);
    groups.get(block).push(String(question.id));
  });
  const allocations = Array.from(groups.entries()).map(([block, ids]) => {
    const exact = bank.questionsPerAttempt * ids.length / bank.questions.length;
    return { block, ids, quota: Math.floor(exact), remainder: exact - Math.floor(exact), tie: sha256Hex("selection-block-v2|" + attemptId + "|" + nonce + "|" + block) };
  });
  let remaining = bank.questionsPerAttempt - allocations.reduce((sum, item) => sum + item.quota, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.tie.localeCompare(b.tie) || a.block.localeCompare(b.block));
  allocations.forEach(item => { if (remaining > 0 && item.quota < item.ids.length) { item.quota += 1; remaining -= 1; } });
  if (remaining !== 0) throw new Error("question_allocation_failed");
  const selected = [];
  allocations.forEach(item => {
    item.ids.sort((a, b) => sha256Hex("selection-question-v2|" + attemptId + "|" + nonce + "|" + a)
      .localeCompare(sha256Hex("selection-question-v2|" + attemptId + "|" + nonce + "|" + b)) || a.localeCompare(b));
    selected.push(...item.ids.slice(0, item.quota));
  });
  return selected.sort((a, b) => sha256Hex("selection-order-v2|" + attemptId + "|" + nonce + "|" + a)
    .localeCompare(sha256Hex("selection-order-v2|" + attemptId + "|" + nonce + "|" + b)) || a.localeCompare(b));
}

function calculateScore(request, session, bank) {
  const expectedIds = JSON.parse(JSON.stringify(session.questionIds || []));
  if (request.answers.length !== expectedIds.length || expectedIds.length !== TESTS[request.testId].attempt) throw publicError("invalid_answers_count", "Количество ответов не соответствует попытке.");
  const answers = new Map(request.answers.map(answer => [answer.questionId, answer]));
  if (answers.size !== expectedIds.length || expectedIds.some(id => !answers.has(id))) throw publicError("question_set_mismatch", "Набор вопросов не соответствует попытке.");
  const questions = new Map(bank.questions.map(question => [String(question.id), question]));
  const blockTotals = Object.create(null);
  const answerDetails = [];
  let rawScore = 0;
  let rawTotal = 0;
  let unansweredCount = 0;
  expectedIds.forEach((questionId, index) => {
    const question = questions.get(questionId);
    const answer = answers.get(questionId);
    if (!question) throw publicError("question_set_mismatch", "Версия банка не соответствует попытке.");
    const options = new Map(question.options.map(option => [String(option.id), option]));
    if (answer.optionId !== null && !options.has(answer.optionId)) throw publicError("invalid_option", "Выбранный вариант не относится к вопросу.");
    const points = Number(question.points);
    const correct = answer.optionId !== null && answer.optionId === question.correctOptionId;
    const earned = correct ? points : 0;
    rawScore += earned; rawTotal += points;
    if (answer.optionId === null) unansweredCount += 1;
    if (!blockTotals[question.block]) blockTotals[question.block] = { earned: 0, total: 0 };
    blockTotals[question.block].earned += earned;
    blockTotals[question.block].total += points;
    answerDetails.push({
      number: index + 1, questionId, topic: String(question.topic || ""), block: String(question.block || ""), difficulty: String(question.difficulty || "medium"),
      question: String(question.text || ""), selectedAnswer: answer.optionId === null ? "Нет ответа" : String(options.get(answer.optionId).text),
      correctAnswer: String(options.get(question.correctOptionId).text), isCorrect: correct, timedOut: answer.timedOut,
      status: answer.optionId === null ? (answer.timedOut ? "Время вышло" : "Нет ответа") : (correct ? "Верно" : "Неверно"),
      points, earnedPoints: earned, timeLimit: Number(question.timeLimit), timeSpent: answer.timeSpent, comment: String(question.comment || "")
    });
  });
  const percent = rawTotal ? Math.round(rawScore * 100 / rawTotal) : 0;
  const finalScore = Math.max(0, Math.min(100, percent));
  const passStatus = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";
  const blockResults = Object.create(null);
  Object.keys(blockTotals).forEach(key => {
    const item = blockTotals[key];
    blockResults[key] = { name: String(bank.blocks[key] && bank.blocks[key].name || bank.blocks[key] || key), weight: rawTotal ? item.total / rawTotal : 0, earned: item.earned, total: item.total, percent: item.total ? Math.round(item.earned * 100 / item.total) : 0 };
  });
  return {
    result: {
      rawScore, rawTotal, unansweredCount, percent, finalScore, penalty: 0,
      advisoryPenalty: request.tabSwitches === 0 ? 0 : (request.tabSwitches === 1 ? 3 : (request.tabSwitches <= 3 ? 7 : 15)),
      tabSwitches: request.tabSwitches, trustScore: Math.max(0, Math.min(100, finalScore + (request.tabSwitches === 0 ? 5 : (request.tabSwitches <= 2 ? -2 : -8)) - (unansweredCount > 5 ? 5 : (unansweredCount > 2 ? 2 : 0)))),
      badge: finalScore >= 85 && request.tabSwitches <= 1 ? "Junior Strong" : (finalScore >= 70 && request.tabSwitches <= 2 ? "Junior Confirmed" : (finalScore >= 60 ? "Borderline" : "Not Confirmed")),
      passStatus, status: passStatus, decision: passStatus === "passed" ? "Успешно" : "Неуспешно", finalDecision: passStatus === "passed" ? "Успешно" : "Неуспешно",
      recommendation: request.tabSwitches > 2 ? "Результат требует осторожной интерпретации" : (finalScore >= 80 ? "Рекомендуется к интервью" : (finalScore >= 60 ? "Можно рассмотреть при наличии стажировки / junior-позиции" : "Не рекомендуется без дополнительной проверки")),
      blockResults, scoreVerification: SCORE_VERIFICATION_SERVER, scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
      telemetryVerification: TELEMETRY_VERIFICATION_CLIENT_REPORTED, reportCreated: false
    },
    answerDetails
  };
}

function generateResultCode(testId, randomBytes) {
  const config = TESTS[validateTestId(testId)];
  const bytes = randomBytes || crypto.randomBytes(5);
  let suffix = "";
  for (let index = 0; index < 5; index += 1) suffix += RESULT_CODE_ALPHABET[bytes[index] % RESULT_CODE_ALPHABET.length];
  return config.prefix + "-" + suffix;
}

module.exports = {
  ALLOWED_CANDIDATE_EXPERIENCE,
  ALLOWED_CANDIDATE_SOURCES,
  ALLOWED_ENGLISH_LEVELS,
  ASSESSMENT_API_VERSION,
  ASSESSMENT_BACKEND_VERSION,
  ATTEMPT_ACTIVE_TTL_MS,
  AUDIT_RETENTION_MS,
  AUTHORITATIVE_SCORING_VERSION,
  INVITE_AND_SESSION_RETENTION_MS,
  PRIVACY_CONSENT_VERSION,
  RECOVERY_TTL_MS,
  RESULT_RETENTION_MS,
  SCORE_VERIFICATION_SERVER,
  SUCCESS_THRESHOLD,
  TELEMETRY_VERIFICATION_CLIENT_REPORTED,
  TESTS,
  assertExactKeys,
  buildDeterministicInviteCode,
  buildPublicBank,
  calculateScore,
  generateResultCode,
  hashFingerprint,
  hashIdentity,
  hashInviteCode,
  hmacHex,
  isPlainObject,
  maskEmail,
  normalizeInviteCode,
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
};
