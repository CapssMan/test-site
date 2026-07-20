const BACKEND_VERSION = "yandex-disk-mvp-2026-07-20-13";
const CANDIDATE_FRONTEND_BUILD = "2026.07.20.12";
const ADMIN_FRONTEND_BUILD = "2026.07.20.12";
const SUCCESS_THRESHOLD = 80;
const RETAKE_WINDOW_DAYS = 21;
const RETAKE_WINDOW_MS = RETAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const RESERVATION_TTL_MS = 30 * 60 * 1000;
const MAX_ADMIN_REPORT_CHARS = 1000000;
const MAX_POST_BODY_CHARS = 250000;
const MAX_GENERATED_REPORT_CHARS = 200000;
const MAX_ANSWERS_PER_RESULT = 40;
const SCORE_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
const SCORE_VERIFICATION_SERVER = "server-verified";
const AUTHORITATIVE_API_VERSION = "attempt-v2";
const AUTHORITATIVE_SCORING_VERSION = "authoritative-v1";
const TELEMETRY_VERIFICATION_CLIENT_REPORTED = "client-reported-unverified";
const PRIVACY_CONSENT_VERSION = "skillcheck-pd-consent-2026-07-20-v1";
const LEGAL_PILOT_APPROVAL_PROPERTY = "LEGAL_PILOT_APPROVED";
const ATTEMPT_ACTIVE_TTL_MS = 6 * 60 * 60 * 1000;
const AUTHORITATIVE_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_YANDEX_INVITES_FILE = "disk:/skillcheck/private/invites-v1.json";
const DEFAULT_YANDEX_SESSIONS_FILE = "disk:/skillcheck/private/attempt-sessions-v1.json";
const DEFAULT_YANDEX_PRIVATE_BANKS_FOLDER = "disk:/skillcheck/private/banks";
const DEFAULT_YANDEX_DELETION_LOG_FILE = "disk:/skillcheck/private/deletion-log-v1.json";
const DEFAULT_YANDEX_DELETION_BACKUPS_FOLDER = "disk:/skillcheck/private/deletion-backups";
const DEFAULT_YANDEX_OPERATIONAL_BACKUPS_FOLDER = "disk:/skillcheck/private/backups-v1";
const DELETION_PREVIEW_TTL_SECONDS = 10 * 60;
const RETENTION_AUTOMATION_ENABLED = false;
const OPERATIONAL_BACKUP_SCHEMA_VERSION = 1;
const OPERATIONAL_BACKUP_LIMIT_PER_STORE = 12;
const OPERATIONAL_CORRUPT_ARTIFACT_LIMIT_PER_STORE = 3;
const MAX_OPERATIONAL_STORE_ROWS = 100000;
const MAX_OPERATIONAL_STORE_CHARS = 20 * 1024 * 1024;
const PROTECTED_DIAGNOSTIC_PROPERTY_NAMES = [
  "YANDEX_DISK_TOKEN",
  "YANDEX_DISK_REPORTS_FOLDER",
  "YANDEX_DISK_ADMIN_FILE",
  "YANDEX_DISK_ATTEMPTS_FILE",
  "YANDEX_DISK_INVITES_FILE",
  "YANDEX_DISK_ATTEMPT_SESSIONS_FILE",
  "YANDEX_DISK_PRIVATE_BANKS_FOLDER",
  "YANDEX_DISK_OPERATIONAL_BACKUPS_FOLDER",
  "ATTEMPT_HASH_SALT",
  "ADMIN_PASSWORD",
  "ATTEMPT_SIGNING_SECRET_V1",
  "INVITE_CODE_SECRET_V1",
  "IDENTITY_HASH_SECRET_V1",
  "LEGAL_PILOT_APPROVED",
  "ATTEMPT_ISSUANCE_ENABLED"
];
const LEGACY_PUBLIC_BANK_COMMIT = "70e569cf267e043aabc780e81cc4307db7e149b1";
const LEGACY_PUBLIC_BANK_BASE_URL = "https://raw.githubusercontent.com/CapssMan/test-site/" +
  LEGACY_PUBLIC_BANK_COMMIT + "/data/";
const LEGACY_PUBLIC_BANK_SHA256_BY_TEST_ID = {
  "fa-junior": "41470aeada4be474815b0e74dbae8d254a5ace5bb3ad83f935fff841d110e67d",
  "ca-junior": "5e9e29d3ca3c656737ccf89751767012105910d1fea9f99342688a1c67699aa1",
  "fpa-junior": "1e36bf09de876abefce0776e0ac16bb654c53263ca7ecb0d751176f5769395b4",
  "acc-junior": "53aaa90ae97d60bd01cbe24678da2b576fdaca7aed76591ed97b9b3fb1498efd",
  "bi-junior": "5555af493869d59a2410eb04b4a39a188876866be201697526130516b2950956",
  "dev-quick": "5b8c5dbfb3dd3ced6fabe76cc2e2c67a7df669b36c0c1061020bfa322152f682"
};
const OPTION_ID_NAMESPACE = "skillcheck-option-v1";
const REQUIRED_AUTHORITATIVE_PROPERTIES = [
  "ATTEMPT_SIGNING_SECRET_V1",
  "INVITE_CODE_SECRET_V1",
  "IDENTITY_HASH_SECRET_V1"
];
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

const EXPECTED_BANK_QUESTIONS_BY_TEST_ID = {
  "fa-junior": 40,
  "ca-junior": 80,
  "fpa-junior": 40,
  "acc-junior": 40,
  "bi-junior": 40,
  "dev-quick": 1
};

const LEGACY_BANK_VERSIONS_BY_TEST_ID = {
  "fa-junior": "FA Junior v2.3",
  "ca-junior": "CA Junior v2.0",
  "fpa-junior": "FP&A Junior v2.0",
  "acc-junior": "ACC Junior v2.0",
  "bi-junior": "BI Junior v2.0",
  "dev-quick": "Dev Quick Smoke Test v1.0"
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
  "fa-junior": "FA Junior v3.0",
  "ca-junior": "CA Junior v3.0",
  "fpa-junior": "FP&A Junior v3.0",
  "acc-junior": "ACC Junior v3.0",
  "bi-junior": "BI Junior v3.0",
  "dev-quick": "DEV Quick v2.0"
};

const BANK_VERSIONS_BY_ID = {
  "fa-junior": "FA Junior v3.0",
  "ca-junior": "CA Junior v3.0",
  "fpa-junior": "FP&A Junior v3.0",
  "acc-junior": "ACC Junior v3.0",
  "bi-junior": "BI Junior v3.0",
  "dev-quick": "DEV Quick v2.0"
};

const TEST_VERSIONS_BY_ID_AUTHORITATIVE = TEST_VERSIONS_BY_ID;

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
    return jsonResponse(buildClientUpgradeRequiredResponse());
  }

  if (action === "beginAttempt" || action === "saveResult") {
    return jsonResponse(methodNotAllowedResponse("Операция доступна только через POST."));
  }

  if (action === "health") {
    return jsonResponse(buildPublicHealthStatus());
  }

  if (["adminResults", "adminReport", "adminCreateInvite", "adminInvites", "adminRevokeInvite", "adminDeletionPreview", "adminDeleteResult", "adminDiagnostics"].indexOf(action) !== -1) {
    return jsonResponse(methodNotAllowedResponse("Для административных операций требуется POST-запрос."));
  }

  if (action) {
    return jsonResponse(buildValidationErrorResponse("unknown_action", "Неизвестное действие запроса."));
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
      if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
        return jsonResponse(buildClientUpgradeRequiredResponse());
      }
      assertAllowedObjectKeys(data, ["action", "apiVersion", "password"], "adminResults");
      return jsonResponse(getAdminResults(String(data.password || "")));
    }

    if (action === "getAdminReport" || action === "adminReport") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "report");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
        return jsonResponse(buildClientUpgradeRequiredResponse());
      }
      assertAllowedObjectKeys(data, ["action", "apiVersion", "password", "code"], "adminReport");
      return jsonResponse(getAdminReport(String(data.password || ""), String(data.code || "")));
    }

    if (action === "adminCreateInvite") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "invite-create");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(adminCreateInvite(data));
    }

    if (action === "adminInvites") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "invite-list");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(adminListInvites(data));
    }

    if (action === "adminRevokeInvite") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "invite-revoke");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(adminRevokeInvite(data));
    }

    if (action === "adminDeletionPreview") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "deletion-preview");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(adminPreviewResultDeletion(data));
    }

    if (action === "adminDeleteResult") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "deletion-commit");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      return jsonResponse(adminDeleteResult(data));
    }

    if (action === "adminDiagnostics") {
      const adminGuard = guardAdminRequest(String(data.password || ""), "diagnostics");
      if (!adminGuard.ok) return jsonResponse(adminGuard.response);
      if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
        return jsonResponse(buildClientUpgradeRequiredResponse());
      }
      assertAllowedObjectKeys(data, ["action", "apiVersion", "password"], "adminDiagnostics");
      return jsonResponse(getAdminDiagnostics(String(data.password || "")));
    }

    if (action === "checkAttempt") {
      return jsonResponse(buildClientUpgradeRequiredResponse());
    }

    if (action === "beginAttempt") {
      if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
        return jsonResponse(buildClientUpgradeRequiredResponse());
      }
      const validatedBegin = validateBeginAttemptRequest(data);
      if (!validatedBegin.ok) return jsonResponse(validatedBegin.response);
      const beginLimit = consumeRateLimit("begin-attempt", sha256Hex(validatedBegin.data.inviteCode), 6, 300);
      const globalBeginLimit = consumeRateLimit("begin-attempt-global", "shared", 90, 60);
      if (!beginLimit.allowed || !globalBeginLimit.allowed) {
        return jsonResponse(buildRateLimitedResponse(Math.max(beginLimit.retryAfterSeconds, globalBeginLimit.retryAfterSeconds)));
      }
      return jsonResponse(beginAuthoritativeAttempt(validatedBegin.data));
    }

    if (action === "saveResult") {
      if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION || !data.attemptToken) {
        return jsonResponse(buildClientUpgradeRequiredResponse());
      }
      const validatedResult = validateAuthoritativeSubmissionRequest(data);
      if (!validatedResult.ok) return jsonResponse(validatedResult.response);
      const preverifiedToken = verifyAttemptToken(validatedResult.data.attemptToken, true);
      if (!preverifiedToken.valid ||
          preverifiedToken.claims.attemptId !== validatedResult.data.attemptId ||
          preverifiedToken.claims.tid !== validatedResult.data.testId ||
          preverifiedToken.claims.bv !== validatedResult.data.bankVersion) {
        return jsonResponse(buildAttemptUnavailableResponse());
      }
      const submissionLimit = consumeRateLimit("save-result", preverifiedToken.claims.jti, 6, 60);
      const globalSubmissionLimit = consumeRateLimit("save-result-global", "shared", 60, 60);
      if (!submissionLimit.allowed || !globalSubmissionLimit.allowed) {
        return jsonResponse(buildRateLimitedResponse(Math.max(submissionLimit.retryAfterSeconds, globalSubmissionLimit.retryAfterSeconds)));
      }
      return jsonResponse(saveAuthoritativeTestResult(validatedResult.data));
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

function getAdminDiagnostics(password) {
  if (!isAdminPasswordValid(password)) {
    return {
      ok: false,
      status: "error",
      backendVersion: BACKEND_VERSION,
      message: "Доступ запрещён."
    };
  }
  return buildProtectedDiagnostics();
}

function verifyProtectedDiagnosticsForOwner() {
  const status = buildProtectedDiagnostics();
  if (!status.ok || status.status !== "healthy" || status.stores.length !== getOperationalStoreKeys().length) {
    const lastError = status.lastError || { component: "backend", code: "diagnostic_check_failed" };
    throw new Error("Protected diagnostics failed: component=" + lastError.component + "; code=" + lastError.code);
  }
  console.log(
    "Protected diagnostics healthy: backend=" + status.backendVersion +
    "; stores=" + status.stores.length +
    "; results=" + status.stores.filter(store => store.key === "admin-results")[0].rowCount +
    "; attempts=" + status.stores.filter(store => store.key === "attempts")[0].rowCount
  );
  return status;
}

function buildProtectedDiagnostics() {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const properties = PropertiesService.getScriptProperties();
  const requiredNames = [
    "YANDEX_DISK_TOKEN", "ATTEMPT_HASH_SALT", "ADMIN_PASSWORD",
    "ATTEMPT_SIGNING_SECRET_V1", "INVITE_CODE_SECRET_V1", "IDENTITY_HASH_SECRET_V1"
  ];
  const propertyPresence = PROTECTED_DIAGNOSTIC_PROPERTY_NAMES.map(name => ({
    name: name,
    present: Boolean(properties.getProperty(name)),
    required: requiredNames.indexOf(name) !== -1
  }));
  const missingRequired = propertyPresence
    .filter(item => requiredNames.indexOf(item.name) !== -1 && !item.present)
    .map(item => item.name);
  const diskProbe = probeYandexDiskAccess();
  const stores = [];
  const errors = [];

  if (diskProbe.ok) {
    getOperationalStoreKeys().forEach(storeKey => {
      const store = buildProtectedDiagnosticStoreStatus(storeKey);
      stores.push(store);
      if (store.error) errors.push(store.error);
    });
  } else {
    errors.push(buildProtectedDiagnosticError("storage", new Error(diskProbe.errorMessage || "Storage probe failed.")));
  }

  const reports = diskProbe.ok
    ? buildProtectedDiagnosticReportsStatus()
    : { state: "unavailable", itemCount: null, lastModifiedAt: "", error: null };
  if (reports.error) errors.push(reports.error);

  return {
    ok: errors.length === 0 && missingRequired.length === 0,
    status: errors.length === 0 && missingRequired.length === 0 ? "healthy" : "degraded",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    frontendVersions: {
      candidate: CANDIDATE_FRONTEND_BUILD,
      admin: ADMIN_FRONTEND_BUILD
    },
    backendTime: checkedAt,
    checkedAt: checkedAt,
    durationMs: Math.max(0, Date.now() - startedAt),
    yandexDisk: {
      accessible: Boolean(diskProbe.ok),
      statusCode: Number(diskProbe.statusCode || 0)
    },
    gates: {
      legalPilotApproved: isLegalPilotApproved(),
      attemptIssuanceEnabled: getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") === "true",
      retentionAutomationEnabled: RETENTION_AUTOMATION_ENABLED === true
    },
    properties: propertyPresence,
    missingRequiredProperties: missingRequired,
    stores: stores,
    reports: reports,
    lastWriteAt: newestProtectedDiagnosticTimestamp(stores.map(store => store.lastModifiedAt).concat([reports.lastModifiedAt])),
    lastError: errors.length ? errors[0] : null
  };
}

function buildProtectedDiagnosticStoreStatus(storeKey) {
  const descriptor = getOperationalStoreDescriptor(storeKey);
  const empty = {
    key: descriptor.storeKey,
    state: "unknown",
    sizeBytes: null,
    rowCount: null,
    lastModifiedAt: "",
    lastRecordAt: "",
    error: null
  };
  try {
    const metadata = getYandexResourceMetadata(descriptor.path);
    if (!metadata.exists) {
      empty.state = "missing";
      empty.error = buildProtectedDiagnosticError(descriptor.storeKey, new Error("Required store is missing."));
      return empty;
    }
    if (metadata.type !== "file" || metadata.publicKey || metadata.publicUrl || metadata.shared) {
      empty.state = "invalid";
      empty.error = buildProtectedDiagnosticError(descriptor.storeKey, new Error("Private store visibility or type check failed."));
      return empty;
    }
    const rows = readRequiredJsonArray(descriptor.path, descriptor.label);
    empty.state = "ok";
    empty.sizeBytes = Math.max(0, Number(metadata.size || 0));
    empty.rowCount = rows.length;
    empty.lastModifiedAt = normalizeProtectedDiagnosticTimestamp(metadata.modified);
    empty.lastRecordAt = newestProtectedDiagnosticRowTimestamp(rows);
    return empty;
  } catch (error) {
    empty.state = "error";
    empty.error = buildProtectedDiagnosticError(descriptor.storeKey, error);
    return empty;
  }
}

function buildProtectedDiagnosticReportsStatus() {
  const result = { state: "unknown", itemCount: null, lastModifiedAt: "", error: null };
  try {
    const metadata = getYandexResourceMetadata(getReportsFolderPath());
    if (!metadata.exists) {
      result.state = "missing";
      result.error = buildProtectedDiagnosticError("reports", new Error("Reports folder is missing."));
      return result;
    }
    if (metadata.type !== "dir" || metadata.publicKey || metadata.publicUrl || metadata.shared) {
      result.state = "invalid";
      result.error = buildProtectedDiagnosticError("reports", new Error("Reports folder visibility or type check failed."));
      return result;
    }
    const listing = listYandexFolderContents(getReportsFolderPath());
    if (!listing.exists || listing.type !== "dir" || listing.error ||
        listing.items.some(item => item && (item.publicKey || item.publicUrl || item.shared))) {
      throw new Error("Reports folder listing failed privacy checks.");
    }
    result.state = "ok";
    result.itemCount = listing.items.filter(item => item && item.type === "file").length;
    result.lastModifiedAt = normalizeProtectedDiagnosticTimestamp(metadata.modified);
    return result;
  } catch (error) {
    result.state = "error";
    result.error = buildProtectedDiagnosticError("reports", error);
    return result;
  }
}

function newestProtectedDiagnosticRowTimestamp(rows) {
  const fields = [
    "updatedAt", "completedAt", "date", "storedAt", "reservedAt", "startedAt",
    "issuedAt", "activatedAt", "createdAt", "privacyConsentedAt"
  ];
  const timestamps = [];
  (Array.isArray(rows) ? rows : []).forEach(row => {
    if (!row || typeof row !== "object") return;
    fields.forEach(field => timestamps.push(row[field]));
  });
  return newestProtectedDiagnosticTimestamp(timestamps);
}

function newestProtectedDiagnosticTimestamp(values) {
  let newest = 0;
  (Array.isArray(values) ? values : []).forEach(value => {
    const timestamp = Date.parse(String(value || ""));
    if (Number.isFinite(timestamp) && timestamp > newest) newest = timestamp;
  });
  return newest ? new Date(newest).toISOString() : "";
}

function normalizeProtectedDiagnosticTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function buildProtectedDiagnosticError(component, error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  let code = "diagnostic_check_failed";
  let publicMessage = "Проверка компонента завершилась ошибкой.";
  if (message.indexOf("missing") !== -1 || message.indexOf("не настроен") !== -1) {
    code = "required_resource_missing";
    publicMessage = "Обязательный ресурс отсутствует.";
  } else if (message.indexOf("public") !== -1 || message.indexOf("share") !== -1 || message.indexOf("visibility") !== -1) {
    code = "private_storage_visibility_error";
    publicMessage = "Закрытое хранилище не прошло проверку приватности.";
  } else if (message.indexOf("yandex") !== -1 || message.indexOf("oauth") !== -1 || message.indexOf("storage") !== -1) {
    code = "storage_unavailable";
    publicMessage = "Хранилище временно недоступно.";
  } else if (message.indexOf("corrupt") !== -1 || message.indexOf("json") !== -1 || message.indexOf("поврежд") !== -1) {
    code = "invalid_private_json";
    publicMessage = "Закрытое JSON-хранилище не прошло проверку.";
  }
  return {
    component: String(component || "backend").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "backend",
    code: code,
    message: publicMessage
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

function buildClientUpgradeRequiredResponse() {
  return {
    ok: false,
    status: "client_upgrade_required",
    retryable: false,
    failureCode: "client_upgrade_required",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    message: "Версия страницы устарела. Обновите страницу и начните новую попытку."
  };
}

function buildAttemptUnavailableResponse() {
  return {
    ok: false,
    status: "unavailable",
    retryable: false,
    failureCode: "attempt_unavailable",
    backendVersion: BACKEND_VERSION,
    message: "Не удалось начать попытку. Проверьте приглашение или обратитесь к организатору."
  };
}

function buildAuthoritativeStorageErrorResponse() {
  return {
    ok: false,
    status: "error",
    retryable: true,
    failureCode: "temporary_storage_error",
    backendVersion: BACKEND_VERSION,
    message: "Сервис временно недоступен. Повторите действие позже."
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

function validateBeginAttemptRequest(data) {
  try {
    assertAllowedObjectKeys(data, [
      "action", "apiVersion", "beginRequestId", "testId", "inviteCode", "email",
      "browserFingerprint", "clientBuild", "privacyConsent", "privacyConsentVersion", "ageConfirmed"
    ], "beginAttempt");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
      throw publicRequestError("client_upgrade_required", "Версия страницы устарела. Обновите страницу.");
    }
    const beginRequestId = String(data.beginRequestId || "").trim();
    if (!/^scb_[a-z0-9]{24,40}$/.test(beginRequestId)) {
      throw publicRequestError("invalid_begin_request_id", "Некорректный идентификатор начала попытки.");
    }
    const testId = validateTestId(data.testId);
    assertPublicTestEnabled(testId);
    const inviteCode = normalizeInviteCode(data.inviteCode);
    if (!inviteCode) return { ok: false, response: buildAttemptUnavailableResponse() };
    const privacyConsent = validateBoolean(data.privacyConsent, "Согласие на обработку персональных данных");
    const privacyConsentVersion = validateBoundedText(data.privacyConsentVersion, 100, true, "Версия согласия");
    const ageConfirmed = validateBoolean(data.ageConfirmed, "Подтверждение возраста");
    if (!privacyConsent || !ageConfirmed || privacyConsentVersion !== PRIVACY_CONSENT_VERSION) {
      throw publicRequestError("privacy_consent_required", "Обновите страницу и подтвердите актуальное отдельное согласие на обработку персональных данных.");
    }
    return {
      ok: true,
      data: {
        action: "beginAttempt",
        apiVersion: AUTHORITATIVE_API_VERSION,
        beginRequestId: beginRequestId,
        testId: testId,
        inviteCode: inviteCode,
        email: validateEmail(data.email),
        browserFingerprint: validateBrowserFingerprint(data.browserFingerprint),
        clientBuild: validateBoundedText(data.clientBuild, 100, true, "Версия страницы"),
        privacyConsent: true,
        privacyConsentVersion: privacyConsentVersion,
        ageConfirmed: true
      }
    };
  } catch (error) {
    if (error && error.publicRequestError) {
      return { ok: false, response: buildValidationErrorResponse(error.failureCode, error.publicMessage) };
    }
    throw error;
  }
}

function validateAuthoritativeSubmissionRequest(data) {
  try {
    assertAllowedObjectKeys(data, [
      "action", "apiVersion", "requestId", "attemptId", "attemptToken", "testId", "bankVersion",
      "name", "email", "telegram", "englishLevel", "candidateSource", "candidateExperience",
      "employerShareConsent", "browserFingerprint", "tabSwitches", "clientBuild", "answers",
      "privacyConsentVersion", "ageConfirmed"
    ], "saveResult");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) {
      throw publicRequestError("client_upgrade_required", "Версия страницы устарела. Обновите страницу.");
    }
    const requestId = String(data.requestId || "").trim();
    if (!/^scs_[a-z0-9]{24,40}$/.test(requestId)) {
      throw publicRequestError("invalid_request_id", "Некорректный идентификатор отправки.");
    }
    const attemptId = String(data.attemptId || "").trim();
    if (!/^att_[a-f0-9]{32,64}$/.test(attemptId)) {
      throw publicRequestError("invalid_attempt", "Некорректная попытка.");
    }
    const attemptToken = String(data.attemptToken || "").trim();
    if (attemptToken.length < 80 || attemptToken.length > 3000 || attemptToken.split(".").length !== 3) {
      throw publicRequestError("invalid_attempt", "Некорректная попытка.");
    }
    const testId = validateTestId(data.testId);
    assertPublicTestEnabled(testId);
    const bankVersion = validateBoundedText(data.bankVersion, 100, true, "Версия банка");
    if (bankVersion !== BANK_VERSIONS_BY_ID[testId]) {
      throw publicRequestError("unsupported_test_version", "Версия теста устарела. Обновите страницу.");
    }
    const employerShareConsent = validateBoolean(data.employerShareConsent, "Согласие на передачу работодателю");
    if (employerShareConsent) {
      throw publicRequestError("employer_sharing_unavailable", "Передача результата работодателю в текущем MVP выключена.");
    }
    const privacyConsentVersion = validateBoundedText(data.privacyConsentVersion, 100, true, "Версия согласия");
    const ageConfirmed = validateBoolean(data.ageConfirmed, "Подтверждение возраста");
    if (privacyConsentVersion !== PRIVACY_CONSENT_VERSION || !ageConfirmed) {
      throw publicRequestError("privacy_consent_required", "Обновите страницу и подтвердите актуальное отдельное согласие на обработку персональных данных.");
    }
    return {
      ok: true,
      data: {
        action: "saveResult",
        apiVersion: AUTHORITATIVE_API_VERSION,
        requestId: requestId,
        attemptId: attemptId,
        attemptToken: attemptToken,
        testId: testId,
        bankVersion: bankVersion,
        name: validateBoundedText(data.name, 120, true, "Имя"),
        email: validateEmail(data.email),
        telegram: validateTelegramForRequest(data.telegram),
        englishLevel: validateEnum(data.englishLevel, ALLOWED_ENGLISH_LEVELS, "Уровень английского"),
        candidateSource: validateEnum(data.candidateSource, ALLOWED_CANDIDATE_SOURCES, "Источник кандидата"),
        candidateExperience: validateEnum(data.candidateExperience, ALLOWED_CANDIDATE_EXPERIENCE, "Опыт кандидата"),
        employerShareConsent: false,
        browserFingerprint: validateBrowserFingerprint(data.browserFingerprint),
        tabSwitches: validateInteger(data.tabSwitches, 0, 1000, "Количество уходов со вкладки"),
        clientBuild: validateBoundedText(data.clientBuild, 100, true, "Версия страницы"),
        privacyConsentVersion: privacyConsentVersion,
        ageConfirmed: true,
        answers: validateAuthoritativeAnswers(data.answers)
      }
    };
  } catch (error) {
    if (error && error.publicRequestError) {
      return { ok: false, response: buildValidationErrorResponse(error.failureCode, error.publicMessage) };
    }
    throw error;
  }
}

function validateAuthoritativeAnswers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ANSWERS_PER_RESULT) {
    throw publicRequestError("invalid_answers", "Ответы имеют неверный формат.");
  }
  const seen = Object.create(null);
  return value.map(source => {
    if (!isPlainObject(source)) throw publicRequestError("invalid_answer", "Один из ответов имеет неверный формат.");
    assertAllowedObjectKeys(source, ["questionId", "optionId", "timedOut", "timeSpent"], "answer");
    const questionId = validateIdentifier(source.questionId, 64, "ID вопроса");
    if (seen[questionId]) throw publicRequestError("duplicate_question", "В ответах найден повтор ID вопроса.");
    seen[questionId] = true;
    let optionId = null;
    if (source.optionId !== null) {
      optionId = validateIdentifier(source.optionId, 64, "ID варианта ответа");
    }
    return {
      questionId: questionId,
      optionId: optionId,
      timedOut: validateBoolean(source.timedOut, "Признак таймаута"),
      timeSpent: validateNumber(source.timeSpent, 0, 3600, "Время ответа")
    };
  });
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
  const allowed = Object.create(null);
  allowedKeys.forEach(key => { allowed[key] = true; });
  const unknown = Object.keys(value).find(key => !Object.prototype.hasOwnProperty.call(allowed, key));
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

function generateUniqueResultCode(testId, reservedSessions) {
  const adminResults = readJsonFromYandexDisk(getAdminFilePath(), []);
  const attempts = readJsonFromYandexDisk(getAttemptsFilePath(), []);
  const existingCodes = {};
  adminResults.forEach(result => {
    if (result && result.code) existingCodes[String(result.code)] = true;
  });
  attempts.forEach(attempt => {
    if (attempt && attempt.code) existingCodes[String(attempt.code)] = true;
  });
  (Array.isArray(reservedSessions) ? reservedSessions : []).forEach(session => {
    if (session && session.code) existingCodes[String(session.code)] = true;
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
  report += resultData.scoreVerification === SCORE_VERIFICATION_SERVER
    ? "Проверка балла: серверный расчёт по закрытому ключу ответов (" + safeText(resultData.scoringAlgorithmVersion || AUTHORITATIVE_SCORING_VERSION) + ")\n"
    : "Проверка балла: клиентский расчёт, структурно проверен backend, но не подтверждён закрытым ключом ответов\n";
  if (resultData.scoreVerification === SCORE_VERIFICATION_SERVER) {
    report += "Проверка телеметрии: клиентские технические признаки не верифицированы\n";
  }
  report += "\n";

  report += "КАНДИДАТ\n";
  report += "--------\n";
  report += "Имя/ФИО: " + safeText(resultData.name) + "\n";
  report += "Email: " + safeText(resultData.email) + "\n";
  if (resultData.telegram) report += "Telegram: " + safeText(resultData.telegram) + "\n";
  report += "Английский: " + safeText(resultData.englishLevel) + "\n";
  report += "Опыт: " + safeText(resultData.candidateExperience || resultData.experience) + "\n";
  report += "Источник: " + safeText(resultData.candidateSource || resultData.source) + "\n";
  report += "Версия отдельного согласия на обработку ПДн: " + safeText(resultData.privacyConsentVersion || "не зафиксирована") + "\n";
  report += "Согласие зафиксировано backend: " + safeText(resultData.privacyConsentedAt || "не зафиксировано") + "\n";
  report += "Подтверждение 18+: " + (resultData.ageConfirmed ? "да" : "нет") + "\n";
  report += "Передача работодателю: выключена в текущем MVP; отдельное согласие для конкретного получателя не оформлялось\n\n";

  report += "РЕЗУЛЬТАТ\n";
  report += "---------\n";
  report += "Сырой результат: " + Number(resultData.rawScore || 0) + "/" + Number(resultData.rawTotal || 0) + "\n";
  report += "Итоговый балл: " + Number(resultData.finalScore || 0) + "\n";
  report += "Процент: " + Number(resultData.percent || resultData.score || 0) + "\n";
  report += "Штрафы: " + Number(resultData.penalty || 0) + "\n";
  if (resultData.scoreVerification === SCORE_VERIFICATION_SERVER) {
    report += "Рекомендательный штраф по клиентской телеметрии (не влияет на итог): " + Number(resultData.advisoryPenalty || 0) + "\n";
  }
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
    "&fields=name,type,path,size,created,modified,public_key,public_url,share";

  try {
    const resource = yandexApiRequest("get", url, null, null);
    return {
      exists: true,
      name: String(resource.name || ""),
      type: String(resource.type || "unknown"),
      path: String(resource.path || normalizedPath),
      size: resource.type === "file" ? Number(resource.size || 0) : null,
      created: String(resource.created || ""),
      modified: String(resource.modified || ""),
      publicKey: String(resource.public_key || ""),
      publicUrl: String(resource.public_url || ""),
      shared: Boolean(resource.share)
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
        modified: "",
        publicKey: "",
        publicUrl: "",
        shared: false
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
    "&limit=100&fields=name,type,path,_embedded.items.name,_embedded.items.type,_embedded.items.path," +
    "_embedded.items.public_key,_embedded.items.public_url,_embedded.items.share";

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
        path: String(item.path || ""),
        publicKey: String(item.public_key || ""),
        publicUrl: String(item.public_url || ""),
        shared: Boolean(item.share)
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

function deleteYandexDiskFileIfExists(path) {
  const normalizedPath = validateSkillCheckDiskPath(path);
  const metadata = getYandexResourceMetadata(normalizedPath);
  if (!metadata.exists) return false;
  if (metadata.type !== "file") throw new Error("Deletion target must be a file.");
  const url = "https://cloud-api.yandex.net/v1/disk/resources?path=" +
    encodeURIComponent(normalizedPath) + "&permanently=true";
  yandexApiRequest("delete", url, null, null);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!getYandexResourceMetadata(normalizedPath).exists) return true;
    Utilities.sleep(200);
  }
  throw new Error("Yandex deletion did not complete.");
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
    badge: summaryData.scoreVerification === SCORE_VERIFICATION_SERVER
      ? String(summaryData.badge || getAdminBadge(Number(summaryData.finalScore || 0), 0))
      : getAdminBadge(Number(summaryData.finalScore || 0), Number(summaryData.tabSwitches || 0)),
    reportCreated: Boolean(summaryData.reportCreated),
    reportPath: String(summaryData.reportPath || ""),
    reportCode: String(summaryData.reportCode || summaryData.code || ""),
    requestId: normalizedRequestId,
    payloadHash: String(summaryData.payloadHash || ""),
    payloadHashVersion: Number(summaryData.payloadHashVersion || 0) === 3 ? 3 : (Number(summaryData.payloadHashVersion || 0) === 2 ? 2 : 1),
    attemptId: String(summaryData.attemptId || ""),
    bankVersion: String(summaryData.bankVersion || ""),
    rawScore: Number(summaryData.rawScore || 0),
    rawTotal: Number(summaryData.rawTotal || 0),
    scoringAlgorithmVersion: String(summaryData.scoringAlgorithmVersion || ""),
    telemetryVerification: String(summaryData.telemetryVerification || ""),
    advisoryPenalty: Number(summaryData.advisoryPenalty || 0),
    scoreVerification: summaryData.scoreVerification === SCORE_VERIFICATION_SERVER
      ? SCORE_VERIFICATION_SERVER
      : SCORE_VERIFICATION_CLIENT_REPORTED
  };
  const existingIndex = results.findIndex(result => result && (
    (normalizedRequestId && result.requestId === normalizedRequestId) ||
    (row.code && result.code === row.code)
  ));

  if (existingIndex >= 0) {
    const existing = results[existingIndex];
    if (!normalizedRequestId || existing.requestId !== normalizedRequestId || !row.code || existing.code !== row.code) {
      throw new Error("Admin result identity conflict.");
    }
    results[existingIndex] = Object.assign({}, existing, row);
  } else {
    results.push(row);
  }
  writeRequiredJsonArray(path, results);
}

function normalizeSubmissionRequestId(value) {
  const requestId = String(value || "").trim();
  return /^(?:sc_[A-Za-z0-9-]{16,80}|scs_[a-z0-9]{24,40})$/.test(requestId) ? requestId : "";
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
    scoreVerification: row.scoreVerification === SCORE_VERIFICATION_SERVER
      ? SCORE_VERIFICATION_SERVER
      : SCORE_VERIFICATION_CLIENT_REPORTED,
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
  writeRequiredJsonArray(path, attempts);
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
    payloadHashVersion: Number(attemptData.payloadHashVersion || 0) === 3 ? 3 : (Number(attemptData.payloadHashVersion || 0) === 2 ? 2 : 1),
    submissionState: attemptData.submissionState === "completed" ? "completed" : "reserved",
    finalScore: Number(attemptData.finalScore || 0),
    percent: Number(attemptData.percent || 0),
    reportCreated: Boolean(attemptData.reportCreated),
    attemptId: String(attemptData.attemptId || ""),
    bankVersion: String(attemptData.bankVersion || ""),
    scoringAlgorithmVersion: String(attemptData.scoringAlgorithmVersion || ""),
    scoreVerification: attemptData.scoreVerification === SCORE_VERIFICATION_SERVER
      ? SCORE_VERIFICATION_SERVER
      : SCORE_VERIFICATION_CLIENT_REPORTED
  };
  const existingIndex = attempts.findIndex(attempt => attempt && (
    (requestId && attempt.requestId === requestId) ||
    (row.code && attempt.code === row.code)
  ));

  if (existingIndex >= 0) attempts[existingIndex] = Object.assign({}, attempts[existingIndex], row);
  else attempts.push(row);
  writeRequiredJsonArray(path, attempts);
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

function normalizeDeletionScope(value) {
  const scope = String(value || "").trim();
  return scope === "result_only" || scope === "full_attempt" ? scope : "";
}

function normalizeDeletionRequestId(value) {
  const requestId = String(value || "").trim();
  return /^scd_[a-f0-9]{32}$/.test(requestId) ? requestId : "";
}

function getDeletionBackupPath(requestId) {
  const normalizedRequestId = normalizeDeletionRequestId(requestId);
  if (!normalizedRequestId) throw new Error("Invalid deletion request ID.");
  return joinDiskPath(getDeletionBackupsFolderPath(), normalizedRequestId + ".json");
}

function assertDeletionBackupNotShared(path) {
  const metadata = getYandexResourceMetadata(path);
  if (metadata.exists && (metadata.publicKey || metadata.publicUrl || metadata.shared)) {
    throw new Error("Deletion backup must not be published or shared.");
  }
}

function uniqueDeletionIds(values) {
  const seen = Object.create(null);
  return (values || []).map(value => String(value || "")).filter(value => {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  }).sort();
}

function buildDeletionSnapshot(code, scope, includeReportText) {
  const normalizedCode = normalizeResultCode(code);
  const normalizedScope = normalizeDeletionScope(scope);
  if (!normalizedCode || !normalizedScope) throw new Error("Invalid deletion snapshot context.");
  const results = readRequiredJsonArray(getAdminFilePath(), "Admin result store");
  const attempts = readRequiredJsonArray(getAttemptsFilePath(), "Attempt store");
  const sessions = readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
  const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
  const adminRows = results.filter(row => row && String(row.code || "").toUpperCase() === normalizedCode);
  const attemptRows = attempts.filter(row => row && String(row.code || "").toUpperCase() === normalizedCode);
  let attemptIds = uniqueDeletionIds(adminRows.concat(attemptRows).map(row => row && row.attemptId));
  const sessionRows = sessions.filter(row => row && (
    String(row.code || "").toUpperCase() === normalizedCode ||
    attemptIds.indexOf(String(row.attemptId || "")) !== -1
  ));
  attemptIds = uniqueDeletionIds(attemptIds.concat(sessionRows.map(row => row && row.attemptId)));
  const inviteIds = uniqueDeletionIds(sessionRows.map(row => row && row.inviteId));
  const inviteRows = invites.filter(row => row && (
    inviteIds.indexOf(String(row.inviteId || "")) !== -1 ||
    attemptIds.indexOf(String(row.attemptId || "")) !== -1
  ));
  const reportPath = joinDiskPath(getReportsFolderPath(), normalizedCode + ".txt");
  const reportMetadata = getYandexResourceMetadata(reportPath);
  if (reportMetadata.exists && reportMetadata.type !== "file") throw new Error("Report deletion target is not a file.");
  const snapshot = {
    code: normalizedCode,
    scope: normalizedScope,
    adminRows: adminRows,
    attemptRows: attemptRows,
    sessionRows: sessionRows,
    inviteRows: inviteRows,
    attemptIds: attemptIds,
    inviteIds: inviteIds,
    reportExists: reportMetadata.exists,
    reportSize: reportMetadata.exists ? Number(reportMetadata.size || 0) : 0,
    reportModified: reportMetadata.exists ? String(reportMetadata.modified || "") : "",
    reportText: includeReportText && reportMetadata.exists ? readTextFromYandexDisk(reportPath) : null
  };
  if (includeReportText && reportMetadata.exists && snapshot.reportText === null) {
    throw new Error("Report disappeared before deletion backup.");
  }
  snapshot.stateDigest = buildDeletionStateDigest(snapshot);
  snapshot.found = normalizedScope === "result_only"
    ? snapshot.adminRows.length > 0 || snapshot.reportExists
    : snapshot.adminRows.length > 0 || snapshot.attemptRows.length > 0 || snapshot.sessionRows.length > 0 || snapshot.inviteRows.length > 0 || snapshot.reportExists;
  return snapshot;
}

function buildDeletionStateDigest(snapshot) {
  function sortedRows(rows) {
    return (rows || []).map(row => JSON.stringify(row || {})).sort();
  }
  return sha256Hex(JSON.stringify({
    code: String(snapshot.code || ""),
    scope: String(snapshot.scope || ""),
    adminRows: sortedRows(snapshot.adminRows),
    attemptRows: sortedRows(snapshot.attemptRows),
    sessionRows: sortedRows(snapshot.sessionRows),
    inviteRows: sortedRows(snapshot.inviteRows),
    reportExists: Boolean(snapshot.reportExists),
    reportSize: Number(snapshot.reportSize || 0),
    reportModified: String(snapshot.reportModified || "")
  }));
}

function buildDeletionCounts(snapshot) {
  return {
    adminRows: Number((snapshot.adminRows || []).length),
    attemptRows: snapshot.scope === "full_attempt" ? Number((snapshot.attemptRows || []).length) : 0,
    sessions: snapshot.scope === "full_attempt" ? Number((snapshot.sessionRows || []).length) : 0,
    invites: snapshot.scope === "full_attempt" ? Number((snapshot.inviteRows || []).length) : 0,
    report: snapshot.reportExists ? 1 : 0
  };
}

function buildDeletionPreviewToken(snapshot) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", kid: "deletion-preview-v1", typ: "SC-DELETE-PREVIEW" };
  const claims = {
    v: 1,
    code: snapshot.code,
    scope: snapshot.scope,
    digest: snapshot.stateDigest,
    iat: nowSeconds,
    exp: nowSeconds + DELETION_PREVIEW_TTL_SECONDS
  };
  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedClaims = base64UrlEncodeText(JSON.stringify(claims));
  const signature = base64UrlEncodeBytes(hmacSha256Bytes(getRequiredProperty("ATTEMPT_SIGNING_SECRET_V1"), encodedHeader + "." + encodedClaims));
  return encodedHeader + "." + encodedClaims + "." + signature;
}

function verifyDeletionPreviewToken(token, snapshot) {
  try {
    const segments = String(token || "").split(".");
    if (segments.length !== 3 || segments.some(segment => !/^[A-Za-z0-9_-]+$/.test(segment))) return false;
    const header = JSON.parse(base64UrlDecodeText(segments[0]));
    const claims = JSON.parse(base64UrlDecodeText(segments[1]));
    const expectedSignature = base64UrlEncodeBytes(hmacSha256Bytes(getRequiredProperty("ATTEMPT_SIGNING_SECRET_V1"), segments[0] + "." + segments[1]));
    if (!timingSafeEqual(expectedSignature, segments[2]) || !isPlainObject(header) || !isPlainObject(claims) ||
        Object.keys(header).sort().join(",") !== "alg,kid,typ" ||
        Object.keys(claims).sort().join(",") !== "code,digest,exp,iat,scope,v" ||
        header.alg !== "HS256" || header.kid !== "deletion-preview-v1" || header.typ !== "SC-DELETE-PREVIEW" || Number(claims.v) !== 1 ||
        claims.code !== snapshot.code || claims.scope !== snapshot.scope || claims.digest !== snapshot.stateDigest ||
        !Number.isFinite(Number(claims.iat)) || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Number(claims.iat) ||
        Number(claims.iat) > Math.floor(Date.now() / 1000) + 60 || Number(claims.exp) <= Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

function adminPreviewResultDeletion(data) {
  try {
    assertAllowedObjectKeys(data, ["action", "apiVersion", "password", "code", "scope"], "adminDeletionPreview");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) return buildClientUpgradeRequiredResponse();
    const code = normalizeResultCode(data.code);
    const scope = normalizeDeletionScope(data.scope);
    if (!code || !scope) return buildValidationErrorResponse("invalid_deletion_request", "Проверьте код результата и область удаления.");
    assertAuthoritativePrivateStorageNotShared();
    const snapshot = buildDeletionSnapshot(code, scope, false);
    return {
      ok: true,
      status: "preview",
      backendVersion: BACKEND_VERSION,
      apiVersion: AUTHORITATIVE_API_VERSION,
      found: snapshot.found,
      code: code,
      scope: scope,
      counts: buildDeletionCounts(snapshot),
      reportExists: snapshot.reportExists,
      previewToken: snapshot.found ? buildDeletionPreviewToken(snapshot) : "",
      expiresAt: snapshot.found ? new Date(Date.now() + DELETION_PREVIEW_TTL_SECONDS * 1000).toISOString() : "",
      retentionAutomationEnabled: RETENTION_AUTOMATION_ENABLED
    };
  } catch (error) {
    if (error && error.publicRequestError) return buildValidationErrorResponse(error.failureCode, error.publicMessage);
    console.error("Admin deletion preview failed.");
    return buildAuthoritativeStorageErrorResponse();
  }
}

function readDeletionLog() {
  const text = readTextFromYandexDisk(getDeletionLogFilePath());
  if (text === null) return [];
  let rows;
  try {
    rows = JSON.parse(text);
  } catch (error) {
    throw new Error("Deletion log is corrupt.");
  }
  if (!Array.isArray(rows)) throw new Error("Deletion log must contain an array.");
  return rows;
}

function writeDeletionLog(rows) {
  if (!Array.isArray(rows)) throw new Error("Deletion log write requires an array.");
  writeJsonToYandexDisk(getDeletionLogFilePath(), rows);
}

function upsertDeletionLogEntry(rows, entry) {
  const index = rows.findIndex(row => row && row.requestId === entry.requestId);
  if (index >= 0) rows[index] = Object.assign({}, rows[index], entry);
  else rows.push(entry);
}

function buildDeletionResultResponse(entry, replayed) {
  return {
    ok: true,
    status: "deleted",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    code: String(entry.code || ""),
    scope: String(entry.scope || ""),
    requestId: String(entry.requestId || ""),
    counts: entry.counts || { adminRows: 0, attemptRows: 0, sessions: 0, invites: 0, report: 0 },
    backupPurged: entry.backupPurged === true,
    completedAt: String(entry.completedAt || ""),
    replayed: Boolean(replayed),
    retentionAutomationEnabled: RETENTION_AUTOMATION_ENABLED
  };
}

function parseDeletionBackup(text, requestId, code, scope) {
  let backup;
  try {
    backup = JSON.parse(String(text || ""));
  } catch (error) {
    throw new Error("Deletion backup is corrupt.");
  }
  if (!isPlainObject(backup) || Number(backup.schemaVersion) !== 1 || backup.requestId !== requestId || backup.code !== code || backup.scope !== scope ||
      !Array.isArray(backup.adminRows) || !Array.isArray(backup.attemptRows) || !Array.isArray(backup.sessionRows) || !Array.isArray(backup.inviteRows) ||
      (backup.operationalBackupEntries !== undefined && !Array.isArray(backup.operationalBackupEntries))) {
    throw new Error("Deletion backup context mismatch.");
  }
  backup.operationalBackupEntries = Array.isArray(backup.operationalBackupEntries) ? backup.operationalBackupEntries : [];
  return backup;
}

function buildOperationalBackupDeletionCriteria(source) {
  return {
    code: String(source.code || "").toUpperCase(),
    scope: normalizeDeletionScope(source.scope),
    attemptIds: uniqueDeletionIds(source.attemptIds || []),
    inviteIds: uniqueDeletionIds(source.inviteIds || [])
  };
}

function operationalBackupRowMatchesDeletion(storeKey, row, criteria) {
  if (!row || !isPlainObject(row)) return false;
  const codeMatches = String(row.code || "").toUpperCase() === criteria.code;
  const attemptMatches = criteria.attemptIds.indexOf(String(row.attemptId || "")) !== -1;
  const inviteMatches = criteria.inviteIds.indexOf(String(row.inviteId || "")) !== -1;
  if (storeKey === "admin-results") return codeMatches;
  if (criteria.scope !== "full_attempt") return false;
  if (storeKey === "attempts") return codeMatches || attemptMatches;
  if (storeKey === "attempt-sessions") return codeMatches || attemptMatches || inviteMatches;
  if (storeKey === "invites") return attemptMatches || inviteMatches;
  return false;
}

function collectOperationalBackupDeletionEntries(source) {
  const criteria = buildOperationalBackupDeletionCriteria(source);
  const storeKeys = criteria.scope === "full_attempt"
    ? getOperationalStoreKeys()
    : ["admin-results"];
  const entries = [];
  let totalChars = 0;
  storeKeys.forEach(storeKey => {
    const descriptor = getOperationalStoreDescriptor(storeKey);
    listOperationalBackupFiles(storeKey).forEach(item => {
      const backupPath = joinDiskPath(getOperationalBackupStoreFolder(storeKey), item.name);
      const envelopeText = readTextFromYandexDisk(backupPath);
      if (envelopeText === null) return;
      const envelope = parseOperationalBackupEnvelope(envelopeText, storeKey, descriptor.path);
      const removedRows = envelope.rows.filter(row => operationalBackupRowMatchesDeletion(storeKey, row, criteria)).length;
      if (!removedRows) return;
      totalChars += envelopeText.length;
      if (totalChars > MAX_OPERATIONAL_STORE_CHARS) throw new Error("Deletion backup redaction checkpoint exceeds the safe limit.");
      entries.push({
        storeKey: storeKey,
        backupName: item.name,
        removedRows: removedRows,
        envelopeText: envelopeText
      });
    });
  });
  return entries;
}

function scrubOperationalBackupsForDeletion(deletionBackup) {
  const criteria = buildOperationalBackupDeletionCriteria(deletionBackup);
  const originalEntries = Array.isArray(deletionBackup.operationalBackupEntries) ? deletionBackup.operationalBackupEntries : [];
  const originalsByKey = Object.create(null);
  originalEntries.forEach(entry => {
    if (entry && typeof entry.storeKey === "string" && typeof entry.backupName === "string" && typeof entry.envelopeText === "string") {
      originalsByKey[entry.storeKey + "/" + entry.backupName] = entry.envelopeText;
    }
  });
  let currentEntries;
  try {
    currentEntries = collectOperationalBackupDeletionEntries(deletionBackup);
  } catch (error) {
    originalEntries.forEach(entry => {
      if (!entry || !originalsByKey[entry.storeKey + "/" + entry.backupName]) return;
      const path = joinDiskPath(getOperationalBackupStoreFolder(entry.storeKey), entry.backupName);
      const text = readTextFromYandexDisk(path);
      if (text === null) return;
      try {
        parseOperationalBackupEnvelope(text, entry.storeKey, getOperationalStoreDescriptor(entry.storeKey).path);
      } catch (parseError) {
        uploadTextToYandexDisk(path, entry.envelopeText);
      }
    });
    currentEntries = collectOperationalBackupDeletionEntries(deletionBackup);
  }
  currentEntries.forEach(entry => {
    const descriptor = getOperationalStoreDescriptor(entry.storeKey);
    const path = joinDiskPath(getOperationalBackupStoreFolder(entry.storeKey), entry.backupName);
    let text = readTextFromYandexDisk(path);
    if (text === null) return;
    let envelope;
    try {
      envelope = parseOperationalBackupEnvelope(text, entry.storeKey, descriptor.path);
    } catch (error) {
      const originalText = originalsByKey[entry.storeKey + "/" + entry.backupName];
      if (!originalText) throw error;
      uploadTextToYandexDisk(path, originalText);
      envelope = parseOperationalBackupEnvelope(originalText, entry.storeKey, descriptor.path);
    }
    const remainingRows = envelope.rows.filter(row => !operationalBackupRowMatchesDeletion(entry.storeKey, row, criteria));
    const normalized = normalizeOperationalStoreRows(remainingRows, descriptor.label + " redacted backup");
    envelope.reason = "deletion-redaction";
    envelope.updatedAt = new Date().toISOString();
    envelope.rowCount = normalized.rows.length;
    envelope.contentSha256 = normalized.contentSha256;
    envelope.rows = normalized.rows;
    uploadTextToYandexDisk(path, JSON.stringify(envelope));
    const verified = parseOperationalBackupEnvelope(readTextFromYandexDisk(path), entry.storeKey, descriptor.path);
    if (verified.rows.some(row => operationalBackupRowMatchesDeletion(entry.storeKey, row, criteria))) {
      throw new Error("Operational backup deletion redaction verification failed.");
    }
  });
}

function removeDeletionTargetsFromStores(backup) {
  const code = backup.code;
  const fullAttempt = backup.scope === "full_attempt";
  const attemptIds = uniqueDeletionIds((backup.attemptIds || []).concat((backup.sessionRows || []).map(row => row && row.attemptId)));
  const inviteIds = uniqueDeletionIds((backup.inviteIds || []).concat((backup.sessionRows || []).map(row => row && row.inviteId)));
  const results = readRequiredJsonArray(getAdminFilePath(), "Admin result store");
  const nextResults = results.filter(row => !row || String(row.code || "").toUpperCase() !== code);
  if (nextResults.length !== results.length) writeRequiredJsonArray(getAdminFilePath(), nextResults, { skipBackup: true });
  if (fullAttempt) {
    const attempts = readRequiredJsonArray(getAttemptsFilePath(), "Attempt store");
    const nextAttempts = attempts.filter(row => !row || (
      String(row.code || "").toUpperCase() !== code && attemptIds.indexOf(String(row.attemptId || "")) === -1
    ));
    if (nextAttempts.length !== attempts.length) writeRequiredJsonArray(getAttemptsFilePath(), nextAttempts, { skipBackup: true });
    const sessions = readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
    const nextSessions = sessions.filter(row => !row || (
      String(row.code || "").toUpperCase() !== code && attemptIds.indexOf(String(row.attemptId || "")) === -1 && inviteIds.indexOf(String(row.inviteId || "")) === -1
    ));
    if (nextSessions.length !== sessions.length) writeRequiredJsonArray(getAttemptSessionsFilePath(), nextSessions, { skipBackup: true });
    const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
    const nextInvites = invites.filter(row => !row || (
      attemptIds.indexOf(String(row.attemptId || "")) === -1 && inviteIds.indexOf(String(row.inviteId || "")) === -1
    ));
    if (nextInvites.length !== invites.length) writeRequiredJsonArray(getInvitesFilePath(), nextInvites, { skipBackup: true });
  }
  deleteYandexDiskFileIfExists(joinDiskPath(getReportsFolderPath(), code + ".txt"));
}

function adminDeleteResult(data) {
  let lockAcquired = false;
  let failureStage = "validation";
  let codeForLog = "INVALID";
  let requestIdForLog = "invalid";
  const lock = LockService.getScriptLock();
  try {
    assertAllowedObjectKeys(data, ["action", "apiVersion", "password", "code", "scope", "requestId", "confirmationCode", "previewToken"], "adminDeleteResult");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) return buildClientUpgradeRequiredResponse();
    const code = normalizeResultCode(data.code);
    const scope = normalizeDeletionScope(data.scope);
    const requestId = normalizeDeletionRequestId(data.requestId);
    codeForLog = code || "INVALID";
    requestIdForLog = requestId || "invalid";
    if (!code || !scope || !requestId || String(data.confirmationCode || "").trim().toUpperCase() !== code) {
      return buildValidationErrorResponse("invalid_deletion_confirmation", "Повторите предварительную проверку и введите точный код результата.");
    }
    lock.waitLock(30000);
    lockAcquired = true;
    assertAuthoritativePrivateStorageNotShared();
    failureStage = "log-read";
    const logs = readDeletionLog();
    let logEntry = logs.find(row => row && row.requestId === requestId) || null;
    if (logEntry && (logEntry.code !== code || logEntry.scope !== scope)) return buildSubmissionConflictResponse();
    if (logEntry && logEntry.state === "completed") return buildDeletionResultResponse(logEntry, true);
    ensureYandexFolderExists(getDeletionBackupsFolderPath());
    const backupPath = getDeletionBackupPath(requestId);
    assertDeletionBackupNotShared(backupPath);
    const existingBackupText = readTextFromYandexDisk(backupPath);
    if (logEntry && logEntry.state === "primary_deleted_backup_pending") {
      failureStage = "backup-purge-retry";
      if (existingBackupText !== null) deleteYandexDiskFileIfExists(backupPath);
      logEntry = Object.assign({}, logEntry, { state: "completed", backupPurged: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      upsertDeletionLogEntry(logs, logEntry);
      writeDeletionLog(logs);
      return buildDeletionResultResponse(logEntry, true);
    }
    let backup;
    if (logEntry) {
      failureStage = "backup-read";
      if (existingBackupText === null) throw new Error("Pending deletion backup is missing.");
      backup = parseDeletionBackup(existingBackupText, requestId, code, scope);
    } else {
      failureStage = "preview-recheck";
      const snapshot = buildDeletionSnapshot(code, scope, true);
      if (!snapshot.found) return { ok: false, status: "not_found", failureCode: "deletion_target_not_found", backendVersion: BACKEND_VERSION, message: "Данные по этому коду не найдены." };
      if (!verifyDeletionPreviewToken(data.previewToken, snapshot)) {
        return buildValidationErrorResponse("deletion_preview_expired", "Данные изменились или предварительная проверка истекла. Выполните её снова.");
      }
      const operationalBackupEntries = collectOperationalBackupDeletionEntries(snapshot);
      backup = {
        schemaVersion: 1,
        requestId: requestId,
        code: code,
        scope: scope,
        createdAt: new Date().toISOString(),
        stateDigest: snapshot.stateDigest,
        adminRows: snapshot.adminRows,
        attemptRows: snapshot.attemptRows,
        sessionRows: snapshot.sessionRows,
        inviteRows: snapshot.inviteRows,
        attemptIds: snapshot.attemptIds,
        inviteIds: snapshot.inviteIds,
        reportExists: snapshot.reportExists,
        reportText: snapshot.reportText,
        operationalBackupEntries: operationalBackupEntries
      };
      failureStage = "backup-write";
      uploadTextToYandexDisk(backupPath, JSON.stringify(backup));
      assertDeletionBackupNotShared(backupPath);
      logEntry = {
        schemaVersion: 1,
        requestId: requestId,
        code: code,
        scope: scope,
        state: "backup_created",
        counts: buildDeletionCounts(snapshot),
        backupPurged: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: ""
      };
      failureStage = "log-backup-created";
      upsertDeletionLogEntry(logs, logEntry);
      writeDeletionLog(logs);
    }
    failureStage = "primary-delete";
    removeDeletionTargetsFromStores(backup);
    failureStage = "operational-backup-redaction";
    scrubOperationalBackupsForDeletion(backup);
    failureStage = "primary-verify";
    const afterSnapshot = buildDeletionSnapshot(code, scope, false);
    if (afterSnapshot.found) throw new Error("Deletion verification failed.");
    if (collectOperationalBackupDeletionEntries(backup).length) throw new Error("Deletion remains present in operational backups.");
    logEntry = Object.assign({}, logEntry, { state: "primary_deleted_backup_pending", updatedAt: new Date().toISOString() });
    upsertDeletionLogEntry(logs, logEntry);
    writeDeletionLog(logs);
    failureStage = "backup-purge";
    deleteYandexDiskFileIfExists(backupPath);
    if (getYandexResourceMetadata(backupPath).exists) throw new Error("Deletion backup purge verification failed.");
    logEntry = Object.assign({}, logEntry, { state: "completed", backupPurged: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    failureStage = "log-complete";
    upsertDeletionLogEntry(logs, logEntry);
    writeDeletionLog(logs);
    console.log("Admin deletion completed: code=" + code + "; request=" + requestId.slice(-8));
    return buildDeletionResultResponse(logEntry, false);
  } catch (error) {
    console.error("Admin deletion failed; stage=" + failureStage + "; code=" + codeForLog + "; request=" + String(requestIdForLog).slice(-8));
    return {
      ok: false,
      status: "error",
      retryable: true,
      failureCode: "deletion_incomplete",
      backendVersion: BACKEND_VERSION,
      requestId: normalizeDeletionRequestId(requestIdForLog),
      message: "Удаление не завершено. Не меняйте код операции и повторите запрос из этого экрана."
    };
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function getRetentionPolicyStatusForOwner() {
  return {
    ok: true,
    automationEnabled: RETENTION_AUTOMATION_ENABLED,
    configuredRetentionDays: null,
    mode: "manual-deletion-only",
    reason: "Автоматический срок не включается до утверждения оператором и юридической проверки.",
    backendVersion: BACKEND_VERSION
  };
}

function resumePendingDeletionForOwner(requestId) {
  const normalizedRequestId = normalizeDeletionRequestId(requestId);
  if (!normalizedRequestId) throw new Error("Invalid deletion request id.");
  const entry = readDeletionLog().find(row => row && row.requestId === normalizedRequestId) || null;
  if (!entry) throw new Error("Deletion request was not found.");
  if (entry.state === "completed") return buildDeletionResultResponse(entry, true);
  return adminDeleteResult({
    action: "adminDeleteResult",
    apiVersion: AUTHORITATIVE_API_VERSION,
    password: "",
    code: entry.code,
    scope: entry.scope,
    requestId: normalizedRequestId,
    confirmationCode: entry.code,
    previewToken: ""
  });
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
  const rawScoreCandidate = Number(row.rawScore);
  const rawTotalCandidate = Number(row.rawTotal);
  const percentCandidate = Number(row.percent);
  const finalScoreCandidate = Number(row.finalScore);
  const tabSwitchesCandidate = Number(row.tabSwitches);
  const rawScore = Number.isFinite(rawScoreCandidate) ? rawScoreCandidate : 0;
  const rawTotal = Number.isFinite(rawTotalCandidate) ? rawTotalCandidate : 0;
  const percent = Number.isFinite(percentCandidate) ? percentCandidate : 0;
  const finalScore = Number.isFinite(finalScoreCandidate) ? finalScoreCandidate : 0;
  const tabSwitches = Number.isInteger(tabSwitchesCandidate) && tabSwitchesCandidate >= 0
    ? tabSwitchesCandidate
    : 0;
  const code = normalizeResultCode(row.code);
  const expectedStatus = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";
  const expectedPercent = rawTotal > 0 ? Math.round(rawScore * 100 / rawTotal) : -1;
  const isServerVerified = testId !== "unknown" &&
    row.scoreVerification === SCORE_VERIFICATION_SERVER &&
    row.scoringAlgorithmVersion === AUTHORITATIVE_SCORING_VERSION &&
    row.bankVersion === BANK_VERSIONS_BY_ID[testId] &&
    Number.isFinite(rawScoreCandidate) && rawScore >= 0 &&
    Number.isFinite(rawTotalCandidate) && rawTotal > 0 && rawScore <= rawTotal &&
    Number.isFinite(percentCandidate) && percent >= 0 && percent <= 100 &&
    Number.isFinite(finalScoreCandidate) && finalScore >= 0 && finalScore <= 100 &&
    percent === expectedPercent && finalScore === percent &&
    (row.status === "passed" || row.status === "failed") && row.status === expectedStatus &&
    Number.isInteger(tabSwitchesCandidate) && tabSwitchesCandidate >= 0;

  return {
    code: code || "INVALID",
    testId: testId,
    testTitle: TEST_TITLES_BY_ID[testId] || "Неизвестный тест",
    finalScore: finalScore,
    percent: percent,
    tabSwitches: tabSwitches,
    date: String(row.date || ""),
    status: row.status === "passed" ? "passed" : "failed",
    badge: isServerVerified
      ? String(row.badge || getAdminBadge(finalScore, 0))
      : getAdminBadge(finalScore, tabSwitches),
    reportCreated: Boolean(row.reportCreated),
    bankVersion: String(row.bankVersion || ""),
    scoringAlgorithmVersion: String(row.scoringAlgorithmVersion || ""),
    telemetryVerification: String(row.telemetryVerification || ""),
    advisoryPenalty: Number(row.advisoryPenalty || 0),
    scoreVerification: isServerVerified
      ? SCORE_VERIFICATION_SERVER
      : SCORE_VERIFICATION_CLIENT_REPORTED
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
  ensureYandexFolderExists(getParentDiskPath(getInvitesFilePath()));
  ensureYandexFolderExists(getParentDiskPath(getAttemptSessionsFilePath()));
  ensureYandexFolderExists(getPrivateBanksFolderPath());
  ensureYandexFolderExists(getDeletionBackupsFolderPath());
  ensureYandexFolderExists(getOperationalBackupsFolderPath());
  getOperationalStoreKeys().forEach(storeKey => {
    ensureYandexFolderExists(getOperationalBackupStoreFolder(storeKey));
    ensureYandexFolderExists(getOperationalCorruptStoreFolder(storeKey));
  });
}

function assertAuthoritativePrivateStorageNotShared(testId) {
  const privateFolder = getParentDiskPath(getPrivateBanksFolderPath());
  const targets = [
    "disk:/skillcheck",
    privateFolder,
    getPrivateBanksFolderPath(),
    getReportsFolderPath(),
    getParentDiskPath(getAdminFilePath()),
    getAdminFilePath(),
    getInvitesFilePath(),
    getAttemptSessionsFilePath(),
    getAttemptsFilePath(),
    getDeletionLogFilePath(),
    getDeletionBackupsFolderPath(),
    getOperationalBackupsFolderPath(),
    joinDiskPath(getOperationalBackupsFolderPath(), "corrupt")
  ];
  getOperationalStoreKeys().forEach(storeKey => {
    targets.push(getOperationalBackupStoreFolder(storeKey));
    targets.push(getOperationalCorruptStoreFolder(storeKey));
  });
  const testIds = testId ? [validateTestId(testId)] : Object.keys(BANK_VERSIONS_BY_ID);
  testIds.forEach(id => {
    targets.push(getAuthoritativePrivateBankPath(id, BANK_VERSIONS_BY_ID[id]));
  });
  const seen = Object.create(null);
  targets.forEach(path => {
    const normalizedPath = normalizeDiskPath(path);
    if (seen[normalizedPath]) return;
    seen[normalizedPath] = true;
    const metadata = getYandexResourceMetadata(normalizedPath);
    if (!metadata.exists) return;
    if (metadata.publicKey || metadata.publicUrl || metadata.shared) {
      throw new Error("Authoritative private storage must not be published or shared.");
    }
  });
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

function getInvitesFilePath() {
  return getConfiguredDiskPath("YANDEX_DISK_INVITES_FILE", DEFAULT_YANDEX_INVITES_FILE);
}

function getAttemptSessionsFilePath() {
  return getConfiguredDiskPath("YANDEX_DISK_ATTEMPT_SESSIONS_FILE", DEFAULT_YANDEX_SESSIONS_FILE);
}

function getPrivateBanksFolderPath() {
  return getConfiguredDiskPath("YANDEX_DISK_PRIVATE_BANKS_FOLDER", DEFAULT_YANDEX_PRIVATE_BANKS_FOLDER);
}

function getDeletionLogFilePath() {
  return getConfiguredDiskPath("YANDEX_DISK_DELETION_LOG_FILE", DEFAULT_YANDEX_DELETION_LOG_FILE);
}

function getDeletionBackupsFolderPath() {
  return getConfiguredDiskPath("YANDEX_DISK_DELETION_BACKUPS_FOLDER", DEFAULT_YANDEX_DELETION_BACKUPS_FOLDER);
}

function getOperationalBackupsFolderPath() {
  return getConfiguredDiskPath("YANDEX_DISK_OPERATIONAL_BACKUPS_FOLDER", DEFAULT_YANDEX_OPERATIONAL_BACKUPS_FOLDER);
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

function hmacSha256Bytes(secret, value) {
  return Utilities.computeHmacSha256Signature(
    String(value || ""),
    String(secret || ""),
    Utilities.Charset.UTF_8
  );
}

function bytesToHex(bytes) {
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function hmacSha256Hex(secret, value) {
  return bytesToHex(hmacSha256Bytes(secret, value));
}

function timingSafeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length, 1);
  for (let i = 0; i < length; i++) {
    difference |= a.charCodeAt(i % Math.max(a.length, 1)) ^ b.charCodeAt(i % Math.max(b.length, 1));
  }
  return difference === 0;
}

function randomHex(length) {
  let source = "";
  while (source.length < Number(length || 32)) {
    source += sha256Hex([
      Utilities.getUuid(),
      Utilities.getUuid(),
      String(Date.now()),
      String(Math.random())
    ].join("|"));
  }
  return source.slice(0, Number(length || 32));
}

function ensureAuthoritativeSecret(propertyName) {
  const properties = PropertiesService.getScriptProperties();
  let value = properties.getProperty(propertyName);
  if (!value) {
    value = randomHex(64);
    properties.setProperty(propertyName, value);
  }
  return value;
}

function assertAuthoritativeConfigurationReady() {
  REQUIRED_AUTHORITATIVE_PROPERTIES.forEach(name => getRequiredProperty(name));
}

function base64UrlEncodeText(value) {
  return Utilities.base64EncodeWebSafe(String(value || ""), Utilities.Charset.UTF_8).replace(/=+$/g, "");
}

function base64UrlEncodeBytes(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, "");
}

function base64UrlDecodeText(value) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(String(value || ""))).getDataAsString("UTF-8");
}

function normalizeAuthoritativeQuestionId(testId, value, index) {
  if (testId === "ca-junior") {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 9999) {
      throw new Error("CA bank contains an invalid question ID.");
    }
    return "ca_" + String(numeric).padStart(3, "0");
  }
  const questionId = String(value || "").trim() || String(testId || "q").replace(/-junior$/, "") + "_" + String(index + 1).padStart(3, "0");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(questionId)) throw new Error("Bank contains an invalid question ID.");
  return questionId;
}

function buildAuthoritativeOptionId(testId, questionId, exactOptionText) {
  return "opt_" + sha256Hex(
    OPTION_ID_NAMESPACE + "|" + testId + "|" + questionId + "|" + String(exactOptionText)
  ).slice(0, 20);
}

function getBankVersionSlug(bankVersion) {
  const slug = String(bankVersion || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Private bank version slug is empty.");
  return slug.slice(0, 80);
}

function getAuthoritativePrivateBankPath(testId, bankVersion) {
  const testFolder = joinDiskPath(getPrivateBanksFolderPath(), validateTestId(testId));
  return joinDiskPath(testFolder, getBankVersionSlug(bankVersion) + ".json");
}

function buildAuthoritativePublicBank(privateBank) {
  return {
    schemaVersion: 2,
    testId: String(privateBank.testId || ""),
    testVersion: String(privateBank.testVersion || ""),
    bankVersion: String(privateBank.bankVersion || ""),
    questionsPerAttempt: Number(privateBank.questionsPerAttempt || 0),
    blocks: JSON.parse(JSON.stringify(privateBank.blocks || {})),
    questions: (privateBank.questions || []).map(question => ({
      id: String(question.id || ""),
      topic: String(question.topic || ""),
      block: String(question.block || ""),
      difficulty: String(question.difficulty || "medium"),
      timeLimit: Number(question.timeLimit || 0),
      points: Number(question.points || 0),
      text: String(question.text || ""),
      context: String(question.context || ""),
      options: (question.options || []).map(option => ({
        id: String(option.id || ""),
        text: String(option.text || "")
      }))
    }))
  };
}

function calculateAuthoritativePublicDigest(privateBank) {
  return sha256Hex(JSON.stringify(buildAuthoritativePublicBank(privateBank)));
}

function getOperationalStoreKeys() {
  return ["admin-results", "attempts", "attempt-sessions", "invites"];
}

function getOperationalStoreDescriptor(storeKey) {
  const key = String(storeKey || "");
  const descriptors = {
    "admin-results": { storeKey: "admin-results", label: "Admin result store", path: getAdminFilePath() },
    "attempts": { storeKey: "attempts", label: "Attempt store", path: getAttemptsFilePath() },
    "attempt-sessions": { storeKey: "attempt-sessions", label: "Attempt session store", path: getAttemptSessionsFilePath() },
    "invites": { storeKey: "invites", label: "Invite store", path: getInvitesFilePath() }
  };
  if (!Object.prototype.hasOwnProperty.call(descriptors, key)) throw new Error("Unsupported operational store.");
  return descriptors[key];
}

function getOperationalStoreDescriptorByPath(path) {
  const normalizedPath = normalizeDiskPath(path);
  const keys = getOperationalStoreKeys();
  for (let index = 0; index < keys.length; index++) {
    const descriptor = getOperationalStoreDescriptor(keys[index]);
    if (normalizeDiskPath(descriptor.path) === normalizedPath) return descriptor;
  }
  return null;
}

function getOperationalBackupStoreFolder(storeKey) {
  return joinDiskPath(getOperationalBackupsFolderPath(), getOperationalStoreDescriptor(storeKey).storeKey);
}

function getOperationalCorruptStoreFolder(storeKey) {
  return joinDiskPath(joinDiskPath(getOperationalBackupsFolderPath(), "corrupt"), getOperationalStoreDescriptor(storeKey).storeKey);
}

function normalizeOperationalStoreRows(rows, label) {
  const storeLabel = String(label || "Operational store");
  if (!Array.isArray(rows) || rows.length > MAX_OPERATIONAL_STORE_ROWS) {
    throw new Error(storeLabel + " must contain a bounded JSON array.");
  }
  let canonical;
  try {
    canonical = JSON.stringify(rows);
  } catch (error) {
    throw new Error(storeLabel + " is not JSON serializable.");
  }
  if (!canonical || canonical.length > MAX_OPERATIONAL_STORE_CHARS) throw new Error(storeLabel + " exceeds the safe size limit.");
  let normalized;
  try {
    normalized = JSON.parse(canonical);
  } catch (error) {
    throw new Error(storeLabel + " normalization failed.");
  }
  if (!Array.isArray(normalized) || normalized.some(row => !isPlainObject(row))) {
    throw new Error(storeLabel + " rows must be JSON objects.");
  }
  return {
    rows: normalized,
    canonical: JSON.stringify(normalized),
    contentSha256: sha256Hex(JSON.stringify(normalized))
  };
}

function parseOperationalBackupEnvelope(text, expectedStoreKey, expectedSourcePath) {
  let envelope;
  try {
    envelope = JSON.parse(String(text || ""));
  } catch (error) {
    throw new Error("Operational backup is corrupt.");
  }
  assertExactPrivateKeys(envelope, [
    "schemaVersion", "storeKey", "sourcePath", "reason", "createdAt", "updatedAt",
    "rowCount", "contentSha256", "rows"
  ], "Operational backup");
  const descriptor = getOperationalStoreDescriptor(expectedStoreKey || envelope.storeKey);
  const normalized = normalizeOperationalStoreRows(envelope.rows, descriptor.label + " backup");
  if (Number(envelope.schemaVersion) !== OPERATIONAL_BACKUP_SCHEMA_VERSION ||
      envelope.storeKey !== descriptor.storeKey ||
      envelope.sourcePath !== normalizeDiskPath(expectedSourcePath || descriptor.path) ||
      ["before-write", "before-restore", "manual-baseline", "deletion-redaction"].indexOf(envelope.reason) === -1 ||
      typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt)) ||
      typeof envelope.updatedAt !== "string" || !Number.isFinite(Date.parse(envelope.updatedAt)) ||
      Number(envelope.rowCount) !== normalized.rows.length ||
      !/^[a-f0-9]{64}$/.test(String(envelope.contentSha256 || "")) ||
      !timingSafeEqual(envelope.contentSha256, normalized.contentSha256)) {
    throw new Error("Operational backup integrity check failed.");
  }
  envelope.rows = normalized.rows;
  return envelope;
}

function buildOperationalBackupEnvelope(descriptor, rows, reason, createdAt) {
  const normalized = normalizeOperationalStoreRows(rows, descriptor.label);
  const timestamp = String(createdAt || new Date().toISOString());
  return {
    schemaVersion: OPERATIONAL_BACKUP_SCHEMA_VERSION,
    storeKey: descriptor.storeKey,
    sourcePath: normalizeDiskPath(descriptor.path),
    reason: String(reason || "before-write"),
    createdAt: timestamp,
    updatedAt: timestamp,
    rowCount: normalized.rows.length,
    contentSha256: normalized.contentSha256,
    rows: normalized.rows
  };
}

function buildOperationalBackupFileName(prefix) {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const suffix = String(Utilities.getUuid()).toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 8);
  return String(prefix || "bkp") + "_" + timestamp + "_" + suffix + ".json";
}

function listOperationalBackupFiles(storeKey) {
  const folder = getOperationalBackupStoreFolder(storeKey);
  const listing = listYandexFolderContents(folder);
  if (!listing.exists) return [];
  if (listing.type !== "dir" || listing.error) throw new Error("Operational backup folder is unavailable.");
  if (listing.items.some(item => item && (item.publicKey || item.publicUrl || item.shared))) {
    throw new Error("Operational backup files must remain private.");
  }
  return listing.items.filter(item => item && item.type === "file" && /^bkp_\d{8}T\d{9}Z_[a-f0-9]{8}\.json$/.test(item.name))
    .sort((left, right) => right.name.localeCompare(left.name));
}

function rotateOperationalBackupFiles(storeKey) {
  const files = listOperationalBackupFiles(storeKey);
  files.slice(OPERATIONAL_BACKUP_LIMIT_PER_STORE).forEach(item => {
    deleteYandexDiskFileIfExists(joinDiskPath(getOperationalBackupStoreFolder(storeKey), item.name));
  });
}

function writeOperationalBackupSnapshot(descriptor, rows, reason) {
  const folder = getOperationalBackupStoreFolder(descriptor.storeKey);
  let folderMetadata = getYandexResourceMetadata(folder);
  if (!folderMetadata.exists) {
    ensureYandexFolderExists(folder);
    folderMetadata = getYandexResourceMetadata(folder);
  }
  if (folderMetadata.type !== "dir") throw new Error("Operational backup folder is invalid.");
  if (folderMetadata.publicKey || folderMetadata.publicUrl || folderMetadata.shared) throw new Error("Operational backup folder must remain private.");
  const envelope = buildOperationalBackupEnvelope(descriptor, rows, reason);
  const backupName = buildOperationalBackupFileName("bkp");
  const backupPath = joinDiskPath(folder, backupName);
  uploadTextToYandexDisk(backupPath, JSON.stringify(envelope));
  const metadata = getYandexResourceMetadata(backupPath);
  if (!metadata.exists || metadata.type !== "file" || metadata.publicKey || metadata.publicUrl || metadata.shared) {
    throw new Error("Operational backup verification failed.");
  }
  parseOperationalBackupEnvelope(readTextFromYandexDisk(backupPath), descriptor.storeKey, descriptor.path);
  rotateOperationalBackupFiles(descriptor.storeKey);
  return { backupName: backupName, rowCount: envelope.rowCount, contentSha256: envelope.contentSha256 };
}

function listCorruptOperationalArtifacts(storeKey) {
  const folder = getOperationalCorruptStoreFolder(storeKey);
  const listing = listYandexFolderContents(folder);
  if (!listing.exists) return [];
  if (listing.type !== "dir" || listing.error) throw new Error("Corrupt artifact folder is unavailable.");
  if (listing.items.some(item => item && (item.publicKey || item.publicUrl || item.shared))) {
    throw new Error("Corrupt recovery artifacts must remain private.");
  }
  return listing.items.filter(item => item && item.type === "file" && /^corrupt_\d{8}T\d{9}Z_[a-f0-9]{8}\.json$/.test(item.name))
    .sort((left, right) => right.name.localeCompare(left.name));
}

function captureCorruptOperationalArtifact(descriptor, rawText) {
  const source = String(rawText || "");
  if (source.length > MAX_OPERATIONAL_STORE_CHARS) throw new Error("Corrupt source exceeds the safe recovery limit.");
  const folder = getOperationalCorruptStoreFolder(descriptor.storeKey);
  let folderMetadata = getYandexResourceMetadata(folder);
  if (!folderMetadata.exists) {
    ensureYandexFolderExists(folder);
    folderMetadata = getYandexResourceMetadata(folder);
  }
  if (!folderMetadata.exists || folderMetadata.type !== "dir" || folderMetadata.publicKey || folderMetadata.publicUrl || folderMetadata.shared) {
    throw new Error("Corrupt artifact folder must remain private.");
  }
  const envelope = {
    schemaVersion: 1,
    storeKey: descriptor.storeKey,
    sourcePath: normalizeDiskPath(descriptor.path),
    capturedAt: new Date().toISOString(),
    rawSha256: sha256Hex(source),
    rawText: source
  };
  const name = buildOperationalBackupFileName("corrupt");
  const artifactPath = joinDiskPath(folder, name);
  uploadTextToYandexDisk(artifactPath, JSON.stringify(envelope));
  const verificationText = readTextFromYandexDisk(artifactPath);
  let verification;
  try { verification = JSON.parse(String(verificationText || "")); } catch (error) { throw new Error("Corrupt artifact verification failed."); }
  if (!verification || verification.rawSha256 !== envelope.rawSha256 || sha256Hex(String(verification.rawText || "")) !== envelope.rawSha256) {
    throw new Error("Corrupt artifact integrity check failed.");
  }
  listCorruptOperationalArtifacts(descriptor.storeKey).slice(OPERATIONAL_CORRUPT_ARTIFACT_LIMIT_PER_STORE).forEach(item => {
    deleteYandexDiskFileIfExists(joinDiskPath(folder, item.name));
  });
  return name;
}

function readRequiredJsonArray(path, label) {
  const text = readTextFromYandexDisk(path);
  if (text === null) throw new Error(String(label || "Private JSON") + " is missing.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(String(label || "Private JSON") + " is corrupt.");
  }
  if (!Array.isArray(parsed)) throw new Error(String(label || "Private JSON") + " must contain an array.");
  const descriptor = getOperationalStoreDescriptorByPath(path);
  return descriptor ? normalizeOperationalStoreRows(parsed, descriptor.label).rows : parsed;
}

function writeRequiredJsonArray(path, rows, options) {
  const descriptor = getOperationalStoreDescriptorByPath(path);
  const normalized = normalizeOperationalStoreRows(rows, descriptor ? descriptor.label : "Private JSON");
  const currentText = readTextFromYandexDisk(path);
  if (currentText !== null) {
    let currentRows;
    try { currentRows = JSON.parse(currentText); } catch (error) { throw new Error("Existing private state is corrupt and was not overwritten."); }
    const current = normalizeOperationalStoreRows(currentRows, descriptor ? descriptor.label : "Private JSON");
    if (timingSafeEqual(current.contentSha256, normalized.contentSha256)) return false;
    if (descriptor && !(options && options.skipBackup === true)) writeOperationalBackupSnapshot(descriptor, current.rows, "before-write");
  }
  uploadTextToYandexDisk(path, JSON.stringify(normalized.rows, null, 2));
  const verified = readRequiredJsonArray(path, descriptor ? descriptor.label : "Private JSON");
  const verifiedDigest = normalizeOperationalStoreRows(verified, descriptor ? descriptor.label : "Private JSON").contentSha256;
  if (!timingSafeEqual(verifiedDigest, normalized.contentSha256)) throw new Error("Private JSON write verification failed.");
  return true;
}

function createOperationalBackupsForOwner() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSkillCheckFolders();
    assertAuthoritativePrivateStorageNotShared();
    return getOperationalStoreKeys().map(storeKey => {
      const descriptor = getOperationalStoreDescriptor(storeKey);
      const rows = readRequiredJsonArray(descriptor.path, descriptor.label);
      const backup = writeOperationalBackupSnapshot(descriptor, rows, "manual-baseline");
      return { storeKey: storeKey, backupName: backup.backupName, rowCount: backup.rowCount };
    });
  } finally {
    lock.releaseLock();
  }
}

function getOperationalBackupStatusForOwner() {
  assertAuthoritativePrivateStorageNotShared();
  return {
    ok: true,
    backendVersion: BACKEND_VERSION,
    limitPerStore: OPERATIONAL_BACKUP_LIMIT_PER_STORE,
    stores: getOperationalStoreKeys().map(storeKey => {
      const files = listOperationalBackupFiles(storeKey);
      return { storeKey: storeKey, count: files.length, newestBackupName: files.length ? files[0].name : "" };
    })
  };
}

function restoreOperationalStoreForOwner(storeKey, backupName) {
  const descriptor = getOperationalStoreDescriptor(storeKey);
  const normalizedBackupName = String(backupName || "").trim();
  if (!/^bkp_\d{8}T\d{9}Z_[a-f0-9]{8}\.json$/.test(normalizedBackupName)) throw new Error("Invalid operational backup name.");
  if (getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") === "true" || getScriptProperty(LEGAL_PILOT_APPROVAL_PROPERTY) === "true") {
    throw new Error("Operational restore requires closed pilot gates.");
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") === "true" || getScriptProperty(LEGAL_PILOT_APPROVAL_PROPERTY) === "true") {
      throw new Error("Operational restore requires closed pilot gates.");
    }
    ensureSkillCheckFolders();
    assertAuthoritativePrivateStorageNotShared();
    const backupPath = joinDiskPath(getOperationalBackupStoreFolder(descriptor.storeKey), normalizedBackupName);
    const metadata = getYandexResourceMetadata(backupPath);
    if (!metadata.exists || metadata.type !== "file" || metadata.publicKey || metadata.publicUrl || metadata.shared) {
      throw new Error("Operational backup is unavailable or not private.");
    }
    const envelope = parseOperationalBackupEnvelope(readTextFromYandexDisk(backupPath), descriptor.storeKey, descriptor.path);
    const currentText = readTextFromYandexDisk(descriptor.path);
    let safetyArtifact = "";
    if (currentText !== null) {
      let currentRows = null;
      try {
        currentRows = normalizeOperationalStoreRows(JSON.parse(currentText), descriptor.label).rows;
      } catch (error) {
        safetyArtifact = captureCorruptOperationalArtifact(descriptor, currentText);
      }
      if (currentRows !== null) writeOperationalBackupSnapshot(descriptor, currentRows, "before-restore");
    }
    uploadTextToYandexDisk(descriptor.path, JSON.stringify(envelope.rows, null, 2));
    const restoredRows = readRequiredJsonArray(descriptor.path, descriptor.label);
    const restored = normalizeOperationalStoreRows(restoredRows, descriptor.label);
    if (!timingSafeEqual(restored.contentSha256, envelope.contentSha256)) throw new Error("Operational restore verification failed.");
    return {
      ok: true,
      status: "restored",
      backendVersion: BACKEND_VERSION,
      storeKey: descriptor.storeKey,
      backupName: normalizedBackupName,
      rowCount: restored.rows.length,
      contentSha256: restored.contentSha256,
      corruptSafetyArtifact: safetyArtifact
    };
  } finally {
    lock.releaseLock();
  }
}

function assertExactPrivateKeys(value, expectedKeys, label) {
  const actualKeys = isPlainObject(value) ? Object.keys(value) : [];
  if (!isPlainObject(value) || actualKeys.length !== expectedKeys.length ||
      expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(String(label || "Private object") + " has an invalid field set.");
  }
}

function assertAllowedLegacyKeys(value, allowedKeys, label) {
  if (!isPlainObject(value) || Object.keys(value).some(key => allowedKeys.indexOf(key) === -1)) {
    throw new Error(String(label || "Legacy object") + " contains an unknown field.");
  }
}

function getExpectedAuthoritativeQuestionId(testId, index) {
  const prefixes = {
    "fa-junior": "fa",
    "ca-junior": "ca",
    "fpa-junior": "fpa",
    "acc-junior": "acc",
    "bi-junior": "bi",
    "dev-quick": "dev_quick"
  };
  return String(prefixes[testId] || "q") + "_" + String(index + 1).padStart(3, "0");
}

function validateAuthoritativePrivateBankObject(bank, testId, bankVersion) {
  assertExactPrivateKeys(bank, [
    "schemaVersion", "testId", "testVersion", "bankVersion", "questionsPerAttempt",
    "blocks", "questions", "publicDigest"
  ], "Authoritative private bank");
  if (Number(bank.schemaVersion) !== 2 || bank.testId !== testId ||
      bank.testVersion !== TEST_VERSIONS_BY_ID_AUTHORITATIVE[testId] || bank.bankVersion !== bankVersion ||
      Number(bank.questionsPerAttempt) !== EXPECTED_ANSWERS_BY_TEST_ID[testId] || !Array.isArray(bank.questions) ||
      bank.questions.length !== EXPECTED_BANK_QUESTIONS_BY_TEST_ID[testId] || !isPlainObject(bank.blocks)) {
    throw new Error("Authoritative private bank metadata is invalid.");
  }
  const allowedBlocks = ALLOWED_BLOCKS_BY_TEST_ID[testId] || [];
  const bankBlockKeys = Object.keys(bank.blocks);
  if (bankBlockKeys.length !== allowedBlocks.length ||
      allowedBlocks.some(key => !Object.prototype.hasOwnProperty.call(bank.blocks, key)) ||
      Object.keys(bank.blocks).some(key => typeof bank.blocks[key] !== "string" ||
        !String(bank.blocks[key]).trim() || String(bank.blocks[key]).length > 160)) {
    throw new Error("Authoritative private bank blocks are invalid.");
  }

  const seenQuestions = Object.create(null);
  const seenOptionsGlobally = Object.create(null);
  bank.questions.forEach((question, index) => {
    assertExactPrivateKeys(question, [
      "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context",
      "options", "correctOptionId", "comment"
    ], "Authoritative private question");
    const questionId = String(question.id || "");
    if (questionId !== getExpectedAuthoritativeQuestionId(testId, index) || seenQuestions[questionId]) {
      throw new Error("Authoritative private bank question IDs/order are invalid.");
    }
    seenQuestions[questionId] = true;
    const difficulty = String(question.difficulty || "");
    const timeLimit = Number(question.timeLimit);
    const points = Number(question.points);
    if (allowedBlocks.indexOf(String(question.block || "")) === -1 ||
        ["easy", "medium", "hard", "calc", "case"].indexOf(difficulty) === -1 ||
        !Number.isInteger(timeLimit) || timeLimit < 10 || timeLimit > 600 ||
        !Number.isFinite(points) || points <= 0 || points > 100 ||
        typeof question.text !== "string" || !question.text.trim() || question.text.length > 5000 ||
        typeof question.topic !== "string" || question.topic.length > 160 ||
        typeof question.context !== "string" || question.context.length > 5000 ||
        typeof question.comment !== "string" || question.comment.length > 5000 ||
        !Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error("Authoritative private bank question metadata is invalid.");
    }
    const optionIds = Object.create(null);
    let previousOptionId = "";
    question.options.forEach(option => {
      assertExactPrivateKeys(option, ["id", "text"], "Authoritative private option");
      const optionId = String(option.id || "");
      const optionText = option.text;
      if (typeof optionText !== "string" || !optionText.trim() || optionText.length > 1200 ||
          !/^opt_[a-f0-9]{20}$/.test(optionId) || optionIds[optionId] || seenOptionsGlobally[optionId] ||
          optionId !== buildAuthoritativeOptionId(testId, questionId, optionText) ||
          (previousOptionId && optionId <= previousOptionId)) {
        throw new Error("Authoritative private bank option IDs/order are invalid.");
      }
      optionIds[optionId] = true;
      seenOptionsGlobally[optionId] = true;
      previousOptionId = optionId;
    });
    if (!/^opt_[a-f0-9]{20}$/.test(String(question.correctOptionId || "")) ||
        !optionIds[String(question.correctOptionId || "")]) {
      throw new Error("Authoritative private bank answer key is invalid.");
    }
  });
  const publicDigest = String(bank.publicDigest || "");
  if (!/^[a-f0-9]{64}$/.test(publicDigest) ||
      !timingSafeEqual(publicDigest, calculateAuthoritativePublicDigest(bank))) {
    throw new Error("Authoritative private bank public digest is invalid.");
  }
  return bank;
}

function getPrivateBankAnchorKey(testId, bankVersion) {
  return String(testId || "") + "|" + String(bankVersion || "");
}

function getPrivateBankArtifactDigest(bank) {
  return sha256Hex(JSON.stringify(bank));
}

function parsePrivateBankTrustAnchors(required) {
  const source = getScriptProperty("PRIVATE_BANK_DIGESTS_V1");
  if (!source) {
    if (required) throw new Error("Private bank trust anchors are missing.");
    return null;
  }
  let anchors;
  try {
    anchors = JSON.parse(source);
  } catch (error) {
    throw new Error("Private bank trust anchors are corrupt.");
  }
  if (!isPlainObject(anchors) || Object.keys(anchors).some(key =>
    !/^[a-z0-9-]+\|[^\u0000-\u001f]{1,100}$/.test(key) || !/^[a-f0-9]{64}$/.test(String(anchors[key] || "")))) {
    throw new Error("Private bank trust anchors are invalid.");
  }
  return anchors;
}

function assertPrivateBankTrustAnchor(bank) {
  const anchors = parsePrivateBankTrustAnchors(true);
  const key = getPrivateBankAnchorKey(bank.testId, bank.bankVersion);
  const expected = String(anchors[key] || "");
  const actual = getPrivateBankArtifactDigest(bank);
  if (!expected || !timingSafeEqual(expected, actual)) {
    throw new Error("Authoritative private bank trust anchor mismatch.");
  }
}

function loadAuthoritativePrivateBank(testId, bankVersion, skipPrivateAnchor) {
  const expectedVersion = BANK_VERSIONS_BY_ID[testId];
  if (!expectedVersion || bankVersion !== expectedVersion) throw new Error("Unsupported authoritative bank version.");
  const path = getAuthoritativePrivateBankPath(testId, bankVersion);
  const text = readTextFromYandexDisk(path);
  if (text === null) throw new Error("Authoritative private bank is missing.");
  let bank;
  try {
    bank = JSON.parse(text);
  } catch (error) {
    throw new Error("Authoritative private bank is corrupt.");
  }
  validateAuthoritativePrivateBankObject(bank, testId, bankVersion);
  if (!skipPrivateAnchor) assertPrivateBankTrustAnchor(bank);
  return bank;
}

function buildPrivateBankFromLegacySource(testId, source) {
  const expectedQuestionCount = EXPECTED_BANK_QUESTIONS_BY_TEST_ID[testId];
  const expectedQuestionsPerAttempt = EXPECTED_ANSWERS_BY_TEST_ID[testId];
  const expectedLegacyVersion = LEGACY_BANK_VERSIONS_BY_TEST_ID[testId];
  const allowedBlocks = ALLOWED_BLOCKS_BY_TEST_ID[testId] || [];
  if (!expectedQuestionCount || !expectedQuestionsPerAttempt || !expectedLegacyVersion || !allowedBlocks.length) {
    throw new Error("Legacy public bank target is unsupported.");
  }
  assertAllowedLegacyKeys(source, [
    "testId", "version", "totalQuestions", "questionsPerTest", "questionsPerAttempt", "blocks", "questions"
  ], "Legacy public bank");
  if (source.testId !== testId || source.version !== expectedLegacyVersion ||
      !Number.isInteger(source.totalQuestions) || source.totalQuestions !== expectedQuestionCount ||
      !Array.isArray(source.questions) || source.questions.length !== expectedQuestionCount ||
      (Object.prototype.hasOwnProperty.call(source, "questionsPerTest") &&
        (!Number.isInteger(source.questionsPerTest) || source.questionsPerTest !== expectedQuestionsPerAttempt)) ||
      (Object.prototype.hasOwnProperty.call(source, "questionsPerAttempt") &&
        (!Number.isInteger(source.questionsPerAttempt) || source.questionsPerAttempt !== expectedQuestionsPerAttempt)) ||
      !isPlainObject(source.blocks) ||
      Object.keys(source.blocks).length !== allowedBlocks.length ||
      allowedBlocks.some(key => !Object.prototype.hasOwnProperty.call(source.blocks, key)) ||
      Object.keys(source.blocks).some(key => typeof source.blocks[key] !== "string" ||
        !source.blocks[key].trim() || source.blocks[key].length > 160)) {
    throw new Error("Legacy public bank metadata is invalid.");
  }

  const targetVersion = BANK_VERSIONS_BY_ID[testId];
  const seenOptionIds = Object.create(null);
  const questions = source.questions.map((question, index) => {
    assertAllowedLegacyKeys(question, [
      "id", "topic", "block", "difficulty", "timeLimit", "points", "text", "context",
      "options", "correct", "correctAnswer", "comment", "explanation", "active"
    ], "Legacy public question");
    const questionId = normalizeAuthoritativeQuestionId(testId, question.id, index);
    const expectedQuestionId = getExpectedAuthoritativeQuestionId(testId, index);
    const originalOptions = question.options;
    const correctIndex = question.correct;
    if (questionId !== expectedQuestionId ||
        (testId === "ca-junior" && (!Number.isInteger(question.id) || question.id !== index + 1)) ||
        (testId !== "ca-junior" && question.id !== expectedQuestionId) ||
        allowedBlocks.indexOf(question.block) === -1 ||
        ["easy", "medium", "hard", "calc", "case"].indexOf(question.difficulty) === -1 ||
        !Number.isInteger(question.timeLimit) || question.timeLimit < 10 || question.timeLimit > 600 ||
        typeof question.points !== "number" || !Number.isFinite(question.points) || question.points <= 0 || question.points > 100 ||
        typeof question.text !== "string" || !question.text.trim() || question.text.length > 5000 ||
        !Array.isArray(originalOptions) || originalOptions.length !== 4 ||
        originalOptions.some(option => typeof option !== "string" || !option.trim() || option.length > 1200) ||
        !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= originalOptions.length ||
        (Object.prototype.hasOwnProperty.call(question, "active") && question.active !== true) ||
        (Object.prototype.hasOwnProperty.call(question, "topic") &&
          (typeof question.topic !== "string" || question.topic.length > 160)) ||
        (Object.prototype.hasOwnProperty.call(question, "context") &&
          (typeof question.context !== "string" || question.context.length > 5000)) ||
        (Object.prototype.hasOwnProperty.call(question, "comment") &&
          (typeof question.comment !== "string" || question.comment.length > 5000)) ||
        (Object.prototype.hasOwnProperty.call(question, "explanation") &&
          (typeof question.explanation !== "string" || question.explanation.length > 5000)) ||
        (Object.prototype.hasOwnProperty.call(question, "correctAnswer") &&
          (typeof question.correctAnswer !== "string" || question.correctAnswer !== originalOptions[correctIndex]))) {
      throw new Error("Legacy public bank question is invalid.");
    }
    const options = originalOptions.map(text => {
      const optionId = buildAuthoritativeOptionId(testId, questionId, text);
      if (seenOptionIds[optionId]) throw new Error("Legacy public bank option IDs collide.");
      seenOptionIds[optionId] = true;
      return { id: optionId, text: text };
    }).sort((left, right) => left.id.localeCompare(right.id));
    const correctOptionId = buildAuthoritativeOptionId(testId, questionId, originalOptions[correctIndex]);
    return {
      id: questionId,
      topic: String(question.topic || ""),
      block: question.block,
      difficulty: question.difficulty,
      timeLimit: question.timeLimit,
      points: question.points,
      text: question.text,
      context: String(question.context || ""),
      options: options,
      correctOptionId: correctOptionId,
      comment: String(question.comment || question.explanation || "")
    };
  });
  const privateBank = {
    schemaVersion: 2,
    testId: testId,
    testVersion: TEST_VERSIONS_BY_ID_AUTHORITATIVE[testId],
    bankVersion: targetVersion,
    questionsPerAttempt: EXPECTED_ANSWERS_BY_TEST_ID[testId],
    blocks: JSON.parse(JSON.stringify(source.blocks || {})),
    questions: questions,
    publicDigest: ""
  };
  privateBank.publicDigest = calculateAuthoritativePublicDigest(privateBank);
  validateAuthoritativePrivateBankObject(privateBank, testId, targetVersion);
  return privateBank;
}

function loadAuthoritativePrivateBankShapeOnly(bank) {
  if (!isPlainObject(bank)) throw new Error("Generated authoritative private bank is invalid.");
  return validateAuthoritativePrivateBankObject(bank, bank.testId, bank.bankVersion);
}

function initializePrivateArrayFileIfMissing(path) {
  const text = readTextFromYandexDisk(path);
  if (text === null) {
    writeRequiredJsonArray(path, []);
    return true;
  }
  try {
    if (!Array.isArray(JSON.parse(text))) throw new Error("not-array");
  } catch (error) {
    throw new Error("Existing private state file is corrupt and was not overwritten.");
  }
  return false;
}

function bootstrapAuthoritativeBanksFromLegacyPages() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const properties = PropertiesService.getScriptProperties();
  REQUIRED_AUTHORITATIVE_PROPERTIES.forEach(ensureAuthoritativeSecret);
  properties.setProperty("ATTEMPT_ISSUANCE_ENABLED", "false");
  properties.setProperty(LEGAL_PILOT_APPROVAL_PROPERTY, "false");
  ensureSkillCheckFolders();
  assertAuthoritativePrivateStorageNotShared();
  initializePrivateArrayFileIfMissing(getInvitesFilePath());
  initializePrivateArrayFileIfMissing(getAttemptSessionsFilePath());
  initializePrivateArrayFileIfMissing(getDeletionLogFilePath());
  const existingAnchors = parsePrivateBankTrustAnchors(false);
  const generatedAnchors = Object.create(null);

  const legacyFiles = {
    "fa-junior": "fa-junior.json",
    "ca-junior": "ca-junior.json",
    "fpa-junior": "fpa-junior.json",
    "acc-junior": "acc-junior.json",
    "bi-junior": "bi-junior.json",
    "dev-quick": "dev-quick.json"
  };
  const report = [];
  Object.keys(legacyFiles).forEach(testId => {
    const response = UrlFetchApp.fetch(LEGACY_PUBLIC_BANK_BASE_URL + legacyFiles[testId], {
      method: "get",
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (response.getResponseCode() !== 200) throw new Error("Legacy bank bootstrap fetch failed for " + testId + ".");
    const sourceText = response.getContentText("UTF-8");
    const expectedSourceDigest = LEGACY_PUBLIC_BANK_SHA256_BY_TEST_ID[testId];
    if (!expectedSourceDigest || !timingSafeEqual(sha256Hex(sourceText), expectedSourceDigest)) {
      throw new Error("Immutable legacy bank digest mismatch for " + testId + ".");
    }
    let source;
    try {
      source = JSON.parse(sourceText);
    } catch (error) {
      throw new Error("Legacy bank bootstrap JSON is invalid for " + testId + ".");
    }
    const bank = buildPrivateBankFromLegacySource(testId, source);
    const path = getAuthoritativePrivateBankPath(testId, bank.bankVersion);
    ensureYandexFolderExists(getParentDiskPath(path));
    const metadata = getYandexResourceMetadata(path);
    if (metadata.exists) {
      if (metadata.type !== "file") throw new Error("Private bank path conflicts with a directory.");
      const existing = loadAuthoritativePrivateBank(testId, bank.bankVersion, true);
      if (!timingSafeEqual(sha256Hex(JSON.stringify(existing)), sha256Hex(JSON.stringify(bank)))) {
        throw new Error("Existing authoritative private bank differs from the freshly generated legacy source for " + testId + ".");
      }
      const privateDigest = getPrivateBankArtifactDigest(existing);
      generatedAnchors[getPrivateBankAnchorKey(testId, bank.bankVersion)] = privateDigest;
      report.push({ testId: testId, status: "existing", questionCount: existing.questions.length, publicDigest: existing.publicDigest, privateDigest: privateDigest });
    } else {
      writeJsonToYandexDisk(path, bank);
      const verified = loadAuthoritativePrivateBank(testId, bank.bankVersion, true);
      const privateDigest = getPrivateBankArtifactDigest(verified);
      generatedAnchors[getPrivateBankAnchorKey(testId, bank.bankVersion)] = privateDigest;
      report.push({ testId: testId, status: "created", questionCount: verified.questions.length, publicDigest: verified.publicDigest, privateDigest: privateDigest });
    }
  });
  if (existingAnchors) {
    Object.keys(generatedAnchors).forEach(key => {
      if (!existingAnchors[key] || !timingSafeEqual(String(existingAnchors[key]), generatedAnchors[key])) {
        throw new Error("Existing private bank trust anchor conflicts with the freshly generated authoritative bank.");
      }
    });
  } else {
    properties.setProperty("PRIVATE_BANK_DIGESTS_V1", JSON.stringify(generatedAnchors));
  }
  return {
    ok: true,
    backendVersion: BACKEND_VERSION,
    issuanceEnabled: false,
    banks: report
  };
  } finally {
    lock.releaseLock();
  }
}

function setAuthoritativeAttemptIssuanceEnabled(enabled) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  if (typeof enabled !== "boolean") throw new Error("Issuance flag must be boolean.");
  if (enabled) {
    if (!isLegalPilotApproved()) throw new Error("Legal pilot approval is not enabled.");
    assertAuthoritativeConfigurationReady();
    assertAuthoritativePrivateStorageNotShared();
    readRequiredJsonArray(getInvitesFilePath(), "Invite store");
    readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
    Object.keys(BANK_VERSIONS_BY_ID).filter(testId => testId !== "dev-quick").forEach(testId => {
      loadAuthoritativePrivateBank(testId, BANK_VERSIONS_BY_ID[testId]);
    });
  }
  PropertiesService.getScriptProperties().setProperty("ATTEMPT_ISSUANCE_ENABLED", enabled ? "true" : "false");
  return { ok: true, issuanceEnabled: enabled, backendVersion: BACKEND_VERSION };
  } finally {
    lock.releaseLock();
  }
}

