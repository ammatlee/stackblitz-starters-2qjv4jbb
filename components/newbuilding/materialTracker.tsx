'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import { saveKeyedRow, selectKeyed } from '../../lib/rowLock';
import type { KeyedClient } from '../../lib/rowLock';
import { CELL_LEGEND, COL_LEGEND, NOTES, TIPE_LEGEND, WELDING, cellsFor, parseCell, vesselProfile } from '../../lib/materialRules';
import type { MatItem, MatTipe } from '../../lib/materialRules';
import { STATUSES, STATUS_LABEL, itemKey, progressOf, trackerItems } from '../../lib/materialTracker';
import type { MatStatus, MatStatusRow } from '../../lib/materialTracker';
import { INPUT } from './fields';

const TD = 'px-1 py-1.5 align-top';

type Props = {
  projectId: string;
  projectName: string;
  tipe: MatTipe | null;
  /** Jenis kapal dan penggerak: dipakai untuk menyembunyikan item yang tidak relevan. */
  vesselType?: string | null;
  propelled?: boolean;
  onBack: () => void;
};

type Filter = 'semua' | MatStatus;

const CODE_TONE: Record<string, string> = {
  V: 'text-teal-800',
  X: 'text-sky-700',
  M: 'text-amber-700',
};

/** Satu sel syarat (MP / TA / PC): kode V/X/M dengan nomor catatan sebagai superskrip. */
function Cell({ v }: { v: string }) {
  const p = parseCell(v);
  if (!p) return <span className="text-slate-300">–</span>;
  return (
    <span className={`font-bold ${CODE_TONE[p.code]}`} title={CELL_LEGEND[p.code]}>
      {p.code}
      {p.notes.length > 0 && <sup className="ml-0.5 text-[9px] font-semibold text-slate-500">{p.notes.join(',')}</sup>}
    </span>
  );
}

/** Catatan angka yang dipakai oleh satu item (untuk daftar catatan di bawah tabel). */
function notesOf(it: MatItem, tipe: MatTipe | null): number[] {
  if (!tipe || it.welding) return [];
  const c = cellsFor(it, tipe);
  if (typeof c === 'string') return [];
  return c.flatMap((x) => parseCell(x)?.notes ?? []);
}

/** Kolom syarat: tiga sel MP/TA/PC, atau satu sel gabungan untuk tipe D, item pengelasan, dan tipe yang belum ada. */
function Requirement({ it, tipe }: { it: MatItem; tipe: MatTipe | null }) {
  const span = (node: React.ReactNode) => (
    <td colSpan={3} className={`${TD} text-center text-[11px] leading-tight text-slate-700`}>
      {node}
    </td>
  );
  if (!tipe) return span('–');
  if (it.welding) {
    const a = WELDING[it.welding][tipe];
    return span(<b className="text-teal-800">{a ?? '–'}</b>);
  }
  const c = cellsFor(it, tipe);
  if (typeof c === 'string') return span(c === '-' ? '–' : c);
  return (
    <>
      {c.map((cell, i) => (
        <td key={i} className={`${TD} text-center text-xs`}>
          <Cell v={cell} />
        </td>
      ))}
    </>
  );
}

