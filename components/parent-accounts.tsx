'use client';
import {useEffect,useState} from 'react';
import {displayAccessCode} from '../lib/auth/access-code.mjs';
import {readJsonResponse} from '../lib/client-response';
export default function ParentAccounts(){
 const [parent,setParent]=useState<any>(null),[code,setCode]=useState(''),[sharedCode,setSharedCode]=useState(''),[pending,setPending]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){setLoading(true);try{const r=await fetch('/api/auth/parents');const d=await readJsonResponse(r);setParent(d.parents[0]||null);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function action(method:string,body:any){setPending(true);setError('');setMessage('');setSharedCode('');try{const r=await fetch('/api/auth/parents',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await readJsonResponse(r);setSharedCode(d.code?displayAccessCode(d.code):'');setCode('');setMessage(method==='DELETE'?'Accès révoqué.':d.message);await load();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 return <section className="panel parent-accounts"><div className="panel-heading"><div><span className="eyebrow">CONSULTATION EN LECTURE SEULE</span><h2>Code d’accès à transmettre</h2></div></div>
  {loading?<p role="status">Chargement…</p>:<>
   {parent?.enabled&&<div className="grant-row"><div><strong>{parent.revoked_at?'Accès révoqué':parent.code_configured?'Code d’accès configuré':'Code à définir'}</strong></div>{!parent.revoked_at&&<button className="button small secondary" disabled={pending} onClick={()=>void action('DELETE',{id:'parent'})}>Révoquer l’accès</button>}</div>}
   <form className="invite-form" onSubmit={e=>{e.preventDefault();void action('POST',{operation:'set-code',accessCode:code});}}><label>{parent?.code_configured?'Nouveau code d’accès':'Code d’accès'}<input type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required value={code} maxLength={7} placeholder="ABC-123" onChange={e=>{const raw=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);setCode(raw.slice(0,3)+(raw.length>3?'-'+raw.slice(3):''));}} disabled={pending}/></label><button className="button" disabled={pending}>{pending?'Enregistrement…':parent?.revoked_at?'Réactiver avec ce code':parent?.code_configured?'Remplacer le code':'Enregistrer le code'}</button></form>
   <p className="hint">Six lettres et chiffres. Le consultant saisira uniquement ce code. Un changement de code ferme ses anciennes sessions.</p>
  </>}
  {sharedCode&&<div className="invitation-link" role="status"><label>Code à transmettre<input readOnly value={sharedCode} autoComplete="off"/></label><p>Conservez-le avant de quitter cette page.</p><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(sharedCode);setMessage('Code copié.');}catch{setMessage('Sélectionnez le code pour le copier.');}}}>Copier le code</button><button className="text-button" onClick={()=>setSharedCode('')}>Masquer</button></div>}
  {error&&<p className="login-error" role="alert">{error}</p>}{message&&<p className="login-success" role="status">{message}</p>}
 </section>;
}
