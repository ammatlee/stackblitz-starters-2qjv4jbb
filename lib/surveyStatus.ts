/**
 * Perhitungan Survey Status per kapal:
 * status awal (baseline) + agenda yang di-Finish + pembaruan manual (hanya tanggal).
 * Murni fungsi (tanpa Supabase) supaya mudah diuji.
 */

import { isNonPropelled } from './vesselTypes';

export type Baseline = {
  vessel_type?: string | null;
  propelled?: boolean | null; // null/kosong = otomatis dari jenis kapal
  last_shaft?: string | null;
  cert_expiry: string | null;
  anniv_day: number | null;
  anniv_month: number | null;
  year_built: number | null;
  last_renewal_no: number | null;
  last_special: string | null;
  last_annual: string | null;
  last_annual_no: number | null;
  last_intermediate: string | null;
  last_docking: string | null;
  postponed_until: string | null;
  baseline_at: string | null;
};
export type Ev = {
  agenda_no: string; // 'Manual' untuk pembaruan tanpa agenda
  start: string | null;
  completion: string | null;
  surveys: string[];
  scenario: string | null;
  finished_at: string | null;
};
export type StatusRow = { kind: string; due: string; range: string; postponed: string; last: string; state: string; note?: string };
export type StatusResult = {
  rows: StatusRow[];
  expiry: Date;
  ad: number;
  am: number;
  periodStart: Date;
  showA5: boolean; // Annual ke-5 hanya ada bila Annual dipercepat
  nextAnniv: Date; // anniversary survei Annual berikutnya
  annCount: number; // jumlah survei periodik yang sudah dikerjakan pada periode ini
  intDone: boolean;
  dock1Done: boolean;
  shaftDone: boolean;
  propelled: boolean;
  lastDock: Date | null;
  lastNo: number | null;
  nextNo: number | null;
  applied: string[];
};

