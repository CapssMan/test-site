const BACKEND_VERSION = "yandex-disk-mvp-2026-07-20-6";
const SUCCESS_THRESHOLD = 80;
const RETAKE_WINDOW_DAYS = 21;
const RETAKE_WINDOW_MS = RETAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const MAX_ADMIN_REPORT_CHARS = 1000000;
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

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || "").trim();

  if (action === "checkAttempt") {
    let result;

    try {
      result = checkAttemptHash(
        String(params.testId || "").trim(),
        String(params.email || "").trim().toLowerCase(),
        String(params.browserFingerprint || "").trim()
      );
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      result = {
        allowed: false,
        status: "error",
        message: sanitizeErrorMessage(error)
      };
    }

    return jsonOrJsonpResponse(result, params.callback || "callback");
  }

  if (action === "health") {
    try {
      return jsonOrJsonpResponse(buildHealthStatus(), params.callback);
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      return jsonOrJsonpResponse({
        ok: false,
        backendVersion: BACKEND_VERSION,
        yandexErrorMessage: sanitizeDiagnosticMessage(error),
        errorMessage: sanitizeDiagnosticMessage(error)
      }, params.callback);
    }
  }

  if (action === "adminResults" || action === "adminReport") {
    return jsonOrJsonpResponse({
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Для защищённых административных операций требуется POST-запрос."
    }, params.callback);
  }

  return jsonResponse({
    ok: true,
    status: "ok",
    message: "SkillCheck Apps Script backend работает через Яндекс Диск API."
  });
}

function doPost(e) {
  try {
    const data = parseRequestBody(e);

    if (data.action === "getAdminResults" || data.action === "adminResults") {
      return jsonResponse(getAdminResults(String(data.password || "")));
    }

    if (data.action === "getAdminReport" || data.action === "adminReport") {
      return jsonResponse(getAdminReport(String(data.password || ""), String(data.code || "")));
    }

    if (data.action === "checkAttempt") {
      return jsonResponse(checkAttemptHash(
        String(data.testId || "").trim(),
        String(data.email || "").trim().toLowerCase(),
        String(data.browserFingerprint || "").trim()
      ));
    }

    return jsonResponse(saveTestResult(data));
  } catch (error) {
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
    const payloadHash = buildSubmissionPayloadHash(Object.assign({}, resultData, {
      testId: testId,
      email: email,
      browserFingerprint: fingerprint,
      telegram: telegram,
      finalScore: finalScore,
      percent: percent
    }));
    failureStage = "existing-result";
    const existingResult = findAdminResultByRequestId(requestId);

    if (existingResult) {
      if (String(existingResult.testId || "") !== testId) {
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
      if (String(existingAttempt.testId || "") !== testId ||
          String(existingAttempt.payloadHash || "") !== payloadHash ||
          !String(existingAttempt.code || "")) {
        return buildSubmissionConflictResponse();
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
      uploadTextToYandexDisk(reportPath, buildTxtReport(Object.assign({}, resultData, {
        code: code,
        status: status,
        telegram: telegram,
        completedAt: now.toISOString()
      })));
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
      requestId: requestId
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
      submissionState: "completed",
      finalScore: finalScore,
      percent: percent,
      reportCreated: reportCreated
    });
    failureStage = "done";
    return buildSavedResultResponse({
      code: code,
      testId: testId,
      finalScore: finalScore,
      percent: percent,
      status: status,
      reportCreated: reportCreated
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
  report += "Дата и время прохождения: " + safeText(resultData.completedAt) + "\n\n";

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
    if (!isFinite(attemptTime) || now - attemptTime >= RETAKE_WINDOW_MS) return false;

    const emailMatches = Boolean(hashes.emailHash && attempt.emailHash === hashes.emailHash);
    const fingerprintMatches = Boolean(hashes.fingerprintHash && attempt.fingerprintHash === hashes.fingerprintHash);
    const legacyMatches = Boolean(attempt.hash && attempt.hash === legacyHash);
    return emailMatches || fingerprintMatches || legacyMatches;
  });

  if (found) {
    const previousAttemptTime = new Date(found.date).getTime();
    const nextAttemptTime = previousAttemptTime + RETAKE_WINDOW_MS;
    return {
      allowed: false,
      message: "Этот тест уже был пройден. Повторное прохождение пока недоступно.",
      testId: testId,
      foundPreviousAttempt: true,
      code: found.code || "",
      previousAttemptDate: found.date || "",
      nextDate: new Date(nextAttemptTime).toISOString(),
      daysLeft: Math.max(1, Math.ceil((nextAttemptTime - now) / (24 * 60 * 60 * 1000))),
      status: found.status || ""
    };
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
    requestId: normalizedRequestId
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
    submissionState: attemptData.submissionState === "completed" ? "completed" : "reserved",
    finalScore: Number(attemptData.finalScore || 0),
    percent: Number(attemptData.percent || 0),
    reportCreated: Boolean(attemptData.reportCreated)
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
  if (password !== getRequiredProperty("ADMIN_PASSWORD")) {
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
  if (password !== getRequiredProperty("ADMIN_PASSWORD")) {
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

  return {
    code: String(row.code || ""),
    testId: testId,
    testTitle: TEST_TITLES_BY_ID[testId] || "Неизвестный тест",
    finalScore: finalScore,
    percent: Number(row.percent || 0),
    tabSwitches: tabSwitches,
    date: String(row.date || ""),
    status: row.status === "passed" ? "passed" : "failed",
    badge: getAdminBadge(finalScore, tabSwitches),
    reportCreated: Boolean(row.reportCreated)
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
    throw new Error("Пустой запрос.");
  }
  return JSON.parse(e.postData.contents);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonpResponse(payload, callback) {
  const safeCallback = String(callback || "").replace(/[^\w.$]/g, "");
  if (!safeCallback) return jsonResponse(payload);

  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(payload) + ")")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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
  return getScriptProperty(name) || defaultValue;
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
  return String(value === undefined || value === null ? "" : value).replace(/\r/g, " ").trim();
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
