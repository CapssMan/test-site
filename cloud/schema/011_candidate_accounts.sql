CREATE TABLE IF NOT EXISTS candidate_accounts (
    profile_id Utf8 NOT NULL,
    account_status Utf8 NOT NULL,
    provider Utf8 NOT NULL,
    provider_subject_hash Utf8 NOT NULL,
    email_hash Utf8 NOT NULL,
    email_masked Utf8 NOT NULL,
    public_alias Utf8 NOT NULL,
    visibility Utf8 NOT NULL,
    job_status Utf8 NOT NULL,
    region Utf8 NOT NULL,
    work_format Utf8 NOT NULL,
    experience_band Utf8 NOT NULL,
    account_consent_version Utf8 NOT NULL,
    account_consented_at Timestamp NOT NULL,
    public_consent_version Utf8 NOT NULL,
    public_consented_at Timestamp NOT NULL,
    created_at Timestamp NOT NULL,
    last_login_at Timestamp NOT NULL,
    updated_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (profile_id),
    INDEX candidate_provider_subject GLOBAL ON (provider, provider_subject_hash),
    INDEX candidate_email GLOBAL ON (email_hash)
) WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS candidate_account_sessions (
    profile_id Utf8 NOT NULL,
    session_token_hash Utf8 NOT NULL,
    issued_at Timestamp NOT NULL,
    expires_at Timestamp NOT NULL,
    last_seen_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (profile_id, session_token_hash),
    INDEX candidate_session_token GLOBAL ON (session_token_hash)
) WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS candidate_attempt_links (
    profile_id Utf8 NOT NULL,
    test_id Utf8 NOT NULL,
    attempt_id Utf8 NOT NULL,
    attempt_state Utf8 NOT NULL,
    result_code Utf8 NOT NULL,
    percent Double NOT NULL,
    bank_version Utf8 NOT NULL,
    started_at Timestamp NOT NULL,
    completed_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (profile_id, test_id, attempt_id),
    INDEX candidate_attempt GLOBAL ON (attempt_id)
) WITH (TTL = Interval("PT0S") ON purge_at);

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8("account_registration_enabled"), Utf8("false"), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8("profile_publication_enabled"), Utf8("false"), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8("employer_contact_enabled"), Utf8("false"), CurrentUtcTimestamp());
