import { supabase } from './supabase';

/** Peta user_id → email dari tabel profiles. Admin bisa membaca semua profil; akun biasa hanya melihat miliknya sendiri. */
export async function fetchOwnerEmails(ids: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!supabase || uniq.length === 0) return {};
  const { data } = await supabase.from('profiles').select('user_id,email').in('user_id', uniq);
  const m: Record<string, string> = {};
  ((data ?? []) as { user_id: string; email: string | null }[]).forEach((p) => {
    if (p.email) m[p.user_id] = p.email;
  });
  return m;
}
