const SPREADSHEET_ID = "1XQ_HLeaAtUwwYzxCsQ3Et77wEfsPjkf3NXc7bo2wu9k";
const FOLDER_ID = "1DYheq1_IDFiKcf4oxvsGqQRl7HoqT781";
const RETAKE_DAYS = 21;

const RESULTS_SHEET_NAME = "Results";
const TOP_SHEET_NAME = "Top Candidates";
const DASHBOARD_SHEET_NAME = "Dashboard";
const TOP_TRUST_SCORE_MIN = 70;

const TEST_TITLES_BY_ID = {
  "fa-junior": "Financial Analyst Junior",
  "ca-junior": "Credit Analyst Junior",
  "fpa-junior": "FP&A / Budget Analyst Junior",
  "acc-junior": "Accounting / Reporting Junior",
  "bi-junior": "Finance BI / Data Analyst Junior"
};

const TEST_TITLE_ALIASES_BY_ID = {
  "acc-junior": ["Accounting Junior"]
};

const RESULTS_HEADERS = [
  "Дата",
  "Тест",
  "ID теста",
  "Fingerprint",
  "Версия теста",
  "Версия банка",
  "Имя",
  "Email",
  "Телефон",
  "Английский",
  "Опыт",
  "Источник кандидата",
  "Уход со вкладки",
  "Баллы",
  "Всего",
  "Процент",
  "Итоговый балл",
  "Плашка",
  "Статус",
  "Trust Score",
  "Следующая попытка",
  "Ссылка на TXT отчет"
];

const DEPRECATED_RESULTS_HEADERS = [
  "Решение",
  "Баллы (сырые)",
  "Всего (сырые)"
];

