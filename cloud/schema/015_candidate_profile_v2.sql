ALTER TABLE candidate_accounts ADD COLUMN current_role Utf8;
ALTER TABLE candidate_accounts ADD COLUMN target_role Utf8;
ALTER TABLE candidate_accounts ADD COLUMN experience_summary Utf8;
ALTER TABLE candidate_accounts ADD COLUMN professional_tools Utf8;
ALTER TABLE candidate_accounts ADD COLUMN availability_confirmed_at Timestamp;
UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('candidate_profile_v2_schema'), Utf8('true'), CurrentUtcTimestamp());


UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_workspace_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('profile_publication_enabled'), Utf8('false'), CurrentUtcTimestamp());

UPSERT INTO assessment_runtime_settings (setting_key, setting_value, updated_at)
VALUES (Utf8('employer_contact_enabled'), Utf8('false'), CurrentUtcTimestamp());
