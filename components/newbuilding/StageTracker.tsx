'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { TIPE_LEGEND } from '../../lib/materialRules';
import type { MatTipe } from '../../lib/materialRules';
import { STAGES, STAGE_STATUSES, STAGE_STATUS_LABEL, applicableItems, firstOpenStage, hiddenItemCount, isStageDone, overallProgress, stageItemKey, stageProgress } from '../../lib/newbuildingStages';
import { criteriaFor } from '../../lib/newbuildingCriteria';
import CriteriaFold from './CriteriaFold';
import { drawingSummary } from '../../lib/newbuildingDrawings';
import type { DrawingSummary } from '../../lib/newbuildingDrawings';
import type { CriteriaSet } from '../../lib/newbuildingCriteria';
import type { Stage, StageItem, StageProgress, StageRow, StageStatus } from '../../lib/newbuildingStages';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

type Props = {
  projectId: string;
  projectName: string;
  tipe: MatTipe | null;
  propelled: boolean;
  vesselType: string | null;
  onBack: () => void;
  onOpenMaterial: () => void;
  onOpenDrawing: () => void;
};

type Patch = Partial<Omit<StageRow, 'item_key'>>;

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Kolom catatan: disimpan saat kolom ditinggalkan, bukan di setiap ketukan. */
function NoteInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder="Catatan (opsional)"
      value={t}
      disabled={disabled}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}

/** Ringkasan progress gambar di item pintasan Tahap 2. */
function DrawingMini({ s }: { s: DrawingSummary }) {
  if (s.needFlashPoint) return <p className="mt-2 text-xs text-amber-800">Flash point muatan belum diisi, daftar gambar belum bisa ditentukan.</p>;
  if (!s.col) return <p className="mt-2 text-xs text-slate-500">Daftar gambar belum ditentukan untuk jenis kapal ini.</p>;
  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
      <span className="whitespace-nowrap font-bold text-slate-900">{s.progress.closed} dari {s.progress.total} closed</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-teal-600" style={{ width: `${s.progress.pct}%` }} />
      </div>
      <span>{s.progress.pct}%</span>
    </div>
  );
}

