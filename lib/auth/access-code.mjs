/** Canonical database value; the hyphen is optional when entering a code. */
export function normalizeAccessCode(value){
 if(typeof value!=='string')return '';
 const compact=value.trim().replace(/\s/g,'').toUpperCase();
 if(!/^(?:[A-Z0-9]{6}|[A-Z0-9]{3}-[A-Z0-9]{3})$/.test(compact))return '';
 const raw=compact.replace('-','');return (raw.slice(0,3)+'-'+raw.slice(3)).toLowerCase();
}
export const displayAccessCode=value=>normalizeAccessCode(value).toUpperCase();
export const isStoredAccessCode=value=>typeof value==='string'&&/^[a-z0-9]{3}-[a-z0-9]{3}$/.test(value);
export function generateAccessCode(){
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 for(;;){const raw=[...crypto.getRandomValues(new Uint8Array(6))].map(n=>alphabet[n%alphabet.length]).join('');if(/[A-Z]/.test(raw)&&/[0-9]/.test(raw))return normalizeAccessCode(raw);}
}
// Changes only the login code. The Supabase user, password and grants remain intact.
export async function migrateParentAccessCode(database){
 const slot=await database.prepare("SELECT login_name FROM account_slots WHERE role='parent'").first();
 if(!slot)throw Object.assign(new Error('Le compte de consultation doit d’abord être créé.'),{status:400});
 if(isStoredAccessCode(slot.login_name))return slot.login_name;
 const code=generateAccessCode();
 const changed=await database.prepare("UPDATE account_slots SET login_name=? WHERE role='parent' AND login_name=? RETURNING login_name").bind(code,slot.login_name).first();
 if(!changed)throw Object.assign(new Error('Le compte a changé. Rechargez la page.'),{status:409});
 return changed.login_name;
}
