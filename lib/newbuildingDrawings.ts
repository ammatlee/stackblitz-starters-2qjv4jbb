import { CODE_COND, DRAWING_COLS, DRAWING_GROUPS, DRAWING_ROWS } from './drawingList';
import type { DrawingCol, DrawingGroup } from './drawingList';
import { vesselProfile } from './materialRules';

/**
 * Pelacak gambar (tahap 2 bangunan baru).
 * Data BKI ada di drawingList.ts; file ini memilih kolom BKI untuk sebuah proyek,
 * menyusun daftar gambarnya, dan menghitung progress.
 */

/** Status satu gambar. Gambar tanpa baris di database = 'open'. Closed = sudah disetujui BKI. Nilai harus sama dengan check di tabel nb_drawing_status. */
export type DrawingStatus = 'open' | 'closed' | 'tidak_ada';

export const DRAWING_STATUSES: DrawingStatus[] = ['open', 'closed', 'tidak_ada'];

export const DRAWING_STATUS_LABEL: Record<DrawingStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  tidak_ada: 'N/A',
};

/** Baris tabel nb_drawing_status (kolom yang dipakai). */
export type DrawingRow = {
  item_key: string;
  status: DrawingStatus;
  submit_date: string | null;
  done_date: string | null;
  rev: string | null;
  note: string | null;
  /** Penanda edit bersamaan (kolom version); kosong bila kolomnya belum ada di database. */
  version?: number;
};

/** M = wajib; C = bersyarat (ada kode dan syarat); O = jika ada/opsional. */
export type DrawingReq = 'M' | 'C' | 'O';

export type Drawing = {
  /** Penanda unik di database: nomor gambar, mis. "16.2". */
  key: string;
  no: string;
  title: string;
  group: DrawingGroup;
  req: DrawingReq;
  /** Kode bersyarat, mis. "M2" atau "O12". */
  code: string | null;
  /** Syarat gambar itu berlaku. */
  cond: string | null;
};

export const DRAWING_REQ_LABEL: Record<DrawingReq, string> = {
  M: 'Wajib',
  C: 'Bersyarat',
  O: 'Jika ada',
};

/**
 * Gambar "jika ada/opsional" (kode O tanpa angka) tetap tampil dan bisa dicatat,
 * tetapi tidak dihitung ke progress dan tidak jadi penanda sebelum Commencement.
 * Ubah ke true bila ingin ikut dihitung.
 */
export const COUNT_OPTIONAL = false;

export const countsInProgress = (d: Drawing): boolean => d.req !== 'O' || COUNT_OPTIONAL;

const CELL = /^([MO])(\d*)(?:\|(.*))?$/;

/** Membaca satu sel dari drawingList.ts. Melempar Error bila bentuknya salah (dijaga oleh tes). */
export function parseDrawingCell(cell: string): { req: DrawingReq; code: string | null; cond: string | null } {
  const m = CELL.exec(cell);
  if (!m) throw new Error(`Sel daftar gambar tidak dikenali: "${cell}"`);
  const code = m[2] ? `${m[1]}${m[2]}` : null;
  const req: DrawingReq = code ? 'C' : m[1] === 'M' ? 'M' : 'O';
  const cond = m[3] ?? (code ? CODE_COND[code] ?? null : null);
  return { req, code, cond };
}

const isBargeCol = (c: DrawingCol): boolean => c.startsWith('BARGE_');

const cache = new Map<DrawingCol, Drawing[]>();

/** Daftar gambar untuk satu kolom BKI, urut nomor (kelompok dipisah lewat field group). */
export function drawingsFor(col: DrawingCol): Drawing[] {
  const hit = cache.get(col);
  if (hit) return hit;
  const list: Drawing[] = [];
  for (const [no, title, group, cells, bargeTitle] of DRAWING_ROWS) {
    const cell = cells[col];
    if (cell === undefined) continue;
    const p = parseDrawingCell(cell);
    list.push({ key: no, no, title: isBargeCol(col) && bargeTitle ? bargeTitle : title, group, req: p.req, code: p.code, cond: p.cond });
  }
  cache.set(col, list);
  return list;
}

/** Daftar satu kelompok (urutan nomor tetap). */
export const drawingsInGroup = (list: Drawing[], g: DrawingGroup): Drawing[] => list.filter((d) => d.group === g);

/** Kelompok yang punya isi, sesuai urutan tampil. */
export const groupsOf = (list: Drawing[]): DrawingGroup[] => DRAWING_GROUPS.filter((g) => list.some((d) => d.group === g));

// ---------------------------------------------------------------------------------------------
// Memilih kolom BKI dari data proyek
// ---------------------------------------------------------------------------------------------

export type DrawingColInput = {
  vesselType: string | null | undefined;
  /** Penggerak yang berlaku (sudah memperhitungkan pilihan manual di data proyek). */
  propelled: boolean;
  /** Flash point muatan: true = > 60°C, false = ≤ 60°C, null = belum diisi. */
  fpAbove60: boolean | null;
  /** Pilihan manual kolom BKI; mengalahkan pilihan otomatis bila valid. */
  override?: string | null;
};

export type DrawingColResult = { col: DrawingCol | null; needFlashPoint: boolean };

/** Nilai dari database dipastikan benar-benar salah satu kolom; selain itu dianggap tidak ada. */
export const asDrawingCol = (v: string | null | undefined): DrawingCol | null => (DRAWING_COLS.find((c) => c === v) ?? null);

