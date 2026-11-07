// Administrative provisioning only. Never called from public signup routes.
const problem=(status,message)=>Object.assign(new Error(message),{status});
const newPassword=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
/** @param {any} database @param {any} admin @param {{role:string,login:string,email?:string,reset?:boolean}} options */
export async function provisionFixedAccount(database,admin,options){
 const {role,reset=false}=options,login=options.login.trim().toLowerCase();
 if(!['teacher','parent'].includes(role))throw problem(400,'Rôle invalide.');
 if(role==='parent'&&!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(login))throw problem(400,'L’identifiant doit contenir 3 à 40 lettres, chiffres, points ou tirets.');
 const at=new Date().toISOString(),email=role==='teacher'?options.email?.trim().toLowerCase():'parent-'+crypto.randomUUID()+'@accounts.repere.invalid';
 if(!email)throw problem(400,'Adresse du professeur manquante.');
 await database.prepare('INSERT OR IGNORE INTO account_slots (role,email,login_name,student_id,enabled,created_at) VALUES (?,?,?,\'eleve\',0,?)').bind(role,email,login,at).run();
 const slot=await database.prepare('SELECT * FROM account_slots WHERE role=?').bind(role).first();
 if(slot.login_name!==login || (role==='teacher'&&slot.email!==email))throw problem(409,'Ce rôle est déjà réservé à un autre compte.');
 if(slot.enabled&&!reset)throw problem(409,'Ce compte existe déjà. Utilisez la réinitialisation du mot de passe.');
 const lock=crypto.randomUUID();
 const acquired=await database.prepare('UPDATE account_slots SET provisioning_key=?,provisioning_at=? WHERE role=? AND (provisioning_key IS NULL OR provisioning_at<?) RETURNING role').bind(lock,at,role,new Date(Date.now()-300000).toISOString()).first();
 if(!acquired)throw problem(409,'Une création ou une réinitialisation est déjà en cours.');
 try{
  const password=newPassword();let userId=slot.user_id;
  if(!userId){
   const result=await admin.auth.admin.createUser({email:slot.email,password,email_confirm:true});
   if(result.error){
    // Recover only an account left by a previous interrupted provisioning.
    const existing=await database.prepare('SELECT id FROM auth.users WHERE email=?').bind(slot.email).first();
    if(!existing)throw problem(503,'La création du compte a échoué. Réessayez.');
    userId=existing.id;
    const updated=await admin.auth.admin.updateUserById(userId,{password});if(updated.error)throw problem(503,'Le mot de passe n’a pas pu être défini.');
   }else userId=result.data.user.id;
  }else{
   const result=await admin.auth.admin.updateUserById(userId,{password});if(result.error)throw problem(503,'Le mot de passe n’a pas pu être réinitialisé.');
  }
  await database.prepare('UPDATE account_slots SET user_id=?,enabled=1,revoked_at=NULL WHERE role=? AND provisioning_key=?').bind(userId,role,lock).run();
  return {username:login,password};
 }finally{await database.prepare('UPDATE account_slots SET provisioning_key=NULL,provisioning_at=NULL WHERE role=? AND provisioning_key=?').bind(role,lock).run();}
}
