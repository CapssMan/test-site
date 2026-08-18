"use strict";

const crypto = require("node:crypto");
const { PUBLIC_PROFILE_CONSENT_VERSION, hmacHex } = require("./account-core");
const { validateEmployerInvitationAction } = require("./invitation-core");
const { publicEmployerCredentials } = require("./trust-core");
const { validateChatAction } = require("./chat-core");

const EMPLOYER_API_VERSION = "employer-workspace-v1";
const MAX_BODY_CHARS = 16000;
const MAX_SEARCH_LIMIT = 50;
const MAX_SHORTLIST_SIZE = 10;
const MAX_RESULT_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const ROLE_TEMPLATES = Object.freeze({
  "finance-general": Object.freeze({
    id: "finance-general",
    title: "Финансы — общий профиль",
    description: "Сильные начинающие специалисты по финансовому анализу, планированию, учёту и данным.",
    weights: Object.freeze({ "fa-junior": 0.2, "ca-junior": 0.2, "fpa-junior": 0.2, "acc-junior": 0.2, "bi-junior": 0.2 })
  }),
  "financial-analyst": Object.freeze({
    id: "financial-analyst",
    title: "Финансовый аналитик",
    description: "Отчётность, финансовая логика, план-факт и работа с данными.",
    weights: Object.freeze({ "fa-junior": 0.55, "fpa-junior": 0.2, "bi-junior": 0.15, "acc-junior": 0.1 })
  }),
  "credit-analyst": Object.freeze({
    id: "credit-analyst",
    title: "Кредитный аналитик",
    description: "Кредитный риск, денежный поток, долговая нагрузка и отчётность.",
    weights: Object.freeze({ "ca-junior": 0.65, "fa-junior": 0.2, "acc-junior": 0.15 })
  }),
  "fpa-analyst": Object.freeze({
    id: "fpa-analyst",
    title: "FP&A-аналитик",
    description: "Бюджетирование, прогнозирование, сценарии и аналитика показателей.",
    weights: Object.freeze({ "fpa-junior": 0.6, "fa-junior": 0.2, "bi-junior": 0.2 })
  }),
  "accounting-junior": Object.freeze({
    id: "accounting-junior",
    title: "Бухгалтер / специалист по учёту",
    description: "Учёт, первичные документы, отчётность и финансовая логика.",
    weights: Object.freeze({ "acc-junior": 0.7, "fa-junior": 0.15, "fpa-junior": 0.15 })
  }),
  "finance-bi": Object.freeze({
    id: "finance-bi",
    title: "Data & BI Analyst",
    description: "SQL, визуализация, модели данных, продуктовые метрики и качество данных.",
    weights: Object.freeze({ "bi-junior": 0.65, "fa-junior": 0.2, "fpa-junior": 0.15 })
  }),
  "tourism-operations": Object.freeze({
    id: "tourism-operations",
    title: "Туризм и гостеприимство",
    description: "Бронирование, турпродукт, клиентский сервис, гостиничные метрики и операционные риски.",
    weights: Object.freeze({ "tourism-junior": 1 })
  }),
  "software-development": Object.freeze({
    id: "software-development",
    title: "Разработка ПО",
    description: "Алгоритмы, код, Git, HTTP/API, базы данных, тестирование, безопасность и поставка.",
    weights: Object.freeze({ "software-junior": 1 })
  }),
  "product-project-management": Object.freeze({
    id: "product-project-management",
    title: "Product / Project Management",
    description: "Пользовательские задачи, метрики, эксперименты, содержание, сроки, риски, Scrum и качество поставки.",
    weights: Object.freeze({ "product-project-junior": 1 })
  }),
  "sales-business-development": Object.freeze({
    id: "sales-business-development",
    title: "Sales / Business Development",
    description: "Поиск, discovery, ценность, CRM, воронка, переговоры и развитие клиента.",
    weights: Object.freeze({ "sales-junior": 1 })
  }),
  "logistics-procurement": Object.freeze({
    id: "logistics-procurement",
    title: "Logistics / Procurement",
    description: "Потребность, поставщики, закупка, запасы, склад, перевозка, документы и риски.",
    weights: Object.freeze({ "logistics-procurement-junior": 1 })
  })
});

