"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_ALLOWED_ORIGINS,
  parseAllowedOrigins,
  readAllowedOriginsFromEnvironment,
  resolveAllowedOrigin
} = require("../cloud/cors-origin");

const github = "https://capssman.github.io";
const yandex = "https://assessment-b1gafbjd3dlh-web.website.yandexcloud.net";
assert.deepEqual(DEFAULT_ALLOWED_ORIGINS, [github, yandex]);
assert.deepEqual(parseAllowedOrigins(`${github};${yandex};${github}`), [github, yandex]);
assert.deepEqual(readAllowedOriginsFromEnvironment({ ALLOWED_ORIGINS: `${github};${yandex}` }), [github, yandex]);
assert.deepEqual(readAllowedOriginsFromEnvironment({ ALLOWED_ORIGIN: github }), [github]);
assert.equal(resolveAllowedOrigin({ headers: { Origin: yandex } }, [github, yandex]), yandex);
assert.equal(resolveAllowedOrigin({ headers: { origin: github } }, [github, yandex]), github);
assert.equal(resolveAllowedOrigin({ headers: { Origin: "https://attacker.example" } }, [github, yandex]), github);
assert.equal(resolveAllowedOrigin({}, [github, yandex]), github);
assert.throws(() => parseAllowedOrigins("*"), /invalid_allowed_origin/);
assert.throws(() => parseAllowedOrigins("http://capssman.github.io"), /invalid_allowed_origin/);
assert.throws(() => parseAllowedOrigins("https://capssman.github.io/path"), /invalid_allowed_origin/);

const root = path.resolve(__dirname, "..");
const runtimeDeploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-runtime-cors.ps1"), "utf8");
const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
for (const [source, target] of [["assessment-v2", "assessment-v3"], ["admin-v1", "admin-v2"], ["read-v2", "read-v3"], ["write-v2", "write-v3"]]) {
  assert(runtimeDeploy.includes(`SourceTag = "${source}"; TargetTag = "${target}"`));
}
for (const activeTag of ["assessment-v5", "admin-v2", "read-v3", "write-v5"]) {
  assert(gateway.includes(`tag: "${activeTag}"`));
}
for (const file of ["assessment-handler.js", "admin-handler.js", "ranking-handler.js", "ranking-profile-handler.js"]) {
  const source = fs.readFileSync(path.join(root, "cloud", file), "utf8");
  assert.match(source, /resolveAllowedOrigin\(event, allowedOrigins\)/, file + " must resolve each response origin");
}
assert.match(runtimeDeploy, /ALLOWED_ORIGINS=/);
assert.match(runtimeDeploy, /packages\/runtime-cors-/);
assert.match(runtimeDeploy, /storage s3 rm \$packageUri/);
assert.doesNotMatch(runtimeDeploy, /Write-Host[^\n]*(?:environment|secret|password)/i);

console.log("Yandex CORS origin checks passed: exact dual-origin responses and four-version rollout boundary.");
