import { supabase } from './supabase';
import { fetchAllRows } from './fetchAll';

type Query = {
  order: (col: string) => Query;
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

// Tabel inti: bila gagal dibaca, pencadangan dibatalkan (jangan sampai file cadangan terlihat lengkap padahal tidak).
// Tabel tambahan: bila gagal dibaca (mis. tabel belum dibuat), dilewati dan dicatat di file serta pesan hasil.
// Kolom urutan harus unik supaya paging tidak tumpang tindih; report_na tidak punya kolom id, jadi memakai kunci gabungannya.
const CORE: { table: string; order: string[] }[] = [
  { table: 'vessels', order: ['id'] },
  { table: 'agendas', order: ['id'] },
  { table: 'vessel_events', order: ['id'] },
];
const EXTRA: { table: string; order: string[] }[] = [
  { table: 'bulletins', order: ['id'] },
  { table: 'report_na', order: ['owner', 'vessel_type', 'col', 'item'] },
  { table: 'vessel_types_custom', order: ['owner', 'name'] },
  { table: 'audit_log', order: ['id'] },
  // Bangunan Baru. Tabel status per item tidak punya id: urutannya memakai pasangan (project_id, item_key).
  { table: 'nb_projects', order: ['id'] },
  { table: 'nb_stage_status', order: ['project_id', 'item_key'] },
  { table: 'nb_drawing_status', order: ['project_id', 'item_key'] },
  { table: 'nb_material_status', order: ['project_id', 'item_key'] },
  { table: 'nb_tank_tests', order: ['id'] },
  { table: 'nb_findings', order: ['id'] },
  { table: 'nb_finding_photos', order: ['id'] },
];

async function readTable(table: string, order: string[]): Promise<{ rows: unknown[]; error: string | null }> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const sb = supabase;
  const r = await fetchAllRows((from, to) => {
    const q = order.reduce((acc, c) => acc.order(c), sb.from(table).select('*') as unknown as Query);
    return q.range(from, to);
  });
  return { rows: r.data, error: r.error ? r.error.message : null };
}

export type BackupResult = { counts: Record<string, number>; skipped: string[] };

/**
 * Mengunduh data kapal, agenda, pembaruan status, bulletin, pengaturan laporan, jenis kapal sendiri, riwayat perubahan,
 * dan data Bangunan Baru (proyek, tahapan, gambar, material, uji tangki, temuan, data foto)
 * sebagai satu file JSON (hanya data yang boleh dibaca akun ini; admin = semua akun).
 * Catatan: file lampiran/gambar di Storage (termasuk foto temuan) tidak ikut; yang tersimpan hanya tautannya.
 */
export async function downloadBackup(): Promise<BackupResult> {
  const tables: Record<string, unknown[]> = {};
  const skipped: { table: string; error: string }[] = [];

  for (const t of CORE) {
    const r = await readTable(t.table, t.order);
    if (r.error) throw new Error(`Gagal membaca tabel ${t.table}: ${r.error}`);
    tables[t.table] = r.rows;
  }
  for (const t of EXTRA) {
    const r = await readTable(t.table, t.order);
    if (r.error) skipped.push({ table: t.table, error: r.error });
    else tables[t.table] = r.rows;
  }

  const counts: Record<string, number> = {};
  Object.keys(tables).forEach((t) => (counts[t] = tables[t].length));

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify({ app: 'rdk-class', format: 2, exportedAt: now.toISOString(), tables, skipped }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rdk-cadangan-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { counts, skipped: skipped.map((s) => s.table) };
}
