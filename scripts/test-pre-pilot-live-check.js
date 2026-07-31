"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const liveCheck = fs.readFileSync(path.join(__dirname, "check-pre-pilot-live.ps1"), "utf8");
const readiness = fs.readFileSync(path.join(root, "docs", "PILOT_READINESS.md"), "utf8");

const expectedFiles = [
  "index.html", "test.html", "admin.html", "privacy.html", "consent.html", "ranking.html",
  "ranking-consent.html", "data/acc-junior.json", "data/bi-junior.json", "data/ca-junior.json",
  "data/dev-quick.json", "data/fa-junior.json", "data/fpa-junior.json"
];
const allowlist = liveCheck.match(/\$publicFiles\s*=\s*@\(([\s\S]*?)\n\)/);
assert(allowlist, "pre-pilot public allowlist is missing");
assert.deepEqual(Array.from(allowlist[1].matchAll(/"([^"]+)"/g), match => match[1]), expectedFiles);

assert.match(liveCheck, /assessment-b1gafbjd3dlh-web\.website\.yandexcloud\.net/);
assert.match(liveCheck, /capssman\.github\.io\/test-site/);
assert.match(liveCheck, /Get-FileHash[\s\S]*SHA256/);
assert.match(liveCheck, /failureCode -ne "attempt_unavailable"/);
assert.match(liveCheck, /GitHub fallback still receives candidate API CORS/);
assert.match(liveCheck, /MANUAL QA: owner confirmed the main Yandex site on desktop and mobile on 2026-07-29/);
assert.doesNotMatch(liveCheck, /adminPassword|ADMIN_PASSWORD|managementToken|storage s3|serverless function|api-gateway update/);
assert.doesNotMatch(liveCheck, /Method\s+POST[\s\S]{0,120}\/v1\/(?:admin|ranking\/profile)/);

assert.match(readiness, /подтверждённой рассылки экспертам нет, outbound остановлен/);
assert.doesNotMatch(readiness, /отправлены четыре адресных письма|reviewer outreach отправлена/);
assert.match(readiness, /check-pre-pilot-live\.ps1/);

console.log("Pre-pilot live-check safety passed: read-only cross-host/API evidence and truthful outbound history.");
