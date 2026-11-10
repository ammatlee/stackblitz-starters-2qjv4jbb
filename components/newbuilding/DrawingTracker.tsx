'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import { Fold } from '../classValidity/ui';
import DateInput from '../DateInput';
import { DRAWING_COLS, DRAWING_COL_LABEL, DRAWING_GROUP_LABEL, DRAWING_LIST_REV } from '../../lib/drawingList';
import type { DrawingCol } from '../../lib/drawingList';
import {
  DRAWING_REQ_LABEL,
  DRAWING_STATUSES,
  DRAWING_STATUS_LABEL,
  asDrawingCol,
  countsInProgress,
  drawingProgress,
  drawingsFor,
  drawingsInGroup,
  groupsOf,
  openRequired,
  resolveDrawingCol,
  statusOf,
} from '../../lib/newbuildingDrawings';
import type { Drawing, DrawingRow, DrawingStatus } from '../../lib/newbuildingDrawings';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

type Props = {
  projectId: string;
  projectName: string;
  vesselType: string | null;
  /** Penggerak yang berlaku (sudah memperhitungkan pilihan manual di data proyek). */
  propelled: boolean;
  onBack: () => void;
};

type Patch = Partial<Omit<DrawingRow, 'item_key'>>;
type Filter = 'semua' | DrawingStatus;

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const REQ_TONE: Record<Drawing['req'], string> = {
  M: 'bg-teal-100 text-teal-800',
  C: 'bg-amber-100 text-amber-900',
  O: 'bg-slate-100 text-slate-600',
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

function DrawingItem({
  d,
  row,
  busy,
  onStatus,
  onPatch,
}: {
  d: Drawing;
  row: DrawingRow | undefined;
  busy: boolean;
  onStatus: (s: DrawingStatus) => void;
  onPatch: (p: Patch) => void;
}) {
  const status: DrawingStatus = row?.status ?? 'open';
  const closed = status === 'closed';
  const na = status === 'tidak_ada';
  const counted = countsInProgress(d);
  const [more, setMore] = useState(false);
  const hasDetail = !!(row?.submit_date || row?.rev || row?.note);
  return (
    <li className={`rounded-xl border p-3 ${closed ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white'} ${na ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`min-w-0 flex-1 text-sm font-semibold ${na ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          <span className="mr-1.5 tabular-nums text-slate-500">{d.no}.</span>
          {d.title}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${REQ_TONE[d.req]}`} title={d.code ?? undefined}>
          {DRAWING_REQ_LABEL[d.req]}
          {d.code ? ` ${d.code}` : ''}
        </span>
      </div>
      {d.cond && <p className="mt-0.5 text-xs text-slate-500">Syarat: {d.cond}</p>}
      {!counted && <p className="mt-0.5 text-xs text-slate-400">Tidak dihitung ke progress.</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {DRAWING_STATUSES.map((s) => (
          <Chip key={s} selected={status === s} disabled={busy} onClick={() => onStatus(s)}>
            {DRAWING_STATUS_LABEL[s]}
          </Chip>
        ))}
        <button type="button" className="ml-auto text-xs font-semibold text-teal-700 underline" onClick={() => setMore((v) => !v)}>
          {more || hasDetail ? (more ? 'Tutup rincian' : 'Rincian') : 'Tambah rincian'}
        </button>
      </div>

      {(more || (closed && row?.done_date)) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal diajukan</span>
            <DateInput className={INPUT} value={row?.submit_date ?? ''} onChange={(iso) => onPatch({ submit_date: iso === '' ? null : iso })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal closed</span>
            <DateInput className={INPUT} value={row?.done_date ?? ''} onChange={(iso) => onPatch({ done_date: iso === '' ? null : iso })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Revisi</span>
            <BlurInput value={row?.rev ?? ''} placeholder="mis. Rev.1" disabled={busy} onSave={(v) => onPatch({ rev: v === '' ? null : v })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Catatan</span>
            <BlurInput value={row?.note ?? ''} placeholder="Catatan (opsional)" disabled={busy} onSave={(v) => onPatch({ note: v === '' ? null : v })} />
          </label>
        </div>
      )}
    </li>
  );
}

export default function DrawingTracker({ projectId, projectName, vesselType, propelled, onBack }: Props) {
  const [rows, setRows] = useState<Map<string, DrawingRow>>(new Map());
  const [fp, setFp] = useState<boolean | null>(null);
  const [override, setOverride] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [showOptional, setShowOptional] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const st = await supabase.from('nb_drawing_status').select('item_key,status,submit_date,done_date,rev,note').eq('project_id', projectId);
    if (st.error) {
      setErr(st.error.message + (/relation|does not exist/i.test(st.error.message) ? ' (sudah menjalankan SQL nb_drawing_status?)' : ''));
      setLoaded(true);
      return;
    }
    setRows(new Map(((st.data ?? []) as DrawingRow[]).map((r) => [r.item_key, r] as [string, DrawingRow])));
    const pr = await supabase.from('nb_projects').select('fp_above60,drawing_col').eq('id', projectId).maybeSingle();
    if (pr.error) {
      // kolom belum ada: pelacak tetap jalan dengan pilihan otomatis
      setErr(pr.error.message + (/column|does not exist/i.test(pr.error.message) ? ' (sudah menjalankan SQL nb_drawing_meta?)' : ''));
    } else if (pr.data) {
      const m = pr.data as { fp_above60: boolean | null; drawing_col: string | null };
      setFp(m.fp_above60);
      setOverride(m.drawing_col);
    }
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMeta = async (patch: { fp_above60?: boolean | null; drawing_col?: string | null }) => {
    if (!supabase) return;
    setErr('');
    const r = await supabase.from('nb_projects').update(patch).eq('id', projectId);
    if (r.error) {
      setErr(r.error.message + (/column|does not exist/i.test(r.error.message) ? ' (sudah menjalankan SQL nb_drawing_meta?)' : ''));
      return;
    }
    if ('fp_above60' in patch) setFp(patch.fp_above60 ?? null);
    if ('drawing_col' in patch) setOverride(patch.drawing_col ?? null);
  };

  const pick = useMemo(() => resolveDrawingCol({ vesselType, propelled, fpAbove60: fp, override }), [vesselType, propelled, fp, override]);
  const col: DrawingCol | null = pick.col;
  const list = useMemo(() => (col ? drawingsFor(col) : []), [col]);
  const prog = useMemo(() => drawingProgress(list, rows), [list, rows]);
  const stillOpen = useMemo(() => openRequired(list, rows).length, [list, rows]);

  const save = async (d: Drawing, patch: Patch) => {
    if (!supabase) return;
    const prev = rows.get(d.key);
    const next: DrawingRow = {
      item_key: d.key,
      status: prev?.status ?? 'open',
      submit_date: prev?.submit_date ?? null,
      done_date: prev?.done_date ?? null,
      rev: prev?.rev ?? null,
      note: prev?.note ?? null,
      ...patch,
    };
    setBusyKey(d.key);
    setErr('');
    const r = await supabase
      .from('nb_drawing_status')
      .upsert({ project_id: projectId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'project_id,item_key' });
    setBusyKey('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((m) => new Map(m).set(d.key, next));
  };

  const changeStatus = (d: Drawing, status: DrawingStatus) => {
    const prev = rows.get(d.key);
    save(d, { status, done_date: status === 'closed' ? prev?.done_date ?? todayIso() : null });
  };

  const term = q.trim().toLowerCase();
  const visible = (d: Drawing): boolean => {
    if (!showOptional && !countsInProgress(d)) return false;
    if (filter !== 'semua' && statusOf(d, rows) !== filter) return false;
    return !term || `${d.no} ${d.title}`.toLowerCase().includes(term);
  };

  const manualOk = asDrawingCol(override) !== null;

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <Button size="sm" onClick={onBack}>← Tahapan</Button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Pelacak gambar ({DRAWING_LIST_REV})</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">{col ? DRAWING_COL_LABEL[col] : 'Daftar gambar belum bisa ditentukan.'}</p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {loaded && pick.needFlashPoint && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Flash point muatan?</p>
          <p className="mt-0.5 text-xs">Daftar gambar oil/chemical barge dan SPOB bergantung pada flash point muatan.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip selected={false} onClick={() => saveMeta({ fp_above60: true })}>&gt; 60°C</Chip>
            <Chip selected={false} onClick={() => saveMeta({ fp_above60: false })}>≤ 60°C</Chip>
          </div>
        </div>
      )}

      {loaded && !col && !pick.needFlashPoint && (
        <p className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          Jenis kapal {vesselType ? `"${vesselType}"` : '(belum diisi)'} belum punya daftar gambar BKI di aplikasi. Pilih daftar yang paling mendekati di bawah ini.
        </p>
      )}

      {loaded && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm" open={!col && !pick.needFlashPoint}>
          <summary className="cursor-pointer text-xs font-bold text-slate-700">Pengaturan daftar gambar</summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Daftar yang dipakai</span>
              <select className={INPUT} value={manualOk ? (override as string) : ''} onChange={(e) => saveMeta({ drawing_col: e.target.value === '' ? null : e.target.value })}>
                <option value="">Otomatis dari jenis kapal</option>
                {DRAWING_COLS.map((c) => (
                  <option key={c} value={c}>{DRAWING_COL_LABEL[c]}</option>
                ))}
              </select>
            </label>
            {fp !== null && (
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Flash point muatan</span>
                <div className="flex flex-wrap gap-2">
                  <Chip selected={fp === true} onClick={() => saveMeta({ fp_above60: true })}>&gt; 60°C</Chip>
                  <Chip selected={fp === false} onClick={() => saveMeta({ fp_above60: false })}>≤ 60°C</Chip>
                  <Chip selected={false} onClick={() => saveMeta({ fp_above60: null })}>Kosongkan</Chip>
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {col && loaded && (
        <>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-600">
            <span className="whitespace-nowrap font-bold text-slate-900">{prog.closed} dari {prog.total} closed</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-teal-600" style={{ width: `${prog.pct}%` }} />
            </div>
            <span>{prog.pct}%</span>
            {prog.tidakAda > 0 && <span className="whitespace-nowrap">N/A: {prog.tidakAda}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stillOpen === 0 ? 'Semua gambar yang dihitung sudah closed.' : `${stillOpen} gambar yang dihitung masih open.`} Gambar &quot;jika ada&quot; tidak dihitung ke progress.
          </p>

          <div className="mt-3 space-y-2">
            <input className={INPUT} placeholder="Cari gambar (mis. shaft, 16.2)" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Chip selected={filter === 'semua'} onClick={() => setFilter('semua')}>Semua</Chip>
              {DRAWING_STATUSES.map((s) => (
                <Chip key={s} selected={filter === s} onClick={() => setFilter(s)}>{DRAWING_STATUS_LABEL[s]}</Chip>
              ))}
              <Chip selected={!showOptional} onClick={() => setShowOptional((v) => !v)}>Sembunyikan &quot;jika ada&quot;</Chip>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {groupsOf(list).map((g) => {
              const all = drawingsInGroup(list, g);
              const shown = all.filter(visible);
              const gp = drawingProgress(all, rows);
              if (shown.length === 0) return null;
              return (
                <Fold
                  key={g}
                  title={DRAWING_GROUP_LABEL[g]}
                  open={term !== '' || filter !== 'semua' || g === 'hull'}
                  right={<span className="text-xs tabular-nums text-slate-600">{gp.closed}/{gp.total}</span>}
                >
                  <ul className="space-y-2">
                    {shown.map((d) => (
                      <DrawingItem key={d.key} d={d} row={rows.get(d.key)} busy={busyKey === d.key} onStatus={(s) => changeStatus(d, s)} onPatch={(p) => save(d, p)} />
                    ))}
                  </ul>
                </Fold>
              );
            })}
          </div>
        </>
      )}
      {!loaded && <p className="mt-4 text-sm text-slate-500">Memuat…</p>}
    </main>
  );
}