function setAttemptIssuanceEnabledForOwner(enabled) {
  return setAuthoritativeAttemptIssuanceEnabled(enabled);
}

function isLegalPilotApproved() {
  return getScriptProperty(LEGAL_PILOT_APPROVAL_PROPERTY) === "true";
}

function buildLegalPilotLockedResponse() {
  return {
    ok: false,
    status: "legal_pilot_locked",
    retryable: false,
    failureCode: "legal_pilot_locked",
    backendVersion: BACKEND_VERSION,
    privacyConsentVersion: PRIVACY_CONSENT_VERSION,
    message: "Пилот заблокирован до заполнения реквизитов оператора и завершения юридического checklist."
  };
}

function setLegalPilotApprovedForOwner(enabled, consentVersion) {
  if (typeof enabled !== "boolean") throw new Error("Legal pilot flag must be boolean.");
  if (enabled && String(consentVersion || "") !== PRIVACY_CONSENT_VERSION) {
    throw new Error("Current privacy consent version must be confirmed explicitly.");
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(LEGAL_PILOT_APPROVAL_PROPERTY, enabled ? "true" : "false");
    if (!enabled) properties.setProperty("ATTEMPT_ISSUANCE_ENABLED", "false");
    return {
      ok: true,
      legalPilotApproved: enabled,
      issuanceEnabled: enabled && properties.getProperty("ATTEMPT_ISSUANCE_ENABLED") === "true",
      privacyConsentVersion: PRIVACY_CONSENT_VERSION,
      backendVersion: BACKEND_VERSION
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizeInviteCode(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");
  return /^SC1[A-F0-9]{32}$/.test(normalized) ? normalized : "";
}

function hashInviteCode(inviteCode) {
  return hmacSha256Hex(getRequiredProperty("INVITE_CODE_SECRET_V1"), "invite-code-v1|" + normalizeInviteCode(inviteCode));
}

function hashAuthoritativeIdentity(testId, email) {
  return hmacSha256Hex(
    getRequiredProperty("IDENTITY_HASH_SECRET_V1"),
    "identity-v1|" + String(testId || "") + "|" + String(email || "").trim().toLowerCase()
  );
}

function hashAuthoritativeFingerprint(testId, fingerprint) {
  return hmacSha256Hex(
    getRequiredProperty("IDENTITY_HASH_SECRET_V1"),
    "fingerprint-v1|" + String(testId || "") + "|" + String(fingerprint || "").trim().toLowerCase()
  );
}

function maskCandidateEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2) return "***";
  const local = parts[0];
  return (local ? local.charAt(0) : "*") + "***@" + parts[1];
}

function buildDeterministicInviteCode(inviteId, testId, emailHash) {
  const raw = hmacSha256Hex(
    getRequiredProperty("INVITE_CODE_SECRET_V1"),
    "invite-value-v1|" + inviteId + "|" + testId + "|" + emailHash
  ).slice(0, 32).toUpperCase();
  return "SC1-" + raw.match(/.{1,4}/g).join("-");
}

function normalizeAdminInviteRequestId(value) {
  const requestId = String(value || "").trim();
  return /^sci_[a-z0-9]{24,40}$/.test(requestId) ? requestId : "";
}

function buildAdminInviteResponse(invite, replayed) {
  return {
    ok: true,
    status: "issued",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    inviteId: String(invite.inviteId || ""),
    inviteCode: buildDeterministicInviteCode(invite.inviteId, invite.testId, invite.emailHash),
    testId: String(invite.testId || ""),
    emailMasked: String(invite.emailMasked || "***"),
    purpose: String(invite.purpose || ""),
    expiresAt: String(invite.expiresAt || ""),
    replayed: Boolean(replayed)
  };
}

function issuePilotInviteInternal(parameters) {
  if (!isLegalPilotApproved()) return buildLegalPilotLockedResponse();
  if (getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") !== "true") {
    return {
      ok: false,
      status: "pilot_locked",
      retryable: false,
      failureCode: "pilot_locked",
      backendVersion: BACKEND_VERSION,
      message: "Выпуск приглашений заблокирован до готовности пилотного банка."
    };
  }
  assertAuthoritativeConfigurationReady();
  assertAuthoritativePrivateStorageNotShared(parameters.testId);
  loadAuthoritativePrivateBank(parameters.testId, BANK_VERSIONS_BY_ID[parameters.testId]);
  const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
  const emailHash = hashAuthoritativeIdentity(parameters.testId, parameters.email);
  const existing = invites.find(invite => invite && invite.adminRequestId === parameters.requestId);
  if (existing) {
    if (existing.testId !== parameters.testId || !timingSafeEqual(existing.emailHash, emailHash) ||
        Number(existing.validForHours || 0) !== Number(parameters.validForHours) ||
        String(existing.purpose || "") !== String(parameters.purpose || "") ||
        Boolean(existing.allowRetake) !== Boolean(parameters.allowRetake)) {
      return buildSubmissionConflictResponse();
    }
    return buildAdminInviteResponse(existing, true);
  }

  const now = new Date();
  const inviteId = "inv_" + randomHex(32);
  const inviteCode = buildDeterministicInviteCode(inviteId, parameters.testId, emailHash);
  const invite = {
    schemaVersion: 1,
    inviteId: inviteId,
    adminRequestId: parameters.requestId,
    codeHash: hashInviteCode(inviteCode),
    emailHash: emailHash,
    emailMasked: maskCandidateEmail(parameters.email),
    testId: parameters.testId,
    state: "issued",
    purpose: String(parameters.purpose || ""),
    allowRetake: Boolean(parameters.allowRetake),
    validForHours: Number(parameters.validForHours),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + Number(parameters.validForHours) * 60 * 60 * 1000).toISOString(),
    attemptId: "",
    activatedAt: "",
    completedAt: "",
    revokedAt: ""
  };
  invites.push(invite);
  writeRequiredJsonArray(getInvitesFilePath(), invites);
  return buildAdminInviteResponse(invite, false);
}

