import {cookies} from 'next/headers';
import {env} from '../runtime';
export const INVITE_COOKIE='repere_invitation';
export async function invitationHash(value:string){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');}
export async function invitationFromCookie(){
 const token=(await cookies()).get(INVITE_COOKIE)?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
 return env.DB.prepare('SELECT * FROM parent_invitations WHERE token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(await invitationHash(token),new Date().toISOString()).first<any>();
}
export async function claimInvitation(user:{id:string;email?:string;email_confirmed_at?:string}|null,claimId?:string|null){
 if(!user?.email || !user.email_confirmed_at)return false;
 if(await env.DB.prepare('SELECT user_id FROM app_teachers WHERE user_id=? AND revoked_at IS NULL').bind(user.id).first())return false;
 let invitation=await invitationFromCookie();
 if(!invitation && claimId && /^[a-f0-9-]{36}$/.test(claimId)){
  invitation=await env.DB.prepare('SELECT i.* FROM parent_invitations i JOIN invitation_claims c ON c.invitation_id=i.id WHERE c.id=? AND c.email=? AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>?').bind(claimId,user.email.toLowerCase(),new Date().toISOString()).first<any>();
 }
 if(!invitation)return false;
 const at=new Date().toISOString();
 const result=await env.DB.batch([
  env.DB.prepare('UPDATE parent_invitations SET used_at=?,claimed_user_id=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(at,user.id,invitation.id,at),
  env.DB.prepare("INSERT INTO parent_accounts (id,student_id,email,label,delivery_status,created_at,revoked_at) SELECT ?,student_id,?,?,'sent',?,NULL FROM parent_invitations WHERE id=? AND claimed_user_id=? AND used_at=? ON CONFLICT(email) DO UPDATE SET revoked_at=NULL,delivery_status='sent'").bind(crypto.randomUUID(),user.email.toLowerCase(),'Parent',at,invitation.id,user.id,at),
 ]);
 if(!result[0].meta.changes)return false;
 (await cookies()).delete(INVITE_COOKIE);
 return true;
}
