const BACKEND_VERSION = "yandex-disk-mvp-2026-06-02-diag1";
const SUCCESS_THRESHOLD = 80;
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

  if (action === "adminResults") {
    try {
      return jsonOrJsonpResponse(getAdminResults(String(params.password || "")), params.callback);
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      return jsonOrJsonpResponse({
        ok: false,
        status: "error",
        message: sanitizeErrorMessage(error),
        errorMessage: sanitizeDiagnosticMessage(error)
      }, params.callback);
    }
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

    return jsonResponse(saveTestResult(data));
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse({
      ok: false,
      status: "error",
      message: sanitizeErrorMessage(error),
      errorMessage: sanitizeDiagnosticMessage(error)
    });
  }
}

function saveTestResult(resultData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let savedAttempt = false;
  let savedAdmin = false;
  let reportCreated = false;
  let reportPath = "";

  try {
    ensureSkillCheckFolders();

    const testId = String(resultData.testId || "").trim();
    const email = String(resultData.email || "").trim().toLowerCase();
    const fingerprint = String(resultData.browserFingerprint || "").trim();
    const attemptCheck = checkAttemptHash(testId, email, fingerprint);

    if (!attemptCheck.allowed) {
      return Object.assign({}, attemptCheck, {
        ok: false,
        status: "blocked",
        blocked: true,
        savedAttempt: false,
        savedAdmin: false,
        reportCreated: false,
        reportPath: "",
        errorMessage: attemptCheck.message || "Повторная попытка заблокирована."
      });
    }

    const code = generateUniqueResultCode(testId);
    const now = new Date();
    const finalScore = Number(resultData.finalScore || 0);
    const percent = Number(resultData.percent || resultData.score || 0);
    const status = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";

    // Personal data is processed only here and only for successful TXT reports.
    if (status === "passed") {
      reportPath = joinDiskPath(getReportsFolderPath(), code + ".txt");
      uploadTextToYandexDisk(reportPath, buildTxtReport(Object.assign({}, resultData, {
        code: code,
        status: status,
        completedAt: now.toISOString()
      })));
      reportCreated = true;
    }

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
      reportCode: code
    });
    savedAdmin = true;

    saveAttemptHash({
      hash: hashAttempt(testId, email, fingerprint),
      testId: testId,
      code: code,
      date: now.toISOString(),
      status: status
    });
    savedAttempt = true;

    return {
      ok: true,
      status: "ok",
      resultCode: code,
      code: code,
      testId: testId,
      finalScore: finalScore,
      percent: percent,
      passStatus: status,
      savedAttempt: savedAttempt,
      savedAdmin: savedAdmin,
      reportCreated: reportCreated,
      reportPath: reportPath,
      errorMessage: "",
      message: "Сохраните код результата: " + code
    };
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return {
      ok: false,
      status: "error",
      savedAttempt: savedAttempt,
      savedAdmin: savedAdmin,
      reportCreated: reportCreated,
      reportPath: reportPath,
      errorMessage: sanitizeDiagnosticMessage(error),
      message: sanitizeErrorMessage(error)
    };
  } finally {
    lock.releaseLock();
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
  const existingCodes = {};
  adminResults.forEach(result => {
    if (result && result.code) existingCodes[String(result.code)] = true;
  });

  for (let i = 0; i < 20; i++) {
    const code = generateResultCode(testId);
    if (!existingCodes[code]) return code;
  }

  throw new Error("Не удалось создать уникальный код результата.");
}

function buildTxtReport(resultData) {
  const answers = Array.isArray(resultData.answers) ? resultData.answers : [];
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
  report += "Итоговый балл: " + Number(resultData.finalScore || 0) + "\n";
  report += "Процент: " + Number(resultData.percent || resultData.score || 0) + "\n";
  report += "Штрафы: " + Number(resultData.penalty || 0) + "\n";
  report += "Уходы со вкладки: " + Number(resultData.tabSwitches || 0) + "\n";
  report += "Статус: " + safeText(resultData.status || resultData.passStatus || "") + "\n";
  report += "Итоговый вывод: " + safeText(resultData.recommendation || resultData.finalDecision || "") + "\n\n";

  report += "ВОПРОСЫ И ОТВЕТЫ\n";
  report += "----------------\n";
  answers.forEach((answer, index) => {
    report += "Вопрос " + (index + 1) + ": " + safeText(answer.question) + "\n";
    report += "Ответ кандидата: " + safeText(answer.selectedAnswer) + "\n";
    report += "Правильный ответ: " + safeText(answer.correctAnswer) + "\n";
    report += "Результат: " + (answer.isCorrect ? "верно" : "неверно") + "\n";
    report += "Баллы: " + Number(answer.earnedPoints || 0) + "/" + Number(answer.points || 0) + "\n";
    if (answer.comment) report += "Комментарий: " + safeText(answer.comment) + "\n";
    report += "\n";
  });

  return report;
}

