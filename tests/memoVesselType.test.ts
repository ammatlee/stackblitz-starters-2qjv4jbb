import { describe, it, expect } from 'vitest';
import { buildMemo, memoSubject, resolveMemo, MEMO0 } from '../lib/memo';
import type { MemoCtx } from '../lib/memo';

const BASE: MemoCtx = {
  vesselName: 'TEST', vType: 'Tugboat', age: 20, rnNo: 4, renewal: true, docking: true, shaft: false, propelled: true,
  shaftSys: 'open', propConn: 'keyed', openCfg: 'five', shaftPlan: '', shaftD: [null], shaftManual: [null], rudderD: [null, null],
  notation: false, anchorO: null, chainO: null, chainLen: null,
};
const texts = (c: MemoCtx) => resolveMemo(buildMemo(c), MEMO0).flatMap((s) => s.items.flatMap((i) => [i.text, ...i.sub]));
const has = (c: MemoCtx, re: RegExp) => texts(c).some((t) => re.test(t));
const barge: MemoCtx = { ...BASE, vType: 'Barge', propelled: false };

describe('memo — kapal tanpa penggerak (tongkang / ponton)', () => {
  it('tidak memuat clearance poros, rudder, stern bush, crankweb, sea trial', () => {
    for (const re of [/clearance poros/, /clearance tongkat kemudi/, /stern bush/, /crankweb/, /sea trial/]) expect(has(barge, re)).toBe(false);
  });
  it('tidak memuat item kamar mesin / steering gear (overboard, emergency stop, got-got)', () => {
    for (const re of [/Overboard valve/, /emergency stop/, /engine room dan steering gear room/]) expect(has(barge, re)).toBe(false);
  });
  it('Propeller Shaft yang tersisa di pilihan survei diabaikan: tidak ada butir poros, dokumen NDT, maupun judul survei poros', () => {
    const c = { ...barge, shaft: true };
    expect(has(c, /Survey poros baling-baling|Poros baling-baling \(ki\/ka\)/)).toBe(false);
    expect(has(c, /NDT Poros/)).toBe(false);
    expect(memoSubject(c)).not.toContain('Poros Baling-Baling');
  });
  it('item yang tetap ada diberi "bila ada" dan tidak menyebut stern frame / rudder', () => {
    expect(has(barge, /Katup laut \(sea valve\), bila ada/)).toBe(true);
    expect(has(barge, /Grating sea chest \(bila ada\)/)).toBe(true);
    expect(has(barge, /stern frame|dan rudder/)).toBe(false);
  });
});

describe('memo — kapal berpenggerak tetap lengkap', () => {
  it('memuat clearance poros, rudder, overboard, emergency, sea trial', () => {
    for (const re of [/clearance poros/, /clearance tongkat kemudi/, /Overboard valve/, /emergency stop/, /sea trial/]) expect(has(BASE, re)).toBe(true);
  });
});

describe('memo — notasi jangkar dan jenis kapal', () => {
  it('tanpa notasi → tidak ada butir jangkar; dengan notasi → ada (juga untuk kapal tanpa penggerak)', () => {
    expect(has(BASE, /Jangkar dan rantai jangkar/)).toBe(false);
    expect(has({ ...barge, notation: true }, /Jangkar dan rantai jangkar/)).toBe(true);
  });
  it('towing winch hanya untuk tugboat / anchor handling tug', () => {
    expect(has(BASE, /Towing winch/)).toBe(true);
    expect(has({ ...BASE, vType: 'Anchor Handling Tug' }, /Towing winch/)).toBe(true);
    expect(has({ ...BASE, vType: 'Bulk Carrier' }, /Towing winch/)).toBe(false);
  });
});
