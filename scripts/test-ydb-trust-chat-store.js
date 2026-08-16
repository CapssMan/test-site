#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { createYdbTrustStore } = require("../cloud/ydb-trust-store");
const { createYdbChatStore } = require("../cloud/ydb-chat-store");

const now = new Date("2026-08-17T09:00:00.000Z");
const profileId = "acct_" + "1".repeat(32);
const credentialRow = { candidate_profile_id: profileId, credential_id: "cred_" + "2".repeat(24), credential_type: "certificate", credential_title: "Моделирование", credential_issuer: "Университет", credential_description: "Проект", issued_year: "2026", evidence_url: "https://example.ru/proof", credential_visibility: "employer", verification_status: "verified", verification_note: "", created_at: now, updated_at: now, purge_at: now };
const organizationRow = { organization_id: "org_" + "3".repeat(24), display_name: "Компания", legal_name: "ООО «Компания»", organization_domain: "example.ru", website_url: "https://example.ru", organization_description: "Финансы", verification_status: "verified", organization_status: "active", created_at: now, updated_at: now, purge_at: now };
const conversationRow = { candidate_profile_id: profileId, conversation_id: "conv_" + "4".repeat(32), invitation_id: "inv_" + "5".repeat(32), employer_id: "emp_" + "6".repeat(24), organization_id: organizationRow.organization_id, organization_name: "Компания", candidate_alias: "Кандидат", role_title: "Аналитик", conversation_state: "open", candidate_unread_count: 1, employer_unread_count: 0, last_message_at: now, created_at: now, updated_at: now, purge_at: now };
const messageRow = { conversation_id: conversationRow.conversation_id, message_id: "msg_" + "7".repeat(32), client_message_id: "chat_req_" + "8".repeat(32), sender_type: "employer", message_text: "Добрый день", created_at: now, purge_at: now };
const queued = [
  [[credentialRow]], [[credentialRow]], [[credentialRow]], [], [], [], [[organizationRow]],
  [], [[conversationRow]], [[conversationRow]], [[conversationRow]], [[conversationRow]], [[conversationRow]], [[messageRow]], [], [], [],
  [[conversationRow]], [], []
];
const calls = [];
function fakeSql(strings, ...values) {
  const call = { text: strings.join("?"), values, isolation: null, idempotent: null, timeout: null };
  calls.push(call);
  const query = {
    isolation(mode, settings) { call.isolation = { mode, settings }; return query; },
    idempotent(value) { call.idempotent = value; return query; },
    timeout(value) { call.timeout = value; return query; },
    then(resolve, reject) { return Promise.resolve(queued.shift()).then(resolve, reject); }
  };
  return query;
}

(async () => {
  assert.throws(() => createYdbTrustStore(), /ydb_query_client_required/);
  assert.throws(() => createYdbChatStore(), /ydb_query_client_required/);
  const trust = createYdbTrustStore(fakeSql);
  const chat = createYdbChatStore(fakeSql);
  assert.equal((await trust.listCandidateCredentials(profileId))[0].title, "Моделирование");
  assert.equal((await trust.listVerifiedCandidateCredentials(profileId))[0].verificationStatus, "verified");
  assert.equal((await trust.getCandidateCredential(profileId, credentialRow.credential_id)).issuer, "Университет");
  await trust.upsertCandidateCredential({ candidateProfileId: profileId, credentialId: credentialRow.credential_id, credentialType: "certificate", title: "Моделирование", issuer: "Университет", description: "Проект", issuedYear: "2026", evidenceUrl: "https://example.ru/proof", visibility: "employer", verificationStatus: "pending", verificationNote: "", createdAt: now, updatedAt: now, purgeAt: now });
  await trust.deleteCandidateCredential(profileId, credentialRow.credential_id);
  await trust.deleteAllCandidateCredentials(profileId);
  assert.equal((await trust.getOrganization(organizationRow.organization_id)).displayName, "Компания");
  assert.equal((await chat.createConversation({ candidateProfileId: profileId, conversationId: conversationRow.conversation_id, invitationId: conversationRow.invitation_id, employerId: conversationRow.employer_id, organizationId: organizationRow.organization_id, organizationName: "Компания", candidateAlias: "Кандидат", roleTitle: "Аналитик", state: "open", candidateUnreadCount: 0, employerUnreadCount: 0, lastMessageAt: now, createdAt: now, updatedAt: now, purgeAt: now })).state, "open");
  assert.equal((await chat.listCandidateConversations(profileId))[0].candidateUnreadCount, 1);
  assert.equal((await chat.listEmployerConversations(conversationRow.employer_id))[0].candidateAlias, "Кандидат");
  assert.equal((await chat.getCandidateConversation(profileId, conversationRow.conversation_id)).roleTitle, "Аналитик");
  assert.equal((await chat.getEmployerConversation(conversationRow.employer_id, conversationRow.conversation_id)).organizationName, "Компания");
  assert.equal((await chat.listConversationMessages(conversationRow.conversation_id, 50))[0].text, "Добрый день");
  assert.equal((await chat.writeMessage({ candidateProfileId: profileId, conversationId: conversationRow.conversation_id, messageId: messageRow.message_id, clientMessageId: messageRow.client_message_id, senderType: "employer", text: "Добрый день", createdAt: now, purgeAt: now })).senderType, "employer");
  await chat.markConversationRead(profileId, conversationRow.conversation_id, "candidate", now);
  await chat.setConversationState(profileId, conversationRow.conversation_id, "candidate", "blocked", now, now);
  await chat.deleteCandidateChats(profileId);
  calls.forEach(call => { assert.equal(call.idempotent, true); assert.equal(call.timeout, 5000); });
  assert.match(calls[3].text, /UPSERT INTO candidate_credentials/);
  assert.match(calls[7].text, /WHERE NOT EXISTS\(\$existing\)/);
  assert.match(calls[14].text, /INSERT INTO candidate_employer_messages[\s\S]*NOT EXISTS\(\$existing\)/);
  assert.match(calls[14].text, /candidate_unread_count = candidate_unread_count/);
  assert.match(calls[15].text, /candidate_unread_count = CAST\(0 AS Uint32\)/);
  assert.match(calls[16].text, /conversation_state = \?/);
  console.log("YDB trust and chat store checks passed: scoped credentials, verified organization lookup, idempotent messages, unread state and cascading candidate deletion.");
})().catch(error => { console.error(error); process.exit(1); });
