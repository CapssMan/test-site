UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_invitation_v1_schema'), Utf8('true'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_invitation_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_workspace_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('profile_publication_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_contact_enabled'), Utf8('false'), CurrentUtcTimestamp());
