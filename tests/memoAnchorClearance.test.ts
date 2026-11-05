import { describe, it, expect } from 'vitest';
import { buildMemo, memoGaps, resolveMemo, shaftMaxes, MEMO0 } from '../lib/memo';
import type { MemoCtx } from '../lib/memo';
import { segelsFor, SEGEL_M } from '../lib/classValidity/surveyRules';

const CTX: MemoCtx = {
  vesselName: 'KARYA AGUNG 23', vType: 'Tugboat', age: 20, rnNo: 4, renewal: true, docking: true, shaft: false, propelled: true,
  shaftSys: 'open', propConn: '', openCfg: '', shaftPlan: '', shaftD: [null], shaftManual: [null], rudderD: [null, null],
  notation: true, anchorO: null, chainO: null, chainLen: null,
};
const texts = (c: MemoCtx) => resolveMemo(buildMemo(c), MEMO0).flatMap((s) => s.items.flatMap((i) => [i.text, ...i.sub]));
const has = (c: MemoCtx, re: RegExp) => texts(c).some((t) => re.test(t));

describe('segelsFor — jumlah segel dari panjang minimum rantai', () => {
  it.each([[137.5, 5], [137.6, 6], [1, 1], [302, 11], [27.5, 1], [0.1, 1]])('%s m → %s segel', (m, n) => expect(segelsFor(m)).toBe(n));
  it('kosong / nol / negatif → null', () => { expect(segelsFor(null)).toBeNull(); expect(segelsFor(0)).toBeNull(); expect(segelsFor(-5)).toBeNull(); });
  it('hasil segel × 27,5 selalu ≥ panjang minimum', () => { for (const m of [10, 99.9, 165, 302.4]) expect(segelsFor(m)! * SEGEL_M).toBeGreaterThanOrEqual(m); });
});

describe('Memo — jangkar & rantai hanya untuk kapal bernotasi', () => {
  it('tanpa notasi: tidak ada butir jangkar sama sekali', () => {
    const t = texts({ ...CTX, notation: false });
    expect(t.some((x) => /jangkar/i.test(x))).toBe(false);
  });
  it('dengan notasi: butir jangkar ada', () => expect(has(CTX, /Jangkar dan rantai jangkar agar diturunkan/)).toBe(true));
  it('panjang minimum 302 m → 11 segel = 302,5 m otomatis', () => {
    const c = { ...CTX, chainLen: 302, chainO: 19, anchorO: 400 };
    expect(has(c, /minimum 302 m \(11 segel = 302,5 m\)/)).toBe(true);
    expect(has(c, /diameter rantai 19 mm dan minimum diameter: 16,72 mm/)).toBe(true);
    expect(has(c, /Berat jangkar 400 kg, minimum berat yang dipersyaratkan 360 kg/)).toBe(true);
  });
  it('panjang belum diisi → titik-titik, tidak error', () => expect(has(CTX, /minimum …… m \(…… segel\)/)).toBe(true));
});

describe('Memo — clearance: hanya angka maksimum, tanpa rumus', () => {
  const rud = { ...CTX, rudderD: [100, 120] as (number | null)[] };
  it('rudder: neck & pintle berupa angka, tanpa rumus', () => {
    const t = texts(rud).find((x) => x.includes('tongkat kemudi'))!;
    expect(t).toContain('Clearance maksimum untuk kapal ini: neck bearing 3 mm, pintle bearing 5,2 mm.');
    expect(t).not.toMatch(/0,01|·|d <|maks\. 4,0/);
  });
  it('diameter rudder kosong → titik-titik + peringatan menuju tab Propulsi', () => {
    expect(texts(CTX).find((x) => x.includes('tongkat kemudi'))).toContain('neck bearing …… mm, pintle bearing …… mm');
    const g = memoGaps(CTX).filter((x) => x.tab === 'propulsi').map((x) => x.text).join(' ');
    expect(g).toMatch(/neck bearing/); expect(g).toMatch(/pintle bearing/); expect(g).toMatch(/Poros baling-baling/);
  });
  it('poros open loop D=100 → maks. 3,5 mm tanpa rumus', () => {
    const c = { ...CTX, shaftD: [100] };
    const t = texts(c).find((x) => x.includes('clearance poros baling-baling'))!;
    expect(t).toContain('Clearance maksimum untuk kapal ini: 3,5 mm.');
    expect(t).not.toMatch(/0,01·D|Max\. clearance =/);
  });
  it('poros ganda diberi nomor', () => {
    const t = texts({ ...CTX, shaftD: [100, 150] }).find((x) => x.includes('clearance poros baling-baling'))!;
    expect(t).toContain('poros 1: 3,5 mm; poros 2: 4 mm');
  });
  it('manual pabrikan menggantikan Rules, dan satu-satunya sumber untuk closed loop fresh water', () => {
    expect(shaftMaxes({ shaftSys: 'oil', shaftD: [100], shaftManual: [0.7] })).toEqual([0.7]);
    expect(shaftMaxes({ shaftSys: 'fw', shaftD: [100], shaftManual: [null] })).toEqual([null]);
    expect(shaftMaxes({ shaftSys: 'fw', shaftD: [100], shaftManual: [0.9] })).toEqual([0.9]);
  });
  it('tidak ada peringatan bila semua diameter terisi', () => {
    const full = { ...CTX, rudderD: [100, 120] as (number | null)[], shaftD: [100], chainO: 19, anchorO: 400, chainLen: 300 };
    expect(memoGaps(full)).toEqual([]);
  });
});
