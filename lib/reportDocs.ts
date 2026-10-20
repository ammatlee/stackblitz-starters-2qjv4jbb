/**
 * Data checklist laporan survey: form yang harus diunggah dan dokumen lampiran pendukung.
 * Sumber: "Standard Pemeriksaan Laporan Survey — Penerimaan Klas dan Mempertahankan Klas" (Divisi Survey BKI, 2026, rev4).
 * Tanpa React; hanya data dan fungsi kecil.
 */
import type { SurveyKey } from './classValidity/surveyRules';

/* ---------- kolom jenis survey di standar ---------- */
export type Col = 'AS' | 'IS' | 'SS' | 'DS' | 'PS' | 'EC' | 'OS';
export const COLS: { key: Col; label: string }[] = [
  { key: 'AS', label: 'Annual Survey' },
  { key: 'IS', label: 'Intermediate Survey' },
  { key: 'SS', label: 'Special / Renewal Survey' },
  { key: 'DS', label: 'Docking Survey' },
  { key: 'PS', label: 'Propeller Shaft Survey' },
  { key: 'EC', label: 'Extension of Class' },
  { key: 'OS', label: 'Occasional Survey' },
];

/** Jenis survey di aplikasi → kolom di standar. */
export const COL_OF_SURVEY: Record<SurveyKey, Col> = {
  A1: 'AS', A2: 'AS', A3: 'AS', A4: 'AS', A5: 'AS',
  INT: 'IS',
  D1: 'DS',
  REN: 'SS', // Renewal + Docking 2: form docking sudah termasuk di kolom SS
  PS: 'PS',
};

/* ---------- kategori kapal (9 tabel di standar) ---------- */
export const CATEGORIES: { id: string; label: string; noIS: boolean; noPS: boolean }[] = [
  { id: '1', label: 'Pontoon', noIS: true, noPS: true },
  { id: '2', label: 'Barge — work barge, chemical barge, oil barge', noIS: false, noPS: false },
  { id: '3', label: 'Tug, work ship, dredger, special service ship, offshore service vessel, crew boat, patrol boat, fishing vessel', noIS: false, noPS: false },
  { id: '4', label: 'General dry cargo, multi purpose dry cargo, deck cargo, livestock carrier, self propelled barge', noIS: false, noPS: false },
  { id: '5', label: 'Passenger ship, passenger boat, yacht', noIS: false, noPS: false },
  { id: '6', label: 'Container ship', noIS: false, noPS: false },
  { id: '7', label: 'Landing craft', noIS: false, noPS: false },
  { id: '8', label: 'Ro-Ro passenger ship, Ro-Ro passenger boat, HSC', noIS: false, noPS: false },
  { id: '9', label: 'Ro-Ro ship', noIS: false, noPS: false },
];

/** Kategori otomatis menurut jenis kapal. null = belum ada tabelnya di standar (mis. tanker): ditambahkan nanti. */
export const CATEGORY_OF_TYPE: Record<string, string | null> = {
  'Pontoon': '1',
  'Barge': '2',
  'Crane Barge': '2',
  'Oil Barge': '2',
  'Accommodation Barge': '2',
  'Tugboat': '3',
  'Anchor Handling Tug': '3',
  'Supply Vessel (PSV/OSV)': '3',
  'Fishing Vessel': '3',
  'Dredger': '3',
  'General Cargo': '4',
  'Bulk Carrier': '4',
  'SPOB': '4',
  'Passenger Ship': '5',
  'Passenger / Ro-Ro': '5', // nama lama (data lama), diperlakukan sebagai kapal penumpang
  'Container Ship': '6',
  'LCT': '7',
  'Ro-Ro Passenger Ship': '8',
  'Ro-Ro Cargo Ship': '9',
  'Oil Tanker': null,
  'Chemical Tanker': null,
  'Gas Carrier': null,
  'FSO / FPSO': null,
};

