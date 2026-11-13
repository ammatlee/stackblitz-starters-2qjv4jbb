'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { useDialog } from '../DialogProvider';
import FindingPhotos from './FindingPhotos';
import PunchlistRecap from './PunchlistRecap';
import { FINDING_ITEMS, FINDING_STATUSES, FINDING_STATUS_LABEL, findingCode, findingItemLabel, sortFindings, summarizeFindings } from '../../lib/newbuildingFindings';
import type { FindingRow, FindingStatus } from '../../lib/newbuildingFindings';
import type { PhotoPhase } from '../../lib/newbuildingPhotos';
import { removePhotoFiles } from '../../lib/photoUpload';
import { updateWithVersion } from '../../lib/optimisticLock';
import type { LockClient } from '../../lib/optimisticLock';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const COLS = 'id,item_key,description,location,status,found_date,closed_date,note,seq,source_tank_id,source_kind';
const COLS_V = COLS + ',version';

type Patch = Partial<Omit<FindingRow, 'id'>>;
type StatusFilter = FindingStatus | 'all';
type PhotoMap = Record<string, { phase: PhotoPhase }[]>;
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

function FindingItem({ r, projectId, photos, busy, onPatch, onPhotos, onDelete }: { r: FindingRow; projectId: string; photos: { phase: PhotoPhase }[]; busy: boolean; onPatch: (p: Patch) => void; onPhotos: (rows: { phase: PhotoPhase }[]) => void; onDelete: () => void }) {
  const open = r.status === 'open';
  const toggle = () => onPatch({ status: open ? 'closed' : 'open', closed_date: open ? todayIso() : null });
  return (
    <li className={`rounded-xl border p-3 ${open ? 'border-amber-300 bg-amber-50/50' : 'border-teal-200 bg-teal-50/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {findingCode(r.seq) !== '' && <b className="mr-1 text-slate-900">{findingCode(r.seq)}</b>}
          {findingItemLabel(r.item_key)}
          {r.source_tank_id !== null && <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] normal-case text-slate-700">dari uji tangki</span>}
        </span>
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
      <FindingPhotos projectId={projectId} findingId={r.id} defaultPhase={open ? 'temuan' : 'perbaikan'} disabled={busy} known={photos} onChange={onPhotos} />
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
  const [photoMap, setPhotoMap] = useState<PhotoMap>({});
  // kolom version ikut dibaca; bila SQL-nya belum dijalankan, beralih ke kolom tanpa version
  const colsRef = useRef<string>(COLS_V);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    let res = await supabase.from('nb_findings').select(colsRef.current).eq('project_id', projectId).order('created_at', { ascending: true });
    if (res.error && /version/i.test(res.error.message)) {
      colsRef.current = COLS;
      res = await supabase.from('nb_findings').select(COLS).eq('project_id', projectId).order('created_at', { ascending: true });
    }
    const { data, error } = res;
    if (error) setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_findings?)' : ''));
    else setRows((data ?? []) as unknown as FindingRow[]);
    // jumlah foto per temuan (hanya fase), untuk judul bagian foto
    const ph = await supabase.from('nb_finding_photos').select('finding_id,phase').eq('project_id', projectId);
    if (ph.error) {
      const msg = ph.error.message + (/relation|does not exist/i.test(ph.error.message) ? ' (sudah menjalankan SQL foto temuan?)' : '');
      setErr((e) => e || msg);
    } else {
      const m: PhotoMap = {};
      for (const x of (ph.data ?? []) as { finding_id: string; phase: PhotoPhase }[]) (m[x.finding_id] ??= []).push({ phase: x.phase });
      setPhotoMap(m);
    }
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
      .select(colsRef.current)
      .single();
    setAdding(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => [...l, r.data as unknown as FindingRow]);
    setDesc('');
    setLoc('');
    // temuan baru berstatus Open: pastikan terlihat
    if (statusFilter === 'closed') setStatusFilter('open');
  };

  const patch = async (id: string, p: Patch) => {
    if (!supabase) return;
    const cur = rows.find((x) => x.id === id);
    setBusyId(id);
    setErr('');
    const values = { ...p, updated_at: new Date().toISOString() };
    // simpan hanya bila temuan belum diubah orang lain sejak dibuka (cek version)
    if (cur && typeof cur.version === 'number') {
      const lk = await updateWithVersion(supabase as unknown as LockClient, 'nb_findings', id, cur.version, values);
      setBusyId('');
      if (lk.status !== 'ok') {
        if (lk.status === 'conflict') {
          load();
          setErr('Temuan ini baru saja diubah orang lain, jadi perubahan Anda tidak disimpan agar tidak menimpa. Data sudah dimuat ulang; ulangi perubahan Anda.');
        } else setErr(lk.message);
        return;
      }
      setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p, version: lk.version } : x)));
      return;
    }
    const r = await supabase.from('nb_findings').update(values).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };

  const remove = async (row: FindingRow) => {
    if (!supabase) return;
    const nPhoto = photoMap[row.id]?.length ?? 0;
    if (!(await confirm({ title: 'Hapus temuan?', message: `Hapus temuan "${row.description}"${nPhoto > 0 ? ` beserta ${nPhoto} fotonya` : ''}? Bila sudah selesai, lebih baik ditutup (Closed) saja.`, confirmText: 'Hapus', tone: 'danger' }))) return;
    setBusyId(row.id);
    setErr('');
    // jalur foto dicatat dulu: baris fotonya ikut terhapus bersama temuan, berkasnya dihapus sesudahnya
    const pp = nPhoto > 0 ? await supabase.from('nb_finding_photos').select('path').eq('finding_id', row.id) : null;
    const r = await supabase.from('nb_findings').delete().eq('id', row.id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    if (pp && !pp.error) await removePhotoFiles(((pp.data ?? []) as { path: string }[]).map((x) => x.path));
    setRows((l) => l.filter((x) => x.id !== row.id));
    setPhotoMap((m) => {
      const rest = { ...m };
      delete rest[row.id];
      return rest;
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      <Button size="sm" onClick={onBack}>← Tahapan</Button>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-teal-700">Daftar temuan (punchlist)</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">{projectName}</h1>
      <p className="mt-1 text-sm text-slate-600">Catatan temuan dan pengingat, lengkap dengan foto dokumentasi. Tidak mengubah status item di Tahapan.</p>

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

      {loaded && sum.total > 0 && <PunchlistRecap projectId={projectId} projectName={projectName} rows={rows} />}

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
            <FindingItem key={r.id} r={r} projectId={projectId} photos={photoMap[r.id] ?? []} busy={busyId === r.id} onPatch={(p) => patch(r.id, p)} onPhotos={(list) => setPhotoMap((m) => ({ ...m, [r.id]: list }))} onDelete={() => remove(r)} />
          ))}
        </ul>
      )}
    </main>
  );
}
