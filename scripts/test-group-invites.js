"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const schema = read("cloud/schema/010_group_invites.sql");
const store = read("cloud/ydb-assessment-store.js");
const assessment = read("cloud/assessment-handler.js");
const adminCore = read("cloud/admin-core.js");
const adminHandler = read("cloud/admin-handler.js");
const admin = read("admin.html");
const candidate = read("test.html");

assert.match(schema, /CREATE TABLE IF NOT EXISTS assessment_invite_groups[\s\S]*max_uses Int32 NOT NULL[\s\S]*used_count Int32 NOT NULL/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS assessment_invite_group_claims[\s\S]*PRIMARY KEY \(group_id, identity_hash\)/);
assert.equal((schema.match(/TTL = Interval\("PT0S"\) ON purge_at/g) || []).length, 2);

for (const method of [
  "getInviteGroupByCodeHash", "getInviteGroupByRequestId", "getInviteGroupById",
  "listInviteGroups", "upsertInviteGroup", "getInviteGroupClaim",
  "claimInviteGroupSeat", "revokeInviteGroup"
]) assert.match(store, new RegExp("async " + method + "\\("));
assert.match(store, /used_count < max_uses/);
assert.match(store, /NOT EXISTS \(SELECT \* FROM \$existing\)/);
assert.match(store, /UPDATE assessment_invite_groups SET used_count = used_count \+ 1/);

assert.match(assessment, /resolveGroupInvite/);
assert.match(assessment, /group_invite_claimed/);
assert.match(assessment, /claimInviteGroupSeat/);
assert.match(assessment, /if \(!invite\) invite = await resolveGroupInvite/);

assert.match(adminCore, /validateCreateInviteGroupRequest/);
assert.match(adminCore, /maxUses < 1 \|\| maxUses > 100/);
assert.match(adminHandler, /adminCreateInviteGroup/);
assert.match(adminHandler, /adminRevokeInviteGroup/);
assert.match(adminHandler, /inviteGroups/);

for (const id of [
  "inviteGroupForm", "inviteGroupTest", "inviteGroupLimit", "inviteGroupHours",
  "createInviteGroupButton", "inviteGroupLink", "inviteGroupList"
]) assert.match(admin, new RegExp('id="' + id + '"'));
assert.match(admin, /value="30"/);
assert.match(admin, /url\.hash = "invite="/);
assert.match(candidate, /персональным и групповым приглашениям/);
assert.match(candidate, /общая ссылка преподавателя/);

console.log("Group invite checks passed: capped cohort schema, atomic unique claims, admin controls and candidate flow.");
