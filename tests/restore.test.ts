import { describe, it, expect, beforeEach, vi } from 'vitest';

// Database tiruan di memori: cukup untuk select(...).order(...).range(...) dan insert(...).
const h = vi.hoisted(() => {
  const db: Record<string, Record<string, unknown>[]> = {};
  const failIds = new Set<string>();
  const supabase = {
    from: (table: string) => ({
      select: () => {
        const q = {
          order: () => q,
          range: (f: number, t: number) => Promise.resolve({ data: (db[table] ?? []).slice(f, t + 1).map((r) => ({ ...r })), error: null }),
        };
        return q;
      },
      insert: (x: Record<string, unknown> | Record<string, unknown>[]) => {
        const arr = Array.isArray(x) ? x : [x];
        if (arr.some((r) => failIds.has(String(r.id)))) {
          return Promise.resolve({ error: { message: 'ditolak: ' + arr.map((r) => r.id).join(',') } });
        }
        db[table] = [...(db[table] ?? []), ...arr];
        return Promise.resolve({ error: null });
      },
    }),
  };
  return { db, failIds, supabase };
});

vi.mock('../lib/supabase', () => ({ supabase: h.supabase }));

import { parseBackup, planRestore, runRestore } from '../lib/restore';

const ME = 'u1';
const backup = () => ({
  app: 'rdk-class',
  format: 2,
  tables: {
    vessels: [{ id: 'v1', owner: ME }, { id: 'v2', owner: ME }, { id: 'v3', owner: ME }, { id: 'vx', owner: 'u2' }],
    agendas: [
      { id: 'a1', owner: ME, agenda_no: 'A-1', vessel_id: 'v1' },
      { id: 'a2', owner: ME, agenda_no: 'A-1', vessel_id: 'v1' }, // nomor sama dengan a1 tapi id beda
      { id: 'a3', owner: ME, agenda_no: 'A-3', vessel_id: 'v2' },
      { id: 'a4', owner: ME, agenda_no: 'A-4', vessel_id: 'v3' },
      { id: 'a5', owner: ME, agenda_no: 'A-5', vessel_id: 'vgone' }, // kapalnya tidak ada di mana pun
    ],
    vessel_events: [{ id: 'e1', owner: ME, vessel_id: 'v2' }],
  },
});

beforeEach(() => {
  h.failIds.clear();
  h.db.vessels = [{ id: 'v1', owner: ME }];
  h.db.agendas = [{ id: 'a1', owner: ME, agenda_no: 'A-1', vessel_id: 'v1' }];
  h.db.vessel_events = [];
});

describe('parseBackup — validasi file', () => {
  it('teks bukan JSON ditolak', () => expect(() => parseBackup('bukan json')).toThrow(/tidak terbaca/));
  it('file dari aplikasi lain ditolak', () => expect(() => parseBackup('{"app":"lain","tables":{}}')).toThrow(/bukan cadangan RDK/));
  it('JSON kosong atau null ditolak', () => expect(() => parseBackup('null')).toThrow(/bukan cadangan RDK/));
  it('format versi lain ditolak', () => expect(() => parseBackup('{"app":"rdk-class","format":1,"tables":{}}')).toThrow(/tidak dikenali/));
  it('tabel yang hilang dianggap kosong', () => {
    const b = parseBackup('{"app":"rdk-class","format":2,"tables":{"vessels":[{"id":"v1"}]}}');
    expect(b.tables.vessels).toHaveLength(1);
    expect(b.tables.agendas).toEqual([]);
    expect(b.tables.vessel_events).toEqual([]);
  });
});

describe('planRestore — hanya menambah yang belum ada', () => {
  it('memilah: baru, sudah ada, milik akun lain, bentrok nomor agenda', async () => {
    const plan = await planRestore(parseBackup(JSON.stringify(backup())), ME);
    expect(plan.toAdd.vessels.map((r) => r.id)).toEqual(['v2', 'v3']);
    expect(plan.exists.vessels).toBe(1);
    expect(plan.notMine.vessels).toBe(1);
    expect(plan.conflict).toBe(1);
    expect(plan.toAdd.agendas.map((r) => r.id)).toEqual(['a3', 'a4', 'a5']);
  });

  it('tidak mengubah apa pun di server', async () => {
    await planRestore(parseBackup(JSON.stringify(backup())), ME);
    expect(h.db.vessels).toHaveLength(1);
    expect(h.db.agendas).toHaveLength(1);
  });
});

describe('runRestore — urutan dan kegagalan', () => {
  it('kapal dulu, lalu agenda dan pembaruan manual; yang kapalnya tidak ada dilewati', async () => {
    const plan = await planRestore(parseBackup(JSON.stringify(backup())), ME);
    const r = await runRestore(plan);
    expect(r.added).toEqual({ vessels: 2, agendas: 2, vessel_events: 1 });
    expect(r.orphan.agendas).toBe(1); // a5
    expect(r.failed).toEqual([]);
  });

  it('satu baris ditolak server: baris lain tetap masuk, dan yang bergantung padanya dilewati', async () => {
    h.failIds.add('v3');
    const plan = await planRestore(parseBackup(JSON.stringify(backup())), ME);
    const r = await runRestore(plan);
    expect(r.added.vessels).toBe(1); // v2
    expect(r.failed[0]).toMatchObject({ table: 'vessels', count: 1 });
    expect(r.added.agendas).toBe(1); // a3
    expect(r.orphan.agendas).toBe(2); // a4 (kapal v3 gagal) dan a5
  });

  it('memulihkan dua kali tidak membuat data dobel', async () => {
    const b = parseBackup(JSON.stringify(backup()));
    await runRestore(await planRestore(b, ME));
    const again = await planRestore(b, ME);
    expect(again.toAdd.vessels).toHaveLength(0);
    expect(again.toAdd.vessel_events).toHaveLength(0);
  });
});
