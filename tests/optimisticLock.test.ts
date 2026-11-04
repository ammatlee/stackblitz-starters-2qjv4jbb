import { describe, it, expect } from 'vitest';
import { updateWithVersion } from '../lib/optimisticLock';
import type { LockClient } from '../lib/optimisticLock';

/** Tiruan sederhana tabel dengan satu baris: id 'a', version v. */
function fake(row: { id: string; version: number } | null, opts?: { updateError?: string }): LockClient {
  return {
    from: () => ({
      update: (values) => ({
        eq: (_c1, id) => ({
          eq: (_c2, ver) => ({
            select: () => {
              if (opts?.updateError) return Promise.resolve({ data: null, error: { message: opts.updateError } });
              if (row && row.id === id && row.version === ver) {
                row.version += 1;
                void values;
                return Promise.resolve({ data: [{ id: row.id, version: row.version }], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
      }),
      select: () => ({ eq: (_c, id) => ({ maybeSingle: () => Promise.resolve({ data: row && row.id === id ? row : null, error: null }) }) }),
    }),
  };
}

describe('updateWithVersion — penguncian edit bersamaan', () => {
  it('version sama → tersimpan, version baru naik 1', async () => {
    const r = await updateWithVersion(fake({ id: 'a', version: 3 }), 'agendas', 'a', 3, { x: 1 });
    expect(r).toEqual({ status: 'ok', version: 4 });
  });
  it('version sudah berubah (orang lain menyimpan dulu) → conflict', async () => {
    const r = await updateWithVersion(fake({ id: 'a', version: 5 }), 'agendas', 'a', 3, { x: 1 });
    expect(r.status).toBe('conflict');
  });
  it('dua penyimpan dari version yang sama: yang kedua ditolak', async () => {
    const row = { id: 'a', version: 1 };
    const c = fake(row);
    expect((await updateWithVersion(c, 'agendas', 'a', 1, {})).status).toBe('ok');
    expect((await updateWithVersion(c, 'agendas', 'a', 1, {})).status).toBe('conflict');
  });
  it('baris tidak ada → missing, bukan conflict', async () => {
    expect((await updateWithVersion(fake(null), 'agendas', 'a', 1, {})).status).toBe('missing');
  });
  it('kesalahan server dikembalikan apa adanya', async () => {
    const r = await updateWithVersion(fake({ id: 'a', version: 1 }, { updateError: 'boom' }), 'agendas', 'a', 1, {});
    expect(r).toEqual({ status: 'error', message: 'boom' });
  });
});
