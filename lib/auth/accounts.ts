import type {Account} from './policy';
type VerifiedUser={id:string;email?:string;email_confirmed_at?:string};
type Lookup={prepare:(sql:string)=>{bind:(...args:any[])=>{first:()=>Promise<any>}}};
export async function accountForUser(user:VerifiedUser|null,database:Lookup):Promise<Account|null>{
 if(!user?.email_confirmed_at || !user.email)return null;
 const email=user.email.trim().toLowerCase();
 let slot=await database.prepare('SELECT role,user_id,student_id FROM account_slots WHERE user_id=? AND email=? AND enabled=1 AND revoked_at IS NULL').bind(user.id,email).first();
 // A pre-authorized e-mail may bind once, after Supabase confirms its ownership.
 if(!slot)slot=await database.prepare('UPDATE account_slots SET user_id=? WHERE user_id IS NULL AND email=? AND enabled=1 AND revoked_at IS NULL RETURNING role,user_id,student_id').bind(user.id,email).first();
 if(!slot)return null;
 return {role:slot.role,studentId:slot.student_id,userId:user.id,viewerKey:slot.role+':'+user.id};
}
