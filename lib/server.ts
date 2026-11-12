import { env, resolveAccount } from "./runtime";
import { chapterCatalogue } from "./catalogue";
import { programme, sourceBase, referenceDocument } from "./programme";
import {
  hiddenResources,
  addDays,
  isoWeek,
  latestRevisions,
  metrics,
  validDate,
  weekCutoff,
  todayParis,
  type Report,
  type Revision,
  type Skill,
  type Activity,
} from "./domain";
import type { ChapterSnapshot } from "./chapter-pdf";
import { reportPdfName, REPORT_PDF_TEMPLATE } from "./report-metadata";
const studentId = "eleve";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}
export const db = () => {
  if (!env.DB) fail(503, "La base de données n’est pas configurée.");
  return env.DB!;
};
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const parse = (s: string) => JSON.parse(s);
export async function hash(s: string | ArrayBuffer) {
  const bytes = typeof s === "string" ? new TextEncoder().encode(s) : s;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function rows(sql: string, ...args: unknown[]) {
  return (
    await db()
      .prepare(sql)
      .bind(...args)
      .all<any>()
  ).results;
}
export async function one(sql: string, ...args: unknown[]) {
  return db()
    .prepare(sql)
    .bind(...args)
    .first<any>();
}
const parentCookie = (r: Request) =>
  r.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("orbite_parent="))
    ?.slice(14);
export async function identity(r: Request) {
  if (resolveAccount) {
    const account = await resolveAccount();
    if (!account) fail(401, "Connectez-vous avec l’un des deux comptes autorisés.");
    return account;
  }
  const p = parentCookie(r);
  if (p) {
    const grant = await one(
      "SELECT id,student_id FROM grants WHERE token_hash=? AND revoked_at IS NULL",
      await hash(p),
    );
    if (!grant) fail(401, "Ce lien de consultation a été révoqué.");
    return {
      role: "parent",
      studentId: grant.student_id,
      userId: null,
      viewerKey: "parent:" + grant.id,
    };
  }
  const userId = r.headers.get("oai-authenticated-user-id");
  if (!userId) fail(401, "Connectez-vous pour accéder au suivi.");
  const owner = await one("SELECT user_id FROM owners WHERE id=?", "teacher");
  if (!owner || owner.user_id !== userId)
    fail(403, "Cet espace est réservé aux comptes autorisés.");
  return { role: "teacher", studentId, userId, viewerKey: "teacher:" + userId };
}
export async function teacher(r: Request) {
  const actor = await identity(r);
  requireTeacher(actor);
  return actor;
}
function requireTeacher(actor: { role: string }) {
  if (actor.role !== "teacher") fail(403, "L’espace de consultation est en lecture seule.");
}
function checkOrigin(r: Request) {
  const origin = r.headers.get("origin");
  if (!origin || origin !== new URL(r.url).origin)
    fail(403, "Origine de la requête non autorisée.");
  if (r.headers.get("sec-fetch-site") === "cross-site")
    fail(403, "Requête externe refusée.");
}
async function body(r: Request): Promise<any> {
  if (Number(r.headers.get("content-length") || 0) > 200000)
    fail(413, "Le formulaire est trop volumineux.");
  try {
    return await r.json();
  } catch {
    return fail(400, "Les données du formulaire sont illisibles.");
  }
}
const text = (v: unknown, max = 4000) => {
  if (typeof v !== "string" || v.length > max)
    fail(400, "Un champ est invalide ou trop long.");
  return v as string;
};
async function gridFor(id: string) {
  const g = await one("SELECT * FROM grids WHERE id=?", id);
  if (!g) fail(400, "La version de grille est introuvable.");
  return { ...g, skills: parse(g.skills), source: parse(g.source) };
}
function mapRevision(r: any): Revision {
  const { pdf_name, pdf_size, ...rest } = r;
  const payload = parse(r.payload);
  return {
    ...rest,
    payload,
    pdf: {
      id: r.id,
      kind: "report",
      sessionId: r.session_id,
      name: pdf_name || reportPdfName(payload, r.seq),
      url: "/api/reports/" + r.session_id + "/pdf?revision=" + r.seq,
      revision: r.seq,
      ...(pdf_size ? { size: pdf_size } : {}),
    },
  };
}
async function allRevisions() {
  return (
    await rows(
      "SELECT r.id,r.session_id,r.seq,r.payload,r.reason,r.recorded_at,p.name AS pdf_name,p.size AS pdf_size FROM revisions r LEFT JOIN report_pdfs p ON p.revision_id=r.id WHERE r.student_id=? ORDER BY r.recorded_at,r.seq",
      studentId,
    )
  ).map(mapRevision);
}
async function reportInput(input: any, publishing = false) {
  if (!input || !validDate(input.date)) fail(400, "Indiquez une date valide.");
  const grid = await gridFor(text(input.gridId, 100));
  if (input.summary !== undefined && (!input.summary || typeof input.summary !== "object" || Array.isArray(input.summary))) fail(400,"La synthèse du bilan est invalide.");
  if (grid.chapter_id !== input.chapterId)
    fail(400, "La grille ne correspond pas au chapitre.");
  const skills = grid.skills as Skill[];
  if (!Array.isArray(input.activities) || input.activities.length > 300)
    fail(400, "Le nombre d’activités est invalide.");
  const activities = input.activities.map((a: any) => {
    if (!skills.some((s) => s.id === a.skillId) && (publishing || a.skillId !== "" || a.level !== null))
      fail(400, "Choisissez une notion de la grille.");
    if (!["cours", "td", "evaluation"].includes(a.type))
      fail(400, "Choisissez un type de travail.");
    if (a.level !== null && ![0, 25, 50, 75, 100].includes(a.level))
      fail(400, "Le niveau de maîtrise est invalide.");
    return {
      id: text(a.id, 100),
      skillId: a.skillId,
      type: a.type,
      level: a.level,
      confirmed: a.level === 100 && a.confirmed === true,
      ...(a.estimated === true ? {estimated:true} : {}),
      ...(a.evidence ? {evidence:text(a.evidence,1000).trim()} : {}),
      workRef: text(a.workRef || "", 200).trim(),
      exercises: text(a.exercises || "", 2000),
      ...(a.workId ? {workId: text(a.workId,100)} : {}),
      ...(a.documentIds !== undefined ? {documentIds: Array.isArray(a.documentIds) && a.documentIds.length <= 40 ? [...new Set(a.documentIds.map((id:unknown)=>text(id,100)))] : fail(400,"Supports de l’activité invalides.")} : {}),
    };
  });
  if (input.performances !== undefined && (!Array.isArray(input.performances) || input.performances.length > 30)) fail(400, "Maximum 30 résultats chronométrés par séance.");
  const performances = (input.performances || []).map((p: any) => {
    const score = p.score === null || p.score === undefined ? null : Number(p.score);
    const scale = p.scale === null || p.scale === undefined ? null : Number(p.scale);
    const minutes = p.minutes === null || p.minutes === undefined ? null : Number(p.minutes);
    if (!["td", "evaluation", "exercice"].includes(p.type) || !text(p.title || "Résultat",160).trim()) fail(400,"Donnez un intitulé et un type au résultat.");
    if ((score !== null && (!Number.isFinite(score) || score < 0)) || (scale !== null && (!Number.isFinite(scale) || scale <= 0)) || (minutes !== null && (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440))) fail(400,"Note, barème ou durée invalide.");
    if (publishing && ((score === null) !== (scale === null) || (score !== null && score > scale!) || (score === null && minutes === null))) fail(400,"Renseignez une note avec son barème, ou une durée positive.");
    return {id:text(p.id,100),title:text(p.title || "Résultat",160).trim(),type:p.type,score,scale,minutes,...(p.workId ? {workId:text(p.workId,100)} : {})};
  });
  const assessmentMinutes=input.assessmentMinutes===null || input.assessmentMinutes===undefined ? null : Number(input.assessmentMinutes);
  if(assessmentMinutes!==null && (!Number.isFinite(assessmentMinutes) || assessmentMinutes<=0 || assessmentMinutes>1440)) fail(400,"La durée du contrôle doit être positive et inférieure à 1 440 minutes.");
  const score = input.score === null ? null : Number(input.score),
    scale = input.scale === null ? null : Number(input.scale);
  if (
    publishing &&
    ((score === null) !== (scale === null) ||
      (score !== null &&
        (!Number.isFinite(score) ||
          !Number.isFinite(scale) ||
          scale! <= 0 ||
          score < 0 ||
          score > scale!)))
  )
    fail(400, "La note doit être comprise entre 0 et son barème.");
  if (!Array.isArray(input.documentIds) || input.documentIds.length > 40)
    fail(400, "La liste des documents est invalide.");
  const documentIds = [...new Set(input.documentIds)] as string[];
  const bundles = new Map<string, typeof activities>();
  for (const activity of activities) {
    if (activity.documentIds?.some((id:string)=>!documentIds.includes(id))) fail(400,"Un support de l’activité manque dans le bilan.");
    if (activity.workId) bundles.set(activity.workId,[...(bundles.get(activity.workId) || []),activity]);
  }
  for (const members of bundles.values()) {
    if (new Set(members.map((a:Activity)=>a.skillId)).size !== members.length || members.some((a:Activity)=>a.type!==members[0].type || JSON.stringify(a.documentIds || [])!==JSON.stringify(members[0].documentIds || []))) fail(400,"Les notions d’une même activité doivent partager le type et les supports, sans doublon.");
  }
  const hidden = hiddenResources(await lifecycle(), "document");
  for (const id of documentIds) {
    if (hidden.has(id))
      fail(
        400,
        "Un document est dans la corbeille. Retirez-le du bilan ou restaurez-le.",
      );
    if (
      !(await one(
        "SELECT id FROM documents WHERE id=? AND student_id=?",
        text(id, 100),
        studentId,
      ))
    )
      fail(400, "Un document n’appartient pas à cet élève.");
  }
  return {
    date: input.date,
    title: text(input.title, 160).trim(),
    chapterId: grid.chapter_id,
    gridId: grid.id,
    skills,
    activities,
    documentIds,
    comment: text(input.comment || ""),
    ...(input.summary ? {summary:Object.fromEntries(["objective","strengths","focus","nextStep"].map(key=>[key,text(input.summary[key] || "",1200).trim()]))} : {}),
    privateNote: text(input.privateNote || ""),
    score,
    scale,
    assessmentTitle: text(input.assessmentTitle || "", 160),
    assessmentMinutes,
    performances,
    partial: input.partial === true,
  } as Report;
}
function blankReport(date: string, g: any): Report {
  return {
    date,
    title: "",
    chapterId: g.chapter_id,
    gridId: g.id,
    skills: g.skills,
    activities: [],
    documentIds: [],
    comment: "",
    privateNote: "",
    score: null,
    scale: null,
    assessmentTitle: "",
    assessmentMinutes: null,
    partial: false,
  };
}