/** Untuk jenis buatan sendiri ("Others"): tebak kategori dari kata kuncinya. */
const KEYWORDS: [RegExp, string | null][] = [
  [/tanker|gas carrier|lng|lpg|fso|fpso/i, null],
  [/ro-?ro.*(passenger|penumpang|ferry)|passenger.*ro-?ro|\bhsc\b|high speed/i, '8'],
  [/ro-?ro/i, '9'],
  [/passenger|penumpang|yacht|ferry/i, '5'],
  [/container/i, '6'],
  [/landing craft|\blct\b/i, '7'],
  [/pontoon/i, '1'],
  [/self.?propelled|\bspob\b|\bsplb\b/i, '4'],
  [/barge|tongkang/i, '2'],
  [/tug|dredg|crew|patrol|fishing|offshore|supply|work ?ship|special service|\bpsv\b|\bosv\b/i, '3'],
  [/cargo|livestock|bulk|general/i, '4'],
];

export const categoryOfType = (t: string | null | undefined): string | null => {
  if (!t) return null;
  if (t in CATEGORY_OF_TYPE) return CATEGORY_OF_TYPE[t];
  for (const [re, id] of KEYWORDS) if (re.test(t)) return id;
  return null;
};

/* ---------- form yang harus diunggah ---------- */
export type FormRow = { code: string; title: string; on: Col[]; note?: string };

const MAIN_FULL: FormRow[] = [
  { code: 'F21.3.01', title: 'Survey Report', on: ['AS', 'IS', 'SS', 'DS', 'PS', 'EC', 'OS'] },
  { code: 'F21.3.02', title: 'Detail Description Report', on: ['AS', 'IS', 'SS', 'DS', 'PS', 'EC', 'OS'] },
  { code: 'F21.3.03', title: 'Recommendation, Memoranda, Information (Class), bila ada → survey status dan IS/IPS surveyor', on: ['AS', 'IS', 'SS', 'DS', 'PS', 'EC', 'OS'] },
  { code: 'F21.3.04', title: 'Hull & Machinery Survey Report', on: ['AS', 'IS', 'SS', 'EC', 'OS'], note: 'Untuk EC dan OS: isian default AS.' },
  { code: 'F21.3.05', title: 'Class Survey Report (Docking survey / In-water survey)', on: ['IS', 'SS', 'DS', 'PS'] },
  { code: 'F21.3.06', title: 'Class Survey Report (Propeller Shaft and Tube Shaft)', on: ['SS', 'PS'] },
  { code: 'F21.3.07', title: 'Class Survey Report (Approval of Technical Requirements for the Acceptance of an In-Water Survey in Lieu of Docking Survey)', on: ['IS', 'SS', 'DS'] },
  { code: 'F21.3.09', title: 'Continuous Machinery Survey Report', on: ['AS', 'IS', 'SS'], note: 'Additional condition A-SM; A-SM-; AS-SPRO (untuk kapal ber-CMS).' },
  { code: 'F21.3.10', title: 'Report of Machinery Survey under Opened-Up Condition for Ship Not Applied CMS', on: ['AS', 'IS', 'SS', 'EC', 'OS'], note: 'Additional condition A-SM; A-SM-; AS-SPRO.' },
  { code: 'F21.3.41', title: 'Diameter Measurements of Anchor Chain Cables', on: ['SS', 'DS'] },
  { code: 'F21.3.57', title: 'Form Pernyataan Survey (Statement of Survey)', on: ['AS', 'IS', 'SS', 'DS', 'PS', 'EC', 'OS'] },
  { code: 'F21.3.63', title: 'Lampiran Foto Survey', on: ['AS', 'IS', 'SS', 'DS', 'PS', 'EC', 'OS'] },
  { code: 'F23.1.02', title: 'General Statutory Survey Report', on: ['AS', 'SS', 'EC', 'OS'] },
  { code: 'F23.2.10', title: 'Laporan Survey Garis Muat — 1966 Protocol 1988', on: ['AS', 'SS', 'EC', 'OS'] },
  { code: 'F23.2.11', title: 'Laporan Survey Garis Muat — PM 39 Tahun 2016', on: ['AS', 'SS', 'EC', 'OS'] },
];

