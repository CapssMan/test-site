const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const requiredDocs = [
  "docs/DEPLOYMENT.md",
  "docs/PRIVACY_CHECKLIST.md",
  "docs/OPERATIONS.md",
  "docs/BACKUP_AND_RECOVERY.md",
  "docs/TESTING.md",
  "docs/YANDEX_CREDENTIAL_ROTATION.md"
];

requiredDocs.forEach(relativePath => {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `missing operations document: ${relativePath}`);
});

const deployment = read("docs/DEPLOYMENT.md");
assert.match(deployment, /npm ci --ignore-scripts/);
assert.match(deployment, /npm test/);
assert.match(deployment, /EXISTING_DEPLOYMENT_ID/);
assert.match(deployment, /LAST_GOOD_VERSION/);
assert.match(deployment, /ATTEMPT_ISSUANCE_ENABLED=false/);
assert.match(deployment, /не создавать новый Web App URL/i);
assert.match(deployment, /BACKUP_AND_RECOVERY\.md/);
assert.doesNotMatch(deployment, /AKfy[a-zA-Z0-9_-]{20,}/, "deployment runbook must not contain a live Web App id");

const privacy = read("docs/PRIVACY_CHECKLIST.md");
[
  "LEGAL_PILOT_APPROVED=false",
  "ATTEMPT_ISSUANCE_ENABLED=false",
  "содержательно ротированы",
  "DATA_DELETION.md",
  "трансграничной передачи",
  "не юридическое заключение"
].forEach(fragment => assert.ok(privacy.includes(fragment), `privacy checklist missing: ${fragment}`));

const operations = read("docs/OPERATIONS.md");
["DEPLOYMENT.md", "OBSERVABILITY.md", "PRIVACY_CHECKLIST.md", "Stop conditions", "S1", "S2"].forEach(fragment => {
  assert.ok(operations.includes(fragment), `operations guide missing: ${fragment}`);
});

const credentialRotation = read("docs/YANDEX_CREDENTIAL_ROTATION.md");
[
  "cloud_api:disk.app_folder",
  "app:/skillcheck",
  "stageYandexAppFolderMigrationForOwner",
  "promoteYandexAppFolderMigrationForOwner",
  "rollbackYandexAppFolderMigrationForOwner",
  "ATTEMPT_ISSUANCE_ENABLED=false"
].forEach(fragment => assert.ok(credentialRotation.includes(fragment), `credential runbook missing: ${fragment}`));
assert.doesNotMatch(credentialRotation, /OAuth\s+[A-Za-z0-9._~+\/=\/-]{20,}/, "credential runbook must not contain a token");

const readme = read("README.md");
requiredDocs.slice(0, 3).forEach(relativePath => {
  assert.ok(readme.includes(relativePath), `README does not link ${relativePath}`);
});

console.log("Operations documentation checks passed.");
