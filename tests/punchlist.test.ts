import { describe, expect, it } from 'vitest';
import { dmy, groupPunchlist, photoRefs, punchTitle, punchlistCounts, punchlistSummaryText, punchlistText } from '../lib/punchlist';
import type { PunchRow } from '../lib/punchlist';

const row = (id: string, seq: number | null, item_key: string | null, status: 'open' | 'closed' = 'open', extra: Partial<PunchRow> = {}): PunchRow => ({
  id,
  seq,
  item_key,
  status,
  description: `uraian ${id}`,
  location: null,
  found_date: '2026-11-01',
  closed_date: null,
  note: null,
  ...extra,
});

describe('Rekap punchlist', () => {
  it('tanggal dd-mm-yyyy', () => {
    expect(dmy('2026-11-13')).toBe('13-11-2026');
    expect(dmy(null)).toBe('');
  });

  it('kelompok mengikuti urutan item, Umum terakhir, kelompok kosong dibuang', () => {
    const rows = [row('a', 3, null), row('b', 2, 'fabrication.leaktest'), row('c', 1, 'fabrication.fitup'), row('d', 4, 'fabrication.leaktest')];
    const g = groupPunchlist(rows, true);
    expect(g.map((x) => x.label)).toEqual(['Fit up', 'Leak test', 'Umum']);
    expect(g[1].rows.map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('item yang tidak dikenal tetap dapat kelompok sebelum Umum', () => {
    const g = groupPunchlist([row('a', 1, null), row('b', 2, 'commissioning.x')], true);
    expect(g.map((x) => x.key)).toEqual(['commissioning.x', 'umum']);
  });

  it('Closed dibuang bila tidak dipakai, dan kelompok yang hanya berisi Closed ikut hilang', () => {
    const rows = [row('a', 1, 'fabrication.fitup', 'closed'), row('b', 2, 'fabrication.visual', 'open')];
    expect(groupPunchlist(rows, false).map((x) => x.label)).toEqual(['Pemeriksaan visual']);
    expect(groupPunchlist(rows, true).map((x) => x.label)).toEqual(['Fit up', 'Pemeriksaan visual']);
  });

  it('dalam kelompok: Open dulu, lalu nomor PL, tanpa nomor di akhir, stabil', () => {
    const rows = [row('a', 5, null, 'closed'), row('b', 9, null), row('c', 2, null), row('d', null, null), row('e', null, null)];
    const g = groupPunchlist(rows, true);
    expect(g[0].rows.map((r) => r.id)).toEqual(['c', 'b', 'd', 'e', 'a']);
  });

  it('hitungan Open dan Closed', () => {
    const g = groupPunchlist([row('a', 1, null), row('b', 2, null, 'closed'), row('c', 3, 'fabrication.fitup')], true);
    expect(punchlistCounts(g)).toEqual({ open: 2, closed: 1, total: 3 });
    expect(punchlistSummaryText({ open: 2, closed: 1 })).toBe('2 Open · 1 Closed');
    expect(punchlistSummaryText({ open: 2, closed: 0 })).toBe('2 Open');
  });

  it('rujukan foto dan judul baris', () => {
    expect(photoRefs([])).toBe('');
    expect(photoRefs([{ seq: 3 }, { seq: 1 }])).toBe('Foto 1, 3');
    expect(photoRefs([{ seq: 2 }, { seq: null }])).toBe('Foto 2, 1 lainnya');
    expect(punchTitle(row('a', 7, null, 'open', { location: 'Fore peak tank (P)' }))).toBe('PL-007 · Fore peak tank (P)');
    expect(punchTitle(row('a', 7, null))).toBe('PL-007');
    expect(punchTitle(row('a', null, null))).toBe('Temuan');
  });

  it('teks salinan memuat judul, uraian, catatan, foto, dan status Closed', () => {
    const rows = [
      row('a', 1, 'fabrication.leaktest', 'open', { location: 'Fore peak tank (P)', description: 'Leak test tidak lulus: 2 titik bocor', note: 'las ulang' }),
      row('b', 2, 'fabrication.fitup', 'closed', { closed_date: '2026-11-12' }),
    ];
    const t = punchlistText({ projectName: 'Kapal X', dateIso: '2026-11-13', groups: groupPunchlist(rows, true), photos: { a: [{ seq: 1 }, { seq: 2 }] } });
    expect(t).toContain('PUNCHLIST: Kapal X');
    expect(t).toContain('Per 13-11-2026 · 1 Open · 1 Closed');
    expect(t).toContain('FIT UP');
    expect(t).toContain('PL-002 [Closed 12-11-2026]');
    expect(t).toContain('PL-001 · Fore peak tank (P)');
    expect(t).toContain('Tindak lanjut: las ulang');
    expect(t).toContain('Foto 1, 2');
    expect(punchlistText({ projectName: 'K', dateIso: '2026-11-13', groups: [], photos: {} })).toContain('Tidak ada temuan.');
  });
});
