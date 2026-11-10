import {compileLatex} from '../lib/latex-compiler.mjs';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFile,readdir} from 'node:fs/promises';
export async function postgresFixture(workerSource){
 const assets=new URL('../node_modules/@electric-sql/pglite/dist/',import.meta.url);
 const pg=new PGlite({pgliteWasmModule:await WebAssembly.compile(await readFile(new URL('pglite.wasm',assets))),initdbWasmModule:await WebAssembly.compile(await readFile(new URL('initdb.wasm',assets))),fsBundle:new Blob([await readFile(new URL('pglite.data',assets))])});
 await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE); CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 for(const name of (await readdir('supabase/migrations')).sort()) await pg.exec(await readFile('supabase/migrations/'+name,'utf8'));
 const adapter=await build({entryPoints:['lib/postgres-adapter.ts'],bundle:true,format:'esm',platform:'node',write:false});
 const {createDatabase}=await import('data:text/javascript;base64,'+Buffer.from(adapter.outputFiles[0].text).toString('base64'));
 const execute=async(query,args)=>{const result=await pg.query(query,args);return {rows:result.rows,count:result.affectedRows || 0};};
 const db=createDatabase(execute,fn=>pg.transaction(tx=>fn(async(query,args)=>{const r=await tx.query(query,args);return {rows:r.rows,count:r.affectedRows || 0};})));
 const blobs=new Map();
 const bucket={async list({prefix=""}={}){return {objects:[...blobs.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))};},async put(key,bytes){blobs.set(key,new Uint8Array(bytes));},async get(key){const b=blobs.get(key);return b?{body:b}:null;},async delete(key){blobs.delete(key);}};
 globalThis.__reperePostgresTest={DB:db,BUCKET:bucket,LATEX:compileLatex};
 const module=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
 return {getD1Database:async()=>db,getR2Bucket:async()=>bucket,dispatchFetch:(url,init)=>module.default.fetch(new Request(url,init)),dispose:()=>pg.close()};
}
