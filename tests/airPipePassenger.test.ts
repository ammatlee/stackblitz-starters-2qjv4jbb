import { describe, it, expect } from 'vitest';
import { RENEWAL, applicability, renewalTables } from '../lib/classValidity/surveyRules';

// BKI Pt.1 Vol.I Sec.3, 1.3.2.13: air pipe head diperiksa pada semua kapal kecuali kapal penumpang.
describe('Air pipe head — kapal penumpang dikecualikan', () => {
  const item = RENEWAL.find((i) => i.s === 'Automatic Air Pipe Heads')!;
  it('item checklist N/A untuk kapal penumpang, berlaku untuk jenis lain', () => {
    for (const vt of ['Passenger Ship', 'Ro-Ro Passenger Ship']) expect(applicability(item.a, item.g, vt, 8)).toBe('N/A');
    for (const vt of ['Tugboat', 'Barge', 'General Cargo']) expect(applicability(item.a, item.g, vt, 8)).not.toBe('N/A');
  });
  it('tabel air pipe head N/A untuk kapal penumpang, terisi untuk tugboat/tongkang', () => {
    expect(renewalTables(1, 3, 'Passenger Ship').air.map((r) => r.scope)).toEqual(['N/A', 'N/A']);
    expect(renewalTables(1, 3, 'Tugboat').air.map((r) => r.scope)).toEqual(['Dua head: 1 port & 1 starboard', 'Dua head: 1 port & 1 starboard']);
    expect(renewalTables(2, 8, 'Barge').air.map((r) => r.scope)).toEqual(['Semua air pipe head', 'Minimal 20% air pipe head']);
  });
});
