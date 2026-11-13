import {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,setStrokingColor,setLineWidth,moveTo,appendBezierCurve,stroke} from 'pdf-lib';
import type {ChapterSnapshot} from './chapter-pdf';
import {chapterEditorial,pedagogicalJourney,shortDate,curriculumReferences,parentWording} from './chapter-editorial.ts';
export const narrativeVersion='repere-narrative-7';
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

 const field=(label:string,value:string)=>value?String.raw`\field{${E(label)}}{${E(/^(Compétences du chapitre|Compétences travaillées|Calcul algébrique)$/.test(label)?value:parentWording(value,s.title))}}`:'';
 const sessions=reports.map(r=>{const custom=ped?.sessions.find(x=>x.date===r.date);return{report:r,custom};});
 let previousPhase='';
 const history=sessions.map(({report:r,custom:c},index)=>{
  const phase=c?.phase||pedagogicalJourney([r],s.title)[0]?.title||'Parcours pédagogique';
  const phaseHeading=phase!==previousPhase?heading(phase):'';previousPhase=phase;
  const refs=curriculumReferences(r,s.grid.skills);
  const paragraphs=c?.narrative||r.text.split(/(?<=[.!?])\s+/u).reduce((groups:string[],sentence:string,index:number)=>{if(index%2===0)groups.push(sentence);else groups[groups.length-1]+=' '+sentence;return groups;},[]);
  return String.raw`\Needspace{12\baselineskip}`+phaseHeading+String.raw`\sessionheading{${E(shortDate(r.date))}}{${E(r.title.replace(/les méthodes sont mieux mobilisées/i,'choisir la bonne méthode'))}}`+
    paragraphs.map(t=>String.raw`\workparagraph{${E(t)}}`).join('\n')+
    (!c?.narrative&&c?.result&&/notes.*disponibles|note non renseignée/i.test(c.result)?String.raw`\workparagraph{La note n’est pas renseignée.}`:'')+
    (refs.core.length?field('Compétences travaillées',refs.core.join(' ; ')+'.'):'')+
    (refs.foundations.length?field('Calcul algébrique',refs.foundations.join(' ; ')+'.'):'')+
    (refs.validation&&!/compétences.*valid|clôtur/i.test(paragraphs.join(' '))?String.raw`\workparagraph{Les compétences du chapitre ont été validées à l’issue de ces évaluations.}`:'')+String.raw`\par\vspace{3mm}`;
 }).join('\n');
 const comparison=ped?.comparison.length?heading('Au début et à la fin du mois')+String.raw`\begin{longtable}{@{}>{\raggedright\arraybackslash}p{30mm}>{\raggedright\arraybackslash}p{64mm}>{\raggedright\arraybackslash}p{64mm}@{}}\textbf{Dimension}&\textbf{Au début}&\textbf{À la fin}\\\hline\endfirsthead\textbf{Dimension}&\textbf{Au début}&\textbf{À la fin}\\\hline\endhead`+ped.comparison.map((r,i)=>String.raw`\textbf{${E(r.dimension)}}&${E(r.before)}&${E(r.after)}\\[3mm]`).join('\n')+String.raw`\end{longtable}`:'';
 const reflexes=ped?.reflexes.length?heading('Choisir une méthode')+ped.reflexes.map(g=>String.raw`\subsectiontitle{${E(g.title)}}`+String.raw`\workparagraph{${E(g.items.join(' '))}}`).join('\n'):'';
 const dimensions=ped?.dimensions.length?heading('Les méthodes et les habitudes de travail')+ped.dimensions.map(d=>String.raw`\Needspace{8\baselineskip}\subsectiontitle{${E(d.title)}}`+String.raw`\workparagraph{${E(d.initial+' '+d.work)}}\workparagraph{${E(d.progress+' '+d.vigilance)}}`).join('\n'):'';
 const source=String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[top=17mm,bottom=17mm,left=20mm,right=20mm]{geometry}
