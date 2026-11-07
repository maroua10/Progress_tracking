import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {postgresFixture} from './postgres-fixture.mjs';
test('Connexion et invitations — PostgreSQL et fournisseur e-mail isolés, aucun envoi réel',async t=>{
 const fixture=await postgresFixture('export default {};'),db=globalThis.__reperePostgresTest.DB;
 const teacher={id:'11111111-1111-4111-8111-111111111111',email:'prof@exemple.fr',email_confirmed_at:'2026-11-07'};
 const parent={id:'22222222-2222-4222-8222-222222222222',email:'parent@exemple.fr',email_confirmed_at:'2026-11-07'};
 const stranger={id:'33333333-3333-4333-8333-333333333333',email:'externe@exemple.fr',email_confirmed_at:'2026-11-07'};
 await db.prepare('INSERT INTO auth.users (id) VALUES (?)').bind(teacher.id).run();
 await db.prepare('INSERT INTO app_teachers (user_id,email,created_at) VALUES (?,?,?)').bind(teacher.id,teacher.email,'2026-11-07').run();
 await db.prepare('INSERT INTO students (id,name,level) VALUES (?,?,?)').bind('eleve','TEST ISOLÉ','mathématiques').run();
 const selfParent={id:'44444444-4444-4444-8444-444444444444',email:'choisi@exemple.fr',email_confirmed_at:'2026-11-07'};
 await db.prepare('INSERT INTO auth.users (id) VALUES (?)').bind(parent.id).run();
 await db.prepare('INSERT INTO auth.users (id) VALUES (?)').bind(selfParent.id).run();
 const cookieMap=new Map(),sent=[],usedTokens=new Set();
 const state={user:null,failMail:false,client:{auth:{
  async signInWithPassword({email,password}){state.user=password==='Mot de passe isolé 2026'?[teacher,parent,stranger].find(u=>u.email===email):null;return {error:state.user?null:{message:'invalid'}};},
  async signUp(input){state.signup=input;return {data:{user:{...selfParent,email_confirmed_at:undefined},session:null},error:null};},
  async getUser(){return {data:{user:state.user},error:null};},
  async signOut(){state.user=null;return {error:null};},
  async resetPasswordForEmail(email,options){sent.push({email,options});return {error:state.failMail?{message:'SMTP unavailable'}:null};},
  async updateUser({password}){state.savedPassword=password;return {error:null};},
  async signInWithOAuth(options){state.oauth=options;return {data:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=isolated'},error:null};},
  async exchangeCodeForSession(code){state.user=code==='teacher'?teacher:code==='parent'?parent:stranger;return {error:null};},
  async verifyOtp({token_hash,type}){if(usedTokens.has(token_hash)||token_hash==='expired')return {error:{message:'expired'}};usedTokens.add(token_hash);state.user=token_hash==='signup-self'?selfParent:parent;return {error:null};},
 }},admin:{auth:{admin:{async inviteUserByEmail(email,options){sent.push({email,options});return {error:state.failMail?{code:'smtp_failed'}:null};}}}},cookies:{get:name=>cookieMap.has(name)?{value:cookieMap.get(name)}:undefined,set:(name,value)=>cookieMap.set(name,value),delete:name=>cookieMap.delete(name)}};
 globalThis.__authFixture=state;
 const built=await build({entryPoints:['lib/auth/routes.ts'],bundle:true,format:'esm',platform:'node',packages:'external',write:false,plugins:[{name:'auth-isolated-dependencies',setup(b){
  b.onResolve({filter:/^\.\.\/runtime$/},()=>({path:new URL('./auth-runtime.ts',import.meta.url).pathname}));
  b.onResolve({filter:/^\.\/supabase$/},()=>({path:new URL('./auth-supabase.ts',import.meta.url).pathname}));
  b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
  b.onResolve({filter:/^next\/headers$/},()=>({path:new URL('./auth-cookies.ts',import.meta.url).pathname}));
 }}]});
 await mkdir('work',{recursive:true});const file='work/auth-test-'+crypto.randomUUID()+'.mjs';await writeFile(file,built.outputFiles[0].text);
 const {authRoute}=await import(pathToFileURL(process.cwd()+'/'+file));
 const call=(action,method='POST',data={},origin='https://repere.test')=>authRoute(new Request('https://repere.test/auth/'+action,{method,headers:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(data)})}),action.split('?')[0]);
 try{
  await t.test('Anonyme et parent ne peuvent inviter ni révoquer',async()=>{
   assert.equal((await call('parents')).status,401);state.user=parent;assert.equal((await call('parents')).status,401);assert.equal(sent.length,0);
  });
  await t.test('Le professeur invite un parent et le serveur enregistre cet élève',async()=>{
   state.user=teacher;const r=await call('parents','POST',{email:' Parent@exemple.fr '});assert.equal(r.status,200);assert.equal(sent[0].email,parent.email);
   const row=await db.prepare('SELECT * FROM parent_accounts WHERE email=?').bind(parent.email).first();assert.equal(row.student_id,'eleve');assert.equal(row.delivery_status,'sent');assert.equal(row.revoked_at,null);
  });
  await t.test('Connexion professeur et parent, mauvais rôle et utilisateur extérieur refusés',async()=>{
   assert.equal((await call('login','POST',{email:parent.email,password:'Mot de passe isolé 2026',role:'parent'})).status,200);
   assert.equal((await call('parents','GET')).status,403);
   assert.equal((await call('login','POST',{email:parent.email,password:'Mot de passe isolé 2026',role:'teacher'})).status,401);
   assert.equal((await call('login','POST',{email:stranger.email,password:'Mot de passe isolé 2026',role:'teacher'})).status,401);
   assert.equal((await call('login','POST',{email:teacher.email,password:'Mot de passe isolé 2026',role:'teacher'})).status,200);
  });
  await t.test('Jeton d’invitation à usage unique et choix du mot de passe',async()=>{
   const r=await call('confirm?token_hash=isolated-token&type=invite','GET');assert.equal(r.status,303);assert.equal(new URL(r.headers.get('location')).pathname,'/auth/password');
   assert.equal((await call('password','POST',{password:'court'})).status,400);
   assert.equal((await call('password','POST',{password:'Mot de passe privé 2026'})).status,200);
   const second=await call('confirm?token_hash=isolated-token&type=invite','GET');assert.match(second.headers.get('location'),/error=expired/);
  });
  await t.test('Google utilise le callback et vérifie aussi le rôle et l’invitation',async()=>{
   await call('google?role=parent','GET');assert.equal(state.oauth.provider,'google');assert.equal(state.oauth.options.redirectTo,'https://repere.test/auth/callback');
   const parentResult=await call('callback?code=parent','GET');assert.equal(new URL(parentResult.headers.get('location')).pathname,'/');
   const outsider=await call('callback?code=other','GET');assert.match(outsider.headers.get('location'),/error=forbidden/);
  });
  await t.test('Révocation effective sur une session parent déjà ouverte',async()=>{
   state.user=teacher;const row=await db.prepare('SELECT id FROM parent_accounts WHERE email=?').bind(parent.email).first();
   assert.equal((await call('parents','DELETE',{id:row.id})).status,200);state.user=parent;
   assert.equal((await call('password','POST',{password:'Mot de passe privé 2026'})).status,401);
   assert.equal((await call('login','POST',{email:parent.email,password:'Mot de passe isolé 2026',role:'parent'})).status,401);
  });
  await t.test('Un échec SMTP n’ouvre pas d’accès et reste visible',async()=>{
   state.user=teacher;state.failMail=true;assert.equal((await call('parents','POST',{email:'echec@exemple.fr'})).status,503);
   const row=await db.prepare('SELECT * FROM parent_accounts WHERE email=?').bind('echec@exemple.fr').first();assert.equal(row.delivery_status,'failed');assert.ok(row.revoked_at);state.failMail=false;
  });
  await t.test('Origine externe refusée, déconnexion et réinitialisation sans fuite d’adresse',async()=>{
   assert.equal((await call('parents','POST',{email:'bad@exemple.fr'},'https://evil.test')).status,403);
   const unknown=await call('reset','POST',{email:stranger.email}),known=await call('reset','POST',{email:teacher.email});assert.equal(unknown.status,200);assert.deepEqual(await unknown.json(),await known.json());
   assert.equal((await call('logout')).status,200);assert.equal(state.user,null);
  });
  await t.test('Un seul lien transmis : adresse choisie par le parent, confirmation sur un autre appareil, consommation unique',async()=>{
   state.user=teacher;const created=await call('invitations');assert.equal(created.status,200);const invite=await created.json();
   const token=invite.url.split('/').at(-1);assert.match(token,/^[a-f0-9]{64}$/);
   const stored=await db.prepare('SELECT * FROM parent_invitations ORDER BY created_at DESC LIMIT 1').first();assert.notEqual(stored.token_hash,token);assert.equal(stored.used_at,null);
   cookieMap.set('repere_invitation',token);state.user=null;
   const registered=await call('register','POST',{email:selfParent.email,password:'Mot de passe choisi 2026'});assert.equal(registered.status,200);assert.equal((await registered.json()).activated,undefined);
   assert.equal(await db.prepare('SELECT id FROM parent_accounts WHERE email=?').bind(selfParent.email).first(),null);
   const claim=await db.prepare('SELECT id FROM invitation_claims WHERE invitation_id=?').bind(stored.id).first();
   cookieMap.delete('repere_invitation');
   const confirmed=await call('confirm?token_hash=signup-self&type=signup&claim='+claim.id,'GET');assert.equal(new URL(confirmed.headers.get('location')).pathname,'/');
   const account=await db.prepare('SELECT * FROM parent_accounts WHERE email=?').bind(selfParent.email).first();assert.equal(account.student_id,'eleve');assert.equal(account.revoked_at,null);
   const used=await db.prepare('SELECT * FROM parent_invitations WHERE id=?').bind(stored.id).first();assert.equal(used.claimed_user_id,selfParent.id);assert.ok(used.used_at);
   state.user=null;cookieMap.set('repere_invitation',token);
   assert.equal((await call('register','POST',{email:'autre@exemple.fr',password:'Mot de passe choisi 2026'})).status,403);
  });
  await t.test('Invitation révoquée : inscription bloquée, aucun accès ouvert',async()=>{
   state.user=teacher;const created=await(await call('invitations')).json();const token=created.url.split('/').at(-1);
   const invitation=await db.prepare('SELECT id FROM parent_invitations WHERE used_at IS NULL ORDER BY created_at DESC LIMIT 1').first();
   assert.equal((await call('invitations','DELETE',{id:invitation.id})).status,200);state.user=null;cookieMap.set('repere_invitation',token);
   assert.equal((await call('register','POST',{email:'autre@exemple.fr',password:'Mot de passe choisi 2026'})).status,403);
  });
  await t.test('Protection contre les tentatives répétées',async()=>{
   let last;for(let i=0;i<16;i++)last=await call('login','POST',{email:'attempt@exemple.fr',password:'invalid',role:'parent'});assert.equal(last.status,429);
  });
 }finally{await fixture.dispose();await rm(file,{force:true});delete globalThis.__authFixture;}
});