function adminCreateInvite(data) {
  try {
    assertAllowedObjectKeys(data, [
      "action", "apiVersion", "password", "requestId", "testId", "email", "validForHours", "purpose"
    ], "adminCreateInvite");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) return buildClientUpgradeRequiredResponse();
    if (!isLegalPilotApproved()) return buildLegalPilotLockedResponse();
    if (getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") !== "true") {
      return {
        ok: false,
        status: "pilot_locked",
        retryable: false,
        failureCode: "pilot_locked",
        backendVersion: BACKEND_VERSION,
        message: "Выпуск приглашений заблокирован до готовности пилотного банка."
      };
    }
    const requestId = normalizeAdminInviteRequestId(data.requestId);
    if (!requestId) return buildValidationErrorResponse("invalid_request_id", "Некорректный идентификатор операции.");
    const testId = validateTestId(data.testId);
    assertPublicTestEnabled(testId);
    const parameters = {
      requestId: requestId,
      testId: testId,
      email: validateEmail(data.email),
      validForHours: validateInteger(data.validForHours, 1, 720, "Срок приглашения"),
      purpose: validateBoundedText(data.purpose, 120, false, "Назначение приглашения"),
      allowRetake: false
    };
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      return issuePilotInviteInternal(parameters);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (error && error.publicRequestError) return buildValidationErrorResponse(error.failureCode, error.publicMessage);
    console.error("Admin invite creation failed.");
    return buildAuthoritativeStorageErrorResponse();
  }
}

