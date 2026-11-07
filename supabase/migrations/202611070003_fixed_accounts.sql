-- Exactly two reserved roles. Browser registrations and user metadata grant no access.
CREATE TABLE IF NOT EXISTS account_slots (
 role text PRIMARY KEY CHECK (role IN ('teacher','parent')),
 user_id uuid UNIQUE REFERENCES auth.users(id),
 login_name text NOT NULL UNIQUE CHECK(login_name=lower(trim(login_name))),
 provisioning_key uuid, provisioning_at text,
 email text NOT NULL UNIQUE CHECK (email=lower(trim(email))),
 student_id text NOT NULL DEFAULT 'eleve',
 enabled integer NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
 created_at text NOT NULL,
 revoked_at text
);
ALTER TABLE account_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE account_slots FROM anon,authenticated;

-- Preserve an unambiguous existing owner; never choose arbitrarily among accounts.
INSERT INTO account_slots (role,user_id,email,login_name,student_id,enabled,created_at,revoked_at)
SELECT 'teacher',t.user_id,lower(trim(t.email)),lower(trim(t.email)),'eleve',1,t.created_at,NULL
FROM app_teachers t
WHERE t.revoked_at IS NULL AND (SELECT count(*) FROM app_teachers WHERE revoked_at IS NULL)=1
ON CONFLICT DO NOTHING;

INSERT INTO account_slots (role,user_id,email,login_name,student_id,enabled,created_at,revoked_at)
SELECT 'parent',u.id,lower(trim(p.email)),'parent',p.student_id,1,p.created_at,NULL
FROM parent_accounts p LEFT JOIN auth.users u ON lower(u.email)=lower(p.email)
WHERE p.revoked_at IS NULL AND p.delivery_status='sent'
 AND (SELECT count(*) FROM parent_accounts WHERE revoked_at IS NULL AND delivery_status='sent')=1
ON CONFLICT DO NOTHING;

-- Old bearer links cannot bypass the two account slots.
UPDATE grants SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP::text);
UPDATE parent_invitations SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP::text) WHERE used_at IS NULL;
