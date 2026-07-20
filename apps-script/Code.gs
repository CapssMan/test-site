const BACKEND_VERSION = "yandex-disk-mvp-2026-07-20-7";
const SUCCESS_THRESHOLD = 80;
const RETAKE_WINDOW_DAYS = 21;
const RETAKE_WINDOW_MS = RETAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const RESERVATION_TTL_MS = 30 * 60 * 1000;
const MAX_ADMIN_REPORT_CHARS = 1000000;
const MAX_POST_BODY_CHARS = 250000;
const MAX_GENERATED_REPORT_CHARS = 200000;
const MAX_ANSWERS_PER_RESULT = 40;
const SCORE_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
const PUBLIC_DEV_TEST_ENABLED = false;
const DEFAULT_YANDEX_REPORTS_FOLDER = "disk:/skillcheck/reports";
const DEFAULT_YANDEX_ADMIN_FILE = "disk:/skillcheck/admin/results.json";
const DEFAULT_YANDEX_ATTEMPTS_FILE = "disk:/skillcheck/private/attempts.json";

const TEST_CODE_PREFIX = {
  "fa-junior": "FA",
  "ca-junior": "CA",
  "fpa-junior": "FPA",
  "acc-junior": "ACC",
  "bi-junior": "BI",
  "dev-quick": "DEV"
};

const TEST_TITLES_BY_ID = {
  "fa-junior": "Financial Analyst Junior",
  "ca-junior": "Credit Analyst Junior",
  "fpa-junior": "FP&A / Budget Analyst Junior",
  "acc-junior": "Accounting / Reporting Junior",
  "bi-junior": "Finance BI / Data Analyst Junior",
  "dev-quick": "Dev Quick Smoke Test"
};

const RETAKE_BYPASS_TEST_IDS = {
  "dev-quick": true
};

const EXPECTED_ANSWERS_BY_TEST_ID = {
  "fa-junior": 40,
  "ca-junior": 40,
  "fpa-junior": 40,
  "acc-junior": 40,
  "bi-junior": 40,
  "dev-quick": 1
};

const ALLOWED_ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ALLOWED_CANDIDATE_SOURCES = [
  "HH.ru",
  "Telegram",
  "LinkedIn",
  "Знакомый / рекомендация",
  "Работодатель",
  "Другое"
];
const ALLOWED_CANDIDATE_EXPERIENCE = [
  "Нет опыта",
  "Стажировка",
  "До 6 месяцев",
  "6-12 месяцев",
  "1+ год"
];

const TEST_VERSIONS_BY_ID = {
  "fa-junior": "FA Junior v2.3",
  "ca-junior": "CA Junior v1.0",
  "fpa-junior": "FP&A Junior v1.0",
  "acc-junior": "ACC Junior v1.0",
  "bi-junior": "BI Junior v1.0",
  "dev-quick": "DEV Quick v1.0"
};

const BANK_VERSIONS_BY_ID = {
  "fa-junior": "FA Junior v2.3",
  "ca-junior": "CA Junior v2.0",
  "fpa-junior": "FP&A Junior v2.0",
  "acc-junior": "ACC Junior v2.0",
  "bi-junior": "BI Junior v2.0",
  "dev-quick": "Dev Quick Smoke Test v1.0"
};

const ALLOWED_BLOCKS_BY_TEST_ID = {
  "fa-junior": ["excel", "finance", "reporting", "budget", "sql", "accounting"],
  "ca-junior": ["logic", "pnl", "balance", "cashflow", "debt", "excel", "cases", "final"],
  "fpa-junior": ["budget", "planfact", "forecast", "margin", "capex", "unit", "data", "commentary"],
  "acc-junior": ["entries", "assets", "revenue", "vat", "amort", "closing", "docs", "excel"],
  "bi-junior": ["sql", "joins", "dates", "model", "quality", "powerbi", "metrics", "business"],
  "dev-quick": ["smoke"]
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || "").trim();

  if (action === "checkAttempt") {
    return jsonResponse(methodNotAllowedResponse("Проверка попытки доступна только через POST."));
  }

  if (action === "health") {
    return jsonResponse(buildPublicHealthStatus());
  }

  if (action === "adminResults" || action === "adminReport") {
    return jsonResponse(methodNotAllowedResponse("Для административных операций требуется POST-запрос."));
  }

  return jsonResponse({
    ok: true,
    status: "ok",
    backendVersion: BACKEND_VERSION,
    message: "SkillCheck backend доступен."
  });
}

function doPost(e) {
  try {
    const data = parseRequestBody(e);
    const action = String(data.action || "").trim();

    if (action === "getAdminResults" || action === "adminResults") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "results");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(getAdminResults(String(data.password || "")));
    }

    if (action === "getAdminReport" || action === "adminReport") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "report");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(getAdminReport(String(data.password || ""), String(data.code || "")));
    }

    if (action === "checkAttempt") {
      const validatedAttempt = validateCheckAttemptRequest(data);
      if (!validatedAttempt.ok) return jsonResponse(validatedAttempt.response);
      const attemptLimit = consumeRateLimit(
        "check-attempt",
        validatedAttempt.data.testId + "|" + validatedAttempt.data.email + "|" + validatedAttempt.data.browserFingerprint,
        8,
        60
      );
      const globalAttemptLimit = consumeRateLimit("check-attempt-global", "shared", 120, 60);
      if (!attemptLimit.allowed || !globalAttemptLimit.allowed) {
        return jsonResponse(buildRateLimitedResponse(Math.max(attemptLimit.retryAfterSeconds, globalAttemptLimit.retryAfterSeconds)));
      }
      return jsonResponse(checkAttemptHash(
        validatedAttempt.data.testId,
        validatedAttempt.data.email,
        validatedAttempt.data.browserFingerprint
      ));
    }

    if (action === "saveResult") {
      const validatedResult = validateSubmissionRequest(data);
      if (!validatedResult.ok) return jsonResponse(validatedResult.response);
      const submissionLimit = consumeRateLimit("save-result", validatedResult.data.requestId, 6, 60);
      const globalSubmissionLimit = consumeRateLimit("save-result-global", "shared", 60, 60);
      if (!submissionLimit.allowed || !globalSubmissionLimit.allowed) {
        return jsonResponse(buildRateLimitedResponse(Math.max(submissionLimit.retryAfterSeconds, globalSubmissionLimit.retryAfterSeconds)));
      }
      return jsonResponse(saveTestResult(validatedResult.data));
    }

    return jsonResponse(buildValidationErrorResponse("unknown_action", "Неизвестное действие запроса."));
  } catch (error) {
    if (error && error.publicRequestError) {
      return jsonResponse(buildValidationErrorResponse(error.failureCode, error.publicMessage));
    }
    console.error("POST request failed before a safe response could be created.");
    return jsonResponse({
      ok: false,
      status: "error",
      retryable: true,
      failureCode: "request_processing_error",
      message: "Сервис временно не обработал запрос. Повторите отправку."
    });
  }
}

function buildPublicHealthStatus() {
  return {
    ok: true,
    status: "alive",
    service: "skillcheck-backend",
    backendVersion: BACKEND_VERSION
  };
}

function methodNotAllowedResponse(message) {
  return {
    ok: false,
    status: "method_not_allowed",
    retryable: false,
    failureCode: "method_not_allowed",
    backendVersion: BACKEND_VERSION,
    message: String(message || "Для этого действия требуется другой HTTP-метод.")
  };
}

function buildValidationErrorResponse(failureCode, message) {
  return {
    ok: false,
    status: "invalid_request",
    retryable: false,
    failureCode: String(failureCode || "invalid_request"),
    backendVersion: BACKEND_VERSION,
    message: String(message || "Запрос не прошёл проверку.")
  };
}

function buildRateLimitedResponse(retryAfterSeconds) {
  return {
    ok: false,
    status: "rate_limited",
    retryable: true,
    failureCode: "rate_limited",
    retryAfterSeconds: Math.max(1, Number(retryAfterSeconds || 60)),
    backendVersion: BACKEND_VERSION,
    message: "Слишком много запросов. Повторите действие немного позже."
  };
}

function publicRequestError(failureCode, message) {
  const error = new Error("Public request validation failed.");
  error.publicRequestError = true;
  error.failureCode = String(failureCode || "invalid_request");
  error.publicMessage = String(message || "Запрос не прошёл проверку.");
  return error;
}

function validateCheckAttemptRequest(data) {
  try {
    assertAllowedObjectKeys(data, ["action", "testId", "email", "browserFingerprint"], "checkAttempt");
    const testId = validateTestId(data.testId);
    assertPublicTestEnabled(testId);
    const email = validateEmail(data.email);
    const browserFingerprint = validateBrowserFingerprint(data.browserFingerprint);
    return {
      ok: true,
      data: {
        action: "checkAttempt",
        testId: testId,
        email: email,
        browserFingerprint: browserFingerprint
      }
    };
  } catch (error) {
    if (error && error.publicRequestError) {
      return { ok: false, response: buildValidationErrorResponse(error.failureCode, error.publicMessage) };
    }
    throw error;
  }
}

