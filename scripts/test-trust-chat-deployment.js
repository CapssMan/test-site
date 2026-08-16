#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const deploy = read(path.join("scripts", "deploy-yandex-trust-chat.ps1"));
const gateway = read(path.join("cloud", "api-gateway.yaml"));
const schema = read(path.join("cloud", "schema", "018_verified_profiles_chat.sql"));
const settings = read(path.join("cloud", "schema", "019_verified_profiles_chat_settings.sql"));

assert.match(deploy, /param\(\[switch\]\$Deploy\)/);
assert.match(deploy, /Explicit -Deploy confirmation is required/);
for (const [source, target] of [["account-v4", "account-v5"], ["employer-v2", "employer-v3"], ["admin-v10", "admin-v11"]]) {
  assert(deploy.includes(`$${source.startsWith("account") ? "account" : source.startsWith("employer") ? "employer" : "admin"}SourceTag = "${source}"`));
  assert(deploy.includes(`$${target.startsWith("account") ? "account" : target.startsWith("employer") ? "employer" : "admin"}TargetTag = "${target}"`));
}
assert.match(deploy, /018_verified_profiles_chat\.sql/);
assert.match(deploy, /019_verified_profiles_chat_settings\.sql/);
assert.match(deploy, /deploy-yandex-public-site\.ps1"\) -SkipGatewayUpdate/);
for (const gate of ["candidate_credentials_enabled", "employer_company_profiles_enabled", "employer_chat_enabled", "employer_contact_enabled", "employer_workspace_enabled", "profile_publication_enabled"]) {
  assert(deploy.includes(`${gate} = "false"`));
  assert(settings.includes(`Utf8('${gate}'), Utf8('false')`));
}
for (const tag of ["account-v2", "account-v3", "employer-v1", "assessment-v12"]) assert(deploy.includes(`Remove-ObsoleteTag "${tag}"`));
assert.match(deploy, /runtime version \$expectedVersionId was preserved/);
assert.match(deploy, /restored to account-v4, employer-v2 and admin-v10/);
assert.match(deploy, /--no-logging/);
assert.doesNotMatch(deploy, /version delete|Lockbox|lockbox|secret create|client_secret/i);
assert.doesNotMatch(deploy, /Write-Host[^\n]*(?:environment|secret|password)/i);

for (const tag of ["account-v5", "employer-v3", "admin-v11"]) assert.equal((gateway.match(new RegExp(`tag: "${tag}"`, "g")) || []).length, 2);
for (const tag of ["account-v4", "employer-v2", "admin-v10"]) assert.equal((gateway.match(new RegExp(`tag: "${tag}"`, "g")) || []).length, 0);

for (const table of ["candidate_credentials", "employer_organizations", "candidate_employer_conversations", "candidate_employer_messages"]) assert(schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.match(schema, /INDEX credential_review GLOBAL/);
assert.match(schema, /INDEX employer_conversations GLOBAL/);
assert.match(settings, /verified_profiles_chat_schema/);

const staticIndex = deploy.indexOf("deploy-yandex-public-site.ps1");
const schemaIndex = deploy.indexOf("Verified profiles and chat schema migration failed");
const runtimeIndex = deploy.indexOf("$accountCreated = New-RuntimeVersion");
const gatewayIndex = deploy.indexOf("api-gateway update");
assert.ok(staticIndex > 0 && schemaIndex > staticIndex, "compatible static pages must publish before additive schema");
assert.ok(runtimeIndex > schemaIndex, "runtime successors must be created after schema verification");
assert.ok(gatewayIndex > runtimeIndex, "Gateway cutover must happen after all runtime successors exist");

console.log("Trust/chat deployment checks passed: additive schema, three rollback-safe runtimes, closed gates and preserved versions.");
