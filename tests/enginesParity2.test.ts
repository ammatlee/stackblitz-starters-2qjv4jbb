import { describe, it, expect } from 'vitest';
import { computeSurveyStatus, toISO, type Baseline, type Ev } from '../lib/surveyStatus';
import { computeStatus } from '../lib/classValidity/statusCalc';
import { addM, fmt } from '../lib/classValidity/dateUtils';
import { BASE, pick } from './fixtures/cases';
import type { SurveyKey } from '../lib/classValidity/surveyRules';

/**
 * Lanjutan enginesParity.test.ts: skenario tambahan supaya Survey Status per kapal (lib/surveyStatus.ts)
 * dan Class Status Modul 1 (lib/classValidity/statusCalc.ts) tetap sepakat.
 *  - Intermediate sudah dikerjakan, Annual 1-3 dan 1-4 tepat waktu
 *  - Annual 1-4 dipercepat sampai Annual ke-5 muncul (anniversary bergeser tiap kali)
 *  - Docking 1 di bulan 20 dan 36, serta kombinasi Annual awal + Intermediate + Docking
 *  - Propeller Shaft (sistem oil, fw, open): jatuh tempo poros dari Survey Status menjadi batas
 *    VALID / SUSPENDED / WITHDRAWN di Modul 1 (mulai setelah jatuh tempo = SUSPENDED; selesai > 6 bulan = WITHDRAWN)
 */
const TODAY = new Date('2026-10-21T00:00:00Z');
const EXPIRIES = ['2028-03-15', '2027-05-31', '2028-08-31', '2029-02-28', '2028-12-31', '2030-01-30'];
const ev = (o: Partial<Ev>): Ev => ({ agenda_no: 'T', start: null, completion: null, surveys: [], scenario: null, finished_at: '2024-01-01', ...o });

const baseline = (expiry: string, over: Partial<Baseline> = {}): Baseline => ({
  vessel_type: 'General Cargo', propelled: null, cert_expiry: expiry, anniv_day: null, anniv_month: null, year_built: 2005,
  last_renewal_no: 3, last_special: null, last_annual: null, last_annual_no: null, last_intermediate: null, last_docking: null,
  postponed_until: null, baseline_at: null, shaft_system: 'oil', prop_connection: 'keyless', open_config: null,
  last_shaft_plan: null, last_shaft_major: null, shaft_exts: null, ...over,
});

/** Satu survei selesai pada bulan ke-m sejak awal periode (expiry − 5 tahun). */
const done = (ps: Date, m: number, key: string) => ev({ completion: toISO(addM(ps, m)), surveys: [key] });

const HISTORIES: [string, (ps: Date) => Ev[]][] = [
  ['Intermediate dikerjakan bulan 30', (ps) => [done(ps, 30, 'INT')]],
  ['Annual 1, 2 tepat waktu lalu Intermediate', (ps) => [done(ps, 13, 'A1'), done(ps, 25, 'A2'), done(ps, 30, 'INT')]],
  ['Annual 1-3 tepat waktu', (ps) => [done(ps, 13, 'A1'), done(ps, 25, 'A2'), done(ps, 37, 'A3')]],
  ['Annual 1-4 tepat waktu', (ps) => [done(ps, 13, 'A1'), done(ps, 25, 'A2'), done(ps, 37, 'A3'), done(ps, 49, 'A4')]],
  ['Annual 1-4 dipercepat (Annual ke-5 muncul)', (ps) => [done(ps, 5, 'A1'), done(ps, 17, 'A2'), done(ps, 29, 'A3'), done(ps, 41, 'A4')]],
  ['Docking 1 di bulan 20', (ps) => [done(ps, 20, 'D1')]],
  ['Docking 1 di bulan 36', (ps) => [done(ps, 36, 'D1')]],
  ['Annual 1 lebih awal, Intermediate, Docking', (ps) => [done(ps, 8, 'A1'), done(ps, 30, 'INT'), done(ps, 31, 'D1')]],
];