function validateSubmissionRequest(data) {
  try {
    assertAllowedObjectKeys(data, [
      "action", "requestId", "testId", "testVersion", "bankVersion", "testTitle",
      "name", "email", "telegram", "englishLevel", "candidateSource", "candidateExperience",
      "employerShareConsent", "browserFingerprint", "score", "total", "rawScore", "rawTotal",
      "unansweredCount", "percent", "finalScore", "penalty", "badge", "passStatus",
      "finalDecision", "recommendation", "tabSwitches", "trustScore", "blockResults", "answers"
    ], "saveResult");

    const requestId = normalizeSubmissionRequestId(data.requestId);
    if (!requestId) throw publicRequestError("invalid_request_id", "Некорректный идентификатор отправки.");

    const testId = validateTestId(data.testId);
    assertPublicTestEnabled(testId);
    const testVersion = validateBoundedText(data.testVersion, 100, true, "Версия теста");
    const bankVersion = validateBoundedText(data.bankVersion, 100, true, "Версия банка");
    if (testVersion !== TEST_VERSIONS_BY_ID[testId] || bankVersion !== BANK_VERSIONS_BY_ID[testId]) {
      throw publicRequestError("unsupported_test_version", "Версия теста устарела. Обновите страницу и начните новую попытку.");
    }

    const name = validateBoundedText(data.name, 120, true, "Имя");
    const email = validateEmail(data.email);
    const telegram = validateTelegramForRequest(data.telegram);
    const englishLevel = validateEnum(data.englishLevel, ALLOWED_ENGLISH_LEVELS, "Уровень английского");
    const candidateSource = validateEnum(data.candidateSource, ALLOWED_CANDIDATE_SOURCES, "Источник кандидата");
    const candidateExperience = validateEnum(data.candidateExperience, ALLOWED_CANDIDATE_EXPERIENCE, "Опыт кандидата");
    const employerShareConsent = validateBoolean(data.employerShareConsent, "Согласие на передачу работодателю");
    const browserFingerprint = validateBrowserFingerprint(data.browserFingerprint);
    const tabSwitches = validateInteger(data.tabSwitches, 0, 1000, "Количество уходов со вкладки");
    const answers = validateSubmissionAnswers(data.answers, testId);

    const rawTotal = answers.reduce((sum, answer) => sum + answer.points, 0);
    const rawScore = answers.reduce((sum, answer) => sum + answer.earnedPoints, 0);
    const percent = rawTotal > 0 ? Math.round(rawScore * 100 / rawTotal) : 0;
    const penalty = calculateServerPenalty(tabSwitches);
    const finalScore = Math.max(0, Math.min(100, percent - penalty));
    const unansweredCount = answers.filter(answer => answer.selectedAnswer === "Нет ответа").length;
    const trustScore = calculateServerTrustScore(finalScore, tabSwitches, unansweredCount);

    assertReportedNumber(data.rawTotal, rawTotal, "rawTotal");
    assertReportedNumber(data.rawScore, rawScore, "rawScore");
    assertReportedNumber(data.percent, percent, "percent");
    assertReportedNumber(data.score, percent, "score");
    assertReportedNumber(data.finalScore, finalScore, "finalScore");
    assertReportedNumber(data.penalty, penalty, "penalty");
    assertReportedNumber(data.unansweredCount, unansweredCount, "unansweredCount");
    assertReportedNumber(data.trustScore, trustScore, "trustScore");

    const status = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";
    const blockResults = buildValidatedBlockResults(answers, data.blockResults, rawTotal, testId);

    return {
      ok: true,
      data: {
        action: "saveResult",
        requestId: requestId,
        testId: testId,
        testVersion: testVersion,
        bankVersion: bankVersion,
        testTitle: TEST_TITLES_BY_ID[testId],
        name: name,
        email: email,
        telegram: telegram,
        englishLevel: englishLevel,
        candidateSource: candidateSource,
        candidateExperience: candidateExperience,
        employerShareConsent: employerShareConsent,
        browserFingerprint: browserFingerprint,
        score: percent,
        total: 100,
        rawScore: rawScore,
        rawTotal: rawTotal,
        unansweredCount: unansweredCount,
        percent: percent,
        finalScore: finalScore,
        penalty: penalty,
        badge: getAdminBadge(finalScore, tabSwitches),
        passStatus: status,
        finalDecision: status === "passed" ? "Успешно" : "Неуспешно",
        recommendation: getServerRecommendation(finalScore, percent, trustScore, tabSwitches),
        tabSwitches: tabSwitches,
        trustScore: trustScore,
        blockResults: blockResults,
        answers: answers,
        scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
      }
    };
  } catch (error) {
    if (error && error.publicRequestError) {
      return { ok: false, response: buildValidationErrorResponse(error.failureCode, error.publicMessage) };
    }
    throw error;
  }
}

function validateSubmissionAnswers(value, testId) {
  if (!Array.isArray(value)) throw publicRequestError("invalid_answers", "Ответы имеют неверный формат.");
  const expectedCount = EXPECTED_ANSWERS_BY_TEST_ID[testId];
  if (value.length !== expectedCount || value.length > MAX_ANSWERS_PER_RESULT) {
    throw publicRequestError("invalid_answers_count", "Количество ответов не соответствует тесту.");
  }

  const seenNumbers = Object.create(null);
  const seenQuestionIds = Object.create(null);
  return value.map((source, index) => {
    if (!isPlainObject(source)) throw publicRequestError("invalid_answer", "Один из ответов имеет неверный формат.");
    assertAllowedObjectKeys(source, [
      "number", "questionId", "topic", "block", "difficulty", "question", "selectedAnswer",
      "correctAnswer", "isCorrect", "timedOut", "status", "points", "earnedPoints",
      "timeLimit", "timeSpent", "comment"
    ], "answer");

    const number = validateInteger(source.number, 1, expectedCount, "Номер ответа");
    if (seenNumbers[number]) throw publicRequestError("duplicate_answer", "В ответах найден повтор номера вопроса.");
    seenNumbers[number] = true;

    const questionId = validateOptionalIdentifier(source.questionId, 64, "ID вопроса");
    if (questionId) {
      if (seenQuestionIds[questionId]) throw publicRequestError("duplicate_question", "В ответах найден повтор ID вопроса.");
      seenQuestionIds[questionId] = true;
    }

    const block = validateEnum(source.block, ALLOWED_BLOCKS_BY_TEST_ID[testId] || [], "Блок вопроса");
    const points = validateNumber(source.points, 0.01, 100, "Баллы вопроса");
    const isCorrect = validateBoolean(source.isCorrect, "Признак правильного ответа");
    const earnedPoints = validateNumber(source.earnedPoints, 0, points, "Полученные баллы");
    if ((isCorrect && earnedPoints !== points) || (!isCorrect && earnedPoints !== 0)) {
      throw publicRequestError("inconsistent_answer_score", "Баллы одного из ответов противоречат его статусу.");
    }

    const selectedAnswer = validateBoundedText(source.selectedAnswer, 500, true, "Ответ кандидата");
    if (selectedAnswer === "Нет ответа" && isCorrect) {
      throw publicRequestError("inconsistent_answer", "Неотвеченный вопрос не может быть отмечен как верный.");
    }

    const timedOut = validateBoolean(source.timedOut, "Признак таймаута");
    return {
      number: number,
      questionId: questionId,
      topic: validateBoundedText(source.topic, 120, false, "Тема вопроса"),
      block: block,
      difficulty: validateEnum(source.difficulty, ["easy", "medium", "hard", "calc", "case"], "Сложность вопроса"),
      question: validateBoundedText(source.question, 1000, true, "Текст вопроса"),
      selectedAnswer: selectedAnswer,
      correctAnswer: validateBoundedText(source.correctAnswer, 500, true, "Правильный ответ"),
      isCorrect: isCorrect,
      timedOut: timedOut,
      status: selectedAnswer === "Нет ответа" ? (timedOut ? "Время вышло" : "Нет ответа") : (isCorrect ? "Верно" : "Неверно"),
      points: points,
      earnedPoints: earnedPoints,
      timeLimit: validateNumber(source.timeLimit, 1, 600, "Лимит времени"),
      timeSpent: validateNumber(source.timeSpent, 0, 3600, "Время ответа"),
      comment: validateBoundedText(source.comment, 1500, false, "Комментарий к ответу")
    };
  });
}

