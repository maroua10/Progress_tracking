export type Skill = {
  id: string;
  label: string;
  group?: string;
  detail?: string;
  weight?: number;
  origin?: "teacher";
  validated?: boolean;
};
export type Activity = {
  id: string;
  skillId: string;
  type: "cours" | "td" | "evaluation";
  level: number | null;
  confirmed: boolean;
  workRef: string;
  exercises: string;
  workId?: string;
  documentIds?: string[];
  estimated?: boolean;
  evidence?: string;
};
// One activity may cover several notions; observations remain separate for history.
export function activityBundles(activities: Activity[]) {
  const bundles = new Map<string, Activity[]>();
  for (const activity of activities) {
    const id = activity.workId || (activity.workRef ? `legacy:${activity.type}:${activity.workRef.trim().toLocaleLowerCase("fr")}` : activity.id);
    bundles.set(id, [...(bundles.get(id) || []), activity]);
  }
  return [...bundles].map(([id, members]) => ({id, activities:members, type:members[0].type, documentIds:[...new Set(members.flatMap(a=>a.documentIds || []))]}));
}
export type Performance = {
  workId?: string;
  id: string; title: string; type: "td" | "evaluation" | "exercice";
  score: number | null; scale: number | null; minutes: number | null;
};
export type Report = {
  date: string;
  title: string;
  chapterId: string;
  gridId: string;
  skills: Skill[];
  activities: Activity[];
  documentIds: string[];
  comment: string;
  score: number | null;
  scale: number | null;
  assessmentTitle: string;
  assessmentMinutes?: number | null;
  partial: boolean;
  performances?: Performance[];
  privateNote?: string;
  studentName?: string;
  chapterTitle?: string;
  summary?: { objective: string; strengths: string; focus: string; nextStep: string };
};

