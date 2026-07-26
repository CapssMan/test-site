#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildRankingResponse, RANKING_CONSENT_VERSION, TECHNICAL_RESULT_CODES } = require("../cloud/ranking-core");
const { createRankingHandler } = require("../cloud/ranking-handler");

const root = path.resolve(__dirname, "..");
const rankingPage = fs.readFileSync(path.join(root, "ranking.html"), "utf8");
const indexPage = fs.readFileSync(path.join(root, "index.html"), "utf8");
const now = new Date("2026-07-26T12:00:00.000Z");

function candidate(index, overrides) {
  return Object.assign({
    publicProfileId: "profile_" + String(index).padStart(12, "0"),
    publicAlias: "Кандидат " + String(index),
    publicOptIn: true,
    publicConsentActive: true,
    publicConsentVersion: RANKING_CONSENT_VERSION,
    testId: "fa-junior",
    bankVersion: "FA Junior v4.0",
    status: "passed",
    scoreVerification: "server-verified",
    percent: 80 + index,
    completedAt: new Date(now.getTime() - index * 60000).toISOString(),
    resultCode: "FA-PUBLIC" + String(index),
    email: "private" + String(index) + "@example.com",
    telegram: "@private" + String(index),
    answers: [{ questionId: "secret" }]
  }, overrides || {});
}

const collecting = buildRankingResponse([candidate(1), candidate(2)], {
  testId: "fa-junior", bankVersion: "FA Junior v4.0", now
});
assert.equal(collecting.state, "collecting");
assert.equal(collecting.participantsCount, 2);
assert(collecting.entries.every(entry => entry.rank === null));

const records = [candidate(1), candidate(2), candidate(3), candidate(4), candidate(5, { percent: 84 })];
records.push(candidate(6, { resultCode: Array.from(TECHNICAL_RESULT_CODES)[0], percent: 100 }));
records.push(candidate(7, { publicOptIn: false, percent: 100 }));
records.push(candidate(8, { publicConsentVersion: "wrong", percent: 100 }));
records.push(candidate(9, { scoreVerification: "client", percent: 100 }));
records.push(candidate(10, { publicAlias: "<script>alert(1)</script>", percent: 100 }));
records.push(candidate(1, { percent: 99, completedAt: "2026-07-26T11:59:59.000Z" }));

const active = buildRankingResponse(records, { testId: "fa-junior", bankVersion: "FA Junior v4.0", now, limit: 50 });
assert.equal(active.state, "active");
assert.equal(active.participantsCount, 5);
assert.equal(active.entries[0].alias, "Кандидат 1", "latest retake should replace older public result");
assert.equal(active.entries[0].score, 99);
assert.equal(active.entries[1].rank, 2);
assert.equal(active.entries[2].rank, 2, "equal scores must share a competition rank");
active.entries.forEach(entry => {
  assert.deepEqual(Object.keys(entry).sort(), ["alias", "completedAt", "publicProfileId", "rank", "score", "verificationLevel"].sort());
  assert.equal("email" in entry, false);
  assert.equal("telegram" in entry, false);
  assert.equal("answers" in entry, false);
  assert.equal("resultCode" in entry, false);
});

assert.throws(() => buildRankingResponse([], { testId: "dev-quick", bankVersion: "v1", now }), /unsupported_test/);
assert.throws(() => buildRankingResponse([], { testId: "fa-junior", bankVersion: "", now }), /invalid_bank_version/);

const store = {
  async getActiveBankVersion(testId) { assert.equal(testId, "fa-junior"); return "FA Junior v4.0"; },
  async listRankingCandidates() { return records; }
};
const handler = createRankingHandler({ store, allowedOrigin: "https://skillcheck.example", now: () => now });

(async () => {
  const success = await handler({ httpMethod: "GET", queryStringParameters: { testId: "fa-junior", limit: "5" } });
  assert.equal(success.statusCode, 200);
  assert.equal(success.headers["Access-Control-Allow-Origin"], "https://skillcheck.example");
  assert.equal(JSON.parse(success.body).entries.length, 5);

  const methodRejected = await handler({ httpMethod: "POST", queryStringParameters: { testId: "fa-junior" } });
  assert.equal(methodRejected.statusCode, 405);
  const testRejected = await handler({ httpMethod: "GET", queryStringParameters: { testId: "dev-quick" } });
  assert.equal(testRejected.statusCode, 400);

  const unavailableHandler = createRankingHandler({
    store: { async getActiveBankVersion() { throw new Error("secret details"); }, async listRankingCandidates() { return []; } },
    allowedOrigin: "https://skillcheck.example",
    now: () => now
  });
  const unavailable = await unavailableHandler({ httpMethod: "GET", queryStringParameters: { testId: "fa-junior" } });
  assert.equal(unavailable.statusCode, 503);
  assert.deepEqual(JSON.parse(unavailable.body), { ok: false, error: "ranking_temporarily_unavailable" });

  assert.match(indexPage, /href="ranking\.html"/);
  assert.match(rankingPage, /const RANKING_API_URL = ""/);
  assert.match(rankingPage, /Участие только добровольное/);
  assert.match(rankingPage, /Позиции появятся после пяти добровольных участников/);
  assert.doesNotMatch(rankingPage, /mock|demo candidate|пример участника/i);
  console.log("Ranking MVP checks passed: opt-in, version isolation, technical exclusion, privacy allowlist and fail-closed UI.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});