// Pontoon: tidak ada kolom IS dan PS, dan hanya F21.3.05, F21.3.07, F21.3.41 yang berbeda
const MAIN_PONTOON: FormRow[] = MAIN_FULL.filter((r) => ['F21.3.01', 'F21.3.02', 'F21.3.03', 'F21.3.04', 'F21.3.05', 'F21.3.07', 'F21.3.41', 'F21.3.57', 'F21.3.63', 'F23.1.02', 'F23.2.10', 'F23.2.11'].includes(r.code)).map((r) => {
  const on = r.on.filter((c) => c !== 'IS' && c !== 'PS');
  if (r.code === 'F21.3.05') return { ...r, on: ['DS'] as Col[] };
  if (r.code === 'F21.3.07') return { ...r, on: ['SS', 'DS'] as Col[] };
  return { ...r, on };
});

const X = {
  refrig: { code: 'F21.3.42-2013/Rev.0', title: 'Periodical Survey for Refrigerating Installation', on: ['AS', 'IS', 'SS'] as Col[] },
  boiler: { code: 'F21.6.01-2013/Rev.0', title: 'Class Survey Report (Boiler / Thermal Oil Heater), bila ada', on: ['AS', 'SS'] as Col[] },
  closeup: { code: 'F21.3.12-2023', title: 'Close-up Survey Report (General Dry Cargo Ships) — hanya general dry cargo', on: ['AS', 'IS', 'SS'] as Col[] },
  roro: { code: 'F21.3.34-2013', title: 'Class Survey Additional Requirements for Class Annual and Renewal Surveys of Ro-Ro Ships — hanya kapal Ro-Ro', on: ['AS', 'SS'] as Col[] },
  ot4d: { code: 'F21.3.40-2023-REV.0', title: 'Periodical Survey for Automatic and Remote Controls of Propelling Machinery in Motor Vessel (OT-4D), bila ada', on: ['AS', 'SS'] as Col[] },
  ot4t: { code: 'F21.3.45-2013/Rev.0', title: 'Periodical Survey for Automatic and Remote Controls of Propelling Machinery in Turbine Vessel (OT-4T)', on: ['AS', 'SS'] as Col[] },
};

const EXTRA_OF_CAT: Record<string, FormRow[]> = {
  '1': [],
  '2': [X.refrig, X.boiler],
  '3': [X.refrig, X.boiler],
  '4': [X.closeup, X.boiler, X.refrig],
  '5': [X.boiler, X.roro, X.ot4d, X.ot4t, X.refrig],
  '6': [X.boiler, X.ot4d, X.ot4t, X.refrig],
  '7': [],
  '8': [X.boiler, X.roro, X.ot4d, X.ot4t, X.refrig],
  '9': [X.boiler, X.roro, X.ot4d, X.ot4t, X.refrig],
};

/** Form utama dan form tambahan untuk satu kategori dan satu kolom survey. */
export function formsFor(cat: string, col: Col): { main: FormRow[]; extra: FormRow[] } {
  const base = cat === '1' ? MAIN_PONTOON : MAIN_FULL;
  return {
    main: base.filter((r) => r.on.indexOf(col) >= 0),
    extra: (EXTRA_OF_CAT[cat] ?? []).filter((r) => r.on.indexOf(col) >= 0),
  };
}

/* ---------- dokumen lampiran pendukung ---------- */
export type Att = { id: string; label: string; cond?: string };
export type AttGroup = { id: string; title: string; items: Att[] };

export const ATT_GENERAL: Att[] = [
  { id: 'sert-bki', label: 'Sertifikat BKI (klas dan garis muat)' },
  { id: 'rfq', label: 'Permohonan survey (RFQ) / proposal CRM' },
  { id: 'sps', label: 'SPS' },
  { id: 'kunjungan', label: 'Daftar kunjungan survey' },
  { id: 'status-sebelum', label: 'Survey status sebelum di-update (IS/IPS)', cond: 'sesuai kondisi' },
];