function adminListInvites(data) {
  try {
    assertAllowedObjectKeys(data, ["action", "apiVersion", "password"], "adminInvites");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) return buildClientUpgradeRequiredResponse();
    const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
    return {
      ok: true,
      status: "ok",
      backendVersion: BACKEND_VERSION,
      apiVersion: AUTHORITATIVE_API_VERSION,
      issuanceEnabled: getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") === "true",
      legalPilotApproved: isLegalPilotApproved(),
      privacyConsentVersion: PRIVACY_CONSENT_VERSION,
      invites: invites.map(invite => ({
        inviteId: String(invite && invite.inviteId || ""),
        testId: String(invite && invite.testId || ""),
        emailMasked: String(invite && invite.emailMasked || "***"),
        purpose: String(invite && invite.purpose || ""),
        state: String(invite && invite.state || "unknown"),
        issuedAt: String(invite && invite.issuedAt || ""),
        expiresAt: String(invite && invite.expiresAt || ""),
        activatedAt: String(invite && invite.activatedAt || ""),
        completedAt: String(invite && invite.completedAt || "")
      }))
    };
  } catch (error) {
    if (error && error.publicRequestError) return buildValidationErrorResponse(error.failureCode, error.publicMessage);
    console.error("Admin invite listing failed.");
    return buildAuthoritativeStorageErrorResponse();
  }
}

