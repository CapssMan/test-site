"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const account = fs.readFileSync(path.join(root, "account.html"), "utf8");
const testPage = fs.readFileSync(path.join(root, "test.html"), "utf8");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-unified-preview.ps1"), "utf8");
const gatewayOrigin = "https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net";

assert.equal((gateway.match(/BEGIN UNIFIED_ORIGIN_PREVIEW/g) || []).length, 1);
assert.equal((gateway.match(/END UNIFIED_ORIGIN_PREVIEW/g) || []).length, 1);
assert.match(gateway, /\/preview-unified:\s*\n\s*get:[\s\S]*?type: object_storage[\s\S]*?bucket: assessment-b1gafbjd3dlh-web[\s\S]*?object: index\.html/);
assert.match(gateway, /\/preview-unified\/\{file\+\}:[\s\S]*?name: file[\s\S]*?type: object_storage[\s\S]*?object: '\{file\}'/);
assert.match(gateway, /\/v1\/account:[\s\S]*?tag: "account-v4"/);
assert.match(gateway, /\/v1\/assessment:[\s\S]*?tag: "assessment-v13"/);
assert.match(gateway, /service_account_id: ajerg3btsr8m7va4gi2m/);

assert(account.includes(`const UNIFIED_PREVIEW_ORIGIN="${gatewayOrigin}"`));
assert.match(account, /UNIFIED_PREVIEW_PREFIX="\/preview-unified"/);
assert.match(account, /window\.location\.origin===UNIFIED_PREVIEW_ORIGIN/);
assert.match(account, /window\.location\.pathname\.startsWith\(UNIFIED_PREVIEW_PREFIX\+"\/"\)/);
assert.match(account, /IS_UNIFIED_PREVIEW\?"\/v1\/account"/);
assert.match(account, /CALLBACK_STATE\.startsWith\("u_"\)/);
assert.match(account, /state=\(IS_UNIFIED_PREVIEW\?"u_":"s_"\)\+randomBase64Url\(32\)/);
assert.match(account, /UNIFIED_PREVIEW_ORIGIN\+UNIFIED_PREVIEW_PREFIX\+"\/account\.html"/);
assert.match(account, /SHOULD_FORWARD_UNIFIED_CALLBACK/);
assert.match(account, /PRIMARY_SITE_ORIGIN="https:\/\/assessment-b1gafbjd3dlh-web\.website\.yandexcloud\.net"/);
assert.match(account, /connect-src 'self'/);

for (const apiPath of ["/v1/account", "/v1/assessment", "/v1/ranking/profile"]) {
  assert(testPage.includes(gatewayOrigin + apiPath));
}
assert.match(testPage, /fetch\(ACCOUNT_API_URL/);
assert.match(testPage, /fetch\(ASSESSMENT_API_URL/);

assert.match(deploy, /deploy-yandex-public-site\.ps1/);
assert.match(deploy, /BEGIN UNIFIED_ORIGIN_PREVIEW/);
assert.match(deploy, /Update-Gateway \$rollbackSpec/);
assert.match(deploy, /preview-unified\/account\.html/);
assert.match(deploy, /preview-unified\/data\/dev-quick\.json/);
assert.match(deploy, /list-access-bindings/);
assert.match(deploy, /bindingsRaw -match 'allUsers'/);
assert.doesNotMatch(deploy, /add-access-binding|system:allUsers|Lockbox|lockbox|certificate-manager|cloud-cdn/i);
assert.doesNotMatch(deploy, /function create-version|schema\/|ydb sql/i);

const previewStart = gateway.indexOf("# BEGIN UNIFIED_ORIGIN_PREVIEW");
const previewEnd = gateway.indexOf("# END UNIFIED_ORIGIN_PREVIEW");
assert(previewStart > -1 && previewEnd > previewStart);
assert(!gateway.slice(previewStart, previewEnd).includes("cloud_functions"));

console.log("Unified-origin preview checks passed: isolated Object Storage routes, same-origin account API, OAuth callback bridge, rollback and non-public functions.");
