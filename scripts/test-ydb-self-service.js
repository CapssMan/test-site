#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { QUERY_TIMEOUT_MS, createYdbAccountStore, mapSelfServiceSlot } = require("../cloud/ydb-account-store");

const root = path.resolve(__dirname, "..");
const now = new Date("2026-08-09T10:00:00.000Z");
const expires = new Date("2026-08-09T16:00:00.000Z");
const eligible = new Date("2026-08-30T10:00:00.000Z");
const purge = new Date("2027-08-09T10:00:00.000Z");
const profileId = "acct_" + "a".repeat(32);
const testId = "fa-junior";
const inviteId = "inv_" + "b".repeat(32);
const beginRequestId = "scb_" + "c".repeat(24);
const attemptId = "att_" + "d".repeat(32);
const slotRow = {
  profile_id: profileId,
  test_id: testId,
  invite_id: inviteId,
  begin_request_id: beginRequestId,
  attempt_id: attemptId,
  slot_state: "active",
  granted_at: now,
  expires_at: expires,
  eligible_after: now,
  updated_at: now,
  purge_at: purge
};

const queued = [[[slotRow]], [], [[slotRow]], [], []];
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

(async function main() {
  const mapped = mapSelfServiceSlot(slotRow);
  assert.equal(mapped.profileId, profileId);
  assert.equal(mapped.state, "active");
  assert.equal(mapped.expiresAt, expires.toISOString());

  const store = createYdbAccountStore(fakeSql);
  assert.equal((await store.getSelfServiceSlot(profileId, testId)).inviteId, inviteId);
  const claimed = await store.claimSelfServiceSlot({
    profileId,
    testId,
    inviteId,
    beginRequestId,
    now,
    grantedAt: now,
    expiresAt: expires,
    eligibleAfter: now,
    updatedAt: now,
    purgeAt: purge
  });
  assert.equal(claimed.beginRequestId, beginRequestId);
  await store.activateSelfServiceSlot({ profileId, testId, inviteId, beginRequestId, attemptId, expiresAt: expires, updatedAt: now });
  await store.completeSelfServiceSlot({ profileId, testId, attemptId, completedAt: now, eligibleAfter: eligible, purgeAt: purge });

  calls.forEach(call => {
    assert.equal(call.idempotent, true);
    assert.equal(call.timeout, QUERY_TIMEOUT_MS);
  });
  for (const index of [0, 2]) {
    assert.equal(calls[index].isolation.mode, "onlineReadOnly");
    assert.equal(calls[index].isolation.settings.allowInconsistentReads, false);
  }
  for (const index of [1, 3, 4]) assert.equal(calls[index].isolation.mode, "serializableReadWrite");
  assert.match(calls[1].text, /NOT EXISTS[\s\S]*eligible_after/);
  assert.match(calls[1].text, /candidate_accounts[\s\S]*account_status/);
  assert.match(calls[3].text, /attempt_id[\s\S]*begin_request_id/);
  assert.match(calls[4].text, /slot_state[\s\S]*eligible_after/);

  const schema = fs.readFileSync(path.join(root, "cloud", "schema", "014_candidate_self_service.sql"), "utf8");
  assert.match(schema, /PRIMARY KEY \(profile_id, test_id\)/);
  assert.match(schema, /TTL = Interval\("PT0S"\) ON purge_at/);
  assert.match(schema, /account_self_service_enabled[^]*Utf8\('false'\)/);
  assert.match(schema, /account_required_for_attempts[^]*Utf8\('false'\)/);

  console.log("YDB self-service checks passed: atomic slot claim, activation, completion, TTL and fail-closed defaults.");
})().catch(error => { console.error(error); process.exit(1); });
