import { describe, it, expect, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, listDrafts } from '../lib/draft';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      get length() { return mem.size; },
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
  };
});

describe('draft bulletin di perangkat', () => {
  it('menyimpan, membaca, dan menghapus per entri', () => {
    expect(saveDraft('u1', null, { title: 'Baru' }, null)).toBe(true);
    expect(saveDraft('u1', 'e1', { title: 'Ubah' }, '2026-01-01')).toBe(true);
    expect(loadDraft<{ title: string }>('u1', 'e1')?.form.title).toBe('Ubah');
    clearDraft('u1', 'e1');
    expect(loadDraft('u1', 'e1')).toBeNull();
  });
  it('daftar draft hanya milik pengguna itu dan melewati data rusak', () => {
    saveDraft('u1', null, { title: 'A' }, null);
    saveDraft('u2', null, { title: 'B' }, null);
    mem.set('bulletin-draft:v1:u1:rusak', '{oops');
    const l = listDrafts<{ title: string }>('u1');
    expect(l.map((d) => d.title)).toEqual(['A']);
  });
  it('mengembalikan false bila penyimpanan penuh', () => {
    (globalThis as unknown as { window: { localStorage: { setItem: () => void } } }).window.localStorage.setItem = () => {
      throw new Error('quota');
    };
    expect(saveDraft('u1', null, {}, null)).toBe(false);
  });
});