const TEST_TITLES = Object.freeze({
  "fa-junior": "Financial Analyst Junior",
  "ca-junior": "Credit Analyst Junior",
  "fpa-junior": "FP&A / Budget Analyst",
  "acc-junior": "Accounting / Reporting",
  "bi-junior": "Data & BI Analyst",
  "tourism-junior": "Tourism & Hospitality Operations",
  "software-junior": "Software Development Junior",
  "product-project-junior": "Product / Project Management Junior",
  "sales-junior": "Sales / Business Development Junior",
  "logistics-procurement-junior": "Logistics / Procurement Junior"
});

const EXPERIENCE = Object.freeze({
  "": Object.freeze({ label: "Опыт не указан", score: 50 }),
  student: Object.freeze({ label: "Студент", score: 62 }),
  under_1: Object.freeze({ label: "До 1 года", score: 74 }),
  "1_3": Object.freeze({ label: "1–3 года", score: 94 }),
  "3_plus": Object.freeze({ label: "Более 3 лет", score: 86 })
});

const WORK_FORMATS = new Set(["", "office", "hybrid", "remote"]);
const EXPERIENCE_BANDS = new Set(Object.keys(EXPERIENCE));
const JOB_STATUSES = new Set(["", "active", "open"]);

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(label + "_invalid");
  const expected = new Set(allowed);
  if (Object.keys(value).some(key => !expected.has(key))) throw new Error(label + "_invalid");
}

function parseBody(event) {
  let raw = event && event.body;
  if (event && event.isBase64Encoded) raw = Buffer.from(String(raw || ""), "base64").toString("utf8");
  if (typeof raw !== "string" || raw.length < 2 || raw.length > MAX_BODY_CHARS) throw new Error("invalid_request");
  const parsed = JSON.parse(raw);
  if (!isPlainObject(parsed)) throw new Error("invalid_request");
  return parsed;
}

function safeText(value, max) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length > max || /[<>\u0000-\u001f]/.test(text)) throw new Error("invalid_request");
  return text;
}

function publicTalentId(secret, profileId) {
  if (String(secret || "").length < 32 || !/^acct_[a-f0-9]{32}$/.test(String(profileId || ""))) throw new Error("talent_identity_invalid");
  return "talent_" + hmacHex(secret, "employer-talent-v1|" + profileId).slice(0, 32);
}

function publicRoleTemplates() {
  return Object.values(ROLE_TEMPLATES).map(template => ({ id: template.id, title: template.title, description: template.description }));
}

function normalizeSearch(value) {
  assertAllowedKeys(value, ["action", "apiVersion", "roleTemplateId", "query", "minScore", "region", "workFormat", "experienceBand", "jobStatus", "limit"], "search");
  if (value.action !== "searchTalent" || value.apiVersion !== EMPLOYER_API_VERSION || !ROLE_TEMPLATES[value.roleTemplateId]) throw new Error("invalid_request");
  const minScore = Number(value.minScore == null ? 0 : value.minScore);
  const limit = Number.parseInt(String(value.limit == null ? 25 : value.limit), 10);
  const workFormat = String(value.workFormat || "");
  const experienceBand = String(value.experienceBand || "");
  const jobStatus = String(value.jobStatus || "");
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100 || !Number.isInteger(limit) || limit < 1 ||
      !WORK_FORMATS.has(workFormat) || !EXPERIENCE_BANDS.has(experienceBand) || !JOB_STATUSES.has(jobStatus)) throw new Error("invalid_request");
  return {
    roleTemplateId: value.roleTemplateId,
    query: safeText(value.query, 80).toLocaleLowerCase("ru-RU"),
    minScore,
    region: safeText(value.region, 80).toLocaleLowerCase("ru-RU"),
    workFormat,
    experienceBand,
    jobStatus,
    limit: Math.min(limit, MAX_SEARCH_LIMIT)
  };
}