function buildValidatedBlockResults(answers, sourceBlocks, rawTotal, testId) {
  if (!isPlainObject(sourceBlocks) || Object.keys(sourceBlocks).length > 12) {
    throw publicRequestError("invalid_blocks", "Skill Card имеет неверный формат.");
  }
  const allowedBlocks = ALLOWED_BLOCKS_BY_TEST_ID[testId] || [];
  if (Object.keys(sourceBlocks).some(blockKey => allowedBlocks.indexOf(blockKey) === -1)) {
    throw publicRequestError("invalid_blocks", "Skill Card содержит неизвестный блок.");
  }

  const totals = Object.create(null);
  answers.forEach(answer => {
    if (!totals[answer.block]) totals[answer.block] = { earned: 0, total: 0 };
    totals[answer.block].earned += answer.earnedPoints;
    totals[answer.block].total += answer.points;
  });

  const result = Object.create(null);
  Object.keys(totals).forEach(blockKey => {
    const source = isPlainObject(sourceBlocks[blockKey]) ? sourceBlocks[blockKey] : {};
    const total = totals[blockKey].total;
    const earned = totals[blockKey].earned;
    result[blockKey] = {
      name: validateBoundedText(source.name || blockKey, 120, true, "Название блока"),
      weight: rawTotal > 0 ? total / rawTotal : 0,
      earned: earned,
      total: total,
      percent: total > 0 ? Math.round(earned * 100 / total) : 0
    };
  });
  return result;
}

function validateTestId(value) {
  const testId = String(value || "").trim();
  if (!Object.prototype.hasOwnProperty.call(TEST_TITLES_BY_ID, testId)) {
    throw publicRequestError("invalid_test_id", "Неизвестный тест.");
  }
  return testId;
}

function assertPublicTestEnabled(testId) {
  if (testId === "dev-quick" && !PUBLIC_DEV_TEST_ENABLED) {
    throw publicRequestError("test_not_public", "Этот служебный тест недоступен в публичном режиме.");
  }
}

function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\u0000-\u0020\u007f]/.test(email) ||
      !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    throw publicRequestError("invalid_email", "Укажите корректный email.");
  }
  return email;
}

function validateBrowserFingerprint(value) {
  const fingerprint = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(fingerprint)) {
    throw publicRequestError("invalid_browser_fingerprint", "Не удалось проверить технический идентификатор браузера.");
  }
  return fingerprint;
}

function validateTelegramForRequest(value) {
  try {
    return normalizeTelegramContact(value);
  } catch (error) {
    throw publicRequestError("invalid_telegram", "Некорректный формат Telegram.");
  }
}

function validateBoundedText(value, maxLength, required, fieldName) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if ((required && !text) || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) {
    throw publicRequestError("invalid_field", String(fieldName || "Поле") + " имеет неверный формат.");
  }
  return text;
}

function validateIdentifier(value, maxLength, fieldName) {
  const identifier = String(value || "").trim();
  if (!identifier || identifier.length > maxLength || !/^[A-Za-z0-9_-]+$/.test(identifier)) {
    throw publicRequestError("invalid_identifier", String(fieldName || "Идентификатор") + " имеет неверный формат.");
  }
  return identifier;
}

function validateOptionalIdentifier(value, maxLength, fieldName) {
  const identifier = String(value || "").trim();
  return identifier ? validateIdentifier(identifier, maxLength, fieldName) : "";
}

function validateEnum(value, allowedValues, fieldName) {
  const normalized = String(value || "").trim();
  if (allowedValues.indexOf(normalized) === -1) {
    throw publicRequestError("invalid_enum", String(fieldName || "Поле") + " имеет недопустимое значение.");
  }
  return normalized;
}

function validateBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw publicRequestError("invalid_boolean", String(fieldName || "Поле") + " имеет неверный формат.");
  }
  return value;
}

function validateNumber(value, min, max, fieldName) {
  const number = Number(value);
  if (!isFinite(number) || number < min || number > max) {
    throw publicRequestError("invalid_number", String(fieldName || "Число") + " вне допустимого диапазона.");
  }
  return Math.round(number * 1000000) / 1000000;
}

function validateInteger(value, min, max, fieldName) {
  const number = Number(value);
  if (!isFinite(number) || Math.floor(number) !== number || number < min || number > max) {
    throw publicRequestError("invalid_integer", String(fieldName || "Число") + " имеет неверный формат.");
  }
  return number;
}

function assertReportedNumber(reportedValue, expectedValue, fieldName) {
  const reported = Number(reportedValue);
  if (!isFinite(reported) || Math.abs(reported - expectedValue) > 0.000001) {
    throw publicRequestError("inconsistent_result", "Расчёт результата не прошёл проверку: " + fieldName + ".");
  }
}

function assertAllowedObjectKeys(value, allowedKeys, objectName) {
  if (!isPlainObject(value)) {
    throw publicRequestError("invalid_object", String(objectName || "Объект") + " имеет неверный формат.");
  }
  const allowed = {};
  allowedKeys.forEach(key => { allowed[key] = true; });
  const unknown = Object.keys(value).find(key => !allowed[key]);
  if (unknown) throw publicRequestError("unknown_field", "Запрос содержит неизвестное поле.");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null));
}

function calculateServerPenalty(tabSwitches) {
  if (tabSwitches === 0) return 0;
  if (tabSwitches === 1) return 3;
  if (tabSwitches <= 3) return 7;
  return 15;
}

function calculateServerTrustScore(finalScore, tabSwitches, unansweredCount) {
  let score = finalScore;
  if (tabSwitches === 0) score += 5;
  else if (tabSwitches <= 2) score -= 2;
  else score -= 8;
  if (unansweredCount > 5) score -= 5;
  else if (unansweredCount > 2) score -= 2;
  return Math.max(0, Math.min(100, score));
}

function getServerRecommendation(finalScore, percent, trustScore, tabSwitches) {
  if (tabSwitches > 2) return "Результат требует осторожной интерпретации";
  if (finalScore >= SUCCESS_THRESHOLD && trustScore >= 70) return "Рекомендуется к интервью";
  if (finalScore >= 60 || percent >= 60) return "Можно рассмотреть при наличии стажировки / junior-позиции";
  return "Не рекомендуется без дополнительной проверки";
}

function consumeRateLimit(scope, identifier, maxRequests, windowSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSeconds);
  const retryAfterSeconds = windowSeconds - (nowSeconds % windowSeconds);
  const cacheKey = "rl-" + String(scope || "request").replace(/[^a-z0-9-]/gi, "").slice(0, 30) + "-" +
    sha256Hex(String(identifier || "shared")).slice(0, 24) + "-" + bucket;

  try {
    if (typeof CacheService === "undefined") return { allowed: true, retryAfterSeconds: retryAfterSeconds };
    const cache = CacheService.getScriptCache();
    const current = Number(cache.get(cacheKey) || 0);
    if (current >= maxRequests) return { allowed: false, retryAfterSeconds: retryAfterSeconds };
    cache.put(cacheKey, String(current + 1), Math.min(21600, windowSeconds + 5));
  } catch (error) {
    console.error("Rate limiter unavailable; request continued without cache protection.");
  }
  return { allowed: true, retryAfterSeconds: retryAfterSeconds };
}

function guardAdminRequest(password, operation) {
  const supplied = String(password || "");
  const authGate = consumeRateLimit("admin-auth-global", "shared", 60, 300);
  if (!authGate.allowed) {
    return { ok: false, response: buildRateLimitedResponse(authGate.retryAfterSeconds) };
  }
  if (isAdminPasswordValid(supplied)) {
    const allowedOperation = consumeRateLimit("admin-" + operation, "authorized", 60, 300);
    return allowedOperation.allowed
      ? { ok: true }
      : { ok: false, response: buildRateLimitedResponse(allowedOperation.retryAfterSeconds) };
  }

  const perPassword = consumeRateLimit("admin-invalid-password", supplied.slice(0, 256), 5, 300);
  if (!perPassword.allowed) {
    return { ok: false, response: buildRateLimitedResponse(perPassword.retryAfterSeconds) };
  }
  return {
    ok: false,
    response: {
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Доступ запрещён."
    }
  };
}

function isAdminPasswordValid(password) {
  const expected = getRequiredProperty("ADMIN_PASSWORD");
  const left = sha256Hex(String(password || ""));
  const right = sha256Hex(String(expected || ""));
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left.charCodeAt(i % left.length) ^ right.charCodeAt(i % right.length));
  }
  return difference === 0;
}

