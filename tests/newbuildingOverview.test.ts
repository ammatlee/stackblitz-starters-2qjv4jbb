import { describe, expect, it } from 'vitest';
import { STAGES, applicableItems, stageItemKey } from '../lib/newbuildingStages';
import type { StageRow } from '../lib/newbuildingStages';
import { drawingsFor } from '../lib/newbuildingDrawings';
import { groupByProject, projectOverview } from '../lib/newbuildingOverview';

const input = { vesselType: 'Tugboat', propelled: true, tipe: null, fpAbove60: null, override: null };
const ctx = { tipe: null, propelled: true };
const done = (key: string): StageRow => ({ item_key: key, status: 'selesai', done_date: null, note: null });

describe('Ringkasan proyek di daftar', () => {
  it('proyek kosong: tahap pertama berjalan, gambar semua open', () => {
    const o = projectOverview(input, new Map(), new Map());
    expect(o.stage.selesai).toBe(0);
    expect(o.current?.key).toBe(STAGES[0].key);
    expect(o.drawing?.open).toBe(o.drawing?.progress.total);
  });

  it('tahap pertama selesai: tahap berjalan pindah ke tahap kedua', () => {
    const rows = new Map(applicableItems(STAGES[0], ctx).filter((it) => !it.material && !it.drawing).map((it) => [stageItemKey(STAGES[0], it), done(stageItemKey(STAGES[0], it))] as [string, StageRow]));
    const o = projectOverview(input, rows, new Map());
    expect(o.current?.key).toBe(STAGES[1].key);
    expect(o.stage.selesai).toBe(rows.size);
  });

  it('data gambar tidak tersedia: ringkasan gambar null, tahapan tetap ada', () => {
    const o = projectOverview(input, new Map(), null);
    expect(o.drawing).toBeNull();
    expect(o.stage.total > 0).toBe(true);
  });

  it('gambar closed dihitung dari daftar kolom proyek', () => {
    const first = drawingsFor('TUG')[0];
    const o = projectOverview(input, new Map(), new Map([[first.key, { status: 'closed' as const }]]));
    expect(o.drawing?.progress.closed).toBe(1);
  });

  it('groupByProject memisahkan baris per proyek', () => {
    const g = groupByProject([
      { project_id: 'a', item_key: 'x' },
      { project_id: 'a', item_key: 'y' },
      { project_id: 'b', item_key: 'x' },
    ]);
    expect(g.get('a')?.size).toBe(2);
    expect(g.get('b')?.size).toBe(1);
    expect(g.get('c')).toBeUndefined();
  });
});
