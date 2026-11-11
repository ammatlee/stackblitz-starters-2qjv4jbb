import { describe, expect, it } from 'vitest';
import { CODE_COND, DRAWING_COLS, DRAWING_COL_LABEL, DRAWING_GROUPS, DRAWING_GROUP_LABEL, DRAWING_ROWS } from '../lib/drawingList';
import type { DrawingCol } from '../lib/drawingList';
import {
  DRAWING_STATUSES,
  asDrawingCol,
  countsInProgress,
  drawingProgress,
  drawingSummary,
  drawingsFor,
  groupsOf,
  needsFlashPoint,
  openRequired,
  parseDrawingCell,
  resolveDrawingCol,
} from '../lib/newbuildingDrawings';
import type { DrawingStatus } from '../lib/newbuildingDrawings';
import { STAGES, applicableItems, stageProgress } from '../lib/newbuildingStages';
import { VESSEL_TYPES, isNonPropelled } from '../lib/vesselTypes';
import { vesselProfile } from '../lib/materialRules';

/** Jumlah gambar per kolom sesuai file "Daftar gambar wajib BKI Rev.03" yang sudah dicek: [semua, wajib, bersyarat, jika ada]. */
const GOLDEN: Record<DrawingCol, [number, number, number, number]> = {
  TUG: [52, 31, 8, 13],
  PONTOON: [13, 10, 3, 0],
  OIL_TANKER: [76, 40, 16, 20],
  CHEM_TANKER: [75, 40, 15, 20],
  BARGE_A: [32, 23, 4, 5],
  BARGE_B: [37, 27, 4, 6],
  BARGE_C: [55, 34, 10, 11],
  BARGE_D: [60, 38, 11, 11],
  BARGE_E: [33, 21, 8, 4],
  BARGE_F: [52, 32, 16, 4],
  LCT: [58, 34, 12, 12],
  GENERAL_CARGO: [67, 36, 15, 16],
  BULK_CARRIER: [69, 36, 15, 18],
  CONTAINER: [67, 37, 15, 15],
  RORO_CARGO: [72, 41, 12, 19],
  PASSENGER: [70, 40, 12, 18],
  RORO_PASSENGER: [73, 43, 12, 18],
  GAS_CARRIER: [77, 44, 14, 19],
  DREDGER: [54, 24, 12, 18],
  SUPPLY: [61, 33, 15, 13],
  FISHING: [51, 27, 7, 17],
  FPSO: [77, 53, 11, 13],
  FSO: [78, 40, 11, 27],
};

const row = (key: string, status: DrawingStatus): [string, { status: DrawingStatus }] => [key, { status }];

