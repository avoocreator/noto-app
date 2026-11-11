import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RemoteFile, RemoteStore } from './engine.ts';

const BUCKET = 'noto-attachments';
const CRED_KEY = 'noto-supabase';

export interface SupabaseCreds { url: string; anonKey: string }

export function loadCreds(): SupabaseCreds | null {
  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    return { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY };
  }
  try {
    const c = JSON.parse(localStorage.getItem(CRED_KEY) || 'null') as SupabaseCreds | null;
    return c?.url && c.anonKey ? c : null;
  } catch { return null; }
}
export function saveCreds(c: SupabaseCreds | null) {
  try { c ? localStorage.setItem(CRED_KEY, JSON.stringify(c)) : localStorage.removeItem(CRED_KEY); } catch { /* abaikan */ }
}

let cached: { key: string; client: SupabaseClient } | null = null;
export function getClient(c: SupabaseCreds): SupabaseClient {
  const key = c.url + '|' + c.anonKey;
  if (cached?.key === key) return cached.client;
  const client = createClient(c.url, c.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'noto-auth' },
  });
  cached = { key, client };
  return client;
}

export async function sendOtp(client: SupabaseClient, email: string) {
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}
export async function verifyOtp(client: SupabaseClient, email: string, token: string) {
  const { data, error } = await client.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) throw error;
  return data.user;
}
export async function currentUser(client: SupabaseClient) {
  const { data } = await client.auth.getUser();
  return data.user;
}

export interface RemoteVault { id: string; name: string }
export async function listRemoteVaults(client: SupabaseClient): Promise<RemoteVault[]> {
  const { data, error } = await client.from('noto_vaults').select('id,name').order('created_at');
  if (error) throw error;
  return (data ?? []) as RemoteVault[];
}
export async function createRemoteVault(client: SupabaseClient, id: string, name: string) {
  const { error } = await client.from('noto_vaults').upsert({ id, name });
  if (error) throw error;
}

const mime = (p: string) => {
  const e = p.split('.').pop()?.toLowerCase();
  return e === 'png' ? 'image/png' : e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : e === 'webp' ? 'image/webp'
    : e === 'svg' ? 'image/svg+xml' : e === 'gif' ? 'image/gif' : e === 'pdf' ? 'application/pdf' : 'application/octet-stream';
};

export class SupabaseRemote implements RemoteStore {
  constructor(private client: SupabaseClient, private userId: string, private vaultId: string) {}
  private obj(path: string) { return `${this.userId}/${this.vaultId}/${path}`; }

  async list(): Promise<RemoteFile[]> {
    const out: RemoteFile[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.client
        .from('noto_files').select('path,hash,kind')
        .eq('vault_id', this.vaultId).eq('deleted', false)
        .order('path').range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...((data ?? []) as RemoteFile[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  async getText(path: string) {
    const { data, error } = await this.client.from('noto_files').select('content')
      .eq('vault_id', this.vaultId).eq('path', path).single();
    if (error) throw error;
    return (data as { content: string }).content;
  }
  async getBlob(path: string) {
    const { data, error } = await this.client.storage.from(BUCKET).download(this.obj(path));
    if (error) throw error;
    return new Uint8Array(await data.arrayBuffer());
  }
  async putText(path: string, content: string, hash: string) {
    const { error } = await this.client.from('noto_files').upsert(
      { user_id: this.userId, vault_id: this.vaultId, path, kind: 'text', content, hash, deleted: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,vault_id,path' });
    if (error) throw error;
  }
  async putBlob(path: string, data: Uint8Array, hash: string) {
    const up = await this.client.storage.from(BUCKET).upload(this.obj(path), data, { upsert: true, contentType: mime(path) });
    if (up.error) throw up.error;
    const { error } = await this.client.from('noto_files').upsert(
      { user_id: this.userId, vault_id: this.vaultId, path, kind: 'blob', content: '', hash, deleted: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,vault_id,path' });
    if (error) throw error;
  }
  async remove(path: string) {
    const { error } = await this.client.from('noto_files')
      .update({ deleted: true, content: '', updated_at: new Date().toISOString() })
      .eq('vault_id', this.vaultId).eq('path', path);
    if (error) throw error;
    await this.client.storage.from(BUCKET).remove([this.obj(path)]); // kosong bila bukan blob
  }
}
