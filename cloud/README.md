# Minimal Russian serverless contour

The resource names in this directory are deliberately neutral and temporary. `SkillCheck` remains a working product name only; no availability of a company name, domain, or trademark has been claimed.

## Deployed resources

- Folder: `skillcheck-prod` (`b1gafbjd3dlhjhge8qoc`).
- YDB Serverless: `assessment-runtime-db`, throttled to 10 RU/s, 1 GB hard storage limit, deletion protection enabled.
- Cloud Function: `assessment-ranking-api`, Node.js 22, 128 MB, read timeout 8 seconds, write timeout 15 seconds, concurrency 1, no provisioned instances, logging disabled.
- Read version: `read-v3` (`d4ec9dhihcfph8kgrce8`) under `assessment-ranking-reader` with database-specific `ydb.viewer`.
- Write version: `write-v4` (`d4eqk12c542lqi3igki4`) under `assessment-ranking-writer` with database-specific `ydb.editor` and no static key.
- API Gateway: `assessment-public-api`, logging disabled, public `GET /v1/ranking` and `POST /v1/ranking/profile` operations pinned to explicit function tags.
- Public Object Storage bucket: `assessment-b1gafbjd3dlh-web`, 100 MB hard limit.
- Private Object Storage bucket: `assessment-b1gafbjd3dlh-private`, 1 GB hard limit.
- Gateway invocation account: `assessment-ranking-reader`; it has `functions.functionInvoker` on this function only.

Lockbox, Compute Cloud, CDN, a custom domain, provisioned function instances, and other paid add-ons are not enabled.

## Data boundary

The ranking GET selects only the public allowlist. It does not select email, Telegram, answers, reports, invitations, result codes, management hashes or attempt tokens. A profile is returned only after exact separate consent, only for the current bank version, and only for a passed server-verified result. Technical results are excluded again in the application layer.

The profile POST accepts publication only after online proof from the fixed Yandex assessment endpoint. `assessment-v4` verifies the signed attempt against the completed YDB session and result; the writer receives an opaque subject handle, not contact data. A random management token is returned once to the browser; YDB stores only its SHA-256 hash. Withdrawal is an atomic token-bound delete with a neutral response.

## Migrations

Apply migrations in numeric order. Schema and data operations must remain separate. Migrations `003` and `004` add management metadata and YDB TTL. The current YDB dialect does not accept `IF NOT EXISTS` for `ADD COLUMN`, so migration `003` is a one-time migration and must not be rerun after the columns exist.

## Public endpoints

- `https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/ranking?testId=fa-junior`
- `https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/ranking/profile`

CORS allows exactly the primary Yandex Object Storage website and the rollback GitHub Pages origin. Both preflight and actual-response headers are verified by the deployment scripts.

## Cost guardrails

The contour is designed for the free quotas: no idle function billing, YDB Serverless throttling and storage cap, small bucket caps, and disabled Cloud Logging. The billing budget `skillcheck-monthly` sends notifications at 30, 100, and 300 RUB but does not automatically stop resources.