function Row({
  it,
  tipe,
  status,
  busy,
  onStatus,
}: {
  it: MatItem;
  tipe: MatTipe | null;
  status: MatStatus;
  busy: boolean;
  onStatus: (it: MatItem, s: MatStatus) => void;
}) {
  const na = status === 'tidak_ada';
  const ada = status === 'diterima';
  return (
    <tr className={`border-b border-slate-100 ${ada ? 'bg-teal-50/50' : ''} ${na ? 'bg-slate-50 text-slate-400' : ''}`}>
      <td className={`${TD} pl-2 text-xs text-slate-500`}>{it.no}</td>
      <td className={`${TD} pr-2 text-xs ${na ? 'line-through' : 'text-slate-900'}`}>
        <span className="font-semibold">{it.product}</span>
        {it.kind ? <span className="block text-[11px] font-normal text-slate-500">{it.kind}</span> : null}
      </td>
      <Requirement it={it} tipe={tipe} />
      <td className={`${TD} text-center`}>
        <input
          type="checkbox"
          aria-label={`Sertifikat ${it.product} ada`}
          className="h-5 w-5 accent-teal-600"
          checked={ada}
          disabled={busy || na}
          onChange={() => onStatus(it, ada ? 'belum' : 'diterima')}
        />
      </td>
      <td className={`${TD} pr-2 text-center print:hidden`}>
        <button
          type="button"
          disabled={busy}
          title="Tandai tidak ada di kapal ini"
          onClick={() => onStatus(it, na ? 'belum' : 'tidak_ada')}
          className={`rounded border px-1 text-[10px] font-semibold ${na ? 'border-slate-400 bg-slate-200 text-slate-700' : 'border-slate-200 text-slate-400 hover:bg-slate-100'}`}
        >
          N/A
        </button>
      </td>
    </tr>
  );
}

