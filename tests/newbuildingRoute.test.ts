import { describe, expect, it } from 'vitest';
import { LIST_ROUTE, parseRoute, routeHref, routeSearch } from '../lib/newbuildingRoute';

describe('Alamat Bangunan Baru', () => {
  it('tanpa proyek berarti daftar proyek', () => {
    expect(parseRoute('')).toEqual(LIST_ROUTE);
    expect(parseRoute('?v=tank')).toEqual(LIST_ROUTE);
    expect(routeSearch(LIST_ROUTE)).toBe('');
    expect(routeHref(LIST_ROUTE)).toBe('/newbuilding');
  });

  it('proyek tanpa layar, atau dengan layar tak dikenal, dibuka di Tahapan', () => {
    expect(parseRoute('?p=abc')).toEqual({ projectId: 'abc', view: 'stage' });
    expect(parseRoute('?p=abc&v=ngawur')).toEqual({ projectId: 'abc', view: 'stage' });
  });

  it('setiap layar dibaca dan ditulis kembali dengan sama', () => {
    for (const view of ['stage', 'material', 'drawing', 'tank', 'finding', 'docs'] as const) {
      const r = { projectId: 'p-1', view };
      expect(parseRoute(routeSearch(r))).toEqual(r);
    }
  });

  it('Material yang dibuka dari Tahapan mengingat asalnya, layar lain tidak', () => {
    const r = { projectId: 'p1', view: 'material' as const, fromStage: true };
    expect(routeSearch(r)).toBe('?p=p1&v=material&f=s');
    expect(parseRoute(routeSearch(r))).toEqual(r);
    expect(parseRoute('?p=p1&v=material')).toEqual({ projectId: 'p1', view: 'material' });
    expect(parseRoute('?p=p1&v=tank&f=s')).toEqual({ projectId: 'p1', view: 'tank' });
  });

  it('Material yang dibuka dari Daftar dokumen mengingat asalnya', () => {
    const r = { projectId: 'p1', view: 'material' as const, fromDocs: true };
    expect(routeSearch(r)).toBe('?p=p1&v=material&f=d');
    expect(parseRoute(routeSearch(r))).toEqual(r);
    expect(parseRoute('?p=p1&v=docs&f=d')).toEqual({ projectId: 'p1', view: 'docs' });
  });

  it('id proyek dengan karakter khusus aman di alamat', () => {
    const r = { projectId: 'a b&c', view: 'stage' as const };
    expect(parseRoute(routeSearch(r))).toEqual(r);
  });
});
