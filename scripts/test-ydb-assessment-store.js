"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { QUERY_TIMEOUT_MS, createYdbAssessmentStore } = require("../cloud/ydb-assessment-store");

const now = new Date("2026-07-27T10:00:00.000Z");
const later = new Date("2026-07-27T16:00:00.000Z");
const purge = new Date("2027-07-27T10:00:00.000Z");
const inviteRow = {
  invite_id: "inv_" + "1".repeat(32), request_id: "sci_" + "2".repeat(24), test_id: "fa-junior",
  code_hash: "3".repeat(64), identity_hash: "4".repeat(64), email_masked: "c***@example.ru",
  purpose: "Pilot", allow_retake: false, valid_for_hours: 24, state: "issued", issued_at: now, expires_at: later, purge_at: purge
};
const sessionRow = {
  attempt_id: "att_" + "5".repeat(32), invite_id: inviteRow.invite_id, begin_request_id: "scb_" + "6".repeat(24),
  state: "active", test_id: "fa-junior", test_version: "FA Junior v4.0", bank_version: "FA Junior v4.0",
  public_digest: "7".repeat(64), question_ids: JSON.stringify(["fa_001"]), question_set_hash: "8".repeat(64),
  identity_hash: inviteRow.identity_hash, fingerprint_hash: "9".repeat(64), token_jti: "a".repeat(32),
  token_issued_at: now, token_expires_at: later, started_at: now,
  privacy_consent_version: "skillcheck-pd-consent-2026-08-21-v6", privacy_consented_at: now,
  age_confirmed: true, purge_at: purge
};
const resultRow = {
  result_code: "FA-ABCDE", request_id: "scs_" + "b".repeat(24), attempt_id: sessionRow.attempt_id,
  test_id: "fa-junior", test_title: "Financial Analyst Junior", bank_version: "FA Junior v4.0",
  candidate_name: "Кандидат", candidate_email: "candidate@example.ru", candidate_telegram: "@candidate_test",
  english_level: "B2", candidate_source: "Другое", candidate_experience: "Стажировка",
  raw_score: 40, raw_total: 40, final_score: 100, percent: 100, unanswered_count: 0,
  tab_switches: 0, advisory_penalty: 0, trust_score: 100,
  result_status: "passed", badge: "Junior Strong", recommendation: "Рекомендуется к интервью",
  block_results: JSON.stringify({ finance: { percent: 100 } }), answer_details: JSON.stringify([{ questionId: "fa_001" }]),
  score_verification: "server-verified", scoring_algorithm_version: "authoritative-v1",
  telemetry_verification: "client-reported-unverified", privacy_consent_version: "skillcheck-pd-consent-2026-08-21-v6",
  privacy_consented_at: now, age_confirmed: true, report_created: true, report_object_key: "reports/FA-ABCDE.txt",
  submission_hash: "c".repeat(64), completed_at: now, technical: false, purge_at: purge
};

const results = [
  [[{ setting_key: "legal_pilot_approved", setting_value: "false" }, { setting_key: "retention_automation_enabled", setting_value: "true" }]],
  [[{ object_key: "banks/v4/fa-junior.json", private_digest: "d".repeat(64), public_digest: "7".repeat(64), active: true, updated_at: now }]],
  [[inviteRow]],
  [[sessionRow]],
  [[resultRow]],
  [], [], [], [], [], [], [], []
];
const calls = [];

function fakeSql(strings, ...values) {
  const call = { text: strings.join("?"), values, isolation: null, idempotent: null, timeout: null };
  calls.push(call);
  const query = {
    isolation(mode, settings) { call.isolation = { mode, settings }; return query; },
    idempotent(value) { call.idempotent = value; return query; },
    timeout(value) { call.timeout = value; return query; },
    then(resolve, reject) { return Promise.resolve(results.shift()).then(resolve, reject); }
  };
  return query;
}

