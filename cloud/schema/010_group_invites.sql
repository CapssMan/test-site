CREATE TABLE IF NOT EXISTS assessment_invite_groups (
    group_id Utf8 NOT NULL,
    request_id Utf8 NOT NULL,
    test_id Utf8 NOT NULL,
    code_hash Utf8 NOT NULL,
    purpose Utf8 NOT NULL,
    max_uses Int32 NOT NULL,
    used_count Int32 NOT NULL,
    valid_for_hours Int32 NOT NULL,
    state Utf8 NOT NULL,
    issued_at Timestamp NOT NULL,
    expires_at Timestamp NOT NULL,
    revoked_at Timestamp,
    revoke_request_id Utf8,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (group_id),
    INDEX invite_group_request GLOBAL ON (request_id),
    INDEX invite_group_code GLOBAL ON (code_hash)
) WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS assessment_invite_group_claims (
    group_id Utf8 NOT NULL,
    identity_hash Utf8 NOT NULL,
    invite_id Utf8 NOT NULL,
    claimed_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (group_id, identity_hash),
    INDEX invite_group_claim_invite GLOBAL ON (invite_id)
) WITH (TTL = Interval("PT0S") ON purge_at);
