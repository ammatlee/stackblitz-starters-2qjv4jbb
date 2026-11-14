import { describe, it, expect, beforeEach, vi } from 'vitest';

// Database tiruan di memori (pola sama dengan restore.test.ts): select(...).order(...).range(...) dan insert(...).
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

import { parseBackup } from '../lib/restore';
import { planRestoreNb, runRestoreNb } from '../lib/restoreNb';

const ME = 'u1';
const backup = () =>
  parseBackup(
    JSON.stringify({
      app: 'rdk-class',
      format: 2,
      tables: {
        nb_projects: [{ id: 'p1', owner: ME }, { id: 'p2', owner: 'u2' }, { id: 'p9', owner: ME }],
        nb_stage_status: [
          { project_id: 'p1', item_key: 'x.a', status: 'selesai' },
          { project_id: 'p1', item_key: 'x.b', status: 'selesai' },
          { project_id: 'p3', item_key: 'x.a', status: 'selesai' }, // proyeknya tidak ada di mana pun
          { project_id: 'p9', item_key: 'x.a', status: 'selesai' }, // sudah ada di server
        ],
        nb_tank_tests: [{ id: 't1', project_id: 'p1' }],
        nb_findings: [
          { id: 'f1', project_id: 'p1', source_tank_id: 't1' },
          { id: 'f2', project_id: 'p1', source_tank_id: 'tgone' }, // uji tangki asalnya tidak ada
          { id: 'f3', project_id: 'p1', source_tank_id: null },
        ],
        nb_finding_photos: [
          { id: 'ph1', project_id: 'p1', finding_id: 'f1' },
          { id: 'ph2', project_id: 'p1', finding_id: 'f2' },
          { id: 'ph3', project_id: 'p1', finding_id: 'f3' },
        ],
      },
    }),
  );

beforeEach(() => {
  h.failIds.clear();
  for (const t of ['nb_projects', 'nb_stage_status', 'nb_drawing_status', 'nb_material_status', 'nb_tank_tests', 'nb_findings', 'nb_finding_photos']) h.db[t] = [];
  h.db.nb_projects = [{ id: 'p9', owner: ME }];
  h.db.nb_stage_status = [{ project_id: 'p9', item_key: 'x.a', status: 'belum' }];
});

describe('planRestoreNb — hanya menambah yang belum ada', () => {
  it('memilah: baru, sudah ada, milik akun lain', async () => {
    const plan = await planRestoreNb(backup(), ME);
    expect(plan.toAdd.nb_projects.map((r) => r.id)).toEqual(['p1']);
    expect(plan.exists.nb_projects).toBe(1);
    expect(plan.notMine.nb_projects).toBe(1);
    // tabel status dikenali dari pasangan (project_id, item_key), bukan id
    expect(plan.toAdd.nb_stage_status).toHaveLength(3);
    expect(plan.exists.nb_stage_status).toBe(1);
  });

  it('tidak mengubah apa pun di server', async () => {
    await planRestoreNb(backup(), ME);
    expect(h.db.nb_projects).toHaveLength(1);
    expect(h.db.nb_stage_status).toHaveLength(1);
  });
});

describe('runRestoreNb — urutan induk ke anak', () => {
  it('menambah yang induknya ada, melewati yang induknya tidak ada', async () => {
    const r = await runRestoreNb(await planRestoreNb(backup(), ME));
    expect(r.added.nb_projects).toBe(1);
    expect(r.added.nb_stage_status).toBe(2);
    expect(r.orphan.nb_stage_status).toBe(1); // proyek p3
    expect(r.added.nb_tank_tests).toBe(1);
    expect(r.added.nb_findings).toBe(2); // f1 dan f3
    expect(r.orphan.nb_findings).toBe(1); // f2
    expect(r.added.nb_finding_photos).toBe(2); // ph1 dan ph3
    expect(r.orphan.nb_finding_photos).toBe(1); // ph2 (temuan f2 dilewati)
    expect(r.failed).toEqual([]);
  });

  it('satu proyek ditolak server: baris yang bergantung padanya dilewati', async () => {
    h.db.nb_projects = [];
    h.db.nb_stage_status = [];
    h.failIds.add('p1');
    const r = await runRestoreNb(await planRestoreNb(backup(), ME));
    expect(r.failed[0]).toMatchObject({ table: 'nb_projects', count: 1 });
    expect(r.added.nb_tank_tests).toBe(0);
    expect(r.added.nb_findings).toBe(0);
  });

  it('memulihkan dua kali tidak membuat data dobel', async () => {
    const b = backup();
    await runRestoreNb(await planRestoreNb(b, ME));
    const again = await planRestoreNb(b, ME);
    expect(again.toAdd.nb_projects).toHaveLength(0);
    expect(again.toAdd.nb_tank_tests).toHaveLength(0);
  });
});
