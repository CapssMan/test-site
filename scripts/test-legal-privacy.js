#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const backend = read("apps-script/Code.gs");
const candidate = read("test.html");
const admin = read("admin.html");
const home = read("index.html");
const consent = read("consent.html");
const privacy = read("privacy.html");
const review = read("docs/LEGAL_PRIVACY_REVIEW.md");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

const consentVersion = "skillcheck-pd-consent-2026-07-20-v1";
assert.match(consent, new RegExp(consentVersion));
assert.match(consent, /Отдельное согласие на обработку персональных данных/);
assert.match(consent, /Наименование\/ФИО оператора: не указано/);
assert.match(consent, /Email для обращений по персональным данным: не указан/);
assert.match(consent, /не разрешает[\s\S]*передавать результат работодателю/);
assert.match(consent, /Срок серверного хранения ещё не утверждён/);
assert.match(consent, /до 12 проверяемых резервных версий/i);

assert.match(privacy, /skillcheck-privacy-2026-07-20-v3/);
assert.match(privacy, /псевдонимизированной, а не полностью обезличенной/);
assert.match(privacy, /автоматическое удаление по сроку выключено/i);
assert.match(privacy, /закрыт(?:ая|ую) транзакционн(?:ая|ую) копи(?:я|ю)[\s\S]*безвозвратно уничтож/);
assert.match(privacy, /до 12 закрытых проверяемых версий/i);
assert.match(privacy, /удаляет связанные строки из обычных резервных версий/i);
assert.match(privacy, /Передача работодателю или партнёру[\s\S]*выключена/);
assert.doesNotMatch(privacy, /хран(?:ится|ение)[^<]{0,100}не более 12 месяцев/i, "privacy page must not promise an unimplemented retention period");

assert.match(candidate, /href="consent\.html"[^>]+target="_blank"/i);
assert.match(candidate, /id="privacyConsent"[^>]+required/i);
assert.match(candidate, /id="employerShareConsent"[^>]+disabled/i);
assert.match(candidate, new RegExp('const PRIVACY_CONSENT_VERSION = "' + consentVersion + '"'));
assert.match(candidate, /privacyConsentVersion:\s*PRIVACY_CONSENT_VERSION/);
assert.match(candidate, /ageConfirmed:\s*true/);

assert.match(backend, /const AUTHORITATIVE_API_VERSION = "attempt-v2"/);
assert.match(backend, new RegExp('const PRIVACY_CONSENT_VERSION = "' + consentVersion + '"'));
assert.match(backend, /const LEGAL_PILOT_APPROVAL_PROPERTY = "LEGAL_PILOT_APPROVED"/);
assert.match(extractTopLevelFunction(backend, "validateBeginAttemptRequest"), /privacyConsentVersion[\s\S]*ageConfirmed[\s\S]*PRIVACY_CONSENT_VERSION/);
assert.match(extractTopLevelFunction(backend, "validateAuthoritativeSubmissionRequest"), /employer_sharing_unavailable/);
assert.match(extractTopLevelFunction(backend, "beginAuthoritativeAttempt"), /!isLegalPilotApproved\(\)[\s\S]*ATTEMPT_ISSUANCE_ENABLED/);
assert.match(extractTopLevelFunction(backend, "issuePilotInviteInternal"), /!isLegalPilotApproved\(\)[\s\S]*ATTEMPT_ISSUANCE_ENABLED/);
assert.match(extractTopLevelFunction(backend, "adminCreateInvite"), /!isLegalPilotApproved\(\)[\s\S]*ATTEMPT_ISSUANCE_ENABLED/);
assert.match(extractTopLevelFunction(backend, "setAuthoritativeAttemptIssuanceEnabled"), /enabled[\s\S]*!isLegalPilotApproved\(\)/);
assert.match(extractTopLevelFunction(backend, "setLegalPilotApprovedForOwner"), /consentVersion[\s\S]*PRIVACY_CONSENT_VERSION/);
assert.match(extractTopLevelFunction(backend, "setLegalPilotApprovedForOwner"), /!enabled[\s\S]*ATTEMPT_ISSUANCE_ENABLED/);
assert.doesNotMatch(extractTopLevelFunction(backend, "doPost"), /setLegalPilotApprovedForOwner/, "legal approval must remain editor-only");

assert.match(admin, /const FRONTEND_BUILD = "2026\.07\.20\.11"/);
assert.match(admin, /const API_VERSION = "attempt-v2"/);
assert.match(admin, /setInviteFormEnabled\(attemptIssuanceEnabled && legalPilotApproved\)/);
assert.match(home, /реквизитов оператора[\s\S]*юридического checklist/);
assert.match(review, /Реальный пилот юридически не готов/);

console.log("Stage 11 legal/privacy checks passed: versioned separate consent, disabled sharing and fail-closed dual pilot gate.");
