import { describe, it, expect } from 'vitest';
import { saveKeyedRow, selectKeyed, CONFLICT_MESSAGE } from '../lib/rowLock';
import type { KeyedClient } from '../lib/rowLock';

type Row = { project_id: string; item_key: string; version: number; status?: string };

/** Database tiruan: satu tabel di memori, version naik setiap UPDATE (seperti trigger di server). */
function fake(initial: Row[], opts: { noVersionColumn?: boolean } = {}) {
  const rows: Row[] = initial.map((r) => ({ ...r }));
  const calls: string[] = [];
  const noV = (cols: string) => opts.noVersionColumn && /version/.test(cols);
  const client = {
    from: () => ({
      select: (cols: string) => {
        const f: Record<string, unknown> = {};
        const run = () => {
          if (noV(cols)) return { data: null, error: { message: 'column nb_x.version does not exist' } };
          return { data: rows.filter((r) => Object.entries(f).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v)).map((r) => ({ ...r })), error: null };
        };
        const q: Record<string, unknown> = {
          eq: (c: string, v: unknown) => {
            f[c] = v;
            return q;
          },
          maybeSingle: () => {
            const r = run();
            return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : null, error: r.error });
          },
          then: (res: (x: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
        };
        return q;
      },
      insert: (v: Record<string, unknown>) => {
        calls.push('insert');
        const dup = rows.some((r) => r.project_id === v.project_id && r.item_key === v.item_key);
        return {
          select: () => {
            if (dup) return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint' } });
            const row = { ...(v as unknown as Row), version: 1 };
            rows.push(row);
            return Promise.resolve({ data: [{ version: 1 }], error: null });
          },
        };
      },
      update: (v: Record<string, unknown>) => {
        calls.push('update');
        const f: Record<string, unknown> = {};
        const w: Record<string, unknown> = {
          eq: (c: string, x: unknown) => {
            f[c] = x;
            return w;
          },
          select: () => {
            const hit = rows.filter((r) => Object.entries(f).every(([k, val]) => (r as unknown as Record<string, unknown>)[k] === val));
            hit.forEach((r) => Object.assign(r, v, { version: r.version + 1 }));
            return Promise.resolve({ data: hit.map((r) => ({ version: r.version })), error: null });
          },
        };
        return w;
      },
      upsert: (v: Record<string, unknown>) => {
        calls.push('upsert');
        const cur = rows.find((r) => r.project_id === v.project_id && r.item_key === v.item_key);
        if (cur) Object.assign(cur, v);
        else rows.push({ ...(v as unknown as Row), version: 1 });
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { client: client as unknown as KeyedClient, rows, calls };
}

describe('saveKeyedRow — penguncian per (project_id, item_key)', () => {
  it('baris ada, version sama: tersimpan dan version naik', async () => {
    const db = fake([{ project_id: 'p1', item_key: 'a', version: 3, status: 'belum' }]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', 3, { status: 'selesai' });
    expect(r).toEqual({ status: 'ok', version: 4 });
    expect(db.rows[0].status).toBe('selesai');
  });

  it('orang lain sudah menyimpan lebih dulu: bentrok dan data tidak ditimpa', async () => {
    const db = fake([{ project_id: 'p1', item_key: 'a', version: 5, status: 'selesai' }]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', 3, { status: 'belum' });
    expect(r).toEqual({ status: 'conflict', message: CONFLICT_MESSAGE });
    expect(db.rows[0].status).toBe('selesai');
  });

  it('baris sudah dihapus: missing', async () => {
    const db = fake([]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', 2, { status: 'selesai' });
    expect(r.status).toBe('missing');
  });

  it('baris belum ada saat dibuka (null): insert dengan version 1', async () => {
    const db = fake([]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', null, { status: 'selesai' });
    expect(r).toEqual({ status: 'ok', version: 1 });
    expect(db.calls).toEqual(['insert']);
  });

  it('baris belum ada saat dibuka tetapi orang lain sudah membuatnya: bentrok', async () => {
    const db = fake([{ project_id: 'p1', item_key: 'a', version: 1, status: 'selesai' }]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', null, { status: 'belum' });
    expect(r.status).toBe('conflict');
    expect(db.rows[0].status).toBe('selesai');
  });

  it('kolom version belum ada (undefined): memakai cara lama, upsert', async () => {
    const db = fake([]);
    const r = await saveKeyedRow(db.client, 't', 'p1', 'a', undefined, { status: 'selesai' });
    expect(r).toEqual({ status: 'ok', version: undefined });
    expect(db.calls).toEqual(['upsert']);
  });
});

describe('selectKeyed — membaca dengan version, beralih bila kolomnya belum ada', () => {
  it('kolom ada: versioned true', async () => {
    const db = fake([{ project_id: 'p1', item_key: 'a', version: 2 }, { project_id: 'p2', item_key: 'b', version: 1 }]);
    const r = await selectKeyed(db.client, 't', 'item_key,status', 'p1');
    expect(r.versioned).toBe(true);
    expect(r.data).toHaveLength(1);
  });

  it('kolom belum ada: membaca ulang tanpa version, versioned false', async () => {
    const db = fake([{ project_id: 'p1', item_key: 'a', version: 2 }], { noVersionColumn: true });
    const r = await selectKeyed(db.client, 't', 'item_key,status', 'p1');
    expect(r.versioned).toBe(false);
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
  });
});
