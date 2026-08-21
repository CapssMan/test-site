CREATE TABLE IF NOT EXISTS assessment_feedback (
    attempt_id Utf8 NOT NULL,
    result_code Utf8 NOT NULL,
    test_id Utf8 NOT NULL,
    bank_version Utf8 NOT NULL,
    overall_rating Int32 NOT NULL,
    clarity_rating Int32 NOT NULL,
    difficulty Utf8 NOT NULL,
    technical_issue Bool NOT NULL,
    comment Utf8 NOT NULL,
    submitted_at Timestamp NOT NULL,
    updated_at Timestamp NOT NULL,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (attempt_id),
    INDEX feedback_result GLOBAL ON (result_code),
    INDEX feedback_test_submitted GLOBAL ON (test_id, submitted_at)
) WITH (TTL = Interval("PT0S") ON purge_at);
