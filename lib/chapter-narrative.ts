import {PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, setStrokingColor, setLineWidth, moveTo, appendBezierCurve, stroke} from 'pdf-lib';
import type {ChapterSnapshot} from './chapter-pdf';
import {isoWeek} from './domain.ts';
export const narrativeVersion='repere-narrative-1';
export const reportColors={red:'#C43B3B',orange:'#E48932',yellow:'#D6B426',blue:'#3975B7',green:'#32845A',grey:'#D9DEE5'};
export const texEscape=(v:unknown)=>String(v??'').normalize('NFC').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[\\{}$&#%_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]!)).replace(/[Δ≠≤≥ℝ²ₙ]/g,c=>({'Δ':'\\ensuremath{\\Delta}','≠':'\\ensuremath{\\ne}','≤':'\\ensuremath{\\le}','≥':'\\ensuremath{\\ge}','ℝ':'\\ensuremath{\\mathrm{R}}','²':'\\ensuremath{{}^2}','ₙ':'\\ensuremath{{}_n}'}[c]!));
const num=(n:number|null)=>n===null?'Non évalué':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
const day=(d:string)=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(d.length===10?d+'T12:00:00Z':d));
export function masteryDistribution(s:ChapterSnapshot){
 const values=s.grid.skills.map(skill=>s.metrics.latest?.[skill.id]?.level ?? null);
 return [100,75,50,25,0,null].map((level,i)=>({level,count:values.filter(v=>v===level).length,color:[reportColors.green,reportColors.blue,reportColors.yellow,reportColors.orange,reportColors.red,reportColors.grey][i],label:['Maîtrisée','Réussite sur exercice classique','Quelques aides nécessaires','Guidage important','Difficulté marquée','Non évaluée'][i]}));
}
const color=(hex:string)=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
export async function buildChapterNarrative(s:ChapterSnapshot){
 const m=s.metrics,dist=masteryDistribution(s),reports=(s.reports||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
 const assets:{name:string;bytes:Uint8Array}[]=[];
 async function figure(name:string,width:number,height:number,draw:(page:any,font:any,bold:any)=>void){const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);const p=pdf.addPage([width,height]);draw(p,font,bold);assets.push({name,bytes:await pdf.save()});}
 function arc(p:any,cx:number,cy:number,r:number,width:number,start:number,span:number,c:string){
  if(span<=0)return;const ops:any[]=[pushGraphicsState(),setStrokingColor(color(c)),setLineWidth(width),moveTo(cx+r*Math.cos(start),cy+r*Math.sin(start))];
  const count=Math.ceil(span/(Math.PI/2)),step=span/count;
  for(let i=0;i<count;i++){const a=start+i*step,b=a+step,k=4/3*Math.tan(step/4);ops.push(appendBezierCurve(cx+r*(Math.cos(a)-k*Math.sin(a)),cy+r*(Math.sin(a)+k*Math.cos(a)),cx+r*(Math.cos(b)+k*Math.sin(b)),cy+r*(Math.sin(b)-k*Math.cos(b)),cx+r*Math.cos(b),cy+r*Math.sin(b)));}
  p.pushOperators(...ops,stroke(),popGraphicsState());
 }
 await figure('distribution.pdf',270,176,(p,f,b)=>{let start=Math.PI/2;for(const d of dist){const span=m.total?d.count/m.total*2*Math.PI:0;arc(p,135,90,61,24,start,span,d.color);start+=span;}const text=`${m.evaluated} / ${m.total}`;p.drawText(text,{x:135-b.widthOfTextAtSize(text,20)/2,y:88,size:20,font:b,color:color('#172D47')});p.drawText('notions évaluées',{x:94,y:70,size:10,font:f,color:color('#5D6674')});});
 const comparisons=s.comparisons?.length?s.comparisons:[{title:s.title,progression:m.progression}];
 await figure('chapters.pdf',320,Math.ceil(comparisons.length/2)*150,(p,f,b)=>{comparisons.forEach((c,i)=>{const cx=80+(i%2)*160,cy=Math.ceil(comparisons.length/2)*150-65-Math.floor(i/2)*150;arc(p,cx,cy,39,12,0,2*Math.PI,reportColors.grey);if(c.progression!==null)arc(p,cx,cy,39,12,Math.PI/2,c.progression/100*2*Math.PI,[reportColors.blue,reportColors.green,reportColors.orange,reportColors.red][i%4]);const value=c.progression===null?'—':num(c.progression)+' %';p.drawText(value,{x:cx-b.widthOfTextAtSize(value,13)/2,y:cy-4,size:13,font:b,color:color('#172D47')});const title=c.title.length>26?c.title.slice(0,24)+'…':c.title;p.drawText(title,{x:cx-f.widthOfTextAtSize(title,10)/2,y:cy-62,size:10,font:f});if(c.progression===null)p.drawText('Pas encore évalué',{x:cx-42,y:cy-76,size:9,font:f,color:color('#5D6674')});});});
 const exams=(m.performances||[]).filter((p:any)=>p.type==='evaluation'&&p.score!==null&&p.scale).map((p:any)=>({...p,normalized:20*p.score/p.scale}));
 // Legacy assessment fields are retained when a session has no structured result.
 const known=new Set(exams.map((x:any)=>x.date+'|'+x.title));for(const a of m.assessments||[])if(!known.has(a.date+'|'+a.title)&&!(m.performances||[]).some((p:any)=>p.date===a.date&&p.title===a.title))exams.push({...a});
 exams.sort((a:any,b:any)=>a.date.localeCompare(b.date));
 if(exams.length)await figure('results.pdf',520,140,(p,f,b)=>{const left=28,bottom=28,w=480,h=98;for(const v of [0,10,20]){p.drawLine({start:{x:left,y:bottom+h*v/20},end:{x:left+w,y:bottom+h*v/20},thickness:.5,color:color('#E2E6EC')});p.drawText(String(v),{x:5,y:bottom+h*v/20-3,size:8,font:f,color:color('#5D6674')});}let previous:any;exams.forEach((a:any,i:number)=>{const point={x:left+(exams.length===1?w/2:w*i/(exams.length-1)),y:bottom+h*a.normalized/20};if(previous)p.drawLine({start:previous,end:point,thickness:1.7,color:color(reportColors.blue)});p.drawCircle({...point,size:3,color:color(a.normalized>=16?reportColors.green:a.normalized>=10?reportColors.blue:reportColors.orange)});p.drawText(num(a.normalized),{x:point.x-8,y:point.y+7,size:8,font:b});p.drawText(a.date.slice(8,10)+'/'+a.date.slice(5,7),{x:point.x-11,y:10,size:8,font:f});previous=point;});});
 const E=texEscape,last=reports.at(-1),period=reports.length?`${day(reports[0].date)} au ${day(reports.at(-1)!.date)}`:'Historique à compléter';
 const groups=new Map<string,typeof reports>();for(const r of reports){const key=isoWeek(r.date).monday;groups.set(key,[...(groups.get(key)||[]),r]);}
 const journey=[...groups.values()].map((rs,i)=>`\\subsection*{${E(i===0?'Les premières séances':`Du ${day(rs[0].date)} au ${day(rs.at(-1)!.date)}`)}}\n`+rs.map(r=>`\\textbf{Le ${E(day(r.date))}}. ${E(r.comment?.trim()||r.summary?.objective||r.title)}\\par\n`).join('\n')).join('\n');
 const skillGroups=[...new Set(s.grid.skills.map(k=>k.group||'Autres notions'))].map(title=>{const ks=s.grid.skills.filter(k=>(k.group||'Autres notions')===title),observed=ks.filter(k=>m.latest?.[k.id]!==undefined),average=observed.length?observed.reduce((n,k)=>n+m.latest[k.id].level*(k.weight||1),0)/observed.reduce((n,k)=>n+(k.weight||1),0):null;return{title,average,count:observed.length,total:ks.length};});
 const source=String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[top=18mm,bottom=18mm,left=21mm,right=21mm]{geometry}
\usepackage{fontspec,xcolor,graphicx,fancyhdr,tabularx,longtable}
\usepackage[french]{babel}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf,BoldItalicFont=lmroman10-bolditalic.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{navy}{HTML}{172D47}\definecolor{muted}{HTML}{5D6674}\definecolor{blue}{HTML}{3975B7}\definecolor{green}{HTML}{32845A}\definecolor{wash}{HTML}{F0F3F7}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\sffamily\bfseries\color{navy}REPÈRE}\fancyhead[R]{\sffamily\small\color{muted}RAPPORT D'APPRENTISSAGE}\fancyfoot[L]{\sffamily\scriptsize\color{muted}Suivi en mathématiques · ${E(day(s.currentAt||s.closedAt||new Date().toISOString()))}}\fancyfoot[R]{\sffamily\scriptsize\thepage}\setlength{\headheight}{15pt}\setlength{\parindent}{0pt}\setlength{\parskip}{7pt}\renewcommand{\headrulewidth}{0.3pt}
\newcommand{\sectiontitle}[1]{\par\vspace{9pt}\noindent{\sffamily\Large\bfseries\color{navy}#1}\par\vspace{3pt}}
\newcommand{\subsectiontitle}[1]{\par\noindent{\sffamily\bfseries\color{navy}#1}\par}

\newcommand{\phase}[1]{\vspace{8pt}{\sffamily\bfseries\color{blue}#1}\par}
\begin{document}\color{navy}
{\sffamily\Huge\bfseries ${E(s.title)}}\par
{\sffamily\color{muted}${E(period)}}\par
\vspace{6pt}\sectiontitle{L'essentiel}
${m.sessions?`Ce rapport retrace ${m.sessions} séances publiées et rassemble les observations du professeur. Les niveaux de maîtrise sont des repères de suivi ; les niveaux déduits sont signalés comme estimations dans les bilans de séance.`:'Aucun bilan publié ne permet encore de décrire les acquis.'}
\begin{center}\colorbox{wash}{\parbox{0.94\linewidth}{\centering\sffamily\vspace{5pt}\textbf{${m.sessions} séances}\hspace{18pt}\textbf{${m.tds} TD distincts}\hspace{18pt}\textbf{${m.evaluations} évaluations}\vspace{5pt}}}\end{center}
\begin{minipage}[t]{.49\linewidth}\subsectiontitle{Les chapitres, en un regard}\includegraphics[width=\linewidth,height=47mm,keepaspectratio]{chapters.pdf}\end{minipage}\hfill\begin{minipage}[t]{.49\linewidth}\subsectiontitle{Les acquis de ce chapitre}\includegraphics[width=\linewidth,height=47mm,keepaspectratio]{distribution.pdf}\end{minipage}\par\medskip\noindent
{\sffamily\small ${dist.map(d=>String.raw`\mbox{\textcolor[HTML]{${d.color.slice(1)}}{\rule{6pt}{6pt}} ${E(d.label)} : ${d.count}}`).join(String.raw`\quad `)} }\par
{\small La progression d'un chapitre tient compte de toute sa grille. Le niveau moyen porte sur les seules notions évaluées : \textbf{${E(num(m.mastery))}${m.mastery===null?'':' \\%'}}. Les notions non évaluées restent distinctes des difficultés observées.}\par
${exams.length?`\\subsectiontitle{Les résultats aux évaluations}\n\\includegraphics[width=\\linewidth,height=38mm]{results.pdf}\n{\\small Notes ramenées sur 20. La difficulté des sujets peut varier ; le récit des séances en précise le contexte.}`:''}
\clearpage\sectiontitle{Le parcours d'apprentissage}
${journey.replaceAll('\\subsection*{','\\phase{')||'Les observations seront ajoutées après publication des séances.'}
\sectiontitle{Les prochaines priorités}
${E(last?.summary?.focus||'Les observations ne permettent pas encore de fixer une priorité précise.')}\par
${E(last?.summary?.nextStep||'Le professeur précisera la suite du travail lors des prochaines séances.')}
\sectiontitle{Les repères, en détail}
\subsectiontitle{Les grands objectifs du chapitre}
\renewcommand{\arraystretch}{1.35}\begin{tabularx}{\linewidth}{@{}Xrr@{}}\sffamily\bfseries Objectif & \sffamily\bfseries Niveau moyen & \sffamily\bfseries Évaluées\\\hline
${skillGroups.map(g=>`${E(g.title)} & ${E(num(g.average))}${g.average===null?'':' \\%'} & ${g.count}/${g.total} \\\\`).join('\n')}
\end{tabularx}\par
{\small Les moyennes par objectif portent sur les derniers niveaux disponibles, en tenant compte des poids de la grille. Le détail de chaque notion reste consultable dans le chapitre et dans les bilans de séance.}\par
${exams.length?`\\subsectiontitle{Les notes d'origine}\n\\begin{longtable}{@{}p{27mm}p{104mm}r@{}}\\sffamily\\bfseries Séance & \\sffamily\\bfseries Évaluation & \\sffamily\\bfseries Note\\\\\\hline\n${exams.map((x:any)=>`${E(day(x.date))} & ${E(x.title)} & ${E(num(x.score))}/${E(num(x.scale))} \\\\`).join('\n')}\n\\end{longtable}`:''}
\subsectiontitle{Cadre du suivi}
${E(s.grid.source?.reference||'Programme de mathématiques')}\par
{\small ${E(s.grid.source?.version||'')} ${s.partial?'L’historique a été reconstitué à partir des informations disponibles.':''} Les brouillons et les notes privées du professeur sont exclus de ce rapport.}
\end{document}`;
 return{source,files:assets};
}
