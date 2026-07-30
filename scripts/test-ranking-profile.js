#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PROFILE_API_VERSION,
  RANKING_PROOF_API_VERSION,
  buildManagedProfile,
  hashManagementToken,
  parseEventBody,
  validateAuthorityProof,
  validatePublishRequest,
  validateWithdrawRequest
} = require("../cloud/ranking-profile-core");
const { ASSESSMENT_AUTHORITY_URL, createRankingProfileHandler, fetchAuthorityProof } = require("../cloud/ranking-profile-handler");
const { RANKING_CONSENT_VERSION } = require("../cloud/ranking-core");

const root = path.resolve(__dirname, "..");
const now = new Date("2026-07-27T10:00:00.000Z");
const attemptId = "att_" + "a".repeat(32);
const attemptToken = "a".repeat(40) + "." + "b".repeat(80) + "." + "c".repeat(43);
const resultCode = "FA-ABCDE";

const publishBody = {
  action: "publish",
  apiVersion: PROFILE_API_VERSION,
  publicAlias: "Кирилл К.",
  publicConsent: true,
  publicConsentVersion: RANKING_CONSENT_VERSION,
  resultProof: { attemptId, attemptToken, resultCode }
};

const request = validatePublishRequest(publishBody);
assert.equal(request.publicAlias, "Кирилл К.");
assert.throws(() => validatePublishRequest(Object.assign({}, publishBody, { publicConsent: false })), /invalid_publish_request/);
assert.throws(() => validatePublishRequest(Object.assign({}, publishBody, { email: "private@example.com" })), /invalid_publish_request/);
assert.deepEqual(parseEventBody({ body: JSON.stringify(publishBody) }), publishBody);

const authorityResponse = {
  ok: true,
  apiVersion: RANKING_PROOF_API_VERSION,
  proofVersion: "ranking-result-v1",
  testId: "fa-junior",
  bankVersion: "FA Junior v4.0",
  resultCode,
  percent: 93,
  completedAt: "2026-07-27T09:55:00.000Z",
  passStatus: "passed",
  scoreVerification: "server-verified",
  rankingSubjectHandle: "rsh_" + "d".repeat(64),
  technical: false
};
const proof = validateAuthorityProof(authorityResponse, request, now);
const managed = buildManagedProfile(proof, request, {
  now,
  managementToken: "scm_" + "e".repeat(43)
});
assert.match(managed.profile.publicProfileId, /^profile_[a-f0-9]{32}$/);
assert.equal(managed.profile.managementTokenHash, hashManagementToken(managed.managementToken));
assert.equal(managed.profile.publicAlias, "Кирилл К.");
assert.equal(managed.profile.expiresAt.toISOString(), "2027-07-27T10:00:00.000Z");
assert.equal("email" in managed.profile, false);
assert.equal("attemptToken" in managed.profile, false);
assert.throws(() => validateAuthorityProof(Object.assign({}, authorityResponse, { technical: true }), request, now), /result_proof_rejected/);

const writes = [];
const store = {
  async upsertRankingProfile(profile) { writes.push({ type: "upsert", profile }); },
  async withdrawRankingProfile(options) { writes.push({ type: "withdraw", options }); return true; }
};
let authorityPayload;
const handler = createRankingProfileHandler({
  store,
  allowedOrigin: "https://capssman.github.io",
  authorityUrl: ASSESSMENT_AUTHORITY_URL,
  now: () => now,
  fetchImpl: async (url, options) => {
    assert.equal(url, ASSESSMENT_AUTHORITY_URL);
    authorityPayload = JSON.parse(options.body);
    return { ok: true, async json() { return authorityResponse; } };
  }
});

