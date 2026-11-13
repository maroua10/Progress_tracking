import {consultationSessionProof,equalDigest} from './consultation-code.mjs';
import type {Account} from './policy';
type VerifiedUser={id:string;email?:string;email_confirmed_at?:string};
type Lookup={prepare:(sql:string)=>{bind:(...args:any[])=>{first:()=>Promise<any>}}};
export async function accountForUser(user:VerifiedUser|null,database:Lookup,proof?:{value?:string;secret?:string}):Promise<Account|null>{
 if(!user?.email_confirmed_at || !user.email)return null;
 const email=user.email.trim().toLowerCase();
 let slot=await database.prepare('SELECT role,user_id,student_id,consultation_code_hash FROM account_slots WHERE user_id=? AND email=? AND enabled=1 AND revoked_at IS NULL').bind(user.id,email).first();
 // A pre-authorized e-mail may bind once, after Supabase confirms its ownership.
 if(!slot)slot=await database.prepare('UPDATE account_slots SET user_id=? WHERE user_id IS NULL AND email=? AND enabled=1 AND revoked_at IS NULL RETURNING role,user_id,student_id,consultation_code_hash').bind(user.id,email).first();
 if(!slot)return null;
 if(slot.role==='parent'){if(!slot.consultation_code_hash||!proof?.secret||!proof.value)return null;const expected=await consultationSessionProof(slot.consultation_code_hash,user.id,proof.secret);if(!equalDigest(proof.value,expected))return null;}
 return {role:slot.role,studentId:slot.student_id,userId:user.id,viewerKey:slot.role+':'+user.id};
}
