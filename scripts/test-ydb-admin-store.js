"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createYdbAdminStore } = require("../cloud/ydb-admin-store");

const now = new Date("2026-07-28T09:00:00.000Z");
const results = [
  [[{ row_count: 2, last_record_at: now }]],
  [[{ row_count: 3, last_record_at: now }]],
  [[{ row_count: 4, last_record_at: now }]],
  [[{ row_count: 1, last_record_at: now }]],
  [[{ test_id: "fa-junior", public_profile_id: "pub_1", result_code: "FA-ABCDE", public_alias: "Кандидат" }]],
  [[{ request_id: "scd_" + "1".repeat(32), result_code: "FA-ABCDE", deletion_scope: "full_attempt", preview_digest: "2".repeat(64), state: "backed_up", backup_object_key: "deletion-backups/request.json", backup_purged: false, started_at: now, completed_at: now, purge_at: now }]],
  [], [], []
];
const calls = [];

function fakeSql(strings, ...values) {
  const call = { text: strings.join("?"), values, isolation: null, idempotent: null };
  calls.push(call);
  const query = {
    isolation(mode, settings) { call.isolation = { mode, settings }; return query; },
    idempotent(value) { call.idempotent = value; return query; },
    timeout() { return query; },
    then(resolve, reject) { return Promise.resolve(results.shift()).then(resolve, reject); }
  };
  return query;
}

(async function main() {
  assert.throws(() => createYdbAdminStore(), /ydb_query_client_required/);
  const store = createYdbAdminStore(fakeSql);
  const diagnostics = await store.getDiagnostics();
  assert.equal(diagnostics.results.rowCount, 2);
  assert.equal(diagnostics.sessions.rowCount, 3);
  assert.equal(diagnostics.invites.rowCount, 4);
  assert.equal(diagnostics.reports.rowCount, 1);
  const ranking = await store.listRankingProfilesByResultCode("FA-ABCDE");
  assert.equal(ranking.length, 1);
  const operation = await store.getDeletionOperation("scd_" + "1".repeat(32));
  assert.equal(operation.state, "backed_up");
  await store.upsertDeletionOperation(operation);
  await store.deleteRankingProfile("fa-junior", "pub_1");
  await store.deleteAssessmentData({ code: "FA-ABCDE", scope: "full_attempt", result: { attemptId: "att_" + "4".repeat(32) }, feedback: { attemptId: "att_" + "4".repeat(32) }, session: { inviteId: "inv_" + "3".repeat(32) }, invite: { inviteId: "inv_" + "3".repeat(32) } });

  calls.slice(0, 6).forEach(call => {
    assert.equal(call.isolation.mode, "onlineReadOnly");
    assert.equal(call.idempotent, true);
  });
  calls.slice(6).forEach(call => {
    assert.equal(call.isolation.mode, "serializableReadWrite");
    assert.equal(call.idempotent, true);
  });
  assert.match(calls[6].text, /UPSERT INTO assessment_deletion_operations/);
  assert.match(calls[8].text, /DELETE FROM assessment_feedback[\s\S]*DELETE FROM assessment_results[\s\S]*DELETE FROM assessment_sessions[\s\S]*DELETE FROM assessment_invites/);
  assert.equal(calls[8].values[0], "att_" + "4".repeat(32));

  const ddl = fs.readFileSync(path.join(__dirname, "..", "cloud", "schema", "007_assessment_deletion_operations.sql"), "utf8");
  assert.match(ddl, /assessment_deletion_operations[\s\S]*backup_purged Bool NOT NULL[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
  console.log("YDB admin store checks passed: aggregate diagnostics, deletion ledger, ranking cleanup and atomic assessment-row deletion.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