describe.each(EXPIRIES)('Konsistensi dua mesin (tambahan) — expiry %s', (expiry) => {
  it.each(HISTORIES.map(([n]) => [n]))('%s', (histName) => {
    const hist = HISTORIES.find(([n]) => n === histName)!;
    const b = baseline(expiry);
    const s0 = computeSurveyStatus(b, [], TODAY)!;
    const s = computeSurveyStatus(b, hist[1](s0.periodStart), TODAY)!;
    const info = { nextAnniv: toISO(s.nextAnniv), annCount: s.annCount, intDone: s.intDone, dock1Done: s.dock1Done, shaftDone: s.shaftDone, lastDock: s.lastDock ? toISO(s.lastDock) : null };
    const calc = (key: SurveyKey) =>
      computeStatus({ ...BASE, expiry: toISO(s.expiry), sel: pick(key), startDate: '2030-01-01', compDate: '2030-01-01', annivD: s.ad, annivM: s.am, statusInfo: info as never });
    const win = (key: SurveyKey) => calc(key).win[key]!;
    const span = (w: { start: Date; end: Date }) => `${fmt(w.start)} s/d ${fmt(w.end)}`;
    const row = (prefix: string) => s.rows.find((x) => x.kind.startsWith(prefix));

    // Annual berikutnya (termasuk Annual ke-5 bila dipercepat)
    const n = s.annCount + 1;
    const annual = row(`Annual Survey ke-${n}`);
    if (annual && annual.range && n <= 5) expect(span(win(`A${n}` as SurveyKey))).toBe(annual.range);

    const inter = row('Intermediate');
    if (inter && inter.range) expect(span(win('INT'))).toBe(inter.range);

    expect(fmt(win('D1').end)).toBe(row('Docking')!.due);
    expect(fmt(win('REN').end)).toBe(row('Special')!.due);
  });

  it('Annual dipercepat: Annual ke-5 benar-benar muncul (skenario tidak kosong)', () => {
    const b = baseline(expiry);
    const s0 = computeSurveyStatus(b, [], TODAY)!;
    const s = computeSurveyStatus(b, HISTORIES.find(([n]) => n.includes('dipercepat'))![1](s0.periodStart), TODAY)!;
    expect(s.annCount).toBe(4);
    expect(!!s.rows.find((x) => x.kind.startsWith('Annual Survey ke-5'))).toBe(true);
  });
});

describe.each(['2028-03-15', '2027-05-31', '2029-02-28'])('Propeller Shaft — expiry %s', (expiry) => {
  it.each([['oil'], ['fw'], ['open']])('sistem %s: batas VALID / SUSPENDED / WITHDRAWN mengikuti jatuh tempo poros', (sys) => {
    const s = computeSurveyStatus(baseline(expiry, { propelled: true, shaft_system: sys, open_config: sys === 'open' ? 'five' : null }), [], TODAY)!;
    expect(!!s.shaft).toBe(true);
    const due = s.shaft!.due;
    const info = {
      nextAnniv: toISO(s.nextAnniv), annCount: s.annCount, intDone: s.intDone, dock1Done: s.dock1Done, shaftDone: s.shaftDone, lastDock: null,
      shaftDue: toISO(due), shaftCap: s.shaft!.lateExtOk ? toISO(s.shaft!.capDue) : null,
    };
    const ps = (start: string, comp: string) =>
      computeStatus({ ...BASE, expiry: toISO(s.expiry), sel: pick('PS'), startDate: start, compDate: comp, annivD: s.ad, annivM: s.am, statusInfo: info as never })
        .rows.find((x) => x.key === 'PS')?.status;

    // tanggal di tabel Survey Status = tanggal yang dipakai Modul 1
    expect(fmt(due)).toBe(s.rows.find((x) => x.kind.startsWith('Propeller'))!.due);

    const day = 86400000;
    const after = new Date(due.getTime() + day);
    const lateEnd = new Date(addM(due, 6).getTime() + day);
    expect(ps(toISO(due), toISO(due))).toBe('VALID'); // mulai tepat di jatuh tempo
    expect(ps(toISO(due), toISO(addM(due, 6)))).toBe('VALID'); // dimulai tepat waktu, selesai belakangan: tetap valid
    expect(ps(toISO(after), toISO(after))).toBe('SUSPENDED'); // mulai sehari setelah jatuh tempo
    expect(ps(toISO(after), toISO(addM(due, 6)))).toBe('SUSPENDED'); // selesai tepat 6 bulan setelah jatuh tempo
    expect(ps(toISO(after), toISO(lateEnd))).toBe('WITHDRAWN'); // selesai lebih dari 6 bulan
  });
});
