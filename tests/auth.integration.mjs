import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {postgresFixture} from './postgres-fixture.mjs';
test('Deux comptes fixes — base PostgreSQL et fournisseur d’authentification isolés', {timeout:45000},async t=>{
 const fixture=await postgresFixture('export default {};'),db=globalThis.__reperePostgresTest.DB;
 const teacher={id:'11111111-1111-4111-8111-111111111111',email:'prof@exemple.fr',email_confirmed_at:'2026-11-07'},stranger={id:'33333333-3333-4333-8333-333333333333',email:'inconnu@exemple.fr',email_confirmed_at:'2026-11-07',user_metadata:{role:'teacher'}};
 const users=new Map([[teacher.email,{user:teacher,password:'Mot de passe professeur 2026'}],[stranger.email,{user:stranger,password:'Mot de passe inconnu 2026'}]]);
 for(const user of [teacher,stranger])await db.prepare('INSERT INTO auth.users (id,email) VALUES (?,?)').bind(user.id,user.email).run();
 await db.prepare("INSERT INTO account_slots (role,user_id,email,login_name,enabled,created_at) VALUES ('teacher',?,?,?,1,?)").bind(teacher.id,teacher.email,teacher.email,'2026-11-07').run();
 const cookieMap=new Map(),sent=[],state={user:null,client:{auth:{
  async getUser(){return {data:{user:state.user},error:null};},
  async signInWithPassword({email,password}){const found=users.get(email);state.user=found?.password===password?found.user:null;return {error:state.user?null:{message:'invalid'}};},
  async signOut(){state.user=null;return {error:null};},
  async updateUser({password}){users.get(state.user.email).password=password;return {error:null};},
  async resetPasswordForEmail(email,options){sent.push({email,options});return {error:null};},
  async signInWithOAuth(options){state.oauth=options;return {data:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=test'},error:null};},
  async exchangeCodeForSession(code){state.user=code==='teacher'?teacher:stranger;return {error:null};},
  async verifyOtp(){return {error:{message:'invalid'}};},
 }},admin:{auth:{admin:{
  async createUser({email,password}){const user={id:crypto.randomUUID(),email,email_confirmed_at:'2026-11-07'};await db.prepare('INSERT INTO auth.users (id,email) VALUES (?,?)').bind(user.id,email).run();users.set(email,{user,password});return {data:{user},error:null};},
  async updateUserById(id,{password}){const found=[...users.values()].find(v=>v.user.id===id);if(!found)return {error:{message:'missing'}};found.password=password;return {error:null};},
 }}},cookies:{get:n=>cookieMap.has(n)?{value:cookieMap.get(n)}:undefined,set:(n,v)=>cookieMap.set(n,v),delete:n=>cookieMap.delete(n)}};
 globalThis.__authFixture=state;
 const built=await build({stdin:{contents:"export {authRoute} from './lib/auth/routes';export {handle,ApiError,parentExchange} from './lib/server';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',packages:'external',write:false,plugins:[{name:'isolated-auth-dependencies',setup(b){
  b.onResolve({filter:/^(\.\.\/|\.\/)runtime$/},()=>({path:new URL('./auth-runtime.ts',import.meta.url).pathname}));
  b.onResolve({filter:/^\.\/supabase$/},()=>({path:new URL('./auth-supabase.ts',import.meta.url).pathname}));
  b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
  b.onResolve({filter:/^next\/headers$/},()=>({path:new URL('./auth-cookies.ts',import.meta.url).pathname}));
 }}]});
 await mkdir('work',{recursive:true});const file='work/fixed-auth-test-'+crypto.randomUUID()+'.mjs';await writeFile(file,built.outputFiles[0].text);
 const {authRoute,handle,ApiError,parentExchange}=await import(pathToFileURL(process.cwd()+'/'+file));
 const call=(action,method='POST',data={},origin='https://repere.test')=>authRoute(new Request('https://repere.test/auth/'+action,{method,headers:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data)})}),action.split('?')[0]);
 async function api(path,method='GET',body,headers={}){try{return await handle(new Request('https://repere.test/api/'+path,{method,headers:{origin:'https://repere.test','Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),path.split('/'));}catch(e){return new Response(null,{status:e instanceof ApiError?e.status:500});}}
 let parent,credentials;
 try{
  await t.test('Inscription professeur et parent publique désactivée, métadonnées et faux en-têtes ignorés',async()=>{
   for(const action of ['register','signup','invitations'])assert.equal((await call(action,'POST',{role:'teacher',email:stranger.email})).status,403);
   state.user=stranger;assert.equal((await api('data')).status,401);assert.equal((await api('setup','POST',{}, {'oai-authenticated-user-id':teacher.id})).status,401);
   assert.equal((await call('parents')).status,401);assert.equal((await call('login','POST',{identifier:stranger.email,password:'Mot de passe inconnu 2026',role:'teacher'})).status,401);
  });
  await t.test('Le seul professeur autorisé peut initialiser le suivi',async()=>{
   assert.equal((await call('login','POST',{identifier:teacher.email,password:'Mot de passe professeur 2026',role:'teacher'})).status,200);
   assert.equal((await api('setup','POST',{name:'TEST — élève isolé'})).status,200);
   assert.equal((await api('data')).status,200);
  });
  await t.test('Un seul parent, sans adresse à fournir, mot de passe généré et aucun e-mail envoyé',async()=>{
   const created=await call('parents','POST',{username:'parent'});assert.equal(created.status,200);credentials=(await created.json()).credentials;
   assert.equal(credentials.username,'parent');assert.ok(credentials.password.length>=24);assert.equal(sent.length,0);
   const slot=await db.prepare("SELECT * FROM account_slots WHERE role='parent'").first();parent=users.get(slot.email).user;
   assert.equal(slot.user_id,parent.id);assert.equal(slot.enabled,1);
   const listed=await(await call('parents','GET')).json();assert.equal(listed.parents[0].username,'parent');assert.equal(listed.parents[0].password,undefined);assert.equal(listed.parents[0].email,undefined);
   assert.equal((await call('parents','POST',{username:'parent2'})).status,409);
   assert.equal((await call('parents','POST',{username:'parent'})).status,409);
   assert.equal((await db.prepare('SELECT count(*) AS count FROM account_slots').first()).count,2);
  });
  await t.test('Le choix d’espace ne modifie pas le rôle et le parent reste en lecture seule',async()=>{
   assert.equal((await call('login','POST',{identifier:'parent',password:credentials.password,role:'teacher'})).status,401);
   assert.equal((await call('login','POST',{identifier:'parent',password:credentials.password,role:'parent'})).status,200);
   assert.equal((await api('data')).status,200);assert.equal((await api('prepare','POST',{date:'2026-11-07'})).status,403);
   assert.equal((await api('export')).status,403);assert.equal((await call('parents','POST',{username:'pirate'})).status,403);
   assert.equal((await call('parents','DELETE',{id:'parent'})).status,403);
  });
  await t.test('Le parent change son propre mot de passe, sans modifier le compte professeur',async()=>{
   assert.equal((await call('password','POST',{password:'court'})).status,400);
   assert.equal((await call('password','POST',{password:'Nouveau mot de passe parent 2026',role:'teacher',userId:teacher.id})).status,200);
   await call('logout');assert.equal((await call('login','POST',{identifier:'parent',password:credentials.password,role:'parent'})).status,401);
   assert.equal((await call('login','POST',{identifier:'parent',password:'Nouveau mot de passe parent 2026',role:'parent'})).status,200);
   assert.equal(users.get(teacher.email).password,'Mot de passe professeur 2026');
  });
  await t.test('Contrainte PostgreSQL : impossible d’ajouter un deuxième professeur',async()=>{
   await assert.rejects(db.prepare("INSERT INTO account_slots (role,user_id,email,login_name,enabled,created_at) VALUES ('teacher',?,?,?,1,?)").bind(stranger.id,stranger.email,stranger.email,'2026-11-07').run());
   state.user={...parent,email_confirmed_at:undefined};assert.equal((await api('data')).status,401);state.user=parent;
  });
  await t.test('Google réservé au professeur connu, comptes Google étrangers refusés',async()=>{
   assert.equal((await call('google?role=parent','GET')).status,403);await call('google?role=teacher','GET');assert.equal(state.oauth.provider,'google');
   assert.match((await call('callback?code=stranger','GET')).headers.get('location'),/error=forbidden/);
   await call('google?role=teacher','GET');assert.equal(new URL((await call('callback?code=teacher','GET')).headers.get('location')).pathname,'/');
  });
  await t.test('Révocation immédiate et anciens liens sans compte désactivés, y compris pour les PDF',async()=>{
   state.user=teacher;assert.equal((await call('parents','DELETE',{id:'parent'})).status,200);state.user=parent;
   assert.equal((await api('data','GET',undefined,{'cookie':'orbite_parent='+ 'a'.repeat(64),'oai-authenticated-user-id':teacher.id})).status,401);
   assert.equal((await api('reports/anything/pdf')).status,401);assert.equal((await api('documents/anything')).status,401);
   const old=await parentExchange(new Request('https://repere.test/p/'+ 'a'.repeat(64)),'a'.repeat(64));assert.equal(old.status,303);assert.equal(old.headers.get('location'),'/login');
  });
  await t.test('Le professeur réinitialise le parent existant sans créer de troisième compte',async()=>{
   state.user=teacher;const r=await call('parents','POST',{operation:'reset'});assert.equal(r.status,200);const reset=(await r.json()).credentials;
   assert.equal(reset.username,'parent');assert.notEqual(reset.password,credentials.password);
   assert.equal((await call('login','POST',{identifier:'parent',password:reset.password,role:'parent'})).status,200);
   assert.equal((await db.prepare('SELECT count(*) AS count FROM account_slots').first()).count,2);
  });
  await t.test('Origine externe refusée et tentatives répétées limitées',async()=>{
   state.user=teacher;assert.equal((await call('parents','DELETE',{id:'parent'},'https://evil.test')).status,403);
   let last;for(let i=0;i<16;i++)last=await call('login','POST',{identifier:'intrus',password:'invalid',role:'teacher'});assert.equal(last.status,429);
  });
 }finally{await fixture.dispose();await rm(file,{force:true});delete globalThis.__authFixture;}
});
