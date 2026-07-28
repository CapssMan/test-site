# Gated Yandex assessment runtime

Status date: 2026-07-27. `SkillCheck` is still a temporary product name; this document makes no claim about a company name, domain, or trademark.

## Deployed boundary

- Existing YDB Serverless database: `assessment-runtime-db` (`etnkl7r9gkk0in6fitmv`), capped at 10 RU/s and 1 GB.
- Existing Cloud Function resource: `assessment-ranking-api` (`d4e1qffg3l40q6jgq0t9`).
- Gated assessment version: `assessment-v1` (`d4eoaso33itmmffok8j3`), Node.js 22, 128 MB, 15-second timeout, concurrency 1, no provisioned instances, logging disabled.
- Dedicated runtime service account: `assessment-runtime-writer` (`ajesa9at6fmpd0ukbb25`), with database-specific `ydb.editor` and private-bucket ACL read/write only. It has no static key.
- Existing private bucket: `assessment-b1gafbjd3dlh-private`, capped at 1 GB, anonymous access disabled, static-key authentication disabled.
- Gateway route: `GET|POST /v1/assessment`, pinned to `assessment-v1`.

No Lockbox, VM, CDN, custom domain, provisioned function instance, or other fixed-cost service was added.

## Fail-closed state

The runtime settings currently stored in YDB are:

- `legal_pilot_approved=false`
- `attempt_issuance_enabled=false`
- `retention_automation_enabled=true`

The public route can report health, but a valid-shaped `beginAttempt` request receives the same neutral `attempt_unavailable` response as an invalid invitation. No private bank, invitation, candidate result, or report has been migrated to this contour yet.

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

## Rollback boundary

The public test page still calls the Apps Script authority. Existing ranking routes remain pinned to `read-v2` and `write-v2`. Rolling back this checkpoint only requires removing the assessment Gateway route or repointing it; no candidate traffic has been cut over and no assessment data has been written.

## Remaining before cutover

1. Implement and deploy the protected admin actions against YDB and the private bucket.
2. Transfer and verify the five private v4 banks without putting answer keys in Git or the browser.
3. Migrate only the required legacy result/invitation state and preserve the 21-day retake boundary.
4. Configure report/package/backup retention without adding a paid service silently.
5. Run a protected end-to-end smoke attempt, keep issuance closed, then switch the frontend endpoint with an immediate rollback constant.
