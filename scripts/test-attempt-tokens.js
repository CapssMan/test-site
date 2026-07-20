#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backendPath = path.join(root, "apps-script", "Code.gs");
const backend = fs.readFileSync(backendPath, "utf8");
const secret = "stage10a-test-secret-" + "5a".repeat(32);

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

function webSafeBase64(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeWebSafeText(value) {
  const standard = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(standard, "base64").toString("utf8");
}

function signSegments(header, claims, signingSecret = secret) {
  const encodedHeader = webSafeBase64(JSON.stringify(header)).replace(/=+$/g, "");
  const encodedClaims = webSafeBase64(JSON.stringify(claims)).replace(/=+$/g, "");
  const signingInput = encodedHeader + "." + encodedClaims;
  const signature = crypto.createHmac("sha256", signingSecret).update(signingInput, "utf8").digest();
  return signingInput + "." + webSafeBase64(signature).replace(/=+$/g, "");
}

const Utilities = {
  Charset: { UTF_8: "UTF-8" },
  computeHmacSha256Signature(value, key) {
    return Array.from(crypto.createHmac("sha256", String(key)).update(String(value), "utf8").digest());
  },
  base64EncodeWebSafe(value) {
    if (typeof value === "string") return webSafeBase64(Buffer.from(value, "utf8"));
    return webSafeBase64(Buffer.from(Array.from(value, byte => Number(byte) & 255)));
  },
  base64DecodeWebSafe(value) {
    const standard = String(value).replace(/-/g, "+").replace(/_/g, "/");
    return Array.from(Buffer.from(standard, "base64"));
  },
  newBlob(bytes) {
    return {
      getDataAsString() {
        return Buffer.from(Array.from(bytes, byte => Number(byte) & 255)).toString("utf8");
      }
    };
  }
};

const tokenContext = {
  Utilities,
  Date,
  String,
  Number,
  Boolean,
  Array,
  Object,
  JSON,
  Math,
  isFinite,
  PRIVACY_CONSENT_VERSION: "skillcheck-pd-consent-2026-07-20-v1",
  getRequiredProperty(name) {
    assert.equal(name, "ATTEMPT_SIGNING_SECRET_V1");
    return secret;
  }
};
vm.createContext(tokenContext);
const tokenFunctions = [
  "hmacSha256Bytes", "base64UrlEncodeText", "base64UrlEncodeBytes", "base64UrlDecodeText",
  "timingSafeEqual", "isPlainObject", "buildAttemptToken", "verifyAttemptToken"
];
vm.runInContext(
  tokenFunctions.map(name => extractTopLevelFunction(backend, name)).join("\n\n") +
    "\nthis.__tokenApi = { buildAttemptToken, verifyAttemptToken, timingSafeEqual };",
  tokenContext,
  { filename: backendPath }
);

const api = tokenContext.__tokenApi;
const nowSeconds = Math.floor(Date.now() / 1000);
const session = {
  attemptId: "att_" + "a".repeat(32),
  inviteId: "inv_" + "b".repeat(32),
  testId: "fa-junior",
  bankVersion: "FA Junior v3.0",
  questionSetHash: "c".repeat(64),
  privacyConsentVersion: "skillcheck-pd-consent-2026-07-20-v1",
  tokenJti: "d".repeat(32),
  tokenNonce: "d".repeat(32),
  tokenIssuedAt: new Date((nowSeconds - 30) * 1000).toISOString(),
  tokenExpiresAt: new Date((nowSeconds + 300) * 1000).toISOString()
};

const token = api.buildAttemptToken(session);
assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "token must have three web-safe segments");
const verified = api.verifyAttemptToken(token);
assert.equal(verified.valid, true, "fresh token must verify");
assert.deepEqual(
  JSON.parse(JSON.stringify(verified.header)),
  { alg: "HS256", kid: "attempt-v2", typ: "SC-ATTEMPT" },
  "header must be fixed"
);
assert.deepEqual(
  Object.keys(verified.claims),
  ["v", "attemptId", "jti", "tid", "bv", "qsh", "pcv", "iat", "exp"],
  "token claims must use the fixed minimal allowlist"
);
assert.equal(verified.claims.attemptId, session.attemptId, "token must bind the full attemptId claim");
assert.equal(verified.claims.jti, session.tokenJti, "token must contain a persistent unique jti");
assert.equal(verified.claims.tid, session.testId, "token must bind the test");
assert.equal(verified.claims.bv, session.bankVersion, "token must bind the bank version");
assert.equal(verified.claims.qsh, session.questionSetHash, "token must bind the exact question manifest");
assert.equal(verified.claims.pcv, session.privacyConsentVersion, "token must bind the exact privacy consent version");

