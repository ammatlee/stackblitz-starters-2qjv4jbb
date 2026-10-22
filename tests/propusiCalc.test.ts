import { describe, it, expect } from 'vitest';
import { computePropulsi, type PropulsiInput } from '../lib/classValidity/propulsiCalc';
import { DMIN0, SHAFT0, minDiameter, shaftLimits, rudderMax, ANCHOR_MIN_RATIO, CHAIN_MIN_RATIO } from '../lib/classValidity/surveyRules';

const BASE: PropulsiInput = {
  shafts: [{ ...SHAFT0 }], dmin: { ...DMIN0 }, shaftSys: 'oil', shaftCond: 'new',
  wd: { a: '', then: '', now: '' }, anchor: { o: '', a: '' }, chain: { o: '', a: '' },
  rudder: [{ d: '', a: '' }, { d: '', a: '' }], propelled: true, showShaft: true, showRudder: true, showAnchor: true, showDmin: true,
};
const run = (o: Partial<PropulsiInput>) => computePropulsi({ ...BASE, ...o });

describe('shaftLimits — clearance bantalan poros (mm)', () => {
  const near = (x: number | null, y: number) => expect(x).toBeCloseTo(y, 6);
  it('open, baru, D=100: 0,5 – 0,9', () => { const l = shaftLimits('open', 'new', 100); near(l.lo, 0.5); near(l.hi, 0.9); });
  it('open, maksimum, D=100: hanya batas atas 3,5', () => { const l = shaftLimits('open', 'max', 100); expect(l.lo).toBeNull(); near(l.hi, 3.5); });
  it('oil, baru, D=100: 0,4 – 0,6', () => { const l = shaftLimits('oil', 'new', 100); near(l.lo, 0.4); near(l.hi, 0.6); });
  it('oil, maksimum, D=100: batas atas 0,8', () => near(shaftLimits('oil', 'max', 100).hi, 0.8));
  it('fresh water → tanpa batas Rules', () => expect(shaftLimits('fw', 'new', 100)).toEqual({ lo: null, hi: null }));
  it('diameter kosong → tanpa batas', () => expect(shaftLimits('oil', 'new', null)).toEqual({ lo: null, hi: null }));
});

describe('computePropulsi — vonis clearance poros', () => {
  const v = (a: string, extra: Partial<PropulsiInput['shafts'][0]> = {}) => run({ shafts: [{ ...SHAFT0, d: '100', a, ...extra }] }).shaftRes[0].v;
  it('di dalam batas → COMPLIANT', () => expect(v('0.5')).toBe('COMPLIANT'));
  it('batas atas tepat (0,6) → COMPLIANT', () => expect(v('0.6')).toBe('COMPLIANT'));
  it('di atas batas atas → NON-COMPLIANT', () => expect(v('0.61')).toBe('NON-COMPLIANT'));
  it('di bawah batas bawah → NON-COMPLIANT', () => expect(v('0.39')).toBe('NON-COMPLIANT'));
  it('koma desimal "0,5" dibaca 0,5', () => expect(v('0,5')).toBe('COMPLIANT'));
  it('batas manual pabrikan menggantikan batas atas Rules', () => expect(v('0.9', { m: '1.0' })).toBe('COMPLIANT'));
  it('diameter liner dipakai bila diisi: liner 200 → batas 0,5 – 0,7', () => expect(v('0.65', { l: '200' })).toBe('COMPLIANT'));
  it('clearance belum diisi → belum dinilai', () => expect(v('')).toBe(''));
  it('kondisi maksimum: tanpa batas bawah, 0,1 masih COMPLIANT', () => expect(run({ shaftCond: 'max', shafts: [{ ...SHAFT0, d: '100', a: '0.1' }] }).shaftRes[0].v).toBe('COMPLIANT'));
});