function adminRevokeInvite(data) {
  try {
    assertAllowedObjectKeys(data, ["action", "apiVersion", "password", "requestId", "inviteId"], "adminRevokeInvite");
    if (String(data.apiVersion || "") !== AUTHORITATIVE_API_VERSION) return buildClientUpgradeRequiredResponse();
    const requestId = String(data.requestId || "").trim();
    if (!/^scr_[a-z0-9]{24,40}$/.test(requestId)) {
      return buildValidationErrorResponse("invalid_request_id", "Некорректный идентификатор операции.");
    }
    const inviteId = String(data.inviteId || "").trim();
    if (!/^inv_[a-f0-9]{32}$/.test(inviteId)) return buildValidationErrorResponse("invalid_invite", "Некорректное приглашение.");
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
      const invite = invites.find(row => row && row.inviteId === inviteId);
      if (!invite) return { ok: false, status: "not_found", failureCode: "invite_not_found", message: "Приглашение не найдено." };
      if (invite.state === "completed") {
        return { ok: true, status: "completed", inviteId: inviteId, requestId: requestId, replayed: false, backendVersion: BACKEND_VERSION };
      }
      if (invite.state === "revoked") {
        if (invite.revokeRequestId === requestId) {
          return { ok: true, status: "revoked", inviteId: inviteId, requestId: requestId, replayed: true, backendVersion: BACKEND_VERSION };
        }
        return buildSubmissionConflictResponse();
      }
      if (invite.state !== "completed") {
        invite.state = "revoked";
        invite.revokedAt = new Date().toISOString();
        invite.revokeRequestId = requestId;
        writeRequiredJsonArray(getInvitesFilePath(), invites);
      }
      return { ok: true, status: "revoked", inviteId: inviteId, requestId: requestId, replayed: false, backendVersion: BACKEND_VERSION };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (error && error.publicRequestError) return buildValidationErrorResponse(error.failureCode, error.publicMessage);
    console.error("Admin invite revocation failed.");
    return buildAuthoritativeStorageErrorResponse();
  }
}