["", "one", "one.two", "one.two.three.four", "***.two.three", "one..three"].forEach(malformed => {
  assert.equal(api.verifyAttemptToken(malformed).valid, false, `malformed token must fail: ${JSON.stringify(malformed)}`);
});

const segments = token.split(".");
const header = JSON.parse(decodeWebSafeText(segments[0]));
const claims = JSON.parse(decodeWebSafeText(segments[1]));

const tamperedClaims = { ...claims, testId: "ca-junior" };
const unsignedTamper = segments[0] + "." + webSafeBase64(JSON.stringify(tamperedClaims)).replace(/=+$/g, "") + "." + segments[2];
assert.equal(api.verifyAttemptToken(unsignedTamper).valid, false, "claim tampering must invalidate the signature");

const signatureTamper = segments.slice();
signatureTamper[2] = signatureTamper[2].slice(0, -1) + (signatureTamper[2].endsWith("A") ? "B" : "A");
assert.equal(api.verifyAttemptToken(signatureTamper.join(".")).valid, false, "signature tampering must fail");

assert.equal(
  api.verifyAttemptToken(signSegments({ ...header, alg: "none" }, claims)).valid,
  false,
  "alg substitution must fail even with a correctly recomputed HMAC"
);
assert.equal(
  api.verifyAttemptToken(signSegments({ ...header, kid: "attempt-v1" }, claims)).valid,
  false,
  "unknown signing key id must fail"
);
assert.equal(
  api.verifyAttemptToken(signSegments(header, claims, "wrong-secret")).valid,
  false,
  "a signature from another key must fail"
);

const expiredClaims = { ...claims, iat: nowSeconds - 7200, exp: nowSeconds - 3600 };
assert.equal(api.verifyAttemptToken(signSegments(header, expiredClaims)).valid, false, "expired token must fail verification");
const futureClaims = { ...claims, iat: nowSeconds + 3600, exp: nowSeconds + 7200 };
assert.equal(api.verifyAttemptToken(signSegments(header, futureClaims)).valid, false, "not-yet-valid token must fail verification");
assert.equal(api.verifyAttemptToken(signSegments(header, { ...claims, exp: claims.iat })).valid, false, "non-positive lifetime must fail");

assert.equal(api.timingSafeEqual("same", "same"), true);
assert.equal(api.timingSafeEqual("same", "different"), false);
assert.match(extractTopLevelFunction(backend, "timingSafeEqual"), /difference\s*\|=/, "signature comparison must accumulate differences");
assert.doesNotMatch(extractTopLevelFunction(backend, "verifyAttemptToken"), /===\s*segments\[2\]|segments\[2\]\s*===/, "signature comparison must not use direct equality");

const beginSource = extractTopLevelFunction(backend, "beginAuthoritativeAttempt");
assert.match(beginSource, /readRequiredJsonArray\(getAttemptSessionsFilePath\(\)/, "attempt creation must load persistent sessions");
assert.match(beginSource, /writeRequiredJsonArray\(getAttemptSessionsFilePath\(\)/, "attempt creation must persist sessions");
assert.doesNotMatch(beginSource, /CacheService/, "single-use attempt state must not rely on CacheService");
assert.doesNotMatch(extractTopLevelFunction(backend, "verifyAttemptToken"), /CacheService/, "token verification must not rely on CacheService");

console.log("Stage 10A attempt-token tests passed (signature, claims, expiry, tamper and persistence boundary).");