function saveTestResult(resultData) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let reportCreated = false;
  let reportPath = "";
  let failureStage = "lock";
  let requestIdForLog = "";

  try {
    lock.waitLock(30000);
    lockAcquired = true;
    failureStage = "ensure-folders";
    ensureSkillCheckFolders();

    const testId = String(resultData.testId || "").trim();
    const email = String(resultData.email || "").trim().toLowerCase();
    const fingerprint = String(resultData.browserFingerprint || "").trim();
    const suppliedRequestId = String(resultData.requestId || "").trim();
    const requestId = normalizeSubmissionRequestId(suppliedRequestId);
    requestIdForLog = requestId;
    const finalScore = Number(resultData.finalScore || 0);
    const percent = Number(resultData.percent || resultData.score || 0);
    const status = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";
    const telegram = normalizeTelegramContact(resultData.telegram);

    if (!requestId) {
      return {
        ok: false,
        status: "error",
        retryable: false,
        failureCode: "invalid_request_id",
        message: "Не удалось проверить идентификатор отправки. Обновите страницу теста."
      };
    }

    failureStage = "payload-hash";
    const payloadForHash = Object.assign({}, resultData, {
      testId: testId,
      email: email,
      browserFingerprint: fingerprint,
      telegram: telegram,
      finalScore: finalScore,
      percent: percent
    });
    const payloadHash = buildSubmissionPayloadHash(payloadForHash);
    const legacyPayloadHash = buildLegacySubmissionPayloadHash(payloadForHash);
    failureStage = "existing-result";
    const existingResult = findAdminResultByRequestId(requestId);

    if (existingResult) {
      const existingResultHash = String(existingResult.payloadHash || "");
      const existingResultHashMatches = !existingResultHash ||
        (Number(existingResult.payloadHashVersion || 1) === 2
          ? existingResultHash === payloadHash
          : (existingResultHash === legacyPayloadHash || existingResultHash === payloadHash));
      if (String(existingResult.testId || "") !== testId || !existingResultHashMatches) {
        return buildSubmissionConflictResponse();
      }
      console.log("Idempotent result replay: " + maskRequestIdForLog(requestId));
      return buildSavedResultResponse(existingResult, true);
    }

    failureStage = "existing-attempt";
    const existingAttempt = findAttemptByRequestId(requestId);
    let code = "";
    let now = null;

    if (existingAttempt) {
      const existingAttemptHash = String(existingAttempt.payloadHash || "");
      const existingAttemptHashMatches = Number(existingAttempt.payloadHashVersion || 1) === 2
        ? existingAttemptHash === payloadHash
        : (existingAttemptHash === legacyPayloadHash || existingAttemptHash === payloadHash);
      if (String(existingAttempt.testId || "") !== testId ||
          !existingAttemptHashMatches ||
          !String(existingAttempt.code || "")) {
        return buildSubmissionConflictResponse();
      }

      const existingAttemptTime = new Date(existingAttempt.date || "").getTime();
      const reservationExpired = existingAttempt.submissionState === "reserved" &&
        (!isFinite(existingAttemptTime) || Date.now() - existingAttemptTime >= RESERVATION_TTL_MS);
      if (reservationExpired) {
        const retryAttemptCheck = checkAttemptHash(testId, email, fingerprint);
        if (!retryAttemptCheck.allowed) {
          return Object.assign({}, retryAttemptCheck, {
            ok: false,
            status: "blocked",
            blocked: true,
            retryable: false,
            reportCreated: false,
            message: retryAttemptCheck.message || "Повторная попытка заблокирована."
          });
        }
      }

      code = String(existingAttempt.code);
      now = new Date(existingAttempt.date || "");
      if (!isFinite(now.getTime())) now = new Date();
      console.log("Resuming reserved result: " + maskRequestIdForLog(requestId));
    } else {
      failureStage = "retake-check";
      const attemptCheck = checkAttemptHash(testId, email, fingerprint);

      if (!attemptCheck.allowed) {
        return Object.assign({}, attemptCheck, {
          ok: false,
          status: "blocked",
          blocked: true,
          retryable: false,
          reportCreated: false,
          message: attemptCheck.message || "Повторная попытка заблокирована."
        });
      }

      failureStage = "reserve-code";
      code = generateUniqueResultCode(testId);
      now = new Date();
      const attemptHashes = hashAttemptIdentifiers(testId, email, fingerprint);
      upsertAttemptRecord({
        emailHash: attemptHashes.emailHash,
        fingerprintHash: attemptHashes.fingerprintHash,
        testId: testId,
        code: code,
        date: now.toISOString(),
        status: status,
        requestId: requestId,
        payloadHash: payloadHash,
        payloadHashVersion: 2,
        submissionState: "reserved",
        finalScore: finalScore,
        percent: percent,
        reportCreated: false
      });
    }

    // Personal data is processed only here and only for successful TXT reports.
    if (status === "passed") {
      failureStage = "report-write";
      reportPath = joinDiskPath(getReportsFolderPath(), code + ".txt");
      const reportText = buildTxtReport(Object.assign({}, resultData, {
        code: code,
        status: status,
        telegram: telegram,
        completedAt: now.toISOString()
      }));
      if (reportText.length > MAX_GENERATED_REPORT_CHARS) {
        return buildValidationErrorResponse("report_too_large", "Отчёт превышает допустимый размер.");
      }
      uploadTextToYandexDisk(reportPath, reportText);
      reportCreated = true;
    }

    failureStage = "admin-write";
    appendAdminResult({
      code: code,
      testId: testId,
      testTitle: resultData.testTitle || TEST_TITLES_BY_ID[testId] || testId,
      finalScore: finalScore,
      percent: percent,
      tabSwitches: Number(resultData.tabSwitches || 0),
      date: now.toISOString(),
      status: status,
      badge: String(resultData.badge || ""),
      reportCreated: reportCreated,
      reportPath: reportPath,
      reportCode: code,
      requestId: requestId,
      payloadHash: payloadHash,
      payloadHashVersion: 2,
      scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
    });
    failureStage = "attempt-complete";
    const attemptHashes = hashAttemptIdentifiers(testId, email, fingerprint);
    upsertAttemptRecord({
      emailHash: attemptHashes.emailHash,
      fingerprintHash: attemptHashes.fingerprintHash,
      testId: testId,
      code: code,
      date: now.toISOString(),
      status: status,
      requestId: requestId,
      payloadHash: payloadHash,
      payloadHashVersion: 2,
      submissionState: "completed",
      finalScore: finalScore,
      percent: percent,
      reportCreated: reportCreated,
      scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
    });
    failureStage = "done";
    return buildSavedResultResponse({
      code: code,
      testId: testId,
      finalScore: finalScore,
      percent: percent,
      status: status,
      reportCreated: reportCreated,
      scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
    }, false);
  } catch (error) {
    console.error("Result submission failed; stage=" + failureStage + "; request=" + maskRequestIdForLog(requestIdForLog));
    return {
      ok: false,
      status: "error",
      retryable: true,
      failureCode: "temporary_storage_error",
      message: "Не удалось сохранить результат. Повторите отправку с экрана результата."
    };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function generateResultCode(testId) {
  const prefix = TEST_CODE_PREFIX[testId] || "SC";
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let suffix = "";

  for (let i = 0; i < 5; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return prefix + "-" + suffix;
}

function generateUniqueResultCode(testId) {
  const adminResults = readJsonFromYandexDisk(getAdminFilePath(), []);
  const attempts = readJsonFromYandexDisk(getAttemptsFilePath(), []);
  const existingCodes = {};
  adminResults.forEach(result => {
    if (result && result.code) existingCodes[String(result.code)] = true;
  });
  attempts.forEach(attempt => {
    if (attempt && attempt.code) existingCodes[String(attempt.code)] = true;
  });

  for (let i = 0; i < 20; i++) {
    const code = generateResultCode(testId);
    if (!existingCodes[code]) return code;
  }

  throw new Error("Не удалось создать уникальный код результата.");
}

function buildTxtReport(resultData) {
  const answers = Array.isArray(resultData.answers) ? resultData.answers : [];
  const blockResults = resultData.blockResults && typeof resultData.blockResults === "object"
    ? resultData.blockResults
    : {};
  const testTitle = resultData.testTitle || TEST_TITLES_BY_ID[resultData.testId] || resultData.testId || "Тест";
  let report = "";

  report += "SKILLCHECK RESULT REPORT\n";
  report += "========================\n\n";
  report += "Код результата: " + safeText(resultData.code) + "\n";
  report += "Test ID: " + safeText(resultData.testId) + "\n";
  report += "Тест: " + safeText(testTitle) + "\n";
  report += "Дата и время прохождения: " + safeText(resultData.completedAt) + "\n";
  report += "Проверка балла: клиентский расчёт, структурно проверен backend, но не подтверждён закрытым ключом ответов\n\n";

  report += "КАНДИДАТ\n";
  report += "--------\n";
  report += "Имя/ФИО: " + safeText(resultData.name) + "\n";
  report += "Email: " + safeText(resultData.email) + "\n";
  if (resultData.telegram) report += "Telegram: " + safeText(resultData.telegram) + "\n";
  report += "Английский: " + safeText(resultData.englishLevel) + "\n";
  report += "Опыт: " + safeText(resultData.candidateExperience || resultData.experience) + "\n";
  report += "Источник: " + safeText(resultData.candidateSource || resultData.source) + "\n";
  report += "Согласие на передачу работодателю: " + (resultData.employerShareConsent ? "дано" : "не дано") + "\n\n";

  report += "РЕЗУЛЬТАТ\n";
  report += "---------\n";
  report += "Сырой результат: " + Number(resultData.rawScore || 0) + "/" + Number(resultData.rawTotal || 0) + "\n";
  report += "Итоговый балл: " + Number(resultData.finalScore || 0) + "\n";
  report += "Процент: " + Number(resultData.percent || resultData.score || 0) + "\n";
  report += "Штрафы: " + Number(resultData.penalty || 0) + "\n";
  report += "Уходы со вкладки: " + Number(resultData.tabSwitches || 0) + "\n";
  report += "Trust Score: " + Number(resultData.trustScore || 0) + "\n";
  report += "Плашка: " + safeText(resultData.badge || "") + "\n";
  report += "Статус: " + safeText(resultData.status || resultData.passStatus || "") + "\n";
  report += "Итоговый вывод: " + safeText(resultData.recommendation || resultData.finalDecision || "") + "\n\n";

  if (Object.keys(blockResults).length) {
    report += "SKILL CARD\n";
    report += "----------\n";
    Object.keys(blockResults).forEach(blockKey => {
      const block = blockResults[blockKey] || {};
      report += safeText(block.name || blockKey) + ": " + Number(block.percent || 0) + "%";
      report += " (" + Number(block.earned || 0) + "/" + Number(block.total || 0) + " баллов";
      report += ", вес " + Math.round(Number(block.weight || 0) * 100) + "%)\n";
    });
    report += "\n";
  }

  report += "ВОПРОСЫ И ОТВЕТЫ\n";
  report += "----------------\n";
  answers.forEach((answer, index) => {
    report += "Вопрос " + (index + 1) + ": " + safeText(answer.question) + "\n";
    report += "Ответ кандидата: " + safeText(answer.selectedAnswer) + "\n";
    report += "Правильный ответ: " + safeText(answer.correctAnswer) + "\n";
    report += "Результат: " + (answer.isCorrect ? "верно" : "неверно") + "\n";
    report += "Статус ответа: " + safeText(answer.status || "") + "\n";
    report += "Баллы: " + Number(answer.earnedPoints || 0) + "/" + Number(answer.points || 0) + "\n";
    report += "Время: " + Number(answer.timeSpent || 0) + "/" + Number(answer.timeLimit || 0) + " сек.\n";
    if (answer.comment) report += "Комментарий: " + safeText(answer.comment) + "\n";
    report += "\n";
  });

  return report;
}

function hashAttemptValue(testId, valueType, value) {
  const salt = getRequiredProperty("ATTEMPT_HASH_SALT");
  const source = [
    String(testId || "").trim(),
    String(valueType || "").trim(),
    String(value || "").trim().toLowerCase(),
    salt
  ].join("|");
  return sha256Hex(source);
}

function sha256Hex(source) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8);
  return digest.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function hashAttempt(testId, email, fingerprint) {
  const salt = getRequiredProperty("ATTEMPT_HASH_SALT");
  const legacySource = String(testId || "") + String(email || "").toLowerCase() + String(fingerprint || "") + salt;
  return sha256Hex(legacySource);
}

function hashAttemptIdentifiers(testId, email, fingerprint) {
  return {
    emailHash: email ? hashAttemptValue(testId, "email", email) : "",
    fingerprintHash: fingerprint ? hashAttemptValue(testId, "fingerprint", fingerprint) : ""
  };
}

function checkAttemptHash(testId, email, fingerprint) {
  if (RETAKE_BYPASS_TEST_IDS[testId]) {
    return {
      allowed: true,
      message: "Dev-тест можно проходить повторно без блокировки.",
      testId: testId,
      foundPreviousAttempt: false,
      bypass: true
    };
  }

  const hashes = hashAttemptIdentifiers(testId, email, fingerprint);
  const legacyHash = hashAttempt(testId, email, fingerprint);
  const attempts = readJsonFromYandexDisk(getAttemptsFilePath(), []);
  const now = Date.now();
  const found = attempts.find(attempt => {
    if (!attempt || attempt.testId !== testId) return false;
    const attemptTime = new Date(attempt.date || "").getTime();
    if (!isFinite(attemptTime)) return false;
    const age = now - attemptTime;
    if (age < 0 || age >= RETAKE_WINDOW_MS) return false;
    if (attempt.submissionState === "reserved" && age >= RESERVATION_TTL_MS) return false;

    const emailMatches = Boolean(hashes.emailHash && attempt.emailHash === hashes.emailHash);
    const fingerprintMatches = Boolean(hashes.fingerprintHash && attempt.fingerprintHash === hashes.fingerprintHash);
    const legacyMatches = Boolean(attempt.hash && attempt.hash === legacyHash);
    return emailMatches || fingerprintMatches || legacyMatches;
  });

  if (found) {
    const previousAttemptTime = new Date(found.date).getTime();
    const isReservation = found.submissionState === "reserved";
    const nextAttemptTime = previousAttemptTime + (isReservation ? RESERVATION_TTL_MS : RETAKE_WINDOW_MS);
    const blockedResponse = {
      allowed: false,
      message: isReservation
        ? "Предыдущая отправка этого теста ещё обрабатывается. Повторите проверку позже."
        : "Этот тест уже был пройден. Повторное прохождение пока недоступно.",
      testId: testId,
      foundPreviousAttempt: true
    };
    if (isReservation) blockedResponse.retryAfterSeconds = Math.max(1, Math.ceil((nextAttemptTime - now) / 1000));
    else blockedResponse.daysLeft = Math.max(1, Math.ceil((nextAttemptTime - now) / (24 * 60 * 60 * 1000)));
    return blockedResponse;
  }

  return {
    allowed: true,
    message: "Можно проходить тест.",
    testId: testId,
    foundPreviousAttempt: false
  };
}

function buildHealthStatus() {
  const reportsFolder = getReportsFolderPath();
  const adminFile = getAdminFilePath();
  const attemptsFile = getAttemptsFilePath();
  const props = PropertiesService.getScriptProperties();
  const status = {
    ok: false,
    backendVersion: BACKEND_VERSION,
    hasYandexToken: Boolean(props.getProperty("YANDEX_DISK_TOKEN")),
    hasReportsFolderProperty: Boolean(props.getProperty("YANDEX_DISK_REPORTS_FOLDER")),
    hasAdminFileProperty: Boolean(props.getProperty("YANDEX_DISK_ADMIN_FILE")),
    hasAttemptsFileProperty: Boolean(props.getProperty("YANDEX_DISK_ATTEMPTS_FILE")),
    hasAttemptSalt: Boolean(props.getProperty("ATTEMPT_HASH_SALT")),
    hasAdminPassword: Boolean(props.getProperty("ADMIN_PASSWORD")),
    yandexDiskAccess: false,
    yandexStatusCode: 0,
    yandexErrorMessage: "",
    reportsFolder: reportsFolder,
    adminFile: adminFile,
    attemptsFile: attemptsFile,
    adminFileExists: false,
    attemptsFileExists: false,
    storageDiagnostics: {
      folders: {},
      targets: {}
    }
  };

  const diskProbe = probeYandexDiskAccess();
  status.yandexDiskAccess = diskProbe.ok;
  status.yandexStatusCode = diskProbe.statusCode;
  status.yandexErrorMessage = diskProbe.errorMessage;

  if (status.yandexDiskAccess) {
    try {
      ensureSkillCheckFolders();
      status.storageDiagnostics.folders.reports = listYandexFolderContents(reportsFolder);
      status.storageDiagnostics.folders.admin = listYandexFolderContents(getParentDiskPath(adminFile));
      status.storageDiagnostics.folders.private = listYandexFolderContents(getParentDiskPath(attemptsFile));
      status.storageDiagnostics.targets.adminFileBefore = getYandexResourceMetadata(adminFile);
      status.storageDiagnostics.targets.attemptsFileBefore = getYandexResourceMetadata(attemptsFile);
      readJsonFromYandexDisk(adminFile, []);
      readJsonFromYandexDisk(attemptsFile, []);
      status.storageDiagnostics.targets.adminFileAfter = getYandexResourceMetadata(adminFile);
      status.storageDiagnostics.targets.attemptsFileAfter = getYandexResourceMetadata(attemptsFile);
      status.adminFileExists = status.storageDiagnostics.targets.adminFileAfter.exists;
      status.attemptsFileExists = status.storageDiagnostics.targets.attemptsFileAfter.exists;
    } catch (error) {
      status.yandexErrorMessage = sanitizeDiagnosticMessage(error);
      status.storageDiagnostics.targets.adminFileAfter = getYandexResourceMetadataSafely(adminFile);
      status.storageDiagnostics.targets.attemptsFileAfter = getYandexResourceMetadataSafely(attemptsFile);
    }
  }

  status.ok = Boolean(
    status.hasYandexToken &&
    status.hasAttemptSalt &&
    status.hasAdminPassword &&
    status.yandexDiskAccess &&
    status.adminFileExists &&
    status.attemptsFileExists
  );

  return status;
}

function probeYandexDiskAccess() {
  const token = PropertiesService.getScriptProperties().getProperty("YANDEX_DISK_TOKEN");
  if (!token) {
    return {
      ok: false,
      statusCode: 0,
      errorMessage: "Script Property YANDEX_DISK_TOKEN не настроен."
    };
  }

  try {
    const response = UrlFetchApp.fetch("https://cloud-api.yandex.net/v1/disk/", {
      method: "get",
      headers: {
        Authorization: "OAuth " + token
      },
      muteHttpExceptions: true
    });
    const statusCode = response.getResponseCode();
    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      errorMessage: statusCode >= 200 && statusCode < 300
        ? ""
        : sanitizeYandexResponseText(response.getContentText())
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      errorMessage: sanitizeDiagnosticMessage(error)
    };
  }
}

