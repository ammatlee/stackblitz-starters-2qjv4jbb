import { supabase } from './supabase';
import { fetchAllRows } from './fetchAll';
import { NB_TABLES } from './restoreNbTables';
import type { NbTable } from './restoreNbTables';
import type { Backup } from './restore';

/**
 * Memulihkan data Bangunan Baru dari file cadangan (pasangan lib/restore.ts, aturan keselamatannya sama):
 *  - hanya MENAMBAH baris yang belum ada; baris di server tidak pernah ditimpa, jadi memulihkan dua kali tidak membuat dobel;
 *  - baris yang membawa kolom owner dan bukan milik akun ini dilewati; baris tanpa kolom owner diserahkan ke aturan akses (RLS) server;
 *  - urutan: proyek → status tahapan/gambar/material dan uji tangki → temuan → data foto (anak butuh induknya);
 *  - baris yang induknya tidak ada di server maupun di cadangan dilewati (orphan).
 * File foto di Storage tidak ikut cadangan: data foto dipulihkan, tetapi gambarnya tidak bisa dibuka bila berkasnya sudah hilang.
 */
type Row = Record<string, unknown>;

/** Tabel status per item tidak punya id: barisnya dikenali dari pasangan (project_id, item_key). */
const COMPOSITE: ReadonlySet<NbTable> = new Set<NbTable>(['nb_stage_status', 'nb_drawing_status', 'nb_material_status']);

/** Kolom yang menunjuk ke induknya. optional = boleh kosong. */
const REFS: Record<NbTable, { col: string; parent: NbTable; optional?: boolean }[]> = {
  nb_projects: [],
  nb_stage_status: [{ col: 'project_id', parent: 'nb_projects' }],
  nb_drawing_status: [{ col: 'project_id', parent: 'nb_projects' }],
  nb_material_status: [{ col: 'project_id', parent: 'nb_projects' }],
  nb_tank_tests: [{ col: 'project_id', parent: 'nb_projects' }],
  nb_findings: [
    { col: 'project_id', parent: 'nb_projects' },
    { col: 'source_tank_id', parent: 'nb_tank_tests', optional: true },
  ],
  nb_finding_photos: [
    { col: 'project_id', parent: 'nb_projects' },
    { col: 'finding_id', parent: 'nb_findings' },
  ],
};

export const nbKey = (t: NbTable, r: Row): string => (COMPOSITE.has(t) ? `${String(r.project_id)}|${String(r.item_key)}` : String(r.id));

const zero = (): Record<NbTable, number> => ({ nb_projects: 0, nb_stage_status: 0, nb_drawing_status: 0, nb_material_status: 0, nb_tank_tests: 0, nb_findings: 0, nb_finding_photos: 0 });

export type NbPlan = {
  toAdd: Record<NbTable, Row[]>;
  /** sudah ada di server (dilewati) */
  exists: Record<NbTable, number>;
  /** milik akun lain (dilewati) */
  notMine: Record<NbTable, number>;
  /** kunci baris yang sudah ada di server, dipakai runRestoreNb untuk memeriksa induk */
  have: Record<NbTable, Set<string>>;
};

async function existingKeys(t: NbTable): Promise<Set<string>> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const sb = supabase;
  const cols = COMPOSITE.has(t) ? 'project_id,item_key' : 'id';
  const r = await fetchAllRows((from, to) => {
    const q = COMPOSITE.has(t) ? sb.from(t).select(cols).order('project_id').order('item_key') : sb.from(t).select(cols).order('id');
    return q.range(from, to);
  });
  if (r.error) throw new Error(`Gagal memeriksa tabel ${t}: ${r.error.message}`);
  return new Set((r.data as Row[]).map((x) => nbKey(t, x)));
}

