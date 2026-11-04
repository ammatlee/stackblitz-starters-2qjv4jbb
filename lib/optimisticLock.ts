/**
 * Penguncian edit bersamaan: simpan hanya bila baris di database masih berversi sama dengan yang dibuka.
 * Kolom "version" naik otomatis lewat trigger (sql/07_versi_edit.sql).
 *  - ok        : tersimpan, version baru dikembalikan
 *  - conflict  : orang lain sudah menyimpan lebih dulu → muat ulang, jangan menimpa
 *  - missing   : baris tidak ada (dihapus) atau tidak ada izin
 *  - error     : kesalahan lain dari server
 */
type Err = { message: string } | null;
type Res = PromiseLike<{ data: unknown; error: Err }>;

/** Bagian klien Supabase yang dipakai (supaya mudah diuji dengan tiruan). */
export type LockClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => { eq: (col: string, val: unknown) => { select: (cols: string) => Res } };
    };
    select: (cols: string) => { eq: (col: string, val: unknown) => { maybeSingle: () => Res } };
  };
};

export type LockResult =
  | { status: 'ok'; version: number }
  | { status: 'conflict' | 'missing' | 'error'; message: string };

export async function updateWithVersion(
  client: LockClient,
  table: string,
  id: string,
  version: number,
  values: Record<string, unknown>
): Promise<LockResult> {
  const up = await client.from(table).update(values).eq('id', id).eq('version', version).select('id,version');
  if (up.error) return { status: 'error', message: up.error.message };
  const rows = Array.isArray(up.data) ? (up.data as { version?: number }[]) : [];
  if (rows.length > 0) return { status: 'ok', version: Number(rows[0].version ?? version + 1) };

  // tidak ada baris yang berubah: bedakan "sudah diubah orang lain" dari "tidak ada / tidak ada izin"
  const cur = await client.from(table).select('id,version').eq('id', id).maybeSingle();
  if (cur.error) return { status: 'error', message: cur.error.message };
  if (cur.data) return { status: 'conflict', message: 'Data ini sudah diubah orang lain setelah Anda membukanya.' };
  return { status: 'missing', message: 'Data tidak ditemukan (mungkin sudah dihapus) atau Anda tidak punya izin mengubahnya.' };
}
