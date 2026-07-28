# Protected Yandex administration runtime

Status date: 2026-07-28. `SkillCheck` remains a temporary product name; this document makes no claim about a company name, domain, or trademark.

## Deployed boundary

- Existing Cloud Function: `assessment-ranking-api` (`d4e1qffg3l40q6jgq0t9`).
- Protected administration version: `admin-v1` (`d4e8foec43g4ie401l7d`), Node.js 22, 128 MB, 15-second timeout, concurrency 1, no provisioned instances, logging disabled.
- Existing API Gateway: `d5d0v6g7vmk9ku6kofjm`, with `GET|POST /v1/admin` pinned to `admin-v1`.
- Existing YDB Serverless database: `assessment-runtime-db` (`etnkl7r9gkk0in6fitmv`), capped at 10 RU/s and 1 GB.
- Existing private Object Storage bucket: `assessment-b1gafbjd3dlh-private`, capped at 1 GB with anonymous access and static-key authentication disabled.
- Existing runtime service account: `assessment-runtime-writer` (`ajesa9at6fmpd0ukbb25`), with database-specific edit access and private-bucket ACL read/write only. It has no static key.

No Lockbox, VM, CDN, custom domain, provisioned function instance, or other fixed-cost service was added.

## Authentication and data boundary

- The administrator password is never committed or sent to the browser as configuration.
- The function stores only a salted PBKDF2-SHA256 verifier with 310,000 iterations.
- Password comparison is timing-safe and an incorrect password receives a neutral response.
- Invitation, identity, and deletion-signing secrets remain server-only environment values.
- Candidate reports and deletion backups remain in the private bucket.
- Public ranking data stays in its dedicated allowlisted YDB table.

## Protected actions

- List assessment results and fetch a private report.
- Read aggregate diagnostics without raw contact details.
- List, issue, and revoke invitations. Issuance remains blocked while the pilot gates are closed.
- Produce a signed deletion preview and perform a replay-safe verified deletion.
- Remove related public ranking rows and purge the temporary deletion backup only after verification.

## Database migrations

- `007_assessment_deletion_operations.sql` adds the replay/recovery ledger for administrative deletion.
- `008_invite_validity_hours.sql` persists the approved invitation validity window.
- Both migrations are applied to the live database. Existing fail-closed runtime settings were not changed.

## Live verification

- `admin-v1` is `ACTIVE` and the API Gateway is `ACTIVE`.
- `GET /v1/admin` returns healthy runtime metadata.
- A protected request with a deliberately incorrect password returns `ok=false`, `status=error`, and the neutral message `Доступ запрещён.`
- The owner completed a live correct-password login through Admin Build `2026.07.28.1`; protected YDB diagnostics loaded successfully through `/v1/admin`.

## Fail-closed state

The following settings remain unchanged:

- `legal_pilot_approved=false`
- `attempt_issuance_enabled=false`
- `retention_automation_enabled=true`

No invitation can be issued and no candidate attempt can start from the new contour yet.

## Remaining before candidate cutover

The administration frontend cutover, authenticated live diagnostics, private-bank migration, and zero-record legacy operational review are complete. Remaining work:

1. Run one protected end-to-end smoke attempt with issuance closed before and after the test.
2. Switch the candidate frontend endpoint with an immediate rollback constant, then review the five banks for content quality before opening the pilot.