function hashAttempt(testId, email, fingerprint) {
  const salt = getRequiredProperty("ATTEMPT_HASH_SALT");
  const source = String(testId || "") + String(email || "").toLowerCase() + String(fingerprint || "") + salt;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8);
  return digest.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
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

  const hash = hashAttempt(testId, email, fingerprint);
  const attempts = readJsonFromYandexDisk(getAttemptsFilePath(), []);
  const found = attempts.find(attempt => attempt && attempt.testId === testId && attempt.hash === hash);

  if (found) {
    return {
      allowed: false,
      message: "Этот тест уже был пройден. Повторное прохождение запрещено.",
      testId: testId,
      foundPreviousAttempt: true,
      code: found.code || "",
      previousAttemptDate: found.date || "",
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
    attemptsFileExists: false
  };

  const diskProbe = probeYandexDiskAccess();
  status.yandexDiskAccess = diskProbe.ok;
  status.yandexStatusCode = diskProbe.statusCode;
  status.yandexErrorMessage = diskProbe.errorMessage;

  if (status.yandexDiskAccess) {
    try {
      ensureSkillCheckFolders();
      readJsonFromYandexDisk(adminFile, []);
      readJsonFromYandexDisk(attemptsFile, []);
      status.adminFileExists = yandexResourceExists(adminFile);
      status.attemptsFileExists = yandexResourceExists(attemptsFile);
    } catch (error) {
      status.yandexErrorMessage = sanitizeDiagnosticMessage(error);
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
  try {
    yandexApiRequest(
      "get",
      "https://cloud-api.yandex.net/v1/disk/resources?path=" + encodeURIComponent(normalizeDiskPath(path)),
      null,
      null
    );
    return true;
  } catch (error) {
    if (String(error.message || "").indexOf("Yandex API error 404") !== -1) return false;
    throw error;
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
  ensureYandexFolderExists(getParentDiskPath(path));
  const uploadUrl = "https://cloud-api.yandex.net/v1/disk/resources/upload?path=" +
    encodeURIComponent(normalizeDiskPath(path)) + "&overwrite=true";
  const uploadInfo = yandexApiRequest("get", uploadUrl, null, null);

  const response = UrlFetchApp.fetch(uploadInfo.href, {
    method: "put",
    payload: content,
    contentType: "text/plain; charset=utf-8",
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      "Yandex upload error " + status +
      " for " + normalizeDiskPath(path) +
      ": " + sanitizeYandexResponseText(response.getContentText())
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
  results.push({
    code: String(summaryData.code || ""),
    testId: String(summaryData.testId || ""),
    testTitle: String(summaryData.testTitle || ""),
    finalScore: Number(summaryData.finalScore || 0),
    percent: Number(summaryData.percent || 0),
    tabSwitches: Number(summaryData.tabSwitches || 0),
    date: String(summaryData.date || ""),
    status: summaryData.status === "passed" ? "passed" : "failed",
    badge: String(summaryData.badge || ""),
    reportCreated: Boolean(summaryData.reportCreated),
    reportPath: String(summaryData.reportPath || ""),
    reportCode: String(summaryData.reportCode || summaryData.code || "")
  });
  writeJsonToYandexDisk(path, results);
}

function saveAttemptHash(attemptData) {
  const path = getAttemptsFilePath();
  const attempts = readJsonFromYandexDisk(path, []);
  attempts.push({
    hash: String(attemptData.hash || ""),
    testId: String(attemptData.testId || ""),
    code: String(attemptData.code || ""),
    date: String(attemptData.date || ""),
    status: attemptData.status === "passed" ? "passed" : "failed"
  });
  writeJsonToYandexDisk(path, attempts);
}

function getAdminResults(password) {
  if (password !== getRequiredProperty("ADMIN_PASSWORD")) {
    return {
      ok: false,
      status: "error",
      message: "Доступ запрещён."
    };
  }

  return {
    ok: true,
    status: "ok",
    results: readJsonFromYandexDisk(getAdminFilePath(), [])
  };
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

function safeText(value) {
  return String(value === undefined || value === null ? "" : value).replace(/\r/g, " ").trim();
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
