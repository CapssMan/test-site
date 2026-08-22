"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "demo.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "demo.css"), "utf8");
const js = fs.readFileSync(path.join(root, "assets", "demo.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

assert.match(html, /<title>Демо платформы — SkillCheck<\/title>/);
assert.match(html, /form-action 'none'/);
assert.match(html, /Демо-режим · вымышленные данные/);
assert.match(html, /Все имена, результаты и организации на этой странице вымышлены/);
assert.match(html, /На этой странице нет реальных людей, компаний, партнёров или результатов/);
assert.match(html, /Интерактивное демо · все данные вымышлены/);
assert.match(html, /id="candidateView"/);
assert.match(html, /id="employerView"[^>]*hidden/);
assert.equal((html.match(/data-candidate-id=/g) || []).length, 3);
assert.equal((html.match(/data-shortlist-toggle=/g) || []).length, 3);
assert.match(html, /Кандидат A-17/);
assert.match(html, /Кандидат B-24/);
assert.match(html, /Кандидат C-08/);
assert.match(html, /Демо-компания/);
assert.match(html, /Доказательства опыта/);
assert.match(html, /Учебный проект по юнит-экономике/);
assert.match(html, /Проект · проверено оператором/);
assert.match(html, /Учебный проект проверен/);
assert.doesNotMatch(html, /(?:@|\+7\s*\d|Тинькофф|Сбер|Яндекс|VK|Ozon|Wildberries)/i);

for (const source of [html, js]) {
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /\/v1\/|api\.|apigw|yandexcloud\.net/i);
}
assert.match(js, /new Set\(\)/);
assert.match(js, /function toggleShortlist/);
assert.match(js, /Никаких сообщений не отправлено/);
assert.match(js, /prefers-reduced-motion/);
assert.match(css, /@media\(max-width:720px\)/);
assert.doesNotMatch(css, /font-size:(?:8|9)px/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.match(css, /\.talent-card:hover/);
assert.match(index, /href="demo\.html">Демо<\/a>/);
assert.match(index, /href="demo\.html">Посмотреть демо платформы →<\/a>/);
assert.match(index, /data-count="11">11<\/strong><span>профессиональных направлений/);
assert.doesNotMatch(index, /data-count="7">7<\/strong><span>профессиональных направлений/);

console.log("Product demo checks passed: isolated fictional data, no API/storage, responsive UI and explicit demo boundaries.");
