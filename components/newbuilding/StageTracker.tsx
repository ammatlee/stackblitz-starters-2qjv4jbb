'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { TIPE_LEGEND } from '../../lib/materialRules';
import type { MatTipe } from '../../lib/materialRules';
import { STAGES, STAGE_STATUSES, STAGE_STATUS_LABEL, applicableItems, drawingGate, firstOpenStage, hiddenItemCount, isStageDone, overallProgress, stageItemKey, stageProgress } from '../../lib/newbuildingStages';
import { criteriaFor, suggestRegime } from '../../lib/newbuildingCriteria';
import CriteriaFold from './CriteriaFold';
import { summarizeTankTests, tankSummaryText } from '../../lib/newbuildingTankTests';
import type { TankSummary } from '../../lib/newbuildingTankTests';
import { drawingSummary } from '../../lib/newbuildingDrawings';
import { findingGate, openFindingsText, summarizeFindings } from '../../lib/newbuildingFindings';
import type { DrawingSummary } from '../../lib/newbuildingDrawings';
import { certGate, summarizeCert } from '../../lib/newbuildingCertDocs';
import type { CertSummary, DocStatus } from '../../lib/newbuildingCertDocs';
import type { MatStatus } from '../../lib/materialTracker';
import type { CriteriaSet, Regime } from '../../lib/newbuildingCriteria';
import type { Stage, StageItem, StageProgress, StageRow, StageStatus } from '../../lib/newbuildingStages';
import { INPUT } from './fields';
import { todayIso } from '../../lib/todayIso';
import { saveKeyedRow, selectKeyed } from '../../lib/rowLock';
import type { KeyedClient } from '../../lib/rowLock';

type Props = {
  projectId: string;
  projectName: string;
  tipe: MatTipe | null;
  propelled: boolean;
  international: boolean;
  gt: number | null;
  vesselType: string | null;
  /** Ada permohonan load line (menentukan dokumen yang diwajibkan sebelum sertifikat). */
  loadLine: boolean;
  onBack: () => void;
  onOpenMaterial: () => void;
  onOpenDrawing: () => void;
  onOpenTankTests: () => void;
  onOpenFindings: () => void;
  onOpenDocs: () => void;
};

type Patch = Partial<Omit<StageRow, 'item_key'>>;

type GateKind = 'drawing' | 'finding' | 'docs' | 'order';

const GATE_FIX: Record<GateKind, string> = {
  drawing: 'selesaikan gambarnya',
  finding: 'tutup temuannya',
  docs: 'lengkapi dokumennya',
  order: 'selesaikan item sebelumnya',
};
const GATE_BUTTON: Record<GateKind, string> = {
  drawing: 'Buka pelacak gambar',
  finding: 'Buka daftar temuan',
  docs: 'Buka daftar dokumen',
  order: '',
};

/** Tahap setelah Fabrication: temuan Open yang tersisa diingatkan di sini. */
const AFTER_FABRICATION = ['keel', 'commissioning', 'completion'];

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