function ItemRow({
  it,
  row,
  busy,
  onStatus,
  onDate,
  onNote,
  onOpenMaterial,
  onOpenDrawing,
  drawInfo,
  crit,
}: {
  it: StageItem;
  row: StageRow | undefined;
  busy: boolean;
  onStatus: (s: StageStatus) => void;
  onDate: (iso: string) => void;
  onNote: (v: string) => void;
  onOpenMaterial: () => void;
  onOpenDrawing: () => void;
  drawInfo: DrawingSummary | null;
  crit?: CriteriaSet | null;
}) {
  const status: StageStatus = row?.status ?? 'belum';
  const done = status === 'selesai';
  const na = status === 'tidak_ada';
  const note = row?.note ?? '';
  return (
    <li className={`rounded-xl border p-3 ${done ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white'} ${na ? 'opacity-60' : ''}`}>
      <p className={`text-sm font-semibold ${na ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{it.label}</p>
      {it.hint && <p className="mt-0.5 text-xs text-slate-500">{it.hint}</p>}
      {it.material || it.drawing ? (
        <div className="mt-2">
          <Button size="sm" variant="primary" onClick={it.drawing ? onOpenDrawing : onOpenMaterial}>
            {it.drawing ? 'Buka pelacak gambar' : 'Buka pelacak material'}
          </Button>
          {it.drawing && drawInfo && <DrawingMini s={drawInfo} />}
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAGE_STATUSES.map((s) => (
              <Chip key={s} selected={status === s} disabled={busy} onClick={() => onStatus(s)}>
                {STAGE_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          {crit && <CriteriaFold set={crit} />}
          {(done || note !== '') && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {done && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal selesai</span>
                  <DateInput className={INPUT} value={row?.done_date ?? ''} onChange={onDate} />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Catatan</span>
                <NoteInput value={note} disabled={busy} onSave={onNote} />
              </label>
            </div>
          )}
        </>
      )}
    </li>
  );
}

type StageState = 'done' | 'active' | 'pending';

const BADGE_TONE: Record<StageState, string> = {
  done: 'border-teal-600 bg-teal-600 text-white',
  active: 'border-teal-600 bg-white text-teal-700 ring-4 ring-teal-100',
  pending: 'border-slate-300 bg-slate-100 text-slate-500',
};

/** Lencana nomor tahap: angka, atau centang bila tahap selesai. Tahap 3A–3E memakai huruf yang lebih kecil. */
function StageBadge({ st, state }: { st: Stage; state: StageState }) {
  const sub = !!st.group;
  return (
    <span
      className={`absolute left-0 top-3 z-10 flex items-center justify-center rounded-full border-2 text-sm font-extrabold ${sub ? 'h-7 w-7 text-xs' : 'h-8 w-8'} ${sub ? 'ml-0.5' : ''} ${BADGE_TONE[state]}`}
      aria-label={`Tahap ${st.code}${state === 'done' ? ' selesai' : state === 'active' ? ' sedang berjalan' : ''}`}
    >
      {state === 'done' ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      ) : sub ? (
        st.code.replace(/^\d+/, '')
      ) : (
        st.code
      )}
    </span>
  );
}

function StageCard({ st, state, p, open, children }: { st: Stage; state: StageState; p: StageProgress; open: boolean; children: React.ReactNode }) {
  const pct = p.total > 0 ? Math.round((p.selesai / p.total) * 100) : state === 'done' ? 100 : 0;
  return (
    <div className="relative pl-12">
      <StageBadge st={st} state={state} />
      <details open={open} className={`group rounded-2xl border bg-white shadow-sm ${state === 'active' ? 'border-teal-300' : 'border-slate-200'}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className={`text-sm font-bold sm:text-base ${state === 'pending' ? 'text-slate-600' : 'text-slate-900'}`}>{st.title}</h2>
            {state === 'active' && <p className="text-xs font-semibold text-teal-700">Sedang berjalan</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs tabular-nums text-slate-600">{p.selesai}/{p.total}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-xs text-slate-400 transition group-open:rotate-180">▼</span>
          </div>
        </summary>
        <div className="border-t border-slate-100 p-4">{children}</div>
      </details>
    </div>
  );
}

export default function StageTracker({ projectId, projectName, tipe, propelled, vesselType, onBack, onOpenMaterial, onOpenDrawing }: Props) {
  const [rows, setRows] = useState<Map<string, StageRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drawRows, setDrawRows] = useState<Map<string, { status: 'open' | 'closed' | 'tidak_ada' }>>(new Map());
  const [fp, setFp] = useState<boolean | null>(null);
  const [override, setOverride] = useState<string | null>(null);
  const [drawLoaded, setDrawLoaded] = useState(false);

  const ctx = useMemo(() => ({ tipe, propelled }), [tipe, propelled]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_stage_status').select('item_key,status,done_date,note').eq('project_id', projectId);
    if (error) {
      setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_stage_status?)' : ''));
      setLoaded(true);
      return;
    }
    const map = new Map(((data ?? []) as StageRow[]).map((r) => [r.item_key, r] as [string, StageRow]));
    setRows(map);
    setOpenKey(firstOpenStage({ tipe, propelled }, map)?.key ?? null);
    // ringkasan gambar: bila tabelnya belum ada, Tahapan tetap jalan tanpa ringkasan
    const dr = await supabase.from('nb_drawing_status').select('item_key,status').eq('project_id', projectId);
    const pm = await supabase.from('nb_projects').select('fp_above60,drawing_col').eq('id', projectId).maybeSingle();
    if (!dr.error) {
      setDrawRows(new Map(((dr.data ?? []) as { item_key: string; status: 'open' | 'closed' | 'tidak_ada' }[]).map((r) => [r.item_key, { status: r.status }])));
      setDrawLoaded(true);
    }
    if (!pm.error && pm.data) {
      const m = pm.data as { fp_above60: boolean | null; drawing_col: string | null };
      setFp(m.fp_above60);
      setOverride(m.drawing_col);
    }
    setLoaded(true);
  }, [projectId, tipe, propelled]);

  useEffect(() => {
    load();
  }, [load]);

  const drawInfo = useMemo(() => (drawLoaded ? drawingSummary({ vesselType, propelled, fpAbove60: fp, override }, drawRows) : null), [drawLoaded, vesselType, propelled, fp, override, drawRows]);
  const total = useMemo(() => overallProgress(ctx, rows), [ctx, rows]);
  const hidden = useMemo(() => hiddenItemCount(ctx), [ctx]);

  const save = async (st: Stage, it: StageItem, patch: Patch) => {
    if (!supabase) return;
    const key = stageItemKey(st, it);
    const prev = rows.get(key);
    const next: StageRow = {
      item_key: key,
      status: prev?.status ?? 'belum',
      done_date: prev?.done_date ?? null,
      note: prev?.note ?? null,
      ...patch,
    };
    setBusyKey(key);
    setErr('');
    const r = await supabase
      .from('nb_stage_status')
      .upsert({ project_id: projectId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'project_id,item_key' });
    setBusyKey('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((m) => new Map(m).set(key, next));
  };

  const changeStatus = (st: Stage, it: StageItem, status: StageStatus) => {
    const prev = rows.get(stageItemKey(st, it));
    save(st, it, { status, done_date: status === 'selesai' ? prev?.done_date ?? todayIso() : null });
  };

  let lastGroup = '';

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <Button size="sm" onClick={onBack}>← Daftar proyek</Button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Tahapan bangunan baru</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">{tipe ? `Tipe ${tipe}: ${TIPE_LEGEND[tipe]}` : 'Tipe material belum bisa ditentukan (isi GT di data proyek).'}</p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
        <span className="whitespace-nowrap font-bold text-slate-900">{total.selesai} dari {total.total} selesai</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-600" style={{ width: `${total.pct}%` }} />
        </div>
        <span>{total.pct}%</span>
      </div>
      {hidden > 0 && <p className="mt-2 text-xs text-slate-500">{hidden} item tidak berlaku untuk kapal ini dan disembunyikan.</p>}

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : (
        <div className="relative mt-4 space-y-3">
          <span className="absolute bottom-6 left-4 top-6 w-0.5 bg-slate-200" aria-hidden="true" />
          {STAGES.map((st) => {
            const heading = st.group && st.group !== lastGroup ? st.group : null;
            lastGroup = st.group ?? '';
            const p = stageProgress(st, ctx, rows);
            const done = isStageDone(st, ctx, rows) && p.selesai + p.tidakAda > 0;
            const state: StageState = done ? 'done' : openKey === st.key ? 'active' : 'pending';
            return (
              <React.Fragment key={st.key}>
                {heading && <h2 className="relative pl-12 pt-2 text-xs font-bold uppercase tracking-widest text-slate-500">{heading}</h2>}
                <StageCard st={st} state={state} p={p} open={openKey === st.key}>
                  {st.key === 'commencement' && drawInfo && drawInfo.open > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">Masih ada {drawInfo.open} gambar yang berstatus Open.</p>
                      <p className="mt-0.5">Gambar yang dihitung sebaiknya sudah closed (disetujui BKI) sebelum Commencement. Ini hanya pengingat, tahap tetap bisa dilanjutkan.</p>
                      <Button size="sm" variant="warn" className="mt-2" onClick={onOpenDrawing}>Buka pelacak gambar</Button>
                    </div>
                  )}
                  <ul className="space-y-2">
                    {applicableItems(st, ctx).map((it) => {
                      const key = stageItemKey(st, it);
                      return (
                        <ItemRow
                          key={key}
                          it={it}
                          row={rows.get(key)}
                          busy={busyKey === key}
                          onStatus={(s) => changeStatus(st, it, s)}
                          onDate={(iso) => save(st, it, { done_date: iso === '' ? null : iso })}
                          onNote={(v) => save(st, it, { note: v === '' ? null : v })}
                          onOpenMaterial={onOpenMaterial}
                          onOpenDrawing={onOpenDrawing}
                          drawInfo={drawInfo}
                          crit={criteriaFor(key)}
                        />
                      );
                    })}
                  </ul>
                </StageCard>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </main>
  );
}