const HEADER_ALIASES = {
  "ID теста": ["Test ID", "testId", "TestId", "Тест ID"],
  "Fingerprint": ["Browser Fingerprint", "browserFingerprint", "Браузерный fingerprint"],
  "Версия теста": ["Версия"],
  "Источник кандидата": ["Источник"],
  "Ссылка на TXT отчет": ["Ссылка на TXT отчёт"]
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action;

  if (action === "checkAttempt") {
    const callback = params.callback || "callback";
    const email = String(params.email || "").trim().toLowerCase();
    const phone = normalizePhone(String(params.phone || ""));
    const testId = String(params.testId || "").trim();
    const browserFingerprint = String(params.browserFingerprint || "").trim();
    const testTitle = getTestTitle(testId, String(params.testTitle || "").trim());

    const result = checkPreviousAttempt(email, phone, testId, browserFingerprint, testTitle);

    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(result) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput("SkillCheck Apps Script работает.");
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const resultsSheet = getOrCreateSheet(ss, RESULTS_SHEET_NAME);
  const topSheet = getOrCreateSheet(ss, TOP_SHEET_NAME);
  const dashboardSheet = getOrCreateSheet(ss, DASHBOARD_SHEET_NAME);

  ensureHeaders(resultsSheet, RESULTS_HEADERS);

  const data = JSON.parse(e.postData.contents);
  const now = new Date();
  const email = String(data.email || "").trim().toLowerCase();
  const phone = normalizePhone(String(data.phone || ""));
  const testId = String(data.testId || "").trim();
  const browserFingerprint = String(data.browserFingerprint || "").trim();
  const testTitle = getTestTitle(testId, data.testTitle || data.testId || "Тест");

  const previousAttempt = checkPreviousAttempt(email, phone, testId, browserFingerprint, testTitle, resultsSheet);
  if (!previousAttempt.allowed) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "blocked",
        blocked: true,
        message: previousAttempt.message,
        nextDate: previousAttempt.nextDate,
        daysLeft: previousAttempt.daysLeft,
        previousAttemptDate: previousAttempt.previousAttemptDate,
        testTitle: previousAttempt.testTitle,
        matchedBy: previousAttempt.matchedBy
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);

  const safeName = String(data.name || "Кандидат").replace(/[\\/:*?"<>|]/g, "");
  const testName = testTitle;

  const fileName = "Отчет SkillCheck - " + testName + " - " + safeName + " - " + Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH-mm-ss"
  ) + ".txt";

  const txtFile = folder.createFile(
    fileName,
    data.txtReport || "TXT отчет не был передан.",
    MimeType.PLAIN_TEXT
  );

  txtFile.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  const txtUrl = txtFile.getUrl();
  const nextAttemptDate = new Date(now.getTime() + RETAKE_DAYS * 24 * 60 * 60 * 1000);

  appendResultRow(resultsSheet, {
    "Дата": now,
    "Тест": testName,
    "ID теста": testId,
    "Fingerprint": browserFingerprint,
    "Версия теста": data.testVersion || "",
    "Версия банка": data.bankVersion || data.testVersion || "",
    "Имя": data.name || "",
    "Email": email,
    "Телефон": data.phone || "",
    "Английский": data.englishLevel || "",
    "Опыт": data.candidateExperience || data.experience || "",
    "Источник кандидата": data.candidateSource || data.source || "",
    "Уход со вкладки": Number(data.tabSwitches || 0),
    "Баллы": Number(data.score || 0),
    "Всего": Number(data.total || 100),
    "Процент": Number(data.percent || data.score || 0),
    "Итоговый балл": Number(data.finalScore || 0),
    "Плашка": data.badge || "",
    "Статус": data.passStatus || "",
    "Trust Score": Number(data.trustScore || 0),
    "Следующая попытка": nextAttemptDate,
    "Ссылка на TXT отчет": txtUrl
  });

  formatResultsSheet(resultsSheet);
  rebuildTopCandidates(ss, topSheet);
  rebuildDashboard(ss, dashboardSheet);

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      txtUrl: txtUrl,
      nextDate: formatDate(nextAttemptDate)
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkPreviousAttempt(email, phone, testId, browserFingerprint, testTitle, existingSheet) {
  const ss = existingSheet ? null : SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = existingSheet || ss.getSheetByName(RESULTS_SHEET_NAME);
  const resolvedTitle = getTestTitle(testId, testTitle);
  const debug = buildRetakeDebug(email, phone, testId, browserFingerprint);

  if (!sheet || sheet.getLastRow() <= 1) {
    return Object.assign({
      allowed: true,
      message: "Попыток не найдено.",
      testTitle: resolvedTitle
    }, debug);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const indexes = buildHeaderIndexMap(headers);
  const now = new Date();
  const msLimit = RETAKE_DAYS * 24 * 60 * 60 * 1000;

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    const attemptDate = parseAttemptDate(getRowValue(row, indexes, "Дата"));
    const rowTest = String(getRowValue(row, indexes, "Тест") || "").trim();
    const rowTestId = String(getRowValue(row, indexes, "ID теста") || "").trim();
    const rowFingerprint = String(getRowValue(row, indexes, "Fingerprint") || "").trim();
    const rowEmail = String(getRowValue(row, indexes, "Email") || "").trim().toLowerCase();
    const rowPhone = normalizePhone(String(getRowValue(row, indexes, "Телефон") || ""));

    if (!attemptDate) continue;

    const sameEmail = Boolean(email && rowEmail && email === rowEmail);
    const samePhone = Boolean(phone && rowPhone && phone === rowPhone);
    const sameFingerprint = Boolean(browserFingerprint && rowFingerprint && browserFingerprint === rowFingerprint);
    const sameTest = isSameTestById(rowTestId, rowTest, testId, resolvedTitle);
    const matchedBy = getRetakeMatchType(sameEmail, samePhone, sameFingerprint);

    if (sameTest && matchedBy !== "none") {
      const diffMs = now.getTime() - attemptDate.getTime();
      debug.foundPreviousAttempt = true;
      debug.previousAttemptDate = formatDate(attemptDate);
      debug.matchedBy = matchedBy;

      if (diffMs < msLimit) {
        const nextDate = new Date(attemptDate.getTime() + msLimit);
        const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const previousAttemptDate = formatDate(attemptDate);
        const nextDateText = formatDate(nextDate);
        debug.daysLeft = daysLeft;
        debug.nextDate = nextDateText;
        const fingerprintOnlyMatch = sameFingerprint && !sameEmail && !samePhone;
        const blockedMessage = fingerprintOnlyMatch
          ? "Похоже, этот тест уже проходили с данного устройства или браузера. Повторная попытка будет доступна " + nextDateText + "."
          : "Вы уже проходили этот тест " + previousAttemptDate + ". Повторная попытка доступна " + nextDateText + ". Осталось " + daysLeft + " дн.";

        return Object.assign({
          allowed: false,
          message: blockedMessage,
          nextDate: nextDateText,
          daysLeft: daysLeft,
          previousAttemptDate: previousAttemptDate,
          testTitle: resolvedTitle
        }, debug);
      }

      return Object.assign({
        allowed: true,
        message: "Предыдущая попытка старше " + RETAKE_DAYS + " дней.",
        testTitle: resolvedTitle
      }, debug);
    }
  }

  return Object.assign({
    allowed: true,
    message: "Можно проходить тест.",
    testTitle: resolvedTitle
  }, debug);
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const currentHeaders = values[0].map(String);
  const sameHeaders = currentHeaders.length === headers.length &&
    currentHeaders.join("||") === headers.join("||");

  if (sameHeaders) {
    sheet.setFrozenRows(1);
    return;
  }

  const migrated = [headers];
  for (let r = 1; r < values.length; r++) {
    migrated.push(headers.map(header => {
      const sourceIndex = findHeaderIndex(currentHeaders, header);
      return sourceIndex >= 0 ? values[r][sourceIndex] : "";
    }));
  }

  sheet.clear();
  sheet.getRange(1, 1, migrated.length, headers.length).setValues(migrated);
  sheet.setFrozenRows(1);
}

function appendResultRow(sheet, result) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(result, header) ? result[header] : ""));
}

