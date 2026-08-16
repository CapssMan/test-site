#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { ACCOUNT_API_VERSION, EXTENDED_PROFILE_CONSENT_VERSION } = require("../cloud/account-core");
const { EMPLOYER_API_VERSION } = require("../cloud/employer-core");
const {
  createOrganizationId,
  publicCandidateCredential,
  publicEmployerCredentials,
  publicOrganization,
  validateCandidateCredentialAction
} = require("../cloud/trust-core");
const {
  containsContactDetails,
  createConversationId,
  createMessageId,
  validateChatAction
} = require("../cloud/chat-core");

const secret = "trust-chat-test-secret-12345678901234567890";
const invitationId = "inv_" + "1".repeat(32);
const conversationId = createConversationId(secret, invitationId);

const credentialRequest = {
  action: "upsertCredential", apiVersion: ACCOUNT_API_VERSION, credentialId: "", credentialType: "certificate",
  title: "Финансовое моделирование", issuer: "Учебный центр", description: "Итоговый проект и экзамен.",
  issuedYear: "2026", evidenceUrl: "https://example.ru/certificate/123", visibility: "employer",
  accountConsent: EXTENDED_PROFILE_CONSENT_VERSION
};
const credential = validateCandidateCredentialAction({
  action: "upsertCredential", apiVersion: ACCOUNT_API_VERSION, credentialId: "", credentialType: "certificate",
  title: "Финансовое моделирование", issuer: "Учебный центр", description: "Итоговый проект и экзамен.",
  issuedYear: "2026", evidenceUrl: "https://example.ru/certificate/123", visibility: "employer",
  accountConsent: EXTENDED_PROFILE_CONSENT_VERSION
}, ACCOUNT_API_VERSION, EXTENDED_PROFILE_CONSENT_VERSION, 2026);
assert.equal(credential.credentialType, "certificate");
assert.equal(credential.visibility, "employer");
assert.throws(() => validateCandidateCredentialAction({ ...credentialRequest, accountConsent: "old" }, ACCOUNT_API_VERSION, EXTENDED_PROFILE_CONSENT_VERSION, 2026), /invalid_credential/);
assert.throws(() => validateCandidateCredentialAction({ ...credentialRequest, evidenceUrl: "http://example.ru/a" }, ACCOUNT_API_VERSION, EXTENDED_PROFILE_CONSENT_VERSION, 2026), /invalid_credential/);

const candidateView = publicCandidateCredential({ ...credential, credentialId: "cred_" + "2".repeat(24), verificationStatus: "pending" });
assert.equal(candidateView.evidenceUrl, "https://example.ru/certificate/123");
const employerView = publicEmployerCredentials([
  { ...credential, verificationStatus: "pending" },
  { ...credential, evidenceUrl: "https://private.example.ru/proof", verificationStatus: "verified" }
]);
assert.equal(employerView.length, 1);
assert.equal(Object.prototype.hasOwnProperty.call(employerView[0], "evidenceUrl"), false);

const organizationId = createOrganizationId(secret, "example.ru");
assert.match(organizationId, /^org_[a-f0-9]{24}$/);
assert.equal(createOrganizationId(secret, "EXAMPLE.RU"), organizationId);
assert.equal(publicOrganization({ organizationId, displayName: "Пример", legalName: "ООО «Пример»", domain: "example.ru", websiteUrl: "https://example.ru", description: "Финансовые технологии", verificationStatus: "verified", status: "active" }).displayName, "Пример");
assert.equal(publicOrganization({ verificationStatus: "pending", status: "active" }), null);

assert.match(conversationId, /^conv_[a-f0-9]{32}$/);
const messageId = createMessageId(secret, conversationId, "candidate", "chat_req_" + "3".repeat(32));
assert.equal(createMessageId(secret, conversationId, "candidate", "chat_req_" + "3".repeat(32)), messageId);
assert.equal(containsContactDetails("Напишите мне test@example.ru"), true);
assert.equal(containsContactDetails("Готов обсудить задачи в чате"), false);
assert.equal(validateChatAction({ action: "sendMessage", apiVersion: EMPLOYER_API_VERSION, conversationId,
  clientMessageId: "chat_req_" + "4".repeat(32), text: "Расскажите о следующем этапе" }, EMPLOYER_API_VERSION, false).type, "sendMessage");
assert.throws(() => validateChatAction({ action: "sendMessage", apiVersion: EMPLOYER_API_VERSION, conversationId,
  clientMessageId: "chat_req_" + "4".repeat(32), text: "Мой Telegram @candidate_name" }, EMPLOYER_API_VERSION, false), /contact_sharing_closed/);
assert.doesNotThrow(() => validateChatAction({ action: "sendMessage", apiVersion: EMPLOYER_API_VERSION, conversationId,
  clientMessageId: "chat_req_" + "4".repeat(32), text: "Мой Telegram @candidate_name" }, EMPLOYER_API_VERSION, true));

console.log("Trust and chat core checks passed: bounded credentials, verified-only employer badges, verified companies, gated contacts and idempotent chat IDs.");
