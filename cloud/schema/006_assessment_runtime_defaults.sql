UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at) VALUES
    (Utf8("legal_pilot_approved"), Utf8("false"), CurrentUtcTimestamp()),
    (Utf8("attempt_issuance_enabled"), Utf8("false"), CurrentUtcTimestamp()),
    (Utf8("retention_automation_enabled"), Utf8("true"), CurrentUtcTimestamp());
