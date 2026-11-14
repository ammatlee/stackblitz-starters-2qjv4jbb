'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { saveKeyedRow, selectKeyed } from '../../lib/rowLock';
import type { KeyedClient } from '../../lib/rowLock';
import type { MatStatus } from '../../lib/materialTracker';
import type { MatTipe } from '../../lib/materialRules';
import { FORM_GROUP_LABEL, SECTION_ORDER, SECTION_TITLE, canDefer, formGroupOf, missingListText, summarizeCert } from '../../lib/newbuildingCertDocs';
import type { CertCtx, DocRow, DocStatus, Prog, Resolved } from '../../lib/newbuildingCertDocs';
import { BlurInput, INPUT } from './fields';
import { todayIso } from '../../lib/todayIso';

type Props = {
  projectId: string;
  projectName: string;
  vesselType: string | null;
  propelled: boolean;
  tipe: MatTipe | null;
  /** Ada permohonan load line (kolom load_line di data proyek). */
  loadLine: boolean;
  onBack: () => void;
  onOpenMaterial: () => void;
  /** Mengubah isian load line di data proyek; mengembalikan pesan galat ('' bila berhasil). */
  onSetLoadLine: (v: boolean) => Promise<string>;
};

type Filter = 'semua' | 'kurang' | 'interim';
type Patch = Partial<Omit<DocRow, 'item_key'>>;