function yandexResourceExists(path) {
  return getYandexResourceMetadata(path).exists;
}

function getYandexResourceMetadata(path) {
  const normalizedPath = normalizeDiskPath(path);
  const url = "https://cloud-api.yandex.net/v1/disk/resources?path=" +
    encodeURIComponent(normalizedPath) +
    "&fields=name,type,path,size,created,modified";

  try {
    const resource = yandexApiRequest("get", url, null, null);
    return {
      exists: true,
      name: String(resource.name || ""),
      type: String(resource.type || "unknown"),
      path: String(resource.path || normalizedPath),
      size: resource.type === "file" ? Number(resource.size || 0) : null,
      created: String(resource.created || ""),
      modified: String(resource.modified || "")
    };
  } catch (error) {
    if (String(error.message || "").indexOf("Yandex API error 404") !== -1) {
      return {
        exists: false,
        name: getDiskPathName(normalizedPath),
        type: "missing",
        path: normalizedPath,
        size: null,
        created: "",
        modified: ""
      };
    }
    throw error;
  }
}

function getYandexResourceMetadataSafely(path) {
  try {
    return getYandexResourceMetadata(path);
  } catch (error) {
    return {
      exists: false,
      name: getDiskPathName(path),
      type: "unknown",
      path: normalizeDiskPath(path),
      error: sanitizeDiagnosticMessage(error)
    };
  }
}

