import {normalizeAccessCode} from './access-code.mjs';
// Administrative provisioning only. Never called from public signup routes.
const problem=(status,message)=>Object.assign(new Error(message),{status});
const newPassword=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
/** @param {any} database @param {any} admin @param {{role:string,login:string,email?:string,reset?:boolean,codeHash?:string}} options */
export async function provisionFixedAccount(database,admin,options){
 const {role,reset=false}=options,login=role==='parent'?normalizeAccessCode(options.login):options.login.trim().toLowerCase();
 if(!['teacher','parent'].includes(role))throw problem(400,'Rôle invalide.');
 if(role==='parent'&&!login)throw problem(400,'Le code d’accès doit contenir six lettres ou chiffres, avec un tiret au milieu.');
 if(role==='parent'&&!/^[0-9a-f]{64}$/.test(options.codeHash||''))throw problem(400,'Empreinte du code invalide.');
 const storedLogin=role==='parent'?'consultation':login;
 const at=new Date().toISOString(),email=role==='teacher'?options.email?.trim().toLowerCase():'parent-'+crypto.randomUUID()+'@accounts.repere.invalid';
 if(!email)throw problem(400,'Adresse du professeur manquante.');
 await database.prepare('INSERT OR IGNORE INTO account_slots (role,email,login_name,student_id,enabled,created_at) VALUES (?,?,?,\'eleve\',0,?)').bind(role,email,storedLogin,at).run();
 const slot=await database.prepare('SELECT * FROM account_slots WHERE role=?').bind(role).first();
 if(role==='teacher'&&(slot.login_name!==login||slot.email!==email))throw problem(409,'Ce rôle est déjà réservé à un autre compte.');
 if(slot.enabled&&!reset)throw problem(409,role==='parent'?'Ce compte existe déjà. Remplacez son code d’accès.':'Ce compte existe déjà. Utilisez la réinitialisation du mot de passe.');
 const lock=crypto.randomUUID();
 const acquired=await database.prepare('UPDATE account_slots SET provisioning_key=?,provisioning_at=? WHERE role=? AND (provisioning_key IS NULL OR provisioning_at<?) RETURNING role').bind(lock,at,role,new Date(Date.now()-300000).toISOString()).first();
 if(!acquired)throw problem(409,'Une création ou une réinitialisation est déjà en cours.');
 try{
  const password=role==='teacher'?newPassword():undefined;let userId=slot.user_id;
  if(!userId){
   const result=await admin.auth.admin.createUser({email:slot.email,password,email_confirm:true});
   if(result.error){
    // Recover only an account left by a previous interrupted provisioning.
    const existing=await database.prepare('SELECT id FROM auth.users WHERE email=?').bind(slot.email).first();
    if(!existing)throw problem(503,'La création du compte a échoué. Réessayez.');
    userId=existing.id;
    const updated=role==='teacher'?await admin.auth.admin.updateUserById(userId,{password}):{error:null};if(updated.error)throw problem(503,'Le mot de passe n’a pas pu être défini.');
   }else userId=result.data.user.id;
  }else if(role==='teacher'){
   const result=await admin.auth.admin.updateUserById(userId,{password});if(result.error)throw problem(503,'Le mot de passe n’a pas pu être réinitialisé.');
  }
  await database.prepare('UPDATE account_slots SET user_id=?,enabled=1,revoked_at=NULL,login_name=?,consultation_code_hash=? WHERE role=? AND provisioning_key=?').bind(userId,storedLogin,role==='parent'?options.codeHash:null,role,lock).run();
  return role==='parent'?{username:login}:{username:login,password};
 }finally{await database.prepare('UPDATE account_slots SET provisioning_key=NULL,provisioning_at=NULL WHERE role=? AND provisioning_key=?').bind(role,lock).run();}
}
