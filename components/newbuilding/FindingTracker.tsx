'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { useDialog } from '../DialogProvider';
import { FINDING_ITEMS, FINDING_STATUSES, FINDING_STATUS_LABEL, findingItemLabel, sortFindings, summarizeFindings } from '../../lib/newbuildingFindings';
import type { FindingRow, FindingStatus } from '../../lib/newbuildingFindings';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const COLS = 'id,item_key,description,location,status,found_date,closed_date,note';

type Patch = Partial<Omit<FindingRow, 'id'>>;
type StatusFilter = FindingStatus | 'all';
const GENERAL = '__umum__';

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Kolom teks: disimpan saat kolom ditinggalkan, bukan di setiap ketukan. */
function BlurInput({ value, placeholder, disabled, onSave }: { value: string; placeholder: string; disabled: boolean; onSave: (v: string) => void }) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder={placeholder}
      value={t}
      disabled={disabled}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}

function FindingItem({ r, busy, onPatch, onDelete }: { r: FindingRow; busy: boolean; onPatch: (p: Patch) => void; onDelete: () => void }) {
  const open = r.status === 'open';
  const toggle = () => onPatch({ status: open ? 'closed' : 'open', closed_date: open ? todayIso() : null });
  return (
    <li className={`rounded-xl border p-3 ${open ? 'border-amber-300 bg-amber-50/50' : 'border-teal-200 bg-teal-50/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{findingItemLabel(r.item_key)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${open ? 'bg-amber-200 text-amber-900' : 'bg-teal-600 text-white'}`}>{FINDING_STATUS_LABEL[r.status]}</span>
      </div>
      <div className="mt-2 space-y-2">
        <BlurInput value={r.description} placeholder="Uraian temuan" disabled={busy} onSave={(v) => v !== '' && onPatch({ description: v })} />
        <BlurInput value={r.location ?? ''} placeholder="Lokasi (blok, frame, tangki)" disabled={busy} onSave={(v) => onPatch({ location: v === '' ? null : v })} />
        <BlurInput value={r.note ?? ''} placeholder="Catatan tindak lanjut (opsional)" disabled={busy} onSave={(v) => onPatch({ note: v === '' ? null : v })} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal temuan</span>
          <DateInput className={INPUT} value={r.found_date ?? ''} onChange={(iso) => onPatch({ found_date: iso === '' ? null : iso })} />
        </label>
        {!open && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal ditutup</span>
            <DateInput className={INPUT} value={r.closed_date ?? ''} onChange={(iso) => onPatch({ closed_date: iso === '' ? null : iso })} />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button size="sm" variant={open ? 'primary' : 'secondary'} disabled={busy} onClick={toggle}>
          {open ? 'Tutup temuan' : 'Buka kembali'}
        </Button>
        <button type="button" className="rounded-md px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" disabled={busy} onClick={onDelete}>
          Hapus
        </button>
      </div>
    </li>
  );
}

export default function FindingTracker({ projectId, projectName, onBack }: { projectId: string; projectName: string; onBack: () => void }) {
  const { confirm } = useDialog();
  const [rows, setRows] = useState<FindingRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState('');
  const [itemKey, setItemKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [itemFilter, setItemFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_findings').select(COLS).eq('project_id', projectId).order('created_at', { ascending: true });
    if (error) setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_findings?)' : ''));
    else setRows((data ?? []) as FindingRow[]);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const sum = useMemo(() => summarizeFindings(rows), [rows]);

  const shown = useMemo(
    () =>
      sortFindings(
        rows.filter((r) => (statusFilter === 'all' || r.status === statusFilter) && (itemFilter === null || (itemFilter === GENERAL ? r.item_key === null : r.item_key === itemFilter)))
      ),
    [rows, statusFilter, itemFilter]
  );

  const add = async () => {
    const d = desc.trim();
    if (!supabase || d === '' || adding) return;
    setAdding(true);
    setErr('');
    const r = await supabase
      .from('nb_findings')
      .insert({ project_id: projectId, item_key: itemKey, description: d, location: loc.trim() || null, status: 'open', found_date: todayIso() })
      .select(COLS)
      .single();
    setAdding(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => [...l, r.data as FindingRow]);
    setDesc('');
    setLoc('');
    // temuan baru berstatus Open: pastikan terlihat
    if (statusFilter === 'closed') setStatusFilter('open');
  };

  const patch = async (id: string, p: Patch) => {
    if (!supabase) return;
    setBusyId(id);
    setErr('');
    const r = await supabase.from('nb_findings').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };

  const remove = async (row: FindingRow) => {
    if (!supabase) return;
    if (!(await confirm({ title: 'Hapus temuan?', message: `Hapus temuan "${row.description}"? Bila sudah selesai, lebih baik ditutup (Closed) saja.`, confirmText: 'Hapus', tone: 'danger' }))) return;
    setBusyId(row.id);
    setErr('');
    const r = await supabase.from('nb_findings').delete().eq('id', row.id);
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
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Daftar temuan (punchlist)</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">Catatan temuan dan pengingat. Tidak mengubah status item di Tahapan.</p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-bold text-slate-700">Tambah temuan</p>
        <div className="mt-2 space-y-2">
          <input
            className={INPUT}
            placeholder="Uraian, mis. Misalignment butt melewati Limit"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <input
            className={INPUT}
            placeholder="Lokasi, mis. Blok B3, frame 24"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Chip selected={itemKey === null} onClick={() => setItemKey(null)}>Umum</Chip>
            {FINDING_ITEMS.map((i) => (
              <Chip key={i.key} selected={itemKey === i.key} onClick={() => setItemKey(i.key)}>
                {i.label}
              </Chip>
            ))}
          </div>
          <Button variant="primary" disabled={adding || desc.trim() === ''} onClick={add}>
            Tambah
          </Button>
        </div>
      </div>

      {loaded && sum.total > 0 && (
        <>
          <p className="mt-4 text-xs text-slate-700">
            <b className={sum.open > 0 ? 'text-amber-800' : ''}>{sum.open}</b> Open · <b>{sum.closed}</b> Closed
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FINDING_STATUSES.map((s) => (
              <Chip key={s} selected={statusFilter === s} onClick={() => setStatusFilter(s)}>
                {FINDING_STATUS_LABEL[s]}
              </Chip>
            ))}
            <Chip selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Semua</Chip>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip tone="dark" selected={itemFilter === null} onClick={() => setItemFilter(null)}>Semua item</Chip>
            <Chip tone="dark" selected={itemFilter === GENERAL} onClick={() => setItemFilter(GENERAL)}>Umum</Chip>
            {FINDING_ITEMS.map((i) => (
              <Chip key={i.key} tone="dark" selected={itemFilter === i.key} onClick={() => setItemFilter(i.key)}>
                {i.label}
              </Chip>
            ))}
          </div>
        </>
      )}

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada temuan.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Tidak ada temuan yang cocok dengan filter ini.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((r) => (
            <FindingItem key={r.id} r={r} busy={busyId === r.id} onPatch={(p) => patch(r.id, p)} onDelete={() => remove(r)} />
          ))}
        </ul>
      )}
    </main>
  );
}
