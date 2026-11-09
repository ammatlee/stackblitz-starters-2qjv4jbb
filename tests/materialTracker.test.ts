import { describe, it, expect } from 'vitest';
import { MATERIAL_ITEMS, itemsRequired } from '../lib/materialRules';
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
    expect(trackerItems('C')).toEqual(itemsRequired('C'));
    expect(trackerItems(null)).toEqual(MATERIAL_ITEMS);
    expect(trackerItems('C', true)).toEqual(MATERIAL_ITEMS);
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