/* ---------- tanggal (UTC, perilaku EDATE) ---------- */
const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
};
const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const mk = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, 1));
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, dim(t.getUTCFullYear(), t.getUTCMonth()))));
};
const addM = (d: Date, n: number) => mk(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
export const toDMY = (d: Date | null) =>
  d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '';
export const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function roman(n: number): string {
  const t: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let r = '';
  let x = n;
  for (const [v, s] of t) while (x >= v) { r += s; x -= v; }
  return r || String(n);
}
/** Nomor Renewal menurut umur kapal pada tahun expiry: ≤5 → I, ≤10 → II, ≤15 → III, ≤20 → IV, ≤25 → V, dst. */
export const ageNo = (age: number) => (age <= 0 ? 0 : Math.max(1, Math.ceil(age / 5)));

export function computeSurveyStatus(b: Baseline, evsAll: Ev[], today: Date): StatusResult | null {
  const exp0 = parse(b.cert_expiry);
  if (!exp0) return null;
  const yb = b.year_built;

  let expiry = exp0;
  let ad = b.anniv_day ?? expiry.getUTCDate();
  let am = b.anniv_month ?? expiry.getUTCMonth() + 1;
  let periodStart = addM(expiry, -60);
  let nextAnniv = mk(periodStart.getUTCFullYear() + 1, am - 1, ad);
  let lastSpecial = parse(b.last_special);
  let lastAnnual: Date | null = null;
  let lastAnnualLabel = '';
  let lastInt: Date | null = null;
  let lastDock = parse(b.last_docking);
  let lastShaft = parse(b.last_shaft);
  let postponed = parse(b.postponed_until);
  let annCount = 0; // jumlah survei periodik (Annual/Intermediate) yang sudah dikreditkan pada periode ini
  let intSlot: number | null = null; // urutan survei periodik tempat Intermediate dikerjakan

  // Nomor Renewal terakhir yang selesai (default: menurut umur pada expiry periode sebelumnya)
  let lastNo: number | null = b.last_renewal_no;
  if (lastNo === null && yb) lastNo = ageNo(expiry.getUTCFullYear() - 5 - yb);
  const nextNoOf = (exp: Date, last: number | null) => {
    const a = yb ? ageNo(exp.getUTCFullYear() - yb) : null;
    const p = last !== null ? last + 1 : null;
    return a === null ? p : p === null ? a : Math.max(a, p); // naik bila periode melewati hitungan umur
  };

  /**
   * Annual/Intermediate dikreditkan pada slot tertentu (slot = nomor Annual yang dipilih; kosong = slot berikutnya).
   * Bila dikerjakan lebih awal dari window start, anniversary baru = 3 bulan setelah completion (ITS Part A Sec. 3.B.1.1.3).
   */
  const doAnnual = (c: Date, label: string, slot?: number) => {
    // acuan anniversary slot: ikuti rantai nextAnniv (tetap benar setelah anniversary bergeser)
    const gap = slot ? slot - (annCount + 1) : 0;
    const ref = mk(nextAnniv.getUTCFullYear() + gap, am - 1, ad);
    if (+c < +addM(ref, -3)) {
      const na = addM(c, 3);
      ad = na.getUTCDate();
      am = na.getUTCMonth() + 1;
      nextAnniv = mk(na.getUTCFullYear() + 1, na.getUTCMonth(), na.getUTCDate());
    } else {
      nextAnniv = mk(ref.getUTCFullYear() + 1, am - 1, ad);
    }
    lastAnnual = c;
    lastAnnualLabel = label;
    annCount = slot ?? annCount + 1;
  };

  // Status awal: Annual/Intermediate terakhir pada periode berjalan
  const base: { t: 'A' | 'I'; d: Date }[] = [];
  const la = parse(b.last_annual);
  const li = parse(b.last_intermediate);
  if (la && +la >= +periodStart) base.push({ t: 'A', d: la });
  if (li && +li >= +periodStart) base.push({ t: 'I', d: li });
  base.sort((x, y) => +x.d - +y.d).forEach((e) => {
    if (e.t === 'I') {
      // Intermediate adalah survei tersendiri (±2,5 tahun): tidak menggantikan dan tidak mengubah urutan Annual
      lastInt = e.d;
      intSlot = annCount;
    } else {
      doAnnual(e.d, b.last_annual_no ? `Annual ${b.last_annual_no}` : 'Annual', b.last_annual_no ?? undefined);
    }
  });

  // Agenda yang di-Finish dan pembaruan manual SETELAH status awal disimpan
  const bAt = b.baseline_at ? +new Date(b.baseline_at) : null;
  const evs = evsAll
    .filter((e) => e.completion && (bAt === null || (e.finished_at !== null && +new Date(e.finished_at) > bAt)))
    .sort((x, y) => +parse(x.completion)! - +parse(y.completion)!);
  const applied: string[] = [];

  for (const e of evs) {
    const c = parse(e.completion)!;
    const sc = e.scenario ?? '';
    const forced = /^(C|D)\./.test(sc);
    const hasRen = e.surveys.includes('REN') || forced;
    const hasInt = e.surveys.includes('INT') || /^A\./.test(sc);
    const annNo = ['A1', 'A2', 'A3', 'A4', 'A5'].reduce((m, k) => (e.surveys.includes(k) ? Math.max(m, Number(k[1])) : m), 0);
    const hasAnn = annNo > 0; // hanya survei Annual yang dipilih yang mengkreditkan Annual (Intermediate berdiri sendiri)
    const hasDock = hasRen || e.surveys.includes('D1');
    const hasShaft = e.surveys.includes('PS');
    if (!hasRen && !hasInt && !hasAnn && !hasDock && !hasShaft) continue;
    applied.push(e.agenda_no);
    if (hasShaft) lastShaft = c;

    if (hasRen) {
      const early = +c < +addM(expiry, -3);
      const late = +c > +addM(expiry, 6);
      // Nota Dinas BKI 87/SVY/III/2020 poin 5: dimulai & selesai pada masa suspend → periode dihitung dari sertifikat
      // sebelumnya (expiry lama + 5 tahun); withdrawn (selesai > expiry + 6 bulan) atau Case C/D → periode baru dari completion.
      const fromC = forced || early || late;
      const used = nextNoOf(expiry, lastNo);
      const from = fromC ? c : expiry;
      if (fromC) {
        ad = c.getUTCDate();
        am = c.getUTCMonth() + 1;
      }
      periodStart = from;
      expiry = addM(from, 60);
      nextAnniv = mk(from.getUTCFullYear() + 1, am - 1, ad);
      lastSpecial = c;
      lastDock = c;
      lastAnnual = null;
      lastAnnualLabel = '';
      lastInt = null;
      annCount = 0;
      intSlot = null;
      postponed = null;
      lastNo = used;
    } else {
      if (hasInt) lastInt = c;
      if (hasAnn) doAnnual(c, `Annual ${annNo}`, annNo);
      if (hasInt) intSlot = annCount; // survei periodik ke-3 setelah Intermediate ini yang jatuh sebelum expiry dikerjakan sebagai Intermediate (ITS 3.B.1.2.3)
      if (hasDock) lastDock = c;
    }
  }

  /* ---------- baris status ---------- */
  const rangeState = (start: Date, end: Date) => (+today > +end ? 'OVERDUE' : +today >= +start ? 'DALAM WINDOW' : 'AKAN DATANG');
  const rows: StatusRow[] = [];

  const effDue = postponed && +postponed > +expiry ? postponed : expiry;
  rows.push({
    kind: 'Special Survey (Class Renewal)',
    due: toDMY(expiry),
    range: '',
    postponed: postponed ? toDMY(postponed) : '',
    last: toDMY(lastSpecial),
    state: rangeState(addM(expiry, -3), effDue),
  });

  // Intermediate: tetap mengikuti tahun ke-2 dan ke-3 dari anniversary ASLI periode (= tanggal & bulan expiry).
  // Pergeseran Annual (early completion) tidak memengaruhi jendela Intermediate maupun Docking.
  const a2 = mk(periodStart.getUTCFullYear() + 2, expiry.getUTCMonth(), expiry.getUTCDate());
  const a3 = mk(periodStart.getUTCFullYear() + 3, expiry.getUTCMonth(), expiry.getUTCDate());
  const intStart = addM(a2, -3);
  const intEnd = addM(a3, 3);
  const intDone = lastInt !== null && +(lastInt as Date) >= +periodStart;
  rows.push({
    kind: 'Intermediate Survey',
    due: '',
    range: intDone ? '' : `${toDMY(intStart)} s/d ${toDMY(intEnd)}`,
    postponed: '',
    last: intDone ? toDMY(lastInt) : '',
    state: intDone ? 'SELESAI' : rangeState(intStart, intEnd),
  });

  // Annual: window survei berikutnya selalu ditampilkan, termasuk Annual ke-5.
  // Bila window-nya berimpit dengan jendela Renewal (anniversary ≥ expiry − 3 bulan), statusnya digabung dengan Renewal.
  const nextIdx = annCount + 1;
  const annualOpen = +nextAnniv < +addM(expiry, -3);
  const inLieu = annualOpen && intSlot !== null && nextIdx === intSlot + 3; // ITS Part A 3.B.1.1.3 (3)
  const lastAnnualTxt = lastAnnual ? `${toDMY(lastAnnual)}${lastAnnualLabel ? ` (${lastAnnualLabel})` : ''}` : '';
  const showA5 = (nextIdx === 5 && annualOpen) || annCount >= 5;
  if (nextIdx <= 5 && annualOpen) {
    rows.push({
      kind: inLieu ? `Annual ke-${nextIdx} → dikerjakan sebagai Intermediate` : `Annual Survey ke-${nextIdx}`,
      note: inLieu ? 'In lieu of Annual (ITS Part A 3.B.1.1.3)' : nextIdx === 5 ? 'Annual dipercepat — Annual ke-5 sebelum jendela Renewal' : undefined,
      due: '',
      range: `${toDMY(addM(nextAnniv, -3))} s/d ${toDMY(addM(nextAnniv, 3))}`,
      postponed: '',
      last: lastAnnualTxt,
      state: rangeState(addM(nextAnniv, -3), addM(nextAnniv, 3)),
    });
  } else if (nextIdx <= 5) {
    // anniversary berikutnya berimpit dengan jendela Renewal → Annual terakhir digantikan Renewal
    rows.push({ kind: 'Annual Survey', due: '', range: '', postponed: '', last: lastAnnualTxt, state: 'BERSAMA RENEWAL', note: 'Annual berikutnya digantikan Renewal' });
  } else {
    rows.push({ kind: 'Annual Survey', due: '', range: '', postponed: '', last: lastAnnualTxt, state: 'SELESAI' });
  }

  // Docking: tidak ada batas paling awal; hanya maksimum 36 bulan sejak Bottom Survey sebelumnya.
  const dockBase = lastDock ?? periodStart;
  let dockDue = addM(dockBase, 36);
  let dockNote = 'Maksimum 36 bulan; tidak ada batas paling awal';
  if (+dockDue > +expiry) {
    dockDue = expiry;
    dockNote = 'Bersama Renewal';
  }
  rows.push({
    kind: 'Docking Survey',
    due: toDMY(dockDue),
    range: '',
    postponed: '',
    last: toDMY(lastDock),
    state: +today > +dockDue ? 'OVERDUE' : 'AKAN DATANG',
    note: dockNote,
  });

  // Propeller Shaft Survey: setiap 5 tahun, hanya untuk kapal berpenggerak (bukan pontoon/barge)
  const propelled = b.propelled ?? !isNonPropelled(b.vessel_type);
  const shaftDone = lastShaft !== null && +lastShaft >= +periodStart;
  if (propelled) {
    const shaftBase = lastShaft ?? lastSpecial ?? periodStart;
    const shaftDue = addM(shaftBase, 60);
    rows.push({
      kind: 'Propeller Shaft Survey',
      due: toDMY(shaftDue),
      range: '',
      postponed: '',
      last: toDMY(lastShaft),
      state: +today > +shaftDue ? 'OVERDUE' : 'AKAN DATANG',
      note: lastShaft ? 'Interval 5 tahun' : 'Interval 5 tahun — tanggal terakhir belum diisi (dihitung dari Special Survey)',
    });
  }

  const dock1Done = lastDock !== null && +lastDock > +(lastSpecial ?? periodStart);
  return {
    rows, expiry, ad, am, periodStart, showA5, nextAnniv, annCount, intDone, dock1Done, shaftDone, propelled, lastDock,
    lastNo, nextNo: nextNoOf(expiry, lastNo), applied,
  };
}
