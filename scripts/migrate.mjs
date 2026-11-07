import postgres from 'postgres';
import {readFile,readdir} from 'node:fs/promises';
if(!process.env.DATABASE_URL) throw new Error('Renseignez DATABASE_URL dans .env.local.');
const sql=postgres(process.env.DATABASE_URL,{prepare:false,max:1});
try{
 await sql`CREATE TABLE IF NOT EXISTS repere_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`;
 for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const source=await readFile('supabase/migrations/'+name,'utf8');
  await sql.begin(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(74737101)`;
   if((await tx`SELECT name FROM repere_migrations WHERE name=${name}`).length)return;
   await tx.unsafe(source);
   await tx`INSERT INTO repere_migrations (name) VALUES (${name})`;
  });
  console.log('Migration vérifiée : '+name);
 }
}finally{await sql.end();}