function listYandexFolderContents(folderPath) {
  const normalizedPath = normalizeDiskPath(folderPath);
  const url = "https://cloud-api.yandex.net/v1/disk/resources?path=" +
    encodeURIComponent(normalizedPath) +
    "&limit=100&fields=name,type,path,_embedded.items.name,_embedded.items.type,_embedded.items.path";

  try {
    const resource = yandexApiRequest("get", url, null, null);
    const items = resource && resource._embedded && Array.isArray(resource._embedded.items)
      ? resource._embedded.items
      : [];
    return {
      exists: true,
      type: String(resource.type || "unknown"),
      path: String(resource.path || normalizedPath),
      items: items.slice(0, 100).map(item => ({
        name: String(item.name || ""),
        type: String(item.type || "unknown"),
        path: String(item.path || "")
      }))
    };
  } catch (error) {
    if (String(error.message || "").indexOf("Yandex API error 404") !== -1) {
      return {
        exists: false,
        type: "missing",
        path: normalizedPath,
        items: []
      };
    }
    return {
      exists: false,
      type: "unknown",
      path: normalizedPath,
      items: [],
      error: sanitizeDiagnosticMessage(error)
    };
  }
}

function yandexApiRequest(method, url, payload, contentType) {
  const normalizedMethod = String(method || "get").toLowerCase();
  const options = {
    method: normalizedMethod,
    headers: {
      Authorization: "OAuth " + getRequiredProperty("YANDEX_DISK_TOKEN")
    },
    muteHttpExceptions: true
  };

  if (payload !== undefined && payload !== null) {
    options.payload = payload;
    if (contentType) options.contentType = contentType;
  }

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      "Yandex API error " + status +
      " during " + normalizedMethod.toUpperCase() +
      " " + sanitizeYandexUrl(url) +
      ": " + sanitizeYandexResponseText(text)
    );
  }

  return text ? JSON.parse(text) : {};
}

function ensureYandexFolderExists(folderPath) {
  const parts = normalizeDiskPath(folderPath).replace("disk:/", "").split("/").filter(Boolean);
  let currentPath = "disk:";

  parts.forEach(part => {
    currentPath += "/" + part;
    const url = "https://cloud-api.yandex.net/v1/disk/resources?path=" + encodeURIComponent(currentPath);

    try {
      yandexApiRequest("get", url, null, null);
    } catch (error) {
      if (String(error.message || "").indexOf("Yandex API error 404") !== -1) {
        yandexApiRequest("put", url, null, null);
      } else {
        throw error;
      }
    }
  });
}

function uploadTextToYandexDisk(path, content) {
  const normalizedPath = normalizeDiskPath(path);
  ensureYandexFolderExists(getParentDiskPath(normalizedPath));
  const existingResource = getYandexResourceMetadata(normalizedPath);

  if (existingResource.exists && existingResource.type === "dir") {
    throw new Error(
      "Yandex path conflict during upload-target-check for " + normalizedPath +
      ": expected file, found directory. Existing data was not changed."
    );
  }

  const uploadUrl = "https://cloud-api.yandex.net/v1/disk/resources/upload?path=" +
    encodeURIComponent(normalizedPath) + "&overwrite=true";
  const uploadInfo = yandexApiRequest("get", uploadUrl, null, null);
  const uploadMethod = String(uploadInfo.method || "PUT").toLowerCase();

  if (!uploadInfo.href || uploadMethod !== "put" || uploadInfo.templated === true) {
    throw new Error(
      "Yandex upload link error during upload-url for " + normalizedPath +
      ": method=" + String(uploadInfo.method || "") +
      ", templated=" + String(Boolean(uploadInfo.templated)) +
      ", uploadUrl=" + sanitizeYandexUploadUrl(uploadInfo.href)
    );
  }

  const textContent = String(content || "");
  const uploadContent = /\n$/.test(textContent) ? textContent : textContent + "\n";
  const bytes = Utilities.newBlob(uploadContent, "text/plain").getBytes();
  const response = UrlFetchApp.fetch(uploadInfo.href, {
    method: uploadMethod,
    payload: bytes,
    contentType: "text/plain; charset=utf-8",
    escaping: false,
    muteHttpExceptions: true
  });
  const statusCode = response.getResponseCode();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      "Yandex upload error " + statusCode +
      " during upload-put for " + normalizedPath +
      "; uploadUrl=" + sanitizeYandexUploadUrl(uploadInfo.href) +
      "; method=" + uploadMethod.toUpperCase() +
      "; responseHeaders=" + sanitizeYandexResponseHeaders(response.getAllHeaders()) +
      "; responseBody=" + sanitizeYandexResponseText(response.getContentText() || "<empty>")
    );
  }
}