describe('Data gambar BKI Rev.03', () => {
  it('jumlah gambar per kolom sama dengan dokumen yang sudah dicek (menjaga salinan tidak terpotong)', () => {
    for (const c of DRAWING_COLS) {
      const l = drawingsFor(c);
      const n = (r: string) => l.filter((d) => d.req === r).length;
      expect([c, l.length, n('M'), n('C'), n('O')]).toEqual([c, ...GOLDEN[c]]);
    }
  });

  it('semua sel terbaca, setiap gambar bersyarat punya syarat, dan nomor tidak ganda dalam satu kolom', () => {
    for (const [, , , cells] of DRAWING_ROWS) for (const v of Object.values(cells)) expect(() => parseDrawingCell(v as string)).not.toThrow();
    for (const c of DRAWING_COLS) {
      const l = drawingsFor(c);
      expect(new Set(l.map((d) => d.key)).size).toBe(l.length);
      for (const d of l.filter((x) => x.req === 'C')) expect(d.cond, `${c} ${d.no}`).toBeTruthy();
    }
  });

  it('kolom dan kelompok yang dipakai baris data semuanya terdaftar', () => {
    for (const [, , g, cells] of DRAWING_ROWS) {
      expect(DRAWING_GROUPS).toContain(g);
      for (const c of Object.keys(cells)) expect(DRAWING_COLS).toContain(c);
    }
    for (const c of DRAWING_COLS) expect(DRAWING_COL_LABEL[c]).toBeTruthy();
    for (const g of DRAWING_GROUPS) expect(DRAWING_GROUP_LABEL[g]).toBeTruthy();
    expect(DRAWING_COLS).toHaveLength(23);
  });

  it('kode bersyarat tongkang punya keterangan', () => {
    for (const c of DRAWING_COLS.filter((x) => x.startsWith('BARGE_'))) for (const d of drawingsFor(c).filter((x) => x.code)) expect(CODE_COND[d.code as string], d.code as string).toBeTruthy();
  });

  it('contoh isi: tugboat', () => {
    const tug = drawingsFor('TUG');
    const get = (no: string) => tug.find((d) => d.no === no);
    expect(get('1')?.req).toBe('M');
    expect(get('16.2')).toMatchObject({ req: 'C', code: 'M2', cond: 'jika terpasang di kapal' });
    expect(get('76')).toMatchObject({ req: 'C', code: 'O12' });
    expect(get('51')).toMatchObject({ req: 'O', cond: 'opsional' });
    expect(get('11')).toBeUndefined();
    expect(drawingsFor('PONTOON').find((d) => d.no === '11')).toMatchObject({ code: 'M1', cond: 'jika L ≥ 90 m untuk Pontoon' });
  });

  it('contoh isi: tongkang memakai keterangan kode dan judul khusus', () => {
    const f = drawingsFor('BARGE_F');
    expect(f.find((d) => d.no === '10')).toMatchObject({ req: 'C', code: 'M2', cond: 'jika terpasang di kapal' });
    expect(f.find((d) => d.no === '76')?.title).toBe('Torsional Vibration Analysis');
    expect(drawingsFor('OIL_TANKER').find((d) => d.no === '76')?.title).toBe('Torsional Vibration Analysis, kapal < 2 tahun');
    expect(drawingsFor('BARGE_A').find((d) => d.no === '100')?.title).toBe('Oil Cargo / Gas Cargo System');
    expect(drawingsFor('BARGE_A').some((d) => d.no === '7')).toBe(false);
    expect(drawingsFor('BARGE_D').some((d) => d.no === '7')).toBe(true);
  });

  it('contoh isi: LCT punya daftar sendiri (kolom 29 PDF), berbeda dari Barge F', () => {
    const l = drawingsFor('LCT');
    const get = (no: string) => l.find((d) => d.no === no);
    expect(get('13')?.req).toBe('M');
    expect(get('16.6')?.req).toBe('M');
    expect(get('46')?.req).toBe('O');
    expect(get('11')).toMatchObject({ req: 'C', code: 'M1' });
    expect(get('10')).toBeUndefined();
    expect(get('124')).toBeUndefined();
    expect(get('136')).toBeUndefined();
  });

  it('kelompok mengikuti nomor gambar dan hanya kelompok yang berisi yang tampil', () => {
    expect(groupsOf(drawingsFor('PONTOON'))).toEqual(['hull', 'stab']);
    expect(groupsOf(drawingsFor('TUG'))).toEqual(['hull', 'stab', 'elec', 'mach', 'stat']);
  });
});

describe('Memilih kolom BKI dari data proyek', () => {
  const pick = (vesselType: string, propelled: boolean, fpAbove60: boolean | null = null, override: string | null = null) => resolveDrawingCol({ vesselType, propelled, fpAbove60, override });

  it('tugboat dan anchor handling tug = TUG', () => {
    expect(pick('Tugboat', true).col).toBe('TUG');
    expect(pick('Anchor Handling Tug', true).col).toBe('TUG');
  });
  it('pontoon dan tanker', () => {
    expect(pick('Pontoon', false).col).toBe('PONTOON');
    expect(pick('Oil Tanker', true).col).toBe('OIL_TANKER');
    expect(pick('Chemical Tanker', true).col).toBe('CHEM_TANKER');
  });
  it('oil barge dan SPOB ditentukan flash point dan penggerak', () => {
    expect(pick('Oil Barge', false, true).col).toBe('BARGE_A');
    expect(pick('Oil Barge', false, false).col).toBe('BARGE_B');
    expect(pick('SPOB', true, true).col).toBe('BARGE_C');
    expect(pick('SPOB', true, false).col).toBe('BARGE_D');
    expect(pick('Oil Barge', true, false).col).toBe('BARGE_D');
  });
  it('flash point belum diisi: kolom belum bisa ditentukan dan aplikasi diminta menanyakannya', () => {
    expect(pick('Oil Barge', false, null)).toEqual({ col: null, needFlashPoint: true });
    expect(pick('SPOB', true, null)).toEqual({ col: null, needFlashPoint: true });
    expect(pick('Barge', false, null)).toEqual({ col: 'BARGE_E', needFlashPoint: false });
  });
  it('barge lain: tanpa penggerak = E, berpenggerak = F', () => {
    expect(pick('Barge', false).col).toBe('BARGE_E');
    expect(pick('Crane Barge', false).col).toBe('BARGE_E');
    expect(pick('Accommodation Barge', false).col).toBe('BARGE_E');
    expect(pick('Barge', true).col).toBe('BARGE_F');
    expect(pick('LCT', true).col).toBe('LCT');
    expect(pick('Landing Craft Tank', true).col).toBe('LCT');
  });
  it('jenis buatan sendiri: yang jelas terbaca (barge, kapal ikan), yang lain menunggu pilihan manual', () => {
    expect(pick('Chemical Barge', false, false).col).toBe('BARGE_B');
    expect(pick('Tongkang Batubara', false).col).toBe('BARGE_E');
    expect(pick('Kapal Ikan Baru', true).col).toBe('FISHING');
    expect(pick('Kapal Survei', true).col).toBeNull();
    expect(pick('', true).col).toBeNull();
  });
  it('pilihan manual mengalahkan otomatis; nilai database yang tidak dikenal diabaikan', () => {
    expect(pick('General Cargo', true, null, 'TUG').col).toBe('TUG');
    expect(pick('Oil Barge', false, null, 'BARGE_A')).toEqual({ col: 'BARGE_A', needFlashPoint: false });
    expect(pick('Tugboat', true, null, 'XYZ').col).toBe('TUG');
    expect(asDrawingCol('BARGE_C')).toBe('BARGE_C');
    expect(asDrawingCol('barge_c')).toBeNull();
    expect(asDrawingCol(null)).toBeNull();
  });
  it('isian flash point hanya diminta untuk SPOB, oil barge, dan chemical barge', () => {
    for (const t of ['SPOB', 'Oil Barge', 'Chemical Barge']) expect(needsFlashPoint(t), t).toBe(true);
    for (const t of ['Barge', 'Oil Tanker', 'Tugboat', 'Accommodation Barge', '', null, undefined]) expect(needsFlashPoint(t), String(t)).toBe(false);
  });
});

