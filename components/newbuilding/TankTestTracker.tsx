'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
import { useDialog } from '../DialogProvider';
import FindingPhotos from './FindingPhotos';
import {
  LEAK_METHODS,
  LEAK_METHOD_LABEL,
  LEAK_STATUSES,
  LEAK_STATUS_LABEL,
  STRUCT_STATUSES,
  STRUCT_STATUS_LABEL,
  leakDetail,
  leakPointCount,
  parseCount,
  parseHead,
  structDetail,
  summarizeTankTests,
} from '../../lib/newbuildingTankTests';
import type { LeakMethod, StructStatus, TankTestRow, TestStatus } from '../../lib/newbuildingTankTests';
import { findingCode, tankFindingDescription, tankFindingText } from '../../lib/newbuildingFindings';
import { removePhotoFiles } from '../../lib/photoUpload';
import { updateWithVersion } from '../../lib/optimisticLock';
import type { LockClient } from '../../lib/optimisticLock';
import { TANK_SIDES, TANK_SIDE_LABEL, catalogGroups, countKind, duplicateTankIds, isOilCarrier, kindOfName, nextTankName, rowsNeedingSide, tankDisplayName } from '../../lib/newbuildingTankCatalog';
import type { TankKind, TankSide } from '../../lib/newbuildingTankCatalog';
import { INPUT, BlurInput } from './fields';
import { todayIso } from '../../lib/todayIso';
import { PAGE_STEP, countTankStates, matchesQuery, tankState } from '../../lib/newbuildingListView';
import type { TankState } from '../../lib/newbuildingListView';

const COLS = 'id,name,side,leak_status,leak_method,leak_date,struct_status,struct_head,struct_date,note,leak_count,struct_leak,struct_deform';
const COLS_V = COLS + ',version';
/** Bentuk hasil bacaan yang dipakai di sini; menyeragamkan tipe hasil select yang kolomnya dipilih saat berjalan. */
type ListRes = { data: unknown[] | null; error: { message: string } | null };

type Patch = Partial<Omit<TankTestRow, 'id'>>;

/** Temuan yang dibuat dari uji tangki (hanya kolom yang dipakai di halaman ini). */
type FindingLink = { id: string; seq: number | null; status: 'open' | 'closed'; source_tank_id: string; source_kind: 'leak' | 'struct' };
const LINK_COLS = 'id,seq,status,source_tank_id,source_kind';
const KINDS: ('leak' | 'struct')[] = ['leak', 'struct'];

const detailFor = (r: TankTestRow, kind: 'leak' | 'struct'): string | null => (kind === 'leak' ? leakDetail(r.leak_count) : structDetail(r.struct_leak, r.struct_deform));
const statusOf = (r: TankTestRow, kind: 'leak' | 'struct'): TestStatus | StructStatus => (kind === 'leak' ? r.leak_status : r.struct_status);

const PILL: Record<string, string> = {
  lulus: 'bg-teal-600 text-white',
  tidak_lulus: 'bg-red-600 text-white',
  belum: 'bg-slate-200 text-slate-700',
  tidak_perlu: 'bg-slate-100 text-slate-500',
};

