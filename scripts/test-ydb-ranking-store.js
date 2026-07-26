#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { QUERY_TIMEOUT_MS, createYdbRankingStore, rowsFrom } = require("../cloud/ydb-ranking-store");

const calls = [];
const queuedResults = [
  [[{ bank_version: "FA Junior v4.0" }]],
  [[{
    public_profile_id: "profile_000000000001",
    result_code: "FA-PUBLIC1",
    public_alias: "Кандидат 1",
    public_opt_in: true,
    public_consent_active: true,
    public_consent_version: "skillcheck-ranking-public-2026-07-26-v1",
    bank_version: "FA Junior v4.0",
    result_status: "passed",
    score_verification: "server-verified",
    percent: 91.5,
    completed_at: new Date("2026-07-26T12:00:00.000Z"),
    technical: false
  }]],
  [],
  [[{ public_profile_id: "profile_000000000001" }]]
];

function fakeSql(strings, ...values) {
  const call = { text: strings.join("?"), values, isolation: null, idempotent: null, timeout: null };
  calls.push(call);
  const query = {
    isolation(mode, settings) { call.isolation = { mode, settings }; return query; },
    idempotent(value) { call.idempotent = value; return query; },
    timeout(value) { call.timeout = value; return query; },
    then(resolve, reject) { return Promise.resolve(queuedResults.shift()).then(resolve, reject); }
  };
  return query;
}

(async () => {
  assert.deepEqual(rowsFrom(null), []);
  assert.throws(() => createYdbRankingStore(null), /ydb_query_client_required/);
  const store = createYdbRankingStore(fakeSql);
  const bankVersion = await store.getActiveBankVersion("fa-junior");
  assert.equal(bankVersion, "FA Junior v4.0");
  const candidates = await store.listRankingCandidates({ testId: "fa-junior", bankVersion });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0], {
    publicProfileId: "profile_000000000001",
    resultCode: "FA-PUBLIC1",
    publicAlias: "Кандидат 1",
    publicOptIn: true,
    publicConsentActive: true,
    publicConsentVersion: "skillcheck-ranking-public-2026-07-26-v1",
    testId: "fa-junior",
    bankVersion: "FA Junior v4.0",
    status: "passed",
    scoreVerification: "server-verified",
    percent: 91.5,
    completedAt: "2026-07-26T12:00:00.000Z",
    technical: false
  });
  calls.forEach(call => {
    assert.equal(call.isolation.mode, "onlineReadOnly");
    assert.equal(call.isolation.settings.allowInconsistentReads, true);
    assert.equal(call.idempotent, true);
    assert.equal(call.timeout, QUERY_TIMEOUT_MS);
    assert.doesNotMatch(call.text, /email|telegram|answers|full_report/i);
  });
  assert.deepEqual(calls[1].values, ["fa-junior", "FA Junior v4.0"]);

  const now = new Date("2026-07-27T10:00:00.000Z");
  await store.upsertRankingProfile({
    testId: "fa-junior",
    publicProfileId: "profile_000000000001",
    resultCode: "FA-PUBLIC1",
    publicAlias: "Кандидат 1",
    publicOptIn: true,
    publicConsentActive: true,
    publicConsentVersion: "skillcheck-ranking-public-2026-07-26-v1",
    bankVersion: "FA Junior v4.0",
    status: "passed",
    scoreVerification: "server-verified",
    percent: 91.5,
    completedAt: now,
    technical: false,
    managementTokenHash: "a".repeat(64),
    consentedAt: now,
    expiresAt: new Date("2027-07-27T10:00:00.000Z"),
    updatedAt: now
  });
  const withdrawn = await store.withdrawRankingProfile({
    testId: "fa-junior",
    publicProfileId: "profile_000000000001",
    managementTokenHash: "a".repeat(64)
  });
  assert.equal(withdrawn, true);
  calls.slice(2).forEach(call => {
    assert.equal(call.isolation.mode, "serializableReadWrite");
    assert.equal(call.idempotent, true);
    assert.equal(call.timeout, QUERY_TIMEOUT_MS);
    assert.doesNotMatch(call.text, /email|telegram|answers|full_report/i);
  });
  assert.match(calls[2].text, /UPSERT INTO ranking_profiles/);
  assert.match(calls[3].text, /DELETE FROM ranking_profiles[\s\S]*management_token_hash[\s\S]*RETURNING public_profile_id/);

  const root = path.resolve(__dirname, "..");
  const ddl = fs.readFileSync(path.join(root, "cloud", "schema", "001_ranking.sql"), "utf8");
  assert.match(ddl, /PRIMARY KEY \(test_id, public_profile_id\)/);
  assert.doesNotMatch(ddl, /email|telegram|answers|full_report/i);
  const managementDdl = fs.readFileSync(path.join(root, "cloud", "schema", "003_ranking_profile_management.sql"), "utf8");
  const ttlDdl = fs.readFileSync(path.join(root, "cloud", "schema", "004_ranking_profile_ttl.sql"), "utf8");
  assert.match(managementDdl, /management_token_hash Utf8/);
  assert.match(managementDdl, /consented_at Timestamp/);
  assert.match(managementDdl, /expires_at Timestamp/);
  assert.match(ttlDdl, /TTL = Interval\("PT0S"\) ON expires_at/);
  console.log("YDB ranking store checks passed: read/write isolation, token-bound withdrawal, TTL and public-field allowlist.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
