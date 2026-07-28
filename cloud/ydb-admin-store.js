"use strict";

const { executeRead, executeWrite, rowsFrom } = require("./ydb-assessment-store");

function valueStrings(prefix, count) {
  return [prefix].concat(Array.from({ length: count - 1 }, () => ", "), [");"]);
}

function iso(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapRankingProfile(row) {
  if (!row) return null;
  return {
    testId: String(row.test_id || ""),
    publicProfileId: String(row.public_profile_id || ""),
    resultCode: String(row.result_code || ""),
    publicAlias: String(row.public_alias || ""),
    publicOptIn: row.public_opt_in === true,
    publicConsentActive: row.public_consent_active === true,
    publicConsentVersion: String(row.public_consent_version || ""),
    bankVersion: String(row.bank_version || ""),
    status: String(row.result_status || ""),
    scoreVerification: String(row.score_verification || ""),
    percent: Number(row.percent),
    completedAt: iso(row.completed_at),
    technical: row.technical === true,
    managementTokenHash: String(row.management_token_hash || ""),
    consentedAt: iso(row.consented_at),
    expiresAt: iso(row.expires_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapDeletionOperation(row) {
  if (!row) return null;
  return {
    requestId: String(row.request_id || ""),
    code: String(row.result_code || ""),
    scope: String(row.deletion_scope || ""),
    previewDigest: String(row.preview_digest || ""),
    state: String(row.state || ""),
    backupObjectKey: String(row.backup_object_key || ""),
    backupPurged: row.backup_purged === true,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapCount(row) {
  return {
    rowCount: Number(row && row.row_count || 0),
    lastRecordAt: iso(row && row.last_record_at)
  };
}

function createYdbAdminStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async getDiagnostics() {
      const resultRows = rowsFrom(await executeRead(sql, ["SELECT COUNT(*) AS row_count, MAX(completed_at) AS last_record_at FROM assessment_results;"], []));
      const sessionRows = rowsFrom(await executeRead(sql, ["SELECT COUNT(*) AS row_count, MAX(started_at) AS last_record_at FROM assessment_sessions;"], []));
      const inviteRows = rowsFrom(await executeRead(sql, ["SELECT COUNT(*) AS row_count, MAX(issued_at) AS last_record_at FROM assessment_invites;"], []));
      const reportRows = rowsFrom(await executeRead(sql, ["SELECT COUNT(*) AS row_count, MAX(completed_at) AS last_record_at FROM assessment_results WHERE report_created = TRUE;"], []));
      const results = mapCount(resultRows[0]);
      const sessions = mapCount(sessionRows[0]);
      const invites = mapCount(inviteRows[0]);
      const reports = mapCount(reportRows[0]);
      return { results, sessions, invites, reports };
    },

    async listRankingProfilesByResultCode(resultCode) {
      const rows = rowsFrom(await executeRead(sql, ["SELECT * FROM ranking_profiles;"], []));
      return rows.map(mapRankingProfile).filter(profile => profile && profile.resultCode === String(resultCode || ""));
    },

    async deleteRankingProfile(testId, publicProfileId) {
      await executeWrite(sql, ["DELETE FROM ranking_profiles WHERE test_id = ", " AND public_profile_id = ", ";"], [String(testId || ""), String(publicProfileId || "")]);
    },

    async getDeletionOperation(requestId) {
      const rows = rowsFrom(await executeRead(sql, ["SELECT * FROM assessment_deletion_operations WHERE request_id = ", ";"], [String(requestId || "")]));
      return mapDeletionOperation(rows[0]);
    },

    async upsertDeletionOperation(operation) {
      const row = operation || {};
      await executeWrite(sql, valueStrings(`UPSERT INTO assessment_deletion_operations
        (request_id, result_code, deletion_scope, preview_digest, state, backup_object_key,
         backup_purged, started_at, completed_at, purge_at)
        VALUES (`, 10), [row.requestId, row.code, row.scope, row.previewDigest, row.state, row.backupObjectKey,
        row.backupPurged === true, row.startedAt, row.completedAt || row.startedAt, row.purgeAt]);
    },

    async deleteAssessmentData(snapshot) {
      const source = snapshot || {};
      if (source.scope === "full_attempt" && source.session && source.invite) {
        await executeWrite(sql, [
          "DELETE FROM assessment_results WHERE result_code = ", ";\nDELETE FROM assessment_sessions WHERE invite_id = ", ";\nDELETE FROM assessment_invites WHERE invite_id = ", ";"
        ], [source.code, source.session.inviteId, source.invite.inviteId]);
        return;
      }
      await executeWrite(sql, ["DELETE FROM assessment_results WHERE result_code = ", ";"], [source.code]);
    }
  };
}

module.exports = { createYdbAdminStore, mapCount, mapDeletionOperation, mapRankingProfile };
