import { describe, it, expect } from 'vitest';
import { RENEWAL, INTERMEDIATE, NA_UNPROPELLED, applicability } from '../lib/classValidity/surveyRules';
import { ATT_BY_COL, ATT_TESTS } from '../lib/reportDocs';

describe('Renewal memuat pengukuran mesin/listrik (BKI 1.3.2.1 → 1.2.2.5A)', () => {
  const crank = RENEWAL.find((i) => i.s === 'Crank Web Deflection');
  const megger = RENEWAL.find((i) => i.s === 'Insulation Resistance (Megger)');
  it('item crank web dan megger ada di checklist Renewal', () => {
    expect(crank).toBeDefined();
    expect(megger).toBeDefined();
  });
  it('item baru ditaruh di akhir: nomor item lama tidak bergeser (RN-0 … RN-14)', () => {
    expect(RENEWAL.slice(0, 15).map((i) => i.s)).toEqual([
      'Schedule & Planning', 'Survey Crediting', 'Hull, Equipment & Piping', 'Underwater Parts', 'Anchors & Chain Cables',
      'Internal Spaces', 'Engine-Room Structure', 'Ballast-Tank Coating', 'Tank Pressure Tests', 'Cargo Hatch Covers & Coamings',
      'Thickness Measurements', 'Bilge & Ballast Piping', 'Automatic Air Pipe Heads', 'Towing Winch Emergency Release', 'Certificate Period',
    ]);
    const names = RENEWAL.map((i) => i.s);
    expect(names.indexOf('Crank Web Deflection')).toBeGreaterThan(14);
    expect(names.indexOf('Insulation Resistance (Megger)')).toBeGreaterThan(14);
  });
  it('crank web tidak berlaku untuk kapal tanpa penggerak, megger tetap tampil', () => {
    expect(NA_UNPROPELLED).toContain('Crank Web Deflection');
    expect(NA_UNPROPELLED).not.toContain('Insulation Resistance (Megger)');
  });
  it('berlaku untuk semua jenis kapal dan umur (bukan N/A)', () => {
    for (const vt of ['Tugboat', 'General Cargo', 'Barge']) for (const age of [3, 12, 22, null]) {
      expect(applicability(crank!.a, crank!.g, vt, age)).not.toBe('N/A');
      expect(applicability(megger!.a, megger!.g, vt, age)).not.toBe('N/A');
    }
  });
  it('Intermediate tetap memuat Machinery Measurements', () => expect(INTERMEDIATE.some((i) => i.s === 'Machinery Measurements')).toBe(true));
});

describe('Modul Dokumen: lampiran megger & crankweb untuk Renewal (SS) dan Intermediate (IS)', () => {
  it.each(['IS', 'SS'] as const)('%s memuat megger dan crankweb', (col) => {
    const ids = (ATT_BY_COL[col] ?? []).map((a) => a.id);
    expect(ids).toContain('megger');
    expect(ids).toContain('crankweb');
  });
  it('crankweb hanya untuk kapal bermesin penggerak; megger punya keterangan kapal tanpa penggerak', () => {
    for (const col of ['IS', 'SS'] as const) {
      const list = ATT_BY_COL[col] ?? [];
      expect(list.find((a) => a.id === 'crankweb')?.onlyPropelled).toBe(true);
      expect(list.find((a) => a.id === 'megger')?.onlyPropelled).toBeFalsy();
      expect(list.find((a) => a.id === 'megger')?.condNp).toMatch(/instalasi listrik/);
    }
    expect(ATT_TESTS.find((a) => a.id === 't-crankweb')?.onlyPropelled).toBe(true);
  });
});
