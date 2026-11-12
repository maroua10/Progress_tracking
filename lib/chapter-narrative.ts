import {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,setStrokingColor,setLineWidth,moveTo,appendBezierCurve,stroke} from 'pdf-lib';
import type {ChapterSnapshot} from './chapter-pdf';
import {chapterEditorial,pedagogicalJourney,shortDate,curriculumReferences} from './chapter-editorial.ts';
export const narrativeVersion='repere-narrative-5';
export const reportColors={red:'#B55059',orange:'#C47427',yellow:'#D1AB27',blue:'#3975B7',green:'#32845A',teal:'#16847A',grey:'#D9DEE5'};
export const texEscape=(v:unknown)=>String(v??'').normalize('NFC').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[\\{}$&#%_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]!)).replace(/[Δ≠≤≥ℝ²ₙ]/g,c=>({'Δ':'\\ensuremath{\\Delta}','≠':'\\ensuremath{\\ne}','≤':'\\ensuremath{\\le}','≥':'\\ensuremath{\\ge}','ℝ':'\\ensuremath{\\mathrm{R}}','²':'\\ensuremath{{}^2}','ₙ':'\\ensuremath{{}_n}'}[c]!));
const num=(n:number|null)=>n===null?'Non évalué':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
export function masteryDistribution(s:ChapterSnapshot){
 const values=s.grid.skills.map(k=>s.metrics.latest?.[k.id]?.level??null);
 return [100,75,50,25,0,null].map((level,i)=>({level,count:values.filter(v=>v===level).length,color:[reportColors.green,reportColors.blue,reportColors.yellow,reportColors.orange,reportColors.red,reportColors.grey][i],label:['Maîtrisée','Réussite sur exercice classique','Quelques aides nécessaires','Guidage important','Difficulté marquée','Non évaluée'][i]}));
}
const color=(hex:string)=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
export async function buildChapterNarrative(s:ChapterSnapshot){
 const m=s.metrics,editorial=chapterEditorial(s),reports=editorial.journey,goals=pedagogicalJourney(reports,s.title),E=texEscape;
 const core=s.grid.skills.filter(k=>k.origin!=='teacher'),objectives=core.length?core:s.grid.skills;
 const mastered=objectives.filter(k=>m.latest?.[k.id]?.level===100).length,evaluated=objectives.filter(k=>m.latest?.[k.id]!==undefined).length;
 const assets:{name:string;bytes:Uint8Array}[]=[];
 async function figure(name:string,width:number,height:number,draw:(p:any,font:any,bold:any)=>void){const pdf=await PDFDocument.create(),f=await pdf.embedFont(StandardFonts.Helvetica),b=await pdf.embedFont(StandardFonts.HelveticaBold),p=pdf.addPage([width,height]);draw(p,f,b);assets.push({name,bytes:await pdf.save()});}
 function text(p:any,f:any,value:string,x:number,y:number,size=10,ink='#172D47'){p.drawText(value,{x,y,size,font:f,color:color(ink)});}
 function arc(p:any,cx:number,cy:number,r:number,width:number,start:number,span:number,c:string){
  if(span<=0)return;const ops:any[]=[pushGraphicsState(),setStrokingColor(color(c)),setLineWidth(width),moveTo(cx+r*Math.cos(start),cy+r*Math.sin(start))],count=Math.ceil(span/(Math.PI/2)),step=span/count;
  for(let i=0;i<count;i++){const a=start+i*step,b=a+step,k=4/3*Math.tan(step/4);ops.push(appendBezierCurve(cx+r*(Math.cos(a)-k*Math.sin(a)),cy+r*(Math.sin(a)+k*Math.cos(a)),cx+r*(Math.cos(b)+k*Math.sin(b)),cy+r*(Math.sin(b)-k*Math.cos(b)),cx+r*Math.cos(b),cy+r*Math.sin(b)));}p.pushOperators(...ops,stroke(),popGraphicsState());
 }
 await figure('objectives.pdf',235,155,(p,f,b)=>{
  arc(p,117,82,49,16,0,2*Math.PI,reportColors.grey);if(objectives.length)arc(p,117,82,49,16,Math.PI/2,mastered/objectives.length*2*Math.PI,reportColors.green);
  const value=evaluated?num(100*mastered/objectives.length)+' %':'—';text(p,b,value,117-b.widthOfTextAtSize(value,23)/2,82,23,reportColors.green);text(p,f,'compétences',117-f.widthOfTextAtSize('compétences',9)/2,66,9);text(p,f,'validées',117-f.widthOfTextAtSize('validées',9)/2,54,9);
  const label=evaluated?`${mastered} compétences sur ${objectives.length}`:'Pas encore évalué';text(p,b,label,117-b.widthOfTextAtSize(label,11)/2,4,11);
 });
 const exams=editorial.exams,last=exams.at(-1);
 if(exams.length)await figure('results.pdf',520,155,(p,f,b)=>{
  const left=29,bottom=30,w=479,h=102;
  for(const n of [0,10,20]){p.drawLine({start:{x:left,y:bottom+h*n/20},end:{x:left+w,y:bottom+h*n/20},thickness:.5,color:color('#DDE4EC')});text(p,f,String(n),5,bottom+h*n/20-3,8,'#667383');}
  let previous:any;exams.forEach((a:any,i:number)=>{const point={x:left+(exams.length===1?w/2:w*i/(exams.length-1)),y:bottom+h*a.normalized/20};if(previous)p.drawLine({start:previous,end:point,thickness:2,color:color(reportColors.blue)});p.drawCircle({...point,size:3.4,color:color(a.normalized>=16?reportColors.green:a.normalized>=10?reportColors.blue:reportColors.orange)});text(p,b,num(a.normalized),point.x-9,point.y+8,9);text(p,f,shortDate(a.date),point.x-12,9,8,'#667383');previous=point;});
 });
 const groups=[...new Set(core.map(k=>k.group||'Autres notions'))].map(title=>{const skills=s.grid.skills.filter(k=>(k.group||'Autres notions')===title),measured=skills.filter(k=>m.latest?.[k.id]!==undefined),total=measured.reduce((n,k)=>n+(k.weight||1),0),average=total?measured.reduce((n,k)=>n+m.latest[k.id].level*(k.weight||1),0)/total:null;return{title,average,count:measured.length,total:skills.length,extra:skills.every(k=>k.origin==='teacher')};});
 if(groups.length)await figure('skills-overview.pdf',520,groups.length*21+4,(p,f,b)=>{
  groups.forEach((g,i)=>{const y=(groups.length-i-1)*21+7,ink=g.average===null?reportColors.grey:g.average===100?reportColors.green:g.average>=75?reportColors.blue:g.average>=50?reportColors.orange:reportColors.red;
   text(p,f,g.extra&&/calcul|fondamentaux/i.test(g.title)?'Les calculs de base':g.title,0,y,10);
   p.drawRectangle({x:337,y:y-1,width:120,height:7,color:color('#E7ECF0')});if(g.average!==null)p.drawRectangle({x:337,y:y-1,width:120*g.average/100,height:7,color:color(ink)});
   text(p,b,g.average===null?'Non évalué':num(g.average)+' %',470,y,10,g.average===null?'#667383':ink);
  });
 });
 const period=reports.length?`Du ${shortDate(reports[0].date)} au ${shortDate(reports.at(-1)!.date)}`:'Bilan à compléter';
 const story=(goal:typeof goals[number])=>goal.entries.map((e,index)=>{
  const refs=curriculumReferences(e,s.grid.skills);
  const keepTogether=(e.excerpt+' '+refs.core.join(' ')+' '+refs.foundations.join(' ')).split(/\s+/).length<=400;
  return (keepTogether?String.raw`\noindent\begin{minipage}{\linewidth}`:'')+(index===0?String.raw`\goal{${goal.color.slice(1)}}{${E(goal.title)}}`:'')+String.raw`\entry{${E(shortDate(e.date))}}{${E(e.excerpt)}}`+
   (refs.core.length?String.raw`\skillref{Compétences du chapitre : }{${E(refs.core.join(' ; '))}.}`:'')+
   (refs.foundations.length?String.raw`\skillref{Calcul algébrique : }{${E(refs.foundations.join(' ; '))}.}`:'')+
   (refs.validation?String.raw`\skillref{Validation finale : }{L’ensemble des compétences du chapitre a été validé à l’issue des évaluations.}`:'')+(keepTogether?String.raw`\end{minipage}`:'')+String.raw`\par\medskip`;
 }).join('\n');
 const source=String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[top=18mm,bottom=18mm,left=21mm,right=21mm]{geometry}
\usepackage{fontspec,xcolor,graphicx,fancyhdr,tabularx,longtable,needspace}
\usepackage[french]{babel}
\setmainfont{lmroman10-regular.otf}[BoldFont=lmroman10-bold.otf,ItalicFont=lmroman10-italic.otf,BoldItalicFont=lmroman10-bolditalic.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{navy}{HTML}{172D47}\definecolor{muted}{HTML}{667383}\definecolor{blue}{HTML}{3975B7}\definecolor{green}{HTML}{32845A}\definecolor{wash}{HTML}{F0F3F7}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\sffamily\bfseries\color{navy}REPÈRE}\fancyhead[R]{\sffamily\small\color{muted}BILAN PÉDAGOGIQUE}\fancyfoot[L]{\sffamily\scriptsize\color{muted}Suivi en mathématiques · ${E(shortDate(s.currentAt||s.closedAt||new Date().toISOString()))}}\fancyfoot[R]{\sffamily\scriptsize\thepage}\setlength{\headheight}{15pt}\setlength{\parindent}{0pt}\setlength{\parskip}{6pt}\renewcommand{\headrulewidth}{0.3pt}
\newcommand{\sectiontitle}[1]{\par\Needspace{5\baselineskip}\vspace{8pt}{\sffamily\Large\bfseries\color{navy}#1}\par\vspace{3pt}}
\newcommand{\goal}[2]{\par\Needspace{8\baselineskip}\vspace{9pt}{\sffamily\large\bfseries\textcolor[HTML]{#1}{#2}}\par\vspace{3pt}}
\newcommand{\entry}[2]{\par\Needspace{8\baselineskip}\noindent{\sffamily\small\bfseries\color{blue}#1}\quad #2\par}
\newcommand{\skillref}[2]{\par\noindent{\fontsize{9.5}{12}\selectfont\color{muted}\textbf{#1}#2}\par\vspace{3pt}}
\begin{document}\color{navy}
{\sffamily\Huge\bfseries ${E(s.title)}}\par
{\sffamily\large ${E(s.studentName)}}\hfill{\sffamily\color{muted}${E(period)}}\par
\sectiontitle{Bilan du chapitre}
${E(editorial.conclusion||editorial.opening)}\par
\begin{center}\colorbox{wash}{\parbox{0.94\linewidth}{\centering\sffamily\vspace{5pt}\textbf{${m.sessions} séances}\hspace{16pt}\textbf{${m.tds} TD distincts}\hspace{16pt}\textbf{${m.evaluations} évaluations}\vspace{5pt}}}\end{center}
\begin{minipage}[c]{.47\linewidth}\sffamily\textbf{Les compétences du chapitre}\par
\includegraphics[width=\linewidth,height=43mm,keepaspectratio]{objectives.pdf}\par

\end{minipage}\hfill\begin{minipage}[c]{.48\linewidth}\sffamily\textbf{Les résultats des contrôles}\par\medskip
${exams.length?String.raw`{\Huge\bfseries\color{blue}${E(num(editorial.mean))}/20}\par Moyenne des ${exams.length} contrôle${exams.length>1?'s':''} noté${exams.length>1?'s':''}\par\bigskip {\Large\bfseries\color{green}${E(num(last.score))}/${E(num(last.scale))}}\par Dernier contrôle corrigé · ${E(shortDate(last.date))}`:'Aucune note renseignée.'}
\end{minipage}\par\medskip
${exams.length?String.raw`\sectiontitle{Résultats des contrôles, sur 20}\includegraphics[width=\linewidth,height=43mm]{results.pdf}`:''}
${groups.length?String.raw`\sectiontitle{Synthèse des compétences}\includegraphics[width=\linewidth,height=${groups.length*6+2}mm,keepaspectratio]{skills-overview.pdf}`:''}

\clearpage\sectiontitle{Parcours pédagogique}
${goals.map(story).join('\n')||'Les premiers exercices permettront de préciser le travail à poursuivre.'}
${exams.some((x:any)=>x.scale!==20)?String.raw`\sectiontitle{Les notes dans leur barème d'origine}\begin{longtable}{@{}p{22mm}p{109mm}r@{}}\sffamily\bfseries Date & \sffamily\bfseries Contrôle & \sffamily\bfseries Note\\\hline\endfirsthead\sffamily\bfseries Date & \sffamily\bfseries Contrôle & \sffamily\bfseries Note\\\hline\endhead`+'\n'+exams.map((a:any)=>`${E(shortDate(a.date))} & ${E(a.title)} & ${E(num(a.score))}/${E(num(a.scale))} \\\\`).join('\n')+'\n\\end{longtable}':''}
\end{document}`;
 return{source,files:assets};
}
