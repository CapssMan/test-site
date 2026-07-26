CREATE TABLE IF NOT EXISTS active_bank_versions (
    test_id Utf8 NOT NULL,
    bank_version Utf8 NOT NULL,
    updated_at Timestamp NOT NULL,
    PRIMARY KEY (test_id)
);

CREATE TABLE IF NOT EXISTS ranking_profiles (
    test_id Utf8 NOT NULL,
    public_profile_id Utf8 NOT NULL,
    result_code Utf8 NOT NULL,
    public_alias Utf8 NOT NULL,
    public_opt_in Bool NOT NULL,
    public_consent_active Bool NOT NULL,
    public_consent_version Utf8 NOT NULL,
    bank_version Utf8 NOT NULL,
    result_status Utf8 NOT NULL,
    score_verification Utf8 NOT NULL,
    percent Double NOT NULL,
    completed_at Timestamp NOT NULL,
    technical Bool NOT NULL,
    updated_at Timestamp NOT NULL,
    PRIMARY KEY (test_id, public_profile_id)
);