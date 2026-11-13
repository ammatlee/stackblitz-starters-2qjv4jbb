'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import {
  LEAK_METHODS,
  LEAK_METHOD_LABEL,
  LEAK_STATUSES,
  LEAK_STATUS_LABEL,
  STRUCT_STATUSES,
  STRUCT_STATUS_LABEL,
  parseHead,
  summarizeTankTests,
} from '../../lib/newbuildingTankTests';
import type { LeakMethod, StructStatus, TankTestRow, TestStatus } from '../../lib/newbuildingTankTests';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const COLS = 'id,name,leak_status,leak_method,leak_date,struct_status,struct_head,struct_date,note';

type Patch = Partial<Omit<TankTestRow, 'id'>>;

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Kolom teks: disimpan saat kolom ditinggalkan, bukan di setiap ketukan. */
function BlurInput({ value, placeholder, disabled, onSave, inputMode }: { value: string; placeholder: string; disabled: boolean; onSave: (v: string) => void; inputMode?: 'decimal' }) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder={placeholder}
      inputMode={inputMode}
      value={t}
      disabled={disabled}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}

const TONE: Record<string, string> = {
  lulus: 'border-teal-200 bg-teal-50/50',
  tidak_lulus: 'border-red-200 bg-red-50/50',
};

function TankItem({ r, busy, onPatch, onDelete, onBadHead }: { r: TankTestRow; busy: boolean; onPatch: (p: Patch) => void; onDelete: () => void; onBadHead: () => void }) {
  const leakDone = r.leak_status !== 'belum';
  const structDone = r.struct_status === 'lulus' || r.struct_status === 'tidak_lulus';
  const tone = r.leak_status === 'tidak_lulus' || r.struct_status === 'tidak_lulus' ? TONE.tidak_lulus : r.leak_status === 'lulus' && (r.struct_status === 'lulus' || r.struct_status === 'tidak_perlu') ? TONE.lulus : 'border-slate-200 bg-white';

  const setLeak = (s: TestStatus) => onPatch({ leak_status: s, leak_date: s === 'belum' ? null : r.leak_date ?? todayIso() });
  const setStruct = (s: StructStatus) => {
    const done = s === 'lulus' || s === 'tidak_lulus';
    onPatch({ struct_status: s, struct_date: done ? r.struct_date ?? todayIso() : null, struct_head: done ? r.struct_head : null });
  };

  return (
    <li className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <BlurInput value={r.name} placeholder="Nama kompartemen" disabled={busy} onSave={(v) => v !== '' && onPatch({ name: v })} />
        </div>
        <button type="button" className="shrink-0 rounded-md px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" disabled={busy} onClick={onDelete}>
          Hapus
        </button>
      </div>

      <p className="mt-3 text-xs font-bold text-slate-700">Leak test</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {LEAK_STATUSES.map((s) => (
          <Chip key={s} selected={r.leak_status === s} disabled={busy} onClick={() => setLeak(s)}>
            {LEAK_STATUS_LABEL[s]}
          </Chip>
        ))}
      </div>
      {leakDone && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEAK_METHODS.map((m: LeakMethod) => (
              <Chip key={m} selected={r.leak_method === m} disabled={busy} onClick={() => onPatch({ leak_method: r.leak_method === m ? null : m })}>
                {LEAK_METHOD_LABEL[m]}
              </Chip>
            ))}
          </div>
          <label className="mt-2 block sm:w-1/2">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal leak test</span>
            <DateInput className={INPUT} value={r.leak_date ?? ''} onChange={(iso) => onPatch({ leak_date: iso === '' ? null : iso })} />
          </label>
        </>
      )}

      <p className="mt-3 text-xs font-bold text-slate-700">Structural test</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {STRUCT_STATUSES.map((s) => (
          <Chip key={s} selected={r.struct_status === s} disabled={busy} onClick={() => setStruct(s)}>
            {STRUCT_STATUS_LABEL[s]}
          </Chip>
        ))}
      </div>
      {structDone && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tinggi uji (m di atas top of tank)</span>
            <BlurInput
              inputMode="decimal"
              value={r.struct_head == null ? '' : String(r.struct_head).replace('.', ',')}
              placeholder="mis. 2,4"
              disabled={busy}
              onSave={(v) => {
                if (v === '') return onPatch({ struct_head: null });
                const n = parseHead(v);
                if (n == null) return onBadHead();
                onPatch({ struct_head: n });
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal uji struktural</span>
            <DateInput className={INPUT} value={r.struct_date ?? ''} onChange={(iso) => onPatch({ struct_date: iso === '' ? null : iso })} />
          </label>
        </div>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Catatan</span>
        <BlurInput value={r.note ?? ''} placeholder="Catatan (opsional)" disabled={busy} onSave={(v) => onPatch({ note: v === '' ? null : v })} />
      </label>
    </li>
  );
}

export default function TankTestTracker({ projectId, projectName, onBack }: { projectId: string; projectName: string; onBack: () => void }) {
  const [rows, setRows] = useState<TankTestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_tank_tests').select(COLS).eq('project_id', projectId).order('created_at', { ascending: true });
    if (error) setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_tank_tests?)' : ''));
    else setRows((data ?? []) as TankTestRow[]);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const sum = useMemo(() => summarizeTankTests(rows), [rows]);

  const add = async () => {
    const n = name.trim();
    if (!supabase || n === '' || adding) return;
    setAdding(true);
    setErr('');
    const r = await supabase.from('nb_tank_tests').insert({ project_id: projectId, name: n }).select(COLS).single();
    setAdding(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => [...l, r.data as TankTestRow]);
    setName('');
  };

  const patch = async (id: string, p: Patch) => {
    if (!supabase) return;
    setBusyId(id);
    setErr('');
    const r = await supabase.from('nb_tank_tests').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };

  const remove = async (row: TankTestRow) => {
    if (!supabase || !window.confirm(`Hapus "${row.name}" dari daftar uji?`)) return;
    setBusyId(row.id);
    setErr('');
    const r = await supabase.from('nb_tank_tests').delete().eq('id', row.id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => l.filter((x) => x.id !== row.id));
  };

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <Button size="sm" onClick={onBack}>← Tahapan</Button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Uji kebocoran dan struktural per kompartemen</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">Catatan pelaksanaan uji. Tidak mengubah status item di Tahapan.</p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {loaded && sum.total > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p>
            <b>{sum.leakPass}</b> dari {sum.total} lulus leak test · <b>{sum.structPass}</b> dari {sum.structNeeded} lulus uji struktural
          </p>
          {sum.failed > 0 && <p className="mt-1 font-semibold text-red-700">{sum.failed} kompartemen punya uji yang tidak lulus.</p>}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          className={INPUT}
          placeholder="Nama kompartemen, mis. Fore peak"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <Button variant="primary" disabled={adding || name.trim() === ''} onClick={add}>
          Tambah
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Uji struktural wajib untuk satu tangki dari tiap grup yang mirip, tangki lain cukup leak test (S14 Part C 2.4). Tandai tangki yang cukup leak test dengan &quot;Tidak perlu&quot;. Pengecualian dan rezim yang berlaku ada di Kriteria penerimaan pada item Structural test.
      </p>

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada kompartemen. Tambahkan satu per satu di atas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <TankItem key={r.id} r={r} busy={busyId === r.id} onPatch={(p) => patch(r.id, p)} onDelete={() => remove(r)} onBadHead={() => setErr('Tinggi uji harus berupa angka dalam meter, mis. 2,4.')} />
          ))}
        </ul>
      )}
    </main>
  );
}