function buildHeaderIndexMap(headers) {
  const result = {};
  headers.forEach((header, index) => {
    result[String(header)] = index;
  });
  return result;
}

function findHeaderIndex(headers, targetHeader) {
  let index = headers.indexOf(targetHeader);
  if (index >= 0) return index;

  const aliases = HEADER_ALIASES[targetHeader] || [];
  for (let i = 0; i < aliases.length; i++) {
    index = headers.indexOf(aliases[i]);
    if (index >= 0) return index;
  }

  return -1;
}

function getRowValue(row, indexes, header) {
  let index = indexes[header];
  if (index === undefined) {
    const aliases = HEADER_ALIASES[header] || [];
    for (let i = 0; i < aliases.length; i++) {
      if (indexes[aliases[i]] !== undefined) {
        index = indexes[aliases[i]];
        break;
      }
    }
  }
  return index === undefined ? "" : row[index];
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeTestText(value) {
  return String(value || "").trim().toLowerCase();
}

function getTestTitle(testId, fallbackTitle) {
  return TEST_TITLES_BY_ID[testId] || String(fallbackTitle || testId || "Тест").trim();
}

function isSameTest(rowTest, testId, testTitle) {
  const rowValue = normalizeTestText(rowTest);
  if (!rowValue) return false;

  const possibleValues = [
    testId,
    testTitle,
    TEST_TITLES_BY_ID[testId]
  ].map(normalizeTestText).filter(Boolean);
  (TEST_TITLE_ALIASES_BY_ID[testId] || []).forEach(alias => possibleValues.push(normalizeTestText(alias)));

  return possibleValues.some(value => rowValue === value || rowValue.indexOf(value) !== -1 || value.indexOf(rowValue) !== -1);
}

function isSameTestById(rowTestId, rowTestTitle, requestedTestId, requestedTestTitle) {
  const rowId = normalizeTestText(rowTestId);
  const requestId = normalizeTestText(requestedTestId);

  if (rowId && requestId) {
    return rowId === requestId;
  }

  return isSameTest(rowTestTitle, requestedTestId, requestedTestTitle);
}

function getRetakeMatchType(sameEmail, samePhone, sameFingerprint) {
  if (sameEmail) return "email";
  if (samePhone) return "phone";
  if (sameFingerprint) return "fingerprint";
  return "none";
}

function buildRetakeDebug(email, phone, testId, browserFingerprint) {
  return {
    normalizedEmail: email || "",
    normalizedPhone: phone || "",
    testId: testId || "",
    browserFingerprint: browserFingerprint || "",
    matchedBy: "none",
    foundPreviousAttempt: false,
    previousAttemptDate: "",
    nextDate: "",
    daysLeft: 0
  };
}

function parseAttemptDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const text = String(value || "").trim();
  if (!text) return null;

  const ruDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ruDate) {
    const parsedRuDate = new Date(Number(ruDate[3]), Number(ruDate[2]) - 1, Number(ruDate[1]));
    return isNaN(parsedRuDate.getTime()) ? null : parsedRuDate;
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd.MM.yyyy");
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function formatResultsSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return;

  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight("bold")
    .setBackground("#111827")
    .setFontColor("#ffffff");

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, lastColumn);
}

