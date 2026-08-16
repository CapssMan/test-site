"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-public-site.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const website = JSON.parse(fs.readFileSync(path.join(root, "cloud", "public-website-settings.json"), "utf8"));

const expected = [
  "index.html", "preview-v2.html", "preview-v3.html", "assets/preview-v3.css", "assets/preview-v3.js", "social-preview.png", "social-preview.svg", "test.html", "admin.html", "privacy.html", "consent.html", "ranking.html", "employer.html",
  "ranking-consent.html", "account.html", "account-consent.html", "data/acc-junior.json", "data/bi-junior.json", "data/ca-junior.json",
  "data/dev-quick.json", "data/fa-junior.json", "data/fpa-junior.json"
];
const allowlistMatch = deploy.match(/\$publicFiles\s*=\s*@\(([\s\S]*?)\n\)/);
assert(allowlistMatch, "public deployment allowlist is missing");
const actual = Array.from(allowlistMatch[1].matchAll(/"([^"]+)"/g), match => match[1]);
assert.deepEqual(actual, expected);
actual.forEach(file => assert(fs.existsSync(path.join(root, ...file.split("/"))), "missing public file: " + file));
assert.deepEqual(website, { index: "index.html", error: "index.html" });

assert.match(deploy, /\$unexpectedBefore/);
assert.match(deploy, /object set does not exactly match the approved allowlist/);
assert.match(deploy, /param\(\[switch\]\$SkipGatewayUpdate\)/);
assert.match(deploy, /if \(-not \$SkipGatewayUpdate\)[\s\S]*api-gateway", "update"/);
assert.match(deploy, /--content-md5/);
assert.match(deploy, /Get-FileHash[\s\S]*SHA256/);
assert.match(deploy, /--public-read/);
assert.match(deploy, /--public-list/);
assert.match(deploy, /--disable-statickey-auth=true/);
assert.match(deploy, /test-public-bank-secrecy\.js/);
assert.match(deploy, /function Invoke-WebRequestWithRetry/);
assert.match(deploy, /\$attempt -le 3/);
assert.match(deploy, /"\/v1\/employer"/);
assert.match(deploy, /failureCode -ne "attempt_unavailable"/);
assert.match(deploy, /"\/v1\/account"/);
assert.match(deploy, /exactly 22 unique files/);
assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /href="employer\.html">.*?<\/a>/);
assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /href="account\.html">Личный кабинет<\/a>/);
assert.doesNotMatch(deploy, /storage\s+.*\s+rm|delete-object|delete-objects|--recursive/);
assert.doesNotMatch(deploy, /private-bucket|apps-script\/|apps-script\\/);
assert.match(deploy, /operator-private\\roskomnadzor-2026-07-31\\10_PUBLIC_OPERATOR_ADDRESS_INPUT\.txt/);
assert.match(deploy, /HtmlEncode\(\$operatorAddress\)/);
assert.match(deploy, /\$expectedSha256/);
assert.match(deploy, /Remove-Item -LiteralPath \$renderedPath/);
for (const file of ["privacy.html", "consent.html", "ranking-consent.html"]) {
assert.match(deploy, /content-type,authorization,cache-control,pragma/);
assert.match(deploy, /Content-Type,Authorization,Cache-Control,Pragma/);
  const template = fs.readFileSync(path.join(root, file), "utf8");
  assert.equal(template.split("[Адрес оператора опубликован на основном сайте Yandex Cloud]").length - 1, 1);
  assert(!template.includes("PUBLIC_OPERATOR_ADDRESS="));
}

const originBlock = gateway.match(/origin:\s*\n((?:\s+-\s+"[^"]+"\s*\n){1})/);
assert(originBlock, "gateway must allow exactly one explicit frontend origin");
assert.deepEqual(Array.from(originBlock[1].matchAll(/"([^"]+)"/g), match => match[1]), [
  "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
]);
assert.doesNotMatch(originBlock[1], /\*/);
assert.match(deploy, /GitHub fallback unexpectedly received candidate API CORS/);

console.log("Yandex public-site deployment checks passed: exact 22-file boundary, verified upload and Yandex-only candidate CORS.");
