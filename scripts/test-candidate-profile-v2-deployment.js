#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const deploy = read(path.join("scripts", "deploy-yandex-candidate-profile-v2.ps1"));
const gateway = read(path.join("cloud", "api-gateway.yaml"));
const schema = read(path.join("cloud", "schema", "015_candidate_profile_v2.sql"));

assert.match(deploy, /param\(\[switch\]\$Deploy\)/);
assert.match(deploy, /if \(-not \$Deploy\)/);
assert.match(deploy, /\$sourceTag = "account-v2"/);
assert.match(deploy, /\$targetTag = "account-v3"/);
assert.match(deploy, /Assert-Tag-Missing \$targetTag/);
assert.match(deploy, /\$schemaTempPath = Join-Path \$env:TEMP/);
assert.match(deploy, /\$defaultsTempPath = Join-Path \$env:TEMP/);
assert.match(deploy, /IndexOf\("UPSERT INTO"/);
assert.match(deploy, /WriteAllText\(\$schemaTempPath/);
assert.match(deploy, /WriteAllText\(\$defaultsTempPath/);
assert.match(deploy, /candidate_profile_v2_schema/);
assert.match(deploy, /deploy-yandex-public-site\.ps1"\) -SkipGatewayUpdate/);
assert.match(deploy, /API Gateway was restored to account-v2/);
assert.match(deploy, /profile_publication_enabled = "false"/);
assert.match(deploy, /employer_workspace_enabled = "false"/);
assert.match(deploy, /employer_contact_enabled = "false"/);
assert.match(deploy, /--no-logging/);
assert.match(deploy, /accountConsentVersion/);
assert.match(deploy, /candidate-profile-v2/);
assert.doesNotMatch(deploy, /lockbox|Lockbox|client_secret|secret create/i);
assert.equal((gateway.match(/tag: "account-v6"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "account-v2"/g) || []).length, 0);
assert.match(schema, /candidate_profile_v2_schema/);
assert.match(schema, /profile_publication_enabled'\), Utf8\('false/);
assert.match(schema, /employer_workspace_enabled'\), Utf8\('false/);
assert.match(schema, /employer_contact_enabled'\), Utf8\('false/);

const staticDeployIndex = deploy.indexOf("deploy-yandex-public-site.ps1");
const schemaIndex = deploy.indexOf('& $ydb -e $endpoint -d $database sql -f $schemaTempPath');
const gatewayIndex = deploy.indexOf("api-gateway update");
assert.ok(staticDeployIndex > 0 && schemaIndex > staticDeployIndex, "compatible static page must publish before additive schema");
assert.ok(gatewayIndex > schemaIndex, "account-v3 gateway cutover must happen after schema verification");

console.log("Candidate profile v2 deployment checks passed: compatible static-first rollout, additive schema, account-v3 rollback and closed employer gates.");
