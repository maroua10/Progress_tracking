-- A consultation code is now a credential, not a public account identifier.
ALTER TABLE account_slots ADD COLUMN IF NOT EXISTS consultation_code_hash text;