async function lifecycle() {
  return rows(
    "SELECT * FROM resource_events WHERE student_id=? ORDER BY recorded_at,rowid",
    studentId,
  );
}
async function pdfContext(report: Report, seq: number, at: string) {
  const student = await one("SELECT name FROM students WHERE id=?", studentId),
    chapter = await one(
      "SELECT title FROM chapters WHERE id=? AND student_id=?",
      report.chapterId,
      studentId,
    );
  return {
    studentName: report.studentName || student.name,
    chapterTitle: report.chapterTitle || chapter.title,
    revision: seq,
    publishedAt: at,
    documents: await rows(
      "SELECT id,name FROM documents WHERE student_id=?",
      studentId,
    ),
  };
}

async function chapterSnapshot(id: string, cutoff: string, dated: boolean): Promise<ChapterSnapshot> {
  const c=await one("SELECT * FROM chapters WHERE id=? AND student_id=?",id,studentId);
  if(!c) fail(404,"Chapitre introuvable.");
  const g=await one("SELECT * FROM grids WHERE chapter_id=? AND created_at<=? ORDER BY version DESC LIMIT 1",id,cutoff) || await one("SELECT * FROM grids WHERE chapter_id=? ORDER BY version LIMIT 1",id);
  const hidden=hiddenResources(await lifecycle(),"report");
  const published=latestRevisions((await allRevisions()).filter(r=>!hidden.has(r.session_id)),cutoff);
  const chapterReports=published.filter(r=>r.payload.chapterId===id);
  const chapters=await rows("SELECT id,title FROM chapters WHERE student_id=?",studentId);
  const allGrids=await rows("SELECT * FROM grids WHERE created_at<=? ORDER BY version",cutoff);
  const comparisons=chapters.map(ch=>{const grid=allGrids.filter(g=>g.chapter_id===ch.id).at(-1);return{title:ch.title,progression:grid?metrics(published.filter(r=>r.payload.chapterId===ch.id),parse(grid.skills)).progression:null};});
  return {title:c.title,studentName:(await one("SELECT name FROM students WHERE id=?",studentId)).name,closedAt:dated?cutoff:null,partial:!!c.partial,
    reports:chapterReports.map(r=>({date:r.payload.date,title:r.payload.title,comment:r.payload.comment,summary:r.payload.summary,skills:r.payload.skills,activities:r.payload.activities})),comparisons,
    grid:{skills:parse(g.skills),source:parse(g.source)},metrics:metrics(chapterReports,parse(g.skills))};
}
async function closureList(knownChapters?: Awaited<ReturnType<typeof rows>>, knownEvents?: Awaited<ReturnType<typeof rows>>) {
  const chapters=knownChapters || await rows("SELECT * FROM chapters WHERE student_id=?",studentId);
  const events=knownEvents?.filter(e=>e.state === "closed").reverse() || await rows("SELECT * FROM chapter_events WHERE state='closed' AND recorded_at<=? ORDER BY recorded_at DESC",now());
  return chapters.flatMap(c=>[
    ...events.filter(e=>e.chapter_id===c.id).map(e=>({id:e.id,closedAt:e.recorded_at})),
    ...(c.initial_state==='closed'?[{id:'initial-'+c.id,closedAt:null}]:[])
  ].map(e=>({id:e.id,chapterId:c.id,closedAt:e.closedAt,kind:'chapter',name:'Bilan de clôture - '+c.title+(e.closedAt?' - '+new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.closedAt)):''),url:'/api/chapters/'+c.id+'/summary?closure='+encodeURIComponent(e.id)+(e.closedAt?'&layout=latest':'')})));
}
async function ensureDetailedGrids() {
  for (const p of programme) {
    const previous = await one(
      "SELECT * FROM grids WHERE chapter_id=? ORDER BY version DESC LIMIT 1",
      p.id,
    );
    if (
      !previous ||
      previous.validated ||
      previous.version !== 1 ||
      parse(previous.source).catalogueVersion
    )
      continue;
    const expected =
      p.id === "suites"
        ? [
            "su-termes",
            "su-representer",
            "su-arithmetique",
            "su-geo",
            "su-general",
            "su-somme",
            "su-variation",
            "su-modele",
            "su-algo",
            "su-limite",
          ]
        : [
            "sd-formes",
            "sd-racines",
            "sd-discriminant",
            "sd-factoriser",
            "sd-signe",
            "sd-inequation",
            "sd-canonique",
            "sd-probleme",
          ];
    if (
      JSON.stringify(parse(previous.skills).map((s: any) => s.id)) !==
      JSON.stringify(expected)
    )
      continue;
    await db()
      .prepare(
        "INSERT OR IGNORE INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,2,?,?,0,?)",
      )
      .bind(
        p.id + "-v2",
        p.id,
        JSON.stringify(p.skills),
        JSON.stringify({ ...sourceBase, excerpt: p.excerpt }),
        now(),
      )
      .run();
  }
}

