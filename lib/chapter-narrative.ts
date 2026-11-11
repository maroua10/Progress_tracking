import {PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, setStrokingColor, setLineWidth, moveTo, appendBezierCurve, stroke} from 'pdf-lib';
import type {ChapterSnapshot} from './chapter-pdf';
import {isoWeek} from './domain.ts';
import {chapterEditorial, friendlyObjective, parentWording} from './chapter-editorial.ts';
export const narrativeVersion='repere-narrative-2';
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
 const m=s.metrics,dist=masteryDistribution(s),editorial=chapterEditorial(s),reports=editorial.journey;
 const assets:{name:string;bytes:Uint8Array}[]=[];
 async function figure(name:string,width:number,height:number,draw:(page:any,font:any,bold:any)=>void){const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);const p=pdf.addPage([width,height]);draw(p,font,bold);assets.push({name,bytes:await pdf.save()});}
 function arc(p:any,cx:number,cy:number,r:number,width:number,start:number,span:number,c:string){
  if(span<=0)return;const ops:any[]=[pushGraphicsState(),setStrokingColor(color(c)),setLineWidth(width),moveTo(cx+r*Math.cos(start),cy+r*Math.sin(start))];
  const count=Math.ceil(span/(Math.PI/2)),step=span/count;
  for(let i=0;i<count;i++){const a=start+i*step,b=a+step,k=4/3*Math.tan(step/4);ops.push(appendBezierCurve(cx+r*(Math.cos(a)-k*Math.sin(a)),cy+r*(Math.sin(a)+k*Math.cos(a)),cx+r*(Math.cos(b)+k*Math.sin(b)),cy+r*(Math.sin(b)-k*Math.cos(b)),cx+r*Math.cos(b),cy+r*Math.sin(b)));}
  p.pushOperators(...ops,stroke(),popGraphicsState());
 }
 await figure('distribution.pdf',270,176,(p,f,b)=>{let start=Math.PI/2;for(const d of dist){const span=m.total?d.count/m.total*2*Math.PI:0;arc(p,135,90,61,24,start,span,d.color);start+=span;}const text=`${m.evaluated} / ${m.total}`;p.drawText(text,{x:135-b.widthOfTextAtSize(text,20)/2,y:88,size:20,font:b,color:color('#172D47')});p.drawText('notions évaluées',{x:94,y:70,size:10,font:f,color:color('#5D6674')});});
 const exams=editorial.exams;
 await figure('controls.pdf',270,176,(p,f,b)=>{arc(p,135,90,61,24,0,2*Math.PI,reportColors.grey);if(exams.length)arc(p,135,90,61,24,Math.PI/2,editorial.successful/exams.length*2*Math.PI,reportColors.blue);const text=exams.length?`${editorial.successful} / ${exams.length}`:'—';p.drawText(text,{x:135-b.widthOfTextAtSize(text,20)/2,y:88,size:20,font:b,color:color('#172D47')});p.drawText('au moins 15 / 20',{x:97,y:70,size:10,font:f,color:color('#5D6674')});});
 if(exams.length)await figure('results.pdf',520,140,(p,f,b)=>{const left=28,bottom=28,w=480,h=98;for(const v of [0,10,20]){p.drawLine({start:{x:left,y:bottom+h*v/20},end:{x:left+w,y:bottom+h*v/20},thickness:.5,color:color('#E2E6EC')});p.drawText(String(v),{x:5,y:bottom+h*v/20-3,size:8,font:f,color:color('#5D6674')});}let previous:any;exams.forEach((a:any,i:number)=>{const point={x:left+(exams.length===1?w/2:w*i/(exams.length-1)),y:bottom+h*a.normalized/20};if(previous)p.drawLine({start:previous,end:point,thickness:1.7,color:color(reportColors.blue)});p.drawCircle({...point,size:3,color:color(a.normalized>=16?reportColors.green:a.normalized>=10?reportColors.blue:reportColors.orange)});p.drawText(num(a.normalized),{x:point.x-8,y:point.y+7,size:8,font:b});p.drawText(a.date.slice(8,10)+'/'+a.date.slice(5,7),{x:point.x-11,y:10,size:8,font:f});previous=point;});});
 const E=texEscape,period=reports.length?`${day(reports[0].date)} au ${day(reports.at(-1)!.date)}`:'Bilan à compléter';
 const groups=new Map<string,typeof reports>();for(const r of reports){const key=isoWeek(r.date).monday;groups.set(key,[...(groups.get(key)||[]),r]);}
 const journey=[...groups.values()].map((rs,i)=>{
  const corpus=rs.map(r=>r.text).join(' ').toLowerCase();
  const title=i===0?'Reprendre les bases':corpus.includes('fractions')?'Sécuriser les calculs et vérifier les acquis':corpus.includes('facteur commun')?'Choisir la bonne méthode et consolider les acquis':'Rendre les méthodes plus sûres';
  return `\\phase{${E(title)}}\n`+rs.map((r,i)=>`\\textbf{Le ${E(day(r.date))}}. ${E(r.text)}${i%2===1?'\\par\n':' '}`).join('')+'\\par\n';
 }).join('\n');
 const skillGroups=[...new Set(s.grid.skills.map(k=>k.group||'Autres notions'))].map(title=>{const ks=s.grid.skills.filter(k=>(k.group||'Autres notions')===title),observed=ks.filter(k=>m.latest?.[k.id]!==undefined),average=observed.length?observed.reduce((n,k)=>n+m.latest[k.id].level*(k.weight||1),0)/observed.reduce((n,k)=>n+(k.weight||1),0):null;return{title:friendlyObjective(title),average,count:observed.length,total:ks.length};});
 const source=String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[top=18mm,bottom=18mm,left=21mm,right=21mm]{geometry}