(async function main() {
  assert.throws(() => createYdbAssessmentStore(), /ydb_query_client_required/);
  const store = createYdbAssessmentStore(fakeSql);
  const settings = await store.getRuntimeSettings();
  assert.equal(settings.legal_pilot_approved, "false");
  assert.equal(settings.retention_automation_enabled, "true");

  const bank = await store.getBankMetadata("fa-junior", "FA Junior v4.0");
  assert.equal(bank.objectKey, "banks/v4/fa-junior.json");
  assert.equal(bank.active, true);
  const invite = await store.getInviteByCodeHash(inviteRow.code_hash);
  assert.equal(invite.emailMasked, "c***@example.ru");
  const session = await store.getSessionByAttemptId(sessionRow.attempt_id);
  assert.deepEqual(session.questionIds, ["fa_001"]);
  const result = await store.getResultByCode("FA-ABCDE");
  assert.equal(result.scoreVerification, "server-verified");
  assert.equal(result.trustScore, 100);
  assert.deepEqual(result.blockResults, { finance: { percent: 100 } });

  await store.upsertBankMetadata({ testId: "fa-junior", bankVersion: "FA Junior v4.0", objectKey: bank.objectKey, privateDigest: bank.privateDigest, publicDigest: bank.publicDigest, active: true, updatedAt: now });
  await store.upsertInvite({ ...invite, validForHours: 24, state: "issued", issuedAt: now, expiresAt: later, purgeAt: purge });
  await store.insertSession({ ...session, questionIds: session.questionIds, tokenIssuedAt: now, tokenExpiresAt: later, startedAt: now, privacyConsentedAt: now, purgeAt: purge });
  await store.reserveSession({ attemptId: session.attemptId, saveRequestId: result.requestId, submissionHash: result.submissionHash, reservedAt: now, completedAt: now, resultCode: result.code, result: { percent: 100 } });
  await store.insertResult({ ...result, privacyConsentedAt: now, completedAt: now, purgeAt: purge });
  await store.completeSession(session.attemptId, { percent: 100 }, now, purge);
  await store.completeInvite(invite.inviteId, session.attemptId, now, purge);
  await store.appendAudit({ eventDate: new Date("2026-07-27"), eventId: "evt_" + "e".repeat(32), eventType: "result_saved", subjectHash: "f".repeat(64), outcome: "ok", createdAt: now, purgeAt: purge });

  calls.slice(0, 5).forEach(call => {
    assert.equal(call.isolation.mode, "onlineReadOnly");
    assert.equal(call.isolation.settings.allowInconsistentReads, false);
    assert.equal(call.idempotent, true);
    assert.equal(call.timeout, QUERY_TIMEOUT_MS);
  });
  calls.slice(5).forEach(call => {
    assert.equal(call.isolation.mode, "serializableReadWrite");
    assert.equal(call.idempotent, true);
    assert.equal(call.timeout, QUERY_TIMEOUT_MS);
  });
  assert.match(calls[7].text, /INSERT INTO assessment_sessions[\s\S]*Unwrap\(CAST\(\?[\s\S]*AS JsonDocument\)\)/);
  assert.match(calls[7].text, /Unwrap\(CAST\(\? AS Timestamp\)\)/);
  assert.match(calls[9].text, /Unwrap\(CAST\(\? AS JsonDocument\)\)/);
  assert.match(calls[9].text, /Unwrap\(CAST\(\? AS Timestamp\)\)/);
  assert.match(calls[9].text, /INSERT INTO assessment_results/);

  const ddl = fs.readFileSync(path.join(__dirname, "..", "cloud", "schema", "005_assessment_runtime.sql"), "utf8");
  assert.match(ddl, /assessment_invites[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
  assert.match(ddl, /assessment_sessions[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
  assert.match(ddl, /assessment_results[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
  assert.match(ddl, /assessment_audit_events[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
  assert.doesNotMatch(ddl, /INDEX[^\n]*(candidate_email|candidate_name|candidate_telegram)/i);

  console.log("YDB assessment store checks passed: consistent reads, serialized writes, private-bank metadata and retention TTL schema.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
