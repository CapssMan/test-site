# Gated Yandex assessment runtime

Status date: 2026-07-29. `SkillCheck` is still a temporary product name; this document makes no claim about a company name, domain, or trademark.

## Deployed boundary

- Existing YDB Serverless database: `assessment-runtime-db` (`etnkl7r9gkk0in6fitmv`), capped at 10 RU/s and 1 GB.
- Existing Cloud Function resource: `assessment-ranking-api` (`d4e1qffg3l40q6jgq0t9`).
- Active gated assessment version: `assessment-v2` (`d4e0ulhj3qtd6fhik2fn`), Node.js 22, 128 MB, 15-second timeout, concurrency 1, no provisioned instances, logging disabled. `assessment-v1` remains the immediate rollback version.
- Dedicated runtime service account: `assessment-runtime-writer` (`ajesa9at6fmpd0ukbb25`), with database-specific `ydb.editor` and private-bucket ACL read/write only. It has no static key.
- Existing private bucket: `assessment-b1gafbjd3dlh-private`, capped at 1 GB, anonymous access disabled, static-key authentication disabled.
- Gateway route: `GET|POST /v1/assessment`, pinned to `assessment-v2`.

No Lockbox, VM, CDN, custom domain, provisioned function instance, or other fixed-cost service was added.

## Fail-closed state

The runtime settings currently stored in YDB are:

- `legal_pilot_approved=false`
- `attempt_issuance_enabled=false`
- `retention_automation_enabled=true`

The public route can report health, but a valid-shaped `beginAttempt` request receives the same neutral `attempt_unavailable` response as an invalid invitation. The five private v4 banks are present. The owner-only smoke data was deleted exactly; current counts are 0 invitations, 0 sessions, 0 results, 0 ranking profiles, and 0 report objects.

## Implemented contracts

- One session per invitation at the database primary-key boundary.
- Six-hour signed attempt token and exact browser/identity/session binding.
- Closed-bank server scoring for the five v4 finance tests.
- Twenty-one-day retake window unless an invitation explicitly allows a retake.
- Idempotent result reservation, create-only report writes, and recovery after an interrupted YDB write.
- Result, answer, and report retention timestamp: 365 days.
- Invitation and session retention timestamp: 90 days.
- Audit-event retention timestamp: 365 days, without raw contact data.
- Employer sharing remains disabled; ranking publication remains a separate voluntary action.

## Verified private-bank deployment

- All five v4 banks (`fa-junior`, `ca-junior`, `fpa-junior`, `acc-junior`, and `bi-junior`) are stored only under `banks/v4/` in the existing private bucket.
- The deterministic release verifier passed for 5 banks and 240 questions before upload.
- New objects are uploaded through a staging prefix, downloaded and checked by exact byte length and SHA-256, promoted, downloaded and checked again, then registered in `assessment_banks`.
- The successful rerun verified all five existing objects and all five YDB rows without duplicating data. The staging prefix is empty.
- Answer keys, private digests, and private bank files are not committed to Git or delivered to the browser.

## Verified owner-only smoke

On 29 July 2026 an IAM-only function version, never referenced by API Gateway, completed the full candidate path against the real YDB and private Object Storage: invitation, attempt creation, private-bank load, 100% authoritative server scoring, TXT creation and read-back, then exact deletion of its report, result, session and invitation. Independent post-checks confirmed zero candidate rows, zero report objects and both public gates still closed.

The smoke exposed and fixed a real YDB SDK type mismatch: JavaScript `Date` values were inferred as `Datetime` while the schema requires `Timestamp`, and fallible JSON casts produced optional `JsonDocument`. Inserts now explicitly unwrap validated casts to the schema types. The public Gateway was then moved from `assessment-v1` to directly verified `assessment-v2`; the public negative request still returns `attempt_unavailable`.

The reusable smoke script creates a normal unrouted successor before deleting its temporary version, so the automatic `$latest` tag cannot block cleanup again.
## Rollback boundary

The public test page still calls the Apps Script authority, while `/v1/assessment` is already served by `assessment-v2`. Existing ranking routes remain pinned to `read-v2` and `write-v2`. Immediate backend rollback is a Gateway repoint to `assessment-v1`; no real candidate traffic has been cut over and no candidate data remains in the new contour.

## Remaining before cutover

The legacy operational review is complete: there are zero eligible real-candidate records to migrate. The nine known technical results and anti-retake rows remain only in the legacy rollback boundary and are not copied.

Object Storage lifecycle retention is deployed and verified: reports expire after 365 days, deletion backups after 30 days, and temporary packages/staging after 1 day. Permanent banks are excluded. The owner-only protected end-to-end smoke is complete.

1. Switch the candidate frontend endpoint to `/v1/assessment` with an immediate rollback constant while shared pilot gates remain closed.
2. Publish the static frontend to the existing public Object Storage bucket and complete rollback/QA checks before any real invitation.
