/**
 * Method / extension survei poros per agenda tersimpan di snapshot form (kolom data, kunci shaftPlan).
 * Diambil lewat query terpisah dan gagal dengan tenang (tanpa data plan, survei poros dianggap survei penuh),
 * jadi pemuatan data utama tidak ikut terganggu.
 */
export type PlanRow = { vessel_id: string | null; agenda_no: string; plan: string | null };

export const plansQuery = 'vessel_id,agenda_no,plan:data->>shaftPlan';

export function withPlans<T extends { vessel_id: string | null; agenda_no: string }>(ags: T[], rows: PlanRow[] | null | undefined): (T & { plan: string | null })[] {
  const m = new Map<string, string | null>();
  for (const r of rows ?? []) m.set(`${r.vessel_id}|${r.agenda_no}`, r.plan || null);
  return ags.map((a) => ({ ...a, plan: m.get(`${a.vessel_id}|${a.agenda_no}`) ?? null }));
}

/** Pilihan Method/extension untuk pencatatan manual. */
export const SHAFT_PLAN_OPTS: [string, string][] = [
  ['', '— tidak dicatat (dianggap survei penuh) —'],
  ['M1', 'Method 1'],
  ['M2', 'Method 2'],
  ['M3', 'Method 3'],
  ['M4', 'Method 4 (sistem open)'],
  ['E25', 'Extension 2,5 tahun'],
  ['E1', 'Extension 1 tahun'],
  ['E3', 'Extension 3 bulan'],
];
export const shaftPlanLabel = (k: string | null | undefined) => SHAFT_PLAN_OPTS.find((o) => o[0] === k)?.[1] ?? '';
