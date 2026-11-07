import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoWeek,
  weekCutoff,
  metrics,
  weightedProgress,
  latestRevisions,
  validDate,
  type Revision,
  type Report,
} from "../lib/domain.ts";
const skills = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];
function revision(
  id: string,
  date: string,
  levels: (number | null)[],
  recorded = date + "T16:00:00.000Z",
  seq = 1,
): Revision {
  return {
    id: id + "-" + seq,
    session_id: id,
    seq,
    recorded_at: recorded,
    reason: "",
    payload: {
      date,
      title: "Bilan",
      chapterId: "suites",
      gridId: "g1",
      skills,
      activities: levels.map((level, i) => ({
        id: String(i),
        skillId: skills[i].id,
        type: "td",
        level,
        confirmed: level === 100,
        workRef: "TD 1",
        exercises: "3, 4a",
      })),
      documentIds: [],
      comment: "",
      score: null,
      scale: null,
      assessmentTitle: "",
      partial: false,
    } as Report,
  };
}
test("Semaines ISO aux changements d’année", () => {
  assert.deepEqual(isoWeek("2021-01-01"), {
    monday: "2020-12-28",
    sunday: "2021-01-03",
    week: 53,
    year: 2020,
  });
  assert.equal(isoWeek("2026-12-31").week, 53);
  assert.equal(isoWeek("2027-01-03").year, 2026);
  assert.equal(isoWeek("2027-01-04").week, 1);
});
test("Fin de semaine en Europe/Paris, été et hiver", () => {
  assert.equal(weekCutoff("2026-11-08"), "2026-11-08T22:59:59.999Z");
  assert.equal(weekCutoff("2026-07-12"), "2026-07-12T21:59:59.999Z");
  assert.equal(weekCutoff("2026-03-29"), "2026-03-29T21:59:59.999Z");
});
test("Dates calendaires invalides refusées", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-2-01"), false);
});
test("Non évalué reste distinct de zéro", () => {
  const empty = metrics([revision("s1", "2026-11-04", [null, null])], skills);
  assert.equal(empty.mastery, null);
  assert.equal(empty.evaluated, 0);
  assert.equal(empty.worked, 2);
  assert.equal(empty.sessions, 1);
  const zero = metrics([revision("s1", "2026-11-04", [0, null])], skills);
  assert.equal(zero.mastery, 0);
  assert.equal(zero.evaluated, 1);
});
test("TD et exercices dédupliqués ; observations multiples conservées", () => {
  const first = revision("s1", "2026-11-04", [50, 75]);
  first.payload.activities.push({
    ...first.payload.activities[0],
    id: "extra",
    type: "cours",
    level: 25,
  });
  const next = revision("s2", "2026-11-07", [100, null]);
  const m = metrics([first, next], skills);
  assert.equal(m.tds, 1);
  assert.equal(m.exercises, 2);
  assert.equal(m.evaluated, 2);
  assert.equal(m.mastery, 88);
  assert.equal(m.mastered, 1);
  assert.equal(m.curve[0].mastery, 50);
  assert.equal(first.payload.activities[0].level, 50);
});
test("Une nouvelle observation peut être inférieure", () => {
  const m = metrics(
    [revision("s1", "2026-11-04", [75]), revision("s2", "2026-11-07", [25])],
    skills,
  );
  assert.equal(m.mastery, 25);
  assert.equal(m.curve[0].mastery, 75);
  assert.equal(m.curve[1].mastery, 25);
});
test("Les corrections et observations futures ne modifient pas une ancienne semaine", () => {
  const initial = revision("s1", "2026-10-28", [75]);
  const correction = revision(
    "s1",
    "2026-10-28",
    [25],
    "2026-11-05T15:00:00.000Z",
    2,
  );
  const future = revision("s2", "2026-11-07", [100]);
  const past = latestRevisions(
    [initial, correction, future],
    weekCutoff("2026-11-01"),
  );
  assert.equal(past.length, 1);
  assert.equal(past[0].payload.activities[0].level, 75);
  const current = latestRevisions(
    [initial, correction, future],
    weekCutoff("2026-11-08"),
  );
  assert.equal(current.length, 2);
  assert.equal(current[0].seq, 2);
});
test("Arrivée de nouvelles notions signalée ; barèmes comparables", () => {
  const r1 = revision("s1", "2026-11-04", [100]);
  r1.payload.score = 8;
  r1.payload.scale = 10;
  const r2 = revision("s2", "2026-11-07", [null, 25]);
  const m = metrics([r1, r2], skills);
  assert.equal(m.curve[1].introduced, 1);
  assert.equal(m.mastery, 63);
  assert.equal(m.assessments[0].normalized, 16);
  assert.equal(m.assessments[0].score, 8);
  assert.equal(m.assessments[0].scale, 10);
});

test("Progression pondérée sur tout le chapitre, sans assimiler une notion au chapitre", () => {
 const grid=Array.from({length:30},(_,i)=>({id:String(i),label:String(i),weight:1}));
 assert.equal(weightedProgress(grid,{"0":{level:25}}).value,0.83);
 assert.equal(weightedProgress(grid,{}).value,null);
 assert.equal(weightedProgress([{id:"a",label:"A",weight:3},{id:"b",label:"B",weight:1}],{a:{level:100}}).value,75);
 const first=revision("x","2026-11-04",[25,null,null]);
 assert.equal(metrics([first],skills).mastery,25);
 assert.equal(metrics([first],skills).progression,8.33);
 const next=revision("y","2026-11-05",[0,null,null]);
 assert.equal(metrics([first,next],skills).progression,0);
});
test("Notes et temps facultatifs, TD stable et évaluations distinctes",()=>{
 const r=revision("r","2026-11-04",[null,null,null]);
 r.payload.performances=[{id:"p",title:"TD 1",type:"td",score:8,scale:10,minutes:12},{id:"q",title:"Contrôle",type:"evaluation",score:null,scale:null,minutes:30}];
 const m=metrics([r],skills); assert.equal(m.tds,1);assert.equal(m.evaluations,1);
 assert.equal(m.assessments[0].normalized,16);assert.equal(m.performances[1].minutes,30);assert.equal(m.mastery,null);
});

test("Une séance du jour reste visible après minuit à Paris avant minuit UTC",()=>{
 const r=revision("late","2026-11-07",[75,null,null],"2026-11-06T23:03:00.000Z");
 assert.equal(latestRevisions([r],"2026-11-06T23:05:00.000Z").length,1);
});
