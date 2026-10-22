import { describe, it, expect } from 'vitest';
import { renewalTables, applicability } from '../lib/classValidity/surveyRules';

const scope = (id: string, rn: number, age: number | null = 12, vt?: string) => {
  const t = renewalTables(rn, age, vt ?? 'General Cargo');
  return [...t.tanks, ...t.ut, ...t.air].find((r) => r.id === id)?.scope;
};

describe('renewalTables — scope tangki per nomor Renewal (I → IV)', () => {
  const row = (id: string, ...exp: string[]) => it(`${id}: ${exp.join(' | ')}`, () => expect([1, 2, 3, 4].map((rn) => scope(id, rn))).toEqual(exp));
  row('T1', 'ALL', 'ALL', 'ALL', 'ALL');
  row('T2', 'NONE', 'NONE', 'ONE', 'ONE');
  row('T3', 'NONE', 'ONE', 'TWO', 'HALF, MIN. 2');
  row('T4', 'NONE', 'ONE', 'ONE', 'TWO');
  row('T5', 'NONE', 'NONE', 'NONE', 'ONE');
  row('T6', 'NONE', 'ONE', 'ALL', 'ALL');
  row('T9', 'NONE', 'NONE', 'REQUIRED', 'REQUIRED');
});

describe('renewalTables — pengukuran ketebalan (UT)', () => {
  it('U2 bertambah: tidak ada → 1 → 2 → 3 section', () => expect([1, 2, 3, 4].map((rn) => scope('U2', rn))).toEqual(['NONE', 'ONE SECTION', 'TWO SECTIONS', 'THREE SECTIONS']));
  it('U4 mulai Renewal III', () => expect([1, 2, 3, 4].map((rn) => scope('U4', rn))).toEqual(['NONE', 'NONE', 'REQUIRED', 'REQUIRED']));
  it.each(['U5', 'U6', 'U7', 'U8', 'U9', 'U10'])('%s hanya mulai Renewal IV', (id) => expect([1, 2, 3, 4].map((rn) => scope(id, rn))).toEqual(['NONE', 'NONE', 'NONE', 'REQUIRED']));
  it('U1 selalu REQUIRED', () => expect([1, 2, 3, 4].map((rn) => scope('U1', rn))).toEqual(['REQUIRED', 'REQUIRED', 'REQUIRED', 'REQUIRED']));
});

describe('renewalTables — Renewal V dan seterusnya memakai aturan Renewal IV', () => {
  // REGRESI: dulu U5–U10 dan T5 memakai `rn === 4`, sehingga Renewal V justru NONE
  it.each(['T2', 'T3', 'T4', 'T5', 'T6', 'T9', 'U2', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9', 'U10'])('%s: rn 5 dan 8 = rn 4', (id) => {
    expect(scope(id, 5)).toBe(scope(id, 4));
    expect(scope(id, 8)).toBe(scope(id, 4));
  });
});

describe('renewalTables — jenis kapal dan umur', () => {
  it('T3 N/A untuk tugboat, pontoon, oil barge, dan jenis kapal kosong', () => {
    for (const vt of ['Tugboat', 'Anchor Handling Tug', 'Pontoon', 'Oil Barge']) expect(scope('T3', 3, 12, vt)).toBe('N/A');
    const t = renewalTables(3, 12, undefined);
    expect(t.tanks.find((r) => r.id === 'T3')?.scope).toBe('N/A');
  });
  it('T3 berlaku untuk kapal kargo', () => expect(scope('T3', 3, 12, 'Bulk Carrier')).toBe('TWO'));
  it('air pipe head Forward: umur ≤5 dua head; >5 semua', () => {
    expect(scope('P1', 4, 5)).toBe('Dua head: 1 port & 1 starboard');
    expect(scope('P1', 4, 6)).toBe('Semua air pipe head');
  });
  it('air pipe head Aft: ≤5 dua head; 6–10 minimal 20%; >10 semua', () => {
    expect([5, 6, 10, 11].map((a) => scope('P2', 4, a))).toEqual(['Dua head: 1 port & 1 starboard', 'Minimal 20% air pipe head', 'Minimal 20% air pipe head', 'Semua air pipe head']);
  });
  it('umur belum diketahui → "—", bukan angka tebakan', () => { expect(scope('P1', 4, null)).toBe('—'); expect(scope('P2', 4, null)).toBe('—'); });
});

describe('U3 hatch cover & coaming (BKI Tabel 3.1 butir 3: mulai Renewal III, hanya kapal dengan palka kargo)', () => {
  it.each(['General Cargo', 'Bulk Carrier', 'Container Ship'])('%s: tidak ada di I–II, REQUIRED di III dan IV+', (vt) => {
    expect([1, 2, 3, 4, 5].map((rn) => scope('U3', rn, 12, vt))).toEqual(['NONE', 'NONE', 'REQUIRED', 'REQUIRED', 'REQUIRED']);
  });
  it.each(['Tugboat', 'Anchor Handling Tug', 'Pontoon', 'Oil Barge', 'Oil Tanker', 'Passenger'])('%s: N/A (tanpa hatch cover palka kargo)', (vt) => {
    for (const rn of [1, 3, 4]) expect(scope('U3', rn, 12, vt)).toBe('N/A');
  });
  it('jenis kapal belum dipilih → N/A', () => expect(renewalTables(3, 12, undefined).ut.find((r) => r.id === 'U3')?.scope).toBe('N/A'));
});

describe('applicability', () => {
  it('fungsi tersedia dan mengembalikan string', () => expect(typeof applicability('Y', undefined, 'General Cargo', 10)).toBe('string'));
});
