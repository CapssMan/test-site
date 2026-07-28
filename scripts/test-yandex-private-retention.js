"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "cloud", "private-bucket-lifecycle.json"), "utf8"));
const script = fs.readFileSync(path.join(__dirname, "deploy-yandex-private-retention.ps1"), "utf8");

const normalized = Object.fromEntries(config.lifecycleRules.map(rule => [rule.id, rule]));
assert.equal(config.lifecycleRules.length, 5);
assert.equal(normalized["expire-assessment-reports-365d"].filter.prefix, "reports/");
assert.equal(Number(normalized["expire-assessment-reports-365d"].expiration.days), 365);
assert.equal(normalized["expire-deletion-backups-30d"].filter.prefix, "deletion-backups/");
assert.equal(Number(normalized["expire-deletion-backups-30d"].expiration.days), 30);
assert.equal(Number(normalized["expire-function-packages-1d"].expiration.days), 1);
assert.equal(Number(normalized["expire-bank-staging-1d"].expiration.days), 1);
assert.equal(Number(normalized["abort-incomplete-multipart-1d"].abortIncompleteMultipartUpload.daysAfterExpiration), 1);
assert.ok(config.lifecycleRules.every(rule => rule.enabled === true));

assert.match(script, /--lifecycle-rules-from-file/);
assert.match(script, /Assert-BucketBoundary \$before/);
assert.match(script, /Assert-BucketBoundary \$after/);
assert.match(script, /Assert-ExactRules @\(Normalize-Rules \$after\)/);
assert.match(script, /if \(\$rules -is \[System\.Array\]\)/);
assert.match(script, /foreach \(\$rule in \$rules\) \{ Write-Output \$rule \}/);
assert.match(script, /disabled_statickey_auth -ne \$true/);
assert.match(script, /anonymous_access_flags\.read -eq \$true/);
assert.match(script, /max_size -ne 1073741824/);
assert.doesNotMatch(script, /--public-read|--public-list|versioning-enabled|storageClass\s*[:=]\s*"(?:COLD|ICE)"/i);

console.log("Yandex private retention checks passed: exact prefixes, approved durations, private boundary and no paid storage transition.");