\usepackage{fontspec,xcolor,graphicx,fancyhdr,longtable,needspace,enumitem,array}
\usepackage[french]{babel}
\setmainfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf,ItalicFont=lmsans10-oblique.otf]
\setsansfont{lmsans10-regular.otf}[BoldFont=lmsans10-bold.otf]
\definecolor{navy}{HTML}{172D47}\definecolor{muted}{HTML}{526173}\definecolor{blue}{HTML}{3975B7}\definecolor{green}{HTML}{32845A}\definecolor{orange}{HTML}{B96B23}\definecolor{wash}{HTML}{F1F5F8}\definecolor{bluewash}{HTML}{EDF4FC}\definecolor{greenwash}{HTML}{EDF6F0}\definecolor{orangewash}{HTML}{FFF5E9}\definecolor{line}{HTML}{DEE6EE}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\small\bfseries\color{navy}REPÈRE}\fancyhead[R]{\small\color{muted}BILAN PÉDAGOGIQUE}\fancyfoot[L]{\scriptsize\color{muted}${E(s.title)}}\fancyfoot[R]{\scriptsize\thepage}\setlength{\headheight}{15pt}\setlength{\parindent}{0pt}\setlength{\parskip}{4pt}\renewcommand{\headrulewidth}{.3pt}
\setlist[itemize]{leftmargin=4mm,itemsep=2pt,topsep=3pt,parsep=0pt,label=\textcolor{blue}{\textbullet}}
\setlength{\tabcolsep}{2mm}\renewcommand{\arraystretch}{1.18}
\newcommand{\sectiontitle}[1]{\par\Needspace{7\baselineskip}\vspace{8pt}{\fontsize{15}{18}\selectfont\bfseries\color{navy}#1}\par\vspace{4pt}}
\newcommand{\subsectiontitle}[1]{\par\vspace{5pt}{\large\bfseries\color{blue}#1}\par}
\newcommand{\fieldtitle}[1]{\par\Needspace{4\baselineskip}{\bfseries\color{blue}#1}\par}
\newcommand{\field}[2]{\par\Needspace{4\baselineskip}{\bfseries\color{blue}#1}\quad #2\par}
\newcommand{\workparagraph}[1]{#1\par\vspace{2pt}}
\newcommand{\sessionheading}[2]{\par\vspace{5pt}{\large\bfseries #1\quad #2}\par\vspace{3pt}}
\begin{document}\color{navy}\fontsize{10.5}{13}\selectfont
{\fontsize{26}{30}\selectfont\bfseries ${E(s.title)}}\par
{\large Bilan du ${E(reports.length?shortDate(reports[0].date):'début du suivi')} au ${E(reports.length?shortDate(reports.at(-1)!.date):'jour du bilan')}}\par\vspace{3mm}
${(ped?.opening||[editorial.conclusion||editorial.opening]).map(p=>String.raw`\workparagraph{${E(p)}}`).join('\n')}
\vspace{2mm}\hrule\vspace{3mm}
{\small ${m.sessions} séances\hfill ${m.tds} TD distincts\hfill ${m.evaluations} évaluations\hfill ${exams.length} contrôles notés}\par
${exams.length?String.raw`\vspace{3mm}{\large\bfseries ${E(num(first.normalized))}/20 au premier contrôle\quad $\longrightarrow$\quad ${E(num(last.normalized))}/20 au dernier contrôle corrigé}\par
Moyenne des contrôles : \textbf{${E(num(editorial.mean))}/20}${delta!==null?`; écart entre le premier et le dernier contrôle : ${E(delta>0?'+':'')}${E(num(delta))} points.`:'.'}\par
\includegraphics[width=\linewidth,height=42mm]{results.pdf}`:'Aucune note de contrôle renseignée.'}
{\small\color{muted}${E(ped?.scoreContext||`${m.evaluations} évaluations réalisées ; ${exams.length} contrôles notés représentés.`)}}\par
\subsectiontitle{Les compétences du chapitre}
{\bfseries ${validated} compétences validées sur ${objectives.length}}${s.closedAt?String.raw`\hfill Chapitre terminé`:''}\par
\includegraphics[width=\linewidth]{skills-overview.pdf}\par
{\small\color{muted}Les pourcentages indiquent les compétences validées dans chaque domaine. Des erreurs ponctuelles restent possibles, même après validation.}\par
\subsectiontitle{Pour les prochains contrôles}
${E((ped?.vigilance||[editorial.priority]).filter(Boolean).join(' '))}\par
\clearpage
${comparison}
${reflexes}
${dimensions?String.raw`\clearpage`+dimensions:''}
\clearpage
\sectiontitle{Le travail séance par séance}
${history||'Les premiers exercices permettront de préciser le travail à poursuivre.'}
${ped?.conclusion?heading('À la fin du chapitre')+String.raw`\workparagraph{${E(ped.conclusion)}}`:''}
${exams.some((x:any)=>x.scale!==20)?heading("Les notes dans leur barème d'origine")+String.raw`\begin{longtable}{@{}p{22mm}p{109mm}r@{}}\textbf{Date}&\textbf{Contrôle}&\textbf{Note}\\\endfirsthead\textbf{Date}&\textbf{Contrôle}&\textbf{Note}\\\endhead`+exams.map((a:any)=>`${E(shortDate(a.date))} & ${E(a.title)} & ${E(num(a.score))}/${E(num(a.scale))} \\\\`).join('\n')+String.raw`\end{longtable}`:''}
\end{document}`;
 return{source,files:assets};
}
