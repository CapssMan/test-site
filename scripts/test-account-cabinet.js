#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "account.html"), "utf8");
const scripts = Array.from(page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1]);

assert.equal(scripts.length, 1, "account cabinet must have one application script");
new vm.Script(scripts[0], { filename: "account.html" });

[
  "loginView", "dashboardView", "dashboardTitle", "completedMetric", "bestMetric", "availableMetric",
  "jobMetric", "nextActionTitle", "nextActionButton", "candidateJourney", "candidateJourneyStatus", "journeyAccount", "journeyResult", "journeyProfile", "testAccessList", "resultList", "profileEditor",
  "profileProgressBar", "careerProfileCard", "currentRole", "targetRole", "experienceSummary", "professionalTools",
  "availabilityPanel", "confirmAvailabilityButton", "profileConsentRefresh", "saveButton", "logoutButton", "deleteButton",
  "invitations", "invitationList", "credentialsCard", "credentialList", "saveCredentialButton", "chatCard",
  "candidateConversationList", "candidateMessageList", "candidateChatForm"
].forEach(id => assert.match(page, new RegExp('id="' + id + '"'), "cabinet missing #" + id));

assert.match(page, /После входа вы попадёте в личный кабинет/);
assert.match(page, /\.guest-panel\{margin:0 auto 76px;/, "guest login panel must remain centered inside the shared shell");
assert.doesNotMatch(page, /\.guest-panel\{margin:0 0 76px;/, "guest login panel must not reset the shell's horizontal auto margins");
assert.match(page, /await loadProfile\(\)/, "OAuth callback must load the complete private profile, credentials and conversations");
assert.doesNotMatch(page, /location\.replace\(returnTo\)/, "OAuth callback must land in the cabinet, not bypass it");
assert.match(page, /highlightedTestId=testIdFromReturnTarget\(flow\.returnTo\)/);
assert.match(page, /card\.dataset\.highlighted="true"/);
assert.match(page, /test\.html\?test=/);
assert.match(page, /profileCompletion/);
assert.match(page, /const TEST_COUNT=Object\.keys\(TEST_TITLES\)\.length/);
assert.match(page, /uniqueTests\.size\+" из "\+TEST_COUNT/);
assert.match(page, /function updateCandidateJourney\(profile\)/);
assert.match(page, /done:resultRows\(profile\)\.length>0/);
assert.match(page, /done:profileCompletion\(profile\)===100/);
assert.match(page, /setAttribute\("aria-current","step"\)/);
assert.match(page, /\.candidate-path\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(page, /@media\(max-width:680px\)[\s\S]*\.candidate-path\{grid-template-columns:1fr\}/);
assert.doesNotMatch(page, /Пять финансовых направлений|0 из 5|uniqueTests\.size\+" из 5"/);
assert.match(page, /new Set\(results\.map\(row=>row\.testId\)\)/);
assert.match(page, /publicProfileEnabled/);
assert.match(page, /discoverableOption\.disabled=/);
assert.match(page, /profile_publication_closed/);
assert.match(page, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/);
assert.match(page, /currentRole:document\.getElementById\("currentRole"\)\.value/);
assert.match(page, /confirmAvailability:confirmAvailability===true/);
assert.match(page, /profile\.accountConsentVersion!==ACCOUNT_CONSENT_VERSION/);
assert.match(page, /updateAvailability\(profile\)/);
assert.match(page, /action:"listInvitations"/);
assert.match(page, /action:"markInvitationViewed"/);
assert.match(page, /action:"respondInvitation"/);
assert.match(page, /Интересно/);
assert.match(page, /Нужны подробности/);
assert.match(page, /Неинтересно/);
assert.match(page, /Контакты и чат не открываются автоматически/);
assert.match(page, /skillcheck-credentials-chat-2026-08-17-v1/);
assert.match(page, /action:"upsertCredential"/);
assert.match(page, /action:"deleteCredential"/);
assert.match(page, /action:"listConversations"/);
assert.match(page, /action:"sendMessage"/);
assert.match(page, /contact_sharing_closed/);
assert.match(page, /Ссылка не передаётся работодателю/);
assert.match(page, /skillcheck-account-2026-08-16-v3/);
assert.match(page, /@media\(max-width:680px\)/);
assert.match(page, /@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(page, /localStorage|login:phone|login:birthday|login:avatar|client_secret/);

console.log("Account cabinet checks passed: 11-direction metrics, three-step candidate progress, Yandex dashboard and desktop/mobile states are present.");
