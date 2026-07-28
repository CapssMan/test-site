"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "deploy-yandex-private-banks.ps1"), "utf8");

assert.match(script, /verify-rotated-artifacts\.js/);
assert.match(script, /Assert-GatesClosed \(Invoke-YdbJson \$gatesQuery\)/);
assert.match(script, /IsNullOrWhiteSpace\(\(\$raw -join ""\)\).*return \$null/);
assert.match(script, /sql -f \$queryFile --format json-unicode-array/);
assert.match(script, /Remove-Item -LiteralPath \$queryFile -Force/);
assert.match(script, /foreach \(\$item in \$parsed\).*Write-Output \$item/);
assert.doesNotMatch(script, /sql -s \$query --format/);
assert.match(script, /PSObject\.Properties\["contents"\].*return \$null/);
assert.match(script, /legal_pilot_approved -ne "false"/);
assert.match(script, /attempt_issuance_enabled -ne "false"/);
assert.match(script, /disabled_statickey_auth -ne \$true/);
assert.match(script, /bank-staging\/\$\(\$pending\.rotationId\)/);
assert.match(script, /Get-FileHash[^\n]+SHA256/);
assert.match(script, /Download-And-Verify \$stageUri/);
assert.match(script, /Download-And-Verify \$finalUri/);
assert.match(script, /UPSERT INTO assessment_banks/);
assert.match(script, /if \(-not \$metadataCommitted\)[\s\S]*createdFinalUris/);
assert.match(script, /foreach \(\$uri in \$stagingUris\)/);
assert.doesNotMatch(script, /privateFileSha256\s*=\s*"[a-f0-9]{64}"/i);
assert.doesNotMatch(script, /(?:OAuth|IAM|YDB)_?(?:TOKEN|KEY)\s*=\s*"[^"\s]+"/i);

console.log("Yandex private-bank deployment checks passed: deterministic inputs, staged checksums, fail-closed gates and metadata verification.");