(async () => {
  const published = await handler({ httpMethod: "POST", body: JSON.stringify(publishBody) });
  assert.equal(published.statusCode, 200);
  assert.equal(published.headers["Cache-Control"], "no-store");
  const publishedBody = JSON.parse(published.body);
  assert.equal(publishedBody.state, "published");
  assert.match(publishedBody.managementToken, /^scm_[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(Object.keys(authorityPayload).sort(), ["action", "apiVersion", "attemptId", "attemptToken", "resultCode"].sort());
  assert.equal(authorityPayload.action, "rankingProof");
  assert.equal(writes[0].profile.resultCode, resultCode);

  const withdrawBody = {
    action: "withdraw",
    apiVersion: PROFILE_API_VERSION,
    testId: "fa-junior",
    publicProfileId: publishedBody.publicProfileId,
    managementToken: publishedBody.managementToken
  };
  assert.deepEqual(validateWithdrawRequest(withdrawBody), { testId: withdrawBody.testId, publicProfileId: withdrawBody.publicProfileId, managementToken: withdrawBody.managementToken });
  const withdrawn = await handler({ httpMethod: "POST", body: JSON.stringify(withdrawBody) });
  assert.equal(withdrawn.statusCode, 200);
  assert.deepEqual(JSON.parse(withdrawn.body), { ok: true, apiVersion: PROFILE_API_VERSION, state: "withdrawn" });
  assert.match(writes[1].options.managementTokenHash, /^[a-f0-9]{64}$/);

  const rejected = createRankingProfileHandler({
    store,
    authorityUrl: ASSESSMENT_AUTHORITY_URL,
    fetchImpl: async () => ({ ok: true, async json() { return { ok: false }; } }),
    now: () => now
  });
  assert.equal((await rejected({ httpMethod: "POST", body: JSON.stringify(publishBody) })).statusCode, 403);
  assert.equal((await handler({ httpMethod: "GET" })).statusCode, 405);

  const backend = fs.readFileSync(path.join(root, "cloud", "assessment-handler.js"), "utf8");
  const writer = fs.readFileSync(path.join(root, "cloud", "ranking-profile-handler.js"), "utf8");
  const testPage = fs.readFileSync(path.join(root, "test.html"), "utf8");
  const consentPage = fs.readFileSync(path.join(root, "ranking-consent.html"), "utf8");
  const gateway = fs.readFileSync(path.join(root, "cloud", "api-gateway.yaml"), "utf8");
  const deploy = fs.readFileSync(path.join(__dirname, "deploy-yandex-ranking-proof.ps1"), "utf8");
  assert.match(backend, /action === "rankingProof"/);
  assert.match(backend, /RANKING_PROOF_MAX_AGE_MS/);
  assert.match(backend, /rankingSubjectHandle/);
  assert.match(writer, /ASSESSMENT_AUTHORITY_URL/);
  assert.doesNotMatch(writer, /script\.google\.com/);
  await assert.rejects(() => fetchAuthorityProof("https://script.google.com/macros/s/legacy/exec", request, async () => null), /invalid_authority_url/);
  assert.match(testPage, /id="rankingConsent"/);
  assert.match(testPage, /href="ranking-consent\.html"/);
  assert.match(testPage, /function publishRankingProfile\(/);
  assert.match(testPage, /function withdrawRankingProfile\(/);
  assert.match(consentPage, new RegExp(RANKING_CONSENT_VERSION));
  assert.match(gateway, /tag: "assessment-v6"/);
  assert.match(gateway, /tag: "read-v4"/);
  assert.match(gateway, /tag: "write-v6"/);
assert.match(gateway, /\/v1\/ranking\/profile:/);
  assert.match(deploy, /SourceTag = "assessment-v4"; TargetTag = "assessment-v5"/);
  assert.match(deploy, /SourceTag = "write-v4"; TargetTag = "write-v5"/);
  assert.match(deploy, /RESULT_AUTHORITY_URL=/);
  assert.match(deploy, /ranking_proof_unavailable/);
  assert.match(deploy, /publishStatus -ne 403/);
  assert.doesNotMatch(deploy, /script\.google\.com/);
  assert.doesNotMatch(deploy, /Write-Host[^\n]*(?:environment|secret|password)/i);
  console.log("Ranking profile checks passed: explicit consent, YDB assessment proof, private management token, withdrawal and TTL contract.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
