import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { clearOfflineCache, makeOfflineFetch } from './offlineFetch';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ehvbyhzlgdupafuzbgnd.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LpcYyg69736jVtB9gVexNA__cox8R5t';

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
