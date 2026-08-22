#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "employer.html"), "utf8");
assert.match(page, /<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(page, /\/v1\/employer/);
assert.match(page, /employer-workspace-v1/);
assert.match(page, /skillcheck_candidate_account_v1/);
assert.match(page, /sessionStorage/);
assert.doesNotMatch(page, /localStorage/);
assert.match(page, /id="roleTemplate"/);
assert.match(page, /id="experienceBand"/);
assert.match(page, /id="workFormat"/);
assert.match(page, /id="jobStatus"/);
assert.match(page, /id="shortlistSelect"/);
assert.match(page, /id="createShortlist"/);
assert.match(page, /addToShortlist/);
assert.match(page, /removeFromShortlist/);
assert.match(page, /Все кандидаты/);
assert.match(page, /Показать кандидатов/);
assert.match(page, /id="sendInvitationBatch"/);
for (const id of ["briefPreview", "briefReadiness", "briefPreviewTitle", "briefPreviewSummary", "briefPreviewMeta"]) {
  assert.match(page, new RegExp('id="' + id + '"'), "missing vacancy brief node: " + id);
}
assert.match(page, /function roleCategory\(id\)/);
for (const roleId of ["finance-general", "accounting-junior", "finance-bi", "tourism-operations", "software-development", "product-project-management", "sales-business-development", "logistics-procurement", "digital-marketing"]) {
  assert.ok(page.includes('"' + roleId + '"'), "missing role category mapping: " + roleId);
}
assert.match(page, /function updateInvitationBrief\(prefill\)/);
assert.match(page, /ready\+" \/ 5"/);
assert.match(page, /Заполните название роли, задачи, следующий этап и срок ответа\./);
const briefFunction = page.match(/function updateInvitationBrief\(prefill\)\{([\s\S]*?)\r?\n    function initials/);
assert(briefFunction, "vacancy brief function boundary is missing");
assert.doesNotMatch(briefFunction[1], /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|innerHTML/i);
assert.match(page, /createInvitationBatch/);
assert.match(page, /listInvitations/);
assert.match(page, /active_invitation_exists/);
assert.match(page, /Контакты остаются закрыты/);
assert.match(page, /SHORTLIST_LIMIT=10/);
assert.match(page, /Опыт 45% · тесты 35%/);
assert.match(page, /Контакты закрыты/);
assert.match(page, /ФИО, email, телефон, полный отчёт и ответы не раскрываются/);
assert.match(page, /реальные кандидаты и контакты не подставляются/);
assert.match(page, /@media\(max-width:760px\)/);
assert.match(page, /prefers-reduced-motion:reduce/);
assert.doesNotMatch(page, /requestContact|revealContact|contactCandidate/);
assert.doesNotMatch(page, /@example\.(?:com|ru)|Иван Иванов|Мария С\.|Алексей К\./);
assert.doesNotMatch(page, /innerHTML\s*=/);
assert.match(page, /textContent/);
assert.match(page, /employer_verification_required/);
assert.match(page, /employer_workspace_closed/);
assert.match(page, /общая база добровольно открытых профилей/);
console.log("Employer UI checks passed: all-candidate search, 1-10 shortlist invitations, synced statuses, mobile states and no contact or mock data.");
