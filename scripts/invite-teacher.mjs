// Run only from an administrator terminal, never from a public signup endpoint.
import postgres from 'postgres';
import {createClient} from '@supabase/supabase-js';
const {DATABASE_URL,NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,TEACHER_EMAIL,APP_URL}=process.env;
if(!DATABASE_URL||!NEXT_PUBLIC_SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!TEACHER_EMAIL||!APP_URL)throw new Error('Configurez DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEACHER_EMAIL et APP_URL.');
const email=TEACHER_EMAIL.trim().toLowerCase();
const client=createClient(NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const sql=postgres(DATABASE_URL,{prepare:false,max:1});
try{
 // Find the exact existing account, without promoting arbitrary browser registrations.
 let user;let page=1;
 for(;;page++){
  const {data,error}=await client.auth.admin.listUsers({page,perPage:100});if(error)throw new Error('Impossible de lire les comptes Supabase.');
  user=data.users.find(u=>u.email?.toLowerCase()===email);
  if(user||data.users.length<100)break;
 }
 if(user){
  await sql`INSERT INTO app_teachers (user_id,email,created_at) VALUES (${user.id},${email},${new Date().toISOString()}) ON CONFLICT(user_id) DO UPDATE SET revoked_at=NULL,email=excluded.email`;
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('/auth/callback?next=/auth/password',APP_URL).href});if(error)throw new Error('Le compte professeur est autorisé, mais l’e-mail n’a pas été envoyé. Vérifiez le SMTP puis relancez.');
 }else{
  const {data,error}=await client.auth.admin.inviteUserByEmail(email,{redirectTo:new URL('/auth/callback?next=/auth/password',APP_URL).href});
  if(error||!data.user)throw new Error('Invitation non envoyée. Vérifiez le SMTP Supabase puis réessayez.');
  await sql`INSERT INTO app_teachers (user_id,email,created_at) VALUES (${data.user.id},${email},${new Date().toISOString()}) ON CONFLICT(user_id) DO NOTHING`;
 }
 console.log('Compte professeur autorisé. E-mail de création du mot de passe envoyé.');
}finally{await sql.end();}