describe('minDiameter — diameter minimum poros (Rules)', () => {
  // nilai acuan dihitung terpisah (bukan dari kode): d = F·k·∛((P/n)·Cw/(1−(di/da)⁴)), Cw = 560/(Rm+160)
  it('poros propeller k=1,22 F=100, P=1000 kW, n=300 → 164,6 mm', () => {
    expect(minDiameter({ ...DMIN0 }, 170, 1000, 300, null).dmin).toBeCloseTo(164.605, 2);
  });
  it('poros antara (k=1,0, F=100), P=2000, n=400, tanpa bore → 144,92 mm', () => {
    expect(minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100' }, 200, 2000, 400, null).dmin).toBeCloseTo(144.918, 2);
  });
  it('poros antara berlubang di/da = 0,6 → 151,78 mm', () => {
    expect(minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100' }, 200, 2000, 400, 120).dmin).toBeCloseTo(151.781, 2);
  });
  it('bore ratio ≤ 0,4 tidak mengubah hasil', () => {
    const a = minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100' }, 200, 2000, 400, null).dmin;
    const b = minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100' }, 200, 2000, 400, 80).dmin;
    expect(b).toBeCloseTo(a as number, 9);
  });
  it('daya atau putaran 0 → tidak dihitung', () => {
    expect(minDiameter({ ...DMIN0 }, 170, 0, 300, null).dmin).toBeNull();
    expect(minDiameter({ ...DMIN0 }, 170, 1000, 0, null).dmin).toBeNull();
  });
  // REGRESI: dulu F kosong → Number('') = 0 → dmin 0 → semua poros COMPLIANT
  it('F kosong (poros non-propeller) → dmin null, bukan 0', () => {
    expect(minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100', f: '' }, 200, 1000, 300, null).dmin).toBeNull();
  });
  it('F bukan angka → dmin null, bukan NaN', () => {
    expect(minDiameter({ ...DMIN0, kind: 'inter', kId: 'i100', f: 'abc' }, 200, 1000, 300, null).dmin).toBeNull();
  });
  it('F kosong tidak membuat poros 50 mm dinyatakan COMPLIANT', () => {
    const r = run({ dmin: { ...DMIN0, kind: 'inter', kId: 'i100', f: '' }, shafts: [{ ...SHAFT0, d: '50', p: '1000', n: '300' }] });
    expect(r.dminRes[0].v).toBe('');
  });
  it('vonis: da di bawah dmin → NON-COMPLIANT, di atas → COMPLIANT', () => {
    const mk = (d: string) => run({ shafts: [{ ...SHAFT0, d, p: '1000', n: '300' }] }).dminRes[0].v;
    expect(mk('160')).toBe('NON-COMPLIANT');
    expect(mk('170')).toBe('COMPLIANT');
  });
});

describe('rudderMax — clearance bantalan kemudi', () => {
  it('Neck: 0,01·d + 2, maksimum 4', () => { expect(rudderMax('Neck Bearing', 100)).toBeCloseTo(3, 9); expect(rudderMax('Neck Bearing', 250)).toBe(4); expect(rudderMax('Neck Bearing', 300)).toBe(4); });
  it.each([[49, 3], [50, 5], [100, 5], [150, 5.5], [200, 6], [300, 6]])('Pintle d=%i → %d', (d, mx) => expect(rudderMax('Pintle Bearing', d)).toBeCloseTo(mx, 9));
  it('diameter kosong → null', () => expect(rudderMax('Pintle Bearing', null)).toBeNull());
  it('vonis neck: 3,0 pada d=100 COMPLIANT, 3,01 NON-COMPLIANT', () => {
    const v = (a: string) => run({ rudder: [{ d: '100', a }, { d: '', a: '' }] }).rudderRes[0].v;
    expect(v('3')).toBe('COMPLIANT');
    expect(v('3.01')).toBe('NON-COMPLIANT');
  });
});

describe('jangkar dan rantai', () => {
  it('rasio minimum', () => { expect(ANCHOR_MIN_RATIO).toBe(0.88); expect(CHAIN_MIN_RATIO).toBe(0.9); });
  it('jangkar 1000 kg: 880 COMPLIANT, 879 NON-COMPLIANT', () => {
    expect(run({ anchor: { o: '1000', a: '880' } }).anchorV).toBe('COMPLIANT');
    expect(run({ anchor: { o: '1000', a: '879' } }).anchorV).toBe('NON-COMPLIANT');
  });
  it('rantai Ø50: 45 COMPLIANT, 44,9 NON-COMPLIANT', () => {
    expect(run({ chain: { o: '50', a: '45' } }).chainV).toBe('COMPLIANT');
    expect(run({ chain: { o: '50', a: '44.9' } }).chainV).toBe('NON-COMPLIANT');
  });
  it('berat poros: wdFinal = a + (now − then)', () => {
    expect(run({ wd: { a: '10', then: '4', now: '7' } }).wdFinal).toBe(13);
    expect(run({ wd: { a: '10', then: '', now: '7' } }).wdFinal).toBeNull();
  });
});

describe('computePropulsi — hitungan ringkasan', () => {
  it('kapal tanpa penggerak: hanya jangkar dan rantai yang dihitung', () => {
    const r = run({ propelled: false, shafts: [{ ...SHAFT0, d: '100', a: '9' }], anchor: { o: '1000', a: '500' }, chain: { o: '50', a: '50' } });
    expect(r.total).toBe(2);
    expect(r.measured).toBe(2);
    expect(r.fails).toBe(1);
  });
  it('item yang disembunyikan tidak ikut dihitung', () => {
    const r = run({ showShaft: false, showRudder: false, showDmin: false, anchor: { o: '1000', a: '880' }, chain: { o: '50', a: '45' } });
    expect(r.total).toBe(2);
    expect(r.fails).toBe(0);
  });
  it('satu poros gagal + satu rudder lolos → fails 1 dari measured 2', () => {
    const r = run({ showAnchor: false, showDmin: false, shafts: [{ ...SHAFT0, d: '100', a: '2' }], rudder: [{ d: '100', a: '2' }, { d: '', a: '' }] });
    expect(r.measured).toBe(2);
    expect(r.fails).toBe(1);
  });
});
