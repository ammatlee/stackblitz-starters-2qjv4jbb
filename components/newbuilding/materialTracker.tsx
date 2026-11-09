'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import { CELL_LEGEND, COL_LEGEND, NOTES, TIPE_LEGEND, cellsFor, parseCell } from '../../lib/materialRules';
import type { MatItem, MatTipe } from '../../lib/materialRules';
import { STATUSES, STATUS_LABEL, itemKey, progressOf, trackerItems } from '../../lib/materialTracker';
import type { MatStatus, MatStatusRow } from '../../lib/materialTracker';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

type Props = {
  projectId: string;
  projectName: string;
  tipe: MatTipe | null;
  onBack: () => void;
};

type Filter = 'semua' | MatStatus;

/** Ringkasan syarat item untuk tipe kapal: "MP V · PC V1,3" atau teks tipe D. */
function requirement(it: MatItem, tipe: MatTipe | null): { text: string; notes: number[] } {
  if (!tipe) return { text: 'Tentukan tipe material dulu (isi GT di data proyek).', notes: [] };
  const c = cellsFor(it, tipe);
  if (typeof c === 'string') return { text: c === '-' ? 'Tidak disyaratkan untuk tipe ini' : c, notes: [] };
  const labels = ['MP', 'TA', 'PC'] as const;
  const parts: string[] = [];
  const notes: number[] = [];
  c.forEach((cell, i) => {
    const p = parseCell(cell);
    if (!p) return;
    parts.push(`${labels[i]} ${cell}`);
    notes.push(...p.notes);
  });
  return { text: parts.length ? parts.join(' · ') : 'Tidak disyaratkan untuk tipe ini', notes: Array.from(new Set(notes)) };
}

function Row({
  it,
  tipe,
  row,
  busy,
  onStatus,
  onText,
}: {
  it: MatItem;
  tipe: MatTipe | null;
  row: MatStatusRow | undefined;
  busy: boolean;
  onStatus: (it: MatItem, s: MatStatus) => void;
  onText: (it: MatItem, field: 'cert_no' | 'note', v: string) => void;
}) {
  const req = requirement(it, tipe);
  const status = row?.status ?? 'belum';
  const [cert, setCert] = useState(row?.cert_no ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  useEffect(() => {
    setCert(row?.cert_no ?? '');
    setNote(row?.note ?? '');
  }, [row?.cert_no, row?.note]);

  const tone = status === 'diterima' ? 'border-teal-300 bg-teal-50/40' : status === 'tidak_ada' ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tone}`}>
      <p className="text-sm font-bold text-slate-900">
        {it.no}. {it.product}
        {it.kind ? <span className="font-normal text-slate-600"> — {it.kind}</span> : null}
      </p>
      <p className="mt-0.5 text-xs text-slate-700">Syarat: {req.text}</p>
      {req.notes.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
          {req.notes.map((n) => (
            <li key={n}>
              Cat. {n}: {NOTES[n]}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Chip key={s} selected={status === s} disabled={busy} onClick={() => onStatus(it, s)}>
            {STATUS_LABEL[s]}
          </Chip>
        ))}
      </div>
      {status !== 'tidak_ada' && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className={INPUT} placeholder="Nomor sertifikat" value={cert} onChange={(e) => setCert(e.target.value)} onBlur={() => cert !== (row?.cert_no ?? '') && onText(it, 'cert_no', cert)} />
          <input className={INPUT} placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (row?.note ?? '') && onText(it, 'note', note)} />
        </div>
      )}
    </div>
  );
}

export default function MaterialTracker({ projectId, projectName, tipe, onBack }: Props) {
  const [rows, setRows] = useState<Map<string, MatStatusRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [showAll, setShowAll] = useState(false);
  const [legend, setLegend] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_material_status').select('item_key,status,cert_no,note').eq('project_id', projectId);
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

  const items = useMemo(() => trackerItems(tipe, showAll), [tipe, showAll]);
  const prog = useMemo(() => progressOf(items, rows), [items, rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'semua' && (rows.get(itemKey(it))?.status ?? 'belum') !== filter) return false;
      return !term || `${it.no} ${it.product} ${it.kind ?? ''}`.toLowerCase().includes(term);
    });
  }, [items, rows, q, filter]);

  const save = async (it: MatItem, patch: Partial<Pick<MatStatusRow, 'status' | 'cert_no' | 'note'>>) => {
    if (!supabase) return;
    const key = itemKey(it);
    const prev = rows.get(key);
    const next: MatStatusRow = {
      item_key: key,
      status: patch.status ?? prev?.status ?? 'belum',
      cert_no: (patch.cert_no !== undefined ? patch.cert_no : prev?.cert_no) || null,
      note: (patch.note !== undefined ? patch.note : prev?.note) || null,
    };
    setBusyKey(key);
    setErr('');
    const r = await supabase
      .from('nb_material_status')
      .upsert({ project_id: projectId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'project_id,item_key' });
    setBusyKey('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((m) => new Map(m).set(key, next));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Button size="sm" onClick={onBack}>← Daftar proyek</Button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Pelacak material dan komponen</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">{tipe ? `Tipe ${tipe}: ${TIPE_LEGEND[tipe]}` : 'Tipe material belum bisa ditentukan (isi GT di data proyek). Menampilkan seluruh daftar.'}</p>

      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold text-slate-900">{prog.diterima} dari {prog.total} diterima</span>
          <span className="text-slate-600">{prog.pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-600" style={{ width: `${prog.pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-600">Belum diterima: {prog.belum}{prog.tidakAda > 0 ? ` · Tidak ada di kapal ini: ${prog.tidakAda}` : ''}</p>
      </div>

      <div className="mt-4 space-y-2">
        <input className={INPUT} placeholder="Cari item (mis. anchor, plate, 32)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Chip selected={filter === 'semua'} onClick={() => setFilter('semua')}>Semua</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} selected={filter === s} onClick={() => setFilter(s)}>{STATUS_LABEL[s]}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tipe && <Chip tone="dark" selected={showAll} onClick={() => setShowAll((v) => !v)}>Tampilkan semua 84 produk</Chip>}
          <Chip tone="dark" selected={legend} onClick={() => setLegend((v) => !v)}>Arti kode</Chip>
        </div>
      </div>

      {legend && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <p className="font-bold">Kolom</p>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(COL_LEGEND).map(([k, v]) => (
              <li key={k}><b>{k}</b>: {v}</li>
            ))}
          </ul>
          <p className="mt-2 font-bold">Kode</p>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(CELL_LEGEND).map(([k, v]) => (
              <li key={k}><b>{k}</b>: {v}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {!loaded ? (
          <p className="text-sm text-slate-500">Memuat…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Tidak ada item yang cocok.</p>
        ) : (
          shown.map((it) => {
            const key = itemKey(it);
            return (
              <Row key={key} it={it} tipe={tipe} row={rows.get(key)} busy={busyKey === key} onStatus={(i, s) => save(i, { status: s })} onText={(i, f, v) => save(i, { [f]: v })} />
            );
          })
        )}
      </div>
    </main>
  );
}
