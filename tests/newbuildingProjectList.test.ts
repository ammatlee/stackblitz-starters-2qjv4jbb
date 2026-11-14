import { describe, it, expect } from 'vitest';
import { countArchived, filterProjects } from '../lib/newbuildingListView';

const P = (name: string, extra: Partial<{ yard: string | null; hull_no: string | null; vessel_type: string | null; archived_at: string | null }> = {}) => ({
  name,
  yard: null,
  hull_no: null,
  vessel_type: null,
  archived_at: null,
  ...extra,
});

const list = [
  P('TB Alpha', { yard: 'Galangan Batam', hull_no: 'H-101' }),
  P('TK Beta', { yard: 'Galangan Surabaya', vessel_type: 'Tongkang' }),
  P('TB Gamma', { yard: 'Galangan Batam', archived_at: '2026-10-01T00:00:00Z' }),
];

describe('filterProjects', () => {
  it('tanpa kata kunci: hanya proyek aktif, urutan asli', () => {
    expect(filterProjects(list, '', false).map((p) => p.name)).toEqual(['TB Alpha', 'TK Beta']);
  });
  it('tab arsip hanya menampilkan yang diarsipkan', () => {
    expect(filterProjects(list, '', true).map((p) => p.name)).toEqual(['TB Gamma']);
  });
  it('mencari di nama, galangan, nomor lambung, dan jenis kapal', () => {
    expect(filterProjects(list, 'batam', false).map((p) => p.name)).toEqual(['TB Alpha']);
    expect(filterProjects(list, 'h-101', false)).toHaveLength(1);
    expect(filterProjects(list, 'tongkang', false).map((p) => p.name)).toEqual(['TK Beta']);
  });
  it('semua kata harus cocok', () => {
    expect(filterProjects(list, 'tb surabaya', false)).toHaveLength(0);
  });
});

describe('countArchived', () => {
  it('menghitung aktif dan arsip', () => expect(countArchived(list)).toEqual({ aktif: 2, arsip: 1 }));
});
