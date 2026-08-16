#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { createYdbInvitationStore } = require("../cloud/ydb-invitation-store");

const now = new Date("2026-08-16T09:00:00.000Z");
const row = {
  candidate_profile_id: "acct_" + "1".repeat(32), invitation_id: "inv_" + "2".repeat(32), employer_id: "emp_" + "3".repeat(24),
  shortlist_id: "short_" + "4".repeat(24), request_id: "invite_req_" + "5".repeat(32), talent_profile_id: "talent_" + "6".repeat(32),
  candidate_alias: "Кандидат", organization_name: "Компания", role_title: "Аналитик", role_summary: "Анализ отчётности",
  work_format: "hybrid", region: "Москва", compensation: "Обсуждается", invitation_status: "sent",
  response_deadline: now, created_at: now, viewed_at: new Date(0), responded_at: new Date(0), updated_at: now, purge_at: now
};
const queued = [[], [[row]], [[row]], [[row]], [], [[{ ...row, invitation_status: "viewed", viewed_at: now }]], [], [[{ ...row, invitation_status: "interested", responded_at: now }]]];
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
  assert.throws(() => createYdbInvitationStore(), /ydb_query_client_required/);
  const store = createYdbInvitationStore(fakeSql);
  await store.upsertInvitation({ candidateProfileId: row.candidate_profile_id, invitationId: row.invitation_id, employerId: row.employer_id,
    shortlistId: row.shortlist_id, requestId: row.request_id, talentProfileId: row.talent_profile_id, candidateAlias: row.candidate_alias,
    organizationName: row.organization_name, roleTitle: row.role_title, roleSummary: row.role_summary, workFormat: row.work_format,
    region: row.region, compensation: row.compensation, status: row.invitation_status, responseDeadline: now, createdAt: now,
    viewedAt: new Date(0), respondedAt: new Date(0), updatedAt: now, purgeAt: now });
  assert.equal((await store.getCandidateInvitation(row.candidate_profile_id, row.invitation_id)).organizationName, "Компания");
  assert.equal((await store.listCandidateInvitations(row.candidate_profile_id))[0].status, "sent");
  assert.equal((await store.listEmployerInvitations(row.employer_id))[0].candidateAlias, "Кандидат");
  assert.equal((await store.markInvitationViewed(row.candidate_profile_id, row.invitation_id, now)).status, "viewed");
  assert.equal((await store.respondInvitation(row.candidate_profile_id, row.invitation_id, "interested", now)).status, "interested");
  calls.forEach(call => { assert.equal(call.idempotent, true); assert.equal(call.timeout, 5000); });
  for (const index of [0, 4, 6]) assert.equal(calls[index].isolation.mode, "serializableReadWrite");
  for (const index of [1, 2, 3, 5, 7]) assert.equal(calls[index].isolation.mode, "onlineReadOnly");
  assert.match(calls[0].text, /UPSERT INTO candidate_employer_invitations/);
  assert.equal((calls[0].text.match(/CAST\(\? AS Timestamp\)/g) || []).length, 6);
  assert.match(calls[3].text, /VIEW employer_invitations/);
  assert.match(calls[4].text, /invitation_status = \?/);
  assert.match(calls[6].text, /invitation_status IN \(\?, \?\)/);
  console.log("YDB invitation store checks passed: bounded reads, idempotent writes, status guards and employer index.");
})().catch(error => { console.error(error); process.exit(1); });
