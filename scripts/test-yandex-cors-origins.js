"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_ALLOWED_ORIGINS, parseAllowedOrigins, readAllowedOriginsFromEnvironment, resolveAllowedOrigin } = require("../cloud/cors-origin");
const github = "https://capssman.github.io";
const yandex = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
assert.deepEqual(DEFAULT_ALLOWED_ORIGINS, [yandex]);
assert.deepEqual(parseAllowedOrigins(yandex), [yandex]);
assert.deepEqual(readAllowedOriginsFromEnvironment({ ALLOWED_ORIGINS: yandex }), [yandex]);
assert.equal(resolveAllowedOrigin({ headers: { Origin: yandex } }, [yandex]), yandex);
assert.equal(resolveAllowedOrigin({ headers: { Origin: github } }, [yandex]), yandex);
assert.throws(() => parseAllowedOrigins("*"), /invalid_allowed_origin/);
assert.throws(() => parseAllowedOrigins("http://capssman.github.io"), /invalid_allowed_origin/);
const root = path.resolve(__dirname, "..");
const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-runtime-v5.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
for (const [source, target] of [["assessment-v7", "assessment-v8"], ["admin-v4", "admin-v5"], ["read-v5", "read-v6"], ["write-v7", "write-v8"]]) assert(deploy.includes('SourceTag = "' + source + '"; TargetTag = "' + target + '"'));
for (const tag of ["assessment-v10", "admin-v7", "read-v6", "write-v8"]) assert(gateway.includes('tag: "' + tag + '"'));
assert(deploy.includes('$allowedOrigins = "' + yandex + '"'));
assert(!deploy.includes('https://capssman.github.io;'));
assert(!gateway.includes('https://capssman.github.io'));
for (const file of ["assessment-handler.js", "admin-handler.js", "ranking-handler.js", "ranking-profile-handler.js"]) {
  const source = fs.readFileSync(path.join(root, "cloud", file), "utf8");
  assert.match(source, /resolveAllowedOrigin\(event, allowedOrigins\)/);
}
assert.doesNotMatch(deploy, /Write-Host[^\n]*(?:environment|secret|password)/i);
console.log("Yandex CORS checks passed: primary Yandex origin only, four-version successor rollout and GitHub denial.");
