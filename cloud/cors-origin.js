"use strict";

const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://capssman.github.io",
  "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
]);

function parseAllowedOrigins(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[;,\s]+/);
  const origins = Array.from(new Set(raw.map(item => String(item || "").trim()).filter(Boolean)));
  const result = origins.length ? origins : DEFAULT_ALLOWED_ORIGINS.slice();
  if (result.length > 10 || result.some(origin => {
    if (origin === "*") return true;
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== "https:" || parsed.origin !== origin || parsed.pathname !== "/";
    } catch (_error) {
      return true;
    }
  })) throw new Error("invalid_allowed_origin");
  return result;
}

function getRequestOrigin(event) {
  const headers = event && event.headers;
  if (!headers || typeof headers !== "object") return "";
  const key = Object.keys(headers).find(name => String(name).toLowerCase() === "origin");
  return key ? String(headers[key] || "").trim() : "";
}

function resolveAllowedOrigin(event, configuredOrigins) {
  const origins = parseAllowedOrigins(configuredOrigins);
  const requestOrigin = getRequestOrigin(event);
  return origins.includes(requestOrigin) ? requestOrigin : origins[0];
}

function readAllowedOriginsFromEnvironment(environment) {
  const source = environment || {};
  return parseAllowedOrigins(source.ALLOWED_ORIGINS || source.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGINS);
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  getRequestOrigin,
  parseAllowedOrigins,
  readAllowedOriginsFromEnvironment,
  resolveAllowedOrigin
};
