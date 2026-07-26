ALTER TABLE ranking_profiles ADD COLUMN management_token_hash Utf8;
ALTER TABLE ranking_profiles ADD COLUMN consented_at Timestamp;
ALTER TABLE ranking_profiles ADD COLUMN expires_at Timestamp;