/** Jenis kapal yang kolomnya ditentukan flash point muatan: SPOB, oil barge, dan chemical barge. */
export const needsFlashPoint = (vesselType: string | null | undefined): boolean => {
  const t = (vesselType ?? '').trim();
  if (!t) return false;
  if (/\bspob\b/i.test(t)) return true;
  return /(oil|chemical|minyak|kimia).*(barge|tongkang)|(barge|tongkang).*(oil|chemical|minyak|kimia)/i.test(t);
};

const isPontoon = (t: string): boolean => /pontoon/i.test(t);
const isLct = (t: string): boolean => /\blct\b|landing craft/i.test(t);
const isOtherBarge = (t: string): boolean => /barge|tongkang/i.test(t);

/** Jenis kapal lain: urutan penting (Ro-Ro Passenger sebelum Ro-Ro, Ro-Ro Cargo sebelum General Cargo). */
const OTHER_TYPES: [RegExp, DrawingCol][] = [
  [/ro[\s-]?ro.*(passenger|penumpang)|ropax/i, 'RORO_PASSENGER'],
  [/ro[\s-]?ro/i, 'RORO_CARGO'],
  [/passenger|penumpang/i, 'PASSENGER'],
  [/container|kontainer/i, 'CONTAINER'],
  [/bulk|ore carrier/i, 'BULK_CARRIER'],
  [/gas carrier|\blng\b|\blpg\b/i, 'GAS_CARRIER'],
  [/supply|\bpsv\b|\bosv\b|offshore service/i, 'SUPPLY'],
  [/fishing|ikan/i, 'FISHING'],
  [/dredg/i, 'DREDGER'],
  [/fpso/i, 'FPSO'],
  [/\bfso\b/i, 'FSO'],
  [/general cargo|dry cargo|multi[\s-]?purpose|cargo ship|kargo/i, 'GENERAL_CARGO'],
];

export function resolveDrawingCol(i: DrawingColInput): DrawingColResult {
  const manual = asDrawingCol(i.override);
  if (manual) return { col: manual, needFlashPoint: false };
  const t = (i.vesselType ?? '').trim();
  if (!t) return { col: null, needFlashPoint: false };

  // tugboat: aturan yang sama dengan saringan pelacak material (materialRules.vesselProfile)
  if (vesselProfile({ vesselType: t, propelled: i.propelled }) === 'tug') return { col: 'TUG', needFlashPoint: false };
  if (isPontoon(t)) return { col: 'PONTOON', needFlashPoint: false };
  if (/^oil tanker$/i.test(t)) return { col: 'OIL_TANKER', needFlashPoint: false };
  if (/^chemical tanker$/i.test(t)) return { col: 'CHEM_TANKER', needFlashPoint: false };

  if (needsFlashPoint(t)) {
    if (i.fpAbove60 === null) return { col: null, needFlashPoint: true };
    const col: DrawingCol = i.propelled ? (i.fpAbove60 ? 'BARGE_C' : 'BARGE_D') : i.fpAbove60 ? 'BARGE_A' : 'BARGE_B';
    return { col, needFlashPoint: false };
  }
  if (isLct(t)) return { col: 'LCT', needFlashPoint: false };
  if (isOtherBarge(t)) return { col: i.propelled ? 'BARGE_F' : 'BARGE_E', needFlashPoint: false };
  const other = OTHER_TYPES.find(([re]) => re.test(t));
  if (other) return { col: other[1], needFlashPoint: false };
  return { col: null, needFlashPoint: false };
}

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

export type DrawingRowsLike = ReadonlyMap<string, { status: DrawingStatus }>;

export const statusOf = (d: Drawing, rows: DrawingRowsLike): DrawingStatus => rows.get(d.key)?.status ?? 'open';

export type DrawingProgress = { total: number; closed: number; open: number; tidakAda: number; pct: number };

/** Gambar N/A dikeluarkan dari pembagi; gambar "jika ada" tidak dihitung (lihat COUNT_OPTIONAL). */
export function drawingProgress(list: Drawing[], rows: DrawingRowsLike): DrawingProgress {
  let counted = 0;
  let closed = 0;
  let tidakAda = 0;
  for (const d of list) {
    if (!countsInProgress(d)) continue;
    counted += 1;
    const s = statusOf(d, rows);
    if (s === 'closed') closed += 1;
    else if (s === 'tidak_ada') tidakAda += 1;
  }
  const total = counted - tidakAda;
  return { total, closed, open: total - closed, tidakAda, pct: total > 0 ? Math.round((closed / total) * 100) : 0 };
}

/** Gambar yang dihitung dan masih Open: penanda sebelum Commencement. */
export const openRequired = (list: Drawing[], rows: DrawingRowsLike): Drawing[] => list.filter((d) => countsInProgress(d) && statusOf(d, rows) === 'open');

/** Ringkasan untuk halaman Tahapan: kolom yang dipakai, progress, dan jumlah gambar dihitung yang masih Open. */
export type DrawingSummary = { col: DrawingCol | null; needFlashPoint: boolean; progress: DrawingProgress; open: number };

export function drawingSummary(i: DrawingColInput, rows: DrawingRowsLike): DrawingSummary {
  const { col, needFlashPoint } = resolveDrawingCol(i);
  const list = col ? drawingsFor(col) : [];
  return { col, needFlashPoint, progress: drawingProgress(list, rows), open: openRequired(list, rows).length };
}
