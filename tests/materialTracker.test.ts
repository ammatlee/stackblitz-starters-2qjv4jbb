import { describe, it, expect } from 'vitest';
import { MATERIAL_ITEMS, itemsRequired, weldingItemsRequired } from '../lib/materialRules';
import { itemKey, progressOf, trackerItems } from '../lib/materialTracker';
import type { MatStatusRow } from '../lib/materialTracker';

describe('Pelacak material — penanda item', () => {
  it('itemKey unik untuk seluruh item', () => {
    const keys = MATERIAL_ITEMS.map(itemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('item tanpa sub-jenis memakai nomor saja', () => {
    expect(itemKey({ ...MATERIAL_ITEMS[0], no: 4, kind: undefined })).toBe('4');
  });
});

describe('Pelacak material — daftar dan kemajuan', () => {
  it('tipe dipakai untuk menyaring; tipe null atau all = seluruh daftar', () => {
    expect(trackerItems('C')).toEqual([...itemsRequired('C'), ...weldingItemsRequired('C')]);
    expect(trackerItems(null)).toEqual(MATERIAL_ITEMS);
    expect(trackerItems('C', true)).toEqual([...MATERIAL_ITEMS, ...weldingItemsRequired('C')]);
  });
  it('item pengelasan (85–87) hanya muncul bila disyaratkan untuk tipe', () => {
    const nos = (t: 'A' | 'B' | 'C' | 'D') => weldingItemsRequired(t).map((i) => i.no);
    expect(nos('A')).toEqual([85, 86, 87]);
    expect(nos('B')).toEqual([85, 86, 87]);
    expect(nos('C')).toEqual([86, 87]);
    expect(nos('D')).toEqual([]);
  });
  it('kemajuan mengeluarkan item tidak_ada dari pembagi', () => {
    const items = MATERIAL_ITEMS.slice(0, 4);
    const rows = new Map<string, MatStatusRow>([
      [itemKey(items[0]), { item_key: itemKey(items[0]), status: 'diterima', cert_no: null, note: null }],
      [itemKey(items[1]), { item_key: itemKey(items[1]), status: 'tidak_ada', cert_no: null, note: null }],
    ]);
    expect(progressOf(items, rows)).toEqual({ total: 3, diterima: 1, belum: 2, tidakAda: 1, pct: 33 });
  });
  it('daftar kosong tidak membagi nol', () => {
    expect(progressOf([], new Map()).pct).toBe(0);
  });
});

describe('Pelacak material — saringan menurut jenis kapal', () => {
  const nos = (items: { no: number }[]) => new Set(items.map((i) => i.no));
  it('tongkang: item tenaga penggerak, kemudi, dan TOW disembunyikan; jangkar dan pelat tetap', () => {
    const n = nos(trackerItems('C', false, { vesselType: 'Barge', propelled: false }));
    [6, 27, 38, 50, 9, 17].forEach((x) => expect(n.has(x)).toBe(false));
    [1, 11, 12].forEach((x) => expect(n.has(x)).toBe(true));
  });
  it('tugboat: palka dan tanker disembunyikan; mesin, poros, dan TOW tetap', () => {
    const n = nos(trackerItems('B', false, { vesselType: 'Tugboat', propelled: true }));
    [9, 10, 17, 19, 35, 51].forEach((x) => expect(n.has(x)).toBe(false));
    [32, 38, 50, 27, 62].forEach((x) => expect(n.has(x)).toBe(true));
  });
  it('oil barge tetap menampilkan coating cargo oil tank', () => {
    expect(nos(trackerItems('C', false, { vesselType: 'Oil Barge', propelled: false })).has(17)).toBe(true);
  });
  it('jenis kapal lain tidak disaring; tampilkan semua mengabaikan saringan', () => {
    expect(trackerItems('B', false, { vesselType: 'General Cargo', propelled: true })).toEqual([...itemsRequired('B'), ...weldingItemsRequired('B')]);
    expect(trackerItems('C', true, { vesselType: 'Barge', propelled: false })).toEqual([...MATERIAL_ITEMS, ...weldingItemsRequired('C')]);
  });
  it('item pengelasan tidak ikut disaring jenis kapal', () => {
    const n = new Set(trackerItems('C', false, { vesselType: 'Barge', propelled: false }).map((i) => i.no));
    expect(n.has(86) && n.has(87)).toBe(true);
  });
});

