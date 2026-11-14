/**
 * Daftar dokumen sertifikasi Bangunan Baru (PKBB): satu daftar induk untuk Interim dan Permanent.
 *
 * Sumber:
 *  - Interim: "Daftar dokumen pendukung yang wajib diunggah" (bagian A Dokumen Umum dan B PKBB). Dokumen yang pada daftar itu
 *    boleh disusulkan bersama laporan lengkap TIDAK wajib untuk Interim (interim = false), tetapi wajib untuk Permanent.
 *  - Permanent: Standard Pemeriksaan Laporan Survey BKI (22 Nov 2023), bagian PKBB: form utama, form tambahan per jenis kapal,
 *    dan Lampiran PKBB (26 butir). Permanent = SEMUA dokumen yang berlaku, termasuk semua dokumen Interim.
 *
 * Satu dokumen hanya punya satu status, jadi mencentang di daftar Interim otomatis berlaku di Permanent.
 * Semua dokumen wajib kecuali ditandai N/A oleh pengguna. Dokumen yang tidak mungkin ada karena aturan
 * (load line tidak dimohon, kapal tanpa penggerak, bukan grup form tambahan) disembunyikan, bukan dihitung.
 */

import { MATERIAL_ITEMS, WELDING, WELDING_ITEMS } from './materialRules';
import type { MatTipe } from './materialRules';
import { itemKey, trackerItems } from './materialTracker';
import type { MatStatus } from './materialTracker';

/** Status satu dokumen. Item tanpa baris di database = 'belum'. */
export type DocStatus = 'belum' | 'ada' | 'menyusul' | 'tidak_ada';

export const DOC_STATUSES: DocStatus[] = ['belum', 'ada', 'menyusul', 'tidak_ada'];

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  belum: 'Belum',
  ada: 'Ada',
  menyusul: 'Menyusul',
  tidak_ada: 'N/A',
};

/** Baris tabel nb_doc_status (kolom yang dipakai). */
export type DocRow = {
  item_key: string;
  status: DocStatus;
  recv_date: string | null;
  note: string | null;
  /** Penanda edit bersamaan (kolom version); kosong bila kolomnya belum ada di database. */
  version?: number;
};

/* ---------- jenis kapal → grup form tambahan ---------- */

/** PB = pontoon dan tongkang (hanya form utama). A–E = grup form tambahan di Standard Pemeriksaan Laporan Survey. */
export type FormGroup = 'PB' | 'A' | 'B' | 'C' | 'D' | 'E';

export const FORM_GROUP_LABEL: Record<FormGroup, string> = {
  PB: 'Pontoon & Barge (form utama saja)',
  A: 'Grup A: tug, work ship, dredger, special service, offshore service, crew boat, landing craft, patrol, fishing',
  B: 'Grup B: general dry cargo, multi-purpose, deck cargo, livestock, self propelled barge, container, Ro-Ro',
  C: 'Grup C: passenger, Ro-Ro passenger, passenger boat, HSC, yacht',
  D: 'Grup D: oil tanker dan chemical tanker',
  E: 'Grup E: liquefied gas carrier',
};

const GROUP_BY_TYPE: Record<string, FormGroup> = {
  Pontoon: 'PB',
  Barge: 'PB',
  'Crane Barge': 'PB',
  'Oil Barge': 'PB',
  'Accommodation Barge': 'PB',
  Tugboat: 'A',
  'Anchor Handling Tug': 'A',
  LCT: 'A',
  'Supply Vessel (PSV/OSV)': 'A',
  'Fishing Vessel': 'A',
  Dredger: 'A',
  SPOB: 'B',
  'General Cargo': 'B',
  'Container Ship': 'B',
  'Ro-Ro Cargo Ship': 'B',
  'Passenger Ship': 'C',
  'Ro-Ro Passenger Ship': 'C',
  'Oil Tanker': 'D',
  'Chemical Tanker': 'D',
  'Gas Carrier': 'E',
};

/**
 * Grup form untuk satu jenis kapal. null = jenis kapal tidak punya grup di standar PKBB (mis. Bulk Carrier, FSO/FPSO):
 * hanya form utama yang dihitung. Jenis buatan sendiri dikenali dari kata kuncinya.
 */