function createOwnerSmokeInvite(email, testId, purpose) {
  assertAuthoritativeConfigurationReady();
  const normalizedTestId = validateTestId(testId);
  assertPublicTestEnabled(normalizedTestId);
  const parameters = {
    requestId: "sci_" + randomHex(24),
    testId: normalizedTestId,
    email: validateEmail(email),
    validForHours: 24,
    purpose: validateBoundedText(purpose || "Owner production smoke", 120, true, "Назначение приглашения"),
    allowRetake: true
  };
  readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return issuePilotInviteInternal(parameters);
  } finally {
    lock.releaseLock();
  }
}

function buildQuestionSetHash(testId, bankVersion, questionIds) {
  return sha256Hex("question-set-v1|" + testId + "|" + bankVersion + "|" + questionIds.join("|"));
}

function buildAttemptToken(session) {
  const header = { alg: "HS256", kid: "attempt-v2", typ: "SC-ATTEMPT" };
  const claims = {
    v: 2,
    attemptId: String(session.attemptId || ""),
    jti: String(session.tokenJti || ""),
    tid: String(session.testId || ""),
    bv: String(session.bankVersion || ""),
    qsh: String(session.questionSetHash || ""),
    pcv: String(session.privacyConsentVersion || ""),
    iat: Math.floor(new Date(session.tokenIssuedAt).getTime() / 1000),
    exp: Math.floor(new Date(session.tokenExpiresAt).getTime() / 1000)
  };
  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedClaims = base64UrlEncodeText(JSON.stringify(claims));
  const signingInput = encodedHeader + "." + encodedClaims;
  const signature = base64UrlEncodeBytes(hmacSha256Bytes(getRequiredProperty("ATTEMPT_SIGNING_SECRET_V1"), signingInput));
  return signingInput + "." + signature;
}

function verifyAttemptToken(token, allowExpired) {
  try {
    const segments = String(token || "").split(".");
    if (segments.length !== 3 || segments.some(segment => !/^[A-Za-z0-9_-]+$/.test(segment))) return { valid: false };
    const signingInput = segments[0] + "." + segments[1];
    const expected = base64UrlEncodeBytes(hmacSha256Bytes(getRequiredProperty("ATTEMPT_SIGNING_SECRET_V1"), signingInput));
    if (!timingSafeEqual(expected, segments[2])) return { valid: false };
    const header = JSON.parse(base64UrlDecodeText(segments[0]));
    const claims = JSON.parse(base64UrlDecodeText(segments[1]));
    if (!isPlainObject(header) || !isPlainObject(claims) || header.alg !== "HS256" ||
        Object.keys(header).sort().join(",") !== "alg,kid,typ" ||
        Object.keys(claims).sort().join(",") !== "attemptId,bv,exp,iat,jti,pcv,qsh,tid,v" ||
        header.kid !== "attempt-v2" || header.typ !== "SC-ATTEMPT" || Number(claims.v) !== 2 ||
        !/^att_[a-f0-9]{32,64}$/.test(String(claims.attemptId || "")) ||
        !/^[a-f0-9]{64}$/.test(String(claims.qsh || "")) ||
        !/^[a-f0-9]{32,64}$/.test(String(claims.jti || "")) ||
        String(claims.pcv || "") !== PRIVACY_CONSENT_VERSION ||
        !Number.isFinite(Number(claims.iat)) || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Number(claims.iat) ||
        Number(claims.iat) > Math.floor(Date.now() / 1000) + 60 ||
        (!allowExpired && Number(claims.exp) <= Math.floor(Date.now() / 1000))) {
      return { valid: false };
    }
    return { valid: true, header: header, claims: claims };
  } catch (error) {
    return { valid: false };
  }
}

function selectAuthoritativeQuestionIds(bank, attemptId, selectionNonce) {
  const ordered = bank.questions.map(question => String(question.id)).sort((left, right) => {
    const leftHash = sha256Hex("selection-v1|" + attemptId + "|" + selectionNonce + "|" + left);
    const rightHash = sha256Hex("selection-v1|" + attemptId + "|" + selectionNonce + "|" + right);
    return leftHash < rightHash ? -1 : (leftHash > rightHash ? 1 : left.localeCompare(right));
  });
  return ordered.slice(0, Number(bank.questionsPerAttempt));
}

function hasRecentAuthoritativeRetake(testId, identityHash, legacyEmailHash, sessions) {
  const now = Date.now();
  if (sessions.some(session => {
    if (!session || session.testId !== testId || !timingSafeEqual(String(session.identityHash || ""), identityHash)) return false;
    if (session.state === "active") {
      const expiresAt = new Date(session.tokenExpiresAt || "").getTime();
      return Number.isFinite(expiresAt) && now < expiresAt;
    }
    if (session.state === "reserved") {
      const reservedAt = new Date(session.reservedAt || "").getTime();
      return Number.isFinite(reservedAt) && now - reservedAt >= 0 && now - reservedAt < AUTHORITATIVE_RECOVERY_TTL_MS;
    }
    if (session.state !== "completed") return false;
    const completedAt = new Date(session.completedAt || session.startedAt || "").getTime();
    return Number.isFinite(completedAt) && now - completedAt >= 0 && now - completedAt < RETAKE_WINDOW_MS;
  })) return true;

  const legacyText = readTextFromYandexDisk(getAttemptsFilePath());
  if (legacyText === null) return false;
  let legacyAttempts;
  try {
    legacyAttempts = JSON.parse(legacyText);
  } catch (error) {
    throw new Error("Legacy attempt store is corrupt.");
  }
  if (!Array.isArray(legacyAttempts)) throw new Error("Legacy attempt store is invalid.");
  return legacyAttempts.some(attempt => {
    if (!attempt || attempt.testId !== testId || !timingSafeEqual(String(attempt.emailHash || ""), legacyEmailHash)) return false;
    const date = new Date(attempt.date || "").getTime();
    return Number.isFinite(date) && now - date >= 0 && now - date < RETAKE_WINDOW_MS &&
      !(attempt.submissionState === "reserved" && now - date >= RESERVATION_TTL_MS);
  });
}

function buildBeginAttemptReadyResponse(session, bank, resumed) {
  return {
    ok: true,
    status: "ready",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    attemptId: String(session.attemptId || ""),
    attemptToken: buildAttemptToken(session),
    expiresAt: String(session.tokenExpiresAt || ""),
    testId: String(session.testId || ""),
    testVersion: String(session.testVersion || ""),
    bankVersion: String(session.bankVersion || ""),
    publicDigest: String(bank.publicDigest || ""),
    questionIds: session.questionIds.slice(),
    privacyConsentVersion: String(session.privacyConsentVersion || ""),
    privacyConsentedAt: String(session.privacyConsentedAt || ""),
    resumed: Boolean(resumed)
  };
}

function beginAuthoritativeAttempt(data) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    if (!isLegalPilotApproved()) return buildAttemptUnavailableResponse();
    if (getScriptProperty("ATTEMPT_ISSUANCE_ENABLED") !== "true") return buildAttemptUnavailableResponse();
    assertAuthoritativeConfigurationReady();
    assertAuthoritativePrivateStorageNotShared(data.testId);
    const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
    const sessions = readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
    const suppliedCodeHash = hashInviteCode(data.inviteCode);
    const identityHash = hashAuthoritativeIdentity(data.testId, data.email);
    const fingerprintHash = hashAuthoritativeFingerprint(data.testId, data.browserFingerprint);
    const legacyEmailHash = hashAttemptValue(data.testId, "email", data.email);
    const invite = invites.find(row => row && timingSafeEqual(String(row.codeHash || ""), suppliedCodeHash));
    if (!invite || invite.testId !== data.testId || !timingSafeEqual(String(invite.emailHash || ""), identityHash) ||
        ["issued", "active"].indexOf(String(invite.state || "")) === -1) {
      return buildAttemptUnavailableResponse();
    }
    const inviteExpiry = new Date(invite.expiresAt || "").getTime();
    if (!Number.isFinite(inviteExpiry) || Date.now() >= inviteExpiry) return buildAttemptUnavailableResponse();

    const existingSession = sessions.find(session => session && session.inviteId === invite.inviteId);
    if (existingSession) {
      if (existingSession.state !== "active" || existingSession.beginRequestId !== data.beginRequestId || existingSession.testId !== data.testId ||
          existingSession.privacyConsentVersion !== data.privacyConsentVersion || existingSession.ageConfirmed !== true ||
          !timingSafeEqual(String(existingSession.identityHash || ""), identityHash) ||
          !timingSafeEqual(String(existingSession.fingerprintHash || ""), fingerprintHash)) {
        return buildAttemptUnavailableResponse();
      }
      const activeExpiry = new Date(existingSession.tokenExpiresAt || "").getTime();
      if (!Number.isFinite(activeExpiry) || Date.now() >= activeExpiry) {
        existingSession.state = "expired";
        invite.state = "expired";
        writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions);
        writeRequiredJsonArray(getInvitesFilePath(), invites);
        return buildAttemptUnavailableResponse();
      }
      const existingBank = loadAuthoritativePrivateBank(existingSession.testId, existingSession.bankVersion);
      if (invite.state !== "active" || invite.attemptId !== existingSession.attemptId) {
        invite.state = "active";
        invite.attemptId = existingSession.attemptId;
        invite.activatedAt = existingSession.startedAt;
        writeRequiredJsonArray(getInvitesFilePath(), invites);
      }
      return buildBeginAttemptReadyResponse(existingSession, existingBank, true);
    }

    if (!invite.allowRetake && hasRecentAuthoritativeRetake(data.testId, identityHash, legacyEmailHash, sessions)) {
      return buildAttemptUnavailableResponse();
    }
    const bank = loadAuthoritativePrivateBank(data.testId, BANK_VERSIONS_BY_ID[data.testId]);
    const now = new Date();
    const attemptId = "att_" + randomHex(32);
    const selectionNonce = randomHex(32);
    const questionIds = selectAuthoritativeQuestionIds(bank, attemptId, selectionNonce);
    if (questionIds.length !== EXPECTED_ANSWERS_BY_TEST_ID[data.testId]) throw new Error("Authoritative question selection failed.");
    const expiresAt = new Date(now.getTime() + ATTEMPT_ACTIVE_TTL_MS);
    const session = {
      schemaVersion: 2,
      attemptId: attemptId,
      inviteId: String(invite.inviteId),
      beginRequestId: String(data.beginRequestId),
      state: "active",
      testId: data.testId,
      testVersion: TEST_VERSIONS_BY_ID_AUTHORITATIVE[data.testId],
      bankVersion: bank.bankVersion,
      publicDigest: bank.publicDigest,
      questionIds: questionIds,
      questionSetHash: buildQuestionSetHash(data.testId, bank.bankVersion, questionIds),
      identityHash: identityHash,
      fingerprintHash: fingerprintHash,
      legacyEmailHash: legacyEmailHash,
      tokenKid: "attempt-v2",
      tokenJti: randomHex(32),
      tokenIssuedAt: now.toISOString(),
      tokenExpiresAt: expiresAt.toISOString(),
      startedAt: now.toISOString(),
      privacyConsentVersion: data.privacyConsentVersion,
      privacyConsentedAt: now.toISOString(),
      ageConfirmed: true,
      saveRequestId: "",
      submissionHash: "",
      reservedAt: "",
      code: "",
      result: null,
      completedAt: ""
    };
    sessions.push(session);
    writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions);
    invite.state = "active";
    invite.attemptId = attemptId;
    invite.activatedAt = now.toISOString();
    writeRequiredJsonArray(getInvitesFilePath(), invites);
    return buildBeginAttemptReadyResponse(session, bank, false);
  } catch (error) {
    console.error("Authoritative attempt start failed.");
    return buildAuthoritativeStorageErrorResponse();
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function buildAuthoritativeSubmissionHash(data) {
  const canonical = {
    schemaVersion: 1,
    attemptId: String(data.attemptId || ""),
    testId: String(data.testId || ""),
    bankVersion: String(data.bankVersion || ""),
    name: String(data.name || "").trim(),
    email: String(data.email || "").trim().toLowerCase(),
    telegram: String(data.telegram || ""),
    englishLevel: String(data.englishLevel || ""),
    candidateSource: String(data.candidateSource || ""),
    candidateExperience: String(data.candidateExperience || ""),
    employerShareConsent: Boolean(data.employerShareConsent),
    privacyConsentVersion: String(data.privacyConsentVersion || ""),
    ageConfirmed: Boolean(data.ageConfirmed),
    browserFingerprint: String(data.browserFingerprint || ""),
    tabSwitches: Number(data.tabSwitches || 0),
    clientBuild: String(data.clientBuild || ""),
    answers: (data.answers || []).slice().sort((left, right) => left.questionId.localeCompare(right.questionId)).map(answer => ({
      questionId: String(answer.questionId || ""),
      optionId: answer.optionId === null ? null : String(answer.optionId || ""),
      timedOut: Boolean(answer.timedOut),
      timeSpent: Number(answer.timeSpent || 0)
    }))
  };
  return hmacSha256Hex(
    getRequiredProperty("ATTEMPT_SIGNING_SECRET_V1"),
    "submission-v1|" + JSON.stringify(canonical)
  );
}

function getAuthoritativeBlockName(blocks, blockKey) {
  const source = blocks && blocks[blockKey];
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && source.name) return String(source.name);
  return String(blockKey || "");
}

