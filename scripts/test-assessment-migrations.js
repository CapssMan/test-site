"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ddl = fs.readFileSync(path.join(root, "cloud", "schema", "005_assessment_runtime.sql"), "utf8");
const defaults = fs.readFileSync(path.join(root, "cloud", "schema", "006_assessment_runtime_defaults.sql"), "utf8");

assert.doesNotMatch(ddl, /\b(?:UPSERT|INSERT|UPDATE|DELETE)\b/i);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_runtime_settings/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_banks/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_invites[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_sessions[\s\S]*PRIMARY KEY \(invite_id\)[\s\S]*INDEX session_attempt GLOBAL ON \(attempt_id\)/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_results[\s\S]*unanswered_count Int32 NOT NULL[\s\S]*trust_score Double NOT NULL/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS assessment_audit_events[\s\S]*TTL = Interval\("PT0S"\) ON purge_at/);

assert.match(defaults, /legal_pilot_approved"\), Utf8\("false"\)/);
assert.match(defaults, /attempt_issuance_enabled"\), Utf8\("false"\)/);
assert.match(defaults, /retention_automation_enabled"\), Utf8\("true"\)/);
assert.doesNotMatch(defaults, /\bCREATE\s+TABLE\b/i);

console.log("Assessment migration checks passed: scheme/data separation, fail-closed gates, one session per invite and TTL coverage.");