export function formGroupOf(vesselType: string | null | undefined): FormGroup | null {
  if (!vesselType) return null;
  const exact = GROUP_BY_TYPE[vesselType];
  if (exact) return exact;
  const t = vesselType.toLowerCase();
  if (/self[\s-]?propelled|\bspob\b|\bsplb\b|motor barge|bermesin/.test(t)) return 'B';
  if (/pontoon|barge|tongkang/.test(t)) return 'PB';
  if (/passenger|penumpang|ferry|yacht|hsc/.test(t)) return 'C';
  if (/\bgas\b|lpg|lng/.test(t)) return 'E';
  if (/chemical|tanker|kimia/.test(t)) return 'D';
  if (/\btug|tunda|dredg|supply|psv|osv|fishing|ikan|crew|patrol|landing|\blct\b|work ?ship|offshore service|special service/.test(t)) return 'A';
  if (/cargo|container|ro[\s-]?ro|kargo|multi/.test(t)) return 'B';
  return null;
}

/* ---------- form tambahan per grup (Standard Pemeriksaan Laporan Survey, bagian PKBB) ---------- */

const COMMON_ADD = ['F21.2.25', 'F21.2.26', 'F21.2.28', 'F21.2.31', 'F21.2.32', 'F21.2.33', 'F21.2.35', 'F21.2.36', 'F21.2.37', 'F21.2.38', 'F21.2.39', 'F21.2.40'];
const BULKHEAD = ['F21.2.29', 'F21.2.30'];

const ADD_BY_GROUP: Record<FormGroup, string[]> = {
  PB: [],
  A: COMMON_ADD,
  B: [...COMMON_ADD, ...BULKHEAD],
  C: [...COMMON_ADD, ...BULKHEAD, 'F21.2.44'],
  D: [...COMMON_ADD, ...BULKHEAD, 'F21.2.09', 'F21.2.11', 'F21.2.12', 'F21.2.13', 'F21.2.16', 'F21.2.19'],
  E: [...COMMON_ADD, ...BULKHEAD, 'F21.2.10', 'F21.2.13'],
};

const FORM_TITLE: Record<string, string> = {
  'F21.2.09': 'Report on Initial Survey of Chemical Tankers',
  'F21.2.10': 'Report on Initial Survey of Liquefied Gas Tankers',
  'F21.2.11': 'Initial Survey of Inert Gas / Nitrogen System on Tankers',
  'F21.2.12': 'Construction of Electrical Equipment in Hazardous Areas',
  'F21.2.13': 'Report on Initial Survey of Electrical Installation on Oil, Chemical, and Gas Tanker',
  'F21.2.16': 'Report on Faults and Failures in Automated Machinery Installation',
  'F21.2.19': 'Detail of Ship Related Equipment for Variable Frequency Operation',
  'F21.2.25': 'Report on Trials of the Machinery and Electrical Plants',
  'F21.2.26': 'Test Report: Shipboard Tests of the Electrical Power Supply',
  'F21.2.28': 'Detail on CO2 Fire Extinguishing Equipment',
  'F21.2.29': 'Detail of Watertight Bulkheads and Decks',
  'F21.2.30': 'Detail of Watertight Bulkheads and A-60 Class Divisions on Cargo Ships',
  'F21.2.31': 'Check List for New Building Compressed Air Systems',
  'F21.2.32': 'Check List for New Building Cargo Ship Bilge System',
  'F21.2.33': 'Check List for New Building Water Fire Extinguishing Systems',
  'F21.2.35': 'Check List for New Building Fuel Oil Systems',
  'F21.2.36': 'Check List for New Building Cooling Water Systems',
  'F21.2.37': 'Check List for New Building Lubricating Oil Systems',
  'F21.2.38': 'Check List for New Building Ballast Water Systems of Cargo Ships',
  'F21.2.39': 'Check List for New Building Switchboard',
  'F21.2.40': 'Details of the Scope and Type of Electrical Plant',
  'F21.2.44': 'Report on Initial Survey of Shell Doors on Ro-Ro Ships',
};

/* ---------- butir dokumen ---------- */

