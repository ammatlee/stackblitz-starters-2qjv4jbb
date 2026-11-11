import { describe, expect, it } from 'vitest';
import { CRITERIA, criteriaFor, governingHead, governingHeadA, partCMinHead, suggestRegime } from '../lib/newbuildingCriteria';
import { STAGES, stageItemKey } from '../lib/newbuildingStages';

describe('Kriteria penerimaan Fabrication', () => {
  it('setiap kunci kriteria menunjuk ke item tahap yang ada', () => {
    const keys = new Set(STAGES.flatMap((s) => s.items.map((it) => stageItemKey(s, it))));
    for (const k of Object.keys(CRITERIA)) expect(keys.has(k)).toBe(true);
  });

  it('setiap baris punya rujukan dan isi', () => {
    for (const set of Object.values(CRITERIA)) {
      expect(set.groups.length).toBeGreaterThan(0);
      for (const g of set.groups) {
        for (const r of g.rows) {
          expect(r.ref.length).toBeGreaterThan(0);
          if (g.columns === 'value') expect((r.value ?? '').length).toBeGreaterThan(0);
          else expect((r.standard ?? '') + (r.limit ?? '')).not.toBe('');
        }
      }
    }
  });

  it('item tanpa kriteria mengembalikan null', () => {
    expect(criteriaFor('fabrication.tidakada')).toBeNull();
    for (const k of ['fitup', 'visual', 'leaktest', 'structtest']) expect(criteriaFor(`fabrication.${k}`)).not.toBeNull();
  });

  it('tinggi uji Part C: 0,3D + 0,76 dibatasi 2,4 m', () => {
    expect(partCMinHead(3)).toBeCloseTo(1.66, 5);
    expect(partCMinHead(5)).toBeCloseTo(2.26, 5);
    expect(partCMinHead(6)).toBe(2.4);
    expect(partCMinHead(10)).toBe(2.4);
  });

  it('tinggi yang menentukan = nilai terbesar antara Part C dan top of overflow', () => {
    expect(governingHead(3, null)).toEqual({ head: partCMinHead(3), by: 'partC' });
    expect(governingHead(3, 1)).toEqual({ head: partCMinHead(3), by: 'partC' });
    expect(governingHead(3, 2.5)).toEqual({ head: 2.5, by: 'overflow' });
  });

  it('tinggi yang menentukan Part A/B', () => {
    expect(governingHeadA(null)).toEqual({ head: 2.4, by: 'partA' });
    expect(governingHeadA(2)).toEqual({ head: 2.4, by: 'partA' });
    expect(governingHeadA(3)).toEqual({ head: 3, by: 'overflow' });
  });

  it('saran rezim S14 dari data proyek', () => {
    expect(suggestRegime({ propelled: false, international: true, gt: 900 }).regime).toBe('C');
    expect(suggestRegime({ propelled: true, international: false, gt: 900 }).regime).toBe('C');
    expect(suggestRegime({ propelled: true, international: true, gt: 500 }).regime).toBe('A');
    expect(suggestRegime({ propelled: true, international: true, gt: 499 }).regime).toBe('C');
    expect(suggestRegime({ propelled: true, international: true, gt: null }).regime).toBeNull();
  });
});
