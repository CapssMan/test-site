"use strict";

const RANKING_CONSENT_VERSION = "skillcheck-ranking-public-2026-07-31-v3";
const MIN_RANKED_PARTICIPANTS = 5;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_RESULT_AGE_DAYS = 365;

const SUPPORTED_TESTS = Object.freeze({
  "fa-junior": "Financial Analyst Junior",
  "ca-junior": "Credit Analyst Junior",
  "fpa-junior": "FP&A / Budget Analyst Junior",
  "acc-junior": "Accounting / Reporting Junior",
  "bi-junior": "Data & BI Analyst Junior",
  "tourism-junior": "Tourism & Hospitality Operations Junior",
  "software-junior": "Software Development Junior",
  "product-project-junior": "Product / Project Management Junior",
  "sales-junior": "Sales / Business Development Junior",
  "logistics-procurement-junior": "Logistics / Procurement Junior"
});

const TECHNICAL_RESULT_CODES = new Set([
  "DEV-Z2VK8", "DEV-E94Y8", "DEV-EZ3BY", "FA-5DU43", "DEV-B4ABJ",
  "DEV-TVENX", "DEV-7S2N2", "FA-X5P66", "FA-LDUB2"
]);

function isSupportedTest(testId) {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_TESTS, String(testId || ""));
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value == null ? DEFAULT_LIMIT : value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeAlias(value) {
  const alias = String(value || "").trim().replace(/\s+/g, " ");
  if (alias.length < 2 || alias.length > 40) return "";
  if (!/^[\p{L}\p{N}_. -]+$/u.test(alias)) return "";
  return alias;
}

function normalizeCompletedAt(value, nowMs) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp) || timestamp > nowMs + 5 * 60 * 1000) return null;
  const oldestAllowed = nowMs - MAX_RESULT_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (timestamp < oldestAllowed) return null;
  return new Date(timestamp).toISOString();
}

function toPublicCandidate(record, context) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  if (record.publicOptIn !== true || record.publicConsentActive !== true) return null;
  if (String(record.publicConsentVersion || "") !== RANKING_CONSENT_VERSION) return null;
  if (String(record.testId || "") !== context.testId) return null;
  if (String(record.bankVersion || "") !== context.bankVersion) return null;
  if (String(record.status || "") !== "passed") return null;
  if (String(record.scoreVerification || "") !== "server-verified") return null;
  if (record.technical === true || String(record.testId || "") === "dev-quick") return null;
  if (TECHNICAL_RESULT_CODES.has(String(record.resultCode || "").toUpperCase())) return null;

  const publicProfileId = String(record.publicProfileId || "").trim();
  if (!/^profile_[a-z0-9]{12,40}$/.test(publicProfileId)) return null;
  const alias = normalizeAlias(record.publicAlias);
  if (!alias) return null;
  const score = Number(record.percent);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  const completedAt = normalizeCompletedAt(record.completedAt || record.date, context.nowMs);
  if (!completedAt) return null;

  return {
    publicProfileId,
    alias,
    score: Math.round(score * 10) / 10,
    completedAt,
    verificationLevel: "L1 controlled invite"
  };
}

function chooseLatestPerProfile(records) {
  const latest = new Map();
  records.forEach(record => {
    const previous = latest.get(record.publicProfileId);
    if (!previous || record.completedAt > previous.completedAt) latest.set(record.publicProfileId, record);
  });
  return Array.from(latest.values());
}

function assignCompetitionRanks(records, rankingActive) {
  let previousScore = null;
  let previousRank = null;
  return records.map((record, index) => {
    let rank = null;
    if (rankingActive) {
      rank = record.score === previousScore ? previousRank : index + 1;
      previousScore = record.score;
      previousRank = rank;
    }
    return Object.assign({ rank }, record);
  });
}

function buildRankingResponse(records, options) {
  const settings = options || {};
  const testId = String(settings.testId || "");
  const bankVersion = String(settings.bankVersion || "").trim();
  if (!isSupportedTest(testId)) throw new Error("unsupported_test");
  if (!bankVersion || bankVersion.length > 80) throw new Error("invalid_bank_version");
  const nowMs = settings.now instanceof Date ? settings.now.getTime() : Date.now();
  const limit = normalizeLimit(settings.limit);

  const eligible = chooseLatestPerProfile((Array.isArray(records) ? records : [])
    .map(record => toPublicCandidate(record, { testId, bankVersion, nowMs }))
    .filter(Boolean));

  eligible.sort((left, right) =>
    right.score - left.score ||
    right.completedAt.localeCompare(left.completedAt) ||
    left.publicProfileId.localeCompare(right.publicProfileId)
  );

  const rankingActive = eligible.length >= MIN_RANKED_PARTICIPANTS;
  const entries = assignCompetitionRanks(eligible, rankingActive).slice(0, limit);
  return {
    ok: true,
    rankingVersion: "ranking-v1",
    testId,
    testTitle: SUPPORTED_TESTS[testId],
    bankVersion,
    state: rankingActive ? "active" : "collecting",
    minimumParticipants: MIN_RANKED_PARTICIPANTS,
    participantsCount: eligible.length,
    generatedAt: new Date(nowMs).toISOString(),
    entries
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_RESULT_AGE_DAYS,
  MIN_RANKED_PARTICIPANTS,
  RANKING_CONSENT_VERSION,
  SUPPORTED_TESTS,
  TECHNICAL_RESULT_CODES,
  buildRankingResponse,
  isSupportedTest,
  normalizeAlias,
  normalizeLimit
};