export type Section = 'umum' | 'pkbb' | 'lampiran' | 'form';
export const SECTION_ORDER: Section[] = ['umum', 'pkbb', 'lampiran', 'form'];
export const SECTION_TITLE: Record<Section, string> = {
  umum: 'A. Dokumen umum',
  pkbb: 'B. Dokumen PKBB',
  lampiran: 'C. Lampiran PKBB lainnya',
  form: 'D. Form survey',
};

/** Dokumen yang statusnya dibaca dari tempat lain: pelacak material, atau status Interim certificate. */
export type Derived = 'shop' | 'wps' | 'welder' | 'consumable' | 'matcert' | 'interim';

export type DocItem = {
  /** Penanda unik di database ("<bagian>.<nama>"). Jangan diubah setelah dipakai. */
  key: string;
  /** Kode form BKI bila ada. */
  code?: string;
  label: string;
  hint?: string;
  section: Section;
  /** true = wajib ada sebelum Interim certificate. false = boleh menyusul bersama laporan lengkap, wajib untuk Permanent. */
  interim: boolean;
  derived?: Derived;
  /** Hanya berlaku bila ada permohonan load line / kapal bermesin penggerak. */
  need?: 'loadline' | 'propelled';
  /** Form tambahan: hanya berlaku untuk grup kapal ini. */
  groups?: FormGroup[];
};

const BASE_ITEMS: DocItem[] = [
  // A. Dokumen umum
  { key: 'u.particulars', code: 'F21.2.07', label: 'Data Kapal / Ship Particulars', hint: 'Untuk data register kapal.', section: 'umum', interim: true },
  { key: 'u.materials', code: 'F21.2.27', label: 'Daftar Material dan Komponen yang Digunakan pada Bangunan Baru', hint: 'Khusus PKBB.', section: 'umum', interim: true },
  { key: 'u.photos', code: 'F21.3.63', label: 'Lampiran Foto Survey', hint: 'Mewakili lingkup dan hasil survei, termasuk foto name plate M/E dan A/E.', section: 'umum', interim: true },
  { key: 'u.statutory', code: 'F23.1.02', label: 'General Statutory Survey Report', hint: 'Percepatan sertifikat permanen load line.', section: 'umum', interim: true, need: 'loadline' },
  { key: 'u.llAssign', code: 'F23.2.01 / F23.2.02', label: 'Load Line Assignment (Record of Conditions of Assignment)', section: 'umum', interim: true, need: 'loadline' },
  { key: 'u.llSurvey', code: 'F23.2.10 / F23.2.11', label: 'Statutory Survey Report (Laporan Survey Garis Muat)', section: 'umum', interim: true, need: 'loadline' },

  // B. Dokumen PKBB: wajib sebelum Interim
  { key: 'p.kickoff', code: 'F21.2.46', label: 'Kick-off meeting (report)', section: 'pkbb', interim: true },
  { key: 'p.shop', label: 'Persetujuan galangan (welding shop approval)', hint: 'Sesuai Circular 22-SV-185. Dibaca dari pelacak material.', section: 'pkbb', interim: true, derived: 'shop' },
  { key: 'p.wps', label: 'WPS approval (List of WPS)', hint: 'Dibaca dari pelacak material.', section: 'pkbb', interim: true, derived: 'wps' },
  { key: 'p.welder', label: 'Sertifikat kualifikasi juru las (List of Welder)', hint: 'Dibaca dari pelacak material.', section: 'pkbb', interim: true, derived: 'welder' },
  { key: 'p.itp', label: 'Inspection and Test Plan (ITP) yang disetujui', section: 'pkbb', interim: true },
  { key: 'p.keel', label: 'Berita acara peletakan lunas (Keel Laid Statement)', section: 'pkbb', interim: true },
  { key: 'p.trace', label: 'Dokumen identifikasi dan ketertelusuran material (List Material Identification, tracing dan sertifikat)', section: 'pkbb', interim: true },
  { key: 'p.compcert', label: 'Sertifikat komponen lambung dan mesin (sesuai F21.2.27)', hint: 'Dibaca dari pelacak material: lengkap bila semua item yang disyaratkan sudah Ada atau N/A.', section: 'pkbb', interim: true, derived: 'matcert' },
  { key: 'p.ndt', label: 'Laporan pemeriksaan tidak merusak (NDT): X-Ray, UT flaw engine foundation, dll', hint: 'Sesuai tipe kapal.', section: 'pkbb', interim: true },
  { key: 'p.iplt', code: 'F23.2.15', label: 'Berita acara pemasangan tanda garis muat (IPLT) dan bukti pembayaran PNBP', section: 'pkbb', interim: true, need: 'loadline' },
  { key: 'p.launch', label: 'Berita acara peluncuran kapal (Launch Statement)', section: 'pkbb', interim: true },
  { key: 'p.builder', label: "Builder's Certificate", section: 'pkbb', interim: true },
  { key: 'p.ukur', label: 'Surat ukur sementara atau permanen (Surat Ukur Internasional 1969)', section: 'pkbb', interim: true },
  { key: 'p.laut', label: 'Surat laut sementara atau permanen', section: 'pkbb', interim: true },

  // B. Dokumen PKBB: boleh menyusul bersama laporan lengkap (wajib untuk Permanent)
  { key: 'p.keeldefl', label: 'Keel deflection report', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false },
  { key: 'p.maindim', label: 'Main dimension report (pengukuran ukuran utama kapal)', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false },
  { key: 'p.align', label: 'Alignment rudder dan shaft propeller', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false, need: 'propelled' },
  { key: 'p.crank', label: 'Crankshaft deflection report', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false, need: 'propelled' },
  { key: 'p.loadtest', label: 'Load test genset', hint: 'Bisa disusulkan bersama laporan lengkap. Tandai N/A bila tidak ada genset.', section: 'pkbb', interim: false },
  { key: 'p.megger', label: 'Megger test report', hint: 'Bisa disusulkan bersama laporan lengkap. Tandai N/A bila tidak ada instalasi listrik.', section: 'pkbb', interim: false },
  { key: 'p.safety', label: 'Safety device test ME dan AE', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false, need: 'propelled' },
  { key: 'p.seatrial', label: 'Laporan uji berlayar (sea trial report)', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false, need: 'propelled' },
  { key: 'p.grosse', label: 'Grosse Akte', hint: 'Bisa diunggah menyusul bersama laporan survey lengkap.', section: 'pkbb', interim: false },
  { key: 'p.log', code: 'F21.2.62', label: 'Log aktivitas survei (Log Activity Survey)', hint: 'Bisa disusulkan bersama laporan lengkap.', section: 'pkbb', interim: false },

  // C. Lampiran PKBB lainnya (hanya Permanent)
  { key: 'l.interim', label: 'Sertifikat klasifikasi sementara (dan garis muat sementara bila ada load line)', hint: 'Otomatis Ada saat Interim certificate ditandai Selesai.', section: 'lampiran', interim: false, derived: 'interim' },
  { key: 'l.consumable', label: 'Sertifikat welding consumable', hint: 'Dibaca dari pelacak material.', section: 'lampiran', interim: false, derived: 'consumable' },
  { key: 'l.antifouling', label: 'Sertifikat anti fouling dari manufacture', section: 'lampiran', interim: false },
  { key: 'l.corrosion', label: 'Sertifikat corrosion protection', section: 'lampiran', interim: false },
  { key: 'l.patrol', code: 'F21.2.61', label: 'Patrol Survey', section: 'lampiran', interim: false },
  { key: 'l.shipyard', code: 'F21.2.60', label: 'Shipyard review record', section: 'lampiran', interim: false },

  // D. Form utama (hanya Permanent). F21.2.07, F21.2.27, F21.3.63, dan F23.x sudah ada di bagian A.
  { key: 'f.F21.2.01', code: 'F21.2.01', label: 'Survey Report for Commencement of Production at Workshop', section: 'form', interim: false },
  { key: 'f.F21.2.02', code: 'F21.2.02', label: 'Survey Report for Keel Laying', section: 'form', interim: false },
  { key: 'f.F21.2.03', code: 'F21.2.03', label: 'Survey Report for Launching', section: 'form', interim: false },
  { key: 'f.F21.2.04', code: 'F21.2.04', label: 'Class Survey Report', section: 'form', interim: false },
  { key: 'f.F21.2.05', code: 'F21.2.05', label: 'Detail Description Report', section: 'form', interim: false },
  { key: 'f.F21.2.06', code: 'F21.2.06', label: 'Recommendation, Memoranda, Information (Class)', section: 'form', interim: false },
  { key: 'f.F21.2.08', code: 'F21.2.08', label: 'Survey Report During Construction', section: 'form', interim: false },
  { key: 'f.F21.3.57', code: 'F21.3.57', label: 'Statement of Survey', section: 'form', interim: false },
];

