"use client";
import {installPdfCompatibility} from "../lib/pdf-compatibility.mjs";
import ActivityEditor from "./activity-editor";
import ChapterVisualSummary from "./chapter-visual-summary";
import ReportOverview from "./report-overview";
import SkillQuickAdd from "./skill-quick-add";
import {activityBundles,replaceActivityBundle} from "../lib/domain";
import ParentAccounts from "../components/parent-accounts";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { referenceDocument } from "../lib/programme";
import {
  addDays,
  isoWeek,
  todayParis,
  levelLabels,
  weightedProgress,
  performancePoints,
  type Report,
  type Skill,
  type Activity,
} from "../lib/domain";

type AnyData = any;
const DocumentPreviewContext = createContext<
  (doc: AnyData, page?: number) => void
>(() => {});
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = {day:"numeric",month:"long"}) => new Intl.DateTimeFormat("fr-FR",{...options,timeZone:date.length>10?"Europe/Paris":"UTC"}).format(new Date(date.length>10?date:date+"T12:00:00Z"));
const stateLabel: Record<string, string> = {
  active: "En cours",
  closed: "Clôturé",
  revision: "En révision",
  planned: "Prévue",
  cancelled: "Annulée",
  published: "Bilan publié",
};
const workLabel: Record<string, string> = {
  cours: "Cours",
  td: "TD",
  evaluation: "Évaluation",
};
async function api(path: string, method = "GET", body?: unknown): Promise<any> {
  const res = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers:
      body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data: any = res.status === 204 ? {} : await res.json();
  if (res.status === 401) { window.location.assign("/login"); }
  if (!res.ok)
    throw new Error(data.error || "La connexion a échoué. Réessayez.");
  return data;
}
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    week: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-12 4h.01m5 0h.01" />
      </>
    ),
    chapters: (
      <>
        <path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v15" />
      </>
    ),
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zm0 0v6h6M8 14h8m-8 3h5" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
          transform="translate(1 0)"
        />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6M4 20l4-1L21 6a2 2 0 0 0-4-4L4 15z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5m5-13 5 5-5 5M8 12h11" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
