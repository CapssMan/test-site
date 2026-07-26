"use strict";

const QUERY_TIMEOUT_MS = 3500;

function rowsFrom(resultSets) {
  if (!Array.isArray(resultSets) || !Array.isArray(resultSets[0])) return [];
  return resultSets[0];
}

function executeRead(sql, strings, values) {
  return sql(strings, ...values)
    .isolation("onlineReadOnly", { allowInconsistentReads: true })
    .idempotent(true)
    .timeout(QUERY_TIMEOUT_MS);
}

function executeWrite(sql, strings, values) {
  return sql(strings, ...values)
    .isolation("serializableReadWrite")
    .idempotent(true)
    .timeout(QUERY_TIMEOUT_MS);
}

function createYdbRankingStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");

  return {
    async getActiveBankVersion(testId) {
      const resultSets = await executeRead(sql, [
        "SELECT bank_version FROM active_bank_versions WHERE test_id = ",
        ";"
      ], [String(testId || "")]);
      const row = rowsFrom(resultSets)[0];
      const bankVersion = String(row && row.bank_version || "").trim();
      if (!bankVersion) throw new Error("active_bank_version_missing");
      return bankVersion;
    },

    async listRankingCandidates(options) {
      const settings = options || {};
      const testId = String(settings.testId || "");
      const bankVersion = String(settings.bankVersion || "");
      const resultSets = await executeRead(sql, [
        `SELECT
          public_profile_id,
          result_code,
          public_alias,
          public_opt_in,
          public_consent_active,
          public_consent_version,
          bank_version,
          result_status,
          score_verification,
          percent,
          completed_at,
          technical
        FROM ranking_profiles
        WHERE test_id = `,
        " AND bank_version = ",
        ";"
      ], [testId, bankVersion]);

      return rowsFrom(resultSets).map(row => ({
        publicProfileId: String(row.public_profile_id || ""),
        resultCode: String(row.result_code || ""),
        publicAlias: String(row.public_alias || ""),
        publicOptIn: row.public_opt_in === true,
        publicConsentActive: row.public_consent_active === true,
        publicConsentVersion: String(row.public_consent_version || ""),
        testId,
        bankVersion: String(row.bank_version || ""),
        status: String(row.result_status || ""),
        scoreVerification: String(row.score_verification || ""),
        percent: Number(row.percent),
        completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at || ""),
        technical: row.technical === true
      }));
    },

    async upsertRankingProfile(profile) {
      const row = profile || {};
      await executeWrite(sql, [
        `UPSERT INTO ranking_profiles (
          test_id, public_profile_id, result_code, public_alias,
          public_opt_in, public_consent_active, public_consent_version,
          bank_version, result_status, score_verification, percent,
          completed_at, technical, management_token_hash, consented_at,
          expires_at, updated_at
        ) VALUES (`, ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ");"
      ], [
        String(row.testId || ""), String(row.publicProfileId || ""),
        String(row.resultCode || ""), String(row.publicAlias || ""),
        row.publicOptIn === true, row.publicConsentActive === true,
        String(row.publicConsentVersion || ""), String(row.bankVersion || ""),
        String(row.status || ""), String(row.scoreVerification || ""),
        Number(row.percent), row.completedAt, row.technical === true,
        String(row.managementTokenHash || ""), row.consentedAt,
        row.expiresAt, row.updatedAt
      ]);
    },

    async withdrawRankingProfile(options) {
      const settings = options || {};
      const resultSets = await executeWrite(sql, [
        `DELETE FROM ranking_profiles
        WHERE test_id = `,
        " AND public_profile_id = ",
        " AND management_token_hash = ",
        " RETURNING public_profile_id;"
      ], [
        String(settings.testId || ""), String(settings.publicProfileId || ""),
        String(settings.managementTokenHash || "")
      ]);
      return rowsFrom(resultSets).length > 0;
    }
  };
}

module.exports = { QUERY_TIMEOUT_MS, createYdbRankingStore, executeWrite, rowsFrom };