const codeNum = (c: string): number[] => c.replace(/^F/, '').split('.').map(Number);
const byCode = (a: string, b: string): number => {
  const x = codeNum(a);
  const y = codeNum(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** Form tambahan: satu butir per kode, dengan daftar grup yang mewajibkannya. */
const ADD_ITEMS: DocItem[] = (() => {
  const groups = Object.keys(ADD_BY_GROUP) as FormGroup[];
  const codes = Array.from(new Set(groups.flatMap((g) => ADD_BY_GROUP[g]))).sort(byCode);
  return codes.map((code) => ({
    key: `f.${code}`,
    code,
    label: FORM_TITLE[code] ?? code,
    hint: 'Form tambahan sesuai jenis kapal.',
    section: 'form' as const,
    interim: false,
    groups: groups.filter((g) => ADD_BY_GROUP[g].includes(code)),
  }));
})();

/** Seluruh butir yang mungkin ada, sebelum disaring menurut proyek. */
export const ALL_DOC_ITEMS: DocItem[] = [...BASE_ITEMS, ...ADD_ITEMS];

/** Dokumen yang boleh ditandai Menyusul: hanya yang tidak wajib untuk Interim dan statusnya bukan turunan. */
export const canDefer = (it: DocItem): boolean => !it.interim && !it.derived;

/* ---------- konteks proyek dan penyaringan ---------- */

export type CertCtx = {
  vesselType: string | null;
  propelled: boolean;
  /** Ada permohonan load line (kolom load_line di nb_projects). */
  loadLine: boolean;
  tipe: MatTipe | null;
};

const SHOP_KEY = itemKey(WELDING_ITEMS.find((w) => w.welding === 'weldingShop') ?? WELDING_ITEMS[0]);
const WPS_KEY = itemKey(WELDING_ITEMS.find((w) => w.welding === 'wps') ?? WELDING_ITEMS[1]);
const WELDER_KEY = itemKey(WELDING_ITEMS.find((w) => w.welding === 'welder') ?? WELDING_ITEMS[2]);
/** Welding consumable = produk nomor 84 di daftar material. */
const CONSUMABLE_ITEM = MATERIAL_ITEMS.find((m) => m.no === 84);
const CONSUMABLE_KEY = CONSUMABLE_ITEM ? itemKey(CONSUMABLE_ITEM) : '84';

const WELD_OF: Partial<Record<Derived, { key: string; field: 'weldingShop' | 'wps' | 'welder' }>> = {
  shop: { key: SHOP_KEY, field: 'weldingShop' },
  wps: { key: WPS_KEY, field: 'wps' },
  welder: { key: WELDER_KEY, field: 'welder' },
};

/** Item pelacak material yang menentukan "sertifikat material dan komponen" (tanpa welding dan consumable). */
function matcertItems(c: CertCtx) {
  if (c.tipe === null) return [];
  return trackerItems(c.tipe, false, { vesselType: c.vesselType, propelled: c.propelled }).filter((m) => !m.welding && itemKey(m) !== CONSUMABLE_KEY);
}

/** Butir ini berlaku untuk proyek? false = disembunyikan (bukan dihitung kurang). */
export function itemApplies(it: DocItem, c: CertCtx): boolean {
  if (it.need === 'loadline' && !c.loadLine) return false;
  if (it.need === 'propelled' && !c.propelled) return false;
  if (it.groups) {
    const g = formGroupOf(c.vesselType);
    if (!g || !it.groups.includes(g)) return false;
  }
  // tipe material belum diketahui: tetap ditampilkan (status Belum) supaya pengguna diingatkan mengisi GT
  if (it.derived && c.tipe !== null) {
    const w = WELD_OF[it.derived];
    if (w) return WELDING[w.field][c.tipe] !== null;
    if (it.derived === 'consumable') return requiredByTipe(c.tipe);
    if (it.derived === 'matcert') return matcertItems(c).length > 0;
  }
  return true;
}

/** Welding consumable disyaratkan bila selnya untuk tipe ini bukan '-'. */
function requiredByTipe(tipe: MatTipe): boolean {
  if (!CONSUMABLE_ITEM) return false;
  const cell = tipe === 'D' ? CONSUMABLE_ITEM.D : CONSUMABLE_ITEM[tipe];
  return typeof cell === 'string' ? cell !== '-' : cell.some((x) => x !== '-');
}

/** Butir yang berlaku untuk proyek ini, urut sesuai daftar. */
export const certItems = (c: CertCtx): DocItem[] => ALL_DOC_ITEMS.filter((it) => itemApplies(it, c));

/** Jumlah butir yang disembunyikan karena aturan (load line, penggerak, tipe material). Form tambahan grup lain tidak dihitung. */
export const hiddenCertCount = (c: CertCtx): number => ALL_DOC_ITEMS.filter((it) => !it.groups && !itemApplies(it, c)).length;

/* ---------- status dan ringkasan ---------- */

export type CertInputs = {
  docRows: Map<string, { status: DocStatus }>;
  /** null = data pelacak material belum bisa dibaca. */
  matRows: Map<string, { status: MatStatus }> | null;
  /** Interim certificate sudah ditandai Selesai di Tahapan. */
  interimDone: boolean;
};

export type Resolved = {
  item: DocItem;
  status: DocStatus;
  /** Keterangan untuk butir turunan (mis. "2 dari 5 item"). */
  detail?: string;
  /** Status berasal dari pelacak material / Tahapan, bukan dicentang di daftar ini. */
  auto: boolean;
};

const fromMat = (s: MatStatus | undefined): DocStatus => (s === 'diterima' ? 'ada' : s === 'tidak_ada' ? 'tidak_ada' : 'belum');

export function resolveItem(it: DocItem, c: CertCtx, inp: CertInputs): Resolved {
  const manual = inp.docRows.get(it.key)?.status ?? 'belum';
  // N/A pilihan pengguna berlaku untuk semua butir, termasuk yang turunan
  if (manual === 'tidak_ada') return { item: it, status: 'tidak_ada', auto: !!it.derived };
  if (!it.derived) return { item: it, status: manual, auto: false };

  if (it.derived === 'interim') {
    return { item: it, status: inp.interimDone ? 'ada' : 'belum', detail: 'Otomatis dari status Interim certificate', auto: true };
  }
  if (inp.matRows === null) return { item: it, status: 'belum', detail: 'Data pelacak material belum bisa dibaca', auto: true };
  if (c.tipe === null) return { item: it, status: 'belum', detail: 'Isi GT di data proyek untuk menentukan tipe material', auto: true };

  if (it.derived === 'matcert') {
    const items = matcertItems(c);
    const done = items.filter((m) => fromMat(inp.matRows?.get(itemKey(m))?.status) !== 'belum').length;
    return { item: it, status: items.length > 0 && done === items.length ? 'ada' : 'belum', detail: `${done} dari ${items.length} item di pelacak material`, auto: true };
  }
  const key = it.derived === 'consumable' ? CONSUMABLE_KEY : WELD_OF[it.derived]?.key ?? '';
  return { item: it, status: fromMat(inp.matRows.get(key)?.status), detail: 'Dari pelacak material', auto: true };
}

export type Prog = {
  /** Jumlah dokumen yang dihitung (N/A tidak dihitung). */
  total: number;
  done: number;
  pct: number;
  /** Dokumen yang masih kurang: status Belum atau Menyusul. */
  missing: Resolved[];
};

export type CertSummary = {
  items: Resolved[];
  interim: Prog;
  permanent: Prog;
  /** Butir yang disembunyikan karena aturan. */
  hidden: number;
};

function progOf(list: Resolved[]): Prog {
  const counted = list.filter((r) => r.status !== 'tidak_ada');
  const done = counted.filter((r) => r.status === 'ada').length;
  return {
    total: counted.length,
    done,
    pct: counted.length > 0 ? Math.round((done / counted.length) * 100) : 100,
    missing: counted.filter((r) => r.status !== 'ada'),
  };
}

export function summarizeCert(c: CertCtx, inp: CertInputs): CertSummary {
  const items = certItems(c).map((it) => resolveItem(it, c, inp));
  return {
    items,
    interim: progOf(items.filter((r) => r.item.interim)),
    permanent: progOf(items),
    hidden: hiddenCertCount(c),
  };
}

/* ---------- penjaga tahap Sertifikasi ---------- */

/** Item tahap Sertifikasi yang dijaga daftar dokumen. Final survey report tidak dijaga di sini. */
export const CERT_GATED = ['certificate.interim', 'certificate.permanent'];

export type CertGate = {
  msg: string;
  /** docs = dokumen kurang; order = tahap sebelumnya belum selesai. */
  kind: 'docs' | 'order';
};

const MAX_NAMES = 3;

/** Ringkas: tiga nama pertama dan sisanya. */
export function namesText(list: Resolved[]): string {
  const names = list.slice(0, MAX_NAMES).map((r) => r.item.code ?? r.item.label);
  const rest = list.length - names.length;
  return names.join(', ') + (rest > 0 ? `, dan ${rest} lainnya` : '');
}

/**
 * Alasan item Sertifikasi belum boleh Selesai/N/A; null bila boleh.
 * Interim: semua dokumen wajib Interim sudah Ada atau N/A.
 * Permanent: semua dokumen sudah Ada atau N/A (termasuk sertifikat sementara) dan Final survey report sudah selesai.
 */
export function certGate(itemKeyName: string, sum: CertSummary | null, finalDone: boolean): CertGate | null {
  if (!CERT_GATED.includes(itemKeyName)) return null;
  if (sum === null) return { msg: 'Data dokumen belum bisa dibaca, jadi item ini belum bisa diselesaikan. Muat ulang halaman, atau jalankan SQL nb_doc_status bila belum.', kind: 'docs' };
  const interim = itemKeyName === 'certificate.interim';
  const p = interim ? sum.interim : sum.permanent;
  if (p.missing.length > 0) {
    return { msg: `Dokumen ${interim ? 'Interim' : 'Permanent'} belum lengkap: masih kurang ${p.missing.length} (${namesText(p.missing)}).`, kind: 'docs' };
  }
  if (!interim && !finalDone) return { msg: 'Final survey report belum Selesai.', kind: 'order' };
  return null;
}

/* ---------- daftar kekurangan (teks siap kirim) ---------- */

const line = (r: Resolved): string => `- ${r.item.code ? `${r.item.code} ` : ''}${r.item.label}${r.status === 'menyusul' ? ' (menyusul)' : ''}`;

/** Teks daftar dokumen yang masih kurang, untuk disalin dan dikirim ke galangan atau owner. */
export function missingListText(projectName: string, sum: CertSummary): string {
  const out: string[] = [`Daftar dokumen yang masih kurang: ${projectName}`, ''];
  const im = sum.interim;
  out.push(im.missing.length === 0 ? `INTERIM: lengkap (${im.done}/${im.total})` : `INTERIM: ${im.done}/${im.total}, kurang ${im.missing.length}`);
  im.missing.forEach((r) => out.push(line(r)));
  out.push('');
  const interimKeys = new Set(im.missing.map((r) => r.item.key));
  const extra = sum.permanent.missing.filter((r) => !interimKeys.has(r.item.key));
  const pm = sum.permanent;
  out.push(pm.missing.length === 0 ? `PERMANENT: lengkap (${pm.done}/${pm.total})` : `PERMANENT: ${pm.done}/${pm.total}, kurang ${pm.missing.length} (termasuk dokumen Interim di atas)`);
  if (extra.length > 0) {
    out.push('Tambahan di luar Interim:');
    extra.forEach((r) => out.push(line(r)));
  }
  return out.join('\n');
}
