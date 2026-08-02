"use strict";

const QUERY_TIMEOUT_MS = 5000;

function rowsFrom(resultSets) {
  if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0])) return [];
  return resultSets[0];
}

function executeRead(sql, strings, values) {
  return sql(strings, ...values)
    .isolation("onlineReadOnly", { allowInconsistentReads: false })
    .idempotent(true)
    .timeout(QUERY_TIMEOUT_MS);
}

function executeWrite(sql, strings, values) {
  return sql(strings, ...values)
    .isolation("serializableReadWrite")
    .idempotent(true)
    .timeout(QUERY_TIMEOUT_MS);
}

function valueStrings(prefix, valueCount, jsonIndexes, timestampIndexes, dateIndexes) {
  const json = new Set(jsonIndexes || []);
  const timestamp = new Set(timestampIndexes || []);
  const date = new Set(dateIndexes || []);
  const castType = index => json.has(index) ? "JsonDocument" : timestamp.has(index) ? "Timestamp" : date.has(index) ? "Date" : "";
  const open = index => castType(index) ? "Unwrap(CAST(" : "";
  const close = index => castType(index) ? " AS " + castType(index) + "))" : "";
  const strings = [prefix + open(0)];
  for (let index = 0; index < valueCount - 1; index += 1) {
    strings.push(close(index) + ", " + open(index + 1));
  }
  strings.push(close(valueCount - 1) + ");");
  return strings;
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return value == null || value === "" ? "" : String(value);
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch (_error) {
    throw new Error("ydb_json_invalid");
  }
}

function mapInvite(row) {
  if (!row) return null;
  return {
    inviteId: String(row.invite_id || ""),
    requestId: String(row.request_id || ""),
    testId: String(row.test_id || ""),
    codeHash: String(row.code_hash || ""),
    identityHash: String(row.identity_hash || ""),
    emailMasked: String(row.email_masked || ""),
    purpose: String(row.purpose || ""),
    allowRetake: row.allow_retake === true,
    validForHours: Number(row.valid_for_hours || 0),
    state: String(row.state || ""),
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
    activatedAt: iso(row.activated_at),
    completedAt: iso(row.completed_at),
    revokedAt: iso(row.revoked_at),
    revokeRequestId: String(row.revoke_request_id || ""),
    attemptId: String(row.attempt_id || ""),
    purgeAt: iso(row.purge_at)
  };
}

function mapInviteGroup(row) {
  if (!row) return null;
  return {
    groupId: String(row.group_id || ""),
    requestId: String(row.request_id || ""),
    testId: String(row.test_id || ""),
    codeHash: String(row.code_hash || ""),
    purpose: String(row.purpose || ""),
    maxUses: Number(row.max_uses || 0),
    usedCount: Number(row.used_count || 0),
    validForHours: Number(row.valid_for_hours || 0),
    state: String(row.state || ""),
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
    revokedAt: iso(row.revoked_at),
    revokeRequestId: String(row.revoke_request_id || ""),
    purgeAt: iso(row.purge_at)
  };
}

