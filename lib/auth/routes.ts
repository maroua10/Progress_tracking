import {consultationCodeHash,consultationSessionProof,equalDigest,CONSULTATION_COOKIE,CONSULTATION_MAX_AGE} from './consultation-code.mjs';
import {normalizeAccessCode} from './access-code.mjs';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {authClient,adminClient,siteUrl,accessCodeSecret} from './supabase';
import {env,resolveAccount} from '../runtime';
import {normalEmail,validEmail,strongPassword,permitsRole,safeNext} from './policy';
import {provisionFixedAccount} from './provision.mjs';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const redirect=(path:string,r:Request)=>NextResponse.redirect(new URL(path,r.url),{status:303,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function rateLimit(r:Request,login:string,action:string){
 const ip=r.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
 const key=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+login+':'+action))).toString('hex');
 const window=Math.floor(Date.now()/900000).toString();
 const row=await env.DB.prepare('INSERT INTO auth_attempts (key,"window",count) VALUES (?,?,1) ON CONFLICT(key,"window") DO UPDATE SET count=auth_attempts.count+1 RETURNING count').bind(key,window).first<any>();
 return row.count<=(['login','consultation-login'].includes(action)?15:4);
}
export async function authRoute(r:Request,action:string){
 try{
  const url=new URL(r.url);
  if(!['GET','HEAD'].includes(r.method)&&r.headers.get('origin')!==url.origin)return response({error:'Requête non autorisée.'},403);
  if(['register','invitations','signup'].includes(action))return response({error:'L’inscription publique est désactivée. Seuls les deux comptes autorisés peuvent se connecter.'},403);
  const client=await authClient();
  if(action==='google'&&r.method==='GET'){
   if(url.searchParams.get('role')!=='teacher')return response({error:'Le compte de consultation utilise son code d’accès.'},403);
   (await cookies()).set('repere_login_role','teacher',{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',maxAge:600,path:'/'});
   const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:siteUrl()+'/auth/callback',queryParams:{prompt:'select_account'},scopes:'openid email profile'}});
   return error||!data.url?redirect('/login?error=google',r):NextResponse.redirect(data.url,{headers:{'Cache-Control':'no-store'}});
  }
  if(['callback','confirm'].includes(action)&&r.method==='GET'){
   let next=safeNext(url.searchParams.get('next'));
   if(action==='callback'){
    const code=url.searchParams.get('code');if(!code||(await client.auth.exchangeCodeForSession(code)).error)return redirect('/login?error=expired',r);
   }else{
    const token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
    if(!token_hash||(type!=='invite'&&type!=='recovery')||(await client.auth.verifyOtp({token_hash,type})).error)return redirect('/login?error=expired',r);
    next='/auth/password';
   }
   const account=await resolveAccount!(),jar=await cookies(),requested=jar.get('repere_login_role')?.value;jar.delete('repere_login_role');
   if(!account||(requested&&!permitsRole(account,requested))){await client.auth.signOut();return redirect('/login?error=forbidden',r);}
   return redirect(next,r);
  }
  if(action==='parents'){
   const actor=await resolveAccount!();if(!actor)return response({error:'Connectez-vous.'},401);
   if(actor.role!=='teacher')return response({error:'Cet accès est réservé au professeur.'},403);
   if(r.method==='GET'){
    const parent=await env.DB.prepare("SELECT role AS id,consultation_code_hash IS NOT NULL AS code_configured,enabled,created_at,revoked_at FROM account_slots WHERE role='parent'").first();
    return response({parents:parent?[parent]:[]});
   }
   const input:any=await r.json();
   if(r.method==='DELETE'){
    if(input.id!=='parent')return response({error:'Compte invalide.'},400);
    await env.DB.prepare("UPDATE account_slots SET revoked_at=? WHERE role='parent'").bind(new Date().toISOString()).run();return response({ok:true});
   }
   if(r.method!=='POST')return response({error:'Méthode non autorisée.'},405);
   if(!await rateLimit(r,'parent','provision'))return response({error:'Trop de demandes. Réessayez dans 15 minutes.'},429);
   if(input.operation&&input.operation!=='set-code')return response({error:'Choisissez un nouveau code d’accès.'},400);
   const code=normalizeAccessCode(input.accessCode);
   if(!code||!/[a-z]/.test(code)||!/[0-9]/.test(code))return response({error:'Choisissez six lettres et chiffres, sous la forme ABC-123.'},400);
   const existing=await env.DB.prepare("SELECT role FROM account_slots WHERE role='parent'").first();
   const codeHash=await consultationCodeHash(code,accessCodeSecret());
   if(!codeHash)return response({error:'Code d’accès invalide.'},400);
   await provisionFixedAccount(env.DB,adminClient(),{role:'parent',login:code,codeHash,reset:!!existing});
   return response({ok:true,code,message:'Code d’accès enregistré.'});
  }
  if(r.method!=='POST')return response({error:'Cette action est introuvable.'},404);
  if(action==='logout'){await client.auth.signOut();(await cookies()).delete('orbite_parent');(await cookies()).delete(CONSULTATION_COOKIE);return response({ok:true});}
  const input:any=await r.json();
  if(action==='login'){
   if(input.role==='parent'){
    if(!await rateLimit(r,'consultation','consultation-login'))return response({error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
    const hash=await consultationCodeHash(input.accessCode,accessCodeSecret());
    const slot=await env.DB.prepare("SELECT role,email,user_id,consultation_code_hash FROM account_slots WHERE role='parent' AND enabled=1 AND revoked_at IS NULL").first<any>();
    if(!slot?.user_id||!equalDigest(slot.consultation_code_hash,hash))return response({error:'Code d’accès incorrect.'},401);
    const generated=await adminClient().auth.admin.generateLink({type:'magiclink',email:slot.email});
    if(generated.error||generated.data.user?.id!==slot.user_id||!generated.data.properties?.hashed_token)return response({error:'La connexion est temporairement indisponible.'},503);
    const verified=await client.auth.verifyOtp({token_hash:generated.data.properties.hashed_token,type:'magiclink'});
    if(verified.error||verified.data.user?.id!==slot.user_id){await client.auth.signOut();return response({error:'La connexion est temporairement indisponible.'},503);}
    (await cookies()).set(CONSULTATION_COOKIE,await consultationSessionProof(hash,slot.user_id,accessCodeSecret()),{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',path:'/',maxAge:CONSULTATION_MAX_AGE});
    const account=await resolveAccount!();if(!permitsRole(account,'parent')){await client.auth.signOut();(await cookies()).delete(CONSULTATION_COOKIE);return response({error:'Cet accès n’est plus disponible.'},401);}
    return response({ok:true,role:'parent'});
   }
   const login=normalEmail(input.identifier ?? input.email);
   if(!login||login.length>254||typeof input.password!=='string'||input.password.length>128)return response({error:'Accès ou mot de passe incorrect.'},400);
   if(!await rateLimit(r,login,'login'))return response({error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
   const slot=await env.DB.prepare('SELECT email,role FROM account_slots WHERE login_name=? AND enabled=1 AND revoked_at IS NULL').bind(login).first<any>();
   if(!slot||slot.role!==input.role)return response({error:'Accès ou mot de passe incorrect.'},401);
   const {error}=await client.auth.signInWithPassword({email:slot.email,password:input.password});
   const account=error?null:await resolveAccount!();
   if(!permitsRole(account,input.role)){await client.auth.signOut();return response({error:'Accès ou mot de passe incorrect.'},401);}
   return response({ok:true,role:account!.role});
  }
  if(action==='password'){
   const actor=await resolveAccount!();if(!actor)return response({error:'Connectez-vous avec votre compte autorisé.'},401);
   if(actor.role!=='teacher')return response({error:'La consultation utilise uniquement le code fourni par le professeur.'},403);
   if(!strongPassword(input.password))return response({error:'Choisissez un mot de passe entre 12 et 128 caractères.'},400);
   const {error}=await client.auth.updateUser({password:input.password});
   return error?response({error:'Le mot de passe n’a pas pu être enregistré. Réessayez.'},400):response({ok:true});
  }
  if(action==='reset'){
   const email=normalEmail(input.email);if(!validEmail(email))return response({error:'Renseignez une adresse e-mail valide.'},400);
   if(!await rateLimit(r,email,'reset'))return response({error:'Trop de demandes. Réessayez dans 15 minutes.'},429);
   const allowed=await env.DB.prepare("SELECT email FROM account_slots WHERE role='teacher' AND login_name=? AND enabled=1 AND revoked_at IS NULL").bind(email).first();
   if(allowed){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()+'/auth/callback?next=/auth/password'});if(error)return response({error:'Le service e-mail est indisponible. Réessayez plus tard.'},503);}
   return response({ok:true,message:'Si cette adresse est autorisée, un e-mail vous sera envoyé.'});
  }
  return response({error:'Cette action est introuvable.'},404);
 }catch(e){const error=e as Error&{status?:number};return response({error:error.status?error.message:'Le service de connexion est indisponible. Vérifiez la configuration ou réessayez plus tard.'},error.status||503);}
}