async function loadWorkspaceData(actor: Awaited<ReturnType<typeof identity>>, date: string, knownStudent?: Awaited<ReturnType<typeof one>>) {
    if (!validDate(date)) fail(400, "La semaine demandée est invalide.");
    const week = isoWeek(date),
      cutoff = weekCutoff(week.sunday);
    const [life, raw, viewed, chapterRows, gridRows, allEvents, snapshots, scheduled, documentRows, pastRows, student, grants] = await Promise.all([
      lifecycle(), allRevisions(),
      rows("SELECT session_id,seq FROM report_views WHERE viewer_key=?", actor.viewerKey),
      rows("SELECT * FROM chapters WHERE student_id=? ORDER BY created_at,id", studentId),
      rows("SELECT * FROM grids ORDER BY version"),
      rows("SELECT * FROM chapter_events WHERE recorded_at<=? ORDER BY recorded_at,rowid", now()),
      rows("SELECT id,payload FROM chapter_reports WHERE student_id=?", studentId),
      rows("SELECT * FROM sessions WHERE student_id=? AND date>=? AND date<=? ORDER BY date,id", studentId, week.monday, week.sunday),
      rows("SELECT id,session_id,name,size,created_at FROM documents WHERE student_id=? ORDER BY created_at DESC", studentId),
      rows("SELECT id,date,chapter_id,status,draft FROM sessions WHERE student_id=? AND date<=? ORDER BY date DESC,id", studentId, todayParis()),
      knownStudent ? Promise.resolve(knownStudent) : one("SELECT * FROM students WHERE id=?", studentId),
      actor.role === "teacher" ? rows("SELECT id,label,created_at,revoked_at FROM grants WHERE student_id=? ORDER BY created_at DESC", studentId) : Promise.resolve([]),
    ]);
    const hiddenReports = hiddenResources(life, "report"), hiddenDocs = hiddenResources(life, "document");
    const all = raw.filter(x => !hiddenReports.has(x.session_id)), eligible = all.filter(x => x.recorded_at <= cutoff);
    const withViewed = (rs: Revision[]) => rs.map(x => ({...x, viewed: (viewed.find(v => v.session_id === x.session_id)?.seq || 0) >= x.seq}));
    const published = withViewed(latestRevisions(eligible, cutoff)), historyReports = withViewed(latestRevisions(all, now()));
    const events = allEvents.filter(e => e.recorded_at <= cutoff);
    const chapterData = chapterRows.map((c) => {
      const g =
        gridRows
          .filter((g) => g.chapter_id === c.id && g.created_at <= cutoff)
          .at(-1) || gridRows.find((g) => g.chapter_id === c.id);
      const grid = { ...g, skills: parse(g.skills), source: parse(g.source) };
      const current = gridRows.filter(g=>g.chapter_id===c.id).at(-1);
      const ev = events.filter((e) => e.chapter_id === c.id).at(-1);
      const closing = events
        .filter((e) => e.chapter_id === c.id && e.state === "closed")
        .at(-1);
      const closeGrid = closing
        ? gridRows
            .filter(
              (g) =>
                g.chapter_id === c.id && g.created_at <= closing.recorded_at,
            )
            .at(-1) || g
        : null;
      const savedSnapshot=closing && snapshots.find(s=>s.id===closing.id);
      const finalMetrics = savedSnapshot ? parse(savedSnapshot.payload).metrics : closing
        ? metrics(
            latestRevisions(all, closing.recorded_at).filter(
              (x) => x.payload.chapterId === c.id,
            ),
            parse(closeGrid.skills),
          )
        : null;
      return {
        ...c,
        finalMetrics,
        closureGrid: closeGrid
          ? {
              ...closeGrid,
              skills: parse(closeGrid.skills),
              source: parse(closeGrid.source),
            }
          : null,
        closedAt: closing?.recorded_at || null,
        state: ev?.state || c.initial_state,
        stateNote: ev
          ? ev.note || "État renseigné par le professeur"
          : "Situation initiale déclarée · dates inconnues",
        grid,
        ...(actor.role === "teacher" ? {currentGrid:{...current,skills:parse(current.skills),source:parse(current.source)}} : {}),
        metrics: metrics(
          published.filter((x) => x.payload.chapterId === c.id),
          grid.skills,
        ),
      };
    });
    // Cards show the available published report, even if publication happened
    // after that week. Chapter indicators above retain their historical cutoff.
    const weekSessions = scheduled
      .filter((s) => {
        if (hiddenReports.has(s.id)) return false;
        const pub = historyReports.find((p) => p.session_id === s.id);
        return (
          !all.some((p) => p.session_id === s.id) ||
          (!!pub &&
            pub.payload.date >= week.monday &&
            pub.payload.date <= week.sunday)
        );
      })
      .map((s) => {
        const pub = historyReports.find((p) => p.session_id === s.id);
        return {
          id: s.id,
          date: s.date,
          chapterId: s.chapter_id,
          status: pub ? "published" : s.status,
          hasDraft: actor.role === "teacher" && !!s.draft,
          pdf: pub?.pdf,
          preview:
            pub?.payload ||
            (actor.role === "teacher" && s.draft
              ? ((d: Report) => ({
                  title: d.title,
                  chapterId: d.chapterId,
                  skills: d.skills,
                  activities: d.activities,
                  documentIds: d.documentIds,
                }))(parse(s.draft))
              : undefined),
          ...(pub ? { report: pub.payload, revision: pub.seq } : {}),
          ...(actor.role === "teacher" ? { version: s.version } : {}),
        };
      });
    for (const pub of historyReports.filter(
      (x) => x.payload.date >= week.monday && x.payload.date <= week.sunday,
    )) {
      if (!weekSessions.some((s) => s.id === pub.session_id))
        weekSessions.push({
          id: pub.session_id,
          date: pub.payload.date,
          chapterId: pub.payload.chapterId,
          status: "published",
          hasDraft: false,
          preview: pub.payload,
          report: pub.payload,
          pdf: pub.pdf,
          revision: pub.seq,
        });
    }
    const visibleDocIds = new Set(
      all
        .filter((p) => p.recorded_at <= now() && p.payload.date <= todayParis())
        .flatMap((p) => p.payload.documentIds),
    );
    const docs = documentRows.filter(
      (d) =>
        !hiddenDocs.has(d.id) &&
        (actor.role === "teacher" || visibleDocIds.has(d.id)),
    );
    if (!hiddenDocs.has(referenceDocument.id)) docs.unshift(referenceDocument);
    const pastSessions = pastRows
      .filter((s) => !hiddenReports.has(s.id))
      .map((s) => {
        const report = historyReports.find((p) => p.session_id === s.id);
        return {
          id: s.id,
          date: report?.payload.date || s.date,
          chapterId: report?.payload.chapterId || s.chapter_id,
          status: report ? "published" : s.status,
          hasDraft: actor.role === "teacher" && !!s.draft,
          ...(actor.role === "teacher" && s.draft ? {title:parse(s.draft).title} : {}),
          report,
          supportIds: actor.role === "teacher" && !report && s.draft ? parse(s.draft).documentIds : [],
        };
      });
    return {
      role: actor.role,
      student,
      week,
      cutoff,
      chapters: chapterData,
      catalogue: actor.role === "teacher" ? chapterCatalogue : [],
      sessions: weekSessions.sort((a, b) => a.date.localeCompare(b.date)),
      reports: published,
      historyReports,
      historySessions: pastSessions,
      revisions: all.filter(
        (x) => x.recorded_at <= now() && x.payload.date <= todayParis(),
      ),
      documents: docs,
      chapterReports: await closureList(chapterRows, allEvents),
      grants,
    };
}
async function prepareWeek(date: string) {
    if (!validDate(date)) fail(400, "Date invalide.");
    const w = isoWeek(date);
    if (w.monday < isoWeek(todayParis()).monday) return;
    await ensureDetailedGrids();
    const chapters = await rows(
      "SELECT c.*,COALESCE((SELECT state FROM chapter_events e WHERE e.chapter_id=c.id ORDER BY recorded_at DESC,e.rowid DESC LIMIT 1),c.initial_state) state FROM chapters c WHERE student_id=?",
      studentId,
    );
    const chapter =
      chapters.find((c) => c.state === "active") ||
      chapters.find((c) => c.state === "revision") ||
      chapters[0];
    if (!chapter) return;
    // Keep a rolling twelve-week calendar ready, including when a viewer opens
    // the site first. A moved or deleted regular slot retains its origin key.
    const start = isoWeek(todayParis()).monday;
    const weeks = new Set([w.monday, ...Array.from({length:12}, (_, i) => addDays(start, i * 7))]);
    const dates = [...weeks].flatMap(monday => [2, 5, 6].map(n => addDays(monday, n)));
    const existing = await rows("SELECT date,origin_key FROM sessions WHERE student_id=? AND (date>=? OR origin_key>=?)", studentId, start, "regular-" + start);
    const origins = new Set(existing.map(s => s.origin_key)), occupied = new Set(existing.map(s => s.date));
    const missing = dates.filter(d => !origins.has("regular-" + d) && !occupied.has(d));
    if (missing.length) {
      const at = now();
      await db().prepare(
        "INSERT OR IGNORE INTO sessions (id,student_id,origin_key,date,status,chapter_id,version,created_at,updated_at) VALUES " + missing.map(() => "(?,?,?,?,?,?,0,?,?)").join(","),
      ).bind(...missing.flatMap(d => [uid(),studentId,"regular-" + d,d,"planned",chapter.id,at,at])).run();
    }
    return;
}

