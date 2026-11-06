import { describe, it, expect } from 'vitest';
import { RENEWAL, applicability } from '../lib/classValidity/surveyRules';

describe('Renewal — pushing / being pushed (BKI 1.3.2.18), untuk tug dan tongkang', () => {
  const push = RENEWAL.find((i) => i.s === 'Pushing / Being Pushed Arrangement');
  it('ada di akhir daftar (nomor item lama tidak bergeser)', () => {
    expect(push).toBeDefined();
    expect(RENEWAL[RENEWAL.length - 1].s).toBe('Pushing / Being Pushed Arrangement');
  });
  it.each(['Tugboat', 'Anchor Handling Tug', 'Barge', 'Pontoon'])('%s: tampil', (vt) => expect(applicability(push!.a, push!.g, vt, 12)).not.toBe('N/A'));
});

describe('Renewal — chain locker', () => {
  it('uji pemompaan chain locker disebut di item Anchors & Chain Cables', () => {
    expect(RENEWAL.find((i) => i.s === 'Anchors & Chain Cables')!.t).toMatch(/pemompaan chain locker/);
  });
});
