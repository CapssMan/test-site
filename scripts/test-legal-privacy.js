#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const backend = read("apps-script/Code.gs");
const assessment = read("cloud/assessment-core.js");
const rankingCore = read("cloud/ranking-core.js");
const candidate = read("test.html");
const consent = read("consent.html");
const rankingConsent = read("ranking-consent.html");
const accountConsent = read("account-consent.html");
const privacy = read("privacy.html");
const review = read("docs/LEGAL_PRIVACY_REVIEW.md");
const pdVersion = "skillcheck-pd-consent-2026-07-31-v5";
const rankingVersion = "skillcheck-ranking-public-2026-07-31-v3";
const accountVersion = "skillcheck-account-2026-08-08-v1";
const privacyVersion = "skillcheck-privacy-2026-08-08-v8";
function has(source, value, message) { assert(source.includes(value), message || ("Missing: " + value)); }
function extract(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}
has(consent, pdVersion);
has(privacy, privacyVersion);
has(rankingConsent, rankingVersion);
has(accountConsent, accountVersion);
for (const page of [consent, privacy, rankingConsent, accountConsent]) {
  has(page, "Кириллов Кирилл Сергеевич");
  has(page, "skillcheck.project@yandex.ru");
}
has(consent, "Отдельное согласие на обработку персональных данных");
has(consent, "российском контуре ООО «ЯНДЕКС.ОБЛАКО»");
has(consent, "ответы, результат и полный отчёт — до 365 дней");
has(consent, "YDB применяются автоматическим TTL");
has(privacy, "Yandex API Gateway и Cloud Functions");
has(privacy, "Managed Service for YDB");
has(privacy, "не являются активным production-маршрутом");
has(privacy, "регистрация закрыта серверной настройкой");
has(privacy, "не более 12 месяцев без активности");
has(accountConsent, "логин, основной email и список email");
has(accountConsent, "OAuth-токен используется сервером один раз и не сохраняется");
assert(!privacy.includes("автоматическое применение сроков ещё не завершено"));
assert(!consent.includes("Автоматическое применение остальных сроков ещё не завершено"));
has(rankingConsent, "неопределённому кругу посетителей сайта");
has(rankingConsent, "не разрешает оператору раскрывать ответы, контакты или полный отчёт");
has(candidate, 'const PRIVACY_CONSENT_VERSION = "' + pdVersion + '"');
has(candidate, 'const RANKING_CONSENT_VERSION = "' + rankingVersion + '"');
has(backend, 'const PRIVACY_CONSENT_VERSION = "' + pdVersion + '"');
has(assessment, 'const PRIVACY_CONSENT_VERSION = "' + pdVersion + '"');
has(rankingCore, 'const RANKING_CONSENT_VERSION = "' + rankingVersion + '"');
has(extract(backend, "validateBeginAttemptRequest"), "privacyConsentVersion");
has(extract(backend, "validateBeginAttemptRequest"), "ageConfirmed");
has(extract(backend, "validateAuthoritativeSubmissionRequest"), "employer_sharing_unavailable");
has(extract(backend, "beginAuthoritativeAttempt"), "isLegalPilotApproved");
has(extract(backend, "issuePilotInviteInternal"), "isLegalPilotApproved");
has(extract(backend, "setAuthoritativeAttemptIssuanceEnabled"), "isLegalPilotApproved");
assert(!extract(backend, "doPost").includes("setLegalPilotApprovedForOwner"));
has(review, "Дата технической сверки и owner-решения: 31 июля 2026 года.");
has(review, "RETENTION_AUTOMATION_ENABLED=true");
has(review, "LEGAL_PILOT_APPROVED=true");
has(review, "ATTEMPT_ISSUANCE_ENABLED=true");
console.log("Legal/privacy checks passed: current Russian data flow, versioned separate consents, retention and fail-closed pilot gates.");