export async function handle(r: Request, path: string[]) {
  const route = path.join("/");
  if (r.method !== "GET") checkOrigin(r);
  if (route === "context" && r.method === "GET") {
    if (resolveAccount) {
      const actor = await identity(r);
      const student = await one("SELECT id FROM students WHERE id=?", studentId);
      return json({ ...actor, needsSetup: !student && actor.role === "teacher", signedIn: true, accountLogin: true, canReturnToTeacher: false });
    }
    const owner = await one("SELECT user_id FROM owners WHERE id=?", "teacher");
    if (!owner)
      return json({
        needsSetup: true,
        signedIn: !!r.headers.get("oai-authenticated-user-id"),
      });
    const actor=await identity(r);
    return json({...actor,canReturnToTeacher:actor.role === "parent" && r.headers.get("oai-authenticated-user-id") === owner.user_id});
  }
  if (route === "setup" && r.method === "POST") {
    const user = resolveAccount ? (await teacher(r)).userId : r.headers.get("oai-authenticated-user-id");
    if (!user) fail(401, "Connectez-vous avant de créer votre espace.");
    const existing = await one(
      "SELECT user_id FROM owners WHERE id=?",
      "teacher",
    );
    if (!resolveAccount && existing && existing.user_id !== user)
      fail(403, "L’espace appartient déjà à un professeur.");
    const input = await body(r),
      date = now();
    const statements = [
      db()
        .prepare(
          "INSERT OR IGNORE INTO owners (id,user_id,created_at) VALUES (?,?,?)",
        )
        .bind("teacher", user, date),
      db()
        .prepare(
          "INSERT OR IGNORE INTO students (id,name,level) VALUES (?,?,?)",
        )
        .bind(
          studentId,
          text(input.name || "Élève", 80),
          "Première générale · Spécialité mathématiques",
        ),
    ];
    for (const p of programme) {
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO chapters (id,student_id,title,initial_state,partial,created_at) VALUES (?,?,?,?,1,?)",
          )
          .bind(p.id, studentId, p.title, p.initialState, date),
      );
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,1,?,?,0,?)",
          )
          .bind(
            p.id + "-v1",
            p.id,
            JSON.stringify(p.skills),
            JSON.stringify({ ...sourceBase, excerpt: p.excerpt }),
            date,
          ),
      );
    }
    await db().batch(statements);
    return json({ ok: true });
  }
  if (route === "leave-parent" && r.method === "POST")
    return new Response(null, {
      status: 204,
      headers: {
        "Set-Cookie":
          "orbite_parent=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" +
          (new URL(r.url).protocol === "https:" ? "; Secure" : ""),
      },
    });
  const actor = await identity(r);
  if (actor.studentId !== studentId) fail(403, "Élève non autorisé.");
  if (route === "workspace" && r.method === "POST") {
    const input = await body(r), date = input.date || todayParis();
    if (!validDate(date)) fail(400, "La semaine demandée est invalide.");
    const student = await one("SELECT * FROM students WHERE id=?", studentId);
    const context = { ...actor, needsSetup: !student && actor.role === "teacher", signedIn: true, accountLogin: !!resolveAccount, canReturnToTeacher: false };
    if (!student) return json({ context, data: null });
    await prepareWeek(date);
    return json({ context, data: await loadWorkspaceData(actor, date, student) });
  }
  if (route === "data" && r.method === "GET") {
    return json(await loadWorkspaceData(actor, new URL(r.url).searchParams.get("date") || todayParis()));
  }
  if (route === "prepare" && r.method === "POST") {
    requireTeacher(actor);
    await prepareWeek((await body(r)).date);
    return json({ ok: true });
  }
  if (route === "sessions" && r.method === "POST") {
    requireTeacher(actor);
    const input = await body(r);
    if (!validDate(input.date)) fail(400, "Date invalide.");
    if (
      !(await one(
        "SELECT id FROM chapters WHERE id=? AND student_id=?",
        input.chapterId,
        studentId,
      ))
    )
      fail(400, "Chapitre introuvable.");
    const requestKey = input.requestKey == null ? null : text(input.requestKey, 100);
    if (requestKey !== null && !/^[a-zA-Z0-9-]{8,100}$/.test(requestKey)) fail(400, "Clé de création invalide.");
    const originKey = requestKey ? "extra-" + requestKey : null, id = uid();
    await db().prepare("INSERT OR IGNORE INTO sessions (id,student_id,origin_key,date,status,chapter_id,version,created_at,updated_at) VALUES (?,?,?,?,'planned',?,0,?,?)")
      .bind(id, studentId, originKey, input.date, input.chapterId, now(), now()).run();
    const saved = originKey ? await one("SELECT id,date,chapter_id FROM sessions WHERE student_id=? AND origin_key=?",studentId,originKey) : {id,date:input.date,chapter_id:input.chapterId};
    if (!saved || saved.date !== input.date || saved.chapter_id !== input.chapterId || hiddenResources(await lifecycle(),"report").has(saved.id)) fail(409, "Cette demande a déjà été utilisée. Rechargez la liste des séances.");
    return json({ id: saved.id });
  }
  if (path[0] === "sessions" && path[1]) {
    requireTeacher(actor);
    const id = path[1];
    const session = await one(
      "SELECT * FROM sessions WHERE id=? AND student_id=?",
      id,
      studentId,
    );
    if (!session) fail(404, "Séance introuvable.");
    if ((path.length === 2 && r.method === "DELETE") || (path[2] === "restore" && path.length === 3 && r.method === "POST")) {
      const action = r.method === "DELETE" ? "delete" : "restore";
      const hidden = hiddenResources(await lifecycle(), "report");
      if (hidden.has(id) === (action === "delete")) return json({ ok: true });
      const at = now();
      await db().batch([
        db().prepare("INSERT INTO resource_events (id,student_id,kind,resource_id,action,recorded_at) VALUES (?,?,'report',?,?,?)").bind(uid(), studentId, id, action, at),
        db().prepare("UPDATE sessions SET version=version+1,updated_at=? WHERE id=? AND student_id=?").bind(at,id,studentId),
      ]);
      return json({ ok: true });
    }
    if (hiddenResources(await lifecycle(), "report").has(id))
      fail(
        410,
        "Cette séance est dans la corbeille. Restaurez-la avant de la modifier.",
      );
    const revs = (
      await rows("SELECT * FROM revisions WHERE session_id=? ORDER BY seq", id)
    ).map(mapRevision);
    const last = revs.at(-1);
    if (path.length === 2 && r.method === "GET") {
      const g = session.draft
        ? null
        : await gridFor(
            last?.payload.gridId ||
              (
                await one(
                  "SELECT id FROM grids WHERE chapter_id=? ORDER BY version DESC LIMIT 1",
                  session.chapter_id,
                )
              ).id,
          );
      return json({
        session,
        draft: session.draft
          ? parse(session.draft)
          : last
            ? { ...last.payload, privateNote: (last as any).private_note || "" }
            : blankReport(session.date, g),
        revisions: revs,
        documents: await rows(
          "SELECT id,name,size FROM documents WHERE student_id=?",
          studentId,
        ).then(async (ds) => {
          const hidden = hiddenResources(await lifecycle(), "document");
          return ds.filter((d) => !hidden.has(d.id));
        }),
      });
    }
    if (path[2] === "draft" && r.method === "PUT") {
      const input = await body(r),
        report = await reportInput(input.report);
      const res = await db()
        .prepare(
          "UPDATE sessions SET draft=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(JSON.stringify(report), now(), id, input.version)
        .run();
      if (!res.meta.changes)
        fail(
          409,
          "Cette séance a changé dans une autre fenêtre. Votre saisie est conservée ; rechargez après l’avoir récupérée.",
        );
      return json({ version: input.version + 1, savedAt: now() });
    }
    if (["publish", "update"].includes(path[2]) && r.method === "POST") {
      const input = await body(r);
      const prior = await one(
        "SELECT session_id,seq FROM revisions WHERE request_key=?",
        text(input.requestKey, 100),
      );
      if (prior) {
        if (prior.session_id !== id)
          fail(409, "Identifiant de publication déjà utilisé.");
        return json({
          ok: true,
          seq: prior.seq,
          pdfUrl: "/api/reports/" + id + "/pdf?revision=" + prior.seq,
        });
      }
      if (path[2] === "publish" && last)
        fail(409, "Ce bilan est déjà publié. Utilisez Modifier.");
      if (path[2] === "update" && !last)
        fail(400, "Ce bilan doit d’abord être publié.");
      if (session.version !== input.version || !session.draft)
        fail(409, "Enregistrez le brouillon à jour avant de publier.");
      if (session.status === "cancelled")
        fail(400, "Réactivez la séance avant de publier.");
      const report = await reportInput(parse(session.draft), true);
      if (!report.title) fail(400, "Donnez un titre au bilan.");
      if (!report.activities.length)
        fail(400, "Ajoutez au moins une activité.");
      if (report.date > todayParis())
        fail(400, "Une séance future reste prévue jusqu’à sa réalisation.");
      for (const a of report.activities) {
        if (a.type === "td" && !a.workRef && !a.workId)
          fail(400, "Le TD doit être associé à une activité.");
      }
      const grid = await gridFor(report.gridId);
      if (!grid.validated)
        fail(
          400,
          "Validez la grille de compétences du chapitre avant la publication.",
        );
      const reason =
        text(input.reason || "", 1000).trim() ||
        (last ? "Mise à jour du bilan" : "");
      if (!env.BUCKET)
        fail(
          503,
          "Le stockage des PDF n’est pas configuré. Le brouillon est conservé.",
        );
      const { privateNote, ...fields } = report;
      const seq = (last?.seq || 0) + 1,
        at = now(),
        revisionId = uid(),
        context = await pdfContext(report, seq, at);
      const publicReport = {
        ...fields,
        studentName: context.studentName,
        chapterTitle: context.chapterTitle,
      };
      const storageKey = "report-pdfs/" + studentId + "/" + revisionId + ".pdf",
        filename = reportPdfName(publicReport, seq);
      let bytes: Uint8Array;
      try {
        bytes = await (await import("./report-pdf")).renderReportPdf(publicReport, context);
        await env.BUCKET.put(storageKey, bytes, {
          httpMetadata: { contentType: "application/pdf" },
        });
      } catch (e) {
        console.error("Création du PDF", e);
        fail(
          503,
          "Le PDF n’a pas pu être créé. Le bilan reste en brouillon ; réessayez.",
        );
      }
      try {
        const result = await db().batch([
          db()
            .prepare(
              "INSERT INTO revisions (id,session_id,student_id,seq,request_key,payload,private_note,reason,recorded_at) SELECT ?,?,?,?,?,?,?,?,? FROM sessions WHERE id=? AND version=?",
            )
            .bind(
              revisionId,
              id,
              studentId,
              seq,
              input.requestKey,
              JSON.stringify(publicReport),
              privateNote || "",
              reason,
              at,
              id,
              input.version,
            ),
          db()
            .prepare(
              "INSERT INTO report_pdfs (id,revision_id,student_id,storage_key,name,size,sha256,template_version,created_at) SELECT ?,?,?,?,?,?,?,?,? FROM revisions WHERE id=?",
            )
            .bind(
              uid(),
              revisionId,
              studentId,
              storageKey,
              filename,
              bytes.length,
              await hash(bytes.buffer as ArrayBuffer),
              REPORT_PDF_TEMPLATE,
              at,
              revisionId,
            ),
          db()
            .prepare(
              "UPDATE sessions SET date=?,chapter_id=?,draft=NULL,version=version+1,updated_at=? WHERE id=? AND version=?",
            )
            .bind(report.date, report.chapterId, at, id, input.version),
        ]);
        if (!result[0].meta.changes)
          fail(
            409,
            "Le brouillon a changé. Relisez-le avant de l’enregistrer.",
          );
      } catch (e) {
        let checked = false,
          committed: any;
        try {
          committed = await one(
            "SELECT id,session_id,seq FROM revisions WHERE request_key=?",
            input.requestKey,
          );
          checked = true;
        } catch {}
        if (committed?.session_id === id) {
          if (committed.id !== revisionId)
            await env.BUCKET.delete(storageKey).catch(() => {});
          return json({
            ok: true,
            seq: committed.seq,
            pdfUrl: "/api/reports/" + id + "/pdf?revision=" + committed.seq,
          });
        }
        if (checked) await env.BUCKET.delete(storageKey).catch(() => {});
        if (e instanceof ApiError) throw e;
        fail(
          409,
          "Une modification concurrente a été détectée. Votre saisie est conservée. Rechargez le bilan.",
        );
      }
      return json({
        ok: true,
        seq,
        pdfUrl: "/api/reports/" + id + "/pdf?revision=" + seq,
      });
    }
    if (path[2] === "schedule" && r.method === "POST") {
      if (last)
        fail(400, "Modifiez la date dans une correction du bilan publié.");
      const input = await body(r);
      if (
        !validDate(input.date) ||
        !["planned", "cancelled"].includes(input.status)
      )
        fail(400, "Modification invalide.");
      const draft = session.draft
        ? { ...parse(session.draft), date: input.date }
        : null;
      const result = await db()
        .prepare(
          "UPDATE sessions SET date=?,status=?,draft=?,version=version+1,updated_at=? WHERE id=? AND version=?",
        )
        .bind(
          input.date,
          input.status,
          draft ? JSON.stringify(draft) : null,
          now(),
          id,
          input.version,
        )
        .run();
      if (!result.meta.changes) fail(409, "La séance a changé. Rechargez-la.");
      return json({ ok: true });
    }
  }
  if(route === "chapters" && r.method === "POST") {
    requireTeacher(actor);
    const input=await body(r), template=chapterCatalogue.find(p=>p.id===input.templateId);
    if(!template) fail(400,"Choisissez une rubrique du programme.");
    const title=text(input.title || template.title,160).trim();
    if(!title) fail(400,"Indiquez le titre du chapitre.");
    const normalized=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/\s+/g,' ').trim();
    const existing=await rows("SELECT id,title FROM chapters WHERE student_id=?",studentId);
    if(existing.some(c=>c.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/\s+/g,' ').trim()===normalized)) fail(409,"Ce chapitre existe déjà.");
    const id='chapter-'+(await hash(normalized)).slice(0,20), at=now(), start=input.start===true;
    const statements=[db().prepare("INSERT INTO chapters (id,student_id,title,initial_state,partial,created_at) VALUES (?,?,?,?,0,?)").bind(id,studentId,title,start?'active':'revision',at),db().prepare("INSERT INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,1,?,?,?,?)").bind(id+'-v1',id,JSON.stringify(template.skills),JSON.stringify(template.source),input.validated===true?1:0,at)];
    if(start){
      const others=await rows("SELECT c.id,COALESCE((SELECT state FROM chapter_events e WHERE e.chapter_id=c.id ORDER BY recorded_at DESC,e.rowid DESC LIMIT 1),c.initial_state) state FROM chapters c WHERE student_id=?",studentId);
      for(const c of others.filter(c=>c.state==='active')) statements.push(db().prepare("INSERT INTO chapter_events (id,chapter_id,state,note,recorded_at) VALUES (?,?,?,?,?)").bind(uid(),c.id,'revision','Démarrage de '+title,at));
      statements.push(db().prepare("UPDATE sessions SET chapter_id=?,version=version+1,updated_at=? WHERE student_id=? AND origin_key LIKE 'regular-%' AND date>=? AND status='planned' AND draft IS NULL AND NOT EXISTS (SELECT 1 FROM revisions WHERE session_id=sessions.id)").bind(id,at,studentId,todayParis()));
    }
    try{await db().batch(statements);}catch{fail(409,"Le chapitre n’a pas pu être ajouté. Rechargez la liste avant de réessayer.");}
    return json({id},201);
  }
  if(path[0]==="chapters" && path[1] && path[2]==="summary" && r.method==="POST") {
    requireTeacher(actor);
    const input=await body(r),entry=(await closureList()).find(e=>e.chapterId===path[1]&&(!input.closureId||e.id===input.closureId));
    if(!entry?.closedAt)fail(400,"Choisissez un bilan de clôture daté.");
    const requestKey=text(input.requestKey,80),reason=text(input.reason||"",1000).trim();
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestKey)||!reason)fail(400,"Précisez le motif de la correction.");
    const id="edition-"+requestKey,old=await one("SELECT * FROM chapter_reports WHERE id=?",id);
    if(old){if(old.student_id!==studentId||old.chapter_id!==path[1]||parse(old.payload).revisionOf!==entry.id)fail(409,"Identifiant de correction déjà utilisé.");return json({id,url:entry.url+"&edition="+id});}
    const at=now(),snapshot=await chapterSnapshot(path[1],at,true);
    snapshot.closedAt=entry.closedAt;snapshot.revisionOf=entry.id;snapshot.revisionReason=reason;
    await db().prepare("INSERT OR IGNORE INTO chapter_reports (id,student_id,chapter_id,payload,created_at) VALUES (?,?,?,?,?)").bind(id,studentId,path[1],JSON.stringify(snapshot),at).run();
    return json({id,url:entry.url+"&edition="+id});
  }
  if(path[0]==="chapters" && path[1] && path[2]==="summary" && r.method==="GET") {
    if(new URL(r.url).searchParams.get("current")==="1") {
      const snapshot=await chapterSnapshot(path[1],now(),false);
      const report=await (await import("./chapter-narrative")).buildChapterNarrative({...snapshot,currentAt:now()});
      if(!env.LATEX) fail(503,"Le moteur LaTeX n’est pas disponible pour cet export.");
      let bytes:Uint8Array;
      try{bytes=await env.LATEX(report.source,report.files);}catch{fail(503,"Le rapport LaTeX n’a pas pu être composé. Réessayez dans quelques instants.");}
      await identity(r);
      return new Response(bytes as BodyInit,{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent('Synthèse actuelle - '+snapshot.title+'.pdf'),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    }
    const id=path[1], all=await closureList(), closureId=new URL(r.url).searchParams.get("closure");
    const entry=all.find(x=>x.chapterId===id && (!closureId || x.id===closureId));
    if(!entry) fail(404,"Ce chapitre ne possède pas de bilan de clôture.");
    let stored=await one("SELECT * FROM chapter_reports WHERE id=? AND student_id=?",entry.id,studentId);
    if(!stored) {
      const snapshot=await chapterSnapshot(id,entry.closedAt || now(),!!entry.closedAt);
      if(!entry.closedAt) {snapshot.metrics=metrics([],snapshot.grid.skills);snapshot.partial=true;}
      await db().prepare("INSERT OR IGNORE INTO chapter_reports (id,student_id,chapter_id,payload,created_at) VALUES (?,?,?,?,?)").bind(entry.id,studentId,id,JSON.stringify(snapshot),now()).run();
      stored=await one("SELECT * FROM chapter_reports WHERE id=? AND student_id=?",entry.id,studentId);
    }
    if(!env.BUCKET) fail(503,"Le stockage des PDF n’est pas configuré.");
    // Revised layouts are cached separately. The closure's original file,
    // observation snapshot and integrity metadata remain unchanged.
    const layoutLatest=new URL(r.url).searchParams.get("layout")==="latest",editionId=new URL(r.url).searchParams.get("edition");
    let edition=stored;
    if(layoutLatest){
      const editions=await rows("SELECT * FROM chapter_reports WHERE student_id=? AND chapter_id=? ORDER BY created_at DESC,id DESC",studentId,id);
      const candidates=editions.filter(e=>parse(e.payload).revisionOf===entry.id);
      if(editionId){edition=candidates.find(e=>e.id===editionId);if(!edition)fail(404,"Version du bilan introuvable.");}
      else edition=candidates[0]||stored;
    }
    const frozenSnapshot=parse(edition.payload);
    if(entry.closedAt && Array.isArray(frozenSnapshot.reports) && frozenSnapshot.reports.some((r:any)=>!r.activities)){
      const original=await chapterSnapshot(id,edition.created_at,true);
      frozenSnapshot.reports=frozenSnapshot.reports.map((r:any)=>{const history=original.reports?.find(h=>h.date===r.date&&h.title===r.title);return{...r,skills:r.skills||history?.skills,activities:r.activities||history?.activities};});
    }
    const narrativeModule=entry.closedAt && Array.isArray(frozenSnapshot.reports) ? await import("./chapter-narrative") : null;
    const layoutKey=narrativeModule ? "chapter-reports/"+studentId+"/"+edition.id+"/layout-"+narrativeModule.narrativeVersion+".pdf" : null;
    async function cacheLayout(bytes:Uint8Array) {
      if(!layoutKey)return;
      try{await env.BUCKET.put(layoutKey,bytes,{httpMetadata:{contentType:"application/pdf"}});}catch(e){if(!await env.BUCKET.get(layoutKey))throw e;}
    }
    if(!stored.storage_key) {
      const snapshot=parse(stored.payload);
      const narrative=narrativeModule ? await narrativeModule.buildChapterNarrative(snapshot) : null;
      const bytes=narrative ? await env.LATEX(narrative.source,narrative.files) : await (await import("./chapter-pdf")).renderChapterPdf(snapshot), key="chapter-reports/"+studentId+"/"+entry.id+"/"+uid()+".pdf";
      await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:"application/pdf"}});
      const updated=await db().prepare("UPDATE chapter_reports SET storage_key=?,size=?,sha256=? WHERE id=? AND storage_key IS NULL").bind(key,bytes.length,await hash(bytes.buffer as ArrayBuffer),entry.id).run();
      if(!updated.meta.changes) await env.BUCKET.delete(key);
      stored=await one("SELECT * FROM chapter_reports WHERE id=? AND student_id=?",entry.id,studentId);
      if(narrative && edition.id===stored.id)await cacheLayout(bytes);
    }
    if(new URL(r.url).searchParams.get("layout")==="latest" && narrativeModule && layoutKey) {
      let file=await env.BUCKET.get(layoutKey);
      if(!file){
        try{
          const layout=await narrativeModule.buildChapterNarrative(frozenSnapshot);
          const bytes=await env.LATEX(layout.source,layout.files);
          await cacheLayout(bytes);file=await env.BUCKET.get(layoutKey);
        }catch{fail(503,"Le rapport n’a pas pu être composé. Réessayez dans quelques instants.");}
      }
      await identity(r);
      if(!file)fail(503,"Le PDF est temporairement indisponible.");
      let responseBody:BodyInit=file.body;
      if(edition.id!==stored.id&&!edition.storage_key){
        const bytes=new Uint8Array(await new Response(file.body).arrayBuffer());
        await db().prepare("UPDATE chapter_reports SET storage_key=?,size=?,sha256=? WHERE id=? AND student_id=? AND storage_key IS NULL").bind(layoutKey,bytes.length,await hash(bytes.buffer as ArrayBuffer),edition.id,studentId).run();
        responseBody=bytes as BodyInit;
      }
      return new Response(responseBody,{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(entry.name+'.pdf'),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    }
    await identity(r);
    const file=await env.BUCKET.get(stored.storage_key);if(!file) fail(503,"Le PDF est temporairement indisponible.");
    return new Response(file.body,{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(entry.name+'.pdf'),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  if (path[0] === "chapters" && path[1]) {
    requireTeacher(actor);
    const id = path[1];
    if (
      !(await one(
        "SELECT id FROM chapters WHERE id=? AND student_id=?",
        id,
        studentId,
      ))
    )
      fail(404, "Chapitre introuvable.");
    const input = await body(r);
    if (path[2] === "skills" && r.method === "POST") {
      const previous = await one("SELECT * FROM grids WHERE chapter_id=? ORDER BY version DESC LIMIT 1", id);
      const oldSkills = parse(previous.skills) as Skill[];
      const skill: Skill = {id:text(input.skillId,100), label:text(input.label,250).trim(), group:text(input.group || "Compétences complémentaires",120).trim(), weight:1, origin:"teacher", validated:true};
      if (!skill.id || !skill.label || !skill.group || input.validated !== true) fail(400,"Renseignez la compétence et confirmez sa validation.");
      const existing=oldSkills.find(s=>s.id===skill.id);
      if(existing) {
        if(existing.label!==skill.label || existing.group!==skill.group) fail(409,"Cet identifiant est déjà utilisé.");
        return json({grid:await gridFor(previous.id),skill:existing});
      }
      const equivalent=oldSkills.find(s=>s.label.trim().toLocaleLowerCase("fr")===skill.label.toLocaleLowerCase("fr") && (s.group || "Compétences complémentaires").trim().toLocaleLowerCase("fr")===skill.group!.toLocaleLowerCase("fr"));
      if(equivalent)return json({grid:await gridFor(previous.id),skill:equivalent});
      if (oldSkills.length>=200) fail(400,"La grille contient déjà 200 compétences.");
      if (previous.id !== input.baseGridId) fail(409,"La grille a changé. Actualisez-la avant d’ajouter une compétence.");
      const gridId=id+"-v"+(previous.version+1);
      const added=await db().prepare("INSERT OR IGNORE INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(gridId,id,previous.version+1,JSON.stringify([...oldSkills,skill]),previous.source,previous.validated,now()).run();
      if (!added.meta.changes) fail(409,"Une autre modification vient d’être enregistrée. Actualisez la grille.");
      return json({grid:await gridFor(gridId),skill});
    }
    if (path[2] === "state" && r.method === "POST") {
      if (!["active", "closed", "revision"].includes(input.state))
        fail(400, "État invalide.");
      const statements = [];
      if (input.state === "active") {
        const others = await rows(
          "SELECT c.id,COALESCE((SELECT state FROM chapter_events e WHERE e.chapter_id=c.id ORDER BY recorded_at DESC,e.rowid DESC LIMIT 1),c.initial_state) state FROM chapters c WHERE c.student_id=? AND c.id<>?",
          studentId,
          id,
        );
        for (const c of others.filter((c) => c.state === "active"))
          statements.push(
            db()
              .prepare(
                "INSERT INTO chapter_events (id,chapter_id,state,note,recorded_at) VALUES (?,?,?,?,?)",
              )
              .bind(
                uid(),
                c.id,
                "revision",
                "Mis en révision au démarrage d’un autre chapitre",
                now(),
              ),
          );
      }
      const eventId=uid(), at=now();
      statements.push(db().prepare("INSERT INTO chapter_events (id,chapter_id,state,note,recorded_at) VALUES (?,?,?,?,?)").bind(eventId,id,input.state,text(input.note || "",2000),at));
      if(input.state === "closed") {
        const snapshot=await chapterSnapshot(id,at,true);
        statements.push(db().prepare("INSERT INTO chapter_reports (id,student_id,chapter_id,payload,created_at) VALUES (?,?,?,?,?)").bind(eventId,studentId,id,JSON.stringify(snapshot),at));
      }
      await db().batch(statements);
      return json({ ok: true });
    }
    if (path[2] === "refine" && r.method === "POST") {
      const p = programme.find((p) => p.id === id);
      if (!p) fail(400, "Aucun découpage détaillé préparé pour ce chapitre.");
      const previous = await one(
        "SELECT * FROM grids WHERE chapter_id=? ORDER BY version DESC LIMIT 1",
        id,
      );
      if (previous.id !== input.baseGridId)
        fail(409, "La grille a changé. Rechargez le chapitre.");
      const version = previous.version + 1;
      await db()
        .prepare(
          "INSERT INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,?,?,?,0,?)",
        )
        .bind(
          id + "-v" + version,
          id,
          version,
          JSON.stringify(p.skills),
          JSON.stringify({ ...sourceBase, excerpt: p.excerpt }),
          now(),
        )
        .run();
      return json({ ok: true });
    }
    if (path[2] === "grid" && r.method === "POST") {
      if (
        !Array.isArray(input.skills) ||
        !input.skills.length ||
        input.skills.length > 200
      )
        fail(400, "La grille doit contenir de 1 à 200 compétences.");
      const skills = input.skills.map((s: any) => ({
        id: text(s.id, 100),
        label: text(s.label, 250).trim(),
        ...(s.group ? { group: text(s.group, 120) } : {}),
        ...(s.detail ? { detail: text(s.detail, 500) } : {}),
        weight: s.weight === undefined ? 1 : Number(s.weight),
        ...(s.origin === "teacher" ? {origin:"teacher",validated:s.validated===true} : {}),
      }));
      if (
        skills.some((s: any) => !s.label || !Number.isFinite(s.weight) || s.weight <= 0 || s.weight > 100) ||
        new Set(skills.map((s: any) => s.id)).size !== skills.length
      )
        fail(
          400,
          "Chaque compétence doit avoir un identifiant et un libellé distincts.",
        );
      const prev = await one(
        "SELECT * FROM grids WHERE chapter_id=? ORDER BY version DESC LIMIT 1",
        id,
      );
      if (input.baseGridId !== prev.id)
        fail(409, "La grille a changé dans une autre fenêtre. Rechargez-la.");
      const version = prev.version + 1;
      await db()
        .prepare(
          "INSERT INTO grids (id,chapter_id,version,skills,source,validated,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          id + "-v" + version,
          id,
          version,
          JSON.stringify(skills),
          prev.source,
          input.validated === true ? 1 : 0,
          now(),
        )
        .run();
      return json({ ok: true, grid: await gridFor(id + "-v" + version) });
    }
  }
  if (route === "student" && r.method === "PUT") {
    requireTeacher(actor);
    const input = await body(r);
    const name = text(input.name, 80).trim();
    if (!name) fail(400, "Indiquez le prénom de l’élève.");
    await db()
      .prepare("UPDATE students SET name=? WHERE id=?")
      .bind(name, studentId)
      .run();
    return json({ ok: true });
  }
  if (route === "grants" && r.method === "POST") {
    if(resolveAccount) fail(410, "Les liens sans compte sont désactivés.");
    requireTeacher(actor);
    const input = await body(r);
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await db()
      .prepare(
        "INSERT INTO grants (id,student_id,token_hash,label,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(
        uid(),
        studentId,
        await hash(token),
        text(input.label || "Proche", 80),
        now(),
      )
      .run();
    return json({ url: new URL("/p/" + token, r.url).toString() });
  }
  if (path[0] === "grants" && path[1] && r.method === "DELETE") {
    requireTeacher(actor);
    await db()
      .prepare("UPDATE grants SET revoked_at=? WHERE id=? AND student_id=?")
      .bind(now(), path[1], studentId)
      .run();
    return json({ ok: true });
  }
  if (route === "documents" && r.method === "POST") {
    requireTeacher(actor);
    if (!env.BUCKET) fail(503, "Le stockage des PDF n’est pas configuré.");
    const length = Number(r.headers.get("content-length") || 0);
    if (length > 11 * 1024 * 1024)
      fail(413, "Le PDF doit faire moins de 10 Mo.");
    const form = await r.formData(),
      file = form.get("file"),
      sessionId = form.get("sessionId");
    if (
      !(file instanceof File) ||
      file.size > 10 * 1024 * 1024 ||
      file.size < 5
    )
      fail(400, "Choisissez un PDF de moins de 10 Mo.");
    if (
      !(await one(
        "SELECT id FROM sessions WHERE id=? AND student_id=?",
        String(sessionId),
        studentId,
      ))
    )
      fail(400, "Séance introuvable.");
    const bytes = await file.arrayBuffer();
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      fail(400, "Le fichier ne contient pas un PDF valide.");
    const id = uid(),
      key = studentId + "/" + id + ".pdf",
      name =
        file.name.replace(/[\x00-\x1f<>"/\\]/g, "").slice(0, 180) ||
        "document.pdf";
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: "application/pdf" },
    });
    try {
      await db()
        .prepare(
          "INSERT INTO documents (id,student_id,session_id,storage_key,name,size,sha256,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          studentId,
          String(sessionId),
          key,
          name,
          file.size,
          await hash(bytes),
          now(),
        )
        .run();
    } catch (e) {
      await env.BUCKET.delete(key);
      throw e;
    }
    return json({ id, name, size: file.size }, 201);
  }

  if (
    path[0] === "reports" &&
    path[1] &&
    path[2] === "pdf" &&
    r.method === "GET"
  ) {
    const id = path[1],
      life = await lifecycle();
    if (hiddenResources(life, "report").has(id))
      fail(410, "Ce bilan est dans la corbeille.");
    const query = new URL(r.url).searchParams,
      seq = query.has("revision") ? Number(query.get("revision")) : null;
    if (seq !== null && (!Number.isInteger(seq) || seq < 1))
      fail(400, "Version de bilan invalide.");
    const revision =
      seq === null
        ? await one(
            "SELECT * FROM revisions WHERE session_id=? AND student_id=? ORDER BY seq DESC LIMIT 1",
            id,
            studentId,
          )
        : await one(
            "SELECT * FROM revisions WHERE session_id=? AND student_id=? AND seq=?",
            id,
            studentId,
            seq,
          );
    if (!revision || revision.recorded_at > now())
      fail(404, "Ce bilan n’est pas publié.");
    const report = parse(revision.payload) as Report;
    if (report.date > todayParis())
      fail(404, "Ce bilan n’est pas encore consultable.");
    if (!env.BUCKET) fail(503, "Le stockage des PDF est indisponible.");
    let record = await one(
      "SELECT * FROM report_pdfs WHERE revision_id=? AND student_id=?",
      revision.id,
      studentId,
    );
    if (!record) {
      const context = await pdfContext(
          report,
          revision.seq,
          revision.recorded_at,
        ),
        bytes = await (await import("./report-pdf")).renderReportPdf(report, context),
        key =
          "report-pdfs/" + studentId + "/" + revision.id + "-" + uid() + ".pdf";
      await env.BUCKET.put(key, bytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
      try {
        const stored = await db()
          .prepare(
            "INSERT OR IGNORE INTO report_pdfs (id,revision_id,student_id,storage_key,name,size,sha256,template_version,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            uid(),
            revision.id,
            studentId,
            key,
            reportPdfName(report, revision.seq),
            bytes.length,
            await hash(bytes.buffer as ArrayBuffer),
            REPORT_PDF_TEMPLATE,
            now(),
          )
          .run();
        if (!stored.meta.changes) await env.BUCKET.delete(key);
      } catch (e) {
        await env.BUCKET.delete(key);
        throw e;
      }
      record = await one(
        "SELECT * FROM report_pdfs WHERE revision_id=? AND student_id=?",
        revision.id,
        studentId,
      );
    }
    // Check again after generation: revocation or deletion must still take effect.
    await identity(r);
    if (hiddenResources(await lifecycle(), "report").has(id))
      fail(410, "Ce bilan est dans la corbeille.");
    const object = await env.BUCKET.get(record.storage_key);
    if (!object) fail(404, "Le PDF de ce bilan est indisponible.");
    const inline = query.get("view") === "1";
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(record.name),
        ...(inline ? {"Content-Security-Policy":"sandbox; frame-ancestors 'self'"} : {}),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (
    path[0] === "reports" &&
    path[1] &&
    path[2] === "view" &&
    r.method === "POST"
  ) {
    const life = await lifecycle();
    if (hiddenResources(life, "report").has(path[1]))
      fail(404, "Bilan introuvable.");
    const latest = latestRevisions(await allRevisions(), now()).find(
      (p) => p.session_id === path[1],
    );
    if (!latest) fail(404, "Bilan non publié.");
    const input = await body(r);
    if (!Number.isInteger(input.seq) || input.seq < 1 || input.seq > latest.seq)
      fail(400, "Version de bilan invalide.");
    await db()
      .prepare(
        "INSERT INTO report_views (id,viewer_key,session_id,seq,viewed_at) VALUES (?,?,?,?,?) ON CONFLICT(viewer_key,session_id) DO UPDATE SET seq=MAX(report_views.seq,excluded.seq),viewed_at=excluded.viewed_at",
      )
      .bind(uid(), actor.viewerKey, path[1], input.seq, now())
      .run();
    return json({ ok: true });
  }
  if (route === "trash" && r.method === "GET") {
    requireTeacher(actor);
    const life = await lifecycle(),
      hiddenReports = hiddenResources(life, "report"),
      hiddenDocs = hiddenResources(life, "document");
    const reports = latestRevisions(await allRevisions(), now()).filter((p) =>
      hiddenReports.has(p.session_id),
    );
    const docs = (
      await rows(
        "SELECT id,name,size FROM documents WHERE student_id=?",
        studentId,
      )
    ).filter((d) => hiddenDocs.has(d.id));
    if (hiddenDocs.has(referenceDocument.id)) docs.unshift(referenceDocument);
    const sessions = (await rows("SELECT id,date,status,draft FROM sessions WHERE student_id=? ORDER BY date DESC,id", studentId))
      .filter(s => hiddenReports.has(s.id)).map(s => ({id:s.id,date:s.date,status:s.status,title:reports.find(r=>r.session_id===s.id)?.payload.title || (s.draft ? parse(s.draft).title : "") || "Séance"}));
    return json({ reports, sessions, documents: docs });
  }
  if (
    (path[0] === "reports" || path[0] === "documents") &&
    path[1] &&
    (r.method === "DELETE" || (r.method === "POST" && path[2] === "restore"))
  ) {
    requireTeacher(actor);
    const kind = path[0] === "reports" ? "report" : "document",
      id = path[1];
    const exists =
      kind === "report"
        ? await one(
            "SELECT id FROM revisions WHERE session_id=? AND student_id=?",
            id,
            studentId,
          )
        : id === referenceDocument.id
          ? referenceDocument
          : await one(
              "SELECT id FROM documents WHERE id=? AND student_id=?",
              id,
              studentId,
            );
    if (!exists) fail(404, "Élément introuvable.");
    const action = r.method === "DELETE" ? "delete" : "restore",
      hidden = hiddenResources(await lifecycle(), kind);
    if (hidden.has(id) === (action === "delete")) return json({ ok: true });
    await db()
      .prepare(
        "INSERT INTO resource_events (id,student_id,kind,resource_id,action,recorded_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(uid(), studentId, kind, id, action, now())
      .run();
    return json({ ok: true });
  }
  if (path[0] === "documents" && path[1] && r.method === "GET") {
    const life = await lifecycle(),
      hiddenDocs = hiddenResources(life, "document"),
      hiddenReports = hiddenResources(life, "report");
    if (hiddenDocs.has(path[1]))
      fail(410, "Ce document est dans la corbeille.");
    const doc =
      path[1] === referenceDocument.id
        ? { ...referenceDocument }
        : await one(
            "SELECT * FROM documents WHERE id=? AND student_id=?",
            path[1],
            studentId,
          );
    if (!doc) fail(404, "Document introuvable.");
    if (actor.role === "parent" && path[1] !== referenceDocument.id) {
      const published = (await allRevisions()).filter(
        (p) =>
          !hiddenReports.has(p.session_id) &&
          p.recorded_at <= now() &&
          p.payload.date <= todayParis(),
      );
      if (!published.some((p) => p.payload.documentIds.includes(doc.id)))
        fail(403, "Ce PDF n’est pas publié.");
    }
    const inline = new URL(r.url).searchParams.get("view") === "1";
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        (inline ? "inline" : "attachment") +
        "; filename*=UTF-8''" +
        encodeURIComponent(
          doc.name.toLowerCase().endsWith(".pdf")
            ? doc.name
            : doc.name + ".pdf",
        ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(inline
        ? { "Content-Security-Policy": "sandbox; frame-ancestors 'self'" }
        : {}),
    };
    if (path[1] === referenceDocument.id) {
      const bytes = Uint8Array.from(atob((await import("./reference-pdf")).referencePdfBase64), (c) =>
        c.charCodeAt(0),
      );
      return new Response(bytes, { headers });
    }
    const object = await env.BUCKET?.get(doc.storage_key);
    if (!object) fail(404, "Le PDF est indisponible dans le stockage.");
    return new Response(object.body, { headers });
  }
  if (route === "export" && r.method === "GET") {
    requireTeacher(actor);
    const data: any = {
      format: "orbite-export-v1",
      exportedAt: now(),
      student: await one("SELECT * FROM students WHERE id=?", studentId),
    };
    for (const table of [
      "chapters",
      "grids",
      "chapter_events",
      "sessions",
      "revisions",
      "documents",
      "resource_events",
      "report_pdfs",
      "chapter_reports",
    ])
      data[table] = await rows("SELECT * FROM " + table);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orbite-donnees.json"',
        "Cache-Control": "no-store",
      },
    });
  }
  return fail(404, "Cette action est introuvable.");
}
export async function parentExchange(r: Request, token: string) {
  if(resolveAccount) return new Response(null,{status:303,headers:{Location:"/login","Cache-Control":"no-store"}});
  if (!/^[a-f0-9]{64}$/.test(token))
    return json({ error: "Lien invalide." }, 404);
  const digest = await hash(token);
  const grant = await one(
    "SELECT id FROM grants WHERE token_hash=? AND revoked_at IS NULL",
    digest,
  );
  if (!grant)
    return json({ error: "Ce lien a été révoqué ou n’existe pas." }, 403);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": `orbite_parent=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
