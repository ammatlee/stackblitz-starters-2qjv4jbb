import { describe, it, expect } from 'vitest';
import { computeStatus } from '../lib/classValidity/statusCalc';
import type { SurveyKey } from '../lib/classValidity/surveyRules';
import { BASE, CASES, REAL_CASES } from './fixtures/cases';

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

// Grup kosong dilewati: vitest menganggap describe tanpa tes sebagai error (REAL_CASES sengaja kosong sampai kasus nyata diisi).
const GROUPS: [string, typeof CASES][] = [['sintetis', CASES], ['nyata', REAL_CASES]];
describe.each(GROUPS.filter(([, l]) => l.length > 0))('computeStatus — kasus %s', (_n, list) => {
  for (const c of list) {
    it(`${c.id}: ${c.title}`, () => {
      const r = computeStatus({ ...BASE, ...c.input });
      expect(r.overall).toBe(c.expect.overall);
      expect(r.c).toBe(c.expect.scenario);
      if (c.expect.recSt !== undefined) expect(r.recSt).toBe(c.expect.recSt);
      for (const [k, st] of Object.entries(c.expect.statuses ?? {})) {
        const key = k as SurveyKey;
        const got = r.rows.find((x) => x.key === key)?.status ?? r.implied.find((x) => x.key === key)?.status;
        expect(`${key}=${got}`).toBe(`${key}=${st}`);
      }
      if (c.expect.newPeriod !== undefined) {
        if (c.expect.newPeriod === null) expect(r.newPeriod).toBeNull();
        else {
          expect(iso(r.newPeriod?.start)).toBe(c.expect.newPeriod.start);
          expect(iso(r.newPeriod?.expiry)).toBe(c.expect.newPeriod.expiry);
        }
      }
      if (c.expect.shiftTo !== undefined) {
        if (c.expect.shiftTo === null) expect(r.shift?.shifted ?? false).toBe(false);
        else {
          expect(r.shift?.shifted).toBe(true);
          expect([r.shift?.nd, r.shift?.nm]).toEqual(c.expect.shiftTo);
        }
      }
    });
  }
});

it.todo('isi REAL_CASES di tests/fixtures/cases.ts dengan kasus kapal nyata (hasil yang sudah diverifikasi)');

describe('computeStatus — window survei (kapal rekaan, expiry 15 Mar 2028)', () => {
  const w = computeStatus({ ...BASE, compDate: '2024-02-05', startDate: '2024-02-01' }).win;
  it('Annual 1–3', () => {
    expect([iso(w.A1?.start), iso(w.A1?.end)]).toEqual(['2023-12-15', '2024-06-15']);
    expect([iso(w.A2?.start), iso(w.A2?.end)]).toEqual(['2024-12-15', '2025-06-15']);
    expect([iso(w.A3?.start), iso(w.A3?.end)]).toEqual(['2025-12-15', '2026-06-15']);
  });
  it('Intermediate = Annual 2 start s/d Annual 3 end', () => {
    expect([iso(w.INT?.start), iso(w.INT?.end)]).toEqual(['2024-12-15', '2026-06-15']);
  });
  it('Docking 1 = bulan ke-24 s/d ke-36 dari awal periode', () => {
    expect([iso(w.D1?.start), iso(w.D1?.end)]).toEqual(['2025-03-15', '2026-03-15']);
  });
  it('Renewal = expiry − 3 bulan s/d expiry', () => {
    expect([iso(w.REN?.start), iso(w.REN?.end)]).toEqual(['2027-12-15', '2028-03-15']);
  });
  it('akhir bulan: expiry 31 Mei → anniversary dan batas tidak meluber ke bulan berikutnya', () => {
    const x = computeStatus({ ...BASE, expiry: '2028-05-31', compDate: '2024-04-01', startDate: '2024-04-01' }).win;
    expect(iso(x.A1?.start)).toBe('2024-02-29'); // 31 Mei 2024 − 3 bulan → 29 Feb 2024 (tahun kabisat), bukan 2 Mar
    expect(iso(x.A1?.end)).toBe('2024-08-31');
  });
});

describe('computeStatus — nomor Renewal', () => {
  const rn = (o: object) => computeStatus({ ...BASE, compDate: '2024-02-05', startDate: '2024-02-01', ...o });
  it('umur 18 tahun, Renewal terakhir III → RENEWAL IV (sama dengan hitungan umur)', () => {
    const r = rn({});
    expect(r.rnLabel).toBe('RENEWAL IV');
    expect(r.rnBumped).toBe(false);
  });
  it('Renewal terakhir sudah IV → naik jadi V walau umur masih 4', () => {
    const r = rn({ lastNo: 4 });
    expect(r.rnLabel).toBe('RENEWAL V');
    expect(r.rnBumped).toBe(true);
  });
  it('tahun bangun kosong dan lastNo kosong → INPUT REQUIRED', () => {
    expect(rn({ yearBuilt: '', lastNo: null }).rnLabel).toBe('INPUT REQUIRED');
  });
  it.each([[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4], [21, 5]])('umur %i pada tahun expiry → Renewal ke-%i', (age, no) => {
    const r = rn({ yearBuilt: String(2028 - age), lastNo: null });
    expect(r.rn).toBe(no);
  });
});

describe('computeStatus — Docking 1', () => {
  const d = (st: string, co: string) => computeStatus({ ...BASE, sel: { ...BASE.sel, D1: true }, startDate: st, compDate: co }).rows[0].status;
  it('selesai tepat di batas 36 bulan (15 Mar 2026) → VALID', () => expect(d('2026-03-01', '2026-03-15')).toBe('VALID'));
  it('mulai tepat waktu tapi selesai setelah batas → SUSPENDED', () => expect(d('2026-03-10', '2026-03-16')).toBe('SUSPENDED'));
  it('mulai setelah batas → SUSPENDED, tidak pernah WITHDRAWN selama DOCKING_CAN_WITHDRAW = false', () => expect(d('2027-01-01', '2027-03-01')).toBe('SUSPENDED'));
});
