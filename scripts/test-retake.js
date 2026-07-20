const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backend = fs.readFileSync(path.join(root, "apps-script", "Code.gs"), "utf8");
const frontend = fs.readFileSync(path.join(root, "test.html"), "utf8");

function extractFunction(source, name) {
  const pattern = new RegExp("function\\s+" + name + "\\s*\\(");
  const match = pattern.exec(source);
  assert(match, "Function not found: " + name);

  const start = match.index;
  const openingBrace = source.indexOf("{", start);
  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error("Function end not found: " + name);
}

const fixedNow = Date.parse("2026-07-20T12:00:00.000Z");
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }

  static now() {
    return fixedNow;
  }
}

const backendContext = {
  Date: FixedDate,
  isFinite,
  currentAttempts: [],
  getRequiredProperty(name) {
    assert.equal(name, "ATTEMPT_HASH_SALT");
    return "stage-3-test-salt";
  },
  getAttemptsFilePath() {
    return "disk:/skillcheck/private/attempts.json";
  },
  readJsonFromYandexDisk() {
    return backendContext.currentAttempts;
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest(_algorithm, source) {
      return Array.from(crypto.createHash("sha256").update(source, "utf8").digest())
        .map(value => value > 127 ? value - 256 : value);
    }
  }
};

const backendFunctions = [
  "hashAttemptValue",
  "sha256Hex",
  "hashAttempt",
  "hashAttemptIdentifiers",
  "checkAttemptHash"
].map(name => extractFunction(backend, name)).join("\n");

vm.runInNewContext(
  "const RETAKE_WINDOW_DAYS = 21;\n" +
  "const RETAKE_WINDOW_MS = RETAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;\n" +
  "const RETAKE_BYPASS_TEST_IDS = { \"dev-quick\": true };\n" +
  backendFunctions,
  backendContext
);

const testId = "fa-junior";
const email = "stage3@example.test";
const fingerprint = "stage3-browser";

backendContext.currentAttempts = [];
assert.equal(backendContext.checkAttemptHash(testId, email, fingerprint).allowed, true, "first attempt");

const recentDate = new FixedDate(fixedNow - 24 * 60 * 60 * 1000).toISOString();
const recentHashes = backendContext.hashAttemptIdentifiers(testId, email, fingerprint);
backendContext.currentAttempts = [{
  ...recentHashes,
  testId,
  code: "FA-STAGE3",
  date: recentDate,
  status: "failed"
}];

const blocked = backendContext.checkAttemptHash(testId, email, "another-browser");
assert.equal(blocked.allowed, false, "same test and email must be blocked");
assert(!blocked.message.includes("через 21 день"), "backend message must not contain a stale fixed countdown");
assert.equal(Object.hasOwn(blocked, "nextDate"), false, "backend must not disclose an exact retake date");
assert.equal(blocked.daysLeft, 20);
assert.equal(
  backendContext.checkAttemptHash(testId, "another@example.test", fingerprint).allowed,
  false,
  "same test and fingerprint must be blocked"
);
assert.equal(
  backendContext.checkAttemptHash("ca-junior", email, fingerprint).allowed,
  true,
  "another test must remain available"
);
assert.equal(
  backendContext.checkAttemptHash("dev-quick", email, fingerprint).allowed,
  true,
  "dev-quick must bypass retake"
);

backendContext.currentAttempts = [{
  ...recentHashes,
  testId,
  code: "FA-EXPIRED",
  date: new FixedDate(fixedNow - 21 * 24 * 60 * 60 * 1000).toISOString(),
  status: "failed"
}];
assert.equal(
  backendContext.checkAttemptHash(testId, email, fingerprint).allowed,
  true,
  "attempt at least 21 days old must not block"
);