function Orbit({ small = false }: { small?: boolean }) {
  return <svg width={small?30:38} height={small?30:38} viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="5" fill="#000091"/><path d="M11 29V11h10a6 6 0 0 1 0 12H11m10 0 8 6" fill="none" stroke="white" strokeWidth="2.5"/><circle cx="29" cy="11" r="2" fill="#7ea7cb"/></svg>;
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    node?.focus();
    function key(e: KeyboardEvent) {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== node)
        return;
      if (e.key === "Escape") close.current();
      if (e.key === "Tab" && node) {
        const els = [
          ...node.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ),
        ];
        const first = els[0],
          last = els.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div className="modal-shade">
      <div
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-orbit">
        <Orbit small />
      </div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
function Mastery({ value }: { value: number | null }) {
  return (
    <span className={"mastery " + (value === 100 ? "success" : "")}>
      <span className="ticks" aria-hidden="true">
        {[0, 25, 50, 75, 100].map((n) => (
          <i key={n} className={value !== null && n <= value ? "on" : ""} />
        ))}
      </span>
      <span>{value === null ? "Non évaluée" : value + " %"}</span>
    </span>
  );
}
function Chart({ metrics: m }: { metrics: AnyData }) {
  const pts = m.curve.filter((p: AnyData) => p.mastery !== null);
  return (
    <div className="chart-wrap">
      <div className="section-line">
        <h3>Progression des compétences</h3>
        <div className="legend"><span className="chart-key" style={{color:'#000091'}}>Progression</span><span className="chart-key" style={{color:'#527a9d'}}>Niveau moyen</span><span className="chart-key" style={{color:'#8b9eb1'}}>Notions évaluées</span>
        </div>
      </div>
      {!pts.length ? (
        <div className="chart-empty">
          <span>100 %</span>
          <div className="chart-lines" />
          <div className="chart-empty-text">
            La courbe commencera à la première observation.
            <small>Aucun niveau de maîtrise renseigné.</small>
          </div>
          <span>0 %</span>
        </div>
      ) : (
        <>
          <svg
            className="chart"
            viewBox="0 0 620 170"
            role="img"
            aria-label="Évolution de la progression, de la maîtrise et de la couverture"
          >
            <g stroke="#dddddd" strokeDasharray="3 5">
              {[20, 80, 140].map((y) => (
                <line key={y} x1="35" y1={y} x2="600" y2={y} />
              ))}
            </g>
            <g fill="#666666" fontSize="11">
              <text x="0" y="25">
                100
              </text>
              <text x="7" y="85">
                50
              </text>
              <text x="14" y="145">
                0
              </text>
            </g>
            {["mastery", "coverage", "progression"].map((key, k) => (
              <g key={key}>
                <polyline
                  points={pts
                    .map(
                      (p: AnyData, i: number) =>
                        `${pts.length === 1 ? 315 : 40 + (i * 550) / (pts.length - 1)},${140 - p[key] * 1.2}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={["#527a9d","#8b9eb1","#000091"][k]}
                  strokeWidth="2"
                  strokeDasharray={k ? "4 4" : undefined}
                />
                {pts.map((p: AnyData, i: number) => (
                  <circle
                    key={i}
                    cx={
                      pts.length === 1 ? 315 : 40 + (i * 550) / (pts.length - 1)
                    }
                    cy={140 - p[key] * 1.2}
                    r="3.5"
                    fill={["#527a9d","#8b9eb1","#000091"][k]}
                  >
                    <title>
                      {dateLabel(p.date)} :{" "}
                      {key === "mastery" ? "niveau moyen" : key === "progression" ? "progression" : "notions évaluées"} {p[key]} %
                      {p.introduced
                        ? " · " +
                          p.introduced +
                          " nouvelle(s) notion(s) évaluée(s)"
                        : ""}
                    </title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
          <div className="chart-dates">
            <span>{dateLabel(pts[0].date)}</span>
            <span>
              {pts.length > 1 ? dateLabel(pts.at(-1).date) : "Une observation"}
            </span>
          </div>
          <details className="chart-table">
            <summary>Consulter les valeurs</summary>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Niveau moyen</th>
                  <th>Notions évaluées</th>
                  <th>Progression</th>
                  <th>Nouvelles notions</th>
                </tr>
              </thead>
              <tbody>
                {pts.map((p: AnyData, i: number) => (
                  <tr key={i}>
                    <td>{dateLabel(p.date)}</td>
                    <td><Percent value={p.mastery}/></td>
                    <td>{p.coverage} %</td>
                    <td><Percent value={p.progression} kind="progress"/></td>
                    <td>{p.introduced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

        </>
      )}
    </div>
  );
}

function PerformanceCharts({ metrics: m }: AnyData) {
  const [kind,setKind] = useState("all");
  const all = performancePoints(m).filter((p:AnyData)=>kind === "all" || p.type === kind);
  const graded = all.filter((p:AnyData)=>p.score !== null && p.scale), timed=all.filter((p:AnyData)=>p.minutes !== null), paired=graded.filter((p:AnyData)=>p.minutes !== null);
  const maxTime = Math.max(1,...timed.map((p:AnyData)=>p.minutes));
  const line = (points:AnyData[], time:boolean) => <svg className="chart result-chart" viewBox="0 0 620 190" role="img" aria-label={time?"Durées mesurées en minutes":"Notes ramenées sur 20"}>
    {[0,0.5,1].map(v=><g key={v}><line x1="45" x2="605" y1={150-v*120} y2={150-v*120} stroke="#ddd"/><text x="0" y={154-v*120}>{Math.round(v*(time?maxTime:20)*10)/10}</text></g>)}
    <polyline fill="none" stroke={time?"#527a9d":"#000091"} strokeWidth="2" points={points.map((p,i)=>`${points.length===1?320:50+i*550/(points.length-1)},${150-(time?p.minutes/maxTime:p.score/p.scale)*120}`).join(" ")}/>
    {points.map((p,i)=><g key={p.id || i}><circle cx={points.length===1?320:50+i*550/(points.length-1)} cy={150-(time?p.minutes/maxTime:p.score/p.scale)*120} r="5" fill={time?"#527a9d":"#000091"}><title>{dateLabel(p.date)} · {p.title} · {time?p.minutes+" min":p.score+"/"+p.scale+" ("+Math.round(20*p.score/p.scale*10)/10+"/20)"}</title></circle></g>)}
    {points.length>0 && <><text x="45" y="180">{dateLabel(points[0].date)}</text><text x="600" y="180" textAnchor="end">{dateLabel(points.at(-1).date)}</text></>}
  </svg>;
  return <section className="performance-charts"><div className="section-line"><h3>Résultats et temps</h3><label>Travaux<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Tous</option><option value="td">TD</option><option value="evaluation">Évaluations</option><option value="exercice">Exercices</option></select></label></div>
    <div className="performance-grid"><div><h4>Évolution des notes · sur 20</h4>{graded.length?line(graded,false):<p className="chart-empty-text-inline">Aucune note publiée.</p>}</div><div><h4>Durées mesurées · minutes</h4>{timed.length?line(timed,true):<p className="chart-empty-text-inline">Aucun temps renseigné.</p>}</div></div>
    {paired.length>0 && <details className="form-details"><summary>Vue croisée · note et durée</summary><p className="hint">À comparer pour des travaux de difficulté et de longueur proches. Une durée plus courte ne suffit pas à conclure à un progrès.</p><svg className="chart result-chart" viewBox="0 0 620 210" role="img" aria-label="Note sur 20 en abscisse et durée mesurée en ordonnée"><line x1="45" x2="600" y1="165" y2="165" stroke="#777"/><line x1="45" x2="45" y1="30" y2="165" stroke="#777"/><text x="0" y="25">{maxTime} min</text><text x="45" y="190">0/20</text><text x="550" y="190">20/20</text>{paired.map((p:AnyData,i:number)=><circle key={i} cx={45+550*p.score/p.scale} cy={165-125*p.minutes/maxTime} r="6" fill="#000091"><title>{dateLabel(p.date)} · {p.title} : {p.score}/{p.scale} · {p.minutes} min</title></circle>)}</svg></details>}
    {!!all.length && <details className="chart-table"><summary>Voir les résultats ({all.length})</summary><div className="table-scroll"><table><thead><tr><th>Date</th><th>Travail</th><th>Note</th><th>Sur 20</th><th>Temps</th></tr></thead><tbody>{all.map((p:AnyData,i:number)=><tr key={p.id || i}><td>{dateLabel(p.date)}</td><td>{p.title || "Évaluation"}</td><td>{p.score === null?"—":p.score+"/"+p.scale}</td><td>{p.score === null?"—":Math.round(20*p.score/p.scale*10)/10}</td><td>{p.minutes === null?"—":p.minutes+" min"}</td></tr>)}</tbody></table></div></details>}
  </section>;
}

export default function App() {
  const [context, setContext] = useState<AnyData>(null),
    [data, setData] = useState<AnyData>(null),
    [error, setError] = useState(""),
    [date, setDate] = useState(todayParis()),
    [tab, setTab] = useState("week"),
    [chapterId, setChapterId] = useState<string | null>(null),
    [sessionId, setSessionId] = useState<string | null>(null),
    [viewReport, setViewReport] = useState<AnyData>(null),
    [previewDoc, setPreviewDoc] = useState<AnyData>(null),
    [dialog, setDialog] = useState<AnyData>(null),
    [toast, setToast] = useState(""),
    [pending, setPending] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4500);
  };
  const load = useCallback(async () => {
    const n = ++generation.current;
    setError("");
    setRefreshing(true);
    try {
      const result = await api("workspace", "POST", { date });
      const c = result.context;
      if (n !== generation.current) return;
      setContext(c);
      if (c.needsSetup) return;
      const d = result.data;
      if (n === generation.current) {
        setData(d);
        return d;
      }
    } catch (e) {
      if (n === generation.current) setError((e as Error).message);
    } finally {
      if (n === generation.current) setRefreshing(false);
    }
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);
  async function act(fn: () => Promise<unknown>, message: string) {
    setPending(true);
    try {
      await fn();
      setDialog(null);
      notify(message);
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  function openSession(s: AnyData) {
    if (s.report) {
      const revision =
        data.reports.find((r: AnyData) => r.session_id === s.id) ||
        data.historyReports.find((r: AnyData) => r.session_id === s.id);
      setPreviewDoc(s.pdf || revision?.pdf);
    } else if (data.role === "teacher") setSessionId(s.id);
  }
  function remove(kind: string, resource: AnyData) {
    setDialog({ type: "remove", kind, resource });
  }
  function markViewed(sessionId: string, seq: number) {
    setData((d: AnyData) =>
      d
        ? {
            ...d,
            reports: d.reports.map((r: AnyData) =>
              r.session_id === sessionId && r.seq <= seq
                ? { ...r, viewed: true }
                : r,
            ),
            historyReports: d.historyReports.map((r: AnyData) =>
              r.session_id === sessionId && r.seq <= seq
                ? { ...r, viewed: true }
                : r,
            ),
            historySessions: d.historySessions.map((r: AnyData) =>
              r.id === sessionId && r.report && r.report.seq <= seq
                ? { ...r, report: { ...r.report, viewed: true } }
                : r,
            ),
          }
        : d,
    );
  }
  const teacher = data?.role === "teacher",
    current = isoWeek(todayParis()),
    chapter =
      data?.chapters.find((c: AnyData) => c.id === chapterId) ||
      data?.chapters.find((c: AnyData) => c.state === "active") ||
      data?.chapters.find((c: AnyData) => c.state === "revision") || data?.chapters[0],
    active =
      data?.chapters.find((c: AnyData) => c.state === "active") ||
      data?.chapters.find((c: AnyData) => c.state === "revision") ||
      chapter;
  const nav = [
    ["week", "week", "Semaine"],
    ["chapters", "chapters", "Chapitres"],
    ["history", "history", "Historique"],
    ["documents", "file", "Documents"],
  ];
  return (
    <DocumentPreviewContext.Provider
      value={(doc, page = 1) => setPreviewDoc({ ...doc, page })}
    >
      <div className="app-shell">
        <a className="skip" href="#main">
          Aller au contenu
        </a>
        <aside className="sidebar">
          <a href="/" className="brand" aria-label="Repère, accueil">
            <Orbit />
            <span>
              Repère
            </span>
          </a>
          <div className="sidebar-label">ESPACE DE SUIVI</div>
          <nav aria-label="Navigation principale">
            {nav.map(([id, icon, label]) => (
              <button
                key={id}
                aria-label={label}
                className={tab === id ? "nav-item active" : "nav-item"}
                onClick={() => {setTab(id);if(id === "chapters"){setChapterId(null);setDate(todayParis());}}}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {id === "week" && (
                  <span className="nav-week">
                    S{data?.week.week || current.week}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {teacher && (
              <button
                aria-label="Accès de consultation"
                className={"nav-item " + (tab === "access" ? "active" : "")}
                onClick={() => setTab("access")}
              >
                <Icon name="link" />
                <span>Accès de consultation</span>
              </button>
            )}
            {data && <a className="nav-item" href="/auth/password"><Icon name="edit"/><span>Mon mot de passe</span></a>}
            {data && (
              <button
                className="nav-item muted"
                aria-label={teacher ? "Se déconnecter" : "Quitter la consultation"}
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout',{method:'POST'});
                    for (let i=sessionStorage.length-1;i>=0;i--){ const k=sessionStorage.key(i);if(k?.startsWith('orbite-recovery-'))sessionStorage.removeItem(k); }
                    window.location.href='/login';
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <Icon name="logout" />
                <span>
                  {teacher ? "Se déconnecter" : "Quitter la consultation"}
                </span>
              </button>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div>
              <span className="eyebrow">MATHÉMATIQUES</span>

            </div>
            <div className="profile">
              {data && !teacher && context?.canReturnToTeacher && <button className="text-button return-teacher" onClick={async()=>{try{await api('leave-parent','POST');window.location.href='/';}catch(e){notify((e as Error).message);}}}>Espace professeur</button>}
              <span className="role-label">
                {data
                  ? teacher
                    ? "Espace professeur"
                    : "Espace de consultation"
                  : "Espace sécurisé"}
              </span>
              <span className="avatar">
                {data?.student.name.slice(0, 1).toUpperCase() || "O"}
              </span>
            </div>
          </header>
          <main id="main" className="main" tabIndex={-1} aria-busy={refreshing}>
            {data && refreshing && <div className="refresh-status" role="status">Actualisation…</div>}
            {data && error && <div className="refresh-error" role="alert"><span>{error}</span><button className="text-button" onClick={load}>Réessayer</button></div>}
            {!data && (
              <>
                {error ? (
                  <div className="gate panel">
                    <h1>Accès au suivi</h1>
                    <p role="alert">{error}</p>
                    <div className="button-row">
                      <button className="button" onClick={load}>
                        Réessayer
                      </button>
                      <a
                        className="button secondary"
                        href="/login"
                        target="_top"
                      >
                        Se connecter
                      </a>
                      <button
                        className="text-button"
                        onClick={async () => {
                          await api("leave-parent", "POST");
                          window.location.reload();
                        }}
                      >
                        Quitter la consultation
                      </button>
                    </div>
                  </div>
                ) : context?.needsSetup ? (
                  <Setup signedIn={context.signedIn} onDone={load} />
                ) : (
                  <div className="loading" role="status">
                    <div className="skeleton title" />
                    <div className="skeleton panel-height" />
                    <div className="skeleton panel-height" />
                    <span>Chargement du suivi…</span>
                  </div>
                )}
              </>
            )}
            {data && (
              <>
                <div className="page-intro">
                  <div>
                    <h1>
                      {tab === "week"
                        ? "Séances de la semaine"
                        : tab === "chapters"
                          ? "Suivi par chapitre"
                          : tab === "history"
                            ? "Historique des bilans"
                            : tab === "documents"
                              ? "Bilans de chapitre"
                              : "Accès et préférences"}
                    </h1>
                  </div>
                  {teacher && tab === "chapters" && <button className="button" onClick={()=>setDialog({type:"chapter-new"})}><Icon name="plus"/>Ajouter un chapitre</button>}
                  {teacher && ["week", "history"].includes(tab) && (
                    <div className="button-row session-management"><button className="button secondary" onClick={() => setDialog({type:"trash"})}><Icon name="trash"/>Corbeille</button>
                    <button
                      className="button"
                      onClick={() => setDialog({ type: "new" })}
                    >
                      <Icon name="plus" />
                      Ajouter une séance
                    </button></div>
                  )}
                </div>
                {tab === "week" && (
                  <div className="weekbar">
                    <div className="week-selection">
                      <button
                        className="icon-button"
                        aria-label="Semaine précédente"
                        disabled={refreshing}
                        onClick={() => setDate(addDays(data.week.monday, -7))}
                      >
                        <Icon name="left" />
                      </button>
                      <div className="week-title">
                        Semaine {data.week.week}
                        <small>
                          {dateLabel(data.week.monday, {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          —{" "}
                          {dateLabel(data.week.sunday, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Semaine suivante"
                        disabled={refreshing}
                        onClick={() => setDate(addDays(data.week.monday, 7))}
                      >
                        <Icon name="right" />
                      </button>
                    </div>
                    <div className="weekbar-right">
                      {data.week.monday !== current.monday && (
                        <span className="asof">
                          Situation au {dateLabel(data.week.sunday)}
                        </span>
                      )}
                      <button
                        className="button small secondary"
                        disabled={refreshing || data.week.monday === current.monday}
                        onClick={() => setDate(todayParis())}
                      >
                        Cette semaine
                      </button>
                    </div>
                  </div>
                )}
                {tab === "week" && (
                  <>
                    <section className="panel sessions-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">SÉANCES DE LA SEMAINE</span>
                          <h2>
                            Les séances{" "}
                            <span className="count">
                              {data.sessions.length}
                            </span>
                          </h2>
                        </div>

                      </div>
                      {data.sessions.length ? (
                        <div className="session-grid">
                          {data.sessions.map((s: AnyData) => (
                            <article
                              className={
                                "session-card " +
                                (s.status === "cancelled" ? "cancelled" : "")
                              }
                              key={s.id}
                              data-clickable={
                                s.report || teacher ? true : undefined
                              }
                              aria-label={
                                (s.report
                                  ? "Voir le bilan du "
                                  : "Ouvrir la séance du ") +
                                dateLabel(s.date, {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              }
                              onClick={(e) => {
                                if (
                                  !(e.target as HTMLElement).closest("button,a")
                                )
                                  openSession(s);
                              }}
                            >
                              <div className="session-date">
                                <span>
                                  {dateLabel(s.date, { weekday: "long" })}
                                </span>
                                <strong>
                                  {dateLabel(s.date, { day: "2-digit" })}
                                  <small>
                                    {dateLabel(s.date, { month: "short" })}
                                  </small>
                                </strong>
                                <span
                                  className={
                                    "status " +
                                    (s.status === "published" && !s.hasDraft
                                      ? "published"
                                      : s.status === "cancelled"
                                        ? "cancelled"
                                        : s.hasDraft ? "draft" : "planned")
                                  }
                                >
                                  {s.status === "published"
                                    ? "Publié"
                                    : s.hasDraft
                                      ? "Brouillon"
                                      : stateLabel[s.status]}
                                </span>
                              </div>
                              <div className="session-body">
                                <span className="chapter-label">
                                  {
                                    data.chapters.find(
                                      (c: AnyData) =>
                                        c.id ===
                                        (s.preview?.chapterId || s.chapterId),
                                    )?.title
                                  }
                                </span>
                                <h3>
                                  {s.preview?.title ||
                                    (s.status === "cancelled"
                                      ? "Séance annulée"
                                      : "Séance à préparer")}
                                </h3>
                                {s.preview ? (
                                  <>
                                    <ul className="session-notions">
                                      {[
                                        ...new Set<string>(
                                          s.preview.activities.map(
                                            (a: Activity) =>
                                              s.preview.skills.find(
                                                (k: Skill) =>
                                                  k.id === a.skillId,
                                              )?.label,
                                          ),
                                        ),
                                      ]
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((n) => (
                                          <li key={n}>{n}</li>
                                        ))}
                                    </ul>
                                    <div className="work-tags">
                                      {[
                                        ...new Set<string>(
                                          s.preview.activities.map(
                                            (a: Activity) => a.type,
                                          ),
                                        ),
                                      ].map((t) => (
                                        <span key={t}>{workLabel[t]}</span>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="session-placeholder">
                                    {s.status === "cancelled"
                                      ? "Cette séance ne compte pas dans le travail réalisé."
                                      : teacher
                                        ? "Notions, activités et observations à renseigner."
                                        : "Le bilan apparaîtra après sa publication."}
                                  </p>
                                )}
                              </div>
                              <footer>
                                <SessionActions
                                  session={s}
                                  documents={data.documents}
                                  teacher={teacher}
                                  onOpen={() => openSession(s)}
                                  onEdit={() => setSessionId(s.id)}
                                  onDelete={() => remove("sessions", s)}
                                />
                              </footer>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Empty title="Aucune séance sur cette semaine">
                          {data.week.monday < current.monday
                            ? "L’historique commence avec les bilans réellement renseignés."
                            : "Aucune séance prévue ou publiée."}
                        </Empty>
                      )}
                    </section>
                    <Overview
                      chapter={active}
                      onOpen={() => {
                        setChapterId(active.id);
                        setDate(todayParis());setTab("chapters");
                      }}
                    />
                    <div className="previous-line">
                      <div>
                        <span className="eyebrow">CHAPITRES PRÉCÉDENTS</span>
                        <p>
                          {data.chapters
                            .filter((c: AnyData) => c.state === "closed")
                            .map((c: AnyData) => (
                              <button
                                className="previous-chip"
                                key={c.id}
                                onClick={() => {
                                  setChapterId(c.id);
                                  setDate(todayParis());setTab("chapters");
                                }}
                              >
                                {c.title}
                                <span>Clôturé</span>
                                <Icon name="right" size={14} />
                              </button>
                            ))}
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => {setChapterId(null);setDate(todayParis());setTab("chapters");}}
                      >
                        Tous les chapitres <Icon name="arrow" size={15} />
                      </button>
                    </div>
                  </>
                )}
                {tab === "chapters" && (
                  <>
                    <label className="chapter-select">Chapitre
                      <select aria-label="Chapitre" value={chapter.id} onChange={e=>setChapterId(e.target.value)}>{data.chapters.map((c:AnyData)=><option key={c.id} value={c.id}>{c.title} · {stateLabel[c.state]}</option>)}</select>
                    </label>
                    <ChapterDetail key={chapter.id}
                      chapter={chapter}
                      data={data}
                      teacher={teacher}
                      onSkillAdded={load}
                      onEditGrid={() => setDialog({ type: "grid", chapter })}
                      onAdopt={() =>
                        act(
                          () =>
                            api("chapters/" + chapter.id + "/refine", "POST", {
                              baseGridId: chapter.grid.id,
                            }),
                          "Grille détaillée ajoutée. Les anciennes versions sont conservées.",
                        )
                      }
                      onState={(state: string) =>
                        (setChapterId(chapter.id), setDialog({ type: "state", chapter, state }))
                      }
                      onReport={setViewReport}
                      onDelete={(r: AnyData) => remove("reports", r)}
                      onDeleteDocument={(d: AnyData) => remove("documents", d)}
                    />
                  </>
                )}
                {tab === "history" && (
                  <History
                    data={data}
                    onReport={setViewReport}
                    onEdit={(id: string) => setSessionId(id)}
                    onDelete={(r: AnyData) => remove("sessions", r)}
                    onTrash={() => setDialog({ type: "trash" })}
                  />
                )}
                {tab === "documents" && <ChapterArchives entries={data.chapterReports || []} />}
                {tab === "access" && teacher && (
                  <Access
                    data={data}
                    onRename={() => setDialog({ type: "rename" })}
                    onCreate={() => setDialog({ type: "grant" })}
                    onRevoke={(g: AnyData) =>
                      setDialog({ type: "revoke", grant: g })
                    }
                  />
                )}
              </>
            )}
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              className="icon-button"
              aria-label="Fermer le message"
              onClick={() => setToast("")}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
        {sessionId && data && (
          <SessionEditor
            id={sessionId}
            data={data}
            userId={context?.userId}
            onClose={() => setSessionId(null)}
            onChanged={load}
            onPublished={async (id: string) => {
              const fresh = await load();
              const r = fresh?.historyReports.find(
                (r: AnyData) => r.session_id === id,
              );
              if (r) setPreviewDoc(r.pdf);
            }}
            notify={notify}
          />
        )}
        {viewReport && data && (
          <ReportView
            revision={viewReport}
            data={data}
            onClose={() => setViewReport(null)}
            onViewed={markViewed}
            onDelete={
              teacher
                ? () => {
                    setViewReport(null);
                    remove("reports", viewReport);
                  }
                : undefined
            }
            onEdit={
              teacher
                ? () => {
                    setSessionId(viewReport.session_id);
                    setViewReport(null);
                  }
                : undefined
            }
          />
        )}
        {dialog?.type === "trash" && data && (
          <TrashModal
            onClose={() => setDialog(null)}
            onChanged={load}
            notify={notify}
          />
        )}
        {dialog && dialog.type !== "trash" && data && (
          <Dialogs
            dialog={dialog}
            data={data}
            pending={pending}
            close={() => setDialog(null)}
            act={act}
            onNewChapter={(id:string)=>{setChapterId(id);setDate(todayParis());setTab("chapters");}}
            onNew={(id: string, createdDate: string) => {
              setDate(createdDate);
              setTab("week");
              setSessionId(id);
            }}
            notify={notify}
          />
        )}
        {previewDoc && (
          <PdfPreview
            doc={previewDoc}
            onViewed={markViewed}
            onClose={() => setPreviewDoc(null)}
            onEdit={
              teacher && previewDoc.kind === "report"
                ? () => {
                    const id =
                      previewDoc.sessionId ||
                      data.historyReports.find(
                        (r: AnyData) => r.id === previewDoc.id,
                      )?.session_id;
                    if (id) {
                      setPreviewDoc(null);
                      setSessionId(id);
                    }
                  }
                : undefined
            }
          />
        )}
      </div>
    </DocumentPreviewContext.Provider>
  );
}

function Setup({
  signedIn,
  onDone,
}: {
  signedIn: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="gate panel">
      <div className="eyebrow">PREMIÈRE OUVERTURE</div>
      <h1>Votre espace de suivi</h1>
      <p>
        Les chapitres Second degré et Suites numériques sont préparés. Aucun
        bilan passé ni niveau de maîtrise n’est ajouté.
      </p>
      {signedIn ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("setup", "POST", { name: name || "Élève" });
              onDone();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Prénom de l’élève
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="off"
              placeholder="À renseigner"
            />
          </label>
          <p className="hint">
            Ce compte connecté devient le compte professeur. À effectuer avant
            d’ouvrir l’hébergement à d’autres visiteurs.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Création…" : "Créer le suivi"}
          </button>
        </form>
      ) : (
        <a
          className="button"
          href="/login"
          target="_top"
        >
          Se connecter comme professeur <Icon name="arrow" />
        </a>
      )}
    </section>
  );
}
function Percent({value,kind="mastery"}:AnyData) {
  const level=value===null || value===undefined?'none':value>=100?'100':kind==='progress'?'progress':value<=25?'25':value<=50?'50':'75';
  return <span className="percent-value" data-level={level}>{value===null || value===undefined?'Non évalué':Number(value).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %'}</span>;
}
function ChapterIndicators({metrics:m}:AnyData) {
  const fmt=(v:number|null)=>v===null?"Non évalué":v.toLocaleString("fr-FR",{maximumFractionDigits:2})+" %";
  return <div className="chapter-indicators">
    <div className="primary-indicators">
      <div className="progress-indicator"><span>Progression du chapitre</span><strong><Percent value={m.progression} kind="progress"/></strong><div className="summary-track" role="progressbar" aria-label="Progression du chapitre" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.progression ?? undefined} aria-valuetext={fmt(m.progression)}><i style={{width:(m.progression ?? 0)+"%"}}/></div></div>
      <div><span>Notions maîtrisées</span><strong className={m.mastered>0?"confirmed-number":""}>{m.mastered}<small> / {m.total}</small></strong></div>
      <div><span>TD réalisés</span><strong>{m.tds}</strong></div>
      <div><span>Évaluations</span><strong>{m.evaluations}</strong></div>
    </div>
    <div className="secondary-indicators"><span>Notions évaluées <b>{m.evaluated}/{m.total}</b></span><span>Niveau moyen <b><Percent value={m.mastery}/></b></span><span>Séances <b>{m.sessions}</b></span></div>
  </div>;
}
function Overview({chapter:c,onOpen}:AnyData) {
  return <section className="panel overview"><div className="panel-heading"><h2>{c.title}<span className={"status "+c.state}>{stateLabel[c.state]}</span></h2><button className="text-button" onClick={onOpen}>Voir le chapitre<Icon name="arrow" size={16}/></button></div><ChapterIndicators metrics={c.metrics}/></section>;
}
function ChapterDetail({chapter:c,data,teacher,onEditGrid,onAdopt,onState,onDeleteDocument,onSkillAdded}:AnyData) {
  const [sub,setSub]=useState("overview");
  const preview=useContext(DocumentPreviewContext);
  const closure=(data.chapterReports || []).find((d:AnyData)=>d.chapterId===c.id && (!c.closedAt || d.closedAt===c.closedAt));
  const m=c.metrics;
  const currentSummary={id:'current-'+c.id,name:'Synthèse actuelle - '+c.title,url:'/api/chapters/'+c.id+'/summary?current=1',kind:'chapter'};
  const shownGrid=c.grid;
  const reports=data.reports.filter((r:AnyData)=>r.payload.chapterId===c.id);
  const docs=data.documents.filter((d:AnyData)=>reports.some((r:AnyData)=>r.payload.documentIds.includes(d.id)));
  return <section className="panel chapter-detail">
    <div className="panel-heading"><h2>{c.title}<span className={"status "+c.state}>{stateLabel[c.state]}</span></h2><div className="button-row">
      {c.state==='closed' && closure && <><button className="icon-button" aria-label="Visualiser la synthèse actuelle" onClick={()=>preview(currentSummary)}><Icon name="eye"/></button><a className="button small" href={currentSummary.url}><Icon name="download" size={16}/>Télécharger la synthèse</a></>}
      {teacher && <>{c.state!=='active' && <button className="button small secondary" onClick={()=>onState('active')}>Commencer</button>}{c.state==='closed'?<button className="button small secondary" onClick={()=>onState('revision')}>Rouvrir pour révision</button>:<button className="button small secondary" onClick={()=>onState('closed')}>Clôturer le chapitre</button>}</>}
    </div></div>
    <div className="tabs" role="group" aria-label="Rubriques du chapitre">{[['overview','Vue d’ensemble'],['skills','Compétences']].map(([id,label])=><button key={id} className={sub===id?'selected':''} onClick={()=>setSub(id)}>{label}</button>)}</div>
    <div className="chapter-tab-content">
      {sub==='overview' && <><ChapterIndicators metrics={m}/><ChapterVisualSummary chapters={data.chapters} chapter={c} metrics={m} reports={reports}/><ReferenceCard source={shownGrid.source} available={data.documents.some((d:AnyData)=>d.id===referenceDocument.id)}/></>}
      {sub==='skills' && <><div className="section-line"><h3>Compétences</h3>{teacher && <button className="button small secondary" onClick={onEditGrid}>Modifier</button>}</div>{teacher && !c.grid.source.catalogueVersion && <button className="text-button" onClick={onAdopt}>Adopter la grille détaillée</button>}{teacher && <SkillQuickAdd chapterId={c.id} grid={c.currentGrid || c.grid} onAdded={async()=>{await onSkillAdded();}}/>}<SkillChecklist chapter={{...c,grid:c.grid,metrics:c.metrics}}/></>}
    </div>
  </section>;
}
function FileActions({label,docs}:AnyData) {
  const preview=useContext(DocumentPreviewContext),[selected,setSelected]=useState('');
  const doc=docs.find((d:AnyData)=>d.id===selected) || docs[0];
  if(!doc)return null;
  const open=()=>preview(label==='Support'?{...doc,name:docs.length>1?'Support '+(docs.indexOf(doc)+1):'Support'}:doc);
  return <div className="file-action-group" role="group" aria-label={label}>
    {docs.length>1?<select className="file-choice" aria-label="Choisir un support" value={doc.id} onChange={e=>setSelected(e.target.value)}>{docs.map((d:AnyData,i:number)=><option key={d.id} value={d.id}>Support {i+1}</option>)}</select>:<button className="file-label" onClick={open}>{label}</button>}
    <button className="icon-button" aria-label={'Visualiser le '+label.toLocaleLowerCase('fr')} onClick={open}><Icon name="eye" size={17}/></button>
    <a className="icon-button" aria-label={'Télécharger le '+label.toLocaleLowerCase('fr')} href={doc.url || '/api/documents/'+doc.id}><Icon name="download" size={17}/></a>
  </div>;
}
function SessionFiles({pdf,ids=[],documents}:AnyData) {
  const supports=documents.filter((d:AnyData)=>ids.includes(d.id));
  return <div className="session-files">{pdf && <FileActions label="Bilan" docs={[pdf]}/>}<FileActions label="Support" docs={supports}/></div>;
}
function ChapterArchives({entries}:AnyData) {
  const preview=useContext(DocumentPreviewContext);
  return <section className="panel">{!entries.length?<Empty title="Aucun bilan de chapitre"/>:<div className="chapter-archives">{entries.map((d:AnyData)=><div className="archive-row" key={d.id}><span className="pdf-mark">PDF</span><div><h2>{d.name}</h2>{d.closedAt && <time>{dateLabel(d.closedAt,{day:'numeric',month:'long',year:'numeric'})}</time>}</div><button className="icon-button" aria-label={'Visualiser '+d.name} onClick={()=>preview(d)}><Icon name="eye"/></button><a className="icon-button" aria-label={'Télécharger '+d.name} href={d.url}><Icon name="download"/></a></div>)}</div>}</section>;
}
function History({data,onReport,onEdit,onDelete,onTrash}:AnyData) {
  const [chapter,setChapter]=useState(''),[day,setDay]=useState(''),[page,setPage]=useState(1);
  const preview=useContext(DocumentPreviewContext);
  const sessions=[...data.historySessions].filter((s:AnyData)=>(!chapter || s.chapterId===chapter)&&(!day || s.date===day)).sort((a:AnyData,b:AnyData)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(sessions.length/10)),current=Math.min(page,pages),shown=sessions.slice((current-1)*10,current*10);
  return <section className="panel history-panel"><div className="filters history-filters"><label>Chapitre<select value={chapter} onChange={e=>{setChapter(e.target.value);setPage(1);}}><option value="">Tous les chapitres</option>{data.chapters.map((c:AnyData)=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Date de la séance<input type="date" value={day} onChange={e=>{setDay(e.target.value);setPage(1);}}/></label>{day && <button className="text-button" onClick={()=>{setDay('');setPage(1);}}>Effacer la date</button>}{data.role==='teacher' && <button className="icon-button" aria-label="Ouvrir la corbeille" onClick={onTrash}><Icon name="trash"/></button>}</div>
    {!sessions.length?<Empty title="Aucune séance dans cette sélection"/>:<div className="history-entries">{shown.map((s:AnyData)=><article className="history-entry" key={s.id}><div className="history-entry-heading"><time dateTime={s.date}>{dateLabel(s.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</time><span className={"status "+(s.report?"published":s.status==='cancelled'?"cancelled":s.hasDraft?"draft":"planned")}>{s.report?'Publié':s.status==='cancelled'?'Annulée':s.hasDraft?'Brouillon':'À renseigner'}</span></div><div className="history-entry-main"><div><span className="chapter-label">{data.chapters.find((c:AnyData)=>c.id===s.chapterId)?.title}</span><h2>{s.report?.payload.title || s.title || 'Séance'}</h2></div><div className="button-row">{s.report?<><SessionFiles pdf={s.report.pdf} ids={s.report.payload.documentIds} documents={data.documents}/><button className="text-button" onClick={()=>onReport(s.report)}>Détails</button>{data.role==='teacher' && <><button className="button small secondary" onClick={()=>onEdit(s.id)}>Modifier</button><button className="icon-button danger-icon" aria-label={'Supprimer la séance du '+dateLabel(s.date)} onClick={()=>onDelete(s)}><Icon name="trash"/></button></>}</>:data.role==='teacher' && <><button className="button small secondary" onClick={()=>onEdit(s.id)}>Renseigner</button><button className="icon-button danger-icon" aria-label={'Supprimer la séance du '+dateLabel(s.date)} onClick={()=>onDelete(s)}><Icon name="trash"/></button></>}</div></div>{!s.report && <SessionFiles ids={s.supportIds || []} documents={data.documents}/>}</article>)}</div>}
    <nav className="pagination" aria-label="Pages de l’historique"><span>{sessions.length} séance{sessions.length!==1?'s':''}</span><div className="button-row"><button className="icon-button" disabled={current<=1} aria-label="Page précédente" onClick={()=>setPage(current-1)}><Icon name="left"/></button><span aria-live="polite">{current} / {pages}</span><button className="icon-button" disabled={current>=pages} aria-label="Page suivante" onClick={()=>setPage(current+1)}><Icon name="right"/></button></div></nav>
  </section>;
}
function Documents({
  docs,
  reports,
  teacher,
  inner = false,
  onDelete,
  onTrash,
}: AnyData) {
  const [scope, setScope] = useState("all");
  const preview = useContext(DocumentPreviewContext);
  const filtered = docs.filter(
    (d: AnyData) =>
      scope === "all" ||
      (scope === "general" ? d.scope === "general" : d.scope !== "general"),
  );
  return (
    <div className={inner ? "" : "panel documents-panel"}>
      {!inner && (
        <>
          <div className="panel-heading">
            <div>
              <h2>Documents du suivi</h2>
              <p className="hint">
                Le programme officiel est conservé ici, avec les supports des
                séances.
              </p>
            </div>
            {teacher && onTrash && (
              <button className="button small secondary" onClick={onTrash}>
                <Icon name="trash" size={16} />
                Corbeille
              </button>
            )}
          </div>
          <div className="tabs">
            {[
              ["all", "Tous"],
              ["general", "Documents généraux"],
              ["sessions", "Supports de séance"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={scope === id ? "selected" : ""}
                onClick={() => setScope(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {!filtered.length ? (
        <Empty title="Aucun document dans cette sélection">
          {teacher
            ? "Les PDF de séance s’ajoutent depuis le formulaire de bilan."
            : "Les documents sont visibles après leur publication."}
        </Empty>
      ) : (
        <div className="document-list">
          {filtered.map((d: AnyData) => {
            const pub = reports.find((r: AnyData) =>
              r.payload.documentIds.includes(d.id),
            );
            return (
              <div className="document-row" key={d.id}>
                <span className="pdf-mark">PDF</span>
                <div>
                  <strong>{d.name}</strong>
                  <small>
                    {Math.ceil(d.size / 1024)} Ko ·{" "}
                    {d.scope === "general"
                      ? "Document général · Version 2026–2027"
                      : pub
                        ? pub.payload.title
                        : "Pièce jointe non publiée"}
                  </small>
                </div>
                <div className="document-tools">
                  <button
                    className="icon-button"
                    onClick={() => preview(d)}
                    aria-label={"Visualiser " + d.name}
                  >
                    <Icon name="eye" />
                  </button>
                  <a
                    className="icon-button"
                    href={"/api/documents/" + d.id}
                    aria-label={"Télécharger " + d.name}
                  >
                    <Icon name="download" />
                  </a>
                  {teacher && onDelete && (
                    <button
                      className="icon-button danger-icon"
                      aria-label={"Supprimer le document " + d.name}
                      onClick={() => onDelete(d)}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Access({ data, onRename, onCreate, onRevoke }: AnyData) {
  return (
    <div className="access-grid">
      <ParentAccounts/>
      <section className="panel settings-panel">
        <span className="eyebrow">LE SUIVI</span>
        <h2>{data.student.name}</h2>
        <p>{data.student.level}</p>
        <button className="text-button" onClick={onRename}>
          Modifier le prénom <Icon name="arrow" size={14} />
        </button>
        <hr />
        <h3>Récupérer les données</h3>
        <p className="muted">
          L’export JSON contient les bilans, leurs corrections, les brouillons
          et les versions de grilles. Les supports se téléchargent depuis les séances et les bilans de chapitre depuis Documents.
        </p>
        <a className="button secondary" href="/api/export">
          <Icon name="download" size={16} />
          Exporter les données
        </a>
      </section>
    </div>
  );
}
function SessionEditor({
  id,
  data,
  userId,
  onClose,
  onChanged,
  onPublished,
  notify,
}: AnyData) {
  const [loaded, setLoaded] = useState<AnyData>(null),
    [draft, setDraft] = useState<Report | null>(null),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [completed, setCompleted] = useState(false),
    [reason, setReason] = useState(""),
    [moveDate, setMoveDate] = useState(""),
    [localConflict, setLocalConflict] = useState<string | null>(null);
  const chapterGrid=(id:string)=>{const chapter=data.chapters.find((c:AnyData)=>c.id===id);return chapter.currentGrid || chapter.grid;};
  const draftRef = useRef<Report | null>(null),
    version = useRef(0),
    change = useRef(0),
    savedChange = useRef(0),
    task = useRef<Promise<boolean> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true),
    key = useRef(""),
    pubKey = useRef("");
  useEffect(() => {
    alive.current = true;
    key.current = "orbite-recovery-" + userId + "-" + id;
    pubKey.current = crypto.randomUUID();
    (async () => {
      try {
        const result = await api("sessions/" + id);
        if (!alive.current) return;
        version.current = result.session.version;
        setLoaded(result);
        setMoveDate(result.session.date);
        let initial = result.draft;
        const cache = sessionStorage.getItem(key.current);
        if (cache) {
          try {
            const parsed = JSON.parse(cache);
            if (parsed.serverVersion === version.current) {
              initial = parsed.report;
              change.current = 1;
              setStatus("Saisie récupérée sur cet appareil");
            } else setLocalConflict(cache);
          } catch {}
        }
        const workIds = new Map(activityBundles(initial.activities).map(bundle=>[bundle.id,bundle.activities[0].workId || crypto.randomUUID()]));
        initial={...initial,activities:activityBundles(initial.activities).flatMap(bundle=>bundle.activities.map(activity=>({...activity,workId:workIds.get(bundle.id)})))};
        draftRef.current = initial;
        setDraft(initial);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, userId]);
  function backup() {
    try {
      sessionStorage.setItem(
        key.current,
        JSON.stringify({
          report: draftRef.current,
          serverVersion: version.current,
        }),
      );
    } catch {}
  }
  const save = useCallback(async (): Promise<boolean> => {
    if (task.current) return task.current;
    if (!draftRef.current) return false;
    if (savedChange.current === change.current) return true;
    task.current = (async () => {
      try {
        while (savedChange.current !== change.current) {
          const snapshot = draftRef.current,
            n = change.current;
          if (alive.current) {
            setStatus("Enregistrement…");
            setError("");
          }
          const res = await api("sessions/" + id + "/draft", "PUT", {
            report: snapshot,
            version: version.current,
          });
          version.current = res.version;
          savedChange.current = n;
          if (n === change.current) sessionStorage.removeItem(key.current);
          else {
            try {
              sessionStorage.setItem(
                key.current,
                JSON.stringify({
                  report: draftRef.current,
                  serverVersion: version.current,
                }),
              );
            } catch {}
          }
        }
        if (alive.current) setStatus("Brouillon enregistré");
        return true;
      } catch (e) {
        if (alive.current) {
          setStatus("Enregistrement interrompu");
          setError((e as Error).message);
        }
        return false;
      } finally {
        task.current = null;
      }
    })();
    return task.current;
  }, [id]);
  useEffect(() => {
    function unload(e: BeforeUnloadEvent) {
      if (change.current !== savedChange.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  function update(next: Report) {
    draftRef.current = next;
    setDraft(next);
    change.current++;
    backup();
    setStatus("Modifications à enregistrer");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  }
  function patch(fields: Partial<Report>) {
    if (draftRef.current) update({ ...draftRef.current, ...fields });
  }
  function resultPatch(index: number, fields: AnyData) {
    patch({performances:(draftRef.current!.performances || []).map((p,i)=>i===index?{...p,...fields}:p)});
  }
  async function close() {
    if (busy) return;
    if (!draftRef.current) {
      onClose();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    if (await save()) {
      onClose();
      onChanged();
    }
  }
  async function publish() {
    if (completed || busy) return;
    setBusy(true);
    setError("");
    if (timer.current) clearTimeout(timer.current);
    try {
      if (change.current === 0) {
        change.current++;
      }
      if (!(await save())) return;
      setStatus("Création du PDF…");
      await api(
        "sessions/" + id + (loaded.revisions.length ? "/update" : "/publish"),
        "POST",
        {
          version: version.current,
          requestKey: pubKey.current,
          reason,
        },
      );
      setCompleted(true);
      sessionStorage.removeItem(key.current);
      notify(
        loaded.revisions.length
          ? "Modifications enregistrées. Le PDF du bilan a été actualisé."
          : "Bilan publié.",
      );
      onClose();
      if (onPublished) await onPublished(id);
      else await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadSupports(files:File[],bundleId:string) {
    setBusy(true);setError("");
    try {
      for(const file of files){
        const uploadRequest=async<T,>(body:unknown):Promise<T>=>{const response=await fetch('/api/auth/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json() as T & {error?:string};if(!response.ok)throw new Error(result.error || 'Le support n’a pas pu être enregistré.');return result;};
        const ticket=await uploadRequest<{id:string;url:string}>({operation:'prepare',sessionId:id,name:file.name,size:file.size});
        const sent=await fetch(ticket.url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});
        if(!sent.ok)throw new Error('L’envoi du support a échoué. Réessayez.');
        const doc=await uploadRequest<{id:string;name:string;size:number}>({operation:'complete',id:ticket.id});
        setLoaded((value:AnyData)=>({...value,documents:[...value.documents,doc]}));
        const current=draftRef.current!,bundle=activityBundles(current.activities).find(b=>b.id===bundleId);
        if(bundle){const workId=bundle.activities[0].workId || crypto.randomUUID();update(replaceActivityBundle(current,bundleId,bundle.activities.map(a=>({...a,workId,documentIds:[...bundle.documentIds,doc.id]}))));}
      }
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function copyLast() {
    const prior = [...data.reports]
      .filter(
        (r: AnyData) =>
          r.payload.chapterId === draftRef.current?.chapterId &&
          r.session_id !== id &&
          r.payload.date <= draftRef.current!.date,
      )
      .at(-1);
    if (!prior) {
      notify("Aucune séance publiée précédente dans ce chapitre.");
      return;
    }
    const skills = draftRef.current!.skills;
    patch({
      activities: prior.payload.activities
        .filter((a: Activity) => skills.some((s) => s.id === a.skillId))
        .map((a: Activity) => ({
          ...a,
          id: crypto.randomUUID(),
          level: null,
          confirmed: false,
          estimated: false,
          evidence: "",
          exercises: "",
        })),
      documentIds: prior.payload.documentIds,
    });
    notify(
      "Notions et supports repris. Les niveaux et exercices restent à renseigner.",
    );
  }
  return (
    <Modal
      title={loaded?.revisions.length ? "Modifier le bilan" : "Bilan de séance"}
      subtitle={
        draft
          ? dateLabel(draft.date, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : undefined
      }
      onClose={close}
      wide
    >
      <div className="editor-content">
        {error && (
          <div className="error" role="alert">
            {error}
            {draft && (
              <button type="button" className="text-button" onClick={save}>
                Réessayer l’enregistrement
              </button>
            )}
            {draft && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  backup();
                  onClose();
                }}
              >
                Fermer en gardant une copie sur cet appareil
              </button>
            )}
          </div>
        )}
        {!draft ? (
          <div className="loading">
            <span role="status">Chargement du bilan…</span>
          </div>
        ) : (
          <>
            <div className="draft-banner">
              <span className="dot lavender" />
              <span>
                {loaded.revisions.length
                  ? "La version publiée reste visible jusqu’à l’enregistrement des modifications."
                  : "Brouillon · visible uniquement par le professeur"}
              </span>
              <span className="save-state" role="status">
                {status || "À renseigner"}
              </span>
            </div>
            {localConflict && (
              <div className="warning">
                Une autre copie locale existe avec une version différente. Elle
                n’a pas remplacé ce formulaire.
                <button
                  className="text-button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(
                      new Blob([localConflict], { type: "application/json" }),
                    );
                    a.download = "orbite-saisie-recuperee.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  }}
                >
                  Récupérer cette copie
                </button>
              </div>
            )}
            <div className="form-grid">
              <label>
                Date de la séance
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  required
                />
              </label>
              <label>
                Chapitre
                <select
                  value={draft.chapterId}
                  onChange={(e) => {
                    const c = data.chapters.find(
                      (c: AnyData) => c.id === e.target.value,
                    );
                    patch({
                      chapterId: c.id,
                      gridId: chapterGrid(c.id).id,
                      skills: chapterGrid(c.id).skills,
                      activities: [],
                    });
                  }}
                >
                  {data.chapters.map((c: AnyData) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Titre du bilan
              <input
                value={draft.title}
                maxLength={160}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Ex. Suites arithmétiques : terme général"
              />
            </label>
            <div className="grid-version-row">
              <label>
                Version de grille
                <select
                  value={draft.gridId}
                  onChange={(e) => {
                    const g = chapterGrid(draft.chapterId);
                    patch({
                      gridId: g.id,
                      skills: g.skills,
                      activities: draft.activities.filter((a) =>
                        g.skills.some((s: Skill) => s.id === a.skillId),
                      ),
                    });
                  }}
                >
                  {draft.gridId !==
                    chapterGrid(draft.chapterId).id && (
                    <option value={draft.gridId}>
                      Version conservée dans ce bilan
                    </option>
                  )}
                  <option
                    value={
                      chapterGrid(draft.chapterId).id
                    }
                  >
                    Version{" "}
                    {
                      chapterGrid(draft.chapterId).version
                    }{" "}
                    {chapterGrid(draft.chapterId).validated
                      ? "· validée"
                      : "· à valider"}
                  </option>
                </select>
              </label>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={copyLast}
              >
                Reprendre la dernière séance <Icon name="arrow" size={14} />
              </button>
            </div>
            <div className="section-line editor-section">
              <div>
                <h3>Notions et activités</h3>
                <p className="hint">
                  Un niveau est facultatif. Une ligne ne constitue pas une
                  mesure si elle reste non évaluée.
                </p>
              </div>
            </div>
            <ActivityEditor report={draft} grid={chapterGrid(draft.chapterId)} documents={[...new Map([...data.documents,...loaded.documents].map((d:AnyData)=>[d.id,d])).values()].filter((d:AnyData)=>d.id!==referenceDocument.id) as AnyData[]} busy={busy} onChange={update} onUpload={uploadSupports} onAdded={async(grid,skill,bundleId)=>{
              const current=draftRef.current!;
              if(current.activities.some(a=>a.skillId && !grid.skills.some(s=>s.id===a.skillId))) throw new Error("La compétence est ajoutée au chapitre. Adoptez sa nouvelle grille pour l’utiliser dans ce bilan ancien.");
              const bundle=activityBundles(current.activities).find(b=>b.id===bundleId);
              const next={...current,gridId:grid.id,skills:grid.skills};
              if(bundle){const workId=bundle.activities[0].workId || crypto.randomUUID();const members=bundle.activities.filter(a=>a.skillId).map(a=>({...a,workId}));if(!members.some(a=>a.skillId===skill.id))members.push({...bundle.activities[0],id:crypto.randomUUID(),workId,skillId:skill.id,level:null,confirmed:false});update(replaceActivityBundle(next,bundleId,members));}else update(next);
              await onChanged();notify("Compétence ajoutée et validée.");
            }}/>
            <details
              className="form-details"
              open={draft.score !== null || !!draft.assessmentMinutes || undefined}
            >
              <summary>
                Contrôle · note et durée <span>facultatif</span>
              </summary>
              <label>
                Intitulé
                <input
                  value={draft.assessmentTitle}
                  maxLength={160}
                  onChange={(e) => patch({ assessmentTitle: e.target.value })}
                  placeholder="Ex. Contrôle sur les suites"
                />
              </label>
              <div className="form-grid">
                <label>
                  Note obtenue
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draft.score ?? ""}
                    onChange={(e) =>
                      patch({
                        score:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Barème
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={draft.scale ?? ""}
                    onChange={(e) =>
                      patch({
                        scale:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label>Durée du contrôle (minutes)<input type="number" min="0.01" max="1440" step="any" value={draft.assessmentMinutes ?? ""} onChange={e=>patch({assessmentMinutes:e.target.value===""?null:Number(e.target.value)})}/></label>
            </details>
            <details className="form-details" open={(draft.performances?.length || 0)>0 || undefined}>
              <summary>Notes de TD et temps mesurés <span>facultatif</span></summary>
              {(draft.performances || []).map((p,i)=><details key={p.id} className="performance-result" open={p.score===null && p.minutes===null || undefined}><summary><span>{p.title || 'Résultat '+(i+1)}</span><small>{p.score!==null?`${p.score}/${p.scale ?? '—'}`:''}{p.minutes!==null?` · ${p.minutes} min`:''}</small></summary><fieldset className="performance-form"><legend>Résultat {i+1}</legend>
                <label>Partie du support <span className="optional">facultatif</span><input value={p.title} maxLength={160} onChange={e=>resultPatch(i,{title:e.target.value})}/></label>
                <label>Type<select value={p.type} onChange={e=>resultPatch(i,{type:e.target.value})}><option value="td">TD</option><option value="evaluation">Évaluation</option><option value="exercice">Exercice</option></select></label>
                <div className="form-grid"><label>Note<input type="number" min="0" step="any" value={p.score ?? ""} onChange={e=>resultPatch(i,{score:e.target.value===""?null:Number(e.target.value)})}/></label>
                <label>Barème<input type="number" min="0.01" step="any" value={p.scale ?? ""} onChange={e=>resultPatch(i,{scale:e.target.value===""?null:Number(e.target.value)})}/></label>
                <label>Temps mesuré (minutes)<input type="number" min="0.01" max="1440" step="any" value={p.minutes ?? ""} onChange={e=>resultPatch(i,{minutes:e.target.value===""?null:Number(e.target.value)})}/></label></div>
                <label>Activité associée<select value={p.workId || ""} onChange={e=>resultPatch(i,{workId:e.target.value || undefined})}><option value="">Résultat indépendant</option>{activityBundles(draft.activities).map((b,j)=><option key={b.id} value={b.activities[0].workId || b.id}>{workLabel[b.type]} · Activité {j+1}</option>)}</select></label><button type="button" className="text-button" onClick={()=>patch({performances:draft.performances!.filter((_,j)=>i!==j)})}>Retirer ce résultat</button>
              </fieldset></details>)}
              <button type="button" className="button secondary" onClick={()=>patch({performances:[...(draft.performances || []),{id:crypto.randomUUID(),title:"Résultat "+((draft.performances?.length || 0)+1),type:"td",score:null,scale:null,minutes:null,...(activityBundles(draft.activities).filter(b=>b.type==="td").length===1?{workId:activityBundles(draft.activities).find(b=>b.type==="td")!.activities[0].workId}:{})}]})}>Ajouter un résultat ou un temps</button>
            </details>
            {draft.documentIds.some(docId=>!draft.activities.some(a=>a.documentIds?.includes(docId))) && <div className="editor-section"><h3>Autres supports du bilan</h3><div className="attachment-list">{draft.documentIds.filter(docId=>!draft.activities.some(a=>a.documentIds?.includes(docId))).map(docId=><div key={docId}><a href={"/api/documents/"+docId}>{loaded.documents.find((d:AnyData)=>d.id===docId)?.name || "Support PDF"}</a><button type="button" className="text-button" onClick={()=>patch({documentIds:draft.documentIds.filter(id=>id!==docId)})}>Retirer</button></div>)}</div></div>}
            <details className="form-details" open={!!draft.summary && Object.values(draft.summary).some(Boolean) || undefined}>
              <summary>Synthèse de la séance <span>facultatif</span></summary>
              <div className="synthesis-form">{([["objective","Objectif de la séance"],["strengths","Points réussis"],["focus","À consolider"],["nextStep","Prochaine étape"]] as const).map(([key,label])=><label key={key}>{label}<textarea rows={2} maxLength={1200} value={draft.summary?.[key] || ""} onChange={e=>patch({summary:{objective:"",strengths:"",focus:"",nextStep:"",...draft.summary,[key]:e.target.value}})}/></label>)}</div>
            </details>
            <label className="editor-section">
              Bilan partagé{" "}
              <span className="optional">facultatif</span>
              <textarea
                rows={3}
                maxLength={4000}
                value={draft.comment}
                onChange={(e) => patch({ comment: e.target.value })}
                placeholder="Un complément factuel sur la séance."
              />
            </label>
            <details className="form-details"><summary>Aperçu du bilan partagé</summary><ReportOverview report={draft}/>{draft.comment && <section className="report-comment"><h3>Commentaire</h3><p>{draft.comment}</p></section>}</details>
            <label>
              Note privée du professeur{" "}
              <span className="optional">visible uniquement par vous</span>
              <textarea
                rows={2}
                maxLength={4000}
                value={draft.privateNote || ""}
                onChange={(e) => patch({ privateNote: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={draft.partial}
                onChange={(e) => patch({ partial: e.target.checked })}
              />
              Reprise d’historique partiel : seules les informations connues
              sont renseignées.
            </label>
            {loaded.revisions.length > 0 && (
              <label>
                Précision sur la modification{" "}
                <span className="optional">
                  facultatif · visible dans l’historique
                </span>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Précisez le changement si nécessaire."
                />
              </label>
            )}
            {!loaded.revisions.length && (
              <details className="form-details">
                <summary>Déplacer ou annuler la séance</summary>
                <label>
                  Nouvelle date
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button
                    className="button small secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        if (!(await save())) return;
                        await api("sessions/" + id + "/schedule", "POST", {
                          date: moveDate,
                          status: "planned",
                          version: version.current,
                        });
                        onClose();
                        await onChanged();
                        notify("Séance déplacée ou réactivée.");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Déplacer / réactiver
                  </button>
                  <button
                    className="button small danger"
                    disabled={busy || loaded.session.status === "cancelled"}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        if (!(await save())) return;
                        await api("sessions/" + id + "/schedule", "POST", {
                          date: loaded.session.date,
                          status: "cancelled",
                          version: version.current,
                        });
                        onClose();
                        await onChanged();
                        notify("Séance annulée.");
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Annuler la séance
                  </button>
                </div>
              </details>
            )}
          </>
        )}
      </div>
      {draft && (
        <footer className="modal-footer">
          <span className="hint">
            Un brouillon ne compte pas comme une séance réalisée.
          </span>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              {loaded.revisions.length ? "Fermer" : "Fermer le brouillon"}
            </button>
            <button
              className="button"
              disabled={
                busy || completed || loaded.session.status === "cancelled"
              }
              onClick={publish}
            >
              {completed
                ? "Bilan publié"
                : busy
                  ? "Création du PDF…"
                  : loaded.revisions.length
                    ? "Enregistrer les modifications"
                    : "Publier le bilan"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </footer>
      )}
    </Modal>
  );
}

function ReportView({
  revision: r,
  data,
  onClose,
  onEdit,
  onDelete,
  onViewed,
}: AnyData) {
  const preview = useContext(DocumentPreviewContext);
  const p = r.payload,
    documents = data.documents.filter((d: AnyData) =>
      p.documentIds.includes(d.id),
    );
  const revisions = data.revisions
    .filter((v: AnyData) => v.session_id === r.session_id)
    .sort((a: AnyData, b: AnyData) => a.seq - b.seq);
  const [shown, setShown] = useState(r);
  const report = shown.payload;
  useEffect(() => {
    api("reports/" + r.session_id + "/view", "POST", { seq: r.seq })
      .then(() => onViewed?.(r.session_id, r.seq))
      .catch(() => {});
  }, [r.session_id, r.seq]);
  return (
    <Modal
      title="Bilan de séance"
      subtitle={
        dateLabel(report.date, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      }
      onClose={onClose}
      wide
    >
      <div className="report-detail report-sheet">
        <div className="sheet-label">
          <span>REPÈRE · MATHÉMATIQUES</span>
          <span>{data.student.name}</span>
        </div>
        <div className="report-title-line">
          <div>
            <span className="eyebrow">
              {
                data.chapters.find((c: AnyData) => c.id === report.chapterId)
                  ?.title
              }
            </span>
            <h2>{report.title}</h2>
          </div>
          <span className="status published">Publié · v{shown.seq}</span>
        </div>
        {report.partial && (
          <p className="warning">
            Reprise d’historique partiel : le bilan comporte uniquement les
            informations connues.
          </p>
        )}
        <ReportOverview report={report} />
        {report.score !== null && (
          <div className="evaluation-result">
            <div>
              <span className="eyebrow">RÉSULTAT D’ÉVALUATION</span>
              <h3>{report.assessmentTitle || "Évaluation"}</h3>
            </div>
            <strong>
              {report.score}
              <small> / {report.scale}</small>
            </strong>
          </div>
        )}
        {!!report.assessmentMinutes && <p className="report-duration">Durée du contrôle : {report.assessmentMinutes} min</p>}
        {!!report.performances?.length && <section className="report-comment"><h3>Résultats et temps mesurés</h3>{report.performances.map((p: AnyData)=><p key={p.id}>{p.title} · {p.type === "evaluation" ? "Évaluation" : p.type === "td" ? "TD" : "Exercice"}{p.score !== null ? ` · ${p.score}/${p.scale}` : ""}{p.minutes !== null ? ` · ${p.minutes} min` : ""}</p>)}</section>}
        {report.comment && (
          <section className="report-comment">
            <h3>Commentaire du professeur</h3>
            <p>{report.comment}</p>
          </section>
        )}
        <h3>Supports de la séance</h3>
        <Documents
          docs={data.documents.filter((d: AnyData) =>
            report.documentIds.includes(d.id),
          )}
          reports={[shown]}
          teacher={false}
          inner
        />
        {report.documentIds.some(
          (id: string) => !data.documents.some((d: AnyData) => d.id === id),
        ) && (
          <p className="hint">
            Certains supports ont été retirés du suivi et ne sont plus
            disponibles.
          </p>
        )}
        {revisions.length > 1 && (
          <details className="form-details">
            <summary>Historique des publications ({revisions.length})</summary>
            <p className="hint">
              Chaque version conserve les observations et la grille utilisées
              lors de sa publication.
            </p>
            {revisions.map((v: AnyData) => (
              <button
                className={
                  "revision-button " + (v.id === shown.id ? "selected" : "")
                }
                key={v.id}
                onClick={() => setShown(v)}
              >
                <span>
                  Version {v.seq} ·{" "}
                  {dateLabel(v.recorded_at, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <small>{v.reason || "Publication initiale"}</small>
              </button>
            ))}
          </details>
        )}
        <p className="hint">
          Grille conservée : {report.gridId} · Publié le{" "}
          {shown.recorded_at
            ? dateLabel(shown.recorded_at)
            : "date conservée dans l’historique"}
          .
        </p>
      </div>
      <footer className="modal-footer">
        <div className="button-row">
          <button className="button secondary" onClick={onClose}>
            Fermer
          </button>
          <button
            className="button secondary"
            onClick={() => preview(shown.pdf)}
          >
            <Icon name="eye" size={16} />
            Visualiser le PDF
          </button>
          <a className="button secondary" href={shown.pdf?.url}>
            <Icon name="download" size={16} />
            Télécharger
          </a>
          {onDelete && (
            <button
              className="icon-button danger-icon"
              aria-label="Supprimer ce bilan"
              onClick={onDelete}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
        {onEdit && (
          <button className="button" onClick={onEdit}>
            Modifier <Icon name="edit" size={16} />
          </button>
        )}
      </footer>
    </Modal>
  );
}
function Dialogs({
  dialog: d,
  data,
  pending,
  close,
  act,
  onNew,
  onNewChapter,
  notify,
}: AnyData) {
  const [value, setValue] = useState(
      d.type === "rename" ? data.student.name : "",
    ),
    [date, setDate] = useState(data.week.monday === isoWeek(todayParis()).monday ? todayParis() : data.week.monday),
    [chapter, setChapter] = useState(
      data.chapters.find((c: AnyData) => c.state === "active")?.id ||
        data.chapters[0].id,
    ),
    [skills, setSkills] = useState<Skill[]>(d.chapter?.grid.skills || []),
    [validated, setValidated] = useState(!!d.chapter?.grid.validated),
    [link, setLink] = useState(""),
    [templateId,setTemplateId]=useState(data.catalogue?.find((p:AnyData)=>!data.chapters.some((c:AnyData)=>c.title===p.title))?.id || data.catalogue?.[0]?.id || ''),
    [startChapter,setStartChapter]=useState(true);
  const requestKey = useRef(crypto.randomUUID());
  const template=data.catalogue?.find((p:AnyData)=>p.id===templateId);
  const titles: Record<string, string> = {
    new: "Ajouter une séance",
    "chapter-new":"Ajouter un chapitre",
    grid: "Grille de compétences",
    state:
      d.state === "closed"
        ? "Clôturer le chapitre"
        : d.state === "revision"
          ? "Rouvrir pour révision"
          : "Commencer le chapitre",
    rename: "Prénom de l’élève",
    grant: link ? "Lien de consultation créé" : "Créer un lien de consultation",
    revoke: "Révoquer le lien de consultation",
    remove:
      d.kind === "sessions" ? "Supprimer la séance" : d.kind === "reports" ? "Supprimer le bilan" : "Supprimer le document",
  };
  return (
    <Modal title={titles[d.type]} onClose={close} wide={d.type === "grid"}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (d.type === "new")
            act(async () => {
              const r = await api("sessions", "POST", {
                date,
                chapterId: chapter,
                requestKey: requestKey.current,
              });
              onNew(r.id, date);
            }, "Séance ajoutée.");
          if(d.type === "chapter-new") act(async()=>{const result=await api('chapters','POST',{templateId,title:value || template?.title,start:startChapter,validated});onNewChapter(result.id);},'Chapitre ajouté.');
          if (d.type === "rename")
            act(
              () => api("student", "PUT", { name: value }),
              "Prénom modifié.",
            );
          if (d.type === "state")
            act(
              () =>
                api("chapters/" + d.chapter.id + "/state", "POST", {
                  state: d.state,
                  note: value,
                }),
              "État du chapitre enregistré.",
            );
          if (d.type === "grid")
            act(
              () =>
                api("chapters/" + d.chapter.id + "/grid", "POST", {
                  skills,
                  validated,
                  baseGridId: d.chapter.grid.id,
                }),
              "Nouvelle version de grille enregistrée.",
            );
          if (d.type === "grant" && !link && !pending) {
            (async () => {
              try {
                const r = await api("grants", "POST", {
                  label: value || "Proche",
                });
                setLink(r.url);
              } catch (e) {
                notify((e as Error).message);
              }
            })();
          }
          if (d.type === "remove")
            act(
              () =>
                api(
                  d.kind +
                    "/" +
                    (d.kind === "reports"
                      ? d.resource.session_id
                      : d.resource.id),
                  "DELETE",
                ),
              "Élément déplacé dans la corbeille.",
            );
          if (d.type === "revoke")
            act(
              () => api("grants/" + d.grant.id, "DELETE"),
              "Lien révoqué. Les prochaines requêtes seront refusées.",
            );
        }}
      >
        {d.type === "chapter-new" && <>
          <label>Rubrique du programme<select aria-label="Rubrique du programme" value={templateId} onChange={e=>{setTemplateId(e.target.value);setValue('');setValidated(false);}}>{data.catalogue.map((p:AnyData)=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          <label>Titre du chapitre<input value={value} placeholder={template?.title} maxLength={160} onChange={e=>setValue(e.target.value)}/></label>
          {template && <><ReferenceCard source={template.source} available={data.documents.some((d:AnyData)=>d.id===referenceDocument.id)}/><details className="form-details"><summary>Grille proposée · {template.skills.length} notions</summary><ul className="catalogue-skills">{template.skills.map((s:Skill)=><li key={s.id}>{s.label}</li>)}</ul></details></>}
          <label className="checkbox-label"><input type="checkbox" checked={validated} onChange={e=>setValidated(e.target.checked)}/>J’ai vérifié la grille proposée</label>
          <label className="checkbox-label"><input type="checkbox" checked={startChapter} onChange={e=>setStartChapter(e.target.checked)}/>Commencer ce chapitre</label>
        </>}
        {d.type === "remove" && (
          <>
            <h3>
              {d.kind === "sessions" ? dateLabel(d.resource.date, {weekday:"long",day:"numeric",month:"long",year:"numeric"}) : d.kind === "reports"
                ? d.resource.payload.title
                : d.resource.name}
            </h3>
            <p className="hint">
              L’élément sera masqué dans l’espace de consultation.{" "}
              {["reports", "sessions"].includes(d.kind)
                ? "Les statistiques du chapitre seront recalculées à partir des bilans restants."
                : "Le fichier ne sera plus consultable depuis les bilans."}{" "}
              Vous pourrez le restaurer depuis la corbeille ; les données sont
              conservées.
            </p>
          </>
        )}
        {d.type === "new" && (
          <>
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Chapitre
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              >
                {data.chapters.map((c: AnyData) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              La séance reste prévue jusqu’à la publication de son bilan.
            </p>
          </>
        )}
        {d.type === "rename" && (
          <label>
            Prénom
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={80}
              required
            />
          </label>
        )}
        {d.type === "state" && (
          <>
            <div className="fact-banner">
              <h3>{d.chapter.title}</h3>
              <p>
                {d.chapter.metrics.sessions} séances publiées ·{" "}
                {d.chapter.metrics.evaluated}/{d.chapter.metrics.total}{" "}
                compétences évaluées · {d.chapter.metrics.mastered} maîtrisées.
              </p>
              <p>
                Maîtrise observée :{" "}
                {d.chapter.metrics.mastery === null
                  ? "pas encore évalué"
                  : d.chapter.metrics.mastery + " %"}
                .
              </p>
            </div>
            <p className="muted">
              {d.state === "closed"
                ? "Le bilan final garde les niveaux observés. Les compétences à consolider restent identifiées."
                : d.state === "active"
                  ? "Le chapitre devient le chapitre en cours. L’autre chapitre actif est placé en révision."
                  : "Les observations précédentes sont conservées. De nouvelles séances peuvent être ajoutées."}
            </p>
            <label>
              Note de contexte partagée{" "}
              <span className="optional">facultatif</span>
              <textarea
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={2000}
              />
            </label>
          </>
        )}
        {d.type === "grid" && (
          <>
            <ReferenceCard
              source={d.chapter.grid.source}
              available={data.documents.some(
                (d: AnyData) => d.id === referenceDocument.id,
              )}
            />
            <p className="hint">
              Les compétences ci-dessous sont une décomposition pédagogique
              modifiable. Enregistrer crée une nouvelle version ; les bilans
              antérieurs gardent leur grille.
            </p>
            <div className="grid-editor">
              {skills.map((s, i) => (
                <div key={s.id}>
                  <label>
                    <span className="sr-only">Tâche {i + 1} · </span>
                    <span className="grid-group-label">
                      {s.group || "Compétence " + (i + 1)}
                    </span>
                    <input
                      value={s.label}
                      maxLength={250}
                      required
                      onChange={(e) =>
                        setSkills(
                          skills.map((k, j) =>
                            j === i ? { ...k, label: e.target.value } : k,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>Partie<input value={s.group || ""} maxLength={120} onChange={e=>setSkills(skills.map((k,j)=>j===i?{...k,group:e.target.value}:k))}/></label>
                  <label>Poids<input type="number" min="0.1" max="100" step="0.1" value={s.weight ?? 1} onChange={e=>setSkills(skills.map((k,j)=>j===i?{...k,weight:Number(e.target.value)}:k))}/></label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={"Retirer la compétence " + (i + 1)}
                    disabled={skills.length === 1}
                    onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setSkills([...skills, { id: crypto.randomUUID(), label: "" }])
              }
            >
              <Icon name="plus" size={15} />
              Ajouter une compétence
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={validated}
                onChange={(e) => setValidated(e.target.checked)}
              />
              Je valide cette décomposition pédagogique pour les prochaines
              séances.
            </label>
          </>
        )}
        {d.type === "grant" &&
          (link ? (
            <>
              <p>
                Copiez ce lien maintenant. Le jeton ne sera plus affiché
                ensuite.
              </p>
              <label>
                Lien sécurisé
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="button secondary"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    notify("Lien copié.");
                  } catch {
                    notify("Sélectionnez le lien pour le copier.");
                  }
                }}
              >
                Copier le lien
              </button>
              <p className="hint">
                Le lien est limité à cet élève. Il reste valide jusqu’à sa
                révocation.
              </p>
            </>
          ) : (
            <>
              <label>
                Libellé du lien
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Ex. Proche"
                  maxLength={80}
                />
              </label>
              <p>
                Cet accès permet de consulter uniquement les données publiées. Vous pouvez
                révoquer le lien à tout moment.
              </p>
            </>
          ))}
        {d.type === "revoke" && (
          <p>
            Le lien « {d.grant.label} » cessera immédiatement de donner accès
            aux bilans et aux PDF, y compris dans un navigateur déjà connecté
            avec ce lien.
          </p>
        )}
        <div className="button-row dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={async () => {
              if (link)
                await act(
                  async () => {},
                  "Lien disponible dans la liste des accès.",
                );
              else close();
            }}
          >
            {link ? "Terminer" : "Annuler"}
          </button>
          {!link && (
            <button
              className={"button " + (d.type === "revoke" ? "danger" : "")}
              disabled={pending}
              type="submit"
            >
              {pending
                ? "Enregistrement…"
                : d.type === "new"
                  ? "Ajouter la séance"
                  : d.type === "grant"
                    ? "Générer le lien"
                    : d.type === "revoke"
                      ? "Révoquer le lien"
                      : d.type === "remove"
                        ? "Mettre à la corbeille"
                        : d.type === "state"
                          ? "Confirmer"
                          : "Enregistrer"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function ReferenceCard({ source, available }: AnyData) {
  const preview=useContext(DocumentPreviewContext);
  return <button className="reference-link" disabled={!available} onClick={()=>preview(referenceDocument,source.page || 6)}><span>Référentiel du chapitre</span><Icon name="eye" size={18}/></button>;
}
function SkillChecklist({ chapter: c }: AnyData) {
  const groups = [
    ...new Set<string>(
      c.grid.skills.map((s: Skill) => s.group || "Notions du chapitre"),
    ),
  ];
  return (
    <div className="task-checklist">

      {groups.map((group) => {
        const part = c.grid.skills.filter((s: Skill) => (s.group || "Notions du chapitre") === group);
        const progress = weightedProgress(part, c.metrics.latest);
        return (
        <details className="task-group" key={group}>
          <summary><span>{group}<small>{progress.evaluated}/{progress.total} notions évaluées</small></span><strong>{progress.value === null ? "Non évaluée" : <Percent value={progress.value} kind="progress"/>}</strong></summary>
          {c.grid.skills
            .filter((s: Skill) => (s.group || "Notions du chapitre") === group)
            .map((s: Skill) => {
              const value = c.metrics.latest[s.id]?.level ?? null;
              return (
                <div
                  className={
                    "task-row " + (value === 100 ? "task-mastered" : "")
                  }
                  key={s.id}
                >
                  <span
                    className="auto-check"
                    role="checkbox"
                    aria-checked={value === 100}
                    aria-readonly="true"
                    aria-label={
                      s.label +
                      " : " +
                      (value === 100
                        ? "maîtrise confirmée"
                        : "maîtrise non confirmée")
                    }
                  >
                    {value === 100 && <Icon name="check" size={15} />}
                  </span>
                  <div className="task-label">
                    <span>{s.label}</span>
                    {s.origin === "teacher" && <small className="skill-origin">Ajout du professeur</small>}
                    <small>
                      {c.metrics.latest[s.id]
                        ? "Observée le " +
                          dateLabel(c.metrics.latest[s.id].date)
                        : "Pas encore évaluée"}
                    </small>
                  </div>
                  <div className="task-value" data-level={value ?? "none"}>
                    <strong><Percent value={value}/></strong>
                    <div
                      className="task-track"
                      role="progressbar"
                      aria-label={"Maîtrise de " + s.label}
                      aria-valuenow={value ?? undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={
                        value === null ? "Non évaluée" : value + " %"
                      }
                    >
                      <i style={{ width: (value ?? 0) + "%" }} />
                    </div>
                  </div>
                </div>
              );
            })}
        </details>
      );})}
    </div>
  );
}
function TrashModal({ onClose, onChanged, notify }: AnyData) {
  const [items, setItems] = useState<AnyData>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(await api("trash"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function restore(kind: string, id: string) {
    setBusy(true);
    try {
      await api(kind + "/" + id + "/restore", "POST");
      await load();
      await onChanged();
      notify("Élément restauré. Les statistiques ont été actualisées.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Corbeille" onClose={onClose} wide>
      <div className="dialog-form">
        <p className="hint">
          Les séances et fichiers retirés restent conservés. Une restauration
          rend à nouveau les données publiées visibles dans l’espace de consultation.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!items ? (
          <p role="status">Chargement…</p>
        ) : !items.sessions.length && !items.documents.length ? (
          <Empty title="La corbeille est vide" />
        ) : (
          <>
            <h3>Séances</h3>
            {items.sessions.map((r: AnyData) => (
              <div className="trash-row" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {dateLabel(r.date, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </small>
                </div>
                <button
                  className="button small secondary"
                  disabled={busy}
                  onClick={() => restore("sessions", r.id)}
                >
                  Restaurer
                </button>
              </div>
            ))}
            <h3 className="editor-section">Documents</h3>
            {items.documents.map((d: AnyData) => (
              <div className="trash-row" key={d.id}>
                <strong>{d.name}</strong>
                <button
                  className="button small secondary"
                  disabled={busy}
                  onClick={() => restore("documents", d.id)}
                >
                  Restaurer
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

function PdfPreview({ doc, onClose, onEdit, onViewed }: AnyData) {
  const [pdf, setPdf] = useState<any>(null),
    [page, setPage] = useState(doc.page || 1),
    [zoom, setZoom] = useState(1),
    [width, setWidth] = useState(600),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pageText, setPageText] = useState("");
  const fileUrl = doc.url || "/api/documents/" + doc.id;
  const directUrl = fileUrl + (fileUrl.includes("?") ? "&" : "?") + "view=1";
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (pdf && doc.kind === "report" && doc.sessionId)
      api("reports/" + doc.sessionId + "/view", "POST", { seq: doc.revision })
        .then(() => onViewed?.(doc.sessionId, doc.revision))
        .catch(() => {});
  }, [pdf, doc.id]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false,
      task: any;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError("");
        setPdf(null);
        installPdfCompatibility();
        const [lib, response] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          fetch(doc.url || "/api/documents/" + doc.id, {
            signal: controller.signal,
            credentials: "same-origin",
          }),
        ]);
        if (!response.ok) {
          const body: any = await response.json();
          throw new Error(body.error || "Ce document est indisponible.");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (stopped) return;
        lib.GlobalWorkerOptions.workerSrc =
          "/pdf-viewer/pdf.worker-legacy-6.5.438.min.mjs";
        task = lib.getDocument({
          data: bytes,
          enableXfa: false,
          cMapUrl: "/pdf-viewer/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdf-viewer/standard_fonts/",
          wasmUrl: "/pdf-viewer/wasm/",
        });
        const document = await task.promise;
        if (stopped) {
          task.destroy();
          return;
        }
        setPdf(document);
        setPage(Math.max(1, Math.min(doc.page || 1, document.numPages)));
      } catch (e) {
        if (!stopped) {
          setError("L’aperçu intégré est indisponible. Vous pouvez ouvrir le PDF directement.");
          setLoading(false);
        }
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
      task?.destroy();
    };
  }, [doc.id]);
  useEffect(() => {
    if (!pdf || !canvas.current || width < 1) return;
    let stopped = false,
      render: any;
    (async () => {
      try {
        setLoading(true);
        setPageText("");
        const p = await pdf.getPage(page);
        if (stopped) return;
        const natural = p.getViewport({ scale: 1 }),
          scale = Math.min((width - 24) / natural.width, 1.5) * zoom,
          viewport = p.getViewport({ scale }),
          ratio = Math.min(window.devicePixelRatio || 1, 2),
          el = canvas.current!;
        el.width = Math.ceil(viewport.width * ratio);
        el.height = Math.ceil(viewport.height * ratio);
        el.style.width = Math.floor(viewport.width) + "px";
        el.style.height = Math.floor(viewport.height) + "px";
        render = p.render({
          canvas: el,
          canvasContext: el.getContext("2d"),
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        await render.promise;
        const text = await p.getTextContent();
        if (!stopped) {
          setPageText(text.items.map((i: any) => i.str || "").join(" "));
          setLoading(false);
        }
      } catch (e) {
        if (!stopped && (e as Error).name !== "RenderingCancelledException") {
          setError(
            "La page ne peut pas être affichée. Vous pouvez télécharger le PDF.",
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      stopped = true;
      render?.cancel();
    };
  }, [pdf, page, zoom, width]);
  return (
    <Modal
      title={doc.name}
      subtitle={
        doc.kind === "chapter"
          ? "Bilan de clôture"
          : doc.kind === "report"
          ? "Bilan publié · Version " + doc.revision
          : doc.scope === "general"
          ? "Document général · Programme officiel"
          : "Support de séance"
      }
      onClose={onClose}
      wide
    >
      <div className="pdf-toolbar">
        <a className="text-button" href={directUrl} target="_blank" rel="noreferrer">Ouvrir directement</a>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="Page précédente"
            disabled={!pdf || page <= 1}
            onClick={() => setPage((p: number) => p - 1)}
          >
            <Icon name="left" />
          </button>
          <span aria-live="polite">
            Page {page} / {pdf?.numPages || "—"}
          </span>
          <button
            className="icon-button"
            aria-label="Page suivante"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage((p: number) => p + 1)}
          >
            <Icon name="right" />
          </button>
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="Réduire le zoom"
            disabled={!pdf || zoom <= 0.7}
            onClick={() =>
              setZoom((z) => Math.max(0.7, Math.round((z - 0.2) * 10) / 10))
            }
          >
            −
          </button>
          <span>{Math.round(zoom * 100)} %</span>
          <button
            className="icon-button"
            aria-label="Agrandir le zoom"
            disabled={!pdf || zoom >= 2}
            onClick={() =>
              setZoom((z) => Math.min(2, Math.round((z + 0.2) * 10) / 10))
            }
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
      <div className="pdf-stage" ref={host}>
        {error ? (
          <div className="pdf-fallback"><p className="error" role="alert">{error}</p><a className="button secondary" href={directUrl} target="_blank" rel="noreferrer">Ouvrir le PDF directement</a></div>
        ) : (
          <>
            {loading && (
              <p className="pdf-loading" role="status">
                Chargement de la page…
              </p>
            )}
            <canvas
              ref={canvas}
              role="img"
              aria-label={"Page " + page + " du document " + doc.name}
            />
            <div className="sr-only" aria-label={"Texte de la page " + page}>
              {pageText}
            </div>
          </>
        )}
      </div>
      <footer className="modal-footer">
        {onEdit ? (
          <button className="button secondary" onClick={onEdit}>
            <Icon name="edit" size={16} />
            Modifier
          </button>
        ) : (
          <button className="button secondary" onClick={onClose}>
            Fermer
          </button>
        )}
        <a className="button" href={doc.url || "/api/documents/" + doc.id}>
          <Icon name="download" size={16} />
          Télécharger le PDF
        </a>
      </footer>
    </Modal>
  );
}

function SessionActions({
  session: s,
  documents,
  teacher,
  onOpen,
  onEdit,
  onDelete,
}: AnyData) {
  const preview = useContext(DocumentPreviewContext);
  if (!s.report)
    return (
      <div className="session-empty-actions"><SessionFiles ids={s.preview?.documentIds || []} documents={documents}/><button className="session-action" disabled={!teacher} onClick={onOpen}>
        {teacher
          ? s.hasDraft
            ? "Reprendre le brouillon"
            : "Renseigner la séance"
          : "En attente du bilan"}
        <Icon name="arrow" size={16} />
      </button>{teacher && <button className="icon-button danger-icon" aria-label={"Supprimer la séance du " + dateLabel(s.date)} onClick={onDelete}><Icon name="trash" size={16}/></button>}</div>
    );
  return (
    <div className="published-actions">
      <SessionFiles pdf={s.pdf} ids={s.report.documentIds} documents={documents}/>
      <div className="published-buttons">
        {teacher && (
          <>
            <button className="modify-session" onClick={onEdit}>
              <Icon name="edit" size={14} />
              Modifier
            </button>
            <button
              className="icon-button danger-icon"
              aria-label={"Supprimer la séance du " + dateLabel(s.date)}
              onClick={onDelete}
            >
              <Icon name="trash" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
