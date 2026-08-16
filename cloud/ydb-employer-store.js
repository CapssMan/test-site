"use strict";

const { QUERY_TIMEOUT_MS, mapAccount, rowsFrom } = require("./ydb-account-store");

function executeRead(sql, strings, values) {
  return sql(strings, ...values).isolation("onlineReadOnly", { allowInconsistentReads: false }).idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function executeWrite(sql, strings, values) {
  return sql(strings, ...values).isolation("serializableReadWrite").idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : "";
}

function mapEmployer(row) {
  if (!row) return null;
  return {
    employerId: String(row.employer_id || ""),
    identityProfileId: String(row.identity_profile_id || ""),
    organizationName: String(row.organization_name || ""),
    organizationId: String(row.organization_id || ""),
    role: String(row.employer_role || "recruiter"),
    organizationDomain: String(row.organization_domain || ""),
    verificationStatus: String(row.verification_status || ""),
    status: String(row.employer_status || ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapShortlist(row) {
  if (!row) return null;
  return {
    employerId: String(row.employer_id || ""),
    shortlistId: String(row.shortlist_id || ""),
    name: String(row.shortlist_name || ""),
    roleTemplateId: String(row.role_template_id || ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapShortlistItem(row) {
  if (!row) return null;
  return {
    employerId: String(row.employer_id || ""),
    shortlistId: String(row.shortlist_id || ""),
    talentProfileId: String(row.talent_profile_id || ""),
    candidateProfileId: String(row.candidate_profile_id || ""),
    addedAt: iso(row.added_at),
    purgeAt: iso(row.purge_at)
  };
}

function createYdbEmployerStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async getEmployerByIdentityProfileId(profileId) {
      const sets = await executeRead(sql, [
        "SELECT * FROM employer_accounts VIEW employer_identity WHERE identity_profile_id = ",
        " LIMIT 1;"
      ], [profileId]);
      return mapEmployer(rowsFrom(sets)[0]);
    },

    async upsertEmployerAccount(row) {
      await executeWrite(sql, [
        "UPSERT INTO employer_accounts (employer_id, identity_profile_id, organization_name, organization_domain, organization_id, employer_role, verification_status, employer_status, created_at, updated_at, purge_at) VALUES (",
        ", ", ", ", ", ", ", ", ", ", ", ", ", CAST(", " AS Timestamp), CAST(", " AS Timestamp), CAST(", " AS Timestamp));"
      ], [row.employerId, row.identityProfileId, row.organizationName, row.organizationDomain, row.organizationId, row.role, row.verificationStatus, row.status, row.createdAt, row.updatedAt, row.purgeAt]);
    },

    async listDiscoverableAccounts(limit) {
      const sets = await executeRead(sql, [
        "SELECT * FROM candidate_accounts WHERE account_status = ",
        " AND visibility = ",
        " AND (job_status = ",
        " OR job_status = ",
        ") ORDER BY updated_at DESC LIMIT ",
        ";"
      ], ["active", "discoverable", "active", "open", Number(limit)]);
      return rowsFrom(sets).map(mapAccount).filter(Boolean);
    },

    async createShortlist(row) {
      await executeWrite(sql, [
        "UPSERT INTO employer_shortlists (employer_id, shortlist_id, shortlist_name, role_template_id, created_at, updated_at, purge_at) VALUES (",
        ", ", ", ", ", ", ", CAST(", " AS Timestamp), CAST(", " AS Timestamp), CAST(", " AS Timestamp));"
      ], [row.employerId, row.shortlistId, row.name, row.roleTemplateId, row.createdAt, row.updatedAt, row.purgeAt]);
    },

    async listShortlists(employerId) {
      const sets = await executeRead(sql, [
        "SELECT * FROM employer_shortlists WHERE employer_id = ",
        " ORDER BY updated_at DESC LIMIT 100;"
      ], [employerId]);
      return rowsFrom(sets).map(mapShortlist);
    },

    async getShortlist(employerId, shortlistId) {
      const sets = await executeRead(sql, [
        "SELECT * FROM employer_shortlists WHERE employer_id = ",
        " AND shortlist_id = ",
        " LIMIT 1;"
      ], [employerId, shortlistId]);
      return mapShortlist(rowsFrom(sets)[0]);
    },

    async listShortlistItems(employerId, shortlistId) {
      const sets = await executeRead(sql, [
        "SELECT * FROM employer_shortlist_items WHERE employer_id = ",
        " AND shortlist_id = ",
        " ORDER BY added_at ASC LIMIT 20;"
      ], [employerId, shortlistId]);
      return rowsFrom(sets).map(mapShortlistItem);
    },

    async addShortlistItem(row) {
      await executeWrite(sql, [
        "UPSERT INTO employer_shortlist_items (employer_id, shortlist_id, talent_profile_id, candidate_profile_id, added_at, purge_at) VALUES (",
        ", ", ", ", ", ", ", CAST(", " AS Timestamp), CAST(", " AS Timestamp)); UPDATE employer_shortlists SET updated_at = CAST(",
        " AS Timestamp) WHERE employer_id = ",
        " AND shortlist_id = ",
        ";"
      ], [row.employerId, row.shortlistId, row.talentProfileId, row.candidateProfileId, row.addedAt, row.purgeAt, row.addedAt, row.employerId, row.shortlistId]);
    },

    async removeShortlistItem(employerId, shortlistId, talentProfileId, updatedAt) {
      await executeWrite(sql, [
        "DELETE FROM employer_shortlist_items WHERE employer_id = ",
        " AND shortlist_id = ",
        " AND talent_profile_id = ",
        "; UPDATE employer_shortlists SET updated_at = CAST(",
        " AS Timestamp) WHERE employer_id = ",
        " AND shortlist_id = ",
        ";"
      ], [employerId, shortlistId, talentProfileId, updatedAt, employerId, shortlistId]);
    }
  };
}

module.exports = { createYdbEmployerStore, mapEmployer, mapShortlist, mapShortlistItem };