/** Pengingat kelengkapan dokumen di tahap Sertifikasi: berapa yang sudah ada dan apa yang masih kurang. */
function CertPanel({ sum, onOpen }: { sum: CertSummary | null; onOpen: () => void }) {
  if (!sum) {
    return (
      <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">Data dokumen sertifikasi belum bisa dibaca.</p>
        <p className="mt-0.5">Sudah menjalankan SQL nb_doc_status? Selama belum terbaca, Interim dan Permanent tidak bisa diselesaikan.</p>
        <Button size="sm" variant="warn" className="mt-2" onClick={onOpen}>Buka daftar dokumen</Button>
      </div>
    );
  }
  const block = (title: string, p: CertSummary['interim']) => (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-slate-900">{title}</span>
        <span className="tabular-nums text-slate-600">{p.done}/{p.total}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-teal-600" style={{ width: `${p.pct}%` }} />
      </div>
      {p.missing.length === 0 ? (
        <p className="mt-1 text-xs font-semibold text-teal-800">Lengkap</p>
      ) : (
        <p className="mt-1 text-xs text-amber-900">
          Kurang {p.missing.length}: {p.missing.slice(0, 3).map((r) => r.item.code ?? r.item.label).join(', ')}
          {p.missing.length > 3 ? `, dan ${p.missing.length - 3} lainnya` : ''}
        </p>
      )}
    </div>
  );
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kelengkapan dokumen</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        {block('Interim', sum.interim)}
        {block('Permanent', sum.permanent)}
      </div>
      <Button size="sm" variant="primary" className="mt-3" onClick={onOpen}>Buka daftar dokumen</Button>
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
  regimeHint,
  tank,
  findOpen,
  onOpenFindings,
  onOpenDocs,
  gate,
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
  regimeHint?: { regime: Regime | null; reason: string } | null;
  tank?: { kind: 'leak' | 'struct'; sum: TankSummary | null; onOpen: () => void } | null;
  findOpen: number;
  onOpenFindings: () => void;
  onOpenDocs: () => void;
  /** Alasan item ini belum boleh Selesai/N/A (gambar atau temuan masih Open, dokumen kurang, atau tahap sebelumnya belum selesai); null = boleh. */
  gate: { msg: string; kind: GateKind } | null;
}) {
  const status: StageStatus = row?.status ?? 'belum';
  const done = status === 'selesai';
  const na = status === 'tidak_ada';
  const note = row?.note ?? '';
  // item ditandai Selesai padahal daftar uji per kompartemen belum lulus semua: hanya pengingat
  const tankGap = tank && done && tank.sum && tank.sum.total > 0 ? (tank.kind === 'leak' ? tank.sum.total - tank.sum.leakPass : tank.sum.structNeeded - tank.sum.structPass) : 0;
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
              <Chip key={s} selected={status === s} disabled={busy || (!!gate && s !== 'belum')} onClick={() => onStatus(s)}>
                {STAGE_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          {gate && (
            <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-900">
              <p className="font-semibold">{status !== 'belum' ? 'Status ini tidak sesuai: ' : 'Belum bisa diselesaikan: '}{gate.msg}</p>
              {status !== 'belum' && <p className="mt-0.5">Ubah kembali ke Belum, atau {GATE_FIX[gate.kind]} dulu.</p>}
              {gate.kind !== 'order' && (
                <Button size="sm" variant="warn" className="mt-2" onClick={gate.kind === 'drawing' ? onOpenDrawing : gate.kind === 'finding' ? onOpenFindings : onOpenDocs}>{GATE_BUTTON[gate.kind]}</Button>
              )}
            </div>
          )}
          {crit && <CriteriaFold set={crit} regimeHint={regimeHint} />}
          {tank && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Button size="sm" onClick={tank.onOpen}>Daftar uji per kompartemen</Button>
              {tank.sum && tank.sum.total > 0 && <span>{tankSummaryText(tank.kind, tank.sum)}</span>}
            </div>
          )}
          {tankGap > 0 && tank && (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Item ini ditandai Selesai, tetapi {tankGap} kompartemen di daftar uji belum {tank.kind === 'leak' ? 'lulus leak test' : 'lulus uji struktural'}. Hanya pengingat.
            </p>
          )}
          {findOpen > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className="font-semibold">{openFindingsText(findOpen)}</span>
              <Button size="sm" variant="warn" onClick={onOpenFindings}>Lihat temuan</Button>
            </div>
          )}
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

