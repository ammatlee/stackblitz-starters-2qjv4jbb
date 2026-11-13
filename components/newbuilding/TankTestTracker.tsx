'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import DateInput from '../DateInput';
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
import { tankFindingText } from '../../lib/newbuildingFindings';
import { TANK_SIDES, TANK_SIDE_LABEL, catalogGroups, countKind, duplicateTankIds, isOilCarrier, kindOfName, nextTankName, rowsNeedingSide, tankDisplayName } from '../../lib/newbuildingTankCatalog';
import type { TankKind, TankSide } from '../../lib/newbuildingTankCatalog';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const COLS = 'id,name,side,leak_status,leak_method,leak_date,struct_status,struct_head,struct_date,note,leak_count,struct_leak,struct_deform';

type Patch = Partial<Omit<TankTestRow, 'id'>>;

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Kolom teks: disimpan saat kolom ditinggalkan, bukan di setiap ketukan. */
function BlurInput({ value, placeholder, disabled, onSave, inputMode }: { value: string; placeholder: string; disabled: boolean; onSave: (v: string) => void; inputMode?: 'decimal' | 'numeric' }) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder={placeholder}
      inputMode={inputMode}
      value={t}
      disabled={disabled}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}

const TONE: Record<string, string> = {
  lulus: 'border-teal-200 bg-teal-50/50',
  tidak_lulus: 'border-red-200 bg-red-50/50',
};

function TankItem({ r, busy, hint, showSide, dup, onPatch, onDelete, onBadHead, onBadCount, onFinding }: { r: TankTestRow; busy: boolean; hint: string | null; showSide: boolean; dup: boolean; onPatch: (p: Patch) => void; onDelete: () => void; onBadHead: () => void; onBadCount: () => void; onFinding: (kind: 'leak' | 'struct') => void }) {
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
    <li className={`rounded-xl border p-3 ${tone}`}>
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
        <Button size="sm" variant="warn" className="mt-2" disabled={busy} onClick={() => onFinding('leak')}>
          Jadikan temuan
        </Button>
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
        <Button size="sm" variant="warn" className="mt-2" disabled={busy} onClick={() => onFinding('struct')}>
          Jadikan temuan
        </Button>
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
    </li>
  );
}

export default function TankTestTracker({ projectId, projectName, vesselType, propelled, onBack }: { projectId: string; projectName: string; vesselType: string | null; propelled: boolean; onBack: () => void }) {
  const [rows, setRows] = useState<TankTestRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [info, setInfo] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  // nama yang sedang disimpan: supaya ketukan beruntun tidak menghasilkan nomor kembar
  const pending = useRef<string[]>([]);
  const rowsRef = useRef<TankTestRow[]>([]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_tank_tests').select(COLS).eq('project_id', projectId).order('created_at', { ascending: true });
    if (error) setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_tank_tests dan nb_tank_tests_hasil?)' : ''));
    else {
      const list = (data ?? []) as TankTestRow[];
      setRows(list);
      setCatOpen(list.length === 0);
    }
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

  /** Tambah satu tangki dari katalog. Nomor diambil dari daftar yang ada ditambah yang sedang disimpan. */
  const addKind = async (k: TankKind) => {
    if (!supabase) return;
    const name = nextTankName(k, [...rowsRef.current.map((r) => r.name), ...pending.current]);
    pending.current.push(name);
    setErr('');
    setInfo('');
    const r = await supabase.from('nb_tank_tests').insert({ project_id: projectId, name }).select(COLS).single();
    pending.current = pending.current.filter((n) => n !== name);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    const row = r.data as TankTestRow;
    rowsRef.current = [...rowsRef.current, row];
    setRows(rowsRef.current);
  };

  const add = async () => {
    const n = name.trim();
    if (!supabase || n === '' || adding) return;
    setAdding(true);
    setErr('');
    const r = await supabase.from('nb_tank_tests').insert({ project_id: projectId, name: n }).select(COLS).single();
    setAdding(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => [...l, r.data as TankTestRow]);
    setName('');
  };

  const patch = async (id: string, p: Patch) => {
    if (!supabase) return;
    setBusyId(id);
    setErr('');
    const r = await supabase.from('nb_tank_tests').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setRows((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };

  /** Membuat temuan Open dari uji yang tidak lulus. Tidak membuat dobel bila temuan Open yang sama sudah ada. */
  const makeFinding = async (row: TankTestRow, kind: 'leak' | 'struct') => {
    if (!supabase) return;
    const f = tankFindingText(tankDisplayName(row.name, row.side), kind, kind === 'leak' ? leakDetail(row.leak_count) : structDetail(row.struct_leak, row.struct_deform));
    setBusyId(row.id);
    setErr('');
    setInfo('');
    const ex = await supabase.from('nb_findings').select('id').eq('project_id', projectId).eq('item_key', f.item_key).eq('location', f.location).eq('status', 'open').limit(1);
    if (ex.error) {
      setBusyId('');
      setErr(ex.error.message + (/relation|does not exist/i.test(ex.error.message) ? ' (sudah menjalankan SQL nb_findings?)' : ''));
      return;
    }
    if ((ex.data ?? []).length > 0) {
      setBusyId('');
      setInfo(`Sudah ada temuan Open untuk ${tankDisplayName(row.name, row.side)} di item ini.`);
      return;
    }
    const r = await supabase.from('nb_findings').insert({ project_id: projectId, ...f, status: 'open', found_date: todayIso() });
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setInfo(`Temuan dibuat untuk ${tankDisplayName(row.name, row.side)}. Lihat di Daftar temuan (halaman Tahapan).`);
  };

  const remove = async (row: TankTestRow) => {
    if (!supabase || !window.confirm(`Hapus "${tankDisplayName(row.name, row.side)}" dari daftar uji?`)) return;
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
      <p className="mt-2 text-xs text-slate-500">
        Uji struktural wajib untuk satu tangki dari tiap grup yang mirip, tangki lain cukup leak test (S14 Part C 2.4). Tandai tangki yang cukup leak test dengan &quot;Tidak perlu&quot;. Pengecualian dan rezim yang berlaku ada di Kriteria penerimaan pada item Structural test. Bila uji tidak lulus, catat rinciannya lalu ketuk &quot;Jadikan temuan&quot;; setelah diperbaiki dan diuji ulang, ubah status ke Lulus (rincian di baris ini ikut dikosongkan, riwayatnya tetap ada di Daftar temuan).
      </p>

      {!loaded ? (
        <p className="mt-4 text-sm text-slate-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada kompartemen. Tambahkan satu per satu di atas.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <TankItem key={r.id} r={r} busy={busyId === r.id} hint={kindOfName(r.name)?.hint ?? null} showSide={sideIds.has(r.id)} dup={dupIds.has(r.id)} onPatch={(p) => patch(r.id, p)} onDelete={() => remove(r)} onBadHead={() => setErr('Tinggi uji harus berupa angka dalam meter, mis. 2,4.')} onBadCount={() => setErr('Jumlah titik bocor harus bilangan bulat 0 sampai 999.')} onFinding={(k) => makeFinding(r, k)} />
          ))}
        </ul>
      )}
    </main>
  );
}
