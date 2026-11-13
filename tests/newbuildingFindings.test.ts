import { describe, expect, it } from 'vitest';
import { FINDING_ITEMS, GENERAL_KEY, findingItemLabel, openFindingsText, sortFindings, summarizeFindings, tankFindingText } from '../lib/newbuildingFindings';
import { STAGES, stageItemKey } from '../lib/newbuildingStages';

describe('Daftar temuan', () => {
  it('setiap item temuan menunjuk ke item tahap yang ada', () => {
    const keys = new Set(STAGES.flatMap((s) => s.items.map((it) => stageItemKey(s, it))));
    for (const i of FINDING_ITEMS) expect(keys.has(i.key)).toBe(true);
  });

  it('ringkasan tanpa data', () => {
    expect(summarizeFindings([])).toEqual({ total: 0, open: 0, closed: 0, openByItem: {} });
  });

  it('ringkasan menghitung Open dan Closed, dan Open per item', () => {
    const s = summarizeFindings([
      { item_key: 'fabrication.fitup', status: 'open' },
      { item_key: 'fabrication.fitup', status: 'open' },
      { item_key: 'fabrication.visual', status: 'closed' },
      { item_key: null, status: 'open' },
    ]);
    expect(s.total).toBe(4);
    expect(s.open).toBe(3);
    expect(s.closed).toBe(1);
    expect(s.openByItem).toEqual({ 'fabrication.fitup': 2, [GENERAL_KEY]: 1 });
  });

  it('urutan: Open dulu, terbaru di atas, Closed menurut tanggal ditutup', () => {
    const rows = [
      { id: 'a', status: 'closed' as const, found_date: '2026-01-01', closed_date: '2026-03-01' },
      { id: 'b', status: 'open' as const, found_date: '2026-02-01', closed_date: null },
      { id: 'c', status: 'open' as const, found_date: '2026-02-10', closed_date: null },
      { id: 'd', status: 'closed' as const, found_date: '2026-01-05', closed_date: '2026-04-01' },
      { id: 'e', status: 'open' as const, found_date: null, closed_date: null },
    ];
    expect(sortFindings(rows).map((r) => r.id)).toEqual(['c', 'b', 'e', 'd', 'a']);
  });

  it('urutan tidak mengubah array asli', () => {
    const rows = [
      { status: 'closed' as const, found_date: null, closed_date: null },
      { status: 'open' as const, found_date: null, closed_date: null },
    ];
    sortFindings(rows);
    expect(rows[0].status).toBe('closed');
  });

  it('label item dan teks pengingat', () => {
    expect(findingItemLabel(null)).toBe('Umum');
    expect(findingItemLabel('fabrication.leaktest')).toBe('Leak test');
    expect(findingItemLabel('lain.item')).toBe('lain.item');
    expect(openFindingsText(3)).toBe('3 temuan Open');
  });

  it('temuan dari uji kompartemen yang tidak lulus', () => {
    expect(tankFindingText('Fore peak', 'leak')).toEqual({ item_key: 'fabrication.leaktest', description: 'Leak test tidak lulus', location: 'Fore peak' });
    expect(tankFindingText('Fore peak', 'struct').item_key).toBe('fabrication.structtest');
  });
});
