const SPREADSHEET_ID = "1XQ_HLeaAtUwwYzxCsQ3Et77wEfsPjkf3NXc7bo2wu9k";
const FOLDER_ID = "1DYheq1_IDFiKcf4oxvsGqQRl7HoqT781";
const RETAKE_DAYS = 21;

const RESULTS_SHEET_NAME = "Results";
const TOP_SHEET_NAME = "Top Candidates";
const DASHBOARD_SHEET_NAME = "Dashboard";

const RESULTS_HEADERS = [
  "Дата",
  "Тест",
  "Версия",
  "Имя",
  "Email",
  "Телефон",
  "Английский",
  "Уход со вкладки",
  "Баллы",
  "Всего",
  "Процент",
  "Итоговый балл",
  "Плашка",
  "Статус",
  "Trust Score",
  "Ссылка на TXT отчет"
];

function doGet(e) {
  const action = e.parameter.action;

  if (action === "checkAttempt") {
    const callback = e.parameter.callback || "callback";
    const email = String(e.parameter.email || "").trim().toLowerCase();
    const phone = normalizePhone(String(e.parameter.phone || ""));
    const testId = String(e.parameter.testId || "").trim();

    const result = checkPreviousAttempt(email, phone, testId);

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

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const data = JSON.parse(e.postData.contents);

  const safeName = String(data.name || "Кандидат").replace(/[\\/:*?"<>|]/g, "");
  const testName = data.testTitle || data.testId || "Тест";

  const fileName = "Отчет SkillCheck - " + testName + " - " + safeName + " - " + Utilities.formatDate(
    new Date(),
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

  resultsSheet.appendRow([
    new Date(),
    data.testTitle || data.testId || "",
    data.testVersion || "",
    data.name || "",
    data.email || "",
    data.phone || "",
    data.englishLevel || "",
    Number(data.tabSwitches || 0),
    Number(data.score || 0),
    Number(data.total || 100),
    Number(data.percent || data.score || 0),
    Number(data.finalScore || 0),
    data.badge || "",
    data.passStatus || "",
    Number(data.trustScore || 0),
    txtUrl
  ]);

  formatResultsSheet(resultsSheet);
  rebuildTopCandidates(ss, topSheet);
  rebuildDashboard(ss, dashboardSheet);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", txtUrl: txtUrl }))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkPreviousAttempt(email, phone, testId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESULTS_SHEET_NAME);

  if (!sheet || sheet.getLastRow() <= 1) {
    return { allowed: true, message: "Попыток не найдено." };
  }

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const msLimit = RETAKE_DAYS * 24 * 60 * 60 * 1000;

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];

    const attemptDate = row[0];
    const rowTest = String(row[1] || "").trim();
    const rowEmail = String(row[4] || "").trim().toLowerCase();
    const rowPhone = normalizePhone(String(row[5] || ""));

    if (!(attemptDate instanceof Date)) continue;

    const sameEmail = email && rowEmail && email === rowEmail;
    const samePhone = phone && rowPhone && phone === rowPhone;
    const sameTest = !testId || !rowTest || rowTest.indexOf(testId) !== -1 || testId.indexOf(rowTest) !== -1;

    if ((sameEmail || samePhone) && sameTest) {
      const diffMs = now.getTime() - attemptDate.getTime();

      if (diffMs < msLimit) {
        const nextDate = new Date(attemptDate.getTime() + msLimit);
        const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        return {
          allowed: false,
          message: "Повторная попытка доступна через " + daysLeft + " дн.",
          nextDate: Utilities.formatDate(nextDate, Session.getScriptTimeZone(), "dd.MM.yyyy"),
          daysLeft: daysLeft
        };
      }
    }
  }

  return { allowed: true, message: "Можно проходить тест." };
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const currentTrimmed = current.slice(0, headers.length).map(String);
  const target = headers.map(String);

  const same = currentTrimmed.join("||") === target.join("||");

  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    if (sheet.getLastColumn() > headers.length) {
      sheet.deleteColumns(headers.length + 1, sheet.getLastColumn() - headers.length);
    }
  }

  sheet.setFrozenRows(1);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
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
    "Тест",
    "Имя",
    "Email",
    "Телефон",
    "Английский",
    "Уход со вкладки",
    "Итоговый балл",
    "Процент",
    "Плашка",
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
  const rows = data.slice(1);

  const candidates = rows
    .filter(row => String(row[13] || "") === "Прошёл" || Number(row[11]) >= 70)
    .map(row => ({
      test: row[1],
      name: row[3],
      email: row[4],
      phone: row[5],
      englishLevel: row[6],
      tabSwitches: row[7],
      finalScore: Number(row[11]),
      percent: Number(row[10]),
      badge: row[12],
      trustScore: Number(row[14]),
      txtUrl: row[15]
    }))
    .sort((a, b) => b.finalScore - a.finalScore);

  candidates.forEach((candidate, index) => {
    sheet.appendRow([
      index + 1,
      candidate.test,
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.englishLevel,
      candidate.tabSwitches,
      candidate.finalScore,
      candidate.percent,
      candidate.badge,
      candidate.trustScore,
      candidate.txtUrl
    ]);
  });

  formatSmartSheet(sheet);
}

function rebuildDashboard(ss, sheet) {
  sheet.clear();

  const resultsSheet = ss.getSheetByName(RESULTS_SHEET_NAME);
  const data = resultsSheet && resultsSheet.getLastRow() > 1
    ? resultsSheet.getDataRange().getValues().slice(1)
    : [];

  const totalCandidates = data.length;
  const passedCandidates = data.filter(row => String(row[13] || "") === "Прошёл").length;
  const failedCandidates = data.filter(row => String(row[13] || "") === "Не прошёл").length;
  const candidatesWithTabs = data.filter(row => Number(row[7]) > 0).length;

  const scores = data.map(row => Number(row[11])).filter(value => !isNaN(value));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  let bestCandidate = "Нет данных";

  if (data.length > 0) {
    const sorted = data
      .filter(row => row[11] !== "")
      .sort((a, b) => Number(b[11]) - Number(a[11]));

    if (sorted.length > 0) {
      bestCandidate = sorted[0][3] + " | " + sorted[0][1] + " | " + sorted[0][11] + " баллов | " + sorted[0][12];
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
