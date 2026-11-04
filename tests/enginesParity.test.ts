import { describe, it, expect } from 'vitest';
import { computeSurveyStatus, toISO, type Baseline, type Ev } from '../lib/surveyStatus';
import { computeStatus } from '../lib/classValidity/statusCalc';
import { addM, fmt } from '../lib/classValidity/dateUtils';
import { BASE, pick } from './fixtures/cases';
import type { SurveyKey } from '../lib/classValidity/surveyRules';

/**
 * Konsistensi dua mesin: Survey Status per kapal (lib/surveyStatus.ts) ↔ Class Status Modul 1 (lib/classValidity/statusCalc.ts).
 * Keduanya menghitung window survei sendiri-sendiri; bila salah satu diubah dan yang lain lupa, tes ini gagal.
 * Alur aplikasi diniru: hasil Survey Status dikirim ke Modul 1 lewat ApplyValues (expiry, anniversary, info).
 * Dibandingkan: Annual berikutnya, Intermediate, Docking, dan jendela Renewal — untuk beberapa tanggal expiry
 * (termasuk akhir bulan) dan beberapa riwayat survei.
 */
const TODAY = new Date('2026-10-21T00:00:00Z');
const EXPIRIES = ['2028-03-15', '2027-05-31', '2028-08-31', '2029-02-28', '2028-12-31', '2030-01-30'];
const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const ev = (o: Partial<Ev>): Ev => ({ agenda_no: 'T', start: null, completion: null, surveys: [], scenario: null, finished_at: '2024-01-01', ...o });

const baseline = (expiry: string): Baseline => ({
  vessel_type: 'General Cargo', propelled: null, cert_expiry: expiry, anniv_day: null, anniv_month: null, year_built: 2005,
  last_renewal_no: 3, last_special: null, last_annual: null, last_annual_no: null, last_intermediate: null, last_docking: null,
  postponed_until: null, baseline_at: null, shaft_system: 'oil', prop_connection: 'keyless', open_config: null,
  last_shaft_plan: null, last_shaft_major: null, shaft_exts: null,
});

/** Riwayat survei, dinyatakan relatif terhadap awal periode (expiry − 5 tahun) supaya berlaku untuk semua expiry. */
const HISTORIES: [string, (ps: Date) => Ev[]][] = [
  ['tanpa riwayat', () => []],
  ['Annual 1 tepat waktu', (ps) => [ev({ completion: toISO(addM(ps, 13)), surveys: ['A1'] })]],
  ['Annual 1 lebih awal (anniversary bergeser)', (ps) => [ev({ completion: toISO(addM(ps, 8)), surveys: ['A1'] })]],
  ['Annual 1 dan 2 tepat waktu', (ps) => [ev({ completion: toISO(addM(ps, 13)), surveys: ['A1'] }), ev({ completion: toISO(addM(ps, 25)), surveys: ['A2'] })]],
  ['Annual 1 lebih awal lalu Annual 2', (ps) => [ev({ completion: toISO(addM(ps, 8)), surveys: ['A1'] }), ev({ completion: toISO(addM(ps, 20)), surveys: ['A2'] })]],
  ['Docking 1 selesai di bulan ke-30', (ps) => [ev({ completion: toISO(addM(ps, 30)), surveys: ['D1'] })]],
  ['Annual 1 lebih awal + Docking 1', (ps) => [ev({ completion: toISO(addM(ps, 8)), surveys: ['A1'] }), ev({ completion: toISO(addM(ps, 30)), surveys: ['D1'] })]],
];

describe.each(EXPIRIES)('Konsistensi dua mesin — expiry %s', (expiry) => {
  it.each(HISTORIES.map(([n]) => [n]))('%s', (histName) => {
    const hist = HISTORIES.find(([n]) => n === histName)!;
    const b = baseline(expiry);
    const s0 = computeSurveyStatus(b, [], TODAY)!;
    const s = computeSurveyStatus(b, hist[1](s0.periodStart), TODAY)!;
    const info = { nextAnniv: toISO(s.nextAnniv), annCount: s.annCount, intDone: s.intDone, dock1Done: s.dock1Done, shaftDone: s.shaftDone, lastDock: s.lastDock ? toISO(s.lastDock) : null };
    const calc = (key: SurveyKey) =>
      computeStatus({ ...BASE, expiry: toISO(s.expiry), sel: pick(key), startDate: '2030-01-01', compDate: '2030-01-01', annivD: s.ad, annivM: s.am, statusInfo: info as never });
    const row = (prefix: string) => s.rows.find((x) => x.kind.startsWith(prefix));
    const win = (key: SurveyKey) => calc(key).win[key]!;
    const span = (w: { start: Date; end: Date }) => `${fmt(w.start)} s/d ${fmt(w.end)}`;

    // Annual berikutnya (bila ditampilkan sebagai window)
    const n = s.annCount + 1;
    const annual = row(`Annual Survey ke-${n}`);
    if (annual && annual.range) expect(span(win(`A${n}` as SurveyKey))).toBe(annual.range);

    // Intermediate (bila belum dikerjakan)
    const inter = row('Intermediate');
    if (inter && inter.range) expect(span(win('INT'))).toBe(inter.range);

    // Docking: jatuh tempo = akhir window Docking 1
    const dock = row('Docking');
    expect(fmt(win('D1').end)).toBe(dock!.due);

    // Renewal: window berakhir di expiry
    expect(fmt(win('REN').end)).toBe(row('Special')!.due);
  });
});
