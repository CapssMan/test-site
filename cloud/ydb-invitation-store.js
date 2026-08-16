"use strict";

const QUERY_TIMEOUT_MS = 5000;

function rowsFrom(resultSets) {
  return Array.isArray(resultSets) && Array.isArray(resultSets[0]) ? resultSets[0] : [];
}

function executeRead(sql, strings, values) {
  return sql(strings, ...values).isolation("onlineReadOnly", { allowInconsistentReads: false }).idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function executeWrite(sql, strings, values) {
  return sql(strings, ...values).isolation("serializableReadWrite").idempotent(true).timeout(QUERY_TIMEOUT_MS);
}

function valueStrings(prefix, valueCount, timestampIndexes) {
  const timestamps = new Set(timestampIndexes || []);
  const open = index => timestamps.has(index) ? "CAST(" : "";
  const close = index => timestamps.has(index) ? " AS Timestamp)" : "";
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

function mapInvitation(row) {
  if (!row) return null;
  return {
    candidateProfileId: String(row.candidate_profile_id || ""),
    invitationId: String(row.invitation_id || ""),
    employerId: String(row.employer_id || ""),
    shortlistId: String(row.shortlist_id || ""),
    requestId: String(row.request_id || ""),
    talentProfileId: String(row.talent_profile_id || ""),
    candidateAlias: String(row.candidate_alias || ""),
    organizationName: String(row.organization_name || ""),
    roleTitle: String(row.role_title || ""),
    roleSummary: String(row.role_summary || ""),
    workFormat: String(row.work_format || ""),
    region: String(row.region || ""),
    compensation: String(row.compensation || ""),
    status: String(row.invitation_status || ""),
    responseDeadline: iso(row.response_deadline),
    createdAt: iso(row.created_at),
    viewedAt: iso(row.viewed_at),
    respondedAt: iso(row.responded_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function createYdbInvitationStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async upsertInvitation(row) {
      await executeWrite(sql, valueStrings(
        "UPSERT INTO candidate_employer_invitations (candidate_profile_id, invitation_id, employer_id, shortlist_id, request_id, talent_profile_id, candidate_alias, organization_name, role_title, role_summary, work_format, region, compensation, invitation_status, response_deadline, created_at, viewed_at, responded_at, updated_at, purge_at) VALUES (",
        20, [14, 15, 16, 17, 18, 19]
      ), [row.candidateProfileId, row.invitationId, row.employerId, row.shortlistId, row.requestId, row.talentProfileId,
        row.candidateAlias, row.organizationName, row.roleTitle, row.roleSummary, row.workFormat, row.region,
        row.compensation, row.status, row.responseDeadline, row.createdAt, row.viewedAt, row.respondedAt, row.updatedAt, row.purgeAt]);
    },

    async getCandidateInvitation(candidateProfileId, invitationId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_employer_invitations WHERE candidate_profile_id = ", " AND invitation_id = ", ";"
      ], [candidateProfileId, invitationId]);
      return mapInvitation(rowsFrom(resultSets)[0]);
    },

    async listCandidateInvitations(candidateProfileId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_employer_invitations WHERE candidate_profile_id = ", " ORDER BY invitation_id DESC LIMIT 100;"
      ], [candidateProfileId]);
      return rowsFrom(resultSets).map(mapInvitation);
    },

    async listEmployerInvitations(employerId) {
      const resultSets = await executeRead(sql, [
        "SELECT * FROM candidate_employer_invitations VIEW employer_invitations WHERE employer_id = ", " ORDER BY invitation_id DESC LIMIT 500;"
      ], [employerId]);
      return rowsFrom(resultSets).map(mapInvitation);
    },

    async markInvitationViewed(candidateProfileId, invitationId, viewedAt) {
      await executeWrite(sql, [
        "UPDATE candidate_employer_invitations SET invitation_status = ", ", viewed_at = CAST(", " AS Timestamp), updated_at = CAST(", " AS Timestamp) WHERE candidate_profile_id = ", " AND invitation_id = ", " AND invitation_status = ", ";"
      ], ["viewed", viewedAt, viewedAt, candidateProfileId, invitationId, "sent"]);
      return this.getCandidateInvitation(candidateProfileId, invitationId);
    },

    async respondInvitation(candidateProfileId, invitationId, response, respondedAt) {
      await executeWrite(sql, [
        "UPDATE candidate_employer_invitations SET invitation_status = ", ", responded_at = CAST(", " AS Timestamp), updated_at = CAST(", " AS Timestamp) WHERE candidate_profile_id = ", " AND invitation_id = ", " AND invitation_status IN (", ", ", ");"
      ], [response, respondedAt, respondedAt, candidateProfileId, invitationId, "sent", "viewed"]);
      return this.getCandidateInvitation(candidateProfileId, invitationId);
    }
  };
}

module.exports = { createYdbInvitationStore, mapInvitation };