/** Lampiran tambahan di luar lampiran umum, menurut kolom survey. */
export const ATT_BY_COL: Partial<Record<Col, Att[]>> = {
  AS: [],
  IS: [
    { id: 'megger', label: 'Laporan megger test' },
    { id: 'crankweb', label: 'Laporan crankweb deflection', cond: 'sesuai tipe crankshaft dan ada crankcase door-nya' },
    { id: 'daftar-mesin', label: 'Daftar peralatan mesin di kapal', cond: 'sesuai kondisi' },
  ],
  DS: [
    { id: 'laporan-dok', label: 'Laporan dok (tanggal naik dan turun)' },
    { id: 'kickoff', label: 'Kickoff meeting' },
    { id: 'clr-poros', label: 'Pengukuran clearance poros baling-baling', cond: 'sesuai kondisi' },
    { id: 'clr-rudder', label: 'Pengukuran clearance rudder stock', cond: 'sesuai kondisi' },
    { id: 'kalibrasi-rantai', label: 'Kalibrasi rantai jangkar', cond: 'jika dok SS / reclass' },
    { id: 'coating', label: 'Laporan coating', cond: 'sesuai kondisi' },
    { id: 'zinc', label: 'Laporan penggantian / penambahan zinc anode', cond: 'sesuai kondisi' },
  ],
  SS: [
    { id: 'gm-permanen', label: 'Sertifikat garis muat permanen baru' },
    { id: 'sert-sementara', label: 'Sertifikat sementara klas' },
    { id: 'sert-lama', label: 'Sertifikat lama' },
    { id: 'megger', label: 'Laporan megger test' },
    { id: 'crankweb', label: 'Laporan crankweb deflection', cond: 'sesuai tipe crankshaft dan ada crankcase door-nya' },
    { id: 'utm', label: 'Laporan UTM', cond: 'jika ada pengambilan UT' },
    { id: 'ndt-ramp', label: 'Laporan NDT (pad eyes of ramp door)', cond: 'khusus kapal ferry Ro-Ro' },
    { id: 'daftar-mesin', label: 'Daftar peralatan mesin di kapal' },
    { id: 'surat-laut', label: 'Surat laut' },
    { id: 'surat-ukur', label: 'Surat ukur (panjang kapal, GT, NT, pelabuhan pendaftaran, dll.) / gross akte (nama pemilik)' },
    { id: 'sert-keselamatan', label: 'Sertifikat keselamatan', cond: 'khusus pengangkut penumpang' },
  ],
  PS: [
    { id: 'ndt', label: 'Laporan NDT' },
    { id: 'lab-minyak', label: 'Laporan uji laboratorium minyak pelumas sistem poros baling-baling selama 1 tahun terakhir / sejak Metode 1 s.d. sekarang', cond: 'untuk Metode 2, 3 dan penundaan survey poros' },
    { id: 'clr-poros', label: 'Pengukuran clearance poros baling-baling' },
    { id: 'laporan-dok', label: 'Laporan dok (tanggal naik dan turun)' },
    { id: 'wear-down', label: 'Pengukuran keausan saat ini dari wear down gauge', cond: 'pelumasan minyak, Metode 2/3, bila ada wear down gauge' },
  ],
  EC: [],
  OS: [],
};

/** Lampiran konfirmasi (khusus saat laporan ke kantor pusat / penerbitan sertifikat). */
export const ATT_CONFIRM: Att[] = [
  { id: 'k-gm-permanen', label: 'Konfirmasi penerbitan sertifikat garis muat permanen' },
  { id: 'k-statutoria', label: 'Laporan general statutoria (F23.1.02)' },
  { id: 'k-garis-muat', label: 'Laporan garis muat (F23.2.10 / F23.2.11)' },
  { id: 'k-sert-lama', label: 'Sertifikat BKI (klas dan garis muat) lama' },
  { id: 'k-sert-sementara', label: 'Sertifikat sementara' },
  { id: 'k-foto', label: 'F21.3.63 (lampiran foto)' },
  { id: 'k-surat-laut', label: 'Surat laut / pas besar', cond: 'verifikasi nama kapal, nama pemilik, GT, NT, call sign, IMO no., pelabuhan pendaftaran' },
  { id: 'k-surat-ukur', label: 'Surat ukur / gross akte', cond: 'opsional, sesuai update data kapal' },
  { id: 'k-sert-keselamatan', label: 'Sertifikat keselamatan (kapal penumpang)', cond: 'terkait jumlah penumpang dan waktu dok (kargo 3 tahun, penumpang 1 tahun)' },
  { id: 'k-pelaksanaan', label: 'Konfirmasi pelaksanaan survey (item survey) / penundaan visa / kerusakan' },
  { id: 'k-ho', label: 'Konfirmasi HO' },
  { id: 'k-cap', label: 'Rencana perbaikan (lain-lain) / CAP' },
  { id: 'k-rekomendasi', label: 'F21.3.03 bila ada rekomendasi, pelaksanaan, penundaan visa, atau CAP' },
];

