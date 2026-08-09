CREATE TABLE IF NOT EXISTS employer_accounts (
    employer_id Utf8 NOT NULL,
    identity_profile_id Utf8 NOT NULL,
    organization_name Utf8 NOT NULL,
    organization_domain Utf8 NOT NULL,
    verification_status Utf8 NOT NULL,
    employer_status Utf8 NOT NULL,
    created_at Timestamp NOT NULL,
    updated_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (employer_id),
    INDEX employer_identity GLOBAL ON (identity_profile_id)
) WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS employer_shortlists (
    employer_id Utf8 NOT NULL,
    shortlist_id Utf8 NOT NULL,
    shortlist_name Utf8 NOT NULL,
    role_template_id Utf8 NOT NULL,
    created_at Timestamp NOT NULL,
    updated_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (employer_id, shortlist_id)
) WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS employer_shortlist_items (
    employer_id Utf8 NOT NULL,
    shortlist_id Utf8 NOT NULL,
    talent_profile_id Utf8 NOT NULL,
    candidate_profile_id Utf8 NOT NULL,
    added_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (employer_id, shortlist_id, talent_profile_id)
) WITH (TTL = Interval("PT0S") ON purge_at);
