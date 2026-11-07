// Administrator-only. Credentials never enter Git, logs or application exports.
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {provisionFixedAccount} from '../lib/auth/provision.mjs';
const {DATABASE_URL,NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,TEACHER_EMAIL,PARENT_USERNAME='parent'}=process.env;
if(!DATABASE_URL||!NEXT_PUBLIC_SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!TEACHER_EMAIL)throw new Error('Configurez DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et TEACHER_EMAIL dans .env.local.');
const args=process.argv.slice(2),value=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const selected=value('--role');if(selected&&!['teacher','parent'].includes(selected))throw new Error('Rôle invalide.');
const email=TEACHER_EMAIL.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Adresse du professeur invalide.');
const sql=postgres(DATABASE_URL,{prepare:false,max:1}),admin=createClient(NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const database={prepare(query){const ignore=query.startsWith('INSERT OR IGNORE');let i=0;const statement=query.replace('INSERT OR IGNORE','INSERT').replace(/\?/g,()=>'$'+(++i))+(ignore?' ON CONFLICT DO NOTHING':'');return {bind(...params){return {async first(){return (await sql.unsafe(statement,params))[0]||null;},async run(){return sql.unsafe(statement,params);}};}};}};
const credentials={},file=path.resolve(value('--output')||'work/account-credentials.json');
try{
 for(const role of selected?[selected]:['teacher','parent']){
  const existing=await database.prepare('SELECT * FROM account_slots WHERE role=?').bind(role).first();
  if(role==='teacher'&&existing&&existing.email!==email){
   if(!args.includes('--replace-teacher'))throw new Error('Une autre adresse professeur est réservée. Utilisez --replace-teacher pour la remplacer explicitement.');
   await database.prepare("UPDATE account_slots SET user_id=NULL,email=?,login_name=?,enabled=0,revoked_at=NULL WHERE role='teacher'").bind(email,email).run();
  }else if(existing?.enabled&&!args.includes('--reset-'+role)){
   console.log(role==='teacher'?'Compte professeur déjà configuré.':'Compte parent déjà configuré.');continue;
  }
  credentials[role]=await provisionFixedAccount(database,admin,{role,login:role==='teacher'?email:PARENT_USERNAME,email:role==='teacher'?email:undefined,reset:args.includes('--reset-'+role)});
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  await writeFile(file,JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
  console.log(role==='teacher'?'Compte professeur configuré.':'Compte parent configuré.');
 }
 if(Object.keys(credentials).length)console.log('Identifiants privés enregistrés dans : '+file);
}finally{await sql.end();}
