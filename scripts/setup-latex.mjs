import{mkdir,readFile,writeFile,chmod,access,rm}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import path from'node:path';import{pathToFileURL}from'node:url';import{build}from'esbuild';
const run=promisify(execFile),root=path.join(process.cwd(),'.latex-runtime');await mkdir(root,{recursive:true});
const target=process.platform==='darwin'&&process.arch==='arm64'?'aarch64-apple-darwin':process.platform==='linux'&&process.arch==='x64'?'x86_64-unknown-linux-musl':null;
if(!target)throw Error('Compilation LaTeX : plateforme non prise en charge.');
const expected={'aarch64-apple-darwin':'a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667','x86_64-unknown-linux-musl':'8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7'}[target];
try{await access(path.join(root,'tectonic'));}catch{
 const response=await fetch(`https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-${target}.tar.gz`);if(!response.ok)throw Error('Téléchargement du moteur LaTeX impossible.');const bytes=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Empreinte du moteur LaTeX invalide.');const archive=path.join(root,'engine.tar.gz');await writeFile(archive,bytes);await run('tar',['-xzf',archive,'-C',root]);await rm(archive);await chmod(path.join(root,'tectonic'),0o755);
}
const warm=path.join(root,'warm');await mkdir(warm,{recursive:true});
await build({entryPoints:['lib/chapter-narrative.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(warm,'template.mjs')});
const{buildChapterNarrative}=await import(pathToFileURL(path.join(warm,'template.mjs')).href);
const report=await buildChapterNarrative({title:'Chapitre',studentName:'Données de compilation',currentAt:'2026-01-01',closedAt:null,partial:false,grid:{skills:[{id:'warm',label:'Notion'}],source:{}},metrics:{latest:{warm:{level:75}},mastery:75,total:1,evaluated:1,sessions:1,tds:1,evaluations:1,progression:75,performances:[{type:'evaluation',title:'Contrôle',date:'2026-01-01',score:15,scale:20}],assessments:[]},reports:[{date:'2026-01-01',title:'Séance',comment:'Texte de compilation : évaluation, progrès et réussite. Δ ≥ ≤ ℝ ² ₙ.',skills:[{id:'warm',label:'Vérifier Δ ≥ 0, x² ≠ 1, ℝ et uₙ'}],activities:[{id:'warm-activity',skillId:'warm',type:'td',level:75,confirmed:false,workRef:'',exercises:''}]}]});
await writeFile(path.join(warm,'report.tex'),report.source);for(const f of report.files)await writeFile(path.join(warm,f.name),f.bytes);
await run(path.join(root,'tectonic'),['--untrusted','--outdir',warm,path.join(warm,'report.tex')],{cwd:warm,env:{...process.env,TECTONIC_CACHE_DIR:path.join(root,'cache')},timeout:480000,maxBuffer:8*1024*1024});
await rm(warm,{recursive:true,force:true});console.log('Moteur LaTeX 0.17.0 et ressources prêts pour une compilation hors ligne.');
