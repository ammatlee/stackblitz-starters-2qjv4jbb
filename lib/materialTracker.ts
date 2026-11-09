import { MATERIAL_ITEMS, hiddenByVessel, itemsRequired, weldingItemsRequired } from './materialRules';
import type { MatItem, MatTipe, VesselCtx } from './materialRules';

/** Status penerimaan satu item material/komponen. Item tanpa baris di database = 'belum'. */
export type MatStatus = 'belum' | 'diterima' | 'tidak_ada';

export const STATUS_LABEL: Record<MatStatus, string> = {
  belum: 'Belum ada',
  diterima: 'Ada',
  tidak_ada: 'N/A (tidak ada di kapal ini)',
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

/**
 * Item yang ditampilkan: yang disyaratkan untuk tipe, atau seluruh daftar bila semua = true.
 * Bila ctx (jenis kapal) diberikan, item yang tidak relevan untuk tugboat/tongkang ikut disembunyikan.
 */
export function trackerItems(tipe: MatTipe | null, all = false, ctx?: VesselCtx): MatItem[] {
  if (tipe === null) return MATERIAL_ITEMS;
  const weld = weldingItemsRequired(tipe);
  if (all) return [...MATERIAL_ITEMS, ...weld];
  const req = itemsRequired(tipe);
  return [...(ctx ? req.filter((it) => !hiddenByVessel(it, ctx)) : req), ...weld];
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
