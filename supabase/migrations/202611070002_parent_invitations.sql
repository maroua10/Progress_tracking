CREATE TABLE IF NOT EXISTS parent_invitations (
 id uuid PRIMARY KEY, student_id text NOT NULL REFERENCES students(id), token_hash text NOT NULL UNIQUE,
 created_at text NOT NULL, expires_at text NOT NULL, revoked_at text, used_at text, claimed_user_id uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS invitation_claims (
 id uuid PRIMARY KEY, invitation_id uuid NOT NULL REFERENCES parent_invitations(id), email text NOT NULL, created_at text NOT NULL
);
ALTER TABLE parent_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE parent_invitations,invitation_claims FROM anon,authenticated;
