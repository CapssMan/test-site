#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const deploy = read(path.join("scripts", "deploy-yandex-employer-invitations.ps1"));
const gateway = read(path.join("cloud", "api-gateway.yaml"));
const schema = read(path.join("cloud", "schema", "016_employer_invitations.sql"));
const settings = read(path.join("cloud", "schema", "017_employer_invitation_settings.sql"));

assert.match(deploy, /param\(\[switch\]\$Deploy\)/);
assert.match(deploy, /if \(-not \$Deploy\)/);
assert.match(deploy, /\$accountSourceTag = "account-v3"/);
assert.match(deploy, /\$accountTargetTag = "account-v4"/);
assert.match(deploy, /\$employerSourceTag = "employer-v1"/);
assert.match(deploy, /\$employerTargetTag = "employer-v2"/);
assert.match(deploy, /deploy-yandex-public-site\.ps1"\) -SkipGatewayUpdate/);
assert.match(deploy, /016_employer_invitations\.sql/);
assert.match(deploy, /017_employer_invitation_settings\.sql/);
assert.match(deploy, /employer_invitation_v1_schema/);
assert.match(deploy, /employer_invitation_enabled = "false"/);
assert.match(deploy, /employer_workspace_enabled = "false"/);
assert.match(deploy, /profile_publication_enabled = "false"/);
assert.match(deploy, /employer_contact_enabled = "false"/);
assert.match(deploy, /Remove-ObsoleteTag "admin-v9" "d4e65tmuhh5oa568jjkn"/);
assert.match(deploy, /Remove-ObsoleteTag "assessment-v11" "d4e1hbljjctoa19a1iq0"/);
assert.match(deploy, /runtime version \$expectedVersionId was preserved/);
assert.match(deploy, /restored to account-v3 and employer-v1/);
assert.match(deploy, /--no-logging/);
assert.doesNotMatch(deploy, /lockbox|Lockbox|secret create|client_secret/i);

assert.equal((gateway.match(/tag: "account-v4"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "employer-v2"/g) || []).length, 2);
assert.equal((gateway.match(/tag: "account-v3"/g) || []).length, 0);
assert.equal((gateway.match(/tag: "employer-v1"/g) || []).length, 0);
assert.match(schema, /CREATE TABLE IF NOT EXISTS candidate_employer_invitations/);
assert.match(schema, /PRIMARY KEY \(candidate_profile_id, invitation_id\)/);
assert.match(schema, /INDEX employer_invitations GLOBAL ON \(employer_id, invitation_id\)/);
assert.doesNotMatch(schema, /UPSERT INTO/);
assert.match(settings, /employer_invitation_enabled'\), Utf8\('false/);
assert.match(settings, /employer_contact_enabled'\), Utf8\('false/);

const staticIndex = deploy.indexOf("deploy-yandex-public-site.ps1");
const schemaIndex = deploy.indexOf("Employer invitation schema migration failed");
const accountRuntimeIndex = deploy.indexOf("$accountCreated = New-RuntimeVersion");
const gatewayIndex = deploy.indexOf("api-gateway update");
assert.ok(staticIndex > 0 && schemaIndex > staticIndex, "compatible static pages must publish before additive schema");
assert.ok(accountRuntimeIndex > schemaIndex, "runtime successors must be created after schema verification");
assert.ok(gatewayIndex > accountRuntimeIndex, "Gateway cutover must happen after both runtime successors exist");

console.log("Employer invitation deployment checks passed: static-first rollout, additive schema, quota-safe preserved versions, dual runtime rollback and four closed gates.");