export default function StageTracker({ projectId, projectName, tipe, propelled, international, gt, vesselType, loadLine, onBack, onOpenMaterial, onOpenDrawing, onOpenTankTests, onOpenFindings, onOpenDocs }: Props) {
  const [rows, setRows] = useState<Map<string, StageRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  // false bila kolom version belum ada di database: simpan dengan cara lama (tanpa cek edit bersamaan)
  const versioned = useRef(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drawRows, setDrawRows] = useState<Map<string, { status: 'open' | 'closed' | 'tidak_ada' }>>(new Map());
  const [fp, setFp] = useState<boolean | null>(null);
  const [override, setOverride] = useState<string | null>(null);
  const [drawLoaded, setDrawLoaded] = useState(false);
  const [tankRows, setTankRows] = useState<{ leak_status: 'belum' | 'lulus' | 'tidak_lulus'; struct_status: 'belum' | 'lulus' | 'tidak_lulus' | 'tidak_perlu' }[] | null>(null);

  const [findRows, setFindRows] = useState<{ item_key: string | null; status: 'open' | 'closed' }[] | null>(null);
  // dokumen sertifikasi dan status pelacak material; null = tabelnya belum bisa dibaca
  const [docRows, setDocRows] = useState<Map<string, { status: DocStatus }> | null>(null);
  const [matRows, setMatRows] = useState<Map<string, { status: MatStatus }> | null>(null);

  const ctx = useMemo(() => ({ tipe, propelled }), [tipe, propelled]);
  const regimeHint = useMemo(() => suggestRegime({ propelled, international, gt }), [propelled, international, gt]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    // tujuh bacaan berjalan bersamaan; hanya tahapan yang wajib, sisanya bersifat ringkasan
    const [st, dr, pm, tt, fd, dc, mt] = await Promise.all([
      selectKeyed(supabase as unknown as KeyedClient, 'nb_stage_status', 'item_key,status,done_date,note', projectId),
      supabase.from('nb_drawing_status').select('item_key,status').eq('project_id', projectId),
      supabase.from('nb_projects').select('fp_above60,drawing_col').eq('id', projectId).maybeSingle(),
      supabase.from('nb_tank_tests').select('leak_status,struct_status').eq('project_id', projectId),
      supabase.from('nb_findings').select('item_key,status').eq('project_id', projectId),
      supabase.from('nb_doc_status').select('item_key,status').eq('project_id', projectId),
      supabase.from('nb_material_status').select('item_key,status').eq('project_id', projectId),
    ]);
    const { data, error } = st;
    versioned.current = st.versioned;
    if (error) {
      setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_stage_status?)' : ''));
      setLoaded(true);
      return;
    }
    const map = new Map(((data ?? []) as StageRow[]).map((r) => [r.item_key, r] as [string, StageRow]));
    setRows(map);
    setOpenKey(firstOpenStage({ tipe, propelled }, map)?.key ?? null);
    // ringkasan gambar: bila tabelnya belum ada, Tahapan tetap jalan tanpa ringkasan
    if (!dr.error) {
      setDrawRows(new Map(((dr.data ?? []) as { item_key: string; status: 'open' | 'closed' | 'tidak_ada' }[]).map((r) => [r.item_key, { status: r.status }])));
      setDrawLoaded(true);
    }
    // daftar uji per kompartemen: bila tabelnya belum ada, Tahapan tetap jalan tanpa ringkasan
    if (!tt.error) setTankRows((tt.data ?? []) as NonNullable<typeof tankRows>);
    // daftar temuan: bila tabelnya belum ada, Tahapan tetap jalan tanpa pengingat
    if (!fd.error) setFindRows((fd.data ?? []) as NonNullable<typeof findRows>);
    // dokumen sertifikasi: bila tabelnya belum ada, Interim dan Permanent tetap terkunci (penjaga tidak bisa memeriksa)
    setDocRows(dc.error ? null : new Map(((dc.data ?? []) as { item_key: string; status: DocStatus }[]).map((r) => [r.item_key, { status: r.status }] as [string, { status: DocStatus }])));
    setMatRows(mt.error ? null : new Map(((mt.data ?? []) as { item_key: string; status: MatStatus }[]).map((r) => [r.item_key, { status: r.status }] as [string, { status: MatStatus }])));
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
  const tankSum = useMemo(() => (tankRows ? summarizeTankTests(tankRows) : null), [tankRows]);
  const findSum = useMemo(() => (findRows ? summarizeFindings(findRows) : null), [findRows]);
  const certSum = useMemo(
    () => (docRows ? summarizeCert({ vesselType, propelled, loadLine, tipe }, { docRows, matRows, interimDone: rows.get('certificate.interim')?.status === 'selesai' }) : null),
    [docRows, matRows, rows, vesselType, propelled, loadLine, tipe],
  );
  const finalStatus = rows.get('certificate.final')?.status;
  const finalDone = finalStatus === 'selesai' || finalStatus === 'tidak_ada';
  /** Penjaga item: gambar masih Open, temuan masih Open, atau dokumen sertifikasi kurang. null = item boleh diselesaikan. */
  const gateOf = (key: string): { msg: string; kind: GateKind } | null => {
    const d = drawingGate(key, drawInfo);
    if (d) return { msg: d, kind: 'drawing' };
    const f = findingGate(key, findSum ? findSum.openByItem : null);
    if (f) return { msg: f, kind: 'finding' };
    const c = certGate(key, certSum, finalDone);
    return c ? { msg: c.msg, kind: c.kind } : null;
  };
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
    // baris sudah ada: cek version; belum ada: insert; kolom version belum ada: cara lama
    const ver = !versioned.current ? undefined : prev ? prev.version : null;
    const r = await saveKeyedRow(supabase as unknown as KeyedClient, 'nb_stage_status', projectId, key, ver, {
      status: next.status,
      done_date: next.done_date,
      note: next.note,
      updated_at: new Date().toISOString(),
    });
    setBusyKey('');
    if (r.status !== 'ok') {
      if (r.status === 'conflict') await load(); // tampilkan data terbaru dulu, lalu pesannya
      setErr(r.message);
      return;
    }
    setRows((m) => new Map(m).set(key, { ...next, version: r.version }));
  };

  const changeStatus = (st: Stage, it: StageItem, status: StageStatus) => {
    // penjaga kedua (tombolnya sudah dimatikan di tampilan): selama ada gambar atau temuan Open, tidak boleh Selesai atau N/A
    const block = status !== 'belum' ? gateOf(stageItemKey(st, it)) : null;
    if (block) {
      setErr(block.msg);
      return;
    }
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
            // tahap tidak dianggap selesai bila ada item yang ditandai Selesai padahal gambar atau temuan masih Open
            const inconsistent = applicableItems(st, ctx).some((it) => (rows.get(stageItemKey(st, it))?.status ?? 'belum') !== 'belum' && gateOf(stageItemKey(st, it)) !== null);
            const done = isStageDone(st, ctx, rows) && p.selesai + p.tidakAda > 0 && !inconsistent;
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
                  {st.key === 'fabrication' && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <Button size="sm" onClick={onOpenFindings}>Daftar temuan</Button>
                      {findSum && findSum.total > 0 && (
                        <span>
                          <b className={findSum.open > 0 ? 'text-amber-800' : ''}>{findSum.open}</b> Open · <b>{findSum.closed}</b> Closed
                        </span>
                      )}
                    </div>
                  )}
                  {AFTER_FABRICATION.includes(st.key) && findSum && findSum.open > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">Masih ada {openFindingsText(findSum.open)} di daftar temuan.</p>
                      <p className="mt-0.5">Temuan sebaiknya sudah ditutup sebelum tahap ini. Ini hanya pengingat, tahap tetap bisa dilanjutkan.</p>
                      <Button size="sm" variant="warn" className="mt-2" onClick={onOpenFindings}>Buka daftar temuan</Button>
                    </div>
                  )}
                  {st.key === 'certificate' && <CertPanel sum={certSum} onOpen={onOpenDocs} />}
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
                          regimeHint={regimeHint}
                          findOpen={findSum ? findSum.openByItem[key] ?? 0 : 0}
                          gate={gateOf(key)}
                          onOpenFindings={onOpenFindings}
                          onOpenDocs={onOpenDocs}
                          tank={key === 'fabrication.leaktest' ? { kind: 'leak', sum: tankSum, onOpen: onOpenTankTests } : key === 'fabrication.structtest' ? { kind: 'struct', sum: tankSum, onOpen: onOpenTankTests } : null}
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