export default function MaterialTracker({ projectId, projectName, tipe, vesselType = null, propelled = true, onBack }: Props) {
  const [rows, setRows] = useState<Map<string, MatStatusRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  // false bila kolom version belum ada di database: simpan dengan cara lama (tanpa cek edit bersamaan)
  const versioned = useRef(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error, versioned: hasVersion } = await selectKeyed(supabase as unknown as KeyedClient, 'nb_material_status', 'item_key,status,cert_no,note', projectId);
    versioned.current = hasVersion;
    if (error) {
      setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_material_status?)' : ''));
      setLoaded(true);
      return;
    }
    setRows(new Map(((data ?? []) as MatStatusRow[]).map((r) => [r.item_key, r])));
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const ctx = useMemo(() => ({ vesselType, propelled }), [vesselType, propelled]);
  const profile = vesselProfile(ctx);
  const items = useMemo(() => trackerItems(tipe, showAll, ctx), [tipe, showAll, ctx]);
  const hiddenCount = useMemo(() => (tipe && !showAll ? trackerItems(tipe, false).length - items.length : 0), [tipe, showAll, items]);
  const prog = useMemo(() => progressOf(items, rows), [items, rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'semua' && (rows.get(itemKey(it))?.status ?? 'belum') !== filter) return false;
      return !term || `${it.no} ${it.product} ${it.kind ?? ''}`.toLowerCase().includes(term);
    });
  }, [items, rows, q, filter]);

  /** Catatan yang dipakai oleh item yang sedang tampil, untuk daftar di bawah tabel. */
  const usedNotes = useMemo(() => Array.from(new Set<number>(shown.flatMap((it) => notesOf(it, tipe)))).sort((a: number, b: number) => a - b), [shown, tipe]);

  /** Hanya status yang diubah; nomor sertifikat dan catatan lama (bila ada) tetap tersimpan, tidak ditampilkan. */
  const save = async (it: MatItem, status: MatStatus) => {
    if (!supabase) return;
    const key = itemKey(it);
    const prev = rows.get(key);
    const next: MatStatusRow = { item_key: key, status, cert_no: prev?.cert_no ?? null, note: prev?.note ?? null };
    setBusyKey(key);
    setErr('');
    // baris sudah ada: cek version; belum ada: insert; kolom version belum ada: cara lama
    const ver = !versioned.current ? undefined : prev ? prev.version : null;
    const r = await saveKeyedRow(supabase as unknown as KeyedClient, 'nb_material_status', projectId, key, ver, {
      status: next.status,
      cert_no: next.cert_no,
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

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="print:hidden">
        <Button size="sm" onClick={onBack}>← Daftar proyek</Button>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Acuan sertifikat material dan komponen</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">{tipe ? `Tipe ${tipe}: ${TIPE_LEGEND[tipe]}` : 'Tipe material belum bisa ditentukan (isi GT di data proyek). Menampilkan seluruh daftar.'}</p>

      {profile && tipe && !showAll && hiddenCount > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Disaring untuk {profile === 'tug' ? 'tugboat' : 'tongkang / kapal tanpa penggerak'}: {hiddenCount} item yang tidak relevan disembunyikan. Salah satunya ada di kapal ini? Pakai &quot;Tampilkan semua&quot;.
        </p>
      )}

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
        <span className="whitespace-nowrap font-bold text-slate-900">{prog.diterima} dari {prog.total} ada</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-600" style={{ width: `${prog.pct}%` }} />
        </div>
        <span>{prog.pct}%</span>
        {prog.tidakAda > 0 && <span className="whitespace-nowrap">N/A: {prog.tidakAda}</span>}
      </div>

      <div className="mt-3 space-y-2 print:hidden">
        <input className={INPUT} placeholder="Cari item (mis. anchor, plate, 32)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Chip selected={filter === 'semua'} onClick={() => setFilter('semua')}>Semua</Chip>
          {STATUSES.filter((s) => s !== 'tidak_ada').map((s) => (
            <Chip key={s} selected={filter === s} onClick={() => setFilter(s)}>{STATUS_LABEL[s]}</Chip>
          ))}
          <Chip selected={filter === 'tidak_ada'} onClick={() => setFilter('tidak_ada')}>N/A</Chip>
          {tipe && <Chip tone="dark" selected={showAll} onClick={() => setShowAll((v) => !v)}>Tampilkan semua 84 produk</Chip>}
          <Button size="sm" onClick={() => window.print()}>Cetak / PDF</Button>
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
        <summary className="cursor-pointer font-semibold">
          Arti kolom dan kode: <span className="font-normal">V = BKI · X = IACS dapat diterima · M = sertifikat manufaktur · – = tidak disyaratkan</span>
        </summary>
        <ul className="mt-2 space-y-0.5">
          {Object.entries(COL_LEGEND).map(([k, v]) => (
            <li key={k}><b>{k}</b>: {v}</li>
          ))}
          {Object.entries(CELL_LEGEND).map(([k, v]) => (
            <li key={k}><b>{k}</b>: {v}</li>
          ))}
        </ul>
      </details>

      <div className="mt-3">
        {!loaded ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Tidak ada item yang cocok.</p>
        ) : (
          <table className="w-full table-fixed border-collapse rounded-xl border border-slate-200 bg-white text-left">
            <colgroup>
              <col className="w-8" />
              <col />
              <col className="w-9 sm:w-12" />
              <col className="w-9 sm:w-12" />
              <col className="w-9 sm:w-12" />
              <col className="w-9 sm:w-12" />
              <col className="w-11 sm:w-12 print:hidden" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-800 text-[11px] font-bold uppercase tracking-wide text-white">
              <tr>
                <th className="py-2 pl-2">No</th>
                <th className="px-1 py-2">Produk</th>
                <th className="px-1 py-2 text-center" title={COL_LEGEND.MP}>MP</th>
                <th className="px-1 py-2 text-center" title={COL_LEGEND.TA}>TA</th>
                <th className="px-1 py-2 text-center" title={COL_LEGEND.PC}>PC</th>
                <th className="px-1 py-2 text-center">Ada</th>
                <th className="px-1 py-2 pr-2 text-center print:hidden">N/A</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => {
                const key = itemKey(it);
                return <Row key={key} it={it} tipe={tipe} status={rows.get(key)?.status ?? 'belum'} busy={busyKey === key} onStatus={save} />;
              })}
            </tbody>
          </table>
        )}
      </div>

      {usedNotes.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
          <p className="font-bold text-slate-800">Catatan</p>
          <ul className="mt-1 space-y-0.5">
            {usedNotes.map((n) => (
              <li key={n}><b>{n}</b>. {NOTES[n]}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