// Summaries use only this session's observations, never the chapter's current levels.
export function reportTopics(report: Report) {
  const observations = new Map<string, Activity>();
  for (const a of report.activities) {
    const previous = observations.get(a.skillId);
    if (!previous || a.level !== null) observations.set(a.skillId, a);
  }
  const groups = new Map<string, {skill: Skill; activity: Activity}[]>();
  for (const [id, activity] of observations) {
    const skill = report.skills.find(s => s.id === id);
    if (!skill) continue;
    const group = skill.group || "Compétences travaillées";
    groups.set(group, [...(groups.get(group) || []), {skill, activity}]);
  }
  return [...groups].map(([title, items]) => {
    const measured = items.filter(i => i.activity.level !== null);
    const total = measured.reduce((n, i) => n + (i.skill.weight || 1), 0);
    return {title, items, evaluated: measured.length, estimated: measured.some(i=>i.activity.estimated),
      level: total ? Math.round(measured.reduce((n,i)=>n+i.activity.level!*(i.skill.weight || 1),0)/total) : null};
  });
}
export type Revision = {
  id: string;
  session_id: string;
  seq: number;
  recorded_at: string;
  payload: Report;
  reason: string;
  pdf?: {
    id: string;
    name: string;
    url: string;
    revision: number;
    size?: number;
    kind: "report";
    sessionId: string;
  };
};
export function todayParis() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addDays(value: string, n: number) {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s + "T12:00:00Z")) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s &&
    s >= "2000-01-01" &&
    s <= "2100-12-31"
  );
}
export function isoWeek(value: string) {
  const d = new Date(value + "T12:00:00Z"),
    day = d.getUTCDay() || 7;
  const monday = addDays(value, 1 - day);
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1, 12));
  const week = Math.ceil(((+d - +first) / 86400000 + 1) / 7);
  return { monday, sunday: addDays(monday, 6), week, year };
}
// Paris midnight ending the selected Sunday; handles DST rather than assuming UTC.
export function weekCutoff(sunday: string) {
  const next = addDays(sunday, 1);
  const noon = new Date(next + "T12:00:00Z");
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(noon),
  );
  return new Date(
    Date.parse(next + "T00:00:00Z") - (hour - 12) * 3600000 - 1,
  ).toISOString();
}
export function latestRevisions(all: Revision[], cutoff: string) {
  const map = new Map<string, Revision>();
  for (const r of all) {
    if (r.recorded_at > cutoff) continue;
    const old = map.get(r.session_id);
    if (!old || r.seq > old.seq) map.set(r.session_id, r);
  }
  return [...map.values()]
    .filter((r) => r.payload.date <= new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(cutoff)))
    .sort(
      (a, b) =>
        a.payload.date.localeCompare(b.payload.date) ||
        a.recorded_at.localeCompare(b.recorded_at) ||
        a.session_id.localeCompare(b.session_id),
    );
}
export function weightedProgress(skills: Skill[], latest: Record<string, {level: number}>) {
  const weight = (s: Skill) => s.weight && s.weight > 0 ? s.weight : 1;
  const total = skills.reduce((sum,s) => sum + weight(s), 0);
  const observed = skills.filter(s => latest[s.id] !== undefined);
  const earned = observed.reduce((sum,s) => sum + latest[s.id].level * weight(s), 0);
  return { value: observed.length && total ? Math.round(earned / total * 100) / 100 : null,
    evaluated: observed.length, total: skills.length, weight: total };
}
export function metrics(revs: Revision[], skills: Skill[]) {
  const latest = new Map<string, { level: number; date: string }>(),
    worked = new Set<string>(),
    tds = new Set<string>(),
    workReferences = new Map<string,string>(),
    exercises = new Set<string>();
  const ids = new Set(skills.map((s) => s.id));
  const curve: {
    date: string;
    mastery: number | null;
    coverage: number;
    introduced: number;
    progression: number | null;
  }[] = [];
  const performances = revs.flatMap(r => (r.payload.performances || []).map(p => ({...p,date:r.payload.date})));
  const assessments: {
    date: string;
    title: string;
    score: number;
    scale: number;
    normalized: number;
    minutes?: number | null;
  }[] = [];
  for (const r of revs) {
    let introduced = 0;
    for (const a of r.payload.activities) {
      if (ids.has(a.skillId)) {
        worked.add(a.skillId);
        if (a.level !== null) {
          if (!latest.has(a.skillId)) introduced++;
          latest.set(a.skillId, { level: a.level, date: r.payload.date });
        }
      }
      if (a.type === "td") {
        const reference = a.workRef.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
        if (a.workId) workReferences.set(a.workId,reference || "activity:" + a.workId);
        if (reference || a.workId) tds.add(reference || "activity:" + a.workId);
      }
      const ref = a.workRef.trim().toLocaleLowerCase("fr") || r.session_id;
      for (const ex of a.exercises
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(Boolean))
        exercises.add(ref + "|" + ex.toLocaleLowerCase("fr"));
    }
    const levels = [...latest.values()].map((x) => x.level);
    curve.push({
      progression: weightedProgress(skills,Object.fromEntries(latest)).value,
      date: r.payload.date,
      mastery: levels.length
        ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)
        : null,
      coverage: skills.length
        ? Math.round((levels.length / skills.length) * 100)
        : 0,
      introduced,
    });
    if (r.payload.score !== null && r.payload.scale)
      assessments.push({
        date: r.payload.date,
        title: r.payload.assessmentTitle,
        score: r.payload.score,
        scale: r.payload.scale,
        normalized: (20 * r.payload.score) / r.payload.scale,
        minutes: r.payload.assessmentMinutes ?? null,
      });
  }
  for (const r of revs) if(r.payload.score === null && r.payload.assessmentMinutes) performances.push({id:r.id+'-duration',date:r.payload.date,title:r.payload.assessmentTitle || 'Contrôle',type:'evaluation',score:null,scale:null,minutes:r.payload.assessmentMinutes});
  for (const p of performances) if (p.type === "td") tds.add(p.workId ? workReferences.get(p.workId) || "activity:"+p.workId : p.title.trim().toLocaleLowerCase("fr").replace(/\s+/g, " "));
  const values = [...latest.values()];
  return {
    total: skills.length,
    evaluated: latest.size,
    worked: worked.size,
    mastered: values.filter((x) => x.level === 100).length,
    mastery: values.length
      ? Math.round(values.reduce((a, b) => a + b.level, 0) / values.length)
      : null,
    coverage: skills.length
      ? Math.round((latest.size / skills.length) * 100)
      : 0,
    progression: weightedProgress(skills, Object.fromEntries(latest)).value,
    evaluations: revs.reduce((n,r) => n + (r.payload.performances || []).filter(p => p.type === "evaluation").length + (r.payload.score !== null || !!r.payload.assessmentMinutes || r.payload.activities.some(a => a.type === "evaluation") ? 1 : 0), 0),
    performances,
    sessions: revs.length,
    tds: tds.size,
    exercises: exercises.size,
    latest: Object.fromEntries(latest),
    curve,
    assessments: [...assessments, ...performances.filter(p => p.score !== null && p.scale).map(p => ({date:p.date,title:p.title,score:p.score!,scale:p.scale!,normalized:20*p.score!/p.scale!}))],
  };
}
export const levelLabels: Record<string, string> = {
  none: "Non évaluée",
  "0": "Ne réussit pas encore, même accompagné",
  "25": "Réussit avec un guidage important",
  "50": "Réussit avec quelques aides",
  "75": "Réussit seul un exercice classique",
  "100": "Réussite observée sur les exercices travaillés",
};

export type ResourceEvent = {
  kind: string;
  resource_id: string;
  action: string;
  recorded_at: string;
};
export function hiddenResources(events: ResourceEvent[], kind: string) {
  const hidden = new Set<string>();
  for (const e of events) {
    if (e.kind !== kind) continue;
    if (e.action === "delete") hidden.add(e.resource_id);
    else if (e.action === "restore") hidden.delete(e.resource_id);
  }
  return hidden;
}

export function performancePoints(m: any): any[] {
  const measured=m.performances || [];
  const additional=measured.filter((p:any)=>p.score !== null && p.scale).length;
  const legacy=m.assessments.slice(0,Math.max(0,m.assessments.length-additional)).map((p:any,i:number)=>({...p,id:"legacy-"+i,type:"evaluation",minutes:p.minutes ?? null}));
  return [...legacy,...measured].sort((a:any,b:any)=>a.date.localeCompare(b.date));
}

export function replaceActivityBundle(report:Report,bundleId:string,members:Activity[]):Report {
  const bundle=activityBundles(report.activities).find(b=>b.id===bundleId);
  if(!bundle)return report;
  const originalIds=new Set(bundle.activities.map(a=>a.id));
  const at=report.activities.findIndex(a=>originalIds.has(a.id));
  const remaining=report.activities.filter(a=>!originalIds.has(a.id));
  remaining.splice(at,0,...members);
  const previousDocs=new Set(bundle.documentIds);
  return {...report,activities:remaining,documentIds:[...new Set([
    ...report.documentIds.filter(id=>!previousDocs.has(id)||remaining.some(a=>a.documentIds?.includes(id))),
    ...members.flatMap(a=>a.documentIds || []),
  ])]};
}
