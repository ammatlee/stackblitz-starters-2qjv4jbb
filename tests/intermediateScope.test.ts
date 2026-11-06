import { describe, it, expect } from 'vitest';
import { INTERMEDIATE, applicability } from '../lib/classValidity/surveyRules';

describe('Intermediate — Selected Cargo Spaces (BKI 1.2.2.4: kapal > 10 tahun, kecuali kargo kering saja / gas carrier)', () => {
  const it4 = INTERMEDIATE.find((i) => i.s === 'Selected Cargo Spaces')!;
  const ap = (vt: string, age: number | null) => applicability(it4.a, it4.g, vt, age, it4.x);
  it('umur ≤ 10 tahun: N/A', () => { for (const a of [3, 10]) expect(ap('Tugboat', a)).toBe('N/A'); });
  it('umur > 10 tahun: berlaku untuk jenis kapal lain', () => { for (const vt of ['Tugboat', 'Passenger Ship', 'Ro-Ro Cargo Ship']) expect(ap(vt, 11)).not.toBe('N/A'); });
  it('kargo kering saja dan gas carrier: N/A pada umur berapa pun', () => {
    for (const vt of ['General Cargo', 'Bulk Carrier', 'Container Ship', 'Gas Carrier']) for (const a of [11, 25]) expect(ap(vt, a)).toBe('N/A');
  });
  it('umur belum diketahui: tidak disembunyikan karena umur', () => expect(ap('Tugboat', null)).not.toBe('N/A'));
});
