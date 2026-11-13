export type SessionPedagogy = {
  date: string; phase: string; objective: string; work: string[];
  result: string; progress: string; vigilance: string;
};
export type ChapterPedagogy = {
  highlights: string[]; vigilance: string[]; scoreContext: string; conclusion: string;
  comparison: {dimension:string;before:string;after:string}[];
  dimensions: {title:string;initial:string;work:string;progress:string;vigilance:string}[];
  reflexes: {title:string;items:string[]}[];
  adaptations: {difficulty:string;work:string;progress:string}[];
  sessions: SessionPedagogy[];
};
// Editorial content is supplied and reviewed by the teacher, independently of
// numeric observations. It never changes grades, mastery levels or the archive.
export function parseChapterPedagogy(input:unknown):ChapterPedagogy|undefined {
  if(input===undefined)return undefined;
  const object=(v:any)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Structure pédagogique invalide.');return v;};
  const text=(v:any,max=5000)=>{if(typeof v!=='string'||v.length>max)throw Error('Texte pédagogique invalide.');return v.trim();};
  const list=(v:any,max:number,fn:(x:any)=>any)=>{if(!Array.isArray(v)||v.length>max)throw Error('Liste pédagogique invalide.');return v.map(fn);};
  const strings=(v:any,max=30)=>list(v,max,x=>text(x));
  const fields=(v:any,keys:string[])=>{const o=object(v);return Object.fromEntries(keys.map(k=>[k,text(o[k])])) as any;};
  const o=object(input);
  return {
    highlights:strings(o.highlights,8),vigilance:strings(o.vigilance,8),scoreContext:text(o.scoreContext),conclusion:text(o.conclusion),
    comparison:list(o.comparison,16,x=>fields(x,['dimension','before','after'])),
    dimensions:list(o.dimensions,8,x=>fields(x,['title','initial','work','progress','vigilance'])),
    reflexes:list(o.reflexes,8,x=>({...fields(x,['title']),items:strings(x.items)})),
    adaptations:list(o.adaptations,12,x=>fields(x,['difficulty','work','progress'])),
    sessions:list(o.sessions,200,x=>{const s=fields(x,['date','phase','objective','result','progress','vigilance']);if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date))throw Error('Date pédagogique invalide.');return{...s,work:strings(x.work,20)};}),
  };
}
