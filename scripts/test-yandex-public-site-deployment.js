"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-public-site.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
const website = JSON.parse(fs.readFileSync(path.join(root, "cloud", "public-website-settings.json"), "utf8"));

const expected = [
  "index.html", "test.html", "admin.html", "privacy.html", "consent.html", "ranking.html",
  "ranking-consent.html", "data/acc-junior.json", "data/bi-junior.json", "data/ca-junior.json",
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
assert.match(deploy, /--content-md5/);
assert.match(deploy, /Get-FileHash[\s\S]*SHA256/);
assert.match(deploy, /--public-read/);
assert.match(deploy, /--public-list/);
assert.match(deploy, /--disable-statickey-auth=true/);
assert.match(deploy, /test-public-bank-secrecy\.js/);
assert.match(deploy, /failureCode -ne "attempt_unavailable"/);
assert.doesNotMatch(deploy, /storage\s+.*\s+rm|delete-object|delete-objects|--recursive/);
assert.doesNotMatch(deploy, /private-bucket|private\/|private\\|apps-script\/|apps-script\\/);

const originBlock = gateway.match(/origin:\s*\n((?:\s+-\s+"[^"]+"\s*\n){2})/);
assert(originBlock, "gateway must allow exactly two explicit frontend origins");
const origins = Array.from(originBlock[1].matchAll(/"([^"]+)"/g), match => match[1]);
assert.deepEqual(origins, [
  "https://capssman.github.io",
  "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net"
]);
assert.doesNotMatch(originBlock[1], /\*/);

console.log("Yandex public-site deployment checks passed: exact 13-file boundary, verified upload and dual-origin CORS.");