/** Ringkasan satu kelompok (Interim / Permanent): batang kemajuan dan daftar yang masih kurang. */
function ProgBox({ title, p, tone }: { title: string; p: Prog; tone: string }) {
  const complete = p.missing.length === 0;
  return (
    <div className={`rounded-xl border p-3 ${complete ? 'border-teal-300 bg-teal-50' : tone}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-xs font-bold tabular-nums text-slate-700">{p.done} dari {p.total}</p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/80">
        <div className="h-full bg-teal-600" style={{ width: `${p.pct}%` }} />
      </div>
      {complete ? (
        <p className="mt-2 text-xs font-semibold text-teal-800">Lengkap. Siap diterbitkan.</p>
      ) : (
        <details className="mt-2 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold text-amber-900">Kurang {p.missing.length} dokumen</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {p.missing.map((r) => (
              <li key={r.item.key}>
                {r.item.code ? <span className="font-mono text-[11px] text-slate-500">{r.item.code} </span> : null}
                {r.item.label}
                {r.status === 'menyusul' ? <b className="text-amber-800"> (menyusul)</b> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function DocItemRow({
  r,
  row,
  busy,
  onStatus,
  onDate,
  onNote,
  onOpenMaterial,
}: {
  r: Resolved;
  row: DocRow | undefined;
  busy: boolean;
  onStatus: (s: DocStatus) => void;
  onDate: (iso: string) => void;
  onNote: (v: string) => void;
  onOpenMaterial: () => void;
}) {
  const it = r.item;
  const ada = r.status === 'ada';
  const na = r.status === 'tidak_ada';
  const later = r.status === 'menyusul';
  const manual = row?.status ?? 'belum';
  const note = row?.note ?? '';
  const material = it.derived && it.derived !== 'interim';
  return (
    <li className={`rounded-xl border p-3 ${ada ? 'border-teal-200 bg-teal-50/50' : later ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white'} ${na ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`${it.label} ada`}
          className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600"
          checked={ada}
          disabled={busy || na || r.auto}
          onChange={() => onStatus(ada ? 'belum' : 'ada')}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${na ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {it.code ? <span className="mr-1.5 font-mono text-xs font-medium text-slate-500">{it.code}</span> : null}
            {it.label}
          </p>
          {it.hint && <p className="mt-0.5 text-xs text-slate-500">{it.hint}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            {it.interim && <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-800">Wajib Interim</span>}
            {later && <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold text-amber-900">Menyusul</span>}
            {r.auto && r.detail && !na && <span className="text-slate-600">{r.detail}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 print:hidden">
          <button
            type="button"
            disabled={busy}
            title="Tandai tidak berlaku untuk kapal ini"
            onClick={() => onStatus(na ? 'belum' : 'tidak_ada')}
            className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${na ? 'border-slate-400 bg-slate-200 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
          >
            N/A
          </button>
          {canDefer(it) && !na && !ada && (
            <button
              type="button"
              disabled={busy}
              title="Akan diserahkan bersama laporan lengkap"
              onClick={() => onStatus(later ? 'belum' : 'menyusul')}
              className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${later ? 'border-amber-500 bg-amber-200 text-amber-900' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            >
              Menyusul
            </button>
          )}
        </div>
      </div>
      {material && !na && !ada && (
        <div className="mt-2 pl-8 print:hidden">
          <Button size="sm" variant="primary" onClick={onOpenMaterial}>Buka pelacak material</Button>
        </div>
      )}
      {!r.auto && (manual === 'ada' || manual === 'menyusul' || note !== '') && (
        <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
          {manual === 'ada' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Tanggal diterima</span>
              <DateInput className={INPUT} value={row?.recv_date ?? ''} onChange={onDate} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">{manual === 'menyusul' ? 'Catatan / target tanggal' : 'Catatan'}</span>
            <BlurInput value={note} disabled={busy} placeholder="Catatan (opsional)" onSave={onNote} />
          </label>
        </div>
      )}
    </li>
  );
}

export default function DocTracker({ projectId, projectName, vesselType, propelled, tipe, loadLine, onBack, onOpenMaterial, onSetLoadLine }: Props) {
  const [rows, setRows] = useState<Map<string, DocRow>>(new Map());
  const [matRows, setMatRows] = useState<Map<string, { status: MatStatus }> | null>(null);
  const [interimDone, setInterimDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [llBusy, setLlBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('semua');
  const [copyText, setCopyText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // false bila kolom version belum ada di database: simpan dengan cara lama (tanpa cek edit bersamaan)
  const versioned = useRef(true);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const sb = supabase;
    const [dc, mt, st] = await Promise.all([
      selectKeyed(sb as unknown as KeyedClient, 'nb_doc_status', 'item_key,status,recv_date,note', projectId),
      sb.from('nb_material_status').select('item_key,status').eq('project_id', projectId),
      sb.from('nb_stage_status').select('item_key,status').eq('project_id', projectId).eq('item_key', 'certificate.interim').maybeSingle(),
    ]);
    versioned.current = dc.versioned;
    if (dc.error) {
      setErr(dc.error.message + (/relation|does not exist/i.test(dc.error.message) ? ' (sudah menjalankan SQL nb_doc_status?)' : ''));
      setLoaded(true);
      return;
    }
    setRows(new Map(((dc.data ?? []) as DocRow[]).map((r) => [r.item_key, r] as [string, DocRow])));
    // pelacak material dan status Interim hanya memperkaya tampilan; bila gagal dibaca, butir turunan tampil Belum
    setMatRows(mt.error ? null : new Map(((mt.data ?? []) as { item_key: string; status: MatStatus }[]).map((r) => [r.item_key, { status: r.status }] as [string, { status: MatStatus }])));
    setInterimDone(!st.error && (st.data as { status?: string } | null)?.status === 'selesai');
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx: CertCtx = useMemo(() => ({ vesselType, propelled, loadLine, tipe }), [vesselType, propelled, loadLine, tipe]);
  const sum = useMemo(() => summarizeCert(ctx, { docRows: rows, matRows, interimDone }), [ctx, rows, matRows, interimDone]);
  const group = formGroupOf(vesselType);

  const shown = useMemo(
    () =>
      sum.items.filter((r) => {
        if (filter === 'kurang') return r.status === 'belum' || r.status === 'menyusul';
        if (filter === 'interim') return r.item.interim;
        return true;
      }),
    [sum, filter],
  );

  const save = async (it: Resolved['item'], patch: Patch) => {
    if (!supabase) return;
    const prev = rows.get(it.key);
    const next: DocRow = {
      item_key: it.key,
      status: prev?.status ?? 'belum',
      recv_date: prev?.recv_date ?? null,
      note: prev?.note ?? null,
      ...patch,
    };
    setBusyKey(it.key);
    setErr('');
    // baris sudah ada: cek version; belum ada: insert; kolom version belum ada: cara lama
    const ver = !versioned.current ? undefined : prev ? prev.version : null;
    const r = await saveKeyedRow(supabase as unknown as KeyedClient, 'nb_doc_status', projectId, it.key, ver, {
      status: next.status,
      recv_date: next.recv_date,
      note: next.note,
      updated_at: new Date().toISOString(),
    });
    setBusyKey('');
    if (r.status !== 'ok') {
      if (r.status === 'conflict') await load(); // tampilkan data terbaru dulu, lalu pesannya
      setErr(r.message);
      return;
    }
    setRows((m) => new Map(m).set(it.key, { ...next, version: r.version }));
  };

  const setStatus = (it: Resolved['item'], status: DocStatus) => {
    const prev = rows.get(it.key);
    save(it, { status, recv_date: status === 'ada' ? prev?.recv_date ?? todayIso() : null });
  };

  const changeLoadLine = async (v: boolean) => {
    if (v === loadLine) return;
    setLlBusy(true);
    setErr('');
    const m = await onSetLoadLine(v);
    setLlBusy(false);
    if (m) setErr(m);
  };

  const copy = async () => {
    const text = missingListText(projectName, sum);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyText(null);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard ditolak browser: tampilkan teksnya supaya bisa disalin manual
      setCopyText(text);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="print:hidden">
        <Button size="sm" onClick={onBack}>← Tahapan</Button>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Dokumen sertifikasi</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Semua dokumen wajib, kecuali ditandai N/A. Centang sekali: dokumen Interim otomatis ikut terhitung di Permanent.
      </p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 print:hidden">
        <span className="mb-1 block text-xs font-semibold text-slate-600">Permohonan load line</span>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!loadLine} disabled={llBusy} onClick={() => changeLoadLine(false)}>Tidak ada</Chip>
          <Chip selected={loadLine} disabled={llBusy} onClick={() => changeLoadLine(true)}>Ada permohonan load line</Chip>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {loadLine ? 'Form F23 (statutory, load line) serta BA tanda garis muat dan bukti PNBP ikut diwajibkan.' : 'Form F23 serta BA tanda garis muat dan bukti PNBP disembunyikan.'}
        </p>
      </div>

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProgBox title="Interim certificate" p={sum.interim} tone="border-amber-300 bg-amber-50" />
            <ProgBox title="Permanent certificate" p={sum.permanent} tone="border-amber-300 bg-amber-50" />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {group ? FORM_GROUP_LABEL[group] : 'Jenis kapal ini tidak punya grup form tambahan di standar PKBB: hanya form utama yang dihitung.'}
            {sum.hidden > 0 ? ` ${sum.hidden} dokumen tidak berlaku (load line, penggerak, atau tipe material) dan disembunyikan.` : ''}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <Chip selected={filter === 'semua'} onClick={() => setFilter('semua')}>Semua ({sum.items.length})</Chip>
            <Chip selected={filter === 'kurang'} onClick={() => setFilter('kurang')}>Belum lengkap ({sum.permanent.missing.length})</Chip>
            <Chip selected={filter === 'interim'} onClick={() => setFilter('interim')}>Wajib Interim ({sum.interim.total})</Chip>
            <Button size="sm" onClick={copy}>{copied ? 'Tersalin' : 'Salin daftar kekurangan'}</Button>
            <Button size="sm" onClick={() => window.print()}>Cetak / PDF</Button>
          </div>
          {copyText !== null && (
            <textarea readOnly className={`${INPUT} mt-2 h-40 font-mono text-xs`} value={copyText} onFocus={(e) => e.currentTarget.select()} />
          )}

          {shown.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              {filter === 'kurang' ? 'Semua dokumen sudah lengkap.' : 'Tidak ada dokumen yang cocok.'}
            </p>
          ) : (
            SECTION_ORDER.map((sec) => {
              const list = shown.filter((r) => r.item.section === sec);
              if (list.length === 0) return null;
              const all = sum.items.filter((r) => r.item.section === sec && r.status !== 'tidak_ada');
              const done = all.filter((r) => r.status === 'ada').length;
              return (
                <section key={sec} className="mt-5">
                  <h2 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                    <span>{SECTION_TITLE[sec]}</span>
                    <span className="tabular-nums">{done}/{all.length}</span>
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {list.map((r) => (
                      <DocItemRow
                        key={r.item.key}
                        r={r}
                        row={rows.get(r.item.key)}
                        busy={busyKey === r.item.key}
                        onStatus={(s) => setStatus(r.item, s)}
                        onDate={(iso) => save(r.item, { recv_date: iso === '' ? null : iso })}
                        onNote={(v) => save(r.item, { note: v === '' ? null : v })}
                        onOpenMaterial={onOpenMaterial}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}
    </main>
  );
}
