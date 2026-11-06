import { describe, it, expect } from 'vitest';
import { INTERMEDIATE, applicability } from '../lib/classValidity/surveyRules';

// BKI Pt.1 Vol.I Sec.3, 1.2.2.3: internal examination of selected cargo holds —
// dry cargo ships over 15 years old, other than bulk carriers or general dry cargo ships.
describe('Intermediate — Cargo Holds (1.2.2.3)', () => {
  const it0 = INTERMEDIATE.find((i) => i.s === 'Cargo Holds')!;
  const ap = (vt: string, age: number | null) => applicability(it0.a, it0.g, vt, age, it0.x);
  it('hanya kapal kargo kering > 15 tahun (mis. Container Ship)', () => {
    expect(ap('Container Ship', 16)).not.toBe('N/A');
    expect(ap('Container Ship', 15)).toBe('N/A');
    expect(ap('Container Ship', 8)).toBe('N/A');
  });
  it('bulk carrier, general cargo, dan tanker dikecualikan', () => {
    for (const vt of ['Bulk Carrier', 'General Cargo', 'Oil Tanker', 'Chemical Tanker', 'Gas Carrier']) expect(ap(vt, 20)).toBe('N/A');
  });
  it('tugboat dan tongkang tidak terkena', () => {
    for (const vt of ['Tugboat', 'Barge', 'Oil Barge']) expect(ap(vt, 20)).toBe('N/A');
  });
});