function StatusPill({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${PILL[value] ?? PILL.belum}`}>
      {label} · {text}
    </span>
  );
}

type TankFilter = 'all' | TankState;

const TONE: Record<string, string> = {
  lulus: 'border-teal-200 bg-teal-50/50',
  tidak_lulus: 'border-red-200 bg-red-50/50',
};

function TankItem({ r, expanded, onToggle, projectId, busy, hint, showSide, dup, leakLink, structLink, onPatch, onDelete, onBadHead, onBadCount, onFinding }: { r: TankTestRow; expanded: boolean; onToggle: () => void; busy: boolean; hint: string | null; projectId: string; showSide: boolean; dup: boolean; leakLink: FindingLink | null; structLink: FindingLink | null; onPatch: (p: Patch) => void; onDelete: () => void; onBadHead: () => void; onBadCount: () => void; onFinding: (kind: 'leak' | 'struct') => void }) {
  const leakDone = r.leak_status !== 'belum';
  const structDone = r.struct_status === 'lulus' || r.struct_status === 'tidak_lulus';
  const tone = r.leak_status === 'tidak_lulus' || r.struct_status === 'tidak_lulus' ? TONE.tidak_lulus : r.leak_status === 'lulus' && (r.struct_status === 'lulus' || r.struct_status === 'tidak_perlu') ? TONE.lulus : 'border-slate-200 bg-white';

  // rincian hasil hanya berlaku selama statusnya Tidak lulus; riwayatnya disimpan di Daftar temuan
  const setLeak = (s: TestStatus) => onPatch({ leak_status: s, leak_date: s === 'belum' ? null : r.leak_date ?? todayIso(), leak_count: s === 'tidak_lulus' ? r.leak_count : null });
  const setStruct = (s: StructStatus) => {
    const done = s === 'lulus' || s === 'tidak_lulus';
    onPatch({
      struct_status: s,
      struct_date: done ? r.struct_date ?? todayIso() : null,
      struct_head: done ? r.struct_head : null,
      struct_leak: s === 'tidak_lulus' ? r.struct_leak : false,
      struct_deform: s === 'tidak_lulus' ? r.struct_deform : false,
    });
  };

  return (
    <li className={`rounded-xl border ${tone}`}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="block w-full p-3 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-bold text-slate-900">{tankDisplayName(r.name, r.side)}</span>
          <span className="shrink-0 text-xs text-slate-400">{expanded ? '▲' : '▼'}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <StatusPill label="Leak" value={r.leak_status} text={LEAK_STATUS_LABEL[r.leak_status]} />
          <StatusPill label="Struct" value={r.struct_status} text={STRUCT_STATUS_LABEL[r.struct_status]} />
          {dup && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Nama kembar</span>}
        </span>
      </button>
      {!expanded && (r.leak_status === 'belum' || r.struct_status === 'belum') && (
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          {r.leak_status === 'belum' && (
            <Button size="sm" disabled={busy} onClick={() => setLeak('lulus')}>
              Leak lulus
            </Button>
          )}
          {r.struct_status === 'belum' && (
            <Button size="sm" disabled={busy} onClick={() => setStruct('lulus')}>
              Struct lulus
            </Button>
          )}
        </div>
      )}
      {expanded && (
        <div className="border-t border-slate-200/70 px-3 pb-3 pt-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <BlurInput value={r.name} placeholder="Nama kompartemen" disabled={busy} onSave={(v) => v !== '' && onPatch({ name: v })} />
            </div>
            <button type="button" className="shrink-0 rounded-md px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" disabled={busy} onClick={onDelete}>
              Hapus
            </button>
          </div>

          {showSide && (
            <div className="mt-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Posisi (bila lebih dari satu tangki sejenis)</span>
              <div className="flex flex-wrap gap-2">
                {TANK_SIDES.map((sd: TankSide) => (
                  <Chip key={sd} selected={r.side === sd} disabled={busy} onClick={() => onPatch({ side: r.side === sd ? null : sd })}>
                    {sd} · {TANK_SIDE_LABEL[sd]}
                  </Chip>
                ))}
              </div>
              {dup && <p className="mt-1 text-[11px] font-semibold text-amber-800">Nama dan posisi sama dengan tangki lain. Pilih P/C/S yang berbeda atau ubah namanya.</p>}
            </div>
          )}

          <p className="mt-3 text-xs font-bold text-slate-700">Leak test</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {LEAK_STATUSES.map((s) => (
              <Chip key={s} selected={r.leak_status === s} disabled={busy} onClick={() => setLeak(s)}>
                {LEAK_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          {r.leak_status === 'tidak_lulus' && (
            <label className="mt-2 block sm:w-1/2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Jumlah titik bocor (opsional)</span>
              <BlurInput
                inputMode="numeric"
                value={r.leak_count == null ? '' : String(r.leak_count)}
                placeholder="mis. 3"
                disabled={busy}
                onSave={(v) => {
                  if (v === '') return onPatch({ leak_count: null });
                  const n = parseCount(v);
                  if (n == null) return onBadCount();
                  onPatch({ leak_count: n });
                }}
              />
            </label>
          )}
          {r.leak_status === 'tidak_lulus' && (
            leakLink ? (
              <>
                <p className="mt-2 text-xs font-semibold text-amber-800">Temuan {findingCode(leakLink.seq)} · Open (masuk Daftar temuan)</p>
                <FindingPhotos projectId={projectId} findingId={leakLink.id} defaultPhase="temuan" disabled={busy} />
              </>
            ) : (
              <Button size="sm" variant="warn" className="mt-2" disabled={busy} onClick={() => onFinding('leak')}>
                Buat temuan
              </Button>
            )
          )}
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
          {hint && <p className="mt-1 text-[11px] text-amber-800">{hint}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            {STRUCT_STATUSES.map((s) => (
              <Chip key={s} selected={r.struct_status === s} disabled={busy} onClick={() => setStruct(s)}>
                {STRUCT_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
          {r.struct_status === 'tidak_lulus' && (
            <div className="mt-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Yang ditemukan</span>
              <div className="flex flex-wrap gap-2">
                <Chip selected={r.struct_leak} disabled={busy} onClick={() => onPatch({ struct_leak: !r.struct_leak })}>
                  Bocor
                </Chip>
                <Chip selected={r.struct_deform} disabled={busy} onClick={() => onPatch({ struct_deform: !r.struct_deform })}>
                  Deformasi
                </Chip>
              </div>
            </div>
          )}
          {r.struct_status === 'tidak_lulus' && (
            structLink ? (
              <>
                <p className="mt-2 text-xs font-semibold text-amber-800">Temuan {findingCode(structLink.seq)} · Open (masuk Daftar temuan)</p>
                <FindingPhotos projectId={projectId} findingId={structLink.id} defaultPhase="temuan" disabled={busy} />
              </>
            ) : (
              <Button size="sm" variant="warn" className="mt-2" disabled={busy} onClick={() => onFinding('struct')}>
                Buat temuan
              </Button>
            )
          )}
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
        </div>
      )}
    </li>
  );
}

export default function TankTestTracker({ projectId, projectName, vesselType, propelled, onBack }: { projectId: string; projectName: string; vesselType: string | null; propelled: boolean; onBack: () => void }) {
  const { confirm } = useDialog();
  const [links, setLinks] = useState<FindingLink[]>([]);
  const [rows, setRows] = useState<TankTestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null); // satu kompartemen terbuka pada satu waktu
  const [q, setQ] = useState('');
  const [tf, setTf] = useState<TankFilter>('all');
  const [limit, setLimit] = useState(PAGE_STEP);
  // nama yang sedang disimpan: supaya ketukan beruntun tidak menghasilkan nomor kembar
  const pending = useRef<string[]>([]);
  const rowsRef = useRef<TankTestRow[]>([]);
  // kolom version ikut dibaca; bila SQL-nya belum dijalankan, beralih ke kolom tanpa version
  const colsRef = useRef<string>(COLS_V);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    let res: ListRes = await supabase.from('nb_tank_tests').select(colsRef.current).eq('project_id', projectId).order('created_at', { ascending: true });
    if (res.error && /version/i.test(res.error.message)) {
      colsRef.current = COLS;
      res = await supabase.from('nb_tank_tests').select(COLS).eq('project_id', projectId).order('created_at', { ascending: true });
    }
    const { data, error } = res;
    if (error) setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_tank_tests dan nb_tank_tests_hasil?)' : ''));
    else {
      const list = (data ?? []) as unknown as TankTestRow[];
      setRows(list);
      setCatOpen(list.length === 0);
    }
    const fl = await supabase.from('nb_findings').select(LINK_COLS).eq('project_id', projectId).not('source_tank_id', 'is', null).order('created_at', { ascending: true });
    if (fl.error) setErr(fl.error.message + ' (sudah menjalankan SQL langkah 1: kolom source_tank_id di nb_findings?)');
    else setLinks((fl.data ?? []) as FindingLink[]);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  rowsRef.current = rows;
  const sum = useMemo(() => summarizeTankTests(rows), [rows]);
  const pts = useMemo(() => leakPointCount(rows), [rows]);
  const groups = useMemo(() => catalogGroups({ propelled, oil: isOilCarrier(vesselType) }, showAll), [propelled, vesselType, showAll]);
  const names = useMemo(() => rows.map((r) => r.name), [rows]);
  const sideIds = useMemo(() => rowsNeedingSide(rows), [rows]);
  const dupIds = useMemo(() => duplicateTankIds(rows), [rows]);
  const stateCounts = useMemo(() => countTankStates(rows), [rows]);
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tf === 'all' || tankState(r) === tf) &&
          matchesQuery(q, [tankDisplayName(r.name, r.side), r.name, r.note, LEAK_STATUS_LABEL[r.leak_status], STRUCT_STATUS_LABEL[r.struct_status]])
      ),
    [rows, tf, q]
  );
  const visible = shown.slice(0, limit);

  // ganti filter atau pencarian: mulai lagi dari halaman pertama
  useEffect(() => {
    setLimit(PAGE_STEP);
  }, [tf, q]);

  /** Tambah satu tangki dari katalog. Nomor diambil dari daftar yang ada ditambah yang sedang disimpan. */
  const addKind = async (k: TankKind) => {
    if (!supabase) return;
    const name = nextTankName(k, [...rowsRef.current.map((r) => r.name), ...pending.current]);
    pending.current.push(name);
    setErr('');
    setInfo('');
    const r = await supabase.from('nb_tank_tests').insert({ project_id: projectId, name }).select(colsRef.current).single();
    pending.current = pending.current.filter((n) => n !== name);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    const row = r.data as unknown as TankTestRow;
    rowsRef.current = [...rowsRef.current, row];
    setRows(rowsRef.current);
    setTf('all');
    setQ('');
    setLimit((l) => l + 1);
  };

  const add = async () => {
    const n = name.trim();
    if (!supabase || n === '' || adding) return;
    setAdding(true);
    setErr('');
    const r = await supabase.from('nb_tank_tests').insert({ project_id: projectId, name: n }).select(colsRef.current).single();
    setAdding(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => [...l, r.data as unknown as TankTestRow]);
    setName('');
    setTf('all');
    setQ('');
    setLimit((l) => l + 1);
  };

  const patch = async (id: string, p: Patch): Promise<boolean> => {
    if (!supabase) return false;
    const cur = rowsRef.current.find((x) => x.id === id);
    setBusyId(id);
    setErr('');
    const values = { ...p, updated_at: new Date().toISOString() };
    // simpan hanya bila uji tangki ini belum diubah orang lain sejak dibuka (cek version)
    if (cur && typeof cur.version === 'number') {
      const lk = await updateWithVersion(supabase as unknown as LockClient, 'nb_tank_tests', id, cur.version, values);
      setBusyId('');
      if (lk.status !== 'ok') {
        if (lk.status === 'conflict') {
          load();
          setErr('Uji tangki ini baru saja diubah orang lain, jadi perubahan Anda tidak disimpan agar tidak menimpa. Data sudah dimuat ulang; ulangi perubahan Anda.');
        } else setErr(lk.message);
        return false;
      }
      setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p, version: lk.version } : x)));
      return true;
    }
    const r = await supabase.from('nb_tank_tests').update(values).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return false;
    }
    setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
    return true;
  };

  const openLink = (tankId: string, kind: 'leak' | 'struct'): FindingLink | null => links.find((l) => l.source_tank_id === tankId && l.source_kind === kind && l.status === 'open') ?? null;

  /** Membuat temuan Open dari uji yang tidak lulus, tertaut ke tangkinya. Tidak membuat dobel bila temuan Open untuk tangki dan jenis uji ini sudah ada. */
  const ensureFinding = async (row: TankTestRow, kind: 'leak' | 'struct') => {
    if (!supabase) return;
    setErr('');
    setInfo('');
    const ex = await supabase.from('nb_findings').select(LINK_COLS).eq('project_id', projectId).eq('source_tank_id', row.id).eq('source_kind', kind).eq('status', 'open').limit(1);
    if (ex.error) {
      setErr(ex.error.message + (/relation|does not exist|column/i.test(ex.error.message) ? ' (sudah menjalankan SQL nb_findings dan SQL langkah 1?)' : ''));
      return;
    }
    if ((ex.data ?? []).length > 0) {
      const have = ex.data![0] as FindingLink;
      setLinks((l) => (l.some((x) => x.id === have.id) ? l : [...l, have]));
      return;
    }
    const name = tankDisplayName(row.name, row.side);
    const f = tankFindingText(name, kind, detailFor(row, kind));
    // nomor PL dibuat database; bila dua simpan bertabrakan, coba sekali lagi
    let res = await supabase.from('nb_findings').insert({ project_id: projectId, ...f, status: 'open', found_date: todayIso(), source_tank_id: row.id, source_kind: kind }).select(LINK_COLS).single();
    if (res.error && /duplicate|unique/i.test(res.error.message)) {
      res = await supabase.from('nb_findings').insert({ project_id: projectId, ...f, status: 'open', found_date: todayIso(), source_tank_id: row.id, source_kind: kind }).select(LINK_COLS).single();
    }
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    const link = res.data as FindingLink;
    setLinks((l) => [...l, link]);
    setInfo(`Temuan ${findingCode(link.seq)} dibuat otomatis untuk ${name}. Lihat di Daftar temuan (halaman Tahapan).`);
  };

  /** Uji masih tidak lulus tetapi rinciannya, nama, atau posisinya berubah: samakan temuan Open yang tertaut. Uraian atau lokasi yang sudah diubah manual tidak ditimpa. */
  const refreshFinding = async (prev: TankTestRow, next: TankTestRow, kind: 'leak' | 'struct') => {
    if (!supabase) return;
    const ex = await supabase.from('nb_findings').select('id,description,location').eq('project_id', projectId).eq('source_tank_id', next.id).eq('source_kind', kind).eq('status', 'open').limit(1);
    if (ex.error || (ex.data ?? []).length === 0) return;
    const cur = ex.data![0] as { id: string; description: string; location: string | null };
    const upd: { description?: string; location?: string; updated_at: string } = { updated_at: new Date().toISOString() };
    if (cur.description === tankFindingDescription(kind, detailFor(prev, kind))) upd.description = tankFindingDescription(kind, detailFor(next, kind));
    if (cur.location === tankDisplayName(prev.name, prev.side)) upd.location = tankDisplayName(next.name, next.side);
    if (upd.description === undefined && upd.location === undefined) return;
    const r = await supabase.from('nb_findings').update(upd).eq('id', cur.id);
    if (r.error) setErr(r.error.message);
  };

  /** Uji tidak lagi tidak lulus: tawarkan menutup temuan Open yang tertaut (Lulus atau Tidak perlu) atau menghapusnya (dikembalikan ke Belum, mis. salah ketuk). */
  const resolveFinding = async (next: TankTestRow, kind: 'leak' | 'struct') => {
    if (!supabase) return;
    const lk = openLink(next.id, kind);
    if (!lk) return;
    const code = findingCode(lk.seq);
    const name = tankDisplayName(next.name, next.side);
    const toBelum = statusOf(next, kind) === 'belum';
    // bila temuan akan dihapus, catat dulu foto-fotonya: baris foto ikut terhapus, berkasnya dihapus sesudahnya
    const pp = toBelum ? await supabase.from('nb_finding_photos').select('path').eq('finding_id', lk.id) : null;
    const paths = pp && !pp.error ? ((pp.data ?? []) as { path: string }[]).map((x) => x.path) : [];
    const ok = await confirm(
      toBelum
        ? { title: `Hapus temuan ${code}?`, message: `Status ${name} dikembalikan ke Belum. Hapus temuan ${code} yang dibuat otomatis (mis. bila tadi salah ketuk)${paths.length > 0 ? `, beserta ${paths.length} fotonya` : ''}?`, confirmText: 'Hapus temuan', cancelText: 'Biarkan Open', tone: 'danger' }
        : { title: `Tutup temuan ${code}?`, message: `${name} sudah tidak berstatus Tidak lulus. Tutup temuan ${code} (Closed)?`, confirmText: 'Tutup temuan', cancelText: 'Biarkan Open' }
    );
    if (!ok) return;
    setErr('');
    const r = toBelum ? await supabase.from('nb_findings').delete().eq('id', lk.id) : await supabase.from('nb_findings').update({ status: 'closed', closed_date: todayIso(), updated_at: new Date().toISOString() }).eq('id', lk.id);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    if (toBelum) await removePhotoFiles(paths);
    setLinks((l) => (toBelum ? l.filter((x) => x.id !== lk.id) : l.map((x) => (x.id === lk.id ? { ...x, status: 'closed' as const } : x))));
    setInfo(toBelum ? `Temuan ${code} dihapus.` : `Temuan ${code} ditutup.`);
  };

  /** Simpan perubahan baris uji, lalu sinkronkan temuan: dibuat saat jadi Tidak lulus, diperbarui saat rinciannya berubah, ditawarkan ditutup saat tidak lagi Tidak lulus. */
  const patchTank = async (row: TankTestRow, p: Patch) => {
    const ok = await patch(row.id, p);
    if (!ok) return;
    const next: TankTestRow = { ...row, ...p };
    for (const kind of KINDS) {
      const was = statusOf(row, kind) === 'tidak_lulus';
      const now = statusOf(next, kind) === 'tidak_lulus';
      if (!was && now) await ensureFinding(next, kind);
      else if (was && now) {
        if (detailFor(row, kind) !== detailFor(next, kind) || row.name !== next.name || row.side !== next.side) await refreshFinding(row, next, kind);
      } else if (was && !now) await resolveFinding(next, kind);
    }
  };

  const remove = async (row: TankTestRow) => {
    if (!supabase) return;
    if (!(await confirm({ title: 'Hapus dari daftar uji?', message: `Hapus "${tankDisplayName(row.name, row.side)}" dari daftar uji?`, confirmText: 'Hapus', tone: 'danger' }))) return;
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
      {info && <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{info}</p>}

      {loaded && sum.total > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p>
            <b>{sum.leakPass}</b> dari {sum.total} lulus leak test · <b>{sum.structPass}</b> dari {sum.structNeeded} lulus uji struktural
          </p>
          {sum.failed > 0 && <p className="mt-1 font-semibold text-red-700">{sum.failed} kompartemen punya uji yang tidak lulus.</p>}
          {pts > 0 && <p className="mt-1 text-red-700">{pts} titik bocor tercatat pada leak test yang tidak lulus.</p>}
        </div>
      )}

      {loaded && (
        <details open={catOpen} className="mt-4 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-teal-700">Tambah dari katalog tangki (ketuk sekali per tangki)</summary>
          <div className="border-t border-slate-100 px-3 pb-3">
            {groups.map((g) => (
              <div key={g.title} className="mt-3">
                <p className="text-xs font-bold text-slate-700">{g.title}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {g.kinds.map((k) => {
                    const n = countKind(names, k);
                    return (
                      <Chip key={k.key} selected={n > 0} onClick={() => addKind(k)}>
                        {k.label}
                        {n > 0 ? ` ×${n}` : ''}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-3">
              <Chip tone="dark" selected={showAll} onClick={() => setShowAll((v) => !v)}>
                Tampilkan semua jenis
              </Chip>
            </div>
            <p className="mt-2 text-xs text-slate-500">Nama diberi nomor otomatis (mis. Freshwater tank 1, 2). Jenis yang biasanya satu (mis. Fore peak) tidak diberi nomor; bila ditambah lagi, bedakan dengan P/C/S di barisnya.</p>
          </div>
        </details>
      )}

      <div className="mt-4 flex gap-2">
        <input
          className={INPUT}
          placeholder="Atau ketik nama sendiri, mis. Fore peak"
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
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer font-semibold text-slate-600">Aturan uji struktural (S14 Part C 2.4)</summary>
        <p className="mt-1">
          Uji struktural wajib untuk satu tangki dari tiap grup yang mirip, tangki lain cukup leak test (S14 Part C 2.4). Tandai tangki yang cukup leak test dengan &quot;Tidak perlu&quot;. Pengecualian dan rezim yang berlaku ada di Kriteria penerimaan pada item Structural test. Bila uji tidak lulus, temuan otomatis dibuat di Daftar temuan; catat rinciannya di sini. Setelah diperbaiki dan diuji ulang, ubah status ke Lulus lalu pilih menutup temuannya (rincian di baris ini ikut dikosongkan, riwayatnya tetap ada di Daftar temuan). Bila diuji ulang dan tidak lulus lagi, dibuat temuan baru.
        </p>
      </details>

      {loaded && rows.length > 0 && (
        <>
          <div className="sticky top-0 z-10 -mx-3 mt-4 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
            <div className="flex gap-2 overflow-x-auto">
              <Chip className="shrink-0 whitespace-nowrap" selected={tf === 'all'} onClick={() => setTf('all')}>
                Semua · {rows.length}
              </Chip>
              <Chip className="shrink-0 whitespace-nowrap" selected={tf === 'belum'} onClick={() => setTf('belum')}>
                Belum selesai · {stateCounts.belum}
              </Chip>
              <Chip className="shrink-0 whitespace-nowrap" selected={tf === 'gagal'} onClick={() => setTf('gagal')}>
                Tidak lulus · {stateCounts.gagal}
              </Chip>
              <Chip className="shrink-0 whitespace-nowrap" selected={tf === 'lulus'} onClick={() => setTf('lulus')}>
                Lulus · {stateCounts.lulus}
              </Chip>
            </div>
          </div>
          {rows.length > 5 && <input className={INPUT + ' mt-3'} placeholder="Cari nama kompartemen, catatan, status…" value={q} onChange={(e) => setQ(e.target.value)} />}
        </>
      )}

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada kompartemen. Tambahkan satu per satu di atas.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Tidak ada kompartemen yang cocok dengan filter ini.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Menampilkan {visible.length} dari {shown.length} kompartemen. Ketuk satu kompartemen untuk membuka detailnya.
          </p>
          <ul className="mt-2 space-y-2">
            {visible.map((r) => (
            <TankItem key={r.id} expanded={openId === r.id} onToggle={() => setOpenId((id) => (id === r.id ? null : r.id))} r={r} busy={busyId === r.id} hint={kindOfName(r.name)?.hint ?? null} showSide={sideIds.has(r.id)} dup={dupIds.has(r.id)} projectId={projectId} leakLink={openLink(r.id, 'leak')} structLink={openLink(r.id, 'struct')} onPatch={(p) => patchTank(r, p)} onDelete={() => remove(r)} onBadHead={() => setErr('Tinggi uji harus berupa angka dalam meter, mis. 2,4.')} onBadCount={() => setErr('Jumlah titik bocor harus bilangan bulat 0 sampai 999.')} onFinding={(k) => ensureFinding(r, k)} />
            ))}
          </ul>
          {shown.length > visible.length && (
            <Button className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE_STEP)}>
              Tampilkan {Math.min(PAGE_STEP, shown.length - visible.length)} lagi (sisa {shown.length - visible.length})
            </Button>
          )}
        </>
      )}
    </main>
  );
}
