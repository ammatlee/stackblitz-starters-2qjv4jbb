import { describe, it, expect } from 'vitest';
import { MATERIAL_ITEMS, WELDING, materialTipe, parseCell, itemsRequired, circularApplies } from '../lib/materialRules';

describe('Circular 185 — tipe material', () => {
  it('L(20) selalu tipe D, termasuk kapal tanpa penggerak', () => {
    expect(materialTipe({ notasiL20: true, propelled: false, international: false, gt: 100 })).toBe('D');
    expect(materialTipe({ notasiL20: true, propelled: true, international: true, gt: 900 })).toBe('D');
  });
  it('kapal tanpa penggerak tanpa L(20) = C', () => {
    expect(materialTipe({ notasiL20: false, propelled: false, international: false, gt: 3000 })).toBe('C');
  });
  it('internasional GT >= 500 = A; GT < 500 = B', () => {
    expect(materialTipe({ notasiL20: false, propelled: true, international: true, gt: 500 })).toBe('A');
    expect(materialTipe({ notasiL20: false, propelled: true, international: true, gt: 499 })).toBe('B');
  });
  it('non-internasional GT >= 500 = B; GT < 500 = C', () => {
    expect(materialTipe({ notasiL20: false, propelled: true, international: false, gt: 500 })).toBe('B');
    expect(materialTipe({ notasiL20: false, propelled: true, international: false, gt: 120 })).toBe('C');
  });
  it('GT kosong untuk kapal bermesin = belum bisa ditentukan', () => {
    expect(materialTipe({ notasiL20: false, propelled: true, international: false, gt: null })).toBeNull();
  });
});

describe('Circular 185 — data', () => {
  it('welding shop approval: tipe C dan D tidak wajib', () => {
    expect(WELDING.weldingShop).toEqual({ A: 'BKI', B: 'BKI', C: null, D: null });
    expect(WELDING.wps.C).toBe('BKI/IACS');
  });
  it('84 nomor produk lengkap', () => {
    const nos = new Set(MATERIAL_ITEMS.map((i) => i.no));
    expect(nos.size).toBe(84);
    for (let n = 1; n <= 84; n++) expect(nos.has(n)).toBe(true);
  });
  it('contoh baris: plate dan diesel engine', () => {
    const plate = MATERIAL_ITEMS.find((i) => i.no === 1)!;
    expect(plate.B[2]).toBe('X2');
    const eng = MATERIAL_ITEMS.find((i) => i.no === 32)!;
    expect(eng.C).toEqual(['-', 'V6', 'M']);
    expect(eng.D).toBe('M');
  });
  it('parseCell membaca kode dan nomor catatan', () => {
    expect(parseCell('V1,3')).toEqual({ code: 'V', notes: [1, 3] });
    expect(parseCell('X')).toEqual({ code: 'X', notes: [] });
    expect(parseCell('-')).toBeNull();
  });
  it('tipe D punya lebih sedikit item daripada tipe A', () => {
    expect(itemsRequired('D').length).toBeLessThan(itemsRequired('A').length);
  });
  it('circular berlaku mulai 15 Des 2022', () => {
    expect(circularApplies('2022-12-14')).toBe(false);
    expect(circularApplies('2022-12-15')).toBe(true);
    expect(circularApplies(null)).toBe(false);
  });
});
