import { supabase } from './supabase';
import { fetchAllRows } from './fetchAll';
import { NB_TABLES } from './restoreNbTables';

/**
 * Memulihkan data dari file cadangan (rdk-cadangan-*.json buatan lib/backup.ts).
 *
 * Aturan keselamatan:
 *  - hanya MENAMBAH baris yang belum ada; baris yang sudah ada TIDAK pernah ditimpa
 *    (jadi data terbaru di server aman, dan memulihkan dua kali tidak membuat dobel);
 *  - hanya baris milik akun yang sedang masuk (kolom owner) yang dipulihkan;
 *  - urutan: kapal dulu, baru agenda dan pembaruan manual (keduanya bergantung pada kapal);
 *  - agenda dengan nomor agenda yang sudah dipakai akun ini dilewati (bentrok), bukan ditimpa.
 * Tabel yang dipulihkan di sini: vessels, agendas, vessel_events. Data Bangunan Baru dipulihkan oleh lib/restoreNb.ts.
 * Bulletin, pengaturan laporan, dan riwayat perubahan belum ikut (lampiran di Storage memang tidak ada di file cadangan).
 */

type Row = Record<string, unknown>;
export type Backup = { app: string; format: number; exportedAt?: string; tables: Record<string, Row[]> };

export const RESTORE_TABLES = ['vessels', 'agendas', 'vessel_events'] as const;
export type RestoreTable = (typeof RESTORE_TABLES)[number];

export const TABLE_LABEL: Record<RestoreTable, string> = {
  vessels: 'kapal',
  agendas: 'agenda',
  vessel_events: 'pembaruan manual',
};

/** Membaca teks file cadangan dan memastikan bentuknya benar. Melempar Error berbahasa Indonesia bila tidak cocok. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('File ini bukan file cadangan yang benar (isinya tidak terbaca).');
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'rdk-class' || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('File ini bukan cadangan RDK. Pilih file "rdk-cadangan-....json" hasil tombol Unduh cadangan.');
  }
  if (b.format !== 2) throw new Error(`Versi format cadangan (${String(b.format)}) tidak dikenali oleh aplikasi ini.`);
  const tables: Record<string, Row[]> = {};
  // tabel Bangunan Baru ikut dibaca di sini, dipulihkan oleh lib/restoreNb.ts
  for (const t of [...RESTORE_TABLES, ...NB_TABLES]) {
    const v = (b.tables as Record<string, unknown>)[t];
    tables[t] = Array.isArray(v) ? (v as Row[]).filter((r) => r && typeof r === 'object') : [];
  }
  return { app: b.app, format: 2, exportedAt: b.exportedAt, tables };
}

export type RestorePlan = {
  toAdd: Record<RestoreTable, Row[]>;
  /** sudah ada di server (dilewati) */
  exists: Record<RestoreTable, number>;
  /** milik akun lain (dilewati) */
  notMine: Record<RestoreTable, number>;
  /** nomor agenda sudah dipakai di server dengan id berbeda (dilewati) */
  conflict: number;
};

const zero = (): Record<RestoreTable, number> => ({ vessels: 0, agendas: 0, vessel_events: 0 });

async function existingKeys(table: RestoreTable, ownerId: string): Promise<{ ids: Set<string>; agendaNos: Set<string> }> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const sb = supabase;
  const cols = table === 'agendas' ? 'id,agenda_no,owner' : 'id';
  const r = await fetchAllRows((from, to) => sb.from(table).select(cols).order('id').range(from, to));
  if (r.error) throw new Error(`Gagal memeriksa tabel ${table}: ${r.error.message}`);
  const ids = new Set<string>();
  const agendaNos = new Set<string>();
  for (const x of r.data as Row[]) {
    ids.add(String(x.id));
    if (table === 'agendas' && x.owner === ownerId && x.agenda_no != null) agendaNos.add(String(x.agenda_no));
  }
  return { ids, agendaNos };
}

/** Menghitung apa yang akan ditambahkan, TANPA mengubah apa pun di server. */
export async function planRestore(b: Backup, ownerId: string): Promise<RestorePlan> {
  const plan: RestorePlan = {
    toAdd: { vessels: [], agendas: [], vessel_events: [] },
    exists: zero(),
    notMine: zero(),
    conflict: 0,
  };
  for (const t of RESTORE_TABLES) {
    const have = await existingKeys(t, ownerId);
    for (const row of b.tables[t]) {
      if (row.owner !== ownerId) {
        plan.notMine[t] += 1;
        continue;
      }
      if (have.ids.has(String(row.id))) {
        plan.exists[t] += 1;
        continue;
      }
      if (t === 'agendas' && row.agenda_no != null && have.agendaNos.has(String(row.agenda_no))) {
        plan.conflict += 1;
        continue;
      }
      plan.toAdd[t].push(row);
    }
  }
  return plan;
}

export type RestoreResult = {
  added: Record<RestoreTable, number>;
  /** gagal ditambahkan, beserta pesan kesalahan pertama dari server */
  failed: { table: RestoreTable; count: number; message: string }[];
  /** dilewati karena kapalnya tidak ada di server maupun di cadangan */
  orphan: Record<RestoreTable, number>;
};

const CHUNK = 100;

/** Menambahkan baris per kelompok; bila satu kelompok ditolak, dicoba satu per satu supaya baris yang baik tetap masuk. */
async function insertRows(table: RestoreTable, rows: Row[]): Promise<{ okIds: string[]; failed: number; message: string }> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const sb = supabase;
  const okIds: string[] = [];
  let failed = 0;
  let message = '';
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const all = await sb.from(table).insert(part);
    if (!all.error) {
      part.forEach((r) => okIds.push(String(r.id)));
      continue;
    }
    for (const r of part) {
      const one = await sb.from(table).insert(r);
      if (one.error) {
        failed += 1;
        if (!message) message = one.error.message;
      } else okIds.push(String(r.id));
    }
  }
  return { okIds, failed, message };
}

/** Menjalankan pemulihan sesuai rencana dari planRestore. */
export async function runRestore(plan: RestorePlan): Promise<RestoreResult> {
  const result: RestoreResult = { added: zero(), failed: [], orphan: zero() };

  // 1) kapal
  const v = await insertRows('vessels', plan.toAdd.vessels);
  result.added.vessels = v.okIds.length;
  if (v.failed) result.failed.push({ table: 'vessels', count: v.failed, message: v.message });

  // kapal yang boleh dirujuk: yang sudah ada di server + yang baru berhasil ditambahkan
  const known = await existingKeys('vessels', '');
  const vesselOk = known.ids;

  // 2) agenda dan pembaruan manual
  for (const t of ['agendas', 'vessel_events'] as const) {
    const usable: Row[] = [];
    for (const r of plan.toAdd[t]) {
      if (r.vessel_id != null && !vesselOk.has(String(r.vessel_id))) result.orphan[t] += 1;
      else usable.push(r);
    }
    const x = await insertRows(t, usable);
    result.added[t] = x.okIds.length;
    if (x.failed) result.failed.push({ table: t, count: x.failed, message: x.message });
  }
  return result;
}
