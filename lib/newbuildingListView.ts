/* Bantuan tampilan daftar panjang (Uji tangki dan Daftar temuan): cari, ringkasan status uji, dan paging. */
import type { StructStatus, TestStatus } from './newbuildingTankTests';

/** Banyak baris yang ditampilkan per halaman; tombol "Tampilkan lagi" menambah sebanyak ini. */
export const PAGE_STEP = 20;

/** Semua kata ketikan harus ada di salah satu bagian teks (huruf besar kecil tidak dibedakan). Ketikan kosong cocok dengan semuanya. */
export function matchesQuery(query: string, parts: (string | null | undefined)[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = parts
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

export type TankState = 'gagal' | 'belum' | 'lulus';

/** Keadaan satu kompartemen: gagal bila ada uji tidak lulus; lulus bila leak test lulus dan uji struktur lulus atau tidak perlu; selain itu belum selesai. */
export function tankState(r: { leak_status: TestStatus; struct_status: StructStatus }): TankState {
  if (r.leak_status === 'tidak_lulus' || r.struct_status === 'tidak_lulus') return 'gagal';
  if (r.leak_status === 'lulus' && (r.struct_status === 'lulus' || r.struct_status === 'tidak_perlu')) return 'lulus';
  return 'belum';
}

export function countTankStates(rows: { leak_status: TestStatus; struct_status: StructStatus }[]): Record<TankState, number> {
  const c: Record<TankState, number> = { gagal: 0, belum: 0, lulus: 0 };
  for (const r of rows) c[tankState(r)] += 1;
  return c;
}
