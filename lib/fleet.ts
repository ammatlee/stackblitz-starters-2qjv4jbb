/**
 * Dashboard Armada: ringkasan jatuh tempo survei semua kapal.
 * Fungsi murni (tanpa Supabase/React) di atas computeSurveyStatus, jadi angkanya selalu sama dengan halaman Class Validity.
 */
import { computeSurveyStatus, toDMY } from './surveyStatus';
import type { Baseline, Ev, StatusRow } from './surveyStatus';

export type VesselInput = Baseline & { id: string; name: string; vessel_type: string | null };
export type AgInput = { vessel_id: string; agenda_no: string; surveys: string[] | null; inspection_start: string | null; inspection_completion: string | null; scenario: string | null; finished_at: string | null };
export type EvInput = { vessel_id: string; surveys: string[] | null; completion: string; created_at: string };

/** Agenda yang di-Finish + pembaruan manual milik satu kapal (sama dengan yang dipakai halaman Class Validity). */
export const buildEvents = (id: string, ags: AgInput[], mev: EvInput[]): Ev[] => [
  ...ags
    .filter((a) => a.vessel_id === id)
    .map((a) => ({ agenda_no: a.agenda_no, start: a.inspection_start, completion: a.inspection_completion, surveys: a.surveys ?? [], scenario: a.scenario, finished_at: a.finished_at })),
  ...mev
    .filter((m) => m.vessel_id === id)
    .map((m) => ({ agenda_no: 'Manual', start: null, completion: m.completion, surveys: m.surveys ?? [], scenario: null, finished_at: m.created_at })),
];

export type Urgency = 'OVERDUE' | 'DALAM WINDOW' | 'AKAN DATANG';
export type Pending = { kind: string; urgency: Urgency; deadline: Date; days: number; windowStart: Date | null; note?: string };
export type FleetItem = {
  id: string;
  name: string;
  type: string;
  expiry: Date | null;
  pending: Pending[]; // urut dari yang paling mendesak
  next: Pending | null;
};

const DAY = 86400000;
const parseDMY = (s: string): Date | null => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
};

/** Tanggal lokal perangkat "hari ini" sebagai UTC tengah malam (supaya hitungan hari tidak bergeser oleh jam). */
export const todayUTC = (now: Date = new Date()) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

/** Batas akhir & awal window sebuah baris status; null bila baris tidak punya tanggal (SELESAI, BERSAMA RENEWAL). */
function rowDates(r: StatusRow): { deadline: Date; start: Date | null } | null {
  if (r.range) {
    const [a, b] = r.range.split(' s/d ');
    const start = parseDMY(a ?? ''), end = parseDMY(b ?? '');
    return end ? { deadline: end, start } : null;
  }
  const due = parseDMY(r.due);
  if (!due) return null;
  const post = parseDMY(r.postponed);
  return { deadline: post && +post > +due ? post : due, start: null };
}

export function summarizeVessel(v: VesselInput, evs: Ev[], today: Date): FleetItem {
  const res = computeSurveyStatus(v, evs, today);
  const pending: Pending[] = [];
  if (res) {
    for (const r of res.rows) {
      if (r.state === 'SELESAI' || r.state === 'BERSAMA RENEWAL') continue;
      const d = rowDates(r);
      if (!d) continue;
      const days = Math.round((+d.deadline - +today) / DAY);
      // lewat batas hanya bila benar-benar sudah melewati tanggalnya (hari-H masih dihitung berjalan)
      const urgency: Urgency = days < 0 ? 'OVERDUE' : days === 0 || r.state !== 'AKAN DATANG' ? 'DALAM WINDOW' : 'AKAN DATANG';
      pending.push({ kind: r.kind, urgency, deadline: d.deadline, days, windowStart: d.start, note: r.note });
    }
    pending.sort((a, b) => +a.deadline - +b.deadline);
  }
  return { id: v.id, name: v.name, type: v.vessel_type ?? '', expiry: res ? res.expiry : null, pending, next: pending[0] ?? null };
}

export function buildFleet(vessels: VesselInput[], ags: AgInput[], mev: EvInput[], today: Date): FleetItem[] {
  return vessels
    .map((v) => summarizeVessel(v, buildEvents(v.id, ags, mev), today))
    .sort((a, b) => {
      if (!a.next && !b.next) return a.name.localeCompare(b.name);
      if (!a.next) return 1;
      if (!b.next) return -1;
      return +a.next.deadline - +b.next.deadline || a.name.localeCompare(b.name);
    });
}

export type FleetFilter = 'all' | 'overdue' | 'd30' | 'd90';

/** Kapal lolos filter bila ada survei yang memenuhi syaratnya. */
export const matchesFilter = (it: FleetItem, f: FleetFilter): boolean => {
  if (f === 'all') return true;
  if (f === 'overdue') return it.pending.some((p) => p.urgency === 'OVERDUE');
  const lim = f === 'd30' ? 30 : 90;
  return it.pending.some((p) => p.days >= 0 && p.days <= lim);
};

export type FleetCounts = { total: number; overdue: number; d30: number; d90: number; noData: number };
export const countFleet = (items: FleetItem[]): FleetCounts => ({
  total: items.length,
  overdue: items.filter((i) => matchesFilter(i, 'overdue')).length,
  d30: items.filter((i) => matchesFilter(i, 'd30')).length,
  d90: items.filter((i) => matchesFilter(i, 'd90')).length,
  noData: items.filter((i) => i.expiry === null).length,
});

export const dmy = (d: Date | null) => toDMY(d);
export const daysLabel = (days: number) => (days < 0 ? `lewat ${-days} hari` : days === 0 ? 'hari ini' : `${days} hari lagi`);
