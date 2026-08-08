#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const launch = fs.readFileSync(path.join(__dirname, "open-yandex-account-registration.ps1"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const account = fs.readFileSync(path.join(root, "account.html"), "utf8");

assert.match(launch, /\[switch\]\$NotificationSubmitted/);
assert.match(launch, /Explicit -NotificationSubmitted confirmation is required/);
assert.match(launch, /Assert-LiveDocuments[\s\S]*Set-RegistrationGate "true"/);
assert.match(launch, /skillcheck-privacy-2026-08-08-v8/);
assert.match(launch, /skillcheck-account-2026-08-08-v1/);
assert.match(launch, /account_registration_enabled/);
assert.match(launch, /profile_publication_enabled/);
assert.match(launch, /employer_contact_enabled/);
assert.match(launch, /Set-RegistrationGate "false"[\s\S]*rolled back to closed/);
assert.match(launch, /publicProfileEnabled -ne \$false/);
assert.match(launch, /Remove-Item Env:\\YDB_TOKEN/);
assert.doesNotMatch(launch, /profile_publication_enabled[^\n]*"true"|employer_contact_enabled[^\n]*"true"/);
assert.doesNotMatch(launch, /client_secret|Lockbox|lockbox/);
assert.match(index, /href="account\.html">Личный кабинет<\/a>/);
assert.match(account, /sessionStorage\.removeItem\(OAUTH_FLOW_STORAGE_KEY\)/);

console.log("Account-registration launch checks passed: legal-first publication, registration-only gate and verified rollback.");