describe('Sinkron dengan modul lain', () => {
  /** Jenis kapal bawaan yang memang belum punya daftar gambar BKI (kosong: semua jenis bawaan sudah punya kolom). */
  const BELUM_ADA_DAFTAR: string[] = [];

  it('setiap jenis kapal di vesselTypes.ts sudah diputuskan: punya kolom BKI atau tercatat belum ada daftarnya', () => {
    for (const t of VESSEL_TYPES) {
      const col = resolveDrawingCol({ vesselType: t, propelled: !isNonPropelled(t), fpAbove60: true }).col;
      if (BELUM_ADA_DAFTAR.includes(t)) expect(col, `${t} ternyata sudah punya kolom: hapus dari BELUM_ADA_DAFTAR`).toBeNull();
      else expect(col, `${t} belum punya kolom BKI: tambahkan aturannya di resolveDrawingCol atau masukkan ke BELUM_ADA_DAFTAR`).not.toBeNull();
    }
  });

  it('TUG dipilih persis ketika pelacak material juga menganggap kapal itu tugboat', () => {
    for (const t of VESSEL_TYPES) {
      for (const propelled of [true, false]) {
        const isTug = vesselProfile({ vesselType: t, propelled }) === 'tug';
        expect(resolveDrawingCol({ vesselType: t, propelled, fpAbove60: true }).col === 'TUG', `${t} propelled=${propelled}`).toBe(isTug);
      }
    }
  });

  it('nilai status sama dengan check di SQL nb_drawing_status', () => {
    expect(DRAWING_STATUSES).toEqual(['open', 'closed', 'tidak_ada']);
  });

  it('item pintasan pelacak gambar di tahap 2 tidak dihitung ke progress dan tidak mengubah item lain', () => {
    const s = STAGES.find((x) => x.key === 'drawing')!;
    const ctx = { tipe: 'B' as const, propelled: true };
    expect(s.items.some((it) => it.drawing)).toBe(true);
    expect(applicableItems(s, ctx).length).toBe(s.items.length);
    expect(stageProgress(s, ctx, new Map()).total).toBe(s.items.filter((it) => !it.drawing && !it.material).length);
  });
});

describe('Progress pelacak gambar', () => {
  const tug = drawingsFor('TUG');

  it('tanpa catatan: semua gambar yang dihitung berstatus Open, gambar "jika ada" tidak dihitung', () => {
    const p = drawingProgress(tug, new Map());
    expect(p).toEqual({ total: 39, closed: 0, open: 39, tidakAda: 0, pct: 0 });
    expect(tug.filter((d) => !countsInProgress(d)).length).toBe(13);
  });

  it('Closed menambah progress, N/A dikeluarkan dari pembagi', () => {
    const rows = new Map([row('1', 'closed'), row('2', 'closed'), row('16.2', 'tidak_ada'), row('19', 'tidak_ada')]);
    expect(drawingProgress(tug, rows)).toEqual({ total: 37, closed: 2, open: 35, tidakAda: 2, pct: 5 });
  });

  it('baris untuk nomor yang bukan bagian daftar ini (mis. setelah ganti jenis kapal) diabaikan', () => {
    const rows = new Map([row('7', 'closed'), row('999', 'closed')]); // Engine Foundation tidak ada di daftar Pontoon
    expect(drawingProgress(drawingsFor('PONTOON'), rows).closed).toBe(0);
  });

  it('gambar "jika ada" yang sudah Closed tidak menaikkan progress', () => {
    const rows = new Map([row('51', 'closed')]);
    expect(drawingProgress(tug, rows).closed).toBe(0);
  });

  it('penanda Commencement: hanya gambar dihitung yang masih Open', () => {
    const rows = new Map(tug.filter(countsInProgress).map((d) => row(d.key, 'closed')));
    expect(openRequired(tug, rows)).toHaveLength(0);
    rows.set('7', { status: 'open' });
    expect(openRequired(tug, rows).map((d) => d.no)).toEqual(['7']);
    expect(drawingProgress(tug, rows).pct).toBe(97);
  });

  it('daftar kosong tidak membagi nol', () => {
    expect(drawingProgress([], new Map()).pct).toBe(0);
  });
});