/** Menghitung apa yang akan ditambahkan, TANPA mengubah apa pun di server. */
export async function planRestoreNb(b: Backup, ownerId: string): Promise<NbPlan> {
  const plan: NbPlan = {
    toAdd: { nb_projects: [], nb_stage_status: [], nb_drawing_status: [], nb_material_status: [], nb_tank_tests: [], nb_findings: [], nb_finding_photos: [] },
    exists: zero(),
    notMine: zero(),
    have: { nb_projects: new Set(), nb_stage_status: new Set(), nb_drawing_status: new Set(), nb_material_status: new Set(), nb_tank_tests: new Set(), nb_findings: new Set(), nb_finding_photos: new Set() },
  };
  for (const t of NB_TABLES) {
    const rows = b.tables[t] ?? [];
    if (rows.length === 0) continue; // tidak ada di cadangan: tidak perlu membaca server
    const have = await existingKeys(t);
    plan.have[t] = have;
    const seen = new Set<string>();
    for (const row of rows) {
      if ('owner' in row && row.owner !== ownerId) {
        plan.notMine[t] += 1;
        continue;
      }
      const k = nbKey(t, row);
      if (have.has(k) || seen.has(k)) {
        plan.exists[t] += 1;
        continue;
      }
      seen.add(k);
      plan.toAdd[t].push(row);
    }
  }
  return plan;
}

export type NbResult = {
  added: Record<NbTable, number>;
  /** gagal ditambahkan, beserta pesan kesalahan pertama dari server */
  failed: { table: NbTable; count: number; message: string }[];
  /** dilewati karena induknya (proyek, uji tangki, atau temuan) tidak ada */
  orphan: Record<NbTable, number>;
};

const CHUNK = 100;

/** Menambahkan baris per kelompok; bila satu kelompok ditolak, dicoba satu per satu supaya baris yang baik tetap masuk. */
async function insertRows(t: NbTable, rows: Row[]): Promise<{ okKeys: string[]; failed: number; message: string }> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const sb = supabase;
  const okKeys: string[] = [];
  let failed = 0;
  let message = '';
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const all = await sb.from(t).insert(part);
    if (!all.error) {
      part.forEach((r) => okKeys.push(nbKey(t, r)));
      continue;
    }
    for (const r of part) {
      const one = await sb.from(t).insert(r);
      if (one.error) {
        failed += 1;
        if (!message) message = one.error.message;
      } else okKeys.push(nbKey(t, r));
    }
  }
  return { okKeys, failed, message };
}

/** Menjalankan pemulihan sesuai rencana dari planRestoreNb. */
export async function runRestoreNb(plan: NbPlan): Promise<NbResult> {
  const result: NbResult = { added: zero(), failed: [], orphan: zero() };
  // induk yang boleh dirujuk: yang sudah ada di server + yang baru berhasil ditambahkan
  const ok: Record<NbTable, Set<string>> = {
    nb_projects: new Set(plan.have.nb_projects),
    nb_stage_status: new Set(),
    nb_drawing_status: new Set(),
    nb_material_status: new Set(),
    nb_tank_tests: new Set(plan.have.nb_tank_tests),
    nb_findings: new Set(plan.have.nb_findings),
    nb_finding_photos: new Set(),
  };
  // induk yang tidak ada di cadangan tetapi dirujuk anak: ambil dari server bila belum diketahui
  for (const t of NB_TABLES) {
    const need = NB_TABLES.some((c) => REFS[c].some((r) => r.parent === t) && plan.toAdd[c].length > 0);
    if (need && ok[t].size === 0 && plan.toAdd[t].length === 0) ok[t] = await existingKeys(t);
  }

  for (const t of NB_TABLES) {
    const usable: Row[] = [];
    for (const r of plan.toAdd[t]) {
      const lost = REFS[t].some((ref) => {
        const v = r[ref.col];
        if (v == null) return !ref.optional;
        return !ok[ref.parent].has(String(v));
      });
      if (lost) result.orphan[t] += 1;
      else usable.push(r);
    }
    const x = await insertRows(t, usable);
    result.added[t] = x.okKeys.length;
    x.okKeys.forEach((k) => ok[t].add(k));
    if (x.failed) result.failed.push({ table: t, count: x.failed, message: x.message });
  }
  return result;
}
