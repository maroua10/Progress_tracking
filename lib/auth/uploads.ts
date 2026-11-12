import {NextResponse} from 'next/server';
import {adminClient} from './supabase';
import {env,resolveAccount} from '../runtime';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function uploadRoute(r:Request){
 try{
  if(r.method!=='POST')return json({error:'Méthode non autorisée.'},405);
  if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Requête non autorisée.'},403);
  const actor=await resolveAccount!();
  if(!actor)return json({error:'Connectez-vous.'},401);
  if(actor.role!=='teacher')return json({error:'L’espace de consultation est en lecture seule.'},403);
  const input:any=await r.json(),bucket=adminClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'repere-private');
  if(input.operation==='prepare'){
   const session=await env.DB.prepare('SELECT id FROM sessions WHERE id=? AND student_id=?').bind(input.sessionId,actor.studentId).first();
   if(!session)return json({error:'Séance introuvable.'},404);
   if(typeof input.name!=='string' || !Number.isInteger(input.size) || input.size<5 || input.size>10485760)return json({error:'Choisissez un PDF de moins de 10 Mo.'},400);
   const id=crypto.randomUUID(),key=actor.studentId+'/'+id+'.pdf',name=input.name.replace(/[\x00-\x1f<>"/\\]/g,'').slice(0,180)||'support.pdf';
   const {data,error}=await bucket.createSignedUploadUrl(key);
   if(error||!data)return json({error:'Le stockage est indisponible.'},503);
   await env.DB.prepare('INSERT INTO pending_uploads (id,student_id,session_id,storage_key,name,expires_at) VALUES (?,?,?,?,?,?)').bind(id,actor.studentId,input.sessionId,key,name,new Date(Date.now()+900000).toISOString()).run();
   return json({id,url:data.signedUrl});
  }
  if(input.operation==='complete'){
   const existing=await env.DB.prepare('SELECT id,name,size FROM documents WHERE id=? AND student_id=?').bind(input.id,actor.studentId).first();
   if(existing)return json(existing);
   const pending=await env.DB.prepare('SELECT * FROM pending_uploads WHERE id=? AND student_id=?').bind(input.id,actor.studentId).first<any>();
   if(!pending)return json({error:'Envoi introuvable. Recommencez l’ajout du support.'},404);
   if(pending.expires_at<new Date().toISOString()){await bucket.remove([pending.storage_key]);return json({error:'L’envoi a expiré. Recommencez.'},410);}
   const {data,error}=await bucket.download(pending.storage_key);
   if(error||!data)return json({error:'Le fichier n’est pas encore disponible. Réessayez.'},503);
   const bytes=await data.arrayBuffer();
   if(bytes.byteLength<5 || bytes.byteLength>10485760 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'){
    await bucket.remove([pending.storage_key]);return json({error:'Le fichier doit être un PDF valide de moins de 10 Mo.'},400);
   }
   const sha=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
   await env.DB.prepare('INSERT OR IGNORE INTO documents (id,student_id,session_id,storage_key,name,size,sha256,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(pending.id,actor.studentId,pending.session_id,pending.storage_key,pending.name,bytes.byteLength,sha,new Date().toISOString()).run();
   await env.DB.prepare('DELETE FROM pending_uploads WHERE id=?').bind(pending.id).run();
   return json({id:pending.id,name:pending.name,size:bytes.byteLength});
  }
  return json({error:'Opération invalide.'},400);
 }catch{return json({error:'Le support n’a pas pu être enregistré. Votre bilan est conservé ; réessayez.'},503);}
}
