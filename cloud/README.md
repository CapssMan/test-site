# Minimal Russian serverless contour

The resource names in this directory are deliberately neutral and temporary. `SkillCheck` remains a working product name only; no availability of a company name, domain, or trademark has been claimed.

## Deployed resources

- Folder: `skillcheck-prod` (`b1gafbjd3dlhjhge8qoc`).
- YDB Serverless: `assessment-runtime-db`, throttled to 10 RU/s, 1 GB hard storage limit, deletion protection enabled.
- Cloud Function: `assessment-ranking-api`, Node.js 22, 128 MB, 8 second timeout, concurrency 1, no provisioned instances, logging disabled.
- API Gateway: `assessment-public-api`, logging disabled, one public `GET /v1/ranking` operation.
- Public Object Storage bucket: `assessment-b1gafbjd3dlh-web`, 100 MB hard limit.
- Private Object Storage bucket: `assessment-b1gafbjd3dlh-private`, 1 GB hard limit.
- Service account: `assessment-ranking-reader`; it has `ydb.viewer` on the database and `functions.functionInvoker` on the ranking function only.

Lockbox, Compute Cloud, CDN, a custom domain, provisioned function instances, and other paid add-ons are not enabled.

## Data boundary

The ranking API selects only the public ranking fields. It does not select email, Telegram, answers, reports, invitations, or attempt tokens. A profile is returned only after the separate public-ranking consent is active and only for the current test bank version. Technical results are excluded again in the application layer.

## Migrations

Apply `schema/001_ranking.sql` first and `schema/002_active_banks.sql` second. YDB does not accept schema and data operations mixed in one query. Both migrations are safe to repeat.

## Public endpoint

`https://d5d0v6g7vmk9ku6kofjm.p8361f8z.apigw.yandexcloud.net/v1/ranking?testId=fa-junior`

The current GitHub Pages origin is the only allowed cross-origin frontend. Replace this origin in the function environment, API Gateway CORS rule, and page CSP during the later Russian-hosting cutover.

## Cost guardrails

The contour is designed for the free quotas: no idle function billing, YDB Serverless throttling and storage cap, small bucket caps, and disabled Cloud Logging. The billing budget `skillcheck-monthly` sends notifications at 30, 100, and 300 RUB but does not automatically stop resources.