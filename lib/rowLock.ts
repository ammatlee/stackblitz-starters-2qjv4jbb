/**
 * Penguncian edit bersamaan untuk tabel status per item (nb_stage_status, nb_drawing_status, nb_material_status).
 * Baris di tabel ini tidak dikenali lewat "id" tetapi lewat pasangan (project_id, item_key), jadi tidak bisa
 * memakai updateWithVersion (lib/optimisticLock.ts). Aturannya sama: simpan hanya bila baris masih berversi
 * sama dengan yang dibuka; kolom "version" naik otomatis lewat trigger (lihat SQL langkah 1).
 *
 * Nilai version yang dikirim ke saveKeyedRow:
 *  - angka     : baris sudah ada saat dibuka → UPDATE hanya bila version masih sama
 *  - null      : baris belum ada saat dibuka → INSERT; bila ternyata sudah dibuat orang lain = bentrok
 *  - undefined : kolom version belum ada di database (SQL belum dijalankan) → cara lama (upsert, tanpa cek)
 */
type Err = { message: string } | null;
type Res = PromiseLike<{ data: unknown; error: Err }>;

type Writer = { eq: (col: string, val: unknown) => Writer; select: (cols: string) => Res };
type Reader = Res & { eq: (col: string, val: unknown) => Reader; maybeSingle: () => Res };

/** Bagian klien Supabase yang dipakai (supaya mudah diuji dengan tiruan). */
export type KeyedClient = {
  from: (table: string) => {
    select: (cols: string) => Reader;
    insert: (values: Record<string, unknown>) => { select: (cols: string) => Res };
    update: (values: Record<string, unknown>) => Writer;
    upsert: (values: Record<string, unknown>, opts: { onConflict: string }) => Res;
  };
};

export const CONFLICT_MESSAGE = 'Data ini sudah diubah orang lain setelah Anda membukanya. Tampilan dimuat ulang; ulangi perubahan Anda bila perlu.';

export type KeyedResult =
  | { status: 'ok'; version: number | undefined }
  | { status: 'conflict' | 'missing' | 'error'; message: string };

const DUPLICATE = /duplicate key|unique constraint|already exists/i;

const versionOf = (data: unknown, fallback: number): number => {
  const rows = Array.isArray(data) ? (data as { version?: number }[]) : [];
  return rows.length > 0 && rows[0].version != null ? Number(rows[0].version) : fallback;
};

/** Membaca semua baris satu proyek, beserta kolom version bila ada. versioned=false berarti kolom version belum ada. */
export async function selectKeyed(
  client: KeyedClient,
  table: string,
  cols: string,
  projectId: string
): Promise<{ data: unknown[]; error: Err; versioned: boolean }> {
  const withV = await client.from(table).select(`${cols},version`).eq('project_id', projectId);
  if (!withV.error) return { data: Array.isArray(withV.data) ? withV.data : [], error: null, versioned: true };
  if (!/version/i.test(withV.error.message)) return { data: [], error: withV.error, versioned: false };
  const plain = await client.from(table).select(cols).eq('project_id', projectId);
  return { data: !plain.error && Array.isArray(plain.data) ? plain.data : [], error: plain.error, versioned: false };
}

export async function saveKeyedRow(
  client: KeyedClient,
  table: string,
  projectId: string,
  itemKey: string,
  version: number | null | undefined,
  values: Record<string, unknown>
): Promise<KeyedResult> {
  const key = { project_id: projectId, item_key: itemKey };

  if (version === undefined) {
    const r = await client.from(table).upsert({ ...key, ...values }, { onConflict: 'project_id,item_key' });
    return r.error ? { status: 'error', message: r.error.message } : { status: 'ok', version: undefined };
  }

  if (version === null) {
    const ins = await client.from(table).insert({ ...key, ...values }).select('version');
    if (ins.error) return DUPLICATE.test(ins.error.message) ? { status: 'conflict', message: CONFLICT_MESSAGE } : { status: 'error', message: ins.error.message };
    return { status: 'ok', version: versionOf(ins.data, 1) };
  }

  const up = await client.from(table).update(values).eq('project_id', projectId).eq('item_key', itemKey).eq('version', version).select('version');
  if (up.error) return { status: 'error', message: up.error.message };
  if (Array.isArray(up.data) && up.data.length > 0) return { status: 'ok', version: versionOf(up.data, version + 1) };

  // tidak ada baris yang berubah: bedakan "sudah diubah orang lain" dari "tidak ada / tidak ada izin"
  const cur = await client.from(table).select('version').eq('project_id', projectId).eq('item_key', itemKey).maybeSingle();
  if (cur.error) return { status: 'error', message: cur.error.message };
  if (cur.data) return { status: 'conflict', message: CONFLICT_MESSAGE };
  return { status: 'missing', message: 'Data tidak ditemukan (mungkin proyeknya sudah dihapus) atau Anda tidak punya izin mengubahnya.' };
}
