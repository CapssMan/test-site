"use strict";

const crypto = require("node:crypto");

const CHAT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_CHARS = 2000;
const MAX_MESSAGE_PAGE = 100;
const CONVERSATION_STATES = new Set(["open", "archived", "blocked"]);

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(label + "_invalid");
  const expected = new Set(allowed);
  if (Object.keys(value).some(key => !expected.has(key))) throw new Error(label + "_invalid");
}

function validateConversationId(value) {
  const id = String(value || "");
  if (!/^conv_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_chat_request");
  return id;
}

function validateInvitationId(value) {
  const id = String(value || "");
  if (!/^inv_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_chat_request");
  return id;
}

function validateClientMessageId(value) {
  const id = String(value || "");
  if (!/^chat_req_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_chat_request");
  return id;
}

function containsContactDetails(value) {
  const text = String(value || "");
  return /(?:[\w.+-]+@[\w.-]+\.[a-zа-я]{2,}|(?:\+?7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}|(?:t\.me|telegram\.me|wa\.me)\/|@[a-z0-9_]{5,})/iu.test(text);
}

function validateMessageText(value, contactsEnabled) {
  const text = String(value || "").trim().replace(/\r\n?/g, "\n");
  if (!text || text.length > MAX_MESSAGE_CHARS || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error("invalid_chat_message");
  if (!contactsEnabled && containsContactDetails(text)) throw new Error("contact_sharing_closed");
  return text;
}

function createConversationId(secret, invitationId) {
  validateInvitationId(invitationId);
  if (String(secret || "").length < 32) throw new Error("chat_secret_required");
  return "conv_" + crypto.createHmac("sha256", String(secret)).update("employer-chat-v1|" + invitationId).digest("hex").slice(0, 32);
}

function createMessageId(secret, conversationId, senderType, clientMessageId) {
  validateConversationId(conversationId);
  validateClientMessageId(clientMessageId);
  if (String(secret || "").length < 32 || !["candidate", "employer"].includes(senderType)) throw new Error("chat_secret_required");
  return "msg_" + crypto.createHmac("sha256", String(secret)).update("chat-message-v1|" + conversationId + "|" + senderType + "|" + clientMessageId).digest("hex").slice(0, 32);
}

function validateChatAction(value, apiVersion, contactsEnabled) {
  const common = ["action", "apiVersion"];
  if (!isPlainObject(value) || value.apiVersion !== apiVersion) throw new Error("invalid_request");
  if (value.action === "listConversations") {
    assertAllowedKeys(value, common, "chat_list");
    return { type: "listConversations" };
  }
  if (value.action === "listMessages") {
    assertAllowedKeys(value, common.concat(["conversationId", "limit"]), "chat_messages");
    const limit = Number.parseInt(String(value.limit == null ? 50 : value.limit), 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MESSAGE_PAGE) throw new Error("invalid_chat_request");
    return { type: "listMessages", conversationId: validateConversationId(value.conversationId), limit };
  }
  if (value.action === "sendMessage") {
    assertAllowedKeys(value, common.concat(["conversationId", "clientMessageId", "text"]), "chat_send");
    return { type: "sendMessage", conversationId: validateConversationId(value.conversationId), clientMessageId: validateClientMessageId(value.clientMessageId), text: validateMessageText(value.text, contactsEnabled) };
  }
  if (value.action === "markConversationRead") {
    assertAllowedKeys(value, common.concat(["conversationId"]), "chat_read");
    return { type: "markConversationRead", conversationId: validateConversationId(value.conversationId) };
  }
  if (value.action === "setConversationState") {
    assertAllowedKeys(value, common.concat(["conversationId", "state"]), "chat_state");
    const state = String(value.state || "");
    if (!CONVERSATION_STATES.has(state)) throw new Error("invalid_chat_request");
    return { type: "setConversationState", conversationId: validateConversationId(value.conversationId), state };
  }
  throw new Error("invalid_request");
}

function publicConversation(row, viewerType) {
  return {
    conversationId: String(row.conversationId || ""),
    invitationId: String(row.invitationId || ""),
    organizationName: String(row.organizationName || ""),
    candidateAlias: String(row.candidateAlias || ""),
    roleTitle: String(row.roleTitle || ""),
    state: String(row.state || "open"),
    unreadCount: Number(viewerType === "candidate" ? row.candidateUnreadCount : row.employerUnreadCount) || 0,
    lastMessageAt: String(row.lastMessageAt || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || "")
  };
}

function publicMessage(row) {
  return {
    messageId: String(row.messageId || ""),
    senderType: String(row.senderType || ""),
    text: String(row.text || ""),
    createdAt: String(row.createdAt || "")
  };
}

module.exports = {
  CHAT_RETENTION_MS,
  CONVERSATION_STATES,
  MAX_MESSAGE_CHARS,
  containsContactDetails,
  createConversationId,
  createMessageId,
  publicConversation,
  publicMessage,
  validateChatAction,
  validateConversationId,
  validateMessageText
};