function normalizeShortlistName(value) {
  const name = safeText(value, 80);
  if (name.length < 2) throw new Error("invalid_request");
  return name;
}

function createShortlistId() {
  return "short_" + crypto.randomBytes(12).toString("hex");
}

function validateShortlistId(value) {
  const id = String(value || "");
  if (!/^short_[a-f0-9]{24}$/.test(id)) throw new Error("invalid_request");
  return id;
}

function validateTalentId(value) {
  const id = String(value || "");
  if (!/^talent_[a-f0-9]{32}$/.test(id)) throw new Error("invalid_request");
  return id;
}

function validateAction(value, options) {
  const context = options || {};
  const common = ["action", "apiVersion"];
  if (!isPlainObject(value) || value.apiVersion !== EMPLOYER_API_VERSION) throw new Error("invalid_request");
  if (value.action === "searchTalent") return { type: "search", search: normalizeSearch(value) };
  if (value.action === "listShortlists") {
    assertAllowedKeys(value, common, "list_shortlists");
    return { type: "listShortlists" };
  }
  if (value.action === "createShortlist") {
    assertAllowedKeys(value, common.concat(["name", "roleTemplateId"]), "create_shortlist");
    if (!ROLE_TEMPLATES[value.roleTemplateId]) throw new Error("invalid_request");
    return { type: "createShortlist", name: normalizeShortlistName(value.name), roleTemplateId: value.roleTemplateId };
  }
  if (value.action === "getShortlist") {
    assertAllowedKeys(value, common.concat(["shortlistId"]), "get_shortlist");
    return { type: "getShortlist", shortlistId: validateShortlistId(value.shortlistId) };
  }
  if (value.action === "addToShortlist" || value.action === "removeFromShortlist") {
    assertAllowedKeys(value, common.concat(["shortlistId", "talentProfileId"]), "change_shortlist");
    return { type: value.action === "addToShortlist" ? "addToShortlist" : "removeFromShortlist", shortlistId: validateShortlistId(value.shortlistId), talentProfileId: validateTalentId(value.talentProfileId) };
  }
  if (value.action === "listInvitations" || value.action === "createInvitationBatch") {
    return validateEmployerInvitationAction(value, EMPLOYER_API_VERSION);
  }
  if (["listConversations", "listMessages", "sendMessage", "markConversationRead", "setConversationState"].includes(value.action)) {
    return validateChatAction(value, EMPLOYER_API_VERSION, context.contactsEnabled === true);
  }
  throw new Error("invalid_request");
}

function latestVerifiedResults(attempts, nowMs) {
  const latest = new Map();
  (Array.isArray(attempts) ? attempts : []).forEach(attempt => {
    const testId = String(attempt && attempt.testId || "");
    const percent = Number(attempt && attempt.percent);
    const completedMs = Date.parse(String(attempt && attempt.completedAt || ""));
    if (attempt && attempt.state === "completed" && TEST_TITLES[testId] && Number.isFinite(percent) && percent >= 0 && percent <= 100 &&
        Number.isFinite(completedMs) && completedMs <= nowMs + 300000 && nowMs - completedMs <= MAX_RESULT_AGE_MS) {
      const previous = latest.get(testId);
      if (!previous || completedMs > previous.completedMs) latest.set(testId, { testId, title: TEST_TITLES[testId], score: Math.round(percent * 10) / 10, completedAt: new Date(completedMs).toISOString(), completedMs });
    }
  });
  return Array.from(latest.values()).sort((left, right) => right.completedMs - left.completedMs).map(({ completedMs, ...result }) => result);
}