describe('Kolom jenis kapal lain (dibaca dari PDF kolom 1, 3, 6–9, 17, 22, 23, 27, 44, 46)', () => {
  const pick = (vesselType: string, propelled = true) => resolveDrawingCol({ vesselType, propelled, fpAbove60: null, override: null }).col;

  it('setiap jenis kapal bawaan memilih kolomnya', () => {
    expect(pick('General Cargo')).toBe('GENERAL_CARGO');
    expect(pick('Bulk Carrier')).toBe('BULK_CARRIER');
    expect(pick('Container Ship')).toBe('CONTAINER');
    expect(pick('Passenger Ship')).toBe('PASSENGER');
    expect(pick('Ro-Ro Passenger Ship')).toBe('RORO_PASSENGER');
    expect(pick('Ro-Ro Cargo Ship')).toBe('RORO_CARGO');
    expect(pick('Gas Carrier')).toBe('GAS_CARRIER');
    expect(pick('Supply Vessel (PSV/OSV)')).toBe('SUPPLY');
    expect(pick('Fishing Vessel')).toBe('FISHING');
    expect(pick('Dredger')).toBe('DREDGER');
    expect(pick('FSO / FPSO')).toBe('FPSO');
  });

  it('FSO saja memakai kolom FSO; barge dan tanker tetap seperti semula', () => {
    expect(pick('FSO')).toBe('FSO');
    expect(pick('Crane Barge', false)).toBe('BARGE_E');
    expect(pick('Oil Tanker')).toBe('OIL_TANKER');
  });

  it('contoh isi: gas carrier, fishing, FPSO', () => {
    const gas = drawingsFor('GAS_CARRIER');
    expect(gas.find((d) => d.no === '106')?.req).toBe('M');
    expect(gas.find((d) => d.no === '107')?.req).toBe('M');
    expect(drawingsFor('BULK_CARRIER').find((d) => d.no === '106')).toBeUndefined();
    expect(drawingsFor('FISHING').find((d) => d.no === '34')).toMatchObject({ req: 'C', code: 'M4' });
    expect(drawingsFor('FISHING').find((d) => d.no === '81')).toMatchObject({ req: 'C', code: 'O15', cond: 'jika L > 24 m' });
    const fpso = drawingsFor('FPSO');
    expect(fpso.find((d) => d.no === '63')).toMatchObject({ req: 'C', code: 'O13' });
    expect(fpso.find((d) => d.no === '41')?.req).toBe('M');
    expect(drawingsFor('FSO').find((d) => d.no === '41')?.req).toBe('O');
  });

  it('kapal kargo: bottom damage bersyarat dengan keterangan double bottom', () => {
    const d = drawingsFor('GENERAL_CARGO').find((x) => x.no === '40');
    expect(d).toMatchObject({ req: 'C', code: 'M3' });
    expect(d?.cond).toContain('double bottom');
  });
});

describe('Ringkasan untuk halaman Tahapan', () => {
  const base = { vesselType: 'Tugboat', propelled: true, fpAbove60: null };

  it('tugboat tanpa catatan: semua gambar yang dihitung masih Open', () => {
    const s = drawingSummary(base, new Map());
    expect(s.col).toBe('TUG');
    expect(s.progress.total).toBe(39);
    expect(s.open).toBe(39);
  });

  it('semua gambar yang dihitung Closed: tidak ada yang Open', () => {
    const rows = new Map(drawingsFor('TUG').filter(countsInProgress).map((d) => row(d.key, 'closed')));
    const s = drawingSummary(base, rows);
    expect(s.open).toBe(0);
    expect(s.progress.pct).toBe(100);
  });

  it('flash point belum diisi: belum ada daftar, tidak ada peringatan', () => {
    const s = drawingSummary({ vesselType: 'Oil Barge', propelled: false, fpAbove60: null }, new Map());
    expect(s).toEqual({ col: null, needFlashPoint: true, progress: { total: 0, closed: 0, open: 0, tidakAda: 0, pct: 0 }, open: 0 });
  });
});
