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

function mapConversation(row) {
  if (!row) return null;
  return {
    candidateProfileId: String(row.candidate_profile_id || ""),
    conversationId: String(row.conversation_id || ""),
    invitationId: String(row.invitation_id || ""),
    employerId: String(row.employer_id || ""),
    organizationId: String(row.organization_id || ""),
    organizationName: String(row.organization_name || ""),
    candidateAlias: String(row.candidate_alias || ""),
    roleTitle: String(row.role_title || ""),
    state: String(row.conversation_state || "open"),
    candidateUnreadCount: Number(row.candidate_unread_count || 0),
    employerUnreadCount: Number(row.employer_unread_count || 0),
    lastMessageAt: iso(row.last_message_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    purgeAt: iso(row.purge_at)
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    conversationId: String(row.conversation_id || ""),
    messageId: String(row.message_id || ""),
    clientMessageId: String(row.client_message_id || ""),
    senderType: String(row.sender_type || ""),
    text: String(row.message_text || ""),
    createdAt: iso(row.created_at),
    purgeAt: iso(row.purge_at)
  };
}

function createYdbChatStore(sql) {
  if (typeof sql !== "function") throw new Error("ydb_query_client_required");
  return {
    async createConversation(row) {
      await executeWrite(sql, [
        "$existing = SELECT conversation_id FROM candidate_employer_conversations WHERE candidate_profile_id = ", " AND conversation_id = ", "; INSERT INTO candidate_employer_conversations (candidate_profile_id, conversation_id, invitation_id, employer_id, organization_id, organization_name, candidate_alias, role_title, conversation_state, candidate_unread_count, employer_unread_count, last_message_at, created_at, updated_at, purge_at) SELECT ", " AS candidate_profile_id, ", " AS conversation_id, ", " AS invitation_id, ", " AS employer_id, ", " AS organization_id, ", " AS organization_name, ", " AS candidate_alias, ", " AS role_title, ", " AS conversation_state, CAST(", " AS Uint32) AS candidate_unread_count, CAST(", " AS Uint32) AS employer_unread_count, CAST(", " AS Timestamp) AS last_message_at, CAST(", " AS Timestamp) AS created_at, CAST(", " AS Timestamp) AS updated_at, CAST(", " AS Timestamp) AS purge_at WHERE NOT EXISTS($existing);"
      ], [row.candidateProfileId, row.conversationId, row.candidateProfileId, row.conversationId, row.invitationId, row.employerId, row.organizationId, row.organizationName, row.candidateAlias, row.roleTitle, row.state, row.candidateUnreadCount, row.employerUnreadCount, row.lastMessageAt, row.createdAt, row.updatedAt, row.purgeAt]);
      return this.getCandidateConversation(row.candidateProfileId, row.conversationId);
    },

    async listCandidateConversations(profileId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_employer_conversations WHERE candidate_profile_id = ", " ORDER BY updated_at DESC LIMIT 100;"], [profileId]);
      return rowsFrom(sets).map(mapConversation).filter(Boolean);
    },

    async listEmployerConversations(employerId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_employer_conversations VIEW employer_conversations WHERE employer_id = ", " ORDER BY updated_at DESC LIMIT 100;"], [employerId]);
      return rowsFrom(sets).map(mapConversation).filter(Boolean);
    },

    async getCandidateConversation(profileId, conversationId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_employer_conversations WHERE candidate_profile_id = ", " AND conversation_id = ", " LIMIT 1;"], [profileId, conversationId]);
      return mapConversation(rowsFrom(sets)[0]);
    },

    async getEmployerConversation(employerId, conversationId) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_employer_conversations VIEW employer_conversations WHERE employer_id = ", " AND conversation_id = ", " LIMIT 1;"], [employerId, conversationId]);
      return mapConversation(rowsFrom(sets)[0]);
    },

    async listConversationMessages(conversationId, limit) {
      const sets = await executeRead(sql, ["SELECT * FROM candidate_employer_messages WHERE conversation_id = ", " ORDER BY message_id DESC LIMIT ", ";"], [conversationId, Number(limit)]);
      return rowsFrom(sets).map(mapMessage).filter(Boolean).reverse();
    },

    async writeMessage(row) {
      const candidateIncrement = row.senderType === "employer" ? 1 : 0;
      const employerIncrement = row.senderType === "candidate" ? 1 : 0;
      await executeWrite(sql, [
        "$existing = SELECT message_id FROM candidate_employer_messages WHERE conversation_id = ", " AND message_id = ", "; INSERT INTO candidate_employer_messages (conversation_id, message_id, client_message_id, sender_type, message_text, created_at, purge_at) SELECT ", " AS conversation_id, ", " AS message_id, ", " AS client_message_id, ", " AS sender_type, ", " AS message_text, CAST(", " AS Timestamp) AS created_at, CAST(", " AS Timestamp) AS purge_at WHERE NOT EXISTS($existing); UPDATE candidate_employer_conversations SET candidate_unread_count = candidate_unread_count + CAST(", " AS Uint32), employer_unread_count = employer_unread_count + CAST(", " AS Uint32), last_message_at = CAST(", " AS Timestamp), updated_at = CAST(", " AS Timestamp), purge_at = CAST(", " AS Timestamp) WHERE candidate_profile_id = ", " AND conversation_id = ", " AND conversation_state = ", " AND NOT EXISTS($existing);"
      ], [row.conversationId, row.messageId, row.conversationId, row.messageId, row.clientMessageId, row.senderType, row.text, row.createdAt, row.purgeAt, candidateIncrement, employerIncrement, row.createdAt, row.createdAt, row.purgeAt, row.candidateProfileId, row.conversationId, "open"]);
      return mapMessage({ conversation_id: row.conversationId, message_id: row.messageId, client_message_id: row.clientMessageId, sender_type: row.senderType, message_text: row.text, created_at: row.createdAt, purge_at: row.purgeAt });
    },

    async markConversationRead(profileId, conversationId, viewerType, updatedAt) {
      const column = viewerType === "candidate" ? "candidate_unread_count" : "employer_unread_count";
      const identityColumn = viewerType === "candidate" ? "candidate_profile_id" : "employer_id";
      await executeWrite(sql, ["UPDATE candidate_employer_conversations SET " + column + " = CAST(0 AS Uint32), updated_at = CAST(", " AS Timestamp) WHERE " + identityColumn + " = ", " AND conversation_id = ", ";"], [updatedAt, profileId, conversationId]);
    },

    async setConversationState(profileId, conversationId, viewerType, state, updatedAt, purgeAt) {
      const identityColumn = viewerType === "candidate" ? "candidate_profile_id" : "employer_id";
      await executeWrite(sql, ["UPDATE candidate_employer_conversations SET conversation_state = ", ", updated_at = CAST(", " AS Timestamp), purge_at = CAST(", " AS Timestamp) WHERE " + identityColumn + " = ", " AND conversation_id = ", ";"], [state, updatedAt, purgeAt, profileId, conversationId]);
    },

    async deleteCandidateChats(profileId) {
      const conversations = await this.listCandidateConversations(profileId);
      for (const conversation of conversations) {
        await executeWrite(sql, ["DELETE FROM candidate_employer_messages WHERE conversation_id = ", ";"], [conversation.conversationId]);
      }
      await executeWrite(sql, ["DELETE FROM candidate_employer_conversations WHERE candidate_profile_id = ", ";"], [profileId]);
    }
  };
}

module.exports = { createYdbChatStore, mapConversation, mapMessage };