function buildTalentCandidate(account, attempts, options) {
  const context = options || {};
  const nowMs = context.now instanceof Date ? context.now.getTime() : Date.now();
  if (!account || account.status !== "active" || account.visibility !== "discoverable" ||
      account.publicConsentVersion !== PUBLIC_PROFILE_CONSENT_VERSION || !["active", "open"].includes(account.jobStatus)) return null;
  const alias = safeText(account.publicAlias, 40);
  if (alias.length < 2) return null;
  const results = latestVerifiedResults(attempts, nowMs);
  if (!results.length) return null;
  const template = ROLE_TEMPLATES[context.roleTemplateId] || ROLE_TEMPLATES["finance-general"];
  const search = context.search || { query: "", minScore: 0, region: "", workFormat: "", experienceBand: "", jobStatus: "" };
  const relevant = results.filter(result => Object.prototype.hasOwnProperty.call(template.weights, result.testId));
  const credentials = publicEmployerCredentials(context.credentials);
  if (!relevant.length || Math.max(...relevant.map(result => result.score)) < search.minScore) return null;
  const region = safeText(account.region, 80);
  const searchable = (alias + " " + region + " " + relevant.map(item => item.title).join(" ") + " " + credentials.map(item => item.title + " " + item.issuer).join(" ")).toLocaleLowerCase("ru-RU");
  if (search.query && !searchable.includes(search.query)) return null;
  if (search.region && !region.toLocaleLowerCase("ru-RU").includes(search.region) && account.workFormat !== "remote") return null;
  if (search.workFormat && account.workFormat !== search.workFormat) return null;
  if (search.experienceBand && account.experienceBand !== search.experienceBand) return null;
  if (search.jobStatus && account.jobStatus !== search.jobStatus) return null;

  let presentWeight = 0;
  let weightedScore = 0;
  relevant.forEach(result => { const weight = template.weights[result.testId]; presentWeight += weight; weightedScore += result.score * weight; });
  const assessmentAverage = weightedScore / presentWeight;
  const assessmentScore = assessmentAverage * (0.75 + 0.25 * Math.min(1, presentWeight));
  const experience = EXPERIENCE[account.experienceBand] || EXPERIENCE[""];
  const availabilityScore = account.jobStatus === "active" ? 100 : 82;
  const criteriaScore = search.region ? (region.toLocaleLowerCase("ru-RU").includes(search.region) ? 100 : 70) : 100;
  const matchScore = Math.round((experience.score * 0.45 + assessmentScore * 0.35 + availabilityScore * 0.1 + criteriaScore * 0.1) * 10) / 10;
  return {
    talentProfileId: publicTalentId(context.talentSecret, account.profileId),
    alias,
    category: "finance",
    experienceBand: account.experienceBand,
    experienceLabel: experience.label,
    jobStatus: account.jobStatus,
    region,
    workFormat: account.workFormat,
    verificationLevel: credentials.length ? "L3 · аккаунт и регалии подтверждены" : "L2 · аккаунт подтверждён",
    matchScore,
    matchBreakdown: {
      experience: experience.score,
      assessments: Math.round(assessmentScore * 10) / 10,
      availability: availabilityScore,
      criteria: criteriaScore
    },
    results,
    credentials,
    updatedAt: String(account.updatedAt || "")
  };
}

function rankTalent(records, search) {
  return (Array.isArray(records) ? records : []).filter(Boolean).sort((left, right) =>
    right.matchScore - left.matchScore ||
    Math.max(...right.results.map(item => item.score)) - Math.max(...left.results.map(item => item.score)) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.talentProfileId.localeCompare(right.talentProfileId)
  ).slice(0, search.limit);
}

module.exports = {
  EMPLOYER_API_VERSION,
  EXPERIENCE,
  MAX_BODY_CHARS,
  MAX_SEARCH_LIMIT,
  MAX_SHORTLIST_SIZE,
  ROLE_TEMPLATES,
  TEST_TITLES,
  buildTalentCandidate,
  createShortlistId,
  latestVerifiedResults,
  normalizeSearch,
  parseBody,
  publicRoleTemplates,
  publicTalentId,
  rankTalent,
  validateAction
};
