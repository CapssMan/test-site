CREATE TABLE IF NOT EXISTS assessment_deletion_operations (
    request_id Utf8 NOT NULL,
    result_code Utf8 NOT NULL,
    deletion_scope Utf8 NOT NULL,
    preview_digest Utf8 NOT NULL,
    state Utf8 NOT NULL,
    backup_object_key Utf8 NOT NULL,
    backup_purged Bool NOT NULL,
    started_at Timestamp NOT NULL,
    completed_at Timestamp,
    purge_at Timestamp NOT NULL,
    PRIMARY KEY (request_id)
) WITH (TTL = Interval("PT0S") ON purge_at);
