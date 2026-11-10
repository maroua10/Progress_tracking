import {mkdtemp,readFile,writeFile,rm,cp,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);let cacheReady;
export async function compileLatex(source,files){
 const root=path.join(process.cwd(),'.latex-runtime');
 cacheReady ||= (async()=>{const target=await mkdtemp(path.join(tmpdir(),'repere-tex-cache-'));await cp(path.join(root,'cache'),target,{recursive:true});return target;})();
 const cache=await cacheReady;const dir=await mkdtemp(path.join(tmpdir(),'repere-rapport-'));
 try{
  await writeFile(path.join(dir,'report.tex'),source,{mode:0o600});
  for(const f of files){if(!/^[a-z-]+\.pdf$/.test(f.name))throw Error('Nom de figure invalide');await writeFile(path.join(dir,f.name),f.bytes,{mode:0o600});}
  await run(path.join(root,'tectonic'),['--untrusted','--only-cached','--outdir',dir,path.join(dir,'report.tex')],{cwd:dir,env:{...process.env,TECTONIC_CACHE_DIR:cache},timeout:45000,maxBuffer:1024*1024});
  return new Uint8Array(await readFile(path.join(dir,'report.pdf')));
 }finally{await rm(dir,{recursive:true,force:true});}
}
