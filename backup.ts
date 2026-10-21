import { supabase } from './supabase';

// tabel yang ikut dicadangkan (hanya data yang boleh dibaca akun ini; admin = semua akun)
const TABLES = ['vessels', 'agendas', 'vessel_events'] as const;
const PAGE = 1000;

async function fetchAll(table: string): Promise<unknown[]> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const out: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal membaca tabel ${table}: ${error.message}`);
    const rows = (data ?? []) as unknown[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Mengunduh semua data kapal, agenda, dan pembaruan status sebagai satu file JSON. Mengembalikan jumlah baris per tabel. */
export async function downloadBackup(): Promise<Record<string, number>> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await fetchAll(t);
  const counts: Record<string, number> = {};
  TABLES.forEach((t) => (counts[t] = tables[t].length));

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify({ app: 'rdk-class', exportedAt: now.toISOString(), tables }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rdk-cadangan-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return counts;
}