/** Pengujian / pengukuran / pemeriksaan relevan (dilampirkan sesuai lingkup survey yang dilaksanakan). */
export const ATT_TESTS: Att[] = [
  { id: 't-utm', label: 'Laporan UTM' },
  { id: 't-ndt', label: 'Laporan NDT (PT, MPT, UT flow, dll.)' },
  { id: 't-megger', label: 'Laporan megger test' },
  { id: 't-crankweb', label: 'Laporan crankweb deflection' },
  { id: 't-kalibrasi', label: 'Laporan kalibrasi rantai jangkar' },
  { id: 't-go', label: 'Laporan general overhaul ME, AE, dll.' },
  { id: 't-hydro', label: 'Laporan hydrotest / tight test' },
];

/** Kasus khusus: pilih bila berlaku pada agenda. */
export const SPECIAL: AttGroup[] = [
  {
    id: 'uwild',
    title: 'Survey UWILD (in-water survey)',
    items: [
      { id: 'uw-laporan', label: 'Laporan underwater' },
      { id: 'uw-nota', label: 'Nota dinas persetujuan underwater dari Flag' },
      { id: 'uw-joint', label: 'Laporan joint survey dengan Flag', cond: 'jika disyaratkan' },
    ],
  },
  {
    id: 'tunda-dok',
    title: 'Penundaan dok dan perpanjangan klas',
    items: [
      { id: 'td-nota-dok', label: 'Nota dinas persetujuan penundaan pengedokan' },
      { id: 'td-nota-sert', label: 'Nota dinas persetujuan perpanjangan sertifikat garis muat' },
      { id: 'td-sert-keselamatan', label: 'Sertifikat keselamatan yang masih valid' },
      { id: 'td-gm-ksop', label: 'Sertifikat garis muat terbitan KSOP setempat' },
      { id: 'td-joint', label: 'Laporan joint survey ditandatangani Flag', cond: 'jika disyaratkan' },
      { id: 'td-dock-space', label: 'Surat keterangan dock space' },
      { id: 'td-ho', label: 'Konfirmasi HO' },
    ],
  },
  {
    id: 'dok-antara',
    title: 'Dok antara (kapal < 15 tahun) / penundaan jatuh tempo dok (> 36 bulan) dengan underwater',
    items: [
      { id: 'da-uw', label: 'Laporan underwater' },
      { id: 'da-nota', label: 'Nota dinas persetujuan dari Flag (penundaan pengedokan / persetujuan UWILD)' },
      { id: 'da-clr', label: 'Pengukuran clearance poros baling-baling', cond: 'jika disyaratkan' },
      { id: 'da-ho', label: 'Konfirmasi HO' },
      { id: 'da-joint', label: 'Laporan joint survey ditandatangani Flag', cond: 'jika disyaratkan' },
    ],
  },
  {
    id: 'tunda-poros',
    title: 'Survey penundaan poros baling-baling',
    items: [
      { id: 'tp-clr', label: 'Laporan pengukuran clearance poros baling-baling untuk sistem terbuka pelumasan air (Metode 4), lebih dari 3 bulan s.d. 1 tahun' },
      { id: 'tp-lab', label: 'Pelumasan minyak: analisa minyak pelumas berkala setiap 6 bulan (setahun terakhir) dan saat survey dilaksanakan' },
      { id: 'tp-review', label: 'Review dokumen terkait (laporan dok terakhir, deck log book, dll.) agar tidak ada perbaikan / kerusakan poros dan baling-baling dengan gerinda atau pengelasan', cond: 'surat pernyataan nakhoda sejak survey poros terakhir sampai sekarang' },
    ],
  },
  {
    id: 'poros-m23',
    title: 'Survey poros baling-baling (Metode 2 dan 3)',
    items: [
      { id: 'p23-lab', label: 'Pelumasan minyak: analisa minyak pelumas berkala (setiap 6 bulan) sejak Metode 1/2/3 terakhir s.d. sekarang' },
      { id: 'p23-review', label: 'Review dokumen terkait (laporan dok terakhir, deck log book, dll.), surat pernyataan nakhoda' },
      { id: 'p23-wear', label: 'Pengukuran keausan saat ini dari wear down gauge', cond: 'bila ada wear down gauge' },
    ],
  },
  {
    id: 'ganti-pemilik',
    title: 'Penggantian nama pemilik',
    items: [
      { id: 'gp-akte', label: 'Gross akte' },
      { id: 'gp-laut', label: 'Surat laut / pas besar (ter-update)' },
    ],
  },
  {
    id: 'update-data',
    title: 'Update data kapal (panjang, pelabuhan pendaftaran, GT, NT, call sign, IMO no., nama kapal)',
    items: [
      { id: 'ud-laut', label: 'Surat laut / pas besar (ter-update)' },
      { id: 'ud-ukur', label: 'Surat ukur' },
      { id: 'ud-foto', label: 'F21.3.63', cond: 'terkait perubahan nama kapal dan pelabuhan pendaftaran' },
    ],
  },
  {
    id: 'tunda-go',
    title: 'Penundaan general overhaul ME / AE',
    items: [
      { id: 'go-manual', label: 'Operation & maintenance manual' },
      { id: 'go-foto', label: 'F21.3.63 (foto running hours mesin saat ini)' },
      { id: 'go-laporan', label: 'Laporan general overhaul lengkap terakhir' },
      { id: 'go-periksa', label: 'Hasil pemeriksaan engine saat ini / dalam 1 bulan sebelumnya oleh engine maker (atau yang diotorisasi)' },
      { id: 'go-statement', label: 'Statement dari engine maker (atau yang diotorisasi)' },
      { id: 'go-plan', label: 'Action plan pemilik untuk pelaksanaan overhaul, dibuktikan dengan proses order layanan dan pengadaan spare part' },
      { id: 'go-ho', label: 'Konfirmasi BKI HO' },
    ],
  },
  {
    id: 'modifikasi',
    title: 'Perubahan notasi / modifikasi / perubahan IPLT',
    items: [
      { id: 'mod-sert', label: 'Konfirmasi persetujuan penerbitan sertifikat sementara' },
      { id: 'mod-f9', label: 'F23.2.01 / F23.2.02 (F9)' },
      { id: 'mod-f2145', label: 'F21.2.45 — List of Drawing Status and Reply Comment' },
      { id: 'mod-mohon', label: 'Permohonan modifikasi' },
      { id: 'mod-pnbp', label: 'Bukti bayar PNBP' },
      { id: 'mod-ba', label: 'Berita acara pemasangan lambung timbul ditandatangani Flag' },
      { id: 'mod-laut', label: 'Surat laut' },
      { id: 'mod-ukur', label: 'Surat ukur / gross akte' },
      { id: 'mod-form', label: 'Form laporan penerimaan klas lainnya yang relevan' },
    ],
  },
];

