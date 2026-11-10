import{test}from'node:test';import assert from'node:assert/strict';import{reportTopics,type Report}from'../lib/domain.ts';
const base={date:'2026-10-04',title:'Séance',chapterId:'c',gridId:'g',skills:[{id:'a',label:'A',group:'Équations',weight:1},{id:'b',label:'B',group:'Équations',weight:3},{id:'c',label:'C',group:'Formes'}],documentIds:[],comment:'',score:null,scale:null,assessmentTitle:'',partial:false};
const a=(id:string,skillId:string,level:number|null,estimated=false)=>({id,skillId,level,estimated,type:'td' as const,confirmed:false,workRef:'',exercises:'',workId:'one-td'});
test('Les objectifs résument seulement les observations de la séance sans doubler une notion',()=>{const report:Report={...base,activities:[a('1','a',100),a('2','a',25,true),a('3','b',75),a('4','c',null)]};const topics=reportTopics(report);assert.equal(topics.length,2);assert.equal(topics[0].items.length,2);assert.equal(topics[0].level,63);assert.equal(topics[0].estimated,true);assert.equal(topics[1].level,null);assert.equal(topics[1].evaluated,0);assert.equal(report.activities.length,4);});
test('Une activité non évaluée ne remplace pas une observation effectuée le même jour',()=>{const topics=reportTopics({...base,activities:[a('1','a',0),a('2','a',null),a('3','b',null)]});assert.equal(topics[0].level,0);assert.equal(topics[0].evaluated,1);assert.equal(topics[0].items.length,2);});

test('Deux contrôles dans une séance restent deux évaluations, même avec les observations associées',async()=>{
 const {metrics}=await import('../lib/domain.ts');
 const report:Report={...base,activities:[{...a('1','a',75),type:'evaluation',workId:'exam1'},{...a('2','b',50),type:'evaluation',workId:'exam1'},{...a('3','a',100),type:'evaluation',workId:'exam2'}],performances:[{id:'p1',workId:'exam1',title:'Premier',type:'evaluation',score:15,scale:20,minutes:null},{id:'p2',workId:'exam2',title:'Second',type:'evaluation',score:null,scale:null,minutes:60}]};
 const m=metrics([{id:'r',session_id:'s',seq:1,recorded_at:'2026-11-10T12:00:00Z',reason:'',payload:report}],report.skills);assert.equal(m.evaluations,2);assert.equal(m.sessions,1);assert.equal(m.tds,0);
});
