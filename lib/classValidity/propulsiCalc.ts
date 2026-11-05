/** Kalkulasi Modul 3 (Propulsi): clearance poros, diameter minimum, rudder, jangkar & rantai. Fungsi murni, tanpa React. */
import { num } from './dateUtils';
import { minDiameter, shaftLimits, rudderMax, segelsFor, SEGEL_M, ANCHOR_MIN_RATIO, CHAIN_MIN_RATIO, LINER_WEAR_PCT } from './surveyRules';
import type { DminCfg, ShaftRow, ShaftSys, Verdict } from './surveyRules';

export type PropulsiInput = {
  shafts: ShaftRow[];
  dmin: DminCfg;
  shaftSys: ShaftSys;
  shaftCond: 'new' | 'max';
  wd: { a: string; then: string; now: string };
  anchor: { o: string; a: string };
  chain: { o: string; a: string; len?: string };
  rudder: { d: string; a: string }[];
  propelled: boolean;
  showShaft: boolean;
  showRudder: boolean;
  showAnchor: boolean;
  showDmin: boolean;
};

export function computePropulsi(input: PropulsiInput) {
  const { shafts, dmin, shaftSys, shaftCond, wd, anchor, chain, rudder, propelled, showShaft, showRudder, showAnchor, showDmin } = input;
  const dminRes = shafts.map((r) => {
    const da = num(r.d);
    const m = minDiameter(dmin, da, num(r.p ?? ''), num(r.n ?? ''), num(r.b ?? ''));
    // vonis hanya bila diameter aktual (da) diisi; diameter minimum sendiri tetap dihitung tanpa da (lihat minDiameter)
    const v: Verdict = m.dmin !== null && da !== null ? (da >= m.dmin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
    return { ...m, da, v };
  });
  const shaftRes = shafts.map((r) => {
    const d = num(r.l ?? '') ?? num(r.d); // D = diameter liner bila diisi, kalau tidak diameter poros
    const a = num(r.a);
    const { lo, hi: hiRule } = shaftLimits(shaftSys, shaftCond, d);
    const manual = num(r.m ?? ''); // ITS Part A 1.10.2: instruksi pabrikan boleh menggantikan batas Rules
    const hi = manual !== null ? manual : hiRule;
    let v: Verdict = '';
    if (a !== null && hi !== null) v = lo !== null ? (a >= lo && a <= hi ? 'COMPLIANT' : 'NON-COMPLIANT') : a <= hi ? 'COMPLIANT' : 'NON-COMPLIANT';
    return { d, a, lo, hi, v, manual: manual !== null };
  });
  // Aus shaft liner (hanya sistem oil, ITS Part A 1.10.2 iii): maks. 25% tebal liner di area bearing, 50% di area packing
  const linerRes = shafts.map((r) => {
    const t = num(r.t ?? ''), wb = num(r.wb ?? ''), wp = num(r.wp ?? '');
    const maxB = t !== null && t > 0 ? (t * LINER_WEAR_PCT.bearing) / 100 : null;
    const maxP = t !== null && t > 0 ? (t * LINER_WEAR_PCT.packing) / 100 : null;
    const judge = (w: number | null, mx: number | null): Verdict => (shaftSys === 'oil' && w !== null && mx !== null ? (w <= mx + 1e-9 ? 'COMPLIANT' : 'NON-COMPLIANT') : '');
    return { t, wb, wp, maxB, maxP, pctB: t && wb !== null ? (wb / t) * 100 : null, pctP: t && wp !== null ? (wp / t) * 100 : null, vb: judge(wb, maxB), vp: judge(wp, maxP) };
  });
  const wdA = num(wd.a), wdT = num(wd.then), wdN = num(wd.now);
  const wdFinal = wdA !== null && wdT !== null && wdN !== null ? wdA + (wdN - wdT) : null;
  const ao = num(anchor.o), aa = num(anchor.a), co2 = num(chain.o), ca = num(chain.a);
  const chainLen = num(chain.len ?? '');
  const chainSegels = segelsFor(chainLen);
  const chainLenFinal = chainSegels !== null ? chainSegels * SEGEL_M : null; // panjang rantai yang dipesan per segel utuh
  const anchorMin = ao !== null ? ao * ANCHOR_MIN_RATIO : null;
  const chainMin = co2 !== null ? co2 * CHAIN_MIN_RATIO : null;
  const anchorV: Verdict = aa !== null && anchorMin !== null ? (aa >= anchorMin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
  const chainV: Verdict = ca !== null && chainMin !== null ? (ca >= chainMin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
  const rudderRes = (['Neck Bearing', 'Pintle Bearing'] as const).map((item, i) => {
    const d = num(rudder[i].d);
    const a = num(rudder[i].a);
    const mx = rudderMax(item, d);
    const v: Verdict = a !== null && mx !== null ? (a <= mx ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
    return { item, d, a, mx, v };
  });
  // kapal tanpa penggerak: hanya jangkar dan rantai jangkar yang dinilai
  const all: Verdict[] = [...(propelled ? [...(showShaft ? [...shaftRes.map((x) => x.v), ...linerRes.flatMap((x) => [x.vb, x.vp]).filter((v) => v !== '')] : []), ...(showRudder ? rudderRes.map((x) => x.v) : []), ...(showDmin ? dminRes.map((x) => x.v) : [])] : []), ...(showAnchor ? [anchorV, chainV] : [])];
  return { shaftRes, linerRes, dminRes, wdFinal, anchorMin, chainMin, chainLen, chainSegels, chainLenFinal, anchorV, chainV, rudderRes, measured: all.filter((v) => v !== '').length, fails: all.filter((v) => v === 'NON-COMPLIANT').length, total: all.length };
}

export type PropulsiResult = ReturnType<typeof computePropulsi>;
