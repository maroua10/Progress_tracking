import type {ChapterSnapshot} from './chapter-pdf';

const plain=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const easyWords: [RegExp,string][]=[
 [/coefficients rationnels/g,'coefficients écrits sous forme de fractions'],
 [/coefficients fractionnaires/g,'coefficients écrits sous forme de fractions'],
 [/mobilise beaucoup mieux les méthodes de résolution/g,'choisit et utilise beaucoup mieux la bonne méthode'],
 [/leur mobilisation reste irrégulière/g,'elle ne les utilise pas encore régulièrement'],
 [/mobiliser les méthodes/g,'choisir et utiliser les méthodes'],
 [/la mise en facteur du signe moins/g,'le signe moins devant une parenthèse'],
 [/conduire la résolution jusqu’au bout/g,'aller jusqu’au bout du calcul'],
 [/le degré d’aide reçu/g,'les aides dont elle a eu besoin'],
 [/au contrôle précédent/g,'au contrôle de la séance précédente'],
 [/un trinôme/g,'une expression du second degré'],
 [/les racines/g,'les solutions'],
];
export function parentWording(value:string,chapter:string){
 let text=value.trim();
 if(plain(chapter).includes('second degre')){
  text=text.replace(/\s+(?:tout en|avant de)\s+[^.!?]*\bsuites?\b[^.!?]*([.!?]|$)/gi,'$1');
  text=text.split(/(?<=[.!?])\s+/u).filter(sentence=>!(/\b(?:les suites|suites num[ée]riques)\b/i.test(sentence))).join(' ');
 }
 text=text.split(/(?<=[.!?])\s+/u).filter(s=>!(/^(?:Les notes et les durées reprennent|Les niveaux (?:sont|proposés)|La partie .*n’est pas renseignée)/i.test(s))).join(' ');
 text=text.replace(/^Consolidation des fondamentaux du calcul algébrique à partir d’un TD\s*:/,'Nous avons repris les bases du calcul dans un TD :');
 for(const [pattern,replacement]of easyWords)text=text.replace(pattern,replacement);
 return text;
}
export function controlResults(m:ChapterSnapshot['metrics']){
 const exams=(m.performances||[]).filter((p:any)=>p.type==='evaluation'&&p.score!==null&&p.scale>0).map((p:any)=>({...p,normalized:20*p.score/p.scale}));
 const known=new Set(exams.map((p:any)=>p.date+'|'+p.title));
 for(const a of m.assessments||[])if(!known.has(a.date+'|'+a.title)&&!(m.performances||[]).some((p:any)=>p.date===a.date&&p.title===a.title))exams.push({...a});
 return exams.sort((a:any,b:any)=>a.date.localeCompare(b.date));
}
export const friendlyObjective=(title:string)=>({
 'Lire et choisir une forme':'Choisir l’écriture la plus utile',
 'Racines et factorisation':'Trouver les solutions et factoriser',
 'Discriminant et équations':'Résoudre les équations du second degré',
 'Signe et inéquations':'Étudier les signes et les inéquations',
 'Forme canonique et problèmes':'Utiliser la forme canonique dans les problèmes',
 'Consolidation des fondamentaux du calcul algébrique':'Calculer, développer et factoriser',
 'Réduire une expression comportant plusieurs lettres':'simplifier une expression avec plusieurs lettres',
 'Développer le carré d’une somme':'développer le carré d’une somme',
 'Poursuivre une factorisation jusqu’à obtenir des facteurs irréductibles dans le cas étudié':'terminer une factorisation',
}[title]||title);
const n=(v:number)=>v.toLocaleString('fr-FR',{maximumFractionDigits:1});
const date=(v:string)=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'}).format(new Date(v+'T12:00:00Z'));
export function chapterEditorial(s:ChapterSnapshot){
 const reports=(s.reports||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)),exams=controlResults(s.metrics);
 const mean=exams.length?exams.reduce((sum:number,p:any)=>sum+p.normalized,0)/exams.length:null;
 const first=exams[0],last=exams.at(-1),successful=exams.filter((p:any)=>p.normalized>=15).length;
 const corpus=reports.map(r=>r.comment||r.summary?.objective||'').join(' '),topics=[
 ['calcul','les bases du calcul'],['équations','la résolution des équations'],['forme canonique','la forme canonique'],['inéquations','les inéquations'],['problèmes','les problèmes']
 ].filter(([term])=>plain(corpus).includes(plain(term))).map(([,label])=>label);
 const opening=reports.length?topics.length?`Nous avons travaillé ${topics.slice(0,-1).join(', ')}${topics.length>1?' et ':''}${topics.at(-1)}.`:parentWording(reports[0].comment||reports[0].summary?.objective||reports[0].title,s.title):'Nous ferons le point après les premiers exercices.';
 const controlSummary=exams.length?`Sur ${exams.length} contrôle${exams.length>1?'s':''} noté${exams.length>1?'s':''}, elle atteint au moins 15/20 ${successful} fois. Sa moyenne est de ${n(mean!)}/20 ; ses notes vont de ${n(Math.min(...exams.map((p:any)=>p.normalized)))} à ${n(Math.max(...exams.map((p:any)=>p.normalized)))}/20.`:'';
 const change=first&&last&&exams.length>1?`Elle obtient ${n(first.normalized)}/20 le ${date(first.date)}, puis ${n(last.normalized)}/20 le ${date(last.date)}${last.normalized>first.normalized?`, soit ${n(last.normalized-first.normalized)} points de plus`:''}.`:'';
 const weak=s.grid.skills.filter(k=>s.metrics.latest?.[k.id]!==undefined&&s.metrics.latest[k.id].level<=50);
 const lastReport=reports.at(-1);
 const priority=parentWording(lastReport?.summary?.focus||'',s.title) || (weak.length?`Je propose de reprendre en priorité les points suivants : ${weak.slice(0,3).map(k=>friendlyObjective(k.label).replace(/^./,c=>c.toLowerCase())).join(', ')}${weak.length>3?`, ainsi que ${weak.length-3} autre${weak.length-3>1?'s':''} point${weak.length-3>1?'s':''}`:''}.`:'');
 const conclusion=parentWording(lastReport?.summary?.strengths||'',s.title);
 const next=parentWording(lastReport?.summary?.nextStep||'',s.title).replace(/^Poursuivre/, 'Nous poursuivrons');
 const journey=reports.map(r=>{
  let text=parentWording(r.comment||r.summary?.objective||r.title,s.title);
  const scores=(s.metrics.performances||[]).filter((p:any)=>p.date===r.date&&p.type==='td'&&p.score!==null&&p.scale>0);
  const totalScore=scores.reduce((v:number,p:any)=>v+p.score,0),totalScale=scores.reduce((v:number,p:any)=>v+p.scale,0);
  const timed=scores.find((p:any)=>p.minutes && new RegExp(`\\b${p.scale} équations\\b`).test(text));
  if(scores.length>1&&!timed&&totalScale&&!/\b\d+\s*\/\s*\d+\b/.test(text))text+=` Sur les parties notées de ce TD, elle obtient ${n(totalScore)}/${n(totalScale)}, soit ${n(100*totalScore/totalScale)} %.`;
  if(scores.length===1){const p=scores[0],grade=`${p.score}/${p.scale}`;if(text.includes(grade))text=text.replace(grade,`${grade} (${n(100*p.score/p.scale)} % des points)`);}
  if(timed){const seconds=Math.round(timed.minutes*60/timed.scale),duration=`${Math.floor(seconds/60)} min${seconds%60?' '+seconds%60+' s':''}`;text=text.replace(`${timed.minutes} minutes`,`${timed.minutes} minutes, soit ${duration} par équation en moyenne`);if(!text.includes(`${timed.score}/${timed.scale}`))text+=` Sur cette série d’équations, elle obtient ${timed.score}/${timed.scale}, soit ${n(100*timed.score/timed.scale)} % des points.`;}
  return{...r,text};
 });
 return{opening,controlSummary,change,conclusion,mean,successful,exams,priority,next,journey};
}