function getAuthoritativeRecommendation(finalScore) {
  if (finalScore >= SUCCESS_THRESHOLD) return "Рекомендуется к интервью";
  if (finalScore >= 60) return "Можно рассмотреть при наличии стажировки / junior-позиции";
  return "Не рекомендуется без дополнительной проверки";
}

function calculateAuthoritativeScore(data, session, bank) {
  const expectedIds = Array.isArray(session.questionIds) ? session.questionIds.map(String) : [];
  if (data.answers.length !== expectedIds.length || expectedIds.length !== EXPECTED_ANSWERS_BY_TEST_ID[data.testId]) {
    throw publicRequestError("invalid_answers_count", "Количество ответов не соответствует попытке.");
  }
  const answersById = Object.create(null);
  data.answers.forEach(answer => { answersById[answer.questionId] = answer; });
  if (expectedIds.some(questionId => !Object.prototype.hasOwnProperty.call(answersById, questionId)) ||
      Object.keys(answersById).some(questionId => expectedIds.indexOf(questionId) === -1)) {
    throw publicRequestError("question_set_mismatch", "Набор вопросов не соответствует попытке.");
  }
  const questionsById = Object.create(null);
  bank.questions.forEach(question => { questionsById[String(question.id)] = question; });
  const blockTotals = Object.create(null);
  const answerDetails = [];
  let rawScore = 0;
  let rawTotal = 0;
  let unansweredCount = 0;

  expectedIds.forEach((questionId, index) => {
    const question = questionsById[questionId];
    const answer = answersById[questionId];
    if (!question) throw publicRequestError("question_set_mismatch", "Версия банка вопросов не соответствует попытке.");
    const optionMap = Object.create(null);
    question.options.forEach(option => { optionMap[String(option.id)] = option; });
    if (answer.optionId !== null && !optionMap[answer.optionId]) {
      throw publicRequestError("invalid_option", "Один из выбранных вариантов не относится к вопросу.");
    }
    const points = Number(question.points || 0);
    if (!Number.isFinite(points) || points <= 0) throw new Error("Authoritative bank contains invalid points.");
    const isCorrect = answer.optionId !== null && answer.optionId === question.correctOptionId;
    const earnedPoints = isCorrect ? points : 0;
    rawTotal += points;
    rawScore += earnedPoints;
    if (answer.optionId === null) unansweredCount++;
    if (!blockTotals[question.block]) blockTotals[question.block] = { earned: 0, total: 0 };
    blockTotals[question.block].earned += earnedPoints;
    blockTotals[question.block].total += points;
    const selectedOption = answer.optionId === null ? null : optionMap[answer.optionId];
    const correctOption = optionMap[question.correctOptionId];
    answerDetails.push({
      number: index + 1,
      questionId: questionId,
      topic: String(question.topic || ""),
      block: String(question.block || ""),
      difficulty: String(question.difficulty || "medium"),
      question: String(question.text || ""),
      selectedAnswer: selectedOption ? String(selectedOption.text || "") : "Нет ответа",
      correctAnswer: correctOption ? String(correctOption.text || "") : "",
      isCorrect: isCorrect,
      timedOut: Boolean(answer.timedOut),
      status: answer.optionId === null ? (answer.timedOut ? "Время вышло" : "Нет ответа") : (isCorrect ? "Верно" : "Неверно"),
      points: points,
      earnedPoints: earnedPoints,
      timeLimit: Number(question.timeLimit || 0),
      timeSpent: Number(answer.timeSpent || 0),
      comment: String(question.comment || "")
    });
  });

  const percent = rawTotal > 0 ? Math.round(rawScore * 100 / rawTotal) : 0;
  const finalScore = Math.max(0, Math.min(100, percent));
  const advisoryPenalty = calculateServerPenalty(data.tabSwitches);
  const trustScore = calculateServerTrustScore(finalScore, data.tabSwitches, unansweredCount);
  const passStatus = finalScore >= SUCCESS_THRESHOLD ? "passed" : "failed";
  const blockResults = Object.create(null);
  Object.keys(blockTotals).forEach(blockKey => {
    const total = blockTotals[blockKey].total;
    const earned = blockTotals[blockKey].earned;
    blockResults[blockKey] = {
      name: getAuthoritativeBlockName(bank.blocks, blockKey),
      weight: rawTotal > 0 ? total / rawTotal : 0,
      earned: earned,
      total: total,
      percent: total > 0 ? Math.round(earned * 100 / total) : 0
    };
  });
  return {
    result: {
      rawScore: rawScore,
      rawTotal: rawTotal,
      unansweredCount: unansweredCount,
      percent: percent,
      finalScore: finalScore,
      penalty: 0,
      advisoryPenalty: advisoryPenalty,
      tabSwitches: Number(data.tabSwitches || 0),
      trustScore: trustScore,
      badge: getAdminBadge(finalScore, 0),
      passStatus: passStatus,
      status: passStatus,
      decision: passStatus === "passed" ? "Успешно" : "Неуспешно",
      finalDecision: passStatus === "passed" ? "Успешно" : "Неуспешно",
      recommendation: getAuthoritativeRecommendation(finalScore),
      blockResults: blockResults,
      scoreVerification: SCORE_VERIFICATION_SERVER,
      scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
      telemetryVerification: TELEMETRY_VERIFICATION_CLIENT_REPORTED,
      reportCreated: false
    },
    answerDetails: answerDetails
  };
}

function validateTokenAgainstSession(tokenResult, session) {
  if (!tokenResult || !tokenResult.valid || !session) return false;
  const claims = tokenResult.claims;
  return claims.attemptId === session.attemptId &&
    claims.tid === session.testId && claims.bv === session.bankVersion &&
    claims.pcv === session.privacyConsentVersion &&
    timingSafeEqual(String(claims.qsh || ""), String(session.questionSetHash || "")) &&
    timingSafeEqual(String(claims.jti || ""), String(session.tokenJti || "")) &&
    Number(claims.iat) === Math.floor(new Date(session.tokenIssuedAt).getTime() / 1000) &&
    Number(claims.exp) === Math.floor(new Date(session.tokenExpiresAt).getTime() / 1000);
}

function buildAuthoritativeSavedResultResponse(session, result, replayed) {
  result = result || {};
  return {
    ok: true,
    status: "ok",
    backendVersion: BACKEND_VERSION,
    apiVersion: AUTHORITATIVE_API_VERSION,
    attemptId: String(session.attemptId || ""),
    resultCode: String(session.code || ""),
    code: String(session.code || ""),
    testId: String(session.testId || ""),
    bankVersion: String(session.bankVersion || ""),
    rawScore: Number(result.rawScore || 0),
    rawTotal: Number(result.rawTotal || 0),
    unansweredCount: Number(result.unansweredCount || 0),
    percent: Number(result.percent || 0),
    finalScore: Number(result.finalScore || 0),
    penalty: 0,
    advisoryPenalty: Number(result.advisoryPenalty || 0),
    tabSwitches: Number(result.tabSwitches || 0),
    trustScore: Number(result.trustScore || 0),
    badge: String(result.badge || ""),
    passStatus: result.passStatus === "passed" ? "passed" : "failed",
    decision: String(result.decision || result.finalDecision || ""),
    finalDecision: String(result.finalDecision || result.decision || ""),
    recommendation: String(result.recommendation || ""),
    blockResults: result.blockResults || {},
    scoreVerification: SCORE_VERIFICATION_SERVER,
    scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
    telemetryVerification: TELEMETRY_VERIFICATION_CLIENT_REPORTED,
    privacyConsentVersion: String(session.privacyConsentVersion || ""),
    privacyConsentedAt: String(session.privacyConsentedAt || ""),
    reportCreated: Boolean(result.reportCreated),
    replayed: Boolean(replayed),
    message: "Сохраните код результата: " + String(session.code || "")
  };
}

function consumeInviteForSession(invites, session, completedAt) {
  const invite = invites.find(row => row && row.inviteId === session.inviteId);
  if (invite && invite.state !== "completed") {
    invite.state = "completed";
    invite.completedAt = String(completedAt || new Date().toISOString());
    invite.attemptId = session.attemptId;
    return true;
  }
  return false;
}

function saveAuthoritativeTestResult(data) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let requestIdForLog = data && data.requestId || "";
  try {
    assertAuthoritativeConfigurationReady();
    const tokenResult = verifyAttemptToken(data.attemptToken, true);
    if (!tokenResult.valid) return buildAttemptUnavailableResponse();
    const normalizedTelegram = normalizeTelegramContact(data.telegram);
    const normalizedData = Object.assign({}, data, { telegram: normalizedTelegram });
    const submissionHash = buildAuthoritativeSubmissionHash(normalizedData);

    lock.waitLock(30000);
    lockAcquired = true;
    ensureSkillCheckFolders();
    assertAuthoritativePrivateStorageNotShared(data.testId);
    const sessions = readRequiredJsonArray(getAttemptSessionsFilePath(), "Attempt session store");
    const invites = readRequiredJsonArray(getInvitesFilePath(), "Invite store");
    const session = sessions.find(row => row && row.attemptId === data.attemptId);
    if (!session || session.testId !== data.testId || session.bankVersion !== data.bankVersion ||
        session.privacyConsentVersion !== data.privacyConsentVersion || session.ageConfirmed !== true || data.ageConfirmed !== true ||
        !validateTokenAgainstSession(tokenResult, session) ||
        !timingSafeEqual(String(session.identityHash || ""), hashAuthoritativeIdentity(data.testId, data.email)) ||
        !timingSafeEqual(String(session.fingerprintHash || ""), hashAuthoritativeFingerprint(data.testId, data.browserFingerprint))) {
      return buildAttemptUnavailableResponse();
    }
    const sessionInvite = invites.find(row => row && row.inviteId === session.inviteId);
    if (!sessionInvite) return buildAttemptUnavailableResponse();

    if (session.state === "completed") {
      if (session.saveRequestId !== data.requestId || !timingSafeEqual(session.submissionHash, submissionHash)) {
        return buildSubmissionConflictResponse();
      }
      const replayBase = new Date(session.completedAt || session.reservedAt || "").getTime();
      if (!Number.isFinite(replayBase) || Date.now() - replayBase > AUTHORITATIVE_RECOVERY_TTL_MS) {
        return buildAttemptUnavailableResponse();
      }
      if (consumeInviteForSession(invites, session, session.completedAt)) {
        writeRequiredJsonArray(getInvitesFilePath(), invites);
      }
      return buildAuthoritativeSavedResultResponse(session, session.result, true);
    }

    if (["active", "reserved"].indexOf(String(session.state || "")) === -1) return buildAttemptUnavailableResponse();
    if (session.state === "active" && Date.now() >= Number(tokenResult.claims.exp) * 1000) {
      return buildAttemptUnavailableResponse();
    }
    if (session.state === "reserved") {
      if (session.saveRequestId !== data.requestId || !timingSafeEqual(session.submissionHash, submissionHash)) {
        return buildSubmissionConflictResponse();
      }
      const reservedAt = new Date(session.reservedAt || "").getTime();
      if (!Number.isFinite(reservedAt) || Date.now() - reservedAt > AUTHORITATIVE_RECOVERY_TTL_MS) {
        return buildAttemptUnavailableResponse();
      }
      const existingAdmin = findAdminResultByRequestId(data.requestId);
      if (existingAdmin && existingAdmin.attemptId === session.attemptId &&
          existingAdmin.bankVersion === session.bankVersion &&
          existingAdmin.scoreVerification === SCORE_VERIFICATION_SERVER &&
          existingAdmin.scoringAlgorithmVersion === AUTHORITATIVE_SCORING_VERSION &&
          timingSafeEqual(String(existingAdmin.payloadHash || ""), submissionHash)) {
        const recoveryResult = Object.assign({}, session.result || {}, { reportCreated: Boolean(existingAdmin.reportCreated) });
        const recoveryHashes = hashAttemptIdentifiers(session.testId, data.email, data.browserFingerprint);
        upsertAttemptRecord({
          emailHash: recoveryHashes.emailHash,
          fingerprintHash: recoveryHashes.fingerprintHash,
          testId: session.testId,
          code: session.code,
          date: String(existingAdmin.date || new Date().toISOString()),
          status: recoveryResult.passStatus,
          requestId: data.requestId,
          payloadHash: submissionHash,
          payloadHashVersion: 3,
          submissionState: "completed",
          finalScore: recoveryResult.finalScore,
          percent: recoveryResult.percent,
          reportCreated: Boolean(existingAdmin.reportCreated),
          attemptId: session.attemptId,
          bankVersion: session.bankVersion,
          scoreVerification: SCORE_VERIFICATION_SERVER,
          scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION
        });
        session.state = "completed";
        session.completedAt = String(existingAdmin.date || new Date().toISOString());
        session.result = recoveryResult;
        writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions);
        if (consumeInviteForSession(invites, session, session.completedAt)) writeRequiredJsonArray(getInvitesFilePath(), invites);
        return buildAuthoritativeSavedResultResponse(session, session.result, true);
      }
    }

    if (sessionInvite.state !== "active") return buildAttemptUnavailableResponse();

    const bank = loadAuthoritativePrivateBank(session.testId, session.bankVersion);
    if (!timingSafeEqual(String(session.publicDigest || ""), String(bank.publicDigest || ""))) {
      throw new Error("Attempt bank digest no longer matches private bank.");
    }
    const calculated = calculateAuthoritativeScore(normalizedData, session, bank);
    let result = calculated.result;
    if (session.state === "active") {
      session.state = "reserved";
      session.saveRequestId = data.requestId;
      session.submissionHash = submissionHash;
      session.reservedAt = new Date().toISOString();
      session.code = generateUniqueResultCode(session.testId, sessions);
      session.result = JSON.parse(JSON.stringify(result));
      writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions);
    } else {
      result = session.result || result;
      if (!session.code || Number(result.finalScore) !== Number(calculated.result.finalScore) ||
          Number(result.rawScore) !== Number(calculated.result.rawScore) || Number(result.rawTotal) !== Number(calculated.result.rawTotal)) {
        return buildSubmissionConflictResponse();
      }
      result = calculated.result;
    }

    const completedAt = new Date().toISOString();
    let reportCreated = false;
    let reportPath = "";
    if (result.passStatus === "passed") {
      reportPath = joinDiskPath(getReportsFolderPath(), session.code + ".txt");
      const reportText = buildTxtReport(Object.assign({}, normalizedData, result, {
        code: session.code,
        testId: session.testId,
        testTitle: TEST_TITLES_BY_ID[session.testId],
        bankVersion: session.bankVersion,
        completedAt: completedAt,
        privacyConsentVersion: session.privacyConsentVersion,
        privacyConsentedAt: session.privacyConsentedAt,
        ageConfirmed: session.ageConfirmed === true,
        answers: calculated.answerDetails,
        scoreVerification: SCORE_VERIFICATION_SERVER,
        scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION
      }));
      if (reportText.length > MAX_GENERATED_REPORT_CHARS) {
        return buildValidationErrorResponse("report_too_large", "Отчёт превышает допустимый размер.");
      }
      uploadTextToYandexDisk(reportPath, reportText);
      reportCreated = true;
    }
    result.reportCreated = reportCreated;

    appendAdminResult({
      code: session.code,
      attemptId: session.attemptId,
      testId: session.testId,
      testTitle: TEST_TITLES_BY_ID[session.testId],
      bankVersion: session.bankVersion,
      rawScore: result.rawScore,
      rawTotal: result.rawTotal,
      finalScore: result.finalScore,
      percent: result.percent,
      tabSwitches: result.tabSwitches,
      advisoryPenalty: result.advisoryPenalty,
      date: completedAt,
      status: result.passStatus,
      badge: result.badge,
      reportCreated: reportCreated,
      reportPath: reportPath,
      reportCode: session.code,
      requestId: data.requestId,
      payloadHash: submissionHash,
      payloadHashVersion: 3,
      scoreVerification: SCORE_VERIFICATION_SERVER,
      scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION,
      telemetryVerification: TELEMETRY_VERIFICATION_CLIENT_REPORTED
    });

    const legacyHashes = hashAttemptIdentifiers(session.testId, data.email, data.browserFingerprint);
    upsertAttemptRecord({
      emailHash: legacyHashes.emailHash,
      fingerprintHash: legacyHashes.fingerprintHash,
      testId: session.testId,
      code: session.code,
      date: completedAt,
      status: result.passStatus,
      requestId: data.requestId,
      payloadHash: submissionHash,
      payloadHashVersion: 3,
      submissionState: "completed",
      finalScore: result.finalScore,
      percent: result.percent,
      reportCreated: reportCreated,
      attemptId: session.attemptId,
      bankVersion: session.bankVersion,
      scoreVerification: SCORE_VERIFICATION_SERVER,
      scoringAlgorithmVersion: AUTHORITATIVE_SCORING_VERSION
    });

    session.state = "completed";
    session.completedAt = completedAt;
    session.result = JSON.parse(JSON.stringify(result));
    writeRequiredJsonArray(getAttemptSessionsFilePath(), sessions);
    if (consumeInviteForSession(invites, session, completedAt)) writeRequiredJsonArray(getInvitesFilePath(), invites);
    return buildAuthoritativeSavedResultResponse(session, result, false);
  } catch (error) {
    if (error && error.publicRequestError) return buildValidationErrorResponse(error.failureCode, error.publicMessage);
    console.error("Authoritative result submission failed; request=" + maskRequestIdForLog(requestIdForLog));
    return buildAuthoritativeStorageErrorResponse();
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
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
