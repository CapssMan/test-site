#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { QUERY_TIMEOUT_MS } = require("../cloud/ydb-account-store");
const { createYdbEmployerStore } = require("../cloud/ydb-employer-store");

const now = new Date("2026-08-09T09:00:00.000Z");
const employerRow = { employer_id: "emp_" + "a".repeat(24), identity_profile_id: "acct_" + "b".repeat(32), organization_name: "Компания", organization_domain: "example.ru", verification_status: "verified", employer_status: "active", created_at: now, updated_at: now, purge_at: now };
const accountRow = { profile_id: "acct_" + "c".repeat(32), account_status: "active", provider: "yandex", provider_subject_hash: "d".repeat(64), email_hash: "e".repeat(64), email_masked: "c***@example.ru", public_alias: "Кандидат", visibility: "discoverable", job_status: "active", region: "Москва", work_format: "hybrid", experience_band: "under_1", account_consent_version: "v1", account_consented_at: now, public_consent_version: "skillcheck-profile-discovery-2026-08-08-v1", public_consented_at: now, created_at: now, last_login_at: now, updated_at: now, purge_at: now };
const shortlistRow = { employer_id: employerRow.employer_id, shortlist_id: "short_" + "f".repeat(24), shortlist_name: "Аналитики", role_template_id: "financial-analyst", created_at: now, updated_at: now, purge_at: now };
const itemRow = { employer_id: employerRow.employer_id, shortlist_id: shortlistRow.shortlist_id, talent_profile_id: "talent_" + "1".repeat(32), candidate_profile_id: accountRow.profile_id, added_at: now, purge_at: now };
const queued = [[ [employerRow] ], [ [accountRow] ], [], [ [shortlistRow] ], [ [shortlistRow] ], [ [itemRow] ], [], []];
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
  assert.throws(() => createYdbEmployerStore(), /ydb_query_client_required/);
  const store = createYdbEmployerStore(fakeSql);
  assert.equal((await store.getEmployerByIdentityProfileId(employerRow.identity_profile_id)).organizationName, "Компания");
  assert.equal((await store.listDiscoverableAccounts(100))[0].publicAlias, "Кандидат");
  await store.createShortlist({ employerId: employerRow.employer_id, shortlistId: shortlistRow.shortlist_id, name: shortlistRow.shortlist_name, roleTemplateId: shortlistRow.role_template_id, createdAt: now, updatedAt: now, purgeAt: now });
  assert.equal((await store.listShortlists(employerRow.employer_id))[0].name, "Аналитики");
  assert.equal((await store.getShortlist(employerRow.employer_id, shortlistRow.shortlist_id)).roleTemplateId, "financial-analyst");
  assert.equal((await store.listShortlistItems(employerRow.employer_id, shortlistRow.shortlist_id))[0].candidateProfileId, accountRow.profile_id);
  await store.addShortlistItem({ employerId: employerRow.employer_id, shortlistId: shortlistRow.shortlist_id, talentProfileId: itemRow.talent_profile_id, candidateProfileId: accountRow.profile_id, addedAt: now, purgeAt: now });
  await store.removeShortlistItem(employerRow.employer_id, shortlistRow.shortlist_id, itemRow.talent_profile_id, now);
  calls.forEach(call => { assert.equal(call.idempotent, true); assert.equal(call.timeout, QUERY_TIMEOUT_MS); });
  for (const index of [0, 1, 3, 4, 5]) {
    assert.equal(calls[index].isolation.mode, "onlineReadOnly");
    assert.equal(calls[index].isolation.settings.allowInconsistentReads, false);
  }
  for (const index of [2, 6, 7]) assert.equal(calls[index].isolation.mode, "serializableReadWrite");
  assert.match(calls[0].text, /VIEW employer_identity/);
  assert.match(calls[1].text, /visibility[\s\S]*discoverable|visibility/);
  assert.match(calls[6].text, /UPSERT INTO employer_shortlist_items[\s\S]*UPDATE employer_shortlists/);
  assert.match(calls[7].text, /DELETE FROM employer_shortlist_items[\s\S]*UPDATE employer_shortlists/);
  console.log("YDB employer store checks passed: verified identity lookup, discoverable-only source, persistent shortlists and serialized writes.");
})().catch(error => { console.error(error); process.exit(1); });
