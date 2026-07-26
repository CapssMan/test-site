# Voluntary ranking profile management

Updated: 27 July 2026. Stage 18B is deployed while both real-candidate pilot gates remain closed.

## Candidate contract

- Publication is offered only after a passed `server-verified` result.
- A second unchecked-by-default consent records the exact version `skillcheck-ranking-public-2026-07-26-v1`.
- Public data is limited to alias, test, score, completion date, verification level and rank after the minimum cohort is reached.
- Email, Telegram, answers, report, result code, attempt ID and attempt token are never returned by the public ranking API.
- The browser keeps the attempt proof only in page memory. After publication it is discarded.
- The browser stores one random management token locally. The token permits only withdrawal of that public profile; YDB stores only its SHA-256 hash.

## Proof boundary

The ranking writer has no copy of the Apps Script signing secret. For a publication request it sends the attempt ID, attempt token and result code to the fixed production Apps Script deployment using `rankingProof` / `ranking-proof-v1`.

Apps Script verifies the signed token against the completed session, current bank version, result code, pass status and server scoring. Proof is limited to 24 hours after completion. The response contains an opaque HMAC-derived ranking subject handle and the minimum verified result fields; it contains no contact or answers.

## Yandex Cloud isolation

- Function resource: `assessment-ranking-api` (`d4e1qffg3l40q6jgq0t9`).
- Read tag: `read-v2`, version `d4et5ggl06s201umuj8k`, execution account `assessment-ranking-reader`, database role `ydb.viewer`.
- Write tag: `write-v2`, version `d4eo7qcj56pdf6cc5cuv`, execution account `assessment-ranking-writer`, database role `ydb.editor` on this database only.
- API Gateway invokes both tagged versions through the existing reader/invoker account. The writer account has no static key and no function invocation role.
- Logging, provisioned instances and Lockbox remain disabled.

## Retention and withdrawal

Every publication sets `expires_at` to 365 days after consent. YDB TTL is enabled on that column with zero delay after expiry. A newer verified publication replaces the same test/profile row and rotates the management token.

Withdrawal performs one atomic conditional delete by `(test_id, public_profile_id, management_token_hash)` and returns a neutral success response whether or not the row existed. If the local token is lost, the candidate may request manual removal through the project email with ownership verification.

## Production evidence

- Apps Script deployment updated in place to `@69`, backend `yandex-disk-mvp-2026-07-27-23`.
- Candidate frontend contract: `Build 2026.07.27.16`.
- Live GET returns `200`, correct CORS and zero profiles.
- A fabricated publication proof returns `403 result_proof_rejected` and writes nothing.
- A fabricated withdrawal returns neutral `200 withdrawn` and writes nothing.
- YDB schema shows the management hash, consent timestamp, expiry timestamp and active TTL; row count remains zero.
- Local CI: 31/31 checks.

This stage does not open `LEGAL_PILOT_APPROVED` or `ATTEMPT_ISSUANCE_ENABLED` and does not constitute legal or SME approval.
