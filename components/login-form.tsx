'use client';
import { useState } from 'react';
import {readJsonResponse} from '../lib/client-response';
export default function LoginForm({configured, initialError, passwordOnly=false,googleEnabled=false}: {configured:boolean;initialError?:string;passwordOnly?:boolean;googleEnabled?:boolean}) {
  const [role,setRole]=useState('teacher'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[reset,setReset]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(initialError || ''),[message,setMessage]=useState('');
  async function submit(e:React.FormEvent) {
    e.preventDefault();setError('');setMessage('');
    if(passwordOnly && password!==confirm){setError('Les deux mots de passe doivent être identiques.');return;}
    setPending(true);
    try {
      const r=await fetch('/api/auth/'+(passwordOnly?'password':reset?'reset':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:email,accessCode:role==='parent'?email:undefined,email,password,role})});
      const result=await readJsonResponse(r);
      if(reset)setMessage(result.message);else window.location.assign('/');
    } catch(e){setError((e as Error).message || 'La connexion a échoué. Réessayez.');}finally{setPending(false);}
  }
  return <main className="login-page"><a className="login-brand" href="/login"><svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="5" fill="#000091"/><path d="M11 29V11h10a6 6 0 0 1 0 12H11m10 0 8 6" fill="none" stroke="white" strokeWidth="2.5"/></svg><span>Repère</span></a><section className="login-card" aria-labelledby="login-title">
    <span className="eyebrow">ACCÈS AU SUIVI</span><h1 id="login-title">{passwordOnly?'Définir votre mot de passe':reset?'Recevoir un e-mail de connexion':'Se connecter'}</h1>
    {!passwordOnly && <div className="login-role" role="group" aria-label="Choisir votre espace"><button type="button" aria-pressed={role==='teacher'} onClick={()=>{setRole('teacher');setEmail('');setReset(false);setError('');}}>Professeur</button><button type="button" aria-pressed={role==='parent'} onClick={()=>{setRole('parent');setEmail('');setReset(false);setError('');}}>Consultation</button></div>}
    {!passwordOnly && <p className="login-description">{role==='teacher'?'Accédez à la saisie des séances et au suivi des chapitres.':'Connectez-vous avec votre code d’accès pour consulter les bilans publiés.'}</p>}
    {!configured && <p className="login-notice" role="status">La connexion sera disponible après la configuration de Supabase sur cet hébergement. Aucun compte de démonstration n’est activé.</p>}
    <form className="login-form" onSubmit={submit}>
      {!passwordOnly && <label>{role==='teacher'?'Adresse e-mail':'Code d’accès'}<input type={role==='teacher'?'email':'text'} autoComplete="username" autoCapitalize={role==='parent'?'characters':'none'} spellCheck={false} placeholder={role==='parent'?'ABC-123':undefined} required value={email} maxLength={role==='parent'?7:254} onChange={e=>{if(role==='teacher')setEmail(e.target.value);else{const raw=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);setEmail(raw.slice(0,3)+(raw.length>3?'-'+raw.slice(3):''));}}} disabled={pending}/></label>}
      {(!reset || passwordOnly) && <label>{passwordOnly?'Nouveau mot de passe':'Mot de passe'}<input type="password" autoComplete={passwordOnly?'new-password':'current-password'} minLength={passwordOnly?12:1} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/>{passwordOnly && <small>12 caractères minimum.</small>}</label>}
      {passwordOnly && <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={pending}/></label>}
      {error && <p className="login-error" role="alert">{error}</p>}{message && <p className="login-success" role="status">{message}</p>}
      <button className="button" disabled={pending || !configured} type="submit">{pending?'Veuillez patienter…':passwordOnly?'Enregistrer et accéder au suivi':reset?'Envoyer l’e-mail':(role==='teacher'?'Accéder à l’espace professeur':'Accéder à la consultation')}</button>
    </form>
    {!passwordOnly && role==='teacher' && <><button type="button" className="text-button login-forgot" onClick={()=>{setReset(!reset);setError('');setMessage('');}}>{reset?'Revenir à la connexion':'Mot de passe oublié ?'}</button>{googleEnabled && <><div className="login-divider"><span>ou</span></div><a aria-disabled={!configured} tabIndex={configured?0:-1} className="button secondary google-login" href={configured?'/auth/google?role='+role:undefined}><svg viewBox="0 0 20 20" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M18.4 10.2c0-.6-.1-1.2-.2-1.8H10v3.3h4.7a4 4 0 0 1-1.7 2.6 5.4 5.4 0 1 1-3-9.8c1.4 0 2.5.5 3.5 1.4L16 3.5A9 9 0 1 0 10 19c5.1 0 8.4-3.6 8.4-8.8Z"/></svg>Continuer avec Google</a></>}</>}
    {!passwordOnly && role==='parent' && <p className="login-description">Pour réinitialiser un mot de passe oublié, contactez le professeur.</p>}
  </section><p className="login-footer">Accès réservé aux comptes autorisés.</p></main>;
}
