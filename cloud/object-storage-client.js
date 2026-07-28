"use strict";

const crypto = require("node:crypto");

const STORAGE_ORIGIN = "https://storage.yandexcloud.net";
const METADATA_TOKEN_URL = "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_OBJECT_BYTES = 2 * 1024 * 1024;

function validateBucketName(value) {
  const bucket = String(value || "");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes("..")) throw new Error("invalid_storage_bucket");
  return bucket;
}

function validateObjectKey(value) {
  const key = String(value || "");
  if (!key || key.length > 1024 || key.startsWith("/") || key.endsWith("/") || key.includes("\\") || key.includes("//") ||
      key.split("/").some(segment => !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) {
    throw new Error("invalid_storage_object_key");
  }
  return key;
}

function objectUrl(bucket, key) {
  return STORAGE_ORIGIN + "/" + encodeURIComponent(validateBucketName(bucket)) + "/" +
    validateObjectKey(key).split("/").map(encodeURIComponent).join("/");
}

async function withTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    return await fetchImpl(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

function contextToken(context) {
  const token = context && context.token && context.token.access_token;
  return typeof token === "string" && token.length > 20 ? token : "";
}

async function fetchMetadataToken(fetchImpl) {
  const response = await withTimeout(fetchImpl, METADATA_TOKEN_URL, {
    method: "GET",
    headers: { "Metadata-Flavor": "Google" }
  }, 2000);
  if (!response || !response.ok) throw new Error("storage_identity_unavailable");
  const body = await response.json();
  const token = body && body.access_token;
  if (typeof token !== "string" || token.length < 20) throw new Error("storage_identity_unavailable");
  return token;
}

function createObjectStorageClient(options) {
  const settings = options || {};
  const bucket = validateBucketName(settings.bucket);
  const fetchImpl = settings.fetchImpl || globalThis.fetch;
  const maxObjectBytes = Number(settings.maxObjectBytes || DEFAULT_MAX_OBJECT_BYTES);
  if (typeof fetchImpl !== "function") throw new Error("storage_fetch_required");
  if (!Number.isInteger(maxObjectBytes) || maxObjectBytes < 1 || maxObjectBytes > 20 * 1024 * 1024) throw new Error("invalid_storage_object_limit");

  async function tokenFor(context) {
    return contextToken(context) || fetchMetadataToken(fetchImpl);
  }

  async function request(method, key, context, body, extraHeaders) {
    const token = await tokenFor(context);
    const headers = Object.assign({ Authorization: "Bearer " + token }, extraHeaders || {});
    const response = await withTimeout(fetchImpl, objectUrl(bucket, key), { method, headers, body }, DEFAULT_TIMEOUT_MS);
    return response;
  }

  return {
    async readText(key, context) {
      const response = await request("GET", key, context);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("storage_read_failed");
      const length = Number(response.headers && response.headers.get && response.headers.get("content-length"));
      if (Number.isFinite(length) && length > maxObjectBytes) throw new Error("storage_object_too_large");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxObjectBytes) throw new Error("storage_object_too_large");
      return buffer.toString("utf8");
    },

    async readJson(key, context) {
      const text = await this.readText(key, context);
      if (text === null) return null;
      try {
        return JSON.parse(text);
      } catch (_error) {
        throw new Error("storage_json_invalid");
      }
    },

    async writeText(key, text, context, options) {
      const body = Buffer.from(String(text), "utf8");
      if (body.length > maxObjectBytes) throw new Error("storage_object_too_large");
      const config = options || {};
      const response = await request("PUT", key, context, body, {
        "Content-Type": String(config.contentType || "text/plain; charset=utf-8"),
        "Content-Length": String(body.length),
        "X-Amz-Checksum-Sha256": crypto.createHash("sha256").update(body).digest("base64"),
        ...(config.createOnly === true ? { "If-None-Match": "*" } : {})
      });
      if (config.createOnly === true && response.status === 412) return { created: false };
      if (!response.ok) throw new Error("storage_write_failed");
      return { created: true };
    },

    async writeJson(key, value, context, options) {
      return this.writeText(key, JSON.stringify(value), context, Object.assign({}, options, { contentType: "application/json; charset=utf-8" }));
    },

    async deleteObject(key, context) {
      const response = await request("DELETE", key, context);
      if (!response.ok && response.status !== 404) throw new Error("storage_delete_failed");
      return true;
    }
  };
}

module.exports = {
  DEFAULT_MAX_OBJECT_BYTES,
  METADATA_TOKEN_URL,
  STORAGE_ORIGIN,
  contextToken,
  createObjectStorageClient,
  fetchMetadataToken,
  objectUrl,
  validateBucketName,
  validateObjectKey
};
