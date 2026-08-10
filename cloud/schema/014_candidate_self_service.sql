CREATE TABLE IF NOT EXISTS candidate_self_service_slots (
    profile_id Utf8 NOT NULL,
    test_id Utf8 NOT NULL,
    invite_id Utf8 NOT NULL,
    begin_request_id Utf8 NOT NULL,
    attempt_id Utf8 NOT NULL,
    slot_state Utf8 NOT NULL,
    granted_at Timestamp NOT NULL,
    expires_at Timestamp NOT NULL,
    eligible_after Timestamp NOT NULL,
    updated_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (profile_id, test_id)
) WITH (TTL = Interval("PT0S") ON purge_at);

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('account_self_service_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('account_required_for_attempts'), Utf8('false'), CurrentUtcTimestamp());
