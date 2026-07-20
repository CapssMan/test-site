#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const candidate = fs.readFileSync(path.join(root, "test.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "apps-script", "appsscript.json"), "utf8"));
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");

function extractTopLevelFunction(source, name) {
  const marker = "function " + name + "(";
  const start = source.indexOf(marker);
  assert(start >= 0, "Function not found: " + name);
  const nextIndented = source.indexOf("\n    function ", start + marker.length);
  const nextBackend = source.indexOf("\nfunction ", start + marker.length);
  const ends = [nextIndented, nextBackend].filter(index => index >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : source.length).trim();
}

new vm.Script(backend, { filename: "Code.gs" });
["index.html", "test.html", "admin.html", "privacy.html"].forEach(fileName => {
  const source = fs.readFileSync(path.join(root, fileName), "utf8");
  assert.match(source, /http-equiv="Content-Security-Policy"/i, fileName + " needs CSP");
  assert.match(source, /object-src 'none'/);
  assert.match(source, /base-uri 'none'/);
  assert.match(source, /form-action 'self'/);
  assert.match(source, /<meta name="referrer" content="no-referrer">/i);
});

const doGet = extractTopLevelFunction(backend, "doGet");
const doPost = extractTopLevelFunction(backend, "doPost");
assert.doesNotMatch(doGet, /params\.callback|jsonOrJsonp|buildHealthStatus\(/, "GET must expose neither JSONP nor diagnostics");
assert.match(doGet, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/);
assert.match(doGet, /action === "beginAttempt" \|\| action === "saveResult"[\s\S]*methodNotAllowedResponse/);
assert.match(doPost, /action === "beginAttempt"/);
assert.match(doPost, /action === "saveResult"/);
assert.match(doPost, /action === "checkAttempt"[\s\S]*buildClientUpgradeRequiredResponse/);
assert.match(doPost, /unknown_action/);
assert.doesNotMatch(doPost, /error\.message|sanitizeDiagnosticMessage/, "public errors must not disclose internals");
assert.doesNotMatch(backend, /function\s+jsonOrJsonpResponse\b/);

const health = extractTopLevelFunction(backend, "buildPublicHealthStatus");
assert.doesNotMatch(health, /YANDEX|ADMIN_|ATTEMPT_|folder|path|storage|diagnostic/i, "public health is liveness only");
const unavailable = extractTopLevelFunction(backend, "buildAttemptUnavailableResponse");
assert.doesNotMatch(unavailable, /email|foundPrevious|daysLeft|nextDate|expired|revoked|retake|used/i);
assert.match(backend, /const PUBLIC_DEV_TEST_ENABLED = false;/);

// Every request allowlist must reject own keys which collide with Object.prototype.
// Using JSON.parse is important because an object literal treats __proto__ specially.
const allowlistContext = {};
vm.createContext(allowlistContext);
vm.runInContext(
  extractTopLevelFunction(backend, "publicRequestError") + "\n" +
  extractTopLevelFunction(backend, "isPlainObject") + "\n" +
  extractTopLevelFunction(backend, "assertAllowedObjectKeys") + "\n" +
  "this.__assertAllowed = assertAllowedObjectKeys;",
  allowlistContext,
  { filename: "Code.gs" }
);
vm.runInContext("__assertAllowed(JSON.parse('{\"safe\":1}'), ['safe'], 'fixture')", allowlistContext);
["__proto__", "constructor", "toString", "prototype"].forEach(key => {
  allowlistContext.__payloadJson = JSON.stringify({ safe: 1, [key]: "pollute" });
  assert.throws(
    () => vm.runInContext("__assertAllowed(JSON.parse(__payloadJson), ['safe'], 'fixture')", allowlistContext),
    error => Boolean(error && error.publicRequestError && error.failureCode === "unknown_field"),
    key + " must be rejected by the central request allowlist"
  );
});

const parserContext = {};
vm.createContext(parserContext);
vm.runInContext(
  "const MAX_POST_BODY_CHARS = 250000;\n" +
  extractTopLevelFunction(backend, "publicRequestError") + "\n" +
  extractTopLevelFunction(backend, "isPlainObject") + "\n" +
  extractTopLevelFunction(backend, "parseRequestBody") + "\n" +
  "this.__parse = parseRequestBody;",
  parserContext,
  { filename: "Code.gs" }
);
parserContext.__eventJson = JSON.stringify({ postData: { contents: '{"action":"health"}', type: "application/json", length: 19 } });
assert.equal(vm.runInContext("__parse(JSON.parse(__eventJson)).action", parserContext), "health");
parserContext.__eventJson = JSON.stringify({ postData: { contents: "[]", type: "application/json", length: 2 } });
assert.throws(() => vm.runInContext("__parse(JSON.parse(__eventJson))", parserContext));
parserContext.__eventJson = JSON.stringify({ postData: { contents: "x".repeat(250001), type: "text/plain", length: 250001 } });
assert.throws(() => vm.runInContext("__parse(JSON.parse(__eventJson))", parserContext));

const adminGuard = extractTopLevelFunction(backend, "guardAdminRequest");
assert(
  adminGuard.indexOf('consumeRateLimit("admin-auth-global"') < adminGuard.indexOf("isAdminPasswordValid(supplied)"),
  "global auth rate limit must precede password hashing"
);
const sanitizeAdmin = extractTopLevelFunction(backend, "sanitizeAdminResult");
assert.match(sanitizeAdmin, /SCORE_VERIFICATION_SERVER/);
assert.match(sanitizeAdmin, /AUTHORITATIVE_SCORING_VERSION/, "green verification requires the exact server algorithm");
assert.match(sanitizeAdmin, /BANK_VERSIONS_BY_ID\[testId\]/, "green verification requires the expected bank version");
const frontendAdminNormalize = extractTopLevelFunction(admin, "normalizeAdminRows");
assert.match(frontendAdminNormalize, /scoringAlgorithmVersion === "authoritative-v1"/);
assert.match(frontendAdminNormalize, /row\.bankVersion === BANK_VERSIONS\[testId\]/);

const privateLoader = extractTopLevelFunction(backend, "loadAuthoritativePrivateBank");
assert.match(privateLoader, /assertPrivateBankTrustAnchor|PRIVATE_BANK_DIGESTS_V1|privateBankDigest|trust anchor/i, "private answer key must be bound to a ScriptProperties trust anchor");
assert.match(privateLoader, /private bank is missing/i);
assert.doesNotMatch(privateLoader, /writeJsonToYandexDisk|writeRequiredJsonArray/, "normal private-bank read must fail closed, never create");

assert.match(backend, /const LEGACY_PUBLIC_BANK_COMMIT = "70e569cf267e043aabc780e81cc4307db7e149b1"/);
const legacyDigests = backend.match(/"(?:fa|ca|fpa|acc|bi)-junior": "[a-f0-9]{64}"|"dev-quick": "[a-f0-9]{64}"/g) || [];
assert.equal(legacyDigests.length, 6, "every immutable legacy bank needs an exact SHA-256 anchor");
const bootstrap = extractTopLevelFunction(backend, "bootstrapAuthoritativeBanksFromLegacyPages");
assert(bootstrap.indexOf("sha256Hex(sourceText)") < bootstrap.indexOf("JSON.parse(sourceText)"), "legacy bytes must be anchored before parsing");
assert.match(bootstrap, /lock\.waitLock\(30000\)/, "bootstrap must serialize with issuance changes");

const metadata = extractTopLevelFunction(backend, "getYandexResourceMetadata");
assert.match(metadata, /public_key,public_url,share/);
const privateShareGuard = extractTopLevelFunction(backend, "assertAuthoritativePrivateStorageNotShared");
["getReportsFolderPath", "getAdminFilePath", "getInvitesFilePath", "getAttemptSessionsFilePath", "getAttemptsFilePath", "getAuthoritativePrivateBankPath"]
  .forEach(name => assert.match(privateShareGuard, new RegExp(name), "share guard missing " + name));
assert.match(privateShareGuard, /metadata\.publicKey \|\| metadata\.publicUrl \|\| metadata\.shared/);
const authoritativeBegin = extractTopLevelFunction(backend, "beginAuthoritativeAttempt");
assert(authoritativeBegin.indexOf("lockAcquired = true") < authoritativeBegin.indexOf('getScriptProperty("ATTEMPT_ISSUANCE_ENABLED")'), "begin gate must be rechecked after acquiring the lock");
const internalInvite = extractTopLevelFunction(backend, "issuePilotInviteInternal");
assert(internalInvite.indexOf('getScriptProperty("ATTEMPT_ISSUANCE_ENABLED")') < internalInvite.indexOf("writeRequiredJsonArray"), "invite gate must be checked inside the locked writer");
const authoritativeSave = extractTopLevelFunction(backend, "saveAuthoritativeTestResult");
assert(authoritativeSave.indexOf("assertAuthoritativePrivateStorageNotShared(data.testId)") < authoritativeSave.indexOf("uploadTextToYandexDisk"), "share state must be rechecked before PII/report writes");

assert.deepEqual(
  manifest.oauthScopes.slice().sort(),
  ["https://www.googleapis.com/auth/script.external_request", "https://www.googleapis.com/auth/script.storage"].sort()
);
assert.equal(manifest.webapp.executeAs, "USER_DEPLOYING");
assert.equal(manifest.webapp.access, "ANYONE_ANONYMOUS");
assert.match(gitignore, /^apps-script\/\.clasp\.json$/m);
assert.match(gitignore, /^\.env$/m);
assert.match(gitignore, /^token\*\.json$/m);

assert.doesNotMatch(candidate, /localStorage\.setItem\([^\n]*(?:attemptToken|inviteCode|email|answers|browserFingerprint)/i);
assert.doesNotMatch(
  extractTopLevelFunction(backend, "saveAuthoritativeTestResult"),
  /console\.(?:log|error)\([^\n]*(?:email|telegram|browserFingerprint|attemptToken|answers)/i
);

console.log("Security tests passed: transport/CSP, neutral APIs, prototype-safe allowlists, admin verification and private-key anchor.");