const storage = new Map();
const frontendContext = {
  Date: FixedDate,
  isNaN,
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

const frontendFunctions = [
  "sanitizeLegacyRetakeMarkers",
  "formatBlockedAttemptMessage",
  "getLocalRetakeLock",
  "getAttemptStorageKey",
  "formatDateForUser"
].map(name => extractFunction(frontend, name)).join("\n");
vm.runInNewContext(
  'const TEST_CONFIG = {"fa-junior":{},"ca-junior":{}};\n' + frontendFunctions,
  frontendContext
);

const expectedNextDate = new FixedDate(Date.parse(recentDate) + 21 * 24 * 60 * 60 * 1000).toISOString();
const expectedDate = new FixedDate(expectedNextDate).toLocaleDateString("ru-RU");
const blockedMessage = frontendContext.formatBlockedAttemptMessage(blocked);
assert(blockedMessage.includes("20 дн."), "frontend must show remaining days");
assert(!blockedMessage.includes("Точная дата"), "frontend must not invent an exact date absent from backend response");

const localKey = frontendContext.getAttemptStorageKey(testId);
const legacyCompletedAt = new FixedDate(fixedNow - 24 * 60 * 60 * 1000).toISOString();
storage.set(localKey, JSON.stringify({
  testId,
  completedAt: legacyCompletedAt,
  nextAttemptAt: expectedNextDate,
  browserFingerprint: "legacy-fingerprint",
  email: "legacy@example.test"
}));
storage.set("skillcheck_attempt_ca-junior", "not-json");
frontendContext.sanitizeLegacyRetakeMarkers();
const sanitizedMarker = JSON.parse(storage.get(localKey));
assert.deepEqual(Object.keys(sanitizedMarker).sort(), ["completedAt", "nextAttemptAt", "testId"], "legacy marker must be rewritten without fingerprint or email");
assert.equal(storage.has("skillcheck_attempt_ca-junior"), false, "invalid legacy marker must be removed");
const sanitizedRaw = storage.get(localKey);
frontendContext.sanitizeLegacyRetakeMarkers();
assert.equal(storage.get(localKey), sanitizedRaw, "legacy-marker sanitization must be idempotent");

storage.set(localKey, JSON.stringify({
  testId,
  completedAt: new FixedDate(fixedNow - 24 * 60 * 60 * 1000).toISOString(),
  nextAttemptAt: expectedNextDate,
  browserFingerprint: "local-hash"
}));
const localBlock = frontendContext.getLocalRetakeLock(testId);
assert.equal(localBlock.blocked, true, "active localStorage lock must block");
assert(localBlock.message.includes(expectedDate), "localStorage message must show exact date");

storage.set(localKey, JSON.stringify({
  testId,
  nextAttemptAt: new FixedDate(fixedNow - 1).toISOString()
}));
assert.equal(frontendContext.getLocalRetakeLock(testId), null, "expired localStorage lock must not block");
assert.equal(storage.has(localKey), false, "expired localStorage lock must be removed");

const attemptWriter = extractFunction(backend, "saveAttemptHash");
assert(!/\bemail\s*:/.test(attemptWriter), "attempts.json must not store raw email");
assert(!/telegram/i.test(attemptWriter), "attempts.json must not store Telegram");
assert(!/browserFingerprint\s*:/.test(attemptWriter), "attempts.json must not store raw browser parameters");
assert(/emailHash/.test(attemptWriter) && /fingerprintHash/.test(attemptWriter), "attempts.json must store hashes");
assert.doesNotMatch(extractFunction(frontend, "saveLocalAttemptLock"), /browserFingerprint\s*:/, "new local retake markers must not store a raw browser fingerprint");
assert.match(frontend, /DOMContentLoaded[\s\S]{0,500}sanitizeLegacyRetakeMarkers\(\)/, "legacy retake markers must be sanitized during startup");
assert(/\"dev-quick\"[\s\S]*?skipRetakeCheck:\s*true/.test(frontend), "dev-quick frontend bypass is missing");

console.log("Retake stage checks: OK");
