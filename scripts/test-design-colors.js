#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pages = ["account.html", "employer.html"];
const forbiddenBrandSignatures = ["#cb11ab", "#c511ab", "#a73afd", "#e313bf"];

function luminance(hex) {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left, right) {
  const high = Math.max(luminance(left), luminance(right));
  const low = Math.min(luminance(left), luminance(right));
  return (high + 0.05) / (low + 0.05);
}

for (const file of pages) {
  const source = fs.readFileSync(path.join(root, file), "utf8").toLowerCase();
  for (const signature of forbiddenBrandSignatures) assert.equal(source.includes(signature), false, file + " must not reuse a known Wildberries signature color");
  const blue = /--blue:(#[0-9a-f]{6})/.exec(source);
  const violet = /--violet:(#[0-9a-f]{6})/.exec(source);
  assert(blue && violet, file + " must expose stable blue and violet design tokens");
  assert(contrast(blue[1], "#ffffff") >= 4.5, file + " blue button endpoint must pass WCAG AA for normal white text");
  assert(contrast(violet[1], "#ffffff") >= 4.5, file + " violet button endpoint must pass WCAG AA for normal white text");
  assert.match(source, /outline:3px solid (?:var\(--blue\)|var\(--focus\))/, file + " must have a visible 3px focus indicator");
  assert.match(source, /min-height:4[48]px/, file + " must retain touch-sized primary controls");
}

console.log("Design color checks passed: distinct cold palette guard, WCAG AA primary contrast, visible focus and touch-sized controls.");
