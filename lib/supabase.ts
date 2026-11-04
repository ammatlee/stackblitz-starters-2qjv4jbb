import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { clearOfflineCache, makeOfflineFetch } from './offlineFetch';

// Alamat dan key HANYA dari variabel lingkungan (Cloudflare: Settings → Variables and Secrets; lokal/StackBlitz: file .env.local).
// Sengaja tanpa nilai bawaan supaya build yang lupa diisi tidak diam-diam memakai database produksi; bila kosong, aplikasi masuk mode demo.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = Boolean(url && key && !url.startsWith('ISI_'));

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url, key, { global: { fetch: makeOfflineFetch(`${url}/rest/v1/`) } })
  : null;

// keluar akun: hapus salinan data di HP (aman untuk HP yang dipakai bersama)
if (supabase && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') void clearOfflineCache();
  });
}
