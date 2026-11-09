import { MATERIAL_ITEMS, itemsRequired } from './materialRules';
import type { MatItem, MatTipe } from './materialRules';

/** Status penerimaan satu item material/komponen. Item tanpa baris di database = 'belum'. */
export type MatStatus = 'belum' | 'diterima' | 'tidak_ada';

export const STATUS_LABEL: Record<MatStatus, string> = {
  belum: 'Belum diterima',
  diterima: 'Diterima',
  tidak_ada: 'Tidak ada di kapal ini',
};

export const STATUSES: MatStatus[] = ['belum', 'diterima', 'tidak_ada'];

/** Baris tabel nb_material_status (kolom yang dipakai). */
export type MatStatusRow = {
  item_key: string;
  status: MatStatus;
  cert_no: string | null;
  note: string | null;
};

/** Penanda unik item: nomor produk, ditambah sub-jenis bila ada (mis. "11|HHP / VHHP"). */
export const itemKey = (it: MatItem): string => (it.kind ? `${it.no}|${it.kind}` : String(it.no));

/** Item yang ditampilkan: yang disyaratkan untuk tipe, atau seluruh daftar bila semua = true. */
export function trackerItems(tipe: MatTipe | null, all = false): MatItem[] {
  if (all || tipe === null) return MATERIAL_ITEMS;
  return itemsRequired(tipe);
}

export type Progress = { total: number; diterima: number; belum: number; tidakAda: number; pct: number };

/** Kemajuan: item "tidak ada di kapal ini" dikeluarkan dari pembagi. */
export function progressOf(items: MatItem[], rows: Map<string, MatStatusRow>): Progress {
  let diterima = 0;
  let tidakAda = 0;
  for (const it of items) {
    const s = rows.get(itemKey(it))?.status ?? 'belum';
    if (s === 'diterima') diterima++;
    else if (s === 'tidak_ada') tidakAda++;
  }
  const total = items.length - tidakAda;
  const belum = total - diterima;
  return { total, diterima, belum, tidakAda, pct: total > 0 ? Math.round((diterima / total) * 100) : 0 };
}
