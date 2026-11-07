import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {invitationFromCookie,claimInvitation} from './invitations';
import { authClient, adminClient, siteUrl } from './supabase';
import { env, resolveAccount } from '../runtime';
import { normalEmail, validEmail, strongPassword, permitsRole, safeNext } from './policy';
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
function redirect(path: string, request: Request) { return NextResponse.redirect(new URL(path, request.url), { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); }
async function rateLimit(request: Request, email: string, action: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + ':' + email + ':' + action))).toString('hex');
  const window = Math.floor(Date.now() / 900000).toString();
  const result = await env.DB.prepare('INSERT INTO auth_attempts (key,"window",count) VALUES (?,?,1) ON CONFLICT(key,"window") DO UPDATE SET count=auth_attempts.count+1 RETURNING count').bind(hash,window).first<any>();
  return result.count <= (action === 'login' ? 15 : 4);
}
export async function authRoute(request: Request, action: string) {
  try {
    const url = new URL(request.url);
    if (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== url.origin) return response({ error: 'Requête non autorisée.' },403);
    const client = await authClient();
    if (action === 'google' && request.method === 'GET') {
      const role = url.searchParams.get('role') === 'teacher' ? 'teacher' : 'parent';
      const jar = await cookies();
      jar.set('repere_login_role',role,{httpOnly:true,sameSite:'lax',secure:url.protocol==='https:',maxAge:600,path:'/'});
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl() + '/auth/callback', queryParams: { prompt: 'select_account' }, scopes: 'openid email profile' } });
      if (error || !data.url) return redirect('/login?error=google',request);
      return NextResponse.redirect(data.url,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    if ((action === 'callback' || action === 'confirm') && request.method === 'GET') {
      let next = safeNext(url.searchParams.get('next'));
      if (action === 'callback') {
        const code = url.searchParams.get('code');
        if (!code || (await client.auth.exchangeCodeForSession(code)).error) return redirect('/login?error=expired',request);
      } else {
        const token_hash = url.searchParams.get('token_hash'), type = url.searchParams.get('type');
        if (!token_hash || (type !== 'invite' && type !== 'recovery' && type !== 'signup') || (await client.auth.verifyOtp({ token_hash, type })).error) return redirect('/login?error=expired',request);
        next = type === 'signup' ? '/' : '/auth/password';
      }
      const verified = (await client.auth.getUser()).data.user;
      if(verified) await claimInvitation(verified,url.searchParams.get("claim"));
      const account = await resolveAccount!();
      const jar = await cookies(), role = jar.get('repere_login_role')?.value;
      jar.delete('repere_login_role');
      if (!account || (role && !permitsRole(account,role))) {
        await client.auth.signOut();
        return redirect('/login?error=forbidden',request);
      }
      return redirect(next,request);
    }
    if (action === 'invitations') {
      const actor = await resolveAccount!();
      if(!actor) return response({error:'Connectez-vous.'},401);
      if(actor.role !== 'teacher') return response({error:'Cet accès est réservé au professeur.'},403);
      if(request.method === 'GET') return response({invitations:(await env.DB.prepare('SELECT id,created_at,expires_at,revoked_at,used_at FROM parent_invitations WHERE student_id=? ORDER BY created_at DESC').bind(actor.studentId).all()).results});
      if(request.method === 'DELETE') {
        const input:any=await request.json();
        await env.DB.prepare('UPDATE parent_invitations SET revoked_at=? WHERE id=? AND student_id=? AND used_at IS NULL').bind(new Date().toISOString(),input.id,actor.studentId).run();
        return response({ok:true});
      }
      if(request.method !== 'POST') return response({error:'Méthode non autorisée.'},405);
      const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
      const {invitationHash}=await import('./invitations');
      const expiresAt=new Date(Date.now()+2592000000).toISOString();
      await env.DB.prepare('INSERT INTO parent_invitations (id,student_id,token_hash,created_at,expires_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.studentId,await invitationHash(token),new Date().toISOString(),expiresAt).run();
      return response({url:siteUrl()+'/invite/'+token,expiresAt});
    }
    if (action === 'parents') {
      const actor = await resolveAccount!();
      if (!actor) return response({error:'Connectez-vous.'},401);
      if (actor.role !== 'teacher') return response({error:'Cet accès est réservé au professeur.'},403);
      if (request.method === 'GET') {
        const result = await env.DB.prepare('SELECT id,email,label,delivery_status,created_at,revoked_at FROM parent_accounts WHERE student_id=? ORDER BY created_at DESC').bind(actor.studentId).all();
        return response({parents:result.results});
      }
      const input:any = await request.json();
      if (request.method === 'DELETE') {
        await env.DB.prepare('UPDATE parent_accounts SET revoked_at=? WHERE id=? AND student_id=?').bind(new Date().toISOString(),input.id,actor.studentId).run();
        return response({ok:true});
      }
      if (request.method !== 'POST') return response({error:'Méthode non autorisée.'},405);
      const email = normalEmail(input.email), label = typeof input.label === 'string' ? input.label.trim().slice(0,80) : 'Parent';
      if (!validEmail(email)) return response({error:'Renseignez une adresse e-mail valide.'},400);
      if (!await rateLimit(request,email,'invite')) return response({error:'Trop de demandes. Réessayez dans 15 minutes.'},429);
      const at = new Date().toISOString();
      await env.DB.prepare("INSERT INTO parent_accounts (id,student_id,email,label,delivery_status,created_at,revoked_at) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(email) DO UPDATE SET label=excluded.label").bind(crypto.randomUUID(),actor.studentId,email,label,at,at).run();
      const { error } = await adminClient().auth.admin.inviteUserByEmail(email,{ redirectTo: siteUrl() + '/auth/callback?next=/auth/password' });
      let deliveryError = error;
      if (error && ['email_exists','user_already_exists'].includes(error.code || '')) {
        deliveryError = (await client.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()+'/auth/callback?next=/auth/password'})).error;
      }
      if (deliveryError) {
        await env.DB.prepare("UPDATE parent_accounts SET delivery_status='failed' WHERE email=? AND student_id=? AND revoked_at IS NOT NULL").bind(email,actor.studentId).run();
        return response({error:'L’invitation n’a pas pu être envoyée. Vérifiez le service e-mail Supabase puis réessayez.'},503);
      }
      await env.DB.prepare("UPDATE parent_accounts SET delivery_status='sent',revoked_at=NULL WHERE email=? AND student_id=?").bind(email,actor.studentId).run();
      return response({ok:true,message:'Invitation envoyée par e-mail.'});
    }
    if (request.method !== 'POST') return response({error:'Cette action est introuvable.'},404);
    if (action === 'logout') {
      await client.auth.signOut();
      (await cookies()).delete('orbite_parent');
      return response({ok:true});
    }
    const input:any = await request.json();
    if (action === 'register') {
      const invitation=await invitationFromCookie();
      if(!invitation) return response({error:'L’invitation a expiré ou a déjà été utilisée.'},403);
      const email=normalEmail(input.email);
      if(!validEmail(email) || !strongPassword(input.password)) return response({error:'Renseignez une adresse valide et un mot de passe de 12 caractères minimum.'},400);
      if(!await rateLimit(request,email,'register')) return response({error:'Trop de demandes. Réessayez dans 15 minutes.'},429);
      const claim=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO invitation_claims (id,invitation_id,email,created_at) VALUES (?,?,?,?)').bind(claim,invitation.id,email,new Date().toISOString()).run();
      const {data,error}=await client.auth.signUp({email,password:input.password,options:{emailRedirectTo:siteUrl()+'/auth/confirm?claim='+claim}});
      if(error) return response({error:'Le compte n’a pas pu être créé. Utilisez un mot de passe différent ou la connexion si ce compte existe déjà.'},400);
      if(data.session && await claimInvitation(data.user,claim)) return response({ok:true,activated:true});
      return response({ok:true,message:'Consultez votre messagerie et confirmez votre adresse pour activer l’accès. Si vous avez déjà un compte, utilisez la connexion.'});
    }
    if (action === 'login') {
      const email = normalEmail(input.email);
      if (!validEmail(email) || typeof input.password !== 'string' || input.password.length > 128) return response({error:'Adresse e-mail ou mot de passe incorrect.'},400);
      if (!await rateLimit(request,email,'login')) return response({error:'Trop de tentatives. Réessayez dans 15 minutes.'},429);
      const { error } = await client.auth.signInWithPassword({email,password:input.password});
      if(!error && input.role === "parent") await claimInvitation((await client.auth.getUser()).data.user);
      const account = error ? null : await resolveAccount!();
      if (!permitsRole(account,input.role)) {
        await client.auth.signOut();
        return response({error:'Identifiants incorrects ou compte non autorisé dans cet espace.'},401);
      }
      return response({ok:true,role:account!.role});
    }
    if (action === 'reset') {
      const email = normalEmail(input.email);
      if (!validEmail(email)) return response({error:'Renseignez une adresse e-mail valide.'},400);
      if (!await rateLimit(request,email,'reset')) return response({error:'Trop de demandes. Réessayez dans 15 minutes.'},429);
      // Never disclose whether an e-mail belongs to a professor or invited parent.
      const allowed = await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND revoked_at IS NULL UNION SELECT email FROM app_teachers WHERE email=? AND revoked_at IS NULL").bind(email,email).first();
      if (allowed) {
        const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()+'/auth/callback?next=/auth/password'});
        if(error) return response({error:'Le service e-mail est indisponible. Réessayez plus tard.'},503);
      }
      return response({ok:true,message:'Si cette adresse est autorisée, un e-mail de connexion vous sera envoyé.'});
    }
    if (action === 'password') {
      if (!await resolveAccount!()) return response({error:'Le lien a expiré. Demandez un nouvel e-mail.'},401);
      if (!strongPassword(input.password)) return response({error:'Choisissez un mot de passe entre 12 et 128 caractères.'},400);
      const {error} = await client.auth.updateUser({password:input.password});
      if(error) return response({error:'Le mot de passe n’a pas pu être enregistré. Réessayez avec un nouveau lien.'},400);
      return response({ok:true});
    }
    return response({error:'Cette action est introuvable.'},404);
  } catch {
    return response({error:'Le service de connexion est indisponible. Vérifiez la configuration ou réessayez plus tard.'},503);
  }
}
