import{normalizeAccessCode}from'./access-code.mjs';
export const CONSULTATION_COOKIE='repere_consultation';
export const CONSULTATION_MAX_AGE=8*60*60;
async function mac(value,secret){
 if(!secret)throw Object.assign(new Error('Le service de connexion n’est pas configuré.'),{status:503});
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function consultationCodeHash(value,secret){const code=normalizeAccessCode(value);return code?mac('repere:consultation:code:'+code,secret):null;}
export const consultationSessionProof=(hash,userId,secret)=>mac('repere:consultation:session:'+userId+':'+hash,secret);
export function equalDigest(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;let mismatch=0;for(let i=0;i<64;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
