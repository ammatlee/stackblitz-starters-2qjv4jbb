import type { MatTipe } from './materialRules';

/** Status satu item tahapan. Item tanpa baris di database = 'belum'. */
export type StageStatus = 'belum' | 'selesai' | 'tidak_ada';

export const STAGE_STATUSES: StageStatus[] = ['belum', 'selesai', 'tidak_ada'];

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  belum: 'Belum',
  selesai: 'Selesai',
  tidak_ada: 'N/A',
};

/** Baris tabel nb_stage_status (kolom yang dipakai). */
export type StageRow = {
  item_key: string;
  status: StageStatus;
  done_date: string | null;
  note: string | null;
};

/** Data proyek yang menentukan item mana yang berlaku. */
export type StageCtx = { tipe: MatTipe | null; propelled: boolean };

export type StageItem = {
  key: string;
  label: string;
  hint?: string;
  /** Item hanya tampil bila fungsi ini true (bawaan: selalu tampil). */
  applies?: (c: StageCtx) => boolean;
  /** Item pintasan ke pelacak material: tidak punya status sendiri dan tidak dihitung di progress. */
  material?: boolean;
  /** Item pintasan ke pelacak gambar: sama seperti material, tidak punya status sendiri dan tidak dihitung di progress. */
  drawing?: boolean;
};

export type Stage = {
  key: string;
  /** Kode tampilan, mis. "1", "3A". */
  code: string;
  title: string;
  /** Judul kelompok bersama (tahap 3A–3E berada di bawah "Survey & certification"). */
  group?: string;
  items: StageItem[];
};

const SURVEY = 'Survey & certification';

export const STAGES: Stage[] = [
  {
    key: 'contract',
    code: '1',
    title: 'Contract stage',
    items: [
      { key: 'permohonan', label: 'Permohonan survei dan klasifikasi dari owner diterima' },
      { key: 'dokumen', label: 'Dokumen pendukung permohonan lengkap' },
      { key: 'persetujuan', label: 'Permohonan disetujui / kontrak klas disepakati' },
    ],
  },
  {
    key: 'drawing',
    code: '2',
    title: 'Document & drawing examination',
    items: [
      {
        key: 'tracker',
        label: 'Status per gambar dan dokumen',
        hint: 'Open, Closed, atau N/A untuk setiap gambar dicatat di pelacak gambar.',
        drawing: true,
      },
      { key: 'diajukan', label: 'Gambar dan dokumen diajukan ke BKI' },
      { key: 'disetujui', label: 'Gambar dan dokumen disetujui (approval)' },
    ],
  },
  {
    key: 'commencement',
    code: '3A',
    title: 'Commencement',
    group: SURVEY,
    items: [
      { key: 'kickoff', label: 'Kick-off meeting' },
      { key: 'shipyard', label: 'Shipyard review record diverifikasi' },
      { key: 'itp', label: 'ITP (Inspection and Test Plan) diverifikasi' },
      { key: 'tanktest', label: 'Tank test plan diverifikasi' },
      { key: 'ndt', label: 'NDT plan diverifikasi' },
      {
        key: 'material',
        label: 'Sertifikat material, komponen, dan dokumen pengelasan',
        hint: 'Welding shop approval, WPS, welder certificate, dan welding consumable dicatat di pelacak material.',
        material: true,
      },
    ],
  },
  {
    key: 'fabrication',
    code: '3B',
    title: 'Fabrication',
    group: SURVEY,
    items: [
      { key: 'fitup', label: 'Fit up' },
      { key: 'visual', label: 'Pemeriksaan visual' },
      { key: 'leaktest', label: 'Leak test' },
      { key: 'structtest', label: 'Structural test' },
    ],
  },
  {
    key: 'keel',
    code: '3C',
    title: 'Keel laying',
    group: SURVEY,
    items: [{ key: 'keel', label: 'Keel laying' }],
  },
  {
    key: 'commissioning',
    code: '3D',
    title: 'Commissioning, launching, load test, sea trial',
    group: SURVEY,
    items: [
      { key: 'commissioning', label: 'Commissioning' },
      { key: 'launching', label: 'Launching' },
      { key: 'loadtest', label: 'Load test' },
      { key: 'seatrial', label: 'Sea trial', hint: 'Hanya untuk kapal dengan penggerak.', applies: (c) => c.propelled },
    ],
  },
  {
    key: 'completion',
    code: '3E',
    title: 'Completion',
    group: SURVEY,
    items: [{ key: 'completion', label: 'Completion' }],
  },
  {
    key: 'certificate',
    code: '4',
    title: 'Sertifikasi',
    items: [
      { key: 'interim', label: 'Interim certificate' },
      { key: 'final', label: 'Final survey report' },
      { key: 'permanent', label: 'Permanent certificate' },
    ],
  },
];

/** Penanda unik item di database: "<tahap>.<item>", mis. "commencement.itp". */
export const stageItemKey = (s: Stage, it: StageItem): string => `${s.key}.${it.key}`;

/** Item tahap yang berlaku untuk proyek ini (termasuk pintasan material). */
export const applicableItems = (s: Stage, c: StageCtx): StageItem[] => s.items.filter((it) => !it.applies || it.applies(c));

/** Jumlah item di semua tahap yang disembunyikan karena tidak berlaku. */
export const hiddenItemCount = (c: StageCtx): number => STAGES.reduce((n, s) => n + s.items.length - applicableItems(s, c).length, 0);

export type StageProgress = { total: number; selesai: number; tidakAda: number; pct: number };

const tally = (stages: Stage[], c: StageCtx, rows: Map<string, StageRow>): StageProgress => {
  let count = 0;
  let selesai = 0;
  let tidakAda = 0;
  for (const s of stages) {
    for (const it of applicableItems(s, c)) {
      if (it.material || it.drawing) continue;
      count += 1;
      const st = rows.get(stageItemKey(s, it))?.status ?? 'belum';
      if (st === 'selesai') selesai += 1;
      else if (st === 'tidak_ada') tidakAda += 1;
    }
  }
  const total = count - tidakAda;
  return { total, selesai, tidakAda, pct: total > 0 ? Math.round((selesai / total) * 100) : 0 };
};

/** Progress satu tahap: item N/A tidak dihitung ke total. */
export const stageProgress = (s: Stage, c: StageCtx, rows: Map<string, StageRow>): StageProgress => tally([s], c, rows);

/** Progress seluruh tahapan. */
export const overallProgress = (c: StageCtx, rows: Map<string, StageRow>): StageProgress => tally(STAGES, c, rows);

/** Tahap dianggap selesai bila semua item yang berlaku sudah selesai atau N/A. */
export const isStageDone = (s: Stage, c: StageCtx, rows: Map<string, StageRow>): boolean => {
  const p = stageProgress(s, c, rows);
  return p.selesai === p.total;
};

/** Tahap pertama yang belum selesai (null bila semuanya selesai). */
export const firstOpenStage = (c: StageCtx, rows: Map<string, StageRow>): Stage | null => STAGES.find((s) => !isStageDone(s, c, rows)) ?? null;