function rebuildTopCandidates(ss, sheet) {
  sheet.clear();

  const headers = [
    "Место",
    "Дата",
    "Тест",
    "Версия банка",
    "Имя",
    "Email",
    "Телефон",
    "Английский",
    "Опыт",
    "Источник кандидата",
    "Итоговый балл",
    "Процент",
    "Плашка",
    "Уход со вкладки",
    "Trust Score",
    "Ссылка на TXT отчет"
  ];

  sheet.appendRow(headers);

  const resultsSheet = ss.getSheetByName(RESULTS_SHEET_NAME);
  if (!resultsSheet || resultsSheet.getLastRow() <= 1) {
    formatSmartSheet(sheet);
    return;
  }

  const data = resultsSheet.getDataRange().getValues();
  const headerIndexes = buildHeaderIndexMap(data[0].map(String));
  const rows = data.slice(1);

  const candidates = rows
    .map(row => ({
      date: getRowValue(row, headerIndexes, "Дата"),
      test: getRowValue(row, headerIndexes, "Тест"),
      bankVersion: getRowValue(row, headerIndexes, "Версия банка"),
      name: getRowValue(row, headerIndexes, "Имя"),
      email: getRowValue(row, headerIndexes, "Email"),
      phone: getRowValue(row, headerIndexes, "Телефон"),
      englishLevel: getRowValue(row, headerIndexes, "Английский"),
      experience: getRowValue(row, headerIndexes, "Опыт"),
      source: getRowValue(row, headerIndexes, "Источник кандидата"),
      tabSwitches: Number(getRowValue(row, headerIndexes, "Уход со вкладки") || 0),
      finalScore: Number(getRowValue(row, headerIndexes, "Итоговый балл") || 0),
      percent: Number(getRowValue(row, headerIndexes, "Процент") || 0),
      badge: getRowValue(row, headerIndexes, "Плашка"),
      trustScore: Number(getRowValue(row, headerIndexes, "Trust Score") || 0),
      txtUrl: getRowValue(row, headerIndexes, "Ссылка на TXT отчет")
    }))
    .filter(candidate =>
      candidate.finalScore >= 70 &&
      candidate.tabSwitches <= 2 &&
      candidate.trustScore >= TOP_TRUST_SCORE_MIN
    )
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      return a.tabSwitches - b.tabSwitches;
    });

  candidates.forEach((candidate, index) => {
    sheet.appendRow([
      index + 1,
      candidate.date,
      candidate.test,
      candidate.bankVersion,
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.englishLevel,
      candidate.experience,
      candidate.source,
      candidate.finalScore,
      candidate.percent,
      candidate.badge,
      candidate.tabSwitches,
      candidate.trustScore,
      candidate.txtUrl
    ]);
  });

  formatSmartSheet(sheet);
}

function rebuildDashboard(ss, sheet) {
  sheet.clear();

  const resultsSheet = ss.getSheetByName(RESULTS_SHEET_NAME);
  const values = resultsSheet && resultsSheet.getLastRow() > 1
    ? resultsSheet.getDataRange().getValues()
    : [];
  const headerIndexes = values.length ? buildHeaderIndexMap(values[0].map(String)) : {};
  const data = values.length ? values.slice(1) : [];

  const totalCandidates = data.length;
  const passedCandidates = data.filter(row => String(getRowValue(row, headerIndexes, "Статус") || "") === "Прошёл").length;
  const failedCandidates = data.filter(row => String(getRowValue(row, headerIndexes, "Статус") || "") === "Не прошёл").length;
  const candidatesWithTabs = data.filter(row => Number(getRowValue(row, headerIndexes, "Уход со вкладки") || 0) > 0).length;

  const scores = data.map(row => Number(getRowValue(row, headerIndexes, "Итоговый балл"))).filter(value => !isNaN(value));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  let bestCandidate = "Нет данных";

  if (data.length > 0) {
    const sorted = data
      .filter(row => getRowValue(row, headerIndexes, "Итоговый балл") !== "")
      .sort((a, b) => Number(getRowValue(b, headerIndexes, "Итоговый балл")) - Number(getRowValue(a, headerIndexes, "Итоговый балл")));

    if (sorted.length > 0) {
      bestCandidate = getRowValue(sorted[0], headerIndexes, "Имя") + " | " +
        getRowValue(sorted[0], headerIndexes, "Тест") + " | " +
        getRowValue(sorted[0], headerIndexes, "Итоговый балл") + " баллов | " +
        getRowValue(sorted[0], headerIndexes, "Плашка");
    }
  }

  sheet.appendRow(["Показатель", "Значение"]);
  sheet.appendRow(["Всего прохождений", totalCandidates]);
  sheet.appendRow(["Прошли тест", passedCandidates]);
  sheet.appendRow(["Не прошли тест", failedCandidates]);
  sheet.appendRow(["Средний итоговый балл", avgScore]);
  sheet.appendRow(["Лучший кандидат", bestCandidate]);
  sheet.appendRow(["Лучший итоговый балл", maxScore]);
  sheet.appendRow(["Кандидаты с уходами со вкладки", candidatesWithTabs]);

  formatSmartSheet(sheet);
}

function formatSmartSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return;

  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight("bold")
    .setBackground("#111827")
    .setFontColor("#ffffff");

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, lastColumn);
}
