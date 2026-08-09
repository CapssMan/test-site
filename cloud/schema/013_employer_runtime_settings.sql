UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_workspace_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_contact_enabled'), Utf8('false'), CurrentUtcTimestamp());
