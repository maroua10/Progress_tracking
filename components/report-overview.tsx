import {reportTopics, type Report} from "../lib/domain";

export default function ReportOverview({report}: {report: Report}) {
  const fields = [["objective","Objectif de la séance"],["strengths","Points réussis"],["focus","À consolider"],["nextStep","Prochaine étape"]] as const;
  return <div className="session-overview">
    {report.summary && <div className="session-synthesis">{fields.map(([key,title])=>report.summary?.[key] && <section key={key} className={key}><h3>{title}</h3><p>{report.summary[key]}</p></section>)}</div>}
    <h3>Travail par objectif</h3>
    <div className="session-topics">{reportTopics(report).map(topic=><details key={topic.title} className="session-topic"><summary><span><strong>{topic.title}</strong><small>{topic.evaluated ? `${topic.evaluated} / ${topic.items.length} notion${topic.items.length>1?"s":""} évaluée${topic.evaluated>1?"s":""}${topic.estimated ? " · estimation d’après la copie" : ""}` : "Travaillé · non évalué"}</small></span><span className={"topic-level " + (topic.level===100?"complete":"")}>{topic.level===null?"—":topic.level+" %"}</span></summary>
      {topic.level!==null && <p className="hint">Moyenne des notions évaluées dans cet objectif pendant la séance.</p>}
      {topic.items.map(({skill})=><section key={skill.id}><h4>{skill.label}</h4>{report.activities.filter(a=>a.skillId===skill.id).map(activity=><div className="topic-observation" key={activity.id}><span>{{td:"TD",cours:"Cours",evaluation:"Évaluation"}[activity.type]}{activity.workRef && <small>{activity.workRef}</small>}{activity.exercises && <small>Exercices : {activity.exercises}</small>}{activity.evidence && <small>{activity.evidence}</small>}</span><strong>{activity.level===null?"Non évaluée":activity.level+" %"}{activity.estimated && activity.level!==null && <small>Estimation</small>}</strong></div>)}</section>)}
    </details>)}</div>
  </div>;
}
