"use strict";

const QUERY_TIMEOUT_MS = 5000;

function rowsFrom(resultSets) {
  return Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : [];
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

function valueStrings(prefix, valueCount, timestampIndexes) {
  const timestamps = new Set(timestampIndexes || []);
  const open = index => timestamps.has(index) ? "Unwrap(CAST(" : "";
  const close = index => timestamps.has(index) ? " AS Timestamp))" : "";
  const strings = [prefix + open(0)];
  for (let index = 0; index < valueCount - 1; index += 1) {
    strings.push(close(index) + ", " + open(index + 1));
  }
  strings.push(close(valueCount - 1) + ");");
  return strings;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : "";
}

function mapAccount(row) {
  if (!row) return null;
  return {
    profileId: String(row.profile_id || ""),
    status: String(row.account_status || ""),
    provider: String(row.provider || ""),
    providerSubjectHash: String(row.provider_subject_hash || ""),
    emailHash: String(row.email_hash || ""),
    emailMasked: String(row.email_masked || ""),
    publicAlias: String(row.public_alias || ""),
    visibility: String(row.visibility || "private"),
    jobStatus: String(row.job_status || "hidden"),
    region: String(row.region || ""),
    workFormat: String(row.work_format || ""),
    experienceBand: String(row.experience_band || ""),
    currentRole: String(row.current_role || ""),
    targetRole: String(row.target_role || ""),
    experienceSummary: String(row.experience_summary || ""),
    professionalTools: String(row.professional_tools || ""),
    availabilityConfirmedAt: iso(row.availability_confirmed_at),
    accountConsentVersion: String(row.account_consent_version || ""),
    accountConsentedAt: iso(row.account_consented_at),
    publicConsentVersion: String(row.public_consent_version || ""),
    publicConsentedAt: iso(row.public_consented_at),
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    profileId: String(row.profile_id || ""),
    tokenHash: String(row.session_token_hash || ""),
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
    lastSeenAt: iso(row.last_seen_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapAttempt(row) {
  if (!row) return null;
  return {
    profileId: String(row.profile_id || ""),
    testId: String(row.test_id || ""),
    attemptId: String(row.attempt_id || ""),
    state: String(row.attempt_state || ""),
    resultCode: String(row.result_code || ""),
    percent: Number(row.percent || 0),
    bankVersion: String(row.bank_version || ""),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapSelfServiceSlot(row) {
  if (!row) return null;
  return {
    profileId: String(row.profile_id || ""),
    testId: String(row.test_id || ""),
    inviteId: String(row.invite_id || ""),
    beginRequestId: String(row.begin_request_id || ""),
    attemptId: String(row.attempt_id || ""),
    state: String(row.slot_state || ""),
    grantedAt: iso(row.granted_at),
    expiresAt: iso(row.expires_at),
    eligibleAfter: iso(row.eligible_after),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function createYdbAccountStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async getRuntimeSettings() {
      const resultSets = await executeRead(sql, ["SELECT setting_key, setting_value FROM assessment_runtime_settings;"], []);
      return Object.fromEntries(rowsFrom(resultSets).map(row => [String(row.setting_key || ""), String(row.setting_value || "")]));
    },

    async getAccountByProviderSubject(provider, subjectHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_accounts VIEW candidate_provider_subject WHERE provider = ",
        " AND provider_subject_hash = ",
        " LIMIT 1;"
      ], [provider, subjectHash]);
      return mapAccount(rowsFrom(resultSets)[0]);
    },

    async getAccountByEmailHash(emailHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_accounts VIEW candidate_email WHERE email_hash = ",
        " LIMIT 1;"
      ], [emailHash]);
      return mapAccount(rowsFrom(resultSets)[0]);
    },

    async getAccountByProfileId(profileId) {
      const resultSets = await executeRead(sql, ["SELECT * FROM candidate_accounts WHERE profile_id = ", ";"], [profileId]);
      return mapAccount(rowsFrom(resultSets)[0]);
    },

    async upsertAccount(row) {
      await executeWrite(sql, valueStrings(
        "UPSERT INTO candidate_accounts (profile_id, account_status, provider, provider_subject_hash, email_hash, email_masked, public_alias, visibility, job_status, region, work_format, experience_band, current_role, target_role, experience_summary, professional_tools, availability_confirmed_at, account_consent_version, account_consented_at, public_consent_version, public_consented_at, created_at, last_login_at, updated_at, purge_at) VALUES (",
        25,
        [16, 18, 20, 21, 22, 23, 24]
      ), [row.profileId, row.status, row.provider, row.providerSubjectHash, row.emailHash, row.emailMasked,
        row.publicAlias, row.visibility, row.jobStatus, row.region, row.workFormat, row.experienceBand, row.currentRole,
        row.targetRole, row.experienceSummary, row.professionalTools, row.availabilityConfirmedAt,
        row.accountConsentVersion, row.accountConsentedAt, row.publicConsentVersion,
        row.publicConsentedAt, row.createdAt, row.lastLoginAt, row.updatedAt, row.purgeAt]);
    },

    async insertSession(row) {
      await executeWrite(sql, valueStrings(
        "UPSERT INTO candidate_account_sessions (profile_id, session_token_hash, issued_at, expires_at, last_seen_at, purge_at) VALUES (",
        6,
        [2, 3, 4, 5]
      ), [row.profileId, row.tokenHash, row.issuedAt, row.expiresAt, row.lastSeenAt, row.purgeAt]);
    },

    async getSessionByTokenHash(tokenHash) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_account_sessions VIEW candidate_session_token WHERE session_token_hash = ",
        " LIMIT 1;"
      ], [tokenHash]);
      return mapSession(rowsFrom(resultSets)[0]);
    },

    async deleteSession(profileId, tokenHash) {
      await executeWrite(sql, [
        "DELETE FROM candidate_account_sessions WHERE profile_id = ",
        " AND session_token_hash = ",
        ";"
      ], [profileId, tokenHash]);
    },

    async updateProfile(profileId, changes) {
      await executeWrite(sql, [
        "UPDATE candidate_accounts SET public_alias = ", ", visibility = ", ", job_status = ",
        ", region = ", ", work_format = ", ", experience_band = ", ", current_role = ",
        ", target_role = ", ", experience_summary = ", ", professional_tools = ",
        ", availability_confirmed_at = CAST(", " AS Timestamp), account_consent_version = ",
        ", account_consented_at = CAST(", " AS Timestamp), public_consent_version = ",
        ", public_consented_at = CAST(", " AS Timestamp), updated_at = CAST(",
        " AS Timestamp), purge_at = CAST(", " AS Timestamp) WHERE profile_id = ", " AND account_status = ", ";"
      ], [changes.publicAlias, changes.visibility, changes.jobStatus, changes.region, changes.workFormat,
        changes.experienceBand, changes.currentRole, changes.targetRole, changes.experienceSummary,
        changes.professionalTools, changes.availabilityConfirmedAt, changes.accountConsentVersion,
        changes.accountConsentedAt, changes.publicConsentVersion, changes.publicConsentedAt,
        changes.updatedAt, changes.purgeAt, profileId, "active"]);
    },

    async listPilotAccounts(limit) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
      const resultSets = await executeRead(sql, [`SELECT * FROM candidate_accounts ORDER BY created_at DESC LIMIT ${safeLimit};`], []);
      return rowsFrom(resultSets).map(mapAccount);
    },

    async listPilotAttempts(limit) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
      const resultSets = await executeRead(sql, [`SELECT * FROM candidate_attempt_links ORDER BY started_at DESC LIMIT ${safeLimit};`], []);
      return rowsFrom(resultSets).map(mapAttempt);
    },
    async listProfileAttempts(profileId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_attempt_links WHERE profile_id = ",
        " ORDER BY started_at DESC LIMIT 100;"
      ], [profileId]);
      return rowsFrom(resultSets).map(mapAttempt);
    },

    async listRecentProfileAttempts(profileId, testId, since) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_attempt_links WHERE profile_id = ",
        " AND test_id = ",
        " AND started_at >= CAST(",
        " AS Timestamp);"
      ], [profileId, testId, since]);
      return rowsFrom(resultSets).map(mapAttempt);
    },

    async getProfileAttemptByAttemptId(attemptId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_attempt_links VIEW candidate_attempt WHERE attempt_id = ",
        " LIMIT 1;"
      ], [attemptId]);
      return mapAttempt(rowsFrom(resultSets)[0]);
    },

    async upsertProfileAttempt(row) {
      await executeWrite(sql, valueStrings(
        "UPSERT INTO candidate_attempt_links (profile_id, test_id, attempt_id, attempt_state, result_code, percent, bank_version, started_at, completed_at, purge_at) VALUES (",
        10,
        [7, 8, 9]
      ), [row.profileId, row.testId, row.attemptId, row.state, row.resultCode, row.percent, row.bankVersion, row.startedAt, row.completedAt, row.purgeAt]);
    },

    async completeProfileAttempt(row) {
      await executeWrite(sql, [
        "UPDATE candidate_attempt_links SET attempt_state = ",
        ", result_code = ",
        ", percent = ",
        ", bank_version = ",
        ", completed_at = CAST(",
        " AS Timestamp), purge_at = CAST(",
        " AS Timestamp) WHERE profile_id = ",
        " AND test_id = ",
        " AND attempt_id = ",
        ";"
      ], ["completed", row.resultCode, row.percent, row.bankVersion, row.completedAt, row.purgeAt, row.profileId, row.testId, row.attemptId]);
    },

    async getSelfServiceSlot(profileId, testId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_self_service_slots WHERE profile_id = ", " AND test_id = ", ";"
      ], [String(profileId || ""), String(testId || "")]);
      return mapSelfServiceSlot(rowsFrom(resultSets)[0]);
    },

    async claimSelfServiceSlot(row) {
      await executeWrite(sql, [
        `$current = SELECT slot_state, expires_at, eligible_after FROM candidate_self_service_slots
          WHERE profile_id = `, " AND test_id = ", `;
        $eligible = SELECT profile_id FROM candidate_accounts
          WHERE profile_id = `, " AND account_status = ", ` AND (
            NOT EXISTS (SELECT * FROM $current) OR
            EXISTS (SELECT * FROM $current WHERE
              (slot_state = `, " AND expires_at <= CAST(", ` AS Timestamp)) OR
              (slot_state = `, " AND eligible_after <= CAST(", ` AS Timestamp))
            )
          );
        UPSERT INTO candidate_self_service_slots
          (profile_id, test_id, invite_id, begin_request_id, attempt_id, slot_state,
           granted_at, expires_at, eligible_after, updated_at, purge_at)
          SELECT profile_id, `, " AS test_id, ", " AS invite_id, ", " AS begin_request_id, ",
            " AS attempt_id, ", " AS slot_state, CAST(", " AS Timestamp), CAST(",
            " AS Timestamp), CAST(", " AS Timestamp), CAST(", " AS Timestamp), CAST(",
            " AS Timestamp) FROM $eligible;"
      ], [row.profileId, row.testId, row.profileId, "active", "active", row.now, "completed", row.now,
        row.testId, row.inviteId, row.beginRequestId, "", "active", row.grantedAt, row.expiresAt,
        row.eligibleAfter, row.updatedAt, row.purgeAt]);
      return this.getSelfServiceSlot(row.profileId, row.testId);
    },

    async activateSelfServiceSlot(row) {
      await executeWrite(sql, [
        "UPDATE candidate_self_service_slots SET attempt_id = ", ", expires_at = CAST(",
        " AS Timestamp), updated_at = CAST(", " AS Timestamp) WHERE profile_id = ",
        " AND test_id = ", " AND invite_id = ", " AND begin_request_id = ", " AND slot_state = ", ";"
      ], [row.attemptId, row.expiresAt, row.updatedAt, row.profileId, row.testId, row.inviteId,
        row.beginRequestId, "active"]);
    },

    async completeSelfServiceSlot(row) {
      await executeWrite(sql, [
        "UPDATE candidate_self_service_slots SET slot_state = ", ", eligible_after = CAST(",
        " AS Timestamp), expires_at = CAST(", " AS Timestamp), updated_at = CAST(",
        " AS Timestamp), purge_at = CAST(", " AS Timestamp) WHERE profile_id = ",
        " AND test_id = ", " AND attempt_id = ", " AND slot_state = ", ";"
      ], ["completed", row.eligibleAfter, row.completedAt, row.completedAt, row.purgeAt,
        row.profileId, row.testId, row.attemptId, "active"]);
    },

    async deleteAccount(profileId) {
      await executeWrite(sql, [
        "DELETE FROM candidate_account_sessions WHERE profile_id = ",
        "; DELETE FROM candidate_attempt_links WHERE profile_id = ",
        "; DELETE FROM candidate_self_service_slots WHERE profile_id = ",
        "; DELETE FROM candidate_accounts WHERE profile_id = ",
        ";"
      ], [profileId, profileId, profileId, profileId]);
    }
  };
}

module.exports = { QUERY_TIMEOUT_MS, createYdbAccountStore, mapAccount, mapSession, mapAttempt, mapSelfServiceSlot, rowsFrom };
