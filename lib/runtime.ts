import postgres from 'postgres';
import {accountForUser} from './auth/accounts';
import type {Account} from './auth/policy';
import { createDatabase, type Execute } from './postgres-adapter';
import { adminClient, authClient } from './auth/supabase';
let database: ReturnType<typeof createDatabase> | undefined;
function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('La base de données n’est pas configurée.');
  if (!database) {
    // Supabase’s transaction pooler can stall pipelined queries. Keep reads
    // concurrent across connections, with a single in-flight query per connection.
    const sql = postgres(process.env.DATABASE_URL, {
      prepare: false, max: 3, max_pipeline: 1,
      idle_timeout: 20, connect_timeout: 15, queue_timeout: 15, query_timeout: 15,
    });
    const execute: Execute = async (query, args) => { const rows = await sql.unsafe(query, args); return { rows: [...rows], count: rows.count }; };
    database = createDatabase(execute, fn => sql.begin(async tx => fn(async (query, args) => { const rows = await tx.unsafe(query, args); return { rows: [...rows], count: rows.count }; })) as Promise<any>);
  }
  return database;
}
const bucket = () => adminClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'repere-private');
export const env = {
  LATEX: async (source:string,files:{name:string;bytes:Uint8Array}[]) => (await import("./latex-compiler.mjs")).compileLatex(source,files),
  get DB() { return getDatabase(); },
  BUCKET: {
    async put(key: string, bytes: Uint8Array | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
      const { error } = await bucket().upload(key, bytes, { contentType: options?.httpMetadata?.contentType || 'application/pdf', upsert: false });
      if (error) throw error;
    },
    async delete(key: string) { const { error } = await bucket().remove([key]); if (error) throw error; },
    async get(key: string) {
      const { data, error } = await bucket().download(key);
      if (error || !data) return null;
      return { body: data.stream() };
    },
  },
};
export const resolveAccount: (() => Promise<Account | null>) | undefined = async () => {
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : accountForUser(user, env.DB);
};
