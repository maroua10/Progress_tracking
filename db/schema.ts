import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const owners = sqliteTable("owners", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  createdAt: text("created_at").notNull(),
});
export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  level: text("level").notNull(),
});
export const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  title: text("title").notNull(),
  initialState: text("initial_state").notNull(),
  partial: integer("partial").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const grids = sqliteTable(
  "grids",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id),
    version: integer("version").notNull(),
    skills: text("skills").notNull(),
    source: text("source").notNull(),
    validated: integer("validated").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("grid_version").on(t.chapterId, t.version)],
);
export const chapterEvents = sqliteTable("chapter_events", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id),
  state: text("state").notNull(),
  note: text("note").notNull(),
  recordedAt: text("recorded_at").notNull(),
});
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    originKey: text("origin_key").unique(),
    date: text("date").notNull(),
    status: text("status").notNull().default("planned"),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id),
    draft: text("draft"),
    version: integer("version").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("session_date").on(t.studentId, t.date)],
);
export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id),
    seq: integer("seq").notNull(),
    requestKey: text("request_key").notNull().unique(),
    payload: text("payload").notNull(),
    privateNote: text("private_note").notNull(),
    reason: text("reason").notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (t) => [uniqueIndex("session_revision").on(t.sessionId, t.seq)],
);
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  key: text("storage_key").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull(),
});
export const grants = sqliteTable("grants", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  tokenHash: text("token_hash").notNull().unique(),
  label: text("label").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

// Append-only lifecycle events preserve deleted publications and document bytes.
export const resourceEvents = sqliteTable("resource_events", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  kind: text("kind").notNull(),
  resourceId: text("resource_id").notNull(),
  action: text("action").notNull(),
  recordedAt: text("recorded_at").notNull(),
});
export const reportViews = sqliteTable(
  "report_views",
  {
    id: text("id").primaryKey(),
    viewerKey: text("viewer_key").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    seq: integer("seq").notNull(),
    viewedAt: text("viewed_at").notNull(),
  },
  (t) => [uniqueIndex("viewer_session").on(t.viewerKey, t.sessionId)],
);

export const reportPdfs = sqliteTable("report_pdfs", {
  id: text("id").primaryKey(),
  revisionId: text("revision_id")
    .notNull()
    .unique()
    .references(() => revisions.id),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  key: text("storage_key").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  templateVersion: text("template_version").notNull(),
  createdAt: text("created_at").notNull(),
});

export const chapterReports = sqliteTable("chapter_reports", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  payload: text("payload").notNull(),
  key: text("storage_key"),
  size: integer("size"),
  sha256: text("sha256"),
  createdAt: text("created_at").notNull(),
});