/** Lampiran lain-lain yang dianggap relevan dengan jenis survey (pilihan bebas). */
export const ATT_OTHER: Att[] = [
  { id: 'o-approval', label: 'Dokumen approval (laid-up plan, IW plan, CMPS plan, conveyance plan)' },
  { id: 'o-type', label: 'Sertifikat type approved' },
  { id: 'o-material', label: 'Sertifikat material' },
  { id: 'o-komponen', label: 'Sertifikat komponen' },
  { id: 'o-manufacture', label: 'Sertifikat manufacture' },
  { id: 'o-welder', label: 'Sertifikat welder' },
  { id: 'o-wps', label: 'WPS' },
  { id: 'o-lintas', label: 'Surat persetujuan lintas wilayah' },
  { id: 'o-kondisional', label: 'Sertifikat kondisional' },
  { id: 'o-conveyance', label: 'Sertifikat conveyance' },
  { id: 'o-kecelakaan', label: 'Laporan kecelakaan' },
  { id: 'o-polisi', label: 'Surat kehilangan dari kepolisian' },
  { id: 'o-bollard', label: 'Laporan bollard pull' },
  { id: 'o-cms', label: 'CMS confirmatory' },
  { id: 'o-maker', label: 'Engine maker manual' },
  { id: 'o-offshore', label: 'Lampiran offshore (permohonan modifikasi, surat pernyataan, kuitansi PNBP, konfirmasi BKI HO)' },
];
