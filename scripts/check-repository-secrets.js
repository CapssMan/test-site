#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" }
).split("\0").filter(Boolean).sort();
const textExtension = /\.(?:css|gs|html|js|json|md|txt|ya?ml)$/i;
const forbiddenFileName = /(?:^|\/)(?:\.env(?:\..+)?|\.clasp\.json|credentials[^/]*\.json|client_secret[^/]*\.json|token[^/]*\.json|secrets?(?:\.[^/]+)?)$/i;
const highConfidencePatterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "Google OAuth token", regex: /ya29\.[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "Google API key", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "AWS access key", regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/ },
  { name: "Yandex OAuth bearer", regex: /OAuth\s+[A-Za-z0-9._~+\/-]{35,}={0,2}/ },
  { name: "credential in URL", regex: /[?&](?:access_token|oauth_token|api_key|client_secret)=[A-Za-z0-9._~+\/-]{16,}/i }
];
const literalPropertyPattern = /\b(?:YANDEX_DISK_TOKEN|ADMIN_PASSWORD|ATTEMPT_HASH_SALT|ATTEMPT_SIGNING_SECRET_V1|INVITE_CODE_SECRET_V1|IDENTITY_HASH_SECRET_V1)\b\s*[:=]\s*["'`]([^"'`\r\n]{24,})["'`]/g;

function shannonEntropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

let scannedTextFiles = 0;
files.forEach(fileName => {
  const normalized = fileName.replace(/\\/g, "/");
  assert(!forbiddenFileName.test(normalized), "Credential-like file must not be committed: " + fileName);
  assert(!/(?:^|\/)private-banks(?:\/|$)/i.test(normalized), "Private banks must not be committed: " + fileName);
  if (!textExtension.test(fileName)) return;
  const absolutePath = path.join(root, fileName);
  const text = fs.readFileSync(absolutePath, "utf8");
  scannedTextFiles++;
  highConfidencePatterns.forEach(pattern => {
    assert(!pattern.regex.test(text), fileName + " contains a high-confidence " + pattern.name + " pattern");
  });
  for (const match of text.matchAll(literalPropertyPattern)) {
    const value = match[1];
    assert(
      shannonEntropy(value) < 4.3,
      fileName + " appears to assign a high-entropy value to a protected Script Property"
    );
  }
});

console.log("Repository secret scan passed: " + files.length + " files, " + scannedTextFiles + " text files.");
