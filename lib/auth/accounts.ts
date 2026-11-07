import type {Account} from './policy';
type VerifiedUser={id:string;email?:string;email_confirmed_at?:string};
type Lookup={prepare:(sql:string)=>{bind:(...args:unknown[])=>{first:()=>Promise<any>}}};
export async function accountForUser(user:VerifiedUser|null,database:Lookup):Promise<Account|null>{
 if(!user?.email_confirmed_at || !user.email)return null;
 const teacher=await database.prepare('SELECT user_id FROM app_teachers WHERE user_id=? AND revoked_at IS NULL').bind(user.id).first();
 if(teacher)return {role:'teacher',studentId:'eleve',userId:user.id,viewerKey:'teacher:'+user.id};
 const parent=await database.prepare('SELECT id,student_id FROM parent_accounts WHERE email=? AND revoked_at IS NULL AND delivery_status=?').bind(user.email.toLowerCase(),'sent').first();
 return parent?{role:'parent',studentId:parent.student_id,userId:user.id,viewerKey:'account:'+parent.id}:null;
}
