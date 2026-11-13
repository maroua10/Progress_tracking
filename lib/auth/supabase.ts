import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('La connexion n’est pas encore configurée.');
  return { url, key };
}
export async function authClient() {
  const { url, key } = authConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        try { for (const { name, value, options } of values) jar.set(name, value, options); }
        catch { /* Server components cannot write cookies; API handlers refresh them. */ }
      },
    },
  });
}
let admin: ReturnType<typeof createClient> | undefined;
export function adminClient() {
  const { url } = authConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Le service d’invitation et de documents n’est pas configuré.');
  return admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function siteUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error('L’adresse publique APP_URL doit être configurée.');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('APP_URL doit utiliser HTTPS.');
  return url.origin;
}

export function accessCodeSecret(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error("Le service de connexion n’est pas configuré.");return key;}