function readTextFromYandexDisk(path) {
  const downloadUrl = "https://cloud-api.yandex.net/v1/disk/resources/download?path=" +
    encodeURIComponent(normalizeDiskPath(path));

  let downloadInfo;
  try {
    downloadInfo = yandexApiRequest("get", downloadUrl, null, null);
  } catch (error) {
    if (String(error.message || "").indexOf("Yandex API error 404") !== -1) return null;
    throw error;
  }

  const response = UrlFetchApp.fetch(downloadInfo.href, {
    method: "get",
    escaping: false,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status === 404) return null;
  if (status < 200 || status >= 300) {
    throw new Error(
      "Yandex download error " + status +
      " for " + normalizeDiskPath(path) +
      ": " + sanitizeYandexResponseText(response.getContentText())
    );
  }

  return response.getContentText();
}

function readJsonFromYandexDisk(path, defaultValue) {
  const text = readTextFromYandexDisk(path);

  if (text === null) {
    writeJsonToYandexDisk(path, defaultValue);
    return JSON.parse(JSON.stringify(defaultValue));
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("JSON файл повреждён и не будет перезаписан автоматически: " + path);
  }
}

function writeJsonToYandexDisk(path, data) {
  uploadTextToYandexDisk(path, JSON.stringify(data, null, 2));
}

function appendAdminResult(summaryData) {
  const path = getAdminFilePath();
  const results = readJsonFromYandexDisk(path, []);
  const normalizedRequestId = normalizeSubmissionRequestId(summaryData.requestId);
  const row = {
    code: String(summaryData.code || ""),
    testId: String(summaryData.testId || ""),
    testTitle: TEST_TITLES_BY_ID[summaryData.testId] || "Неизвестный тест",
    finalScore: Number(summaryData.finalScore || 0),
    percent: Number(summaryData.percent || 0),
    tabSwitches: Number(summaryData.tabSwitches || 0),
    date: String(summaryData.date || ""),
    status: summaryData.status === "passed" ? "passed" : "failed",
    badge: getAdminBadge(Number(summaryData.finalScore || 0), Number(summaryData.tabSwitches || 0)),
    reportCreated: Boolean(summaryData.reportCreated),
    reportPath: String(summaryData.reportPath || ""),
    reportCode: String(summaryData.reportCode || summaryData.code || ""),
    requestId: normalizedRequestId,
    payloadHash: String(summaryData.payloadHash || ""),
    payloadHashVersion: Number(summaryData.payloadHashVersion || 0) === 2 ? 2 : 1,
    scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
  };
  const existingIndex = results.findIndex(result => result && (
    (normalizedRequestId && result.requestId === normalizedRequestId) ||
    (row.code && result.code === row.code)
  ));

  if (existingIndex >= 0) results[existingIndex] = Object.assign({}, results[existingIndex], row);
  else results.push(row);
  writeJsonToYandexDisk(path, results);
}

function normalizeSubmissionRequestId(value) {
  const requestId = String(value || "").trim();
  return /^sc_[A-Za-z0-9-]{16,80}$/.test(requestId) ? requestId : "";
}

function maskRequestIdForLog(value) {
  const requestId = normalizeSubmissionRequestId(value);
  return requestId ? "..." + requestId.slice(-8) : "invalid";
}

function buildSubmissionConflictResponse() {
  return {
    ok: false,
    status: "error",
    retryable: false,
    failureCode: "submission_conflict",
    message: "Не удалось проверить целостность повторной отправки. Обновите страницу теста."
  };
}

function buildSubmissionPayloadHash(resultData) {
  const answers = Array.isArray(resultData.answers) ? resultData.answers : [];
  const blocks = isPlainObject(resultData.blockResults) ? resultData.blockResults : {};
  const canonical = {
    schemaVersion: 2,
    testId: String(resultData.testId || "").trim(),
    testVersion: String(resultData.testVersion || ""),
    bankVersion: String(resultData.bankVersion || ""),
    name: String(resultData.name || "").trim(),
    email: String(resultData.email || "").trim().toLowerCase(),
    telegram: String(resultData.telegram || ""),
    englishLevel: String(resultData.englishLevel || ""),
    candidateSource: String(resultData.candidateSource || ""),
    candidateExperience: String(resultData.candidateExperience || ""),
    employerShareConsent: Boolean(resultData.employerShareConsent),
    browserFingerprint: String(resultData.browserFingerprint || ""),
    rawScore: Number(resultData.rawScore || 0),
    rawTotal: Number(resultData.rawTotal || 0),
    unansweredCount: Number(resultData.unansweredCount || 0),
    percent: Number(resultData.percent || resultData.score || 0),
    finalScore: Number(resultData.finalScore || 0),
    penalty: Number(resultData.penalty || 0),
    tabSwitches: Number(resultData.tabSwitches || 0),
    trustScore: Number(resultData.trustScore || 0),
    badge: String(resultData.badge || ""),
    passStatus: String(resultData.passStatus || ""),
    finalDecision: String(resultData.finalDecision || ""),
    recommendation: String(resultData.recommendation || ""),
    blockResults: Object.keys(blocks).sort().map(blockKey => ({
      key: blockKey,
      name: String(blocks[blockKey] && blocks[blockKey].name || ""),
      weight: Number(blocks[blockKey] && blocks[blockKey].weight || 0),
      earned: Number(blocks[blockKey] && blocks[blockKey].earned || 0),
      total: Number(blocks[blockKey] && blocks[blockKey].total || 0),
      percent: Number(blocks[blockKey] && blocks[blockKey].percent || 0)
    })),
    answers: answers.map(answer => ({
      number: Number(answer.number || 0),
      questionId: String(answer.questionId || ""),
      topic: String(answer.topic || ""),
      block: String(answer.block || ""),
      difficulty: String(answer.difficulty || ""),
      question: String(answer.question || ""),
      selectedAnswer: String(answer.selectedAnswer || ""),
      correctAnswer: String(answer.correctAnswer || ""),
      isCorrect: Boolean(answer.isCorrect),
      timedOut: Boolean(answer.timedOut),
      status: String(answer.status || ""),
      earnedPoints: Number(answer.earnedPoints || 0),
      points: Number(answer.points || 0),
      timeSpent: Number(answer.timeSpent || 0),
      timeLimit: Number(answer.timeLimit || 0),
      comment: String(answer.comment || "")
    }))
  };
  const salt = getRequiredProperty("ATTEMPT_HASH_SALT");
  return sha256Hex(JSON.stringify(canonical) + "|" + salt);
}

function buildLegacySubmissionPayloadHash(resultData) {
  const answers = Array.isArray(resultData.answers) ? resultData.answers : [];
  const canonical = {
    testId: String(resultData.testId || "").trim(),
    testVersion: String(resultData.testVersion || ""),
    bankVersion: String(resultData.bankVersion || ""),
    name: String(resultData.name || "").trim(),
    email: String(resultData.email || "").trim().toLowerCase(),
    telegram: String(resultData.telegram || ""),
    englishLevel: String(resultData.englishLevel || ""),
    candidateSource: String(resultData.candidateSource || ""),
    candidateExperience: String(resultData.candidateExperience || ""),
    employerShareConsent: Boolean(resultData.employerShareConsent),
    browserFingerprint: String(resultData.browserFingerprint || ""),
    rawScore: Number(resultData.rawScore || 0),
    rawTotal: Number(resultData.rawTotal || 0),
    percent: Number(resultData.percent || resultData.score || 0),
    finalScore: Number(resultData.finalScore || 0),
    penalty: Number(resultData.penalty || 0),
    tabSwitches: Number(resultData.tabSwitches || 0),
    answers: answers.map(answer => ({
      number: Number(answer.number || 0),
      question: String(answer.question || ""),
      selectedAnswer: String(answer.selectedAnswer || ""),
      correctAnswer: String(answer.correctAnswer || ""),
      isCorrect: Boolean(answer.isCorrect),
      timedOut: Boolean(answer.timedOut),
      earnedPoints: Number(answer.earnedPoints || 0),
      points: Number(answer.points || 0),
      timeSpent: Number(answer.timeSpent || 0),
      timeLimit: Number(answer.timeLimit || 0)
    }))
  };
  const salt = getRequiredProperty("ATTEMPT_HASH_SALT");
  return sha256Hex(JSON.stringify(canonical) + "|" + salt);
}

function findAdminResultByRequestId(requestId) {
  const normalizedRequestId = normalizeSubmissionRequestId(requestId);
  if (!normalizedRequestId) return null;
  const results = readJsonFromYandexDisk(getAdminFilePath(), []);
  return results.find(row => row && row.requestId === normalizedRequestId) || null;
}

function findAttemptByRequestId(requestId) {
  const normalizedRequestId = normalizeSubmissionRequestId(requestId);
  if (!normalizedRequestId) return null;
  const attempts = readJsonFromYandexDisk(getAttemptsFilePath(), []);
  return attempts.find(attempt => attempt && attempt.requestId === normalizedRequestId) || null;
}

function buildSavedResultResponse(row, replayed) {
  return {
    ok: true,
    status: "ok",
    resultCode: String(row.code || ""),
    code: String(row.code || ""),
    testId: String(row.testId || ""),
    finalScore: Number(row.finalScore || 0),
    percent: Number(row.percent || 0),
    passStatus: row.status === "passed" ? "passed" : "failed",
    reportCreated: Boolean(row.reportCreated),
    replayed: Boolean(replayed),
    scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED,
    message: "Сохраните код результата: " + String(row.code || "")
  };
}

function saveAttemptHash(attemptData) {
  const path = getAttemptsFilePath();
  const attempts = readJsonFromYandexDisk(path, []);
  attempts.push({
    emailHash: String(attemptData.emailHash || ""),
    fingerprintHash: String(attemptData.fingerprintHash || ""),
    testId: String(attemptData.testId || ""),
    code: String(attemptData.code || ""),
    date: String(attemptData.date || ""),
    status: attemptData.status === "passed" ? "passed" : "failed"
  });
  writeJsonToYandexDisk(path, attempts);
}

function upsertAttemptRecord(attemptData) {
  const path = getAttemptsFilePath();
  const attempts = readJsonFromYandexDisk(path, []);
  const requestId = normalizeSubmissionRequestId(attemptData.requestId);
  const row = {
    emailHash: String(attemptData.emailHash || ""),
    fingerprintHash: String(attemptData.fingerprintHash || ""),
    testId: String(attemptData.testId || ""),
    code: String(attemptData.code || ""),
    date: String(attemptData.date || ""),
    status: attemptData.status === "passed" ? "passed" : "failed",
    requestId: requestId,
    payloadHash: String(attemptData.payloadHash || ""),
    payloadHashVersion: Number(attemptData.payloadHashVersion || 0) === 2 ? 2 : 1,
    submissionState: attemptData.submissionState === "completed" ? "completed" : "reserved",
    finalScore: Number(attemptData.finalScore || 0),
    percent: Number(attemptData.percent || 0),
    reportCreated: Boolean(attemptData.reportCreated),
    scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
  };
  const existingIndex = attempts.findIndex(attempt => attempt && (
    (requestId && attempt.requestId === requestId) ||
    (row.code && attempt.code === row.code)
  ));

  if (existingIndex >= 0) attempts[existingIndex] = Object.assign({}, attempts[existingIndex], row);
  else attempts.push(row);
  writeJsonToYandexDisk(path, attempts);
}

function getAdminResults(password) {
  if (!isAdminPasswordValid(password)) {
    return {
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Доступ запрещён."
    };
  }

  const storedResults = readJsonFromYandexDisk(getAdminFilePath(), []);

  return {
    ok: true,
    status: "ok",
    backendVersion: BACKEND_VERSION,
    loadedAt: new Date().toISOString(),
    results: storedResults.map(sanitizeAdminResult)
  };
}

function getAdminReport(password, code) {
  if (!isAdminPasswordValid(password)) {
    return {
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Доступ запрещён."
    };
  }

  const normalizedCode = normalizeResultCode(code);
  if (!normalizedCode) return buildUnavailableAdminReportResponse();

  try {
    const storedResults = readJsonFromYandexDisk(getAdminFilePath(), []);
    const result = storedResults.find(row =>
      row && String(row.code || "").toUpperCase() === normalizedCode
    );

    if (!result || result.status !== "passed" || !result.reportCreated) {
      return buildUnavailableAdminReportResponse();
    }

    const reportPath = joinDiskPath(getReportsFolderPath(), normalizedCode + ".txt");
    const reportText = readTextFromYandexDisk(reportPath);

    if (reportText === null || reportText.length > MAX_ADMIN_REPORT_CHARS) {
      return buildUnavailableAdminReportResponse();
    }

    console.log("Admin report retrieved: " + normalizedCode);
    return {
      ok: true,
      status: "ok",
      backendVersion: BACKEND_VERSION,
      code: normalizedCode,
      filename: normalizedCode + ".txt",
      contentType: "text/plain;charset=UTF-8",
      reportText: reportText
    };
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return {
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Не удалось получить отчёт."
    };
  }
}

function normalizeResultCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^(FA|CA|FPA|ACC|BI|DEV)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(code)
    ? code
    : "";
}

