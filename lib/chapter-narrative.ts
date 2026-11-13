import {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,setStrokingColor,setLineWidth,moveTo,appendBezierCurve,stroke} from 'pdf-lib';
import type {ChapterSnapshot} from './chapter-pdf';
import {chapterEditorial,pedagogicalJourney,shortDate,curriculumReferences,parentWording} from './chapter-editorial.ts';
export const narrativeVersion='repere-narrative-6';
export const reportColors={red:'#B55059',orange:'#C47427',yellow:'#D1AB27',blue:'#3975B7',green:'#32845A',teal:'#16847A',grey:'#D9DEE5'};
export const texEscape=(v:unknown)=>String(v??'').normalize('NFC').replace(/[\x00-\x1f\x7f]/g,' ').replace(/[\\{}$&#%_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]!)).replace(/[Δ≠≤≥ℝ²ₙ]/g,c=>({'Δ':'\\ensuremath{\\Delta}','≠':'\\ensuremath{\\ne}','≤':'\\ensuremath{\\le}','≥':'\\ensuremath{\\ge}','ℝ':'\\ensuremath{\\mathrm{R}}','²':'\\ensuremath{{}^2}','ₙ':'\\ensuremath{{}_n}'}[c]!));
const num=(n:number|null)=>n===null?'Non évalué':n.toLocaleString('fr-FR',{maximumFractionDigits:1});
export function masteryDistribution(s:ChapterSnapshot){
 const values=s.grid.skills.map(k=>s.metrics.latest?.[k.id]?.level??null);
 return [100,75,50,25,0,null].map((level,i)=>({level,count:values.filter(v=>v===level).length,color:[reportColors.green,reportColors.blue,reportColors.yellow,reportColors.orange,reportColors.red,reportColors.grey][i],label:['Maîtrisée','Réussite sur exercice classique','Quelques aides nécessaires','Guidage important','Difficulté marquée','Non évaluée'][i]}));
}
const color=(hex:string)=>rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
export async function buildChapterNarrative(s:ChapterSnapshot){
 const m=s.metrics,editorial=chapterEditorial(s),reports=editorial.journey,E=texEscape,ped=s.pedagogy;
 const core=s.grid.skills.filter(k=>k.origin!=='teacher'),objectives=core.length?core:s.grid.skills;
 const validated=objectives.filter(k=>m.latest?.[k.id]?.level===100).length;
 const ratio=objectives.length?100*validated/objectives.length:null;
 const exams=editorial.exams,first=exams[0],last=exams.at(-1),delta=first&&last?last.normalized-first.normalized:null;
 const assets:{name:string;bytes:Uint8Array}[]=[];
 async function figure(name:string,width:number,height:number,draw:(p:any,font:any,bold:any)=>void){const pdf=await PDFDocument.create(),f=await pdf.embedFont(StandardFonts.Helvetica),b=await pdf.embedFont(StandardFonts.HelveticaBold),p=pdf.addPage([width,height]);draw(p,f,b);assets.push({name,bytes:await pdf.save()});}
 function text(p:any,f:any,value:string,x:number,y:number,size=10,ink='#172D47'){p.drawText(value,{x,y,size,font:f,color:color(ink)});}
 // The gauge counts validated competencies; it is not an average of levels.
 const groups=[...new Set(objectives.map(k=>k.group||'Compétences du chapitre'))].map(title=>{const skills=objectives.filter(k=>(k.group||'Compétences du chapitre')===title),count=skills.filter(k=>m.latest?.[k.id]?.level===100).length;return{title:title==='Forme canonique et problèmes'?'Forme canonique et résolution de problèmes':title,count,total:skills.length,value:100*count/skills.length};});
 await figure('objectives.pdf',520,28,(p,f,b)=>{p.drawRectangle({x:0,y:5,width:520,height:12,color:color('#E7EDF2')});if(ratio!==null)p.drawRectangle({x:0,y:5,width:520*ratio/100,height:12,color:color(reportColors.green)});});
 await figure('skills-overview.pdf',520,groups.length*22+2,(p,f,b)=>{groups.forEach((g,i)=>{const y=(groups.length-i-1)*22+6;text(p,f,g.title,0,y,10);p.drawRectangle({x:330,y:y-1,width:122,height:7,color:color('#E7EDF2')});if(g.value)p.drawRectangle({x:330,y:y-1,width:122*g.value/100,height:7,color:color(reportColors.green)});text(p,b,num(g.value)+' %',469,y,10,reportColors.green);});});
 if(exams.length)await figure('results.pdf',520,145,(p,f,b)=>{
  const left=29,bottom=25,w=477,h=91;
  for(const n of [0,5,10,15,20]){const y=bottom+h*n/20;p.drawLine({start:{x:left,y},end:{x:left+w,y},thickness:.5,color:color('#E3EAF1')});text(p,f,String(n),6,y-3,8,'#667383');}
  let previous:any;exams.forEach((a:any,i:number)=>{const point={x:left+(exams.length===1?w/2:w*i/(exams.length-1)),y:bottom+h*a.normalized/20};if(previous)p.drawLine({start:previous,end:point,thickness:2,color:color(reportColors.blue)});const final=/final|validation/i.test(a.title),ink=final?reportColors.green:reportColors.blue;if(i===0||i===exams.length-1)p.drawCircle({...point,size:6,color:color('#FFFFFF'),borderColor:color(ink),borderWidth:1.5});p.drawCircle({...point,size:3,color:color(ink)});text(p,b,num(a.normalized),point.x-8,point.y+11,10,ink);text(p,f,shortDate(a.date),point.x-12,6,9,'#526173');previous=point;});
 });
 const period=reports.length?`Du ${shortDate(reports[0].date)} au ${shortDate(reports.at(-1)!.date)}`:'Période non renseignée';
 const validatedAll=objectives.length>0&&validated===objectives.length;
 const heading=(t:string)=>String.raw`\sectiontitle{${E(t)}}`;
 const bullets=(items:string[])=>!items.length?'Information non renseignée.':String.raw`\begin{itemize}`+items.map(t=>String.raw`\item ${E(t)}`).join('\n')+String.raw`\end{itemize}`;
 const card=(label:string,value:string,ink='navy')=>String.raw`\begin{minipage}[t]{.235\linewidth}\begin{tcolorbox}[height=18mm,colback=wash,colframe=wash,boxrule=0pt,arc=2mm,left=3mm,right=2mm,top=2mm,bottom=1mm] {\fontsize{20}{22}\selectfont\bfseries\color{${ink}}${E(value)}}\par{\small ${E(label)}}\end{tcolorbox}\end{minipage}`;
 const field=(label:string,value:string)=>value?String.raw`\field{${E(label)}}{${E(/^(Compétences du chapitre|Calcul algébrique)$/.test(label)?value:parentWording(value,s.title))}}`:'';
 const sessions=reports.map(r=>{const custom=ped?.sessions.find(x=>x.date===r.date);return{report:r,custom};});
 let previousPhase='';
 const history=sessions.map(({report:r,custom:c},index)=>{
  const phase=c?.phase||pedagogicalJourney([r],s.title)[0]?.title||'Parcours pédagogique';
  const phaseHeading=phase!==previousPhase?heading(phase):'';previousPhase=phase;
  const refs=curriculumReferences(r,s.grid.skills);
  const work=c?.work||r.text.split(/(?<=[.!?])\s+/u);
  return (ped?.conclusion&&index===sessions.length-1?String.raw`\clearpage`:'')+String.raw`\Needspace{14\baselineskip}`+phaseHeading+String.raw`\begin{tcolorbox}[colback=wash,colframe=line,boxrule=.4pt,arc=2mm,left=3mm,right=3mm,top=2mm,bottom=2mm]\textbf{\color{blue}${E(shortDate(r.date))}}\hspace{8pt}\textbf{${E(r.title)}}\end{tcolorbox}`+
    field('Objectif',c?.objective||r.summary?.objective||'Objectif non renseigné.')+
    String.raw`\fieldtitle{Travail réalisé}`+work.map(t=>String.raw`\workparagraph{${E(t)}}`).join('\n')+
    field('Résultat',c?.result||[...(m.performances||[]),...(m.assessments||[])].filter((p:any)=>p.date===r.date&&Number.isFinite(p.score)&&p.scale>0).map((p:any)=>`${p.title} : ${num(p.score)}/${num(p.scale)}.`).join(' ')||'Résultat chiffré non renseigné ; les observations figurent dans le travail réalisé.')+
    field('Progression',c?.progress||r.summary?.strengths||'Observation complémentaire non renseignée.')+
    field('Point de vigilance',c?.vigilance||r.summary?.focus||'Point de vigilance non renseigné.')+
    (refs.core.length?field('Compétences du chapitre',refs.core.join(' ; ')+'.'):'')+
    (refs.foundations.length?field('Calcul algébrique',refs.foundations.join(' ; ')+'.'):'')+
    (refs.validation?field('Validation finale','L’ensemble des compétences du chapitre a été validé à l’issue des évaluations.'):'')+String.raw`\par\vspace{4mm}`;
 }).join('\n');
 const comparison=ped?.comparison.length?heading('Du niveau initial à la maîtrise du chapitre')+String.raw`\begin{longtable}{@{}>{\raggedright\arraybackslash}p{30mm}>{\raggedright\arraybackslash}p{64mm}>{\raggedright\arraybackslash}p{64mm}@{}}\rowcolor{navy}\color{white}\textbf{Dimension}&\color{white}\textbf{Au début}&\color{white}\textbf{À la fin}\\\endfirsthead\rowcolor{navy}\color{white}Dimension&\color{white}Au début&\color{white}À la fin\\\endhead`+ped.comparison.map((r,i)=>String.raw`\rowcolor{${i%2?'white':'wash'}}\textbf{${E(r.dimension)}}&${E(r.before)}&${E(r.after)}\\[3mm]`).join('\n')+String.raw`\end{longtable}`:'';
 const reflexes=ped?.reflexes.length?heading('Les réflexes mathématiques développés')+String.raw`\begin{tcolorbox}[colback=bluewash,colframe=bluewash,arc=2mm]Le progrès principal : reconnaître \textbf{quand et comment utiliser une méthode}, puis enchaîner les démarches utiles dans un même exercice.\end{tcolorbox}`+ped.reflexes.map(g=>String.raw`\textbf{\color{blue}${E(g.title)}}`+bullets(g.items)).join('\n'):'';
 const dimensions=ped?.dimensions.length?heading('Quatre dimensions de progression')+String.raw`{\small\color{muted}Synthèse qualitative fondée sur les séances ; aucun pourcentage n’est attribué à ces dimensions.}\par`+ped.dimensions.map(d=>String.raw`\Needspace{12\baselineskip}\subsectiontitle{${E(d.title)}}`+field('Au départ',d.initial)+field('Travail ciblé',d.work)+field('Progrès observés',d.progress)+field('À consolider',d.vigilance)).join('\n'):'';
 const adaptations=ped?.adaptations.length?heading('Un accompagnement adapté aux difficultés')+String.raw`\begin{longtable}{@{}>{\raggedright\arraybackslash}p{45mm}>{\raggedright\arraybackslash}p{58mm}>{\raggedright\arraybackslash}p{55mm}@{}}\rowcolor{navy}\color{white}\textbf{Difficulté identifiée}&\color{white}\textbf{Travail ciblé}&\color{white}\textbf{Progrès observé}\\\endfirsthead\rowcolor{navy}\color{white}Difficulté identifiée&\color{white}Travail ciblé&\color{white}Progrès observé\\\endhead`+ped.adaptations.map((r,i)=>String.raw`\rowcolor{${i%2?'white':'wash'}}${E(r.difficulty)}&${E(r.work)}&${E(r.progress)}\\[4mm]`).join('\n')+String.raw`\end{longtable}`:'';
 const source=String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[top=17mm,bottom=17mm,left=20mm,right=20mm]{geometry}
\usepackage{fontspec,xcolor,graphicx,fancyhdr,longtable,needspace,enumitem,tcolorbox,colortbl,array}
\usepackage[french]{babel}
\setmainfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf,ItalicFont=lmsans10-oblique.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{navy}{HTML}{172D47}\definecolor{muted}{HTML}{526173}\definecolor{blue}{HTML}{3975B7}\definecolor{green}{HTML}{32845A}\definecolor{orange}{HTML}{B96B23}\definecolor{wash}{HTML}{F1F5F8}\definecolor{bluewash}{HTML}{EDF4FC}\definecolor{greenwash}{HTML}{EDF6F0}\definecolor{orangewash}{HTML}{FFF5E9}\definecolor{line}{HTML}{DEE6EE}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\small\bfseries\color{navy}REPÈRE}\fancyhead[R]{\small\color{muted}BILAN PÉDAGOGIQUE}\fancyfoot[L]{\scriptsize\color{muted}${E(s.title)} · ${E(s.studentName)}}\fancyfoot[R]{\scriptsize\thepage}\setlength{\headheight}{15pt}\setlength{\parindent}{0pt}\setlength{\parskip}{4pt}\renewcommand{\headrulewidth}{.3pt}
\setlist[itemize]{leftmargin=4mm,itemsep=2pt,topsep=3pt,parsep=0pt,label=\textcolor{blue}{\textbullet}}
\setlength{\tabcolsep}{2mm}\renewcommand{\arraystretch}{1.18}
\newcommand{\sectiontitle}[1]{\par\Needspace{7\baselineskip}\vspace{6pt}{\fontsize{16}{19}\selectfont\bfseries\color{navy}#1}\par\vspace{3pt}}
\newcommand{\subsectiontitle}[1]{\par\vspace{5pt}{\large\bfseries\color{blue}#1}\par}
\newcommand{\fieldtitle}[1]{\par\Needspace{4\baselineskip}{\bfseries\color{blue}#1}\par}
\newcommand{\field}[2]{\par\Needspace{4\baselineskip}{\bfseries\color{blue}#1}\quad #2\par}
\newcommand{\workparagraph}[1]{#1\par}
\begin{document}\color{navy}\fontsize{10.5}{13}\selectfont
{\fontsize{27}{30}\selectfont\bfseries ${E(s.title)}}\par
{\large ${E(s.studentName)}}\hfill{\color{muted}${E(period)}}\par
{\small\bfseries\color{${s.closedAt?'green':'blue'}}${s.closedAt?(validatedAll?'CHAPITRE TERMINÉ ET VALIDÉ':'CHAPITRE TERMINÉ'):'CHAPITRE EN COURS'}}\par\vspace{2mm}
${[card('séances réalisées',String(m.sessions)),card('TD distincts',String(m.tds)),card('évaluations',String(m.evaluations)),card('contrôles notés',String(exams.length))].join(String.raw`\hfill`)}
\begin{minipage}[t]{.64\linewidth}\begin{tcolorbox}[height=24mm,colback=bluewash,colframe=bluewash,boxrule=0pt,arc=2mm,left=3mm,top=2mm,bottom=2mm]
{\small Premier contrôle \hfill Dernier contrôle corrigé}\par
${exams.length?String.raw`{\fontsize{25}{28}\selectfont\bfseries ${E(num(first.normalized))}/20 \; $\longrightarrow$ \; \color{green}${E(num(last.normalized))}/20}\hfill{\bfseries\color{blue}${delta===null?'':E((delta>0?'+':'')+num(delta))+' points'}}`:'Aucune note renseignée.'}
\end{tcolorbox}\end{minipage}\hfill\begin{minipage}[t]{.33\linewidth}\begin{tcolorbox}[height=24mm,colback=wash,colframe=wash,boxrule=0pt,arc=2mm,left=3mm,top=2mm,bottom=2mm]
{\small Moyenne des contrôles}\par{\bfseries\color{blue}${editorial.mean===null?String.raw`\large Non renseignée`:String.raw`\fontsize{25}{28}\selectfont `+E(num(editorial.mean))+'/20'}}
\end{tcolorbox}\end{minipage}
${exams.length?String.raw`\subsectiontitle{Résultats des contrôles, sur 20}\includegraphics[width=\linewidth,height=42mm]{results.pdf}`:''}
${exams.some((a:any)=>/final|validation/i.test(a.title))?String.raw`{\small\color{blue}Autres contrôles notés}\quad{\small\color{green}Contrôle final}\par`:''}
{\fontsize{9.5}{11.5}\selectfont\color{muted}${E(ped?.scoreContext||`${m.evaluations} évaluations réalisées ; ${exams.length} contrôles notés représentés. Les notes intermédiaires restent visibles.`)}}\par
\subsectiontitle{Les compétences du chapitre \hfill ${validated}/${objectives.length} validées}
{\small\color{green}${ratio===null?'Pas encore évalué':E(num(ratio))+String.raw`\,\% des compétences du chapitre travaillées et validées`}}\par
\includegraphics[width=\linewidth]{skills-overview.pdf}\par
{\fontsize{9.5}{11.5}\selectfont\color{muted}Ces pourcentages indiquent la validation des compétences, et non un taux de réussite garanti dans toutes les situations.}\par\vspace{1mm}
\begin{minipage}[t]{.49\linewidth}\vspace{0pt}\begin{tcolorbox}[colback=greenwash,colframe=greenwash,boxrule=0pt,arc=2mm,left=3mm,right=3mm,top=2mm,bottom=2mm]\textbf{\color{green}Principales améliorations}${bullets(ped?.highlights||[editorial.conclusion||editorial.opening])}\end{tcolorbox}\end{minipage}\hfill\begin{minipage}[t]{.49\linewidth}\vspace{0pt}\begin{tcolorbox}[colback=orangewash,colframe=orangewash,boxrule=0pt,arc=2mm,left=3mm,right=3mm,top=2mm,bottom=2mm]\textbf{\color{orange}Points à consolider}${bullets(ped?.vigilance||[editorial.priority||'Point de vigilance non renseigné.'])}\end{tcolorbox}\end{minipage}
\clearpage
${comparison}
${reflexes}
${dimensions?String.raw`\clearpage`+dimensions:''}
${adaptations}
\clearpage
\sectiontitle{Historique pédagogique détaillé}
${history||'Les premiers exercices permettront de préciser le travail à poursuivre.'}
${ped?.conclusion?heading('Bilan et perspectives')+String.raw`\begin{tcolorbox}[colback=bluewash,colframe=bluewash,arc=2mm]${E(ped.conclusion)}\end{tcolorbox}`:''}
${exams.some((x:any)=>x.scale!==20)?heading("Les notes dans leur barème d'origine")+String.raw`\begin{longtable}{@{}p{22mm}p{109mm}r@{}}\textbf{Date}&\textbf{Contrôle}&\textbf{Note}\\\endfirsthead\textbf{Date}&\textbf{Contrôle}&\textbf{Note}\\\endhead`+exams.map((a:any)=>`${E(shortDate(a.date))} & ${E(a.title)} & ${E(num(a.score))}/${E(num(a.scale))} \\\\`).join('\n')+String.raw`\end{longtable}`:''}
\end{document}`;
 return{source,files:assets};
}
