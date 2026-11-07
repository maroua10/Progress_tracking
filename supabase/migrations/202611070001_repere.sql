-- Exécuter avec le propriétaire PostgreSQL du projet Supabase.
CREATE TABLE IF NOT EXISTS "owners" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "students" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"title" text NOT NULL,
	"initial_state" text NOT NULL,
	"partial" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "grids" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"version" integer NOT NULL,
	"skills" text NOT NULL,
	"source" text NOT NULL,
	"validated" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "chapter_events" (
 "rowid" bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text NOT NULL,
	"state" text NOT NULL,
	"note" text NOT NULL,
	"recorded_at" text NOT NULL,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"origin_key" text,
	"date" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"chapter_id" text NOT NULL,
	"draft" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"student_id" text NOT NULL,
	"seq" integer NOT NULL,
	"request_key" text NOT NULL,
	"payload" text NOT NULL,
	"private_note" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" text NOT NULL,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"session_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "grants" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked_at" text,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "report_views" (
	"id" text PRIMARY KEY NOT NULL,
	"viewer_key" text NOT NULL,
	"session_id" text NOT NULL,
	"seq" integer NOT NULL,
	"viewed_at" text NOT NULL,
	FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "resource_events" (
 "rowid" bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"kind" text NOT NULL,
	"resource_id" text NOT NULL,
	"action" text NOT NULL,
	"recorded_at" text NOT NULL,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "report_pdfs" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_id" text NOT NULL,
	"student_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"template_version" text NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("revision_id") REFERENCES "revisions"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "chapter_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"payload" text NOT NULL,
	"storage_key" text,
	"size" integer,
	"sha256" text,
	"created_at" text NOT NULL,
	FOREIGN KEY ("student_id") REFERENCES "students"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "grants_token_hash_unique" ON "grants" ("token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "grid_version" ON "grids" ("chapter_id","version");

CREATE UNIQUE INDEX IF NOT EXISTS "owners_user_id_unique" ON "owners" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "revisions_request_key_unique" ON "revisions" ("request_key");

CREATE UNIQUE INDEX IF NOT EXISTS "session_revision" ON "revisions" ("session_id","seq");

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_origin_key_unique" ON "sessions" ("origin_key");

CREATE INDEX IF NOT EXISTS "session_date" ON "sessions" ("student_id","date");

CREATE UNIQUE INDEX IF NOT EXISTS "viewer_session" ON "report_views" ("viewer_key","session_id");

CREATE UNIQUE INDEX IF NOT EXISTS "report_pdfs_revision_id_unique" ON "report_pdfs" ("revision_id");

CREATE TABLE IF NOT EXISTS app_teachers (user_id uuid PRIMARY KEY REFERENCES auth.users(id), email text NOT NULL, created_at text NOT NULL, revoked_at text);
CREATE TABLE IF NOT EXISTS parent_accounts (id uuid PRIMARY KEY, student_id text NOT NULL REFERENCES students(id), email text NOT NULL UNIQUE, label text NOT NULL, delivery_status text NOT NULL DEFAULT 'pending', created_at text NOT NULL, revoked_at text);


ALTER TABLE "owners" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "owners" FROM anon, authenticated;

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "students" FROM anon, authenticated;

ALTER TABLE "chapters" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "chapters" FROM anon, authenticated;

ALTER TABLE "grids" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "grids" FROM anon, authenticated;

ALTER TABLE "chapter_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "chapter_events" FROM anon, authenticated;

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "sessions" FROM anon, authenticated;

ALTER TABLE "revisions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "revisions" FROM anon, authenticated;

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "documents" FROM anon, authenticated;

ALTER TABLE "grants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "grants" FROM anon, authenticated;

ALTER TABLE "report_views" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "report_views" FROM anon, authenticated;

ALTER TABLE "resource_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "resource_events" FROM anon, authenticated;

ALTER TABLE "report_pdfs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "report_pdfs" FROM anon, authenticated;

ALTER TABLE "chapter_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "chapter_reports" FROM anon, authenticated;

ALTER TABLE "app_teachers" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "app_teachers" FROM anon, authenticated;

ALTER TABLE "parent_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "parent_accounts" FROM anon, authenticated;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('repere-private','repere-private',false,10485760,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS auth_attempts (key text NOT NULL, "window" text NOT NULL, count integer NOT NULL, PRIMARY KEY(key,"window"));
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth_attempts FROM anon, authenticated;
CREATE TABLE IF NOT EXISTS pending_uploads (id uuid PRIMARY KEY,student_id text NOT NULL REFERENCES students(id),session_id text NOT NULL REFERENCES sessions(id),storage_key text NOT NULL,name text NOT NULL,expires_at text NOT NULL);
ALTER TABLE pending_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pending_uploads FROM anon, authenticated;