\usepackage{fontspec,xcolor,graphicx,fancyhdr,tabularx,longtable,needspace}
\usepackage[french]{babel}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf,BoldItalicFont=lmroman10-bolditalic.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{navy}{HTML}{172D47}\definecolor{muted}{HTML}{5D6674}\definecolor{blue}{HTML}{3975B7}\definecolor{green}{HTML}{32845A}\definecolor{wash}{HTML}{F0F3F7}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\sffamily\bfseries\color{navy}REPÈRE}\fancyhead[R]{\sffamily\small\color{muted}RAPPORT D'APPRENTISSAGE}\fancyfoot[L]{\sffamily\scriptsize\color{muted}Suivi en mathématiques · ${E(day(s.currentAt||s.closedAt||new Date().toISOString()))}}\fancyfoot[R]{\sffamily\scriptsize\thepage}\setlength{\headheight}{15pt}\setlength{\parindent}{0pt}\setlength{\parskip}{7pt}\renewcommand{\headrulewidth}{0.3pt}
\newcommand{\sectiontitle}[1]{\par\Needspace{5\baselineskip}\vspace{9pt}\noindent{\sffamily\Large\bfseries\color{navy}#1}\par\vspace{3pt}}
\newcommand{\subsectiontitle}[1]{\par\noindent{\sffamily\bfseries\color{navy}#1}\par}

\newcommand{\phase}[1]{\vspace{8pt}{\sffamily\bfseries\color{blue}#1}\par}
\begin{document}\color{navy}
{\sffamily\Huge\bfseries ${E(s.title)}}\par
{\sffamily\color{muted}${E(period)}}\par
\vspace{6pt}\sectiontitle{L'essentiel}
${E(editorial.opening)}\par
${E(editorial.controlSummary)} ${E(editorial.change)}\par
\begin{center}\colorbox{wash}{\parbox{0.94\linewidth}{\centering\sffamily\vspace{5pt}\textbf{${m.sessions} séances}\hspace{18pt}\textbf{${m.tds} TD distincts}\hspace{18pt}\textbf{${m.evaluations} évaluations}\vspace{5pt}}}\end{center}
\begin{minipage}[t]{.49\linewidth}\subsectiontitle{Les contrôles}\includegraphics[width=\linewidth,height=47mm,keepaspectratio]{controls.pdf}\end{minipage}\hfill\begin{minipage}[t]{.49\linewidth}\subsectiontitle{Les acquis du chapitre}\includegraphics[width=\linewidth,height=47mm,keepaspectratio]{distribution.pdf}\end{minipage}\par\medskip\noindent
{\sffamily\small ${dist.filter(d=>d.count>0).map(d=>String.raw`\mbox{\textcolor[HTML]{${d.color.slice(1)}}{\rule{6pt}{6pt}} ${E(d.label)} : ${d.count}}`).join(String.raw`\quad `)} }\par
${E(m.evaluated?`${m.mastered} notions sont bien installées. ${dist.find(d=>d.level===75)!.count} sont réussies sur les exercices classiques et ${dist.filter(d=>d.level!==null&&d.level<=50).reduce((v,d)=>v+d.count,0)} restent plus fragiles. ${m.total-m.evaluated} restent à vérifier.`:'Les premières observations permettront de préciser les acquis.')}\par
${exams.length?`\\subsectiontitle{Les résultats aux évaluations}\n\\includegraphics[width=\\linewidth,height=38mm]{results.pdf}\n{\\small Les notes se lisent avec le niveau des sujets : un contrôle plus difficile peut donner une note plus basse.}`:''}
\clearpage\sectiontitle{Le parcours d'apprentissage}
${journey||'Nous préciserons les acquis après les premiers exercices.'}
\sectiontitle{Les prochaines priorités}
${E(editorial.priority||parentWording(reports.at(-1)?.summary?.focus||'',s.title))}\par
${E(editorial.next)}
\sectiontitle{Les repères, en détail}
\subsectiontitle{Les grands objectifs du chapitre}
\renewcommand{\arraystretch}{1.35}\begin{tabularx}{\linewidth}{@{}Xrr@{}}\sffamily\bfseries Objectif & \sffamily\bfseries Niveau moyen & \sffamily\bfseries Évaluées\\\hline
${skillGroups.map(g=>`${E(g.title)} & ${E(num(g.average))}${g.average===null?'':' \\%'} & ${g.count}/${g.total} \\\\`).join('\n')}
\end{tabularx}\par
${exams.length?`\\subsectiontitle{Les notes d'origine}\n\\begin{longtable}{@{}p{27mm}p{104mm}r@{}}\\sffamily\\bfseries Séance & \\sffamily\\bfseries Évaluation & \\sffamily\\bfseries Note\\\\\\hline\n${exams.map((x:any)=>`${E(day(x.date))} & ${E(x.title)} & ${E(num(x.score))}/${E(num(x.scale))} \\\\`).join('\n')}\n\\end{longtable}`:''}
\end{document}`;
 return{source,files:assets};
}
