import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { reportRegularFont, reportBoldFont } from "./report-fonts";
import { performancePoints, type Skill } from "./domain";
export type ChapterSnapshot = {
  title: string; studentName: string; closedAt: string | null;
  currentAt?: string;
  grid: {skills: Skill[]; source: any}; metrics: any; partial: boolean;
};
let regularBytes: Uint8Array | undefined, boldBytes: Uint8Array | undefined;
export async function renderChapterPdf(s: ChapterSnapshot) {
  const doc=await PDFDocument.create(); doc.registerFontkit(fontkit);
  regularBytes ??= Uint8Array.from(atob(reportRegularFont),c=>c.charCodeAt(0));
  boldBytes ??= Uint8Array.from(atob(reportBoldFont),c=>c.charCodeAt(0));
  const regular=await doc.embedFont(regularBytes,{subset:false,features:{liga:false}}),bold=await doc.embedFont(boldBytes,{subset:false,features:{liga:false}});
  const navy=rgb(.08,.18,.31),ink=rgb(.12,.15,.19),muted=rgb(.38,.42,.47),line=rgb(.84,.87,.9),blue=rgb(.18,.37,.59),green=rgb(.09,.4,.23);
  const W=595.28,H=841.89,M=42,CW=W-2*M;
  let p!:PDFPage,y=0;
  const safe=(v:any)=>String(v ?? "").replace(/[\x00-\x08\x0b-\x1f]/g,"").normalize("NFC");
  const date=(v:string)=>new Intl.DateTimeFormat('fr-FR',{timeZone:v.length>10?'Europe/Paris':'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v));
  const num=(v:any)=>v===null||v===undefined?'Non évalué':Number(v).toLocaleString('fr-FR',{maximumFractionDigits:2});
  function page(){p=doc.addPage([W,H]);y=H-91;p.drawText('REPÈRE',{x:M,y:H-43,font:bold,size:16,color:navy});p.drawText('BILAN DE CHAPITRE',{x:W-M-145,y:H-41,font:regular,size:9,color:muted});p.drawLine({start:{x:M,y:H-58},end:{x:W-M,y:H-58},color:line,thickness:1});}
  function ensure(h:number){if(y-h<63)page();}
  function text(v:any,size=10,strong=false,color=ink,gap=6){
    const paragraphs=safe(v).split('\n');
    for(const para of paragraphs){let row='';for(const word of para.split(/\s+/)){let chunks=[word];if(regular.widthOfTextAtSize(word,size)>CW){chunks=[];let c='';for(const ch of word){if(regular.widthOfTextAtSize(c+ch,size)>CW){chunks.push(c);c='';}c+=ch;}if(c)chunks.push(c);}
      for(const chunk of chunks){const trial=row?row+' '+chunk:chunk;if((strong?bold:regular).widthOfTextAtSize(trial,size)>CW && row){ensure(size*1.6);p.drawText(row,{x:M,y,font:strong?bold:regular,size,color});y-=size*1.5;row=chunk;}else row=trial;}}
      ensure(size*1.6);p.drawText(row,{x:M,y,font:strong?bold:regular,size,color});y-=size*1.5;}
    y-=gap;
  }
  function heading(v:string){ensure(95);y-=12;text(v,12,true,navy,10);}
  function graph(title:string,points:{date:string;value:number;label:string}[],max:number,color=navy){
    if(!points.length){ensure(50);text(title,10,true,navy,3);text('Aucune observation renseignée',9,false,muted,10);return;}
    ensure(167);text(title,10,true,navy,4);const top=y-5,left=M+31,width=CW-40,height=91;
    for(const t of [0,.5,1]){const gy=top-height+t*height;p.drawLine({start:{x:left,y:gy},end:{x:left+width,y:gy},color:line,thickness:.5});p.drawText(num(max*t),{x:M,y:gy-3,size:8,font:regular,color:muted});}
    if(!points.length)p.drawText('Aucune observation renseignée',{x:left+70,y:top-50,font:regular,size:10,color:muted});
    const xy=points.map((a,i)=>({x:left+(points.length===1?width/2:i*width/(points.length-1)),y:top-height+Math.min(1,a.value/max)*height}));
    xy.forEach((a,i)=>{if(i)p.drawLine({start:xy[i-1],end:a,color,thickness:1.6});p.drawCircle({x:a.x,y:a.y,size:3,color});});
    if(points.length){p.drawText(date(points[0].date),{x:left,y:top-height-16,font:regular,size:8,color:muted});p.drawText(date(points.at(-1)!.date),{x:left+width-50,y:top-height-16,font:regular,size:8,color:muted});}
    y=top-height-35;
  }
  doc.setTitle('Bilan de chapitre - '+safe(s.title));doc.setAuthor('Repère');page();
  text(s.title,22,true,navy,8);text(s.studentName,11,false,muted,2);text(s.currentAt?'Actualisé le '+date(s.currentAt):s.closedAt?'Clôturé le '+date(s.closedAt):'Clôture déclarée - date non renseignée',10,false,muted,10);
  const m=s.metrics;
  heading('Synthèse');
  text('Progression du chapitre : '+num(m.progression)+(m.progression===null?'':' %'),13,true);
  text(`${m.mastered} / ${m.total} notions maîtrisées  |  ${m.evaluated} / ${m.total} évaluées`,11);
  text(`${m.tds} TD distinct${m.tds!==1?'s':''}  |  ${m.evaluations} évaluation${m.evaluations!==1?'s':''}  |  ${m.sessions} séance${m.sessions!==1?'s':''}${s.currentAt?'':'  |  '+m.exercises+' exercices'}`,10);
  text('Maîtrise des notions évaluées : '+num(m.mastery)+(m.mastery===null?'':' %'),10);
  if(s.partial)text('Historique partiel',9,false,muted);
  graph('Progression du chapitre (%)',m.curve.filter((x:any)=>x.progression!==null).map((x:any)=>({date:x.date,value:x.progression,label:''})),100);
  graph('Maîtrise observée (%)',m.curve.filter((x:any)=>x.mastery!==null).map((x:any)=>({date:x.date,value:x.mastery,label:''})),100,blue);
  graph('Couverture des compétences (%)',m.curve.map((x:any)=>({date:x.date,value:x.coverage,label:''})),100,blue);
  const results=performancePoints(m),graded=results.filter((x:any)=>x.score!==null&&x.scale),timed=results.filter((x:any)=>x.minutes!==null);
  graph('Résultats aux travaux notés (sur 20)',graded.map((x:any)=>({date:x.date,value:20*x.score/x.scale,label:x.title})),20);
  graph('Durées mesurées (minutes)',timed.map((x:any)=>({date:x.date,value:x.minutes,label:x.title})),Math.max(1,...timed.map((x:any)=>x.minutes)),blue);
  const paired=results.filter((x:any)=>x.score!==null && x.scale && x.minutes!==null);
  if(paired.length){
    ensure(190);text('Vue croisée - note et durée',10,true,navy,5);const top=y-10,left=M+35,width=CW-50,height=105,max=Math.max(1,...paired.map((x:any)=>x.minutes));
    p.drawLine({start:{x:left,y:top-height},end:{x:left+width,y:top-height},color:line});p.drawLine({start:{x:left,y:top-height},end:{x:left,y:top},color:line});
    p.drawText(num(max)+' min',{x:M,y:top+8,font:regular,size:8,color:muted});p.drawText('0 / 20',{x:left,y:top-height-17,font:regular,size:8,color:muted});p.drawText('20 / 20',{x:left+width-37,y:top-height-17,font:regular,size:8,color:muted});
    for(const point of paired)p.drawCircle({x:left+width*point.score/point.scale,y:top-height+height*point.minutes/max,size:3.5,color:navy});
    y=top-height-35;text('Comparer des travaux de longueur et de difficulté proches.',8,false,muted,8);
  }
  if(results.length){heading('Résultats détaillés');for(const r of results){ensure(47);text(date(r.date)+' - '+r.title,10,true);text((r.score===null?'Sans note':`${r.score} / ${r.scale} (${num(20*r.score/r.scale)} / 20)`)+(r.minutes===null?'':` - ${num(r.minutes)} min`),9,false,muted);}}
  ensure(150);heading(s.currentAt?'Compétences actuelles':'Compétences à la clôture');let group='';
  for(const skill of s.grid.skills){if((skill.group || 'Notions')!==group){group=skill.group||'Notions';heading(group);}const v=m.latest[skill.id]?.level ?? null;ensure(42);text(skill.label,10,false,ink,2);text(v===null?'Non évaluée':`${v} %${v===100?' - Maîtrisée':''}`,9,v===100,v===100?green:muted,7);}
  heading('Référentiel');text(s.grid.source?.reference || 'Programme de mathématiques',9);text(s.grid.source?.version || '',9,false,muted);
  for(const [i,page] of doc.getPages().entries()){page.drawLine({start:{x:M,y:42},end:{x:W-M,y:42},color:line,thickness:.5});page.drawText(s.currentAt?'Repère - Synthèse des bilans publiés':'Repère - Bilan conservé à la clôture',{x:M,y:27,font:regular,size:8,color:muted});page.drawText(`${i+1} / ${doc.getPageCount()}`,{x:W-M-35,y:27,font:regular,size:8,color:muted});}
  return doc.save();
}