function buildUnavailableAdminReportResponse() {
  return {
    ok: false,
    status: "not_found",
    backendVersion: BACKEND_VERSION,
    message: "Отчёт недоступен."
  };
}

function sanitizeAdminResult(row) {
  row = row && typeof row === "object" ? row : {};
  const testId = Object.prototype.hasOwnProperty.call(TEST_TITLES_BY_ID, row.testId)
    ? String(row.testId)
    : "unknown";
  const finalScore = Number(row.finalScore || 0);
  const tabSwitches = Number(row.tabSwitches || 0);
  const code = normalizeResultCode(row.code);

  return {
    code: code || "INVALID",
    testId: testId,
    testTitle: TEST_TITLES_BY_ID[testId] || "Неизвестный тест",
    finalScore: finalScore,
    percent: Number(row.percent || 0),
    tabSwitches: tabSwitches,
    date: String(row.date || ""),
    status: row.status === "passed" ? "passed" : "failed",
    badge: getAdminBadge(finalScore, tabSwitches),
    reportCreated: Boolean(row.reportCreated),
    scoreVerification: SCORE_VERIFICATION_CLIENT_REPORTED
  };
}

function getAdminBadge(finalScore, tabSwitches) {
  if (finalScore >= 85 && tabSwitches <= 1) return "Junior Strong";
  if (finalScore >= 70 && tabSwitches <= 2) return "Junior Confirmed";
  if (finalScore >= 60) return "Borderline";
  return "Not Confirmed";
}

function ensureSkillCheckFolders() {
  ensureYandexFolderExists("disk:/skillcheck");
  ensureYandexFolderExists(getReportsFolderPath());
  ensureYandexFolderExists(getParentDiskPath(getAdminFilePath()));
  ensureYandexFolderExists(getParentDiskPath(getAttemptsFilePath()));
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw publicRequestError("empty_request", "Пустой запрос.");
  }
  const body = String(e.postData.contents || "");
  const declaredLength = Number(e.postData.length || e.contentLength || body.length);
  if (body.length > MAX_POST_BODY_CHARS || (isFinite(declaredLength) && declaredLength > MAX_POST_BODY_CHARS)) {
    throw publicRequestError("payload_too_large", "Запрос превышает допустимый размер.");
  }

  const contentType = String(e.postData.type || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType && contentType !== "text/plain" && contentType !== "application/json") {
    throw publicRequestError("unsupported_content_type", "Неподдерживаемый формат запроса.");
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw publicRequestError("invalid_json", "Запрос содержит некорректный JSON.");
  }
  if (!isPlainObject(parsed)) throw publicRequestError("invalid_json_object", "Ожидался JSON-объект.");
  return parsed;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRequiredProperty(name) {
  const value = getScriptProperty(name);
  if (!value) throw new Error("Не настроен Script Property: " + name);
  return value;
}

function getScriptProperty(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function getConfiguredDiskPath(name, defaultValue) {
  return validateSkillCheckDiskPath(getScriptProperty(name) || defaultValue);
}

function getReportsFolderPath() {
  return getConfiguredDiskPath("YANDEX_DISK_REPORTS_FOLDER", DEFAULT_YANDEX_REPORTS_FOLDER);
}

function getAdminFilePath() {
  return getConfiguredDiskPath("YANDEX_DISK_ADMIN_FILE", DEFAULT_YANDEX_ADMIN_FILE);
}

function getAttemptsFilePath() {
  return getConfiguredDiskPath("YANDEX_DISK_ATTEMPTS_FILE", DEFAULT_YANDEX_ATTEMPTS_FILE);
}

function normalizeDiskPath(path) {
  return String(path || "").replace(/\/+/g, "/").replace(/^disk:\//, "disk:/");
}

function validateSkillCheckDiskPath(path) {
  const source = String(path || "");
  const normalized = normalizeDiskPath(source);
  if (/[\u0000-\u001f\u007f]/.test(source) || source.indexOf("..") !== -1 ||
      !/^disk:\/skillcheck(?:\/[A-Za-z0-9._-]+)*$/.test(normalized)) {
    throw new Error("Некорректный путь хранилища SkillCheck.");
  }
  return normalized;
}

function joinDiskPath(folderPath, fileName) {
  return normalizeDiskPath(folderPath).replace(/\/$/, "") + "/" + String(fileName || "").replace(/^\/+/, "");
}

function getParentDiskPath(path) {
  const normalized = normalizeDiskPath(path);
  const index = normalized.lastIndexOf("/");
  return index <= "disk:".length ? "disk:/" : normalized.slice(0, index);
}

function getDiskPathName(path) {
  const normalized = normalizeDiskPath(path).replace(/\/$/, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function safeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTelegramContact(value) {
  let normalized = safeText(value);
  if (!normalized) return "";

  normalized = normalized
    .replace(/^https?:\/\/(?:www\.)?t\.me\//i, "")
    .replace(/^(?:www\.)?t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/[\/?#].*$/, "")
    .trim();

  if (!/^[A-Za-z0-9_]{1,64}$/.test(normalized)) {
    throw new Error("Некорректный формат Telegram.");
  }

  return "@" + normalized;
}

function sanitizeErrorMessage(error) {
  const message = String(error && error.message ? error.message : error || "Ошибка backend.");
  if (message.indexOf("YANDEX_DISK_TOKEN") !== -1) return "Backend не настроен.";
  if (message.indexOf("OAuth") !== -1) return "Ошибка доступа к хранилищу.";
  if (message.indexOf("Yandex API error") !== -1) return "Ошибка обмена с Яндекс Диском.";
  return message;
}

function sanitizeDiagnosticMessage(error) {
  const message = String(error && error.message ? error.message : error || "Ошибка backend.");
  return sanitizeYandexResponseText(message);
}

function sanitizeYandexResponseText(text) {
  return String(text || "")
    .replace(/OAuth\s+[A-Za-z0-9._~+/=-]+/g, "OAuth ***")
    .replace(/YANDEX_DISK_TOKEN\s*[:=]\s*[^\s,;]+/g, "YANDEX_DISK_TOKEN=***")
    .replace(/ADMIN_PASSWORD\s*[:=]\s*[^\s,;]+/g, "ADMIN_PASSWORD=***")
    .replace(/ATTEMPT_HASH_SALT\s*[:=]\s*[^\s,;]+/g, "ATTEMPT_HASH_SALT=***")
    .slice(0, 500);
}

function sanitizeYandexUrl(url) {
  return String(url || "")
    .replace(/oauth_token=[^&]+/gi, "oauth_token=***")
    .replace(/access_token=[^&]+/gi, "access_token=***")
    .slice(0, 500);
}

function sanitizeYandexUploadUrl(url) {
  const match = String(url || "").match(/^(https?:\/\/[^\/?#]+)/i);
  return match ? match[1] + "/..." : "<missing>";
}

function sanitizeYandexResponseHeaders(headers) {
  const source = headers || {};
  const safeHeaders = {};
  const allowedNames = {
    "content-length": true,
    "content-type": true,
    "date": true,
    "server": true,
    "x-error-code": true,
    "x-error-message": true,
    "x-request-id": true,
    "x-yandex-error": true
  };

  Object.keys(source).forEach(name => {
    if (allowedNames[String(name).toLowerCase()]) {
      safeHeaders[name] = String(source[name]).slice(0, 200);
    }
  });

  return sanitizeYandexResponseText(JSON.stringify(safeHeaders));
}

function authorizeYandexDisk() {
  const token = PropertiesService.getScriptProperties().getProperty("YANDEX_DISK_TOKEN");
  const response = UrlFetchApp.fetch("https://cloud-api.yandex.net/v1/disk/", {
    method: "get",
    headers: {
      Authorization: "OAuth " + token
    },
    muteHttpExceptions: true
  });
  Logger.log(response.getResponseCode());
}
