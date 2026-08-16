CREATE TABLE IF NOT EXISTS candidate_credentials (
  candidate_profile_id Utf8 NOT NULL,
  credential_id Utf8 NOT NULL,
  credential_type Utf8 NOT NULL,
  credential_title Utf8 NOT NULL,
  credential_issuer Utf8 NOT NULL,
  credential_description Utf8 NOT NULL,
  issued_year Utf8 NOT NULL,
  evidence_url Utf8 NOT NULL,
  credential_visibility Utf8 NOT NULL,
  verification_status Utf8 NOT NULL,
  verification_note Utf8 NOT NULL,
  created_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  purge_at Timestamp NOT NULL,
  PRIMARY KEY (candidate_profile_id, credential_id),
  INDEX credential_review GLOBAL ON (verification_status, updated_at)
)
WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS employer_organizations (
  organization_id Utf8 NOT NULL,
  display_name Utf8 NOT NULL,
  legal_name Utf8 NOT NULL,
  organization_domain Utf8 NOT NULL,
  website_url Utf8 NOT NULL,
  organization_description Utf8 NOT NULL,
  verification_status Utf8 NOT NULL,
  organization_status Utf8 NOT NULL,
  created_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  purge_at Timestamp NOT NULL,
  PRIMARY KEY (organization_id),
  INDEX organization_domain GLOBAL ON (organization_domain)
)
WITH (TTL = Interval("PT0S") ON purge_at);

ALTER TABLE employer_accounts ADD COLUMN organization_id Utf8;
ALTER TABLE employer_accounts ADD COLUMN employer_role Utf8;

CREATE TABLE IF NOT EXISTS candidate_employer_conversations (
  candidate_profile_id Utf8 NOT NULL,
  conversation_id Utf8 NOT NULL,
  invitation_id Utf8 NOT NULL,
  employer_id Utf8 NOT NULL,
  organization_id Utf8 NOT NULL,
  organization_name Utf8 NOT NULL,
  candidate_alias Utf8 NOT NULL,
  role_title Utf8 NOT NULL,
  conversation_state Utf8 NOT NULL,
  candidate_unread_count Uint32 NOT NULL,
  employer_unread_count Uint32 NOT NULL,
  last_message_at Timestamp NOT NULL,
  created_at Timestamp NOT NULL,
  updated_at Timestamp NOT NULL,
  purge_at Timestamp NOT NULL,
  PRIMARY KEY (candidate_profile_id, conversation_id),
  INDEX employer_conversations GLOBAL ON (employer_id, conversation_id),
  INDEX invitation_conversation GLOBAL ON (invitation_id)
)
WITH (TTL = Interval("PT0S") ON purge_at);

CREATE TABLE IF NOT EXISTS candidate_employer_messages (
  conversation_id Utf8 NOT NULL,
  message_id Utf8 NOT NULL,
  client_message_id Utf8 NOT NULL,
  sender_type Utf8 NOT NULL,
  message_text Utf8 NOT NULL,
  created_at Timestamp NOT NULL,
  purge_at Timestamp NOT NULL,
  PRIMARY KEY (conversation_id, message_id)
)
WITH (TTL = Interval("PT0S") ON purge_at);
