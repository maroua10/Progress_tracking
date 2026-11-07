import {NextResponse} from 'next/server';
import {env} from '../../../lib/runtime';
import {INVITE_COOKIE,invitationHash} from '../../../lib/auth/invitations';
export const dynamic='force-dynamic';
export async function GET(r:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 try{
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('invalid');
  const invite=await env.DB.prepare('SELECT id FROM parent_invitations WHERE token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(await invitationHash(token),new Date().toISOString()).first();
  if(!invite)throw new Error('expired');
  const response=NextResponse.redirect(new URL('/parent/activate',r.url),303);
  response.cookies.set(INVITE_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:new URL(r.url).protocol==='https:',maxAge:2592000,path:'/'});
  response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');
  return response;
 }catch{return NextResponse.redirect(new URL('/login?error=invitation',r.url),303);}
}
