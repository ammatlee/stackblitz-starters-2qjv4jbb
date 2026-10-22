import { describe, it, expect } from 'vitest';
import { computeSurveyStatus, ageNo, roman, type Baseline, type Ev } from '../lib/surveyStatus';
import { computeStatus } from '../lib/classValidity/statusCalc';
import { fmt, parseD } from '../lib/classValidity/dateUtils';
import { BASE, pick } from './fixtures/cases';

/** Kapal rekaan: expiry 15 Mar 2028, dibangun 2010, Renewal terakhir III, belum ada survei tercatat. */
const B: Baseline = {
  vessel_type: 'General Cargo', propelled: null, cert_expiry: '2028-03-15', anniv_day: null, anniv_month: null, year_built: 2010,
  last_renewal_no: 3, last_special: null, last_annual: null, last_annual_no: null, last_intermediate: null, last_docking: null,
  postponed_until: null, baseline_at: null, shaft_system: 'oil', prop_connection: 'keyless', open_config: null,
  last_shaft_plan: null, last_shaft_major: null, shaft_exts: null,
};
const ev = (o: Partial<Ev>): Ev => ({ agenda_no: 'T', start: null, completion: null, surveys: [], scenario: null, finished_at: '2024-01-01', ...o });
const TODAY = new Date('2026-10-21T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const row = (r: NonNullable<ReturnType<typeof computeSurveyStatus>>, kind: string) => r.rows.find((x) => x.kind.startsWith(kind));

describe('computeSurveyStatus — baseline saja', () => {
  const r = computeSurveyStatus(B, [], TODAY)!;
  it('jatuh tempo Special = expiry, belum lewat', () => { expect(row(r, 'Special')?.due).toBe('15.03.2028'); expect(row(r, 'Special')?.state).toBe('AKAN DATANG'); });
  it('Annual 1 window 15.12.2023 – 15.06.2024, sudah OVERDUE per 21 Okt 2026', () => {
    expect(row(r, 'Annual Survey ke-1')?.range).toBe('15.12.2023 s/d 15.06.2024');
    expect(row(r, 'Annual Survey ke-1')?.state).toBe('OVERDUE');
  });
  it('Intermediate window 15.12.2024 – 15.06.2026', () => expect(row(r, 'Intermediate')?.range).toBe('15.12.2024 s/d 15.06.2026'));
  it('Docking jatuh tempo 36 bulan dari awal periode (15.03.2026)', () => expect(row(r, 'Docking')?.due).toBe('15.03.2026'));
  it('Poros: interval 5 tahun dari awal periode + 5 tahun', () => { expect(r.shaft?.interval).toBe(5); expect(iso(r.shaft!.due)).toBe('2028-03-15'); });
  it('nomor Renewal: umur 18 → berikutnya IV', () => { expect(r.lastNo).toBe(3); expect(r.nextNo).toBe(4); });
});

describe('computeSurveyStatus — setelah survei dikerjakan', () => {
  it('Annual 1 tepat waktu → Annual berikutnya = Annual ke-2, window 15.12.2024 – 15.06.2025', () => {
    const r = computeSurveyStatus(B, [ev({ completion: '2024-02-05', surveys: ['A1'] })], TODAY)!;
    expect(row(r, 'Annual Survey ke-2')?.range).toBe('15.12.2024 s/d 15.06.2025');
    expect(r.annCount).toBe(1);
    expect(iso(r.nextAnniv)).toBe('2025-03-15');
  });
  it('Annual 1 lebih awal (1 Okt 2023) → anniversary bergeser ke 1 Jan, window Annual 2 ikut bergeser', () => {
    const r = computeSurveyStatus(B, [ev({ completion: '2023-10-01', surveys: ['A1'] })], TODAY)!;
    expect(row(r, 'Annual Survey ke-2')?.range).toBe('01.10.2024 s/d 01.04.2025');
    expect([r.ad, r.am]).toEqual([1, 1]);
  });
  it('Renewal tepat waktu → expiry +5 tahun, periode baru dari expiry lama, Renewal berikutnya V', () => {
    const r = computeSurveyStatus(B, [ev({ completion: '2028-03-01', surveys: ['REN'] })], new Date('2028-04-01T00:00:00Z'))!;
    expect(iso(r.expiry)).toBe('2033-03-15');
    expect(iso(r.periodStart)).toBe('2028-03-15');
    expect([r.lastNo, r.nextNo]).toEqual([4, 5]);
    expect(row(r, 'Annual Survey ke-1')?.range).toBe('15.12.2028 s/d 15.06.2029');
  });
  it('Renewal selesai > 3 bulan lebih awal (1 Des 2027) → periode baru dihitung dari completion', () => {
    const r = computeSurveyStatus(B, [ev({ completion: '2027-12-01', surveys: ['REN'] })], new Date('2027-12-10T00:00:00Z'))!;
    expect(iso(r.expiry)).toBe('2032-12-01');
    expect(iso(r.periodStart)).toBe('2027-12-01');
  });
});

describe('computeSurveyStatus — Propeller Shaft', () => {
  it('batas 15 tahun sejak Method 1/2 terakhir memunculkan peringatan setelah lewat', () => {
    const r = computeSurveyStatus({ ...B, last_shaft_major: '2011-06-01' }, [], TODAY)!;
    expect(iso(r.shaft!.limit15!)).toBe('2026-06-01');
    expect(r.shaft!.warnings.length).toBeGreaterThan(0);
  });
  it('belum lewat 15 tahun → tidak ada peringatan', () => {
    const r = computeSurveyStatus({ ...B, last_shaft_major: '2020-06-01' }, [], TODAY)!;
    expect(r.shaft!.warnings).toHaveLength(0);
  });
  it('kapal tanpa penggerak (Pontoon) → tidak ada survei poros', () => {
    const r = computeSurveyStatus({ ...B, vessel_type: 'Pontoon' }, [], TODAY)!;
    expect(r.propelled).toBe(false);
    expect(r.shaft).toBeNull();
  });
});

describe('Konsistensi dua mesin: Survey Status (Modul riwayat) ↔ Class Status (Modul 1)', () => {
  // Window Annual berikutnya harus SAMA di kedua tempat, termasuk setelah anniversary bergeser.
  const compare = (events: Ev[]) => {
    const s = computeSurveyStatus(B, events, TODAY)!;
    const n = s.annCount + 1;
    const key = (`A${n}`) as 'A2';
    const c = computeStatus({
      ...BASE, sel: pick(key), startDate: '2030-01-01', compDate: '2030-01-01', annivD: s.ad, annivM: s.am, // sama seperti alur aplikasi (ApplyValues)
      statusInfo: { nextAnniv: iso(s.nextAnniv), annCount: s.annCount, intDone: s.intDone, dock1Done: s.dock1Done, shaftDone: s.shaftDone, lastDock: s.lastDock ? iso(s.lastDock) : null } as never,
    });
    const w = c.win[key]!;
    const rowRange = s.rows.find((x) => x.kind.startsWith(`Annual Survey ke-${n}`))?.range;
    expect(`${fmt(w.start)} s/d ${fmt(w.end)}`).toBe(rowRange);
  };
  it('tanpa riwayat', () => compare([]));
  it('setelah Annual 1 tepat waktu', () => compare([ev({ completion: '2024-02-05', surveys: ['A1'] })]));
  it('setelah Annual 1 lebih awal (anniversary bergeser)', () => compare([ev({ completion: '2023-10-01', surveys: ['A1'] })]));
});

describe('Nomor Renewal: hitungan umur konsisten di semua tempat', () => {
  it.each([[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [16, 4], [20, 4], [21, 5], [26, 6]])('umur %i → Renewal ke-%i', (age, no) => expect(ageNo(age)).toBe(no));
  it('ageNo dan computeStatus sepakat untuk umur 1–30', () => {
    for (let age = 1; age <= 30; age++) {
      const c = computeStatus({ ...BASE, yearBuilt: String(2028 - age), lastNo: null, startDate: '2028-02-01', compDate: '2028-03-01' });
      expect(`umur ${age}: ${c.rn}`).toBe(`umur ${age}: ${ageNo(age)}`);
    }
  });
  it('ageNo(0) = 0 sengaja: penanda "belum ada Renewal sebelumnya" pada kapal baru', () => expect(ageNo(0)).toBe(0));
  it('kapal baru (dibangun 2023, expiry 2028): umur 5 → Renewal I, belum ada Renewal sebelumnya', () => {
    const r = computeSurveyStatus({ ...B, year_built: 2023, last_renewal_no: null }, [], TODAY)!;
    expect([r.lastNo, r.nextNo]).toEqual([0, 1]);
  });
  it.each([2028, 2030])('tahun bangun %i ≥ tahun expiry 2028 → salah input: nomor Renewal tidak ditebak', (yb) => {
    const r = computeSurveyStatus({ ...B, year_built: yb, last_renewal_no: null }, [], TODAY)!;
    expect([r.lastNo, r.nextNo]).toEqual([null, null]);
  });
  it('tahun bangun salah input walau Renewal terakhir diisi → nomor tetap tidak ditebak', () => {
    expect(computeSurveyStatus({ ...B, year_built: 2030, last_renewal_no: 3 }, [], TODAY)!.nextNo).toBeNull();
  });
  it.each([[0], [-2]])('computeStatus: umur %i → INPUT REQUIRED, bukan Renewal tebakan', (d) => {
    const c = computeStatus({ ...BASE, yearBuilt: String(2028 - d), lastNo: 3, startDate: '2028-02-01', compDate: '2028-03-01' });
    expect([c.age, c.ageInvalid, c.rn, c.rnLabel]).toEqual([null, true, null, 'INPUT REQUIRED']);
  });
  it('computeStatus: umur 1 (batas terkecil yang sah) → RENEWAL I', () => {
    const c = computeStatus({ ...BASE, yearBuilt: '2027', lastNo: null, startDate: '2028-02-01', compDate: '2028-03-01' });
    expect([c.age, c.ageInvalid, c.rnLabel]).toEqual([1, false, 'RENEWAL I']);
  });
  it.each([[1, 'I'], [4, 'IV'], [5, 'V'], [9, 'IX'], [10, 'X']])('roman(%i) = %s', (n, r) => expect(roman(n)).toBe(r));
});

describe('Parser tanggal baseline', () => {
  it('parseD dan tanggal baseline dari database (timestamp) sama hasilnya', () => expect(iso(parseD('2028-03-15T00:00:00+00:00')!)).toBe('2028-03-15'));
});
