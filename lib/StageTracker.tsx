'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import { Fold } from '../classValidity/ui';
import DateInput from '../DateInput';
import { TIPE_LEGEND } from '../../lib/materialRules';
import type { MatTipe } from '../../lib/materialRules';
import { STAGES, STAGE_STATUSES, STAGE_STATUS_LABEL, applicableItems, firstOpenStage, hiddenItemCount, overallProgress, stageItemKey, stageProgress } from '../../lib/newbuildingStages';
import type { Stage, StageItem, StageRow, StageStatus } from '../../lib/newbuildingStages';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

type Props = {
  projectId: string;
  projectName: string;
  tipe: MatTipe | null;
  propelled: boolean;
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

function ItemRow({
  it,
  row,
  busy,
  onStatus,
  onDate,
  onNote,
  onOpenMaterial,
  onOpenDrawing,
}: {
  it: StageItem;
  row: StageRow | undefined;
  busy: boolean;
  onStatus: (s: StageStatus) => void;
  onDate: (iso: string) => void;
  onNote: (v: string) => void;
  onOpenMaterial: () => void;
  onOpenDrawing: () => void;
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

export default function StageTracker({ projectId, projectName, tipe, propelled, onBack, onOpenMaterial, onOpenDrawing }: Props) {
  const [rows, setRows] = useState<Map<string, StageRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

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
    setLoaded(true);
  }, [projectId, tipe, propelled]);

  useEffect(() => {
    load();
  }, [load]);

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
        <div className="mt-4 space-y-3">
          {STAGES.map((st) => {
            const heading = st.group && st.group !== lastGroup ? st.group : null;
            lastGroup = st.group ?? '';
            const p = stageProgress(st, ctx, rows);
            return (
              <React.Fragment key={st.key}>
                {heading && <h2 className="pt-2 text-xs font-bold uppercase tracking-widest text-slate-500">{heading}</h2>}
                <Fold
                  title={`${st.code}. ${st.title}`}
                  open={openKey === st.key}
                  right={<span className="text-xs tabular-nums text-slate-600">{p.selesai}/{p.total}</span>}
                >
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
                        />
                      );
                    })}
                  </ul>
                </Fold>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </main>
  );
}
