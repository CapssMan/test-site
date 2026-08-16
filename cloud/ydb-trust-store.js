"use strict";

const { QUERY_TIMEOUT_MS, rowsFrom } = require("./ydb-account-store");

function executeRead(sql, strings, values) {
  return sql(strings, ...values).isolation("onlineReadOnly", { allowInconsistentReads: false }).idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function executeWrite(sql, strings, values) {
  return sql(strings, ...values).isolation("serializableReadWrite").idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : "";
}

function mapCredential(row) {
  if (!row) return null;
  return {
    candidateProfileId: String(row.candidate_profile_id || ""),
    credentialId: String(row.credential_id || ""),
    credentialType: String(row.credential_type || ""),
    title: String(row.credential_title || ""),
    issuer: String(row.credential_issuer || ""),
    description: String(row.credential_description || ""),
    issuedYear: String(row.issued_year || ""),
    evidenceUrl: String(row.evidence_url || ""),
    visibility: String(row.credential_visibility || "private"),
    verificationStatus: String(row.verification_status || "self_reported"),
    verificationNote: String(row.verification_note || ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapOrganization(row) {
  if (!row) return null;
  return {
    organizationId: String(row.organization_id || ""),
    displayName: String(row.display_name || ""),
    legalName: String(row.legal_name || ""),
    domain: String(row.organization_domain || ""),
    websiteUrl: String(row.website_url || ""),
    description: String(row.organization_description || ""),
    verificationStatus: String(row.verification_status || ""),
    status: String(row.organization_status || ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function createYdbTrustStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async listCandidateCredentials(profileId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_credentials WHERE candidate_profile_id = ", " ORDER BY updated_at DESC LIMIT 50;"], [profileId]);
      return rowsFrom(sets).map(mapCredential).filter(Boolean);
    },

    async listVerifiedCandidateCredentials(profileId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_credentials WHERE candidate_profile_id = ", " AND credential_visibility = ", " AND verification_status = ", " ORDER BY updated_at DESC LIMIT 20;"], [profileId, "employer", "verified"]);
      return rowsFrom(sets).map(mapCredential).filter(Boolean);
    },

    async getCandidateCredential(profileId, credentialId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_credentials WHERE candidate_profile_id = ", " AND credential_id = ", " LIMIT 1;"], [profileId, credentialId]);
      return mapCredential(rowsFrom(sets)[0]);
    },

    async listCredentialReviewQueue(status, limit) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_credentials VIEW credential_review WHERE verification_status = ", " ORDER BY updated_at ASC LIMIT ", ";"], [status, Number(limit)]);
      return rowsFrom(sets).map(mapCredential).filter(Boolean);
    },

    async setCredentialVerification(profileId, credentialId, status, note, updatedAt, purgeAt) {
      await executeWrite(sql, [
        "UPDATE candidate_credentials SET verification_status = ", ", verification_note = ", ", updated_at = CAST(", " AS Timestamp), purge_at = CAST(", " AS Timestamp) WHERE candidate_profile_id = ", " AND credential_id = ", ";"
      ], [status, note, updatedAt, purgeAt, profileId, credentialId]);
      return this.getCandidateCredential(profileId, credentialId);
    },

    async upsertCandidateCredential(row) {
      await executeWrite(sql, [
        "UPSERT INTO candidate_credentials (candidate_profile_id, credential_id, credential_type, credential_title, credential_issuer, credential_description, issued_year, evidence_url, credential_visibility, verification_status, verification_note, created_at, updated_at, purge_at) VALUES (",
        ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", ", CAST(", " AS Timestamp), CAST(", " AS Timestamp), CAST(", " AS Timestamp));"
      ], [row.candidateProfileId, row.credentialId, row.credentialType, row.title, row.issuer, row.description, row.issuedYear, row.evidenceUrl, row.visibility, row.verificationStatus, row.verificationNote, row.createdAt, row.updatedAt, row.purgeAt]);
    },

    async deleteCandidateCredential(profileId, credentialId) {
      await executeWrite(sql, ["DELETE FROM candidate_credentials WHERE candidate_profile_id = ", " AND credential_id = ", ";"], [profileId, credentialId]);
    },

    async deleteAllCandidateCredentials(profileId) {
      await executeWrite(sql, ["DELETE FROM candidate_credentials WHERE candidate_profile_id = ", ";"], [profileId]);
    },

    async getOrganization(organizationId) {
      if (!organizationId) return null;
      const sets = await executeRead(sql, ["SELECT * FROM employer_organizations WHERE organization_id = ", " LIMIT 1;"], [organizationId]);
      return mapOrganization(rowsFrom(sets)[0]);
    },

    async getOrganizationByDomain(domain) {
      const sets = await executeRead(sql, ["SELECT * FROM employer_organizations VIEW organization_domain WHERE organization_domain = ", " LIMIT 1;"], [domain]);
      return mapOrganization(rowsFrom(sets)[0]);
    },

    async upsertOrganization(row) {
      await executeWrite(sql, [
        "UPSERT INTO employer_organizations (organization_id, display_name, legal_name, organization_domain, website_url, organization_description, verification_status, organization_status, created_at, updated_at, purge_at) VALUES (",
        ", ", ", ", ", ", ", ", ", ", ", ", ", CAST(", " AS Timestamp), CAST(", " AS Timestamp), CAST(", " AS Timestamp));"
      ], [row.organizationId, row.displayName, row.legalName, row.domain, row.websiteUrl, row.description, row.verificationStatus, row.status, row.createdAt, row.updatedAt, row.purgeAt]);
    }
  };
}

module.exports = { createYdbTrustStore, mapCredential, mapOrganization };
