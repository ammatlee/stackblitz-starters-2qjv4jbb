import { describe, expect, it } from 'vitest';
import { STAGES, applicableItems, firstOpenStage, hiddenItemCount, isStageDone, overallProgress, stageItemKey, stageProgress } from '../lib/newbuildingStages';
import type { StageRow } from '../lib/newbuildingStages';

const tug = { tipe: 'B' as const, propelled: true };
const barge = { tipe: 'C' as const, propelled: false };
const row = (key: string, status: StageRow['status']): [string, StageRow] => [key, { item_key: key, status, done_date: null, note: null }];

describe('Tahapan bangunan baru', () => {
  it('urutan tahap mengikuti alur: 1, 2, 3A–3E, 4', () => {
    expect(STAGES.map((s) => s.code)).toEqual(['1', '2', '3A', '3B', '3C', '3D', '3E', '4']);
  });

  it('penanda item unik di seluruh tahap', () => {
    const keys = STAGES.flatMap((s) => s.items.map((it) => stageItemKey(s, it)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sea trial hanya berlaku untuk kapal dengan penggerak', () => {
    const d = STAGES.find((s) => s.key === 'commissioning')!;
    expect(applicableItems(d, tug).some((i) => i.key === 'seatrial')).toBe(true);
    expect(applicableItems(d, barge).some((i) => i.key === 'seatrial')).toBe(false);
    expect(hiddenItemCount(tug)).toBe(0);
    expect(hiddenItemCount(barge)).toBe(1);
  });

  it('progress: N/A tidak dihitung ke total, pintasan material tidak dihitung', () => {
    const s = STAGES.find((x) => x.key === 'fabrication')!;
    const rows = new Map([row('fabrication.fitup', 'selesai'), row('fabrication.visual', 'tidak_ada')]);
    expect(stageProgress(s, tug, rows)).toEqual({ total: 3, selesai: 1, tidakAda: 1, pct: 33 });
    const c = STAGES.find((x) => x.key === 'commencement')!;
    expect(stageProgress(c, tug, new Map()).total).toBe(5);
  });

  it('tahap selesai bila semua item selesai atau N/A; tahap terbuka = tahap pertama yang belum selesai', () => {
    const s1 = STAGES[0];
    const rows = new Map(s1.items.map((it) => row(stageItemKey(s1, it), 'selesai')));
    expect(isStageDone(s1, tug, rows)).toBe(true);
    expect(firstOpenStage(tug, rows)?.key).toBe('drawing');
    expect(firstOpenStage(tug, new Map())?.key).toBe('contract');
  });

  it('semua selesai: tidak ada tahap terbuka dan progress 100%', () => {
    const rows = new Map(STAGES.flatMap((s) => s.items.filter((it) => !it.material).map((it) => row(stageItemKey(s, it), 'selesai'))));
    expect(firstOpenStage(tug, rows)).toBeNull();
    expect(overallProgress(tug, rows).pct).toBe(100);
  });
});