function mapInviteGroupClaim(row) {
  if (!row) return null;
  return {
    groupId: String(row.group_id || ""),
    identityHash: String(row.identity_hash || ""),
    inviteId: String(row.invite_id || ""),
    claimedAt: iso(row.claimed_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    attemptId: String(row.attempt_id || ""),
    inviteId: String(row.invite_id || ""),
    beginRequestId: String(row.begin_request_id || ""),
    state: String(row.state || ""),
    testId: String(row.test_id || ""),
    testVersion: String(row.test_version || ""),
    bankVersion: String(row.bank_version || ""),
    publicDigest: String(row.public_digest || ""),
    questionIds: parseJson(row.question_ids, []),
    questionSetHash: String(row.question_set_hash || ""),
    identityHash: String(row.identity_hash || ""),
    fingerprintHash: String(row.fingerprint_hash || ""),
    tokenJti: String(row.token_jti || ""),
    tokenIssuedAt: iso(row.token_issued_at),
    tokenExpiresAt: iso(row.token_expires_at),
    startedAt: iso(row.started_at),
    privacyConsentVersion: String(row.privacy_consent_version || ""),
    privacyConsentedAt: iso(row.privacy_consented_at),
    ageConfirmed: row.age_confirmed === true,
    saveRequestId: String(row.save_request_id || ""),
    submissionHash: String(row.submission_hash || ""),
    reservedAt: iso(row.reserved_at),
    resultCode: String(row.result_code || ""),
    result: parseJson(row.result_json, null),
    completedAt: iso(row.completed_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapResult(row) {
  if (!row) return null;
  return {
    code: String(row.result_code || ""), requestId: String(row.request_id || ""), attemptId: String(row.attempt_id || ""),
    testId: String(row.test_id || ""), testTitle: String(row.test_title || ""), bankVersion: String(row.bank_version || ""),
    name: String(row.candidate_name || ""), email: String(row.candidate_email || ""), telegram: String(row.candidate_telegram || ""),
    englishLevel: String(row.english_level || ""), candidateSource: String(row.candidate_source || ""), candidateExperience: String(row.candidate_experience || ""),
    rawScore: Number(row.raw_score), rawTotal: Number(row.raw_total), finalScore: Number(row.final_score), percent: Number(row.percent),
    unansweredCount: Number(row.unanswered_count), tabSwitches: Number(row.tab_switches), advisoryPenalty: Number(row.advisory_penalty),
    trustScore: Number(row.trust_score), status: String(row.result_status || ""),
    badge: String(row.badge || ""), recommendation: String(row.recommendation || ""), blockResults: parseJson(row.block_results, {}),
    answerDetails: parseJson(row.answer_details, []), scoreVerification: String(row.score_verification || ""),
    scoringAlgorithmVersion: String(row.scoring_algorithm_version || ""), telemetryVerification: String(row.telemetry_verification || ""),
    privacyConsentVersion: String(row.privacy_consent_version || ""), privacyConsentedAt: iso(row.privacy_consented_at),
    ageConfirmed: row.age_confirmed === true, reportCreated: row.report_created === true, reportObjectKey: String(row.report_object_key || ""),
    submissionHash: String(row.submission_hash || ""), completedAt: iso(row.completed_at), technical: row.technical === true, purgeAt: iso(row.purge_at)
  };
}

function createYdbAssessmentStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");

  return {
    async getRuntimeSettings() {
      const resultSets = await executeRead(sql, [
        "SELECT setting_key, setting_value FROM assessment_runtime_settings;"
      ], []);
      const settings = Object.create(null);
      rowsFrom(resultSets).forEach(row => { settings[String(row.setting_key || "")] = String(row.setting_value || ""); });
      return settings;
    },

    async getBankMetadata(testId, bankVersion) {
      const resultSets = await executeRead(sql, [
        `SELECT object_key, private_digest, public_digest, active, updated_at
        FROM assessment_banks WHERE test_id = `, " AND bank_version = ", ";"
      ], [String(testId || ""), String(bankVersion || "")]);
      const row = rowsFrom(resultSets)[0];
      return row ? {
        testId: String(testId), bankVersion: String(bankVersion), objectKey: String(row.object_key || ""),
        privateDigest: String(row.private_digest || ""), publicDigest: String(row.public_digest || ""),
        active: row.active === true, updatedAt: iso(row.updated_at)
      } : null;
    },

    async upsertBankMetadata(record) {
      const row = record || {};
      await executeWrite(sql, valueStrings(`UPSERT INTO assessment_banks
        (test_id, bank_version, object_key, private_digest, public_digest, active, updated_at)
        VALUES (`, 7, [], [6]), [row.testId, row.bankVersion, row.objectKey, row.privateDigest, row.publicDigest, row.active === true, row.updatedAt]);
    },

    async getInviteByCodeHash(codeHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invites VIEW invite_code WHERE code_hash = ", " LIMIT 1;"
      ], [String(codeHash || "")]);
      return mapInvite(rowsFrom(resultSets)[0]);
    },

    async getInviteGroupByCodeHash(codeHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invite_groups VIEW invite_group_code WHERE code_hash = ", " LIMIT 1;"
      ], [String(codeHash || "")]);
      return mapInviteGroup(rowsFrom(resultSets)[0]);
    },

    async getInviteGroupByRequestId(requestId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invite_groups VIEW invite_group_request WHERE request_id = ", " LIMIT 1;"
      ], [String(requestId || "")]);
      return mapInviteGroup(rowsFrom(resultSets)[0]);
    },

    async getInviteGroupById(groupId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invite_groups WHERE group_id = ", ";"
      ], [String(groupId || "")]);
      return mapInviteGroup(rowsFrom(resultSets)[0]);
    },

    async listInviteGroups(limit) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
      const resultSets = await executeRead(sql, [
        `SELECT * FROM assessment_invite_groups ORDER BY issued_at DESC LIMIT ${safeLimit};`
      ], []);
      return rowsFrom(resultSets).map(mapInviteGroup);
    },

    async upsertInviteGroup(group) {
      const row = group || {};
      await executeWrite(sql, valueStrings(`UPSERT INTO assessment_invite_groups
        (group_id, request_id, test_id, code_hash, purpose, max_uses, used_count,
         valid_for_hours, state, issued_at, expires_at, purge_at)
        VALUES (`, 12, [], [9, 10, 11]), [row.groupId, row.requestId, row.testId, row.codeHash, row.purpose,
        row.maxUses, row.usedCount, row.validForHours, row.state, row.issuedAt, row.expiresAt, row.purgeAt]);
    },

    async getInviteGroupClaim(groupId, identityHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invite_group_claims WHERE group_id = ", " AND identity_hash = ", ";"
      ], [String(groupId || ""), String(identityHash || "")]);
      return mapInviteGroupClaim(rowsFrom(resultSets)[0]);
    },

    async claimInviteGroupSeat(claim) {
      const row = claim || {};
      await executeWrite(sql, [
        `$existing = SELECT group_id FROM assessment_invite_group_claims
          WHERE group_id = `, " AND identity_hash = ", `;
        $eligible = SELECT group_id FROM assessment_invite_groups
          WHERE group_id = `, " AND state = ", " AND expires_at > ", `
            AND used_count < max_uses
            AND NOT EXISTS (SELECT * FROM $existing);
        UPSERT INTO assessment_invite_group_claims
          (group_id, identity_hash, invite_id, claimed_at, purge_at)
          SELECT group_id, `, " AS identity_hash, ", " AS invite_id, ", " AS claimed_at, ", ` AS purge_at FROM $eligible;
        UPDATE assessment_invite_groups SET used_count = used_count + 1
          WHERE group_id IN (SELECT group_id FROM $eligible);`
      ], [row.groupId, row.identityHash, row.groupId, "issued", row.claimedAt,
        row.identityHash, row.inviteId, row.claimedAt, row.purgeAt]);
      return this.getInviteGroupClaim(row.groupId, row.identityHash);
    },

    async revokeInviteGroup(groupId, requestId, revokedAt, purgeAt) {
      await executeWrite(sql, [
        "UPDATE assessment_invite_groups SET state = ", ", revoke_request_id = ", ", revoked_at = ", ", purge_at = ",
        " WHERE group_id = ", " AND state = ", ";"
      ], ["revoked", String(requestId), revokedAt, purgeAt, String(groupId), "issued"]);
    },

    async updateInviteGroupDescription(groupId, purpose) {
      await executeWrite(sql, [
        "UPDATE assessment_invite_groups SET purpose = ", " WHERE group_id = ", ";"
      ], [String(purpose || ""), String(groupId || "")]);
    },

    async getInviteByRequestId(requestId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_invites VIEW invite_request WHERE request_id = ", " LIMIT 1;"
      ], [String(requestId || "")]);
      return mapInvite(rowsFrom(resultSets)[0]);
    },

    async getInviteById(inviteId) {
      const resultSets = await executeRead(sql, ["SELECT * FROM assessment_invites WHERE invite_id = ", ";"], [String(inviteId || "")]);
      return mapInvite(rowsFrom(resultSets)[0]);
    },

    async listInvites(limit) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
      const resultSets = await executeRead(sql, [
        `SELECT * FROM assessment_invites ORDER BY issued_at DESC LIMIT ${safeLimit};`
      ], []);
      return rowsFrom(resultSets).map(mapInvite);
    },

    async upsertInvite(invite) {
      const row = invite || {};
      await executeWrite(sql, valueStrings(`UPSERT INTO assessment_invites
        (invite_id, request_id, test_id, code_hash, identity_hash, email_masked, purpose,
         allow_retake, valid_for_hours, state, issued_at, expires_at, purge_at)
        VALUES (`, 13, [], [10, 11, 12]), [row.inviteId, row.requestId, row.testId, row.codeHash, row.identityHash, row.emailMasked,
        row.purpose, row.allowRetake === true, row.validForHours, row.state, row.issuedAt, row.expiresAt, row.purgeAt]);
    },

    async markInviteActive(inviteId, attemptId, activatedAt) {
      await executeWrite(sql, [
        "UPDATE assessment_invites SET state = ", ", attempt_id = ", ", activated_at = ", " WHERE invite_id = ", " AND state = ", ";"
      ], ["active", String(attemptId), activatedAt, String(inviteId), "issued"]);
    },

    async completeInvite(inviteId, attemptId, completedAt, purgeAt) {
      await executeWrite(sql, [
        "UPDATE assessment_invites SET state = ", ", attempt_id = ", ", completed_at = ", ", purge_at = ", " WHERE invite_id = ", ";"
      ], ["completed", String(attemptId), completedAt, purgeAt, String(inviteId)]);
    },

    async revokeInvite(inviteId, requestId, revokedAt, purgeAt) {
      await executeWrite(sql, [
        "UPDATE assessment_invites SET state = ", ", revoke_request_id = ", ", revoked_at = ", ", purge_at = ", " WHERE invite_id = ", " AND state IN (", ", ", ");"
      ], ["revoked", String(requestId), revokedAt, purgeAt, String(inviteId), "issued", "active"]);
    },

    async getSessionByInviteId(inviteId) {
      const resultSets = await executeRead(sql, ["SELECT * FROM assessment_sessions WHERE invite_id = ", ";"], [String(inviteId || "")]);
      return mapSession(rowsFrom(resultSets)[0]);
    },

    async getSessionByAttemptId(attemptId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_sessions VIEW session_attempt WHERE attempt_id = ", " LIMIT 1;"
      ], [String(attemptId || "")]);
      return mapSession(rowsFrom(resultSets)[0]);
    },

    async listRecentSessions(testId, identityHash, since) {
      const resultSets = await executeRead(sql, [
        `SELECT * FROM assessment_sessions VIEW session_identity
        WHERE test_id = `, " AND identity_hash = ", " AND started_at >= ", ";"
      ], [String(testId || ""), String(identityHash || ""), since]);
      return rowsFrom(resultSets).map(mapSession);
    },

    async insertSession(session) {
      const row = session || {};
      await executeWrite(sql, valueStrings(`INSERT INTO assessment_sessions
        (attempt_id, invite_id, begin_request_id, state, test_id, test_version, bank_version,
         public_digest, question_ids, question_set_hash, identity_hash, fingerprint_hash,
         token_jti, token_issued_at, token_expires_at, started_at, privacy_consent_version,
         privacy_consented_at, age_confirmed, purge_at)
        VALUES (`, 20, [8], [13, 14, 15, 17, 19]), [row.attemptId, row.inviteId, row.beginRequestId, row.state, row.testId, row.testVersion, row.bankVersion,
        row.publicDigest, JSON.stringify(row.questionIds), row.questionSetHash, row.identityHash, row.fingerprintHash,
        row.tokenJti, row.tokenIssuedAt, row.tokenExpiresAt, row.startedAt, row.privacyConsentVersion,
        row.privacyConsentedAt, row.ageConfirmed === true, row.purgeAt]);
    },

    async reserveSession(session) {
      const row = session || {};
      await executeWrite(sql, [
        "UPDATE assessment_sessions SET state = ", ", save_request_id = ", ", submission_hash = ", ", reserved_at = ", ", result_code = ", ", result_json = CAST(", " AS JsonDocument), completed_at = ", " WHERE attempt_id = ", " AND state = ", ";"
      ], ["reserved", row.saveRequestId, row.submissionHash, row.reservedAt, row.resultCode, JSON.stringify(row.result), row.completedAt, row.attemptId, "active"]);
    },

    async completeSession(attemptId, result, completedAt, purgeAt) {
      await executeWrite(sql, [
        "UPDATE assessment_sessions SET state = ", ", result_json = CAST(", " AS JsonDocument), completed_at = ", ", purge_at = ", " WHERE attempt_id = ", ";"
      ], ["completed", JSON.stringify(result), completedAt, purgeAt, String(attemptId)]);
    },

    async getResultByCode(code) {
      const resultSets = await executeRead(sql, ["SELECT * FROM assessment_results WHERE result_code = ", ";"], [String(code || "")]);
      return mapResult(rowsFrom(resultSets)[0]);
    },

    async getResultByRequestId(requestId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM assessment_results VIEW result_request WHERE request_id = ", " LIMIT 1;"
      ], [String(requestId || "")]);
      return mapResult(rowsFrom(resultSets)[0]);
    },

    async listResults(limit) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000));
      const resultSets = await executeRead(sql, [`SELECT * FROM assessment_results ORDER BY completed_at DESC LIMIT ${safeLimit};`], []);
      return rowsFrom(resultSets).map(mapResult);
    },

    async insertResult(result) {
      const row = result || {};
      await executeWrite(sql, valueStrings(`INSERT INTO assessment_results
        (result_code, request_id, attempt_id, test_id, test_title, bank_version,
         candidate_name, candidate_email, candidate_telegram, english_level, candidate_source,
         candidate_experience, raw_score, raw_total, final_score, percent, unanswered_count,
         tab_switches, advisory_penalty, trust_score, result_status, badge, recommendation,
         block_results, answer_details,
         score_verification, scoring_algorithm_version, telemetry_verification,
         privacy_consent_version, privacy_consented_at, age_confirmed, report_created,
         report_object_key, submission_hash, completed_at, technical, purge_at)
        VALUES (`, 37, [23, 24], [29, 34, 36]), [row.code, row.requestId, row.attemptId, row.testId, row.testTitle, row.bankVersion,
        row.name, row.email, row.telegram, row.englishLevel, row.candidateSource, row.candidateExperience,
        row.rawScore, row.rawTotal, row.finalScore, row.percent, row.unansweredCount,
        row.tabSwitches, row.advisoryPenalty, row.trustScore, row.status, row.badge, row.recommendation,
        JSON.stringify(row.blockResults), JSON.stringify(row.answerDetails),
        row.scoreVerification, row.scoringAlgorithmVersion, row.telemetryVerification,
        row.privacyConsentVersion, row.privacyConsentedAt, row.ageConfirmed === true, row.reportCreated === true,
        String(row.reportObjectKey || ""), row.submissionHash, row.completedAt, row.technical === true, row.purgeAt]);
    },

    async appendAudit(event) {
      const row = event || {};
      await executeWrite(sql, valueStrings(`UPSERT INTO assessment_audit_events
        (event_date, event_id, event_type, subject_hash, outcome, created_at, purge_at)
        VALUES (`, 7, [], [5, 6], [0]), [row.eventDate, row.eventId, row.eventType, row.subjectHash, row.outcome, row.createdAt, row.purgeAt]);
    }
  };
}

module.exports = {
  QUERY_TIMEOUT_MS,
  createYdbAssessmentStore,
  executeRead,
  executeWrite,
  mapInviteGroup,
  mapInviteGroupClaim,
  mapInvite,
  mapResult,
  mapSession,
  parseJson,
  rowsFrom
};
