#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ACCOUNT_API_VERSION,
  ACCOUNT_CONSENT_VERSION,
  validateUpdate
} = require("../cloud/account-core");
const { publicProfile } = require("../cloud/account-handler");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("account.html");
const consent = read("account-consent.html");
const privacy = read("privacy.html");
const schema = read(path.join("cloud", "schema", "015_candidate_profile_v2.sql"));

assert.equal(ACCOUNT_CONSENT_VERSION, "skillcheck-account-2026-08-16-v3");
assert.match(page, new RegExp(ACCOUNT_CONSENT_VERSION));
assert.match(consent, new RegExp(ACCOUNT_CONSENT_VERSION));
assert.match(consent, /текущая и желаемая роль/);
assert.match(consent, /практического опыта и проектов/);
assert.match(privacy, /профессиональные инструменты и актуальность поиска/);

for (const column of ["current_role Utf8", "target_role Utf8", "experience_summary Utf8", "professional_tools Utf8", "availability_confirmed_at Timestamp"]) {
  assert.match(schema, new RegExp(column.replace(" ", "\\s+")), "profile migration missing " + column);
}
assert.match(schema, /Utf8\('profile_publication_enabled'\), Utf8\('false'\)/);
assert.match(schema, /Utf8\('employer_contact_enabled'\), Utf8\('false'\)/);
assert.match(schema, /Utf8\('employer_workspace_enabled'\), Utf8\('false'\)/);

const update = validateUpdate({
  action: "updateProfile", apiVersion: ACCOUNT_API_VERSION, publicAlias: "Кандидат", visibility: "private",
  jobStatus: "active", region: "Москва", workFormat: "hybrid", experienceBand: "under_1",
  currentRole: "Стажёр FDD", targetRole: "Финансовый аналитик",
  experienceSummary: "Собрал финансовую модель.\nПроверил три сценария.", professionalTools: "Excel, SQL, Power BI",
  confirmAvailability: true, accountConsent: ACCOUNT_CONSENT_VERSION, publicConsent: ""
});
assert.equal(update.experienceSummary.includes("\n"), true);
assert.equal(update.confirmAvailability, true);
assert.throws(() => validateUpdate({ ...update, action: "updateProfile", apiVersion: ACCOUNT_API_VERSION,
  currentRole: "<script>", accountConsent: ACCOUNT_CONSENT_VERSION }), /invalid_profile/);
assert.throws(() => validateUpdate({ ...update, action: "updateProfile", apiVersion: ACCOUNT_API_VERSION,
  experienceSummary: "x".repeat(1001), accountConsent: ACCOUNT_CONSENT_VERSION }), /invalid_profile/);

const profile = publicProfile({
  profileId: "acct_test", emailMasked: "c***@yandex.ru", publicAlias: "", visibility: "private", jobStatus: "active",
  region: "Москва", workFormat: "hybrid", experienceBand: "under_1", currentRole: "Стажёр FDD",
  targetRole: "Финансовый аналитик", experienceSummary: "Практический проект", professionalTools: "Excel, SQL",
  availabilityConfirmedAt: "2026-08-16T12:00:00.000Z", accountConsentVersion: ACCOUNT_CONSENT_VERSION,
  publicConsentVersion: "", createdAt: "2026-08-16T11:00:00.000Z", updatedAt: "2026-08-16T12:00:00.000Z"
}, []);
assert.equal(profile.currentRole, "Стажёр FDD");
assert.equal(profile.professionalTools, "Excel, SQL");
assert.equal(profile.availabilityConfirmedAt, "2026-08-16T12:00:00.000Z");
assert.equal(Object.prototype.hasOwnProperty.call(profile, "email"), false);

console.log("Candidate career profile v2 checks passed: explicit consent, bounded professional fields, availability freshness and closed employer gates.");
