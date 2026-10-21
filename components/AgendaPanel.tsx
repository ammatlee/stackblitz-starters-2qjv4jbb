'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { dueLabel, dueTone, reportDue, todayISO } from './classValidity/VisitsModule';

type Snapshot = Record<string, unknown>;
type VesselRef = { name: string; vessel_type: string | null };
type Row = {
  id: string;
  owner: string;
  vessel_id: string | null;
  agenda_no: string;
  surveys: string[] | null;
  inspection_start: string | null;
  inspection_completion: string | null;
  status: string | null;
  scenario: string | null;
  finished: boolean;
  data: Snapshot | null;
  vessels: VesselRef | VesselRef[] | null;
};

type Props = {
  vesselName: string;
  vesselType: string;
  yearBuilt: string;
  agendaNo: string;
  start: string;
  completion: string;
  snapshot: Snapshot;
  summary: { status: string; scenario: string | null; surveys: string[] };
  onRestore: (d: Snapshot) => void;
  onSaved?: () => void;
  anchorNotation?: boolean;
  propelled?: boolean | null;
  shaftSystem?: string;
  onClear?: () => void; // dipanggil setelah agenda tersimpan: form dikosongkan
};

const LABEL: Record<string, string> = {
  PS: 'Propeller Shaft', A1: 'Annual 1', A2: 'Annual 2', A3: 'Annual 3', A4: 'Annual 4', A5: 'Annual 5',
  INT: 'Intermediate', D1: 'Docking 1', REN: 'Renewal + Docking 2',
};
const reportDoneOf = (d: Snapshot | null) => (d && typeof d.reportDone === 'string' ? d.reportDone : '');
const nVisits = (d: Snapshot | null) => (d && Array.isArray(d.visits) ? d.visits.length : 0);
const dmy = (s: string | null) => (s ? s.split('-').reverse().join('.') : '—');
const TONE: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-amber-100 text-amber-900',
  WITHDRAWN: 'bg-red-100 text-red-800',
};

export default function AgendaPanel({ vesselName, vesselType, yearBuilt, agendaNo, start, completion, snapshot, summary, onRestore, onSaved, anchorNotation, propelled, shaftSystem, onClear }: Props) {
  const { user, configured, loading, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from('agendas')
      .select('id,owner,vessel_id,agenda_no,surveys,inspection_start,inspection_completion,status,scenario,finished,data,vessels(name,vessel_type)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) setMsg({ k: 'err', t: 'Gagal memuat riwayat: ' + error.message });
    else setRows((data ?? []) as unknown as Row[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (finish: boolean) => {
    if (!supabase || !user) return;
    const name = vesselName.trim();
    const no = agendaNo.trim();
    if (!name || !no) {
      setMsg({ k: 'err', t: 'Isi Nama Kapal dan No. Agenda terlebih dahulu.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const yb = parseInt(yearBuilt, 10);
    const vinfo = { vessel_type: vesselType || null, year_built: Number.isFinite(yb) ? yb : null, anchor_notation: anchorNotation ?? false, propelled: propelled ?? null, shaft_system: shaftSystem || null };

    // admin boleh menyimpan di kapal milik anggota; akun biasa hanya di kapalnya sendiri
    let vq = supabase.from('vessels').select('id,owner').eq('name', name);
    if (!isAdmin) vq = vq.eq('owner', user.id);
    const found = await vq;
    if (found.error) {
      setBusy(false);
      return setMsg({ k: 'err', t: 'Gagal membaca data kapal: ' + found.error.message });
    }
    const matches = (found.data ?? []) as { id: string; owner: string }[];
    if (matches.length > 1) {
      setBusy(false);
      return setMsg({ k: 'err', t: `Ada ${matches.length} kapal bernama "${name}" di akun yang berbeda. Ubah salah satu namanya supaya tidak ambigu.` });
    }
    let vesselId = matches[0]?.id;
    let vesselOwner = matches[0]?.owner ?? user.id;
    if (vesselId) {
      await supabase.from('vessels').update(vinfo).eq('id', vesselId);
    } else {
      const ins = await supabase.from('vessels').insert({ owner: user.id, name, ...vinfo }).select('id').single();
      if (ins.error) {
        setBusy(false);
        return setMsg({ k: 'err', t: 'Gagal menyimpan kapal: ' + ins.error.message });
      }
      vesselId = (ins.data as { id: string }).id;
      vesselOwner = user.id;
    }

    // Finish: kunjungan terakhir menjadi Completion, yang sebelumnya On Progress
    type V = { ds?: string; ts?: string; stage?: string; sent?: boolean };
    const rawVisits = (Array.isArray(snapshot.visits) ? snapshot.visits : []) as V[];
    const lastV = [...rawVisits].sort((a, b) => ((a.ds ?? '') + (a.ts ?? '')).localeCompare((b.ds ?? '') + (b.ts ?? ''))).pop();
    const snap: Snapshot = finish && lastV ? { ...snapshot, visits: rawVisits.map((v) => ({ ...v, stage: v === lastV ? 'Completion' : 'On Progress' })) } : snapshot;
    const unsent = rawVisits.filter((v) => !v.sent).length;

    const row = {
      owner: vesselOwner,
      vessel_id: vesselId,
      agenda_no: no,
      surveys: summary.surveys,
      inspection_start: start || null,
      inspection_completion: completion || null,
      status: summary.status,
      scenario: summary.scenario,
      data: snap,
      ...(finish ? { finished: true, finished_at: new Date().toISOString() } : {}),
    };
    const up = await supabase.from('agendas').upsert(row, { onConflict: 'owner,agenda_no' });
    setBusy(false);
    if (up.error) return setMsg({ k: 'err', t: 'Gagal menyimpan agenda: ' + up.error.message });
    setMsg({ k: 'ok', t: (finish ? `Agenda ${no} ditandai selesai dan tersimpan.` : `Agenda ${no} tersimpan.`) + (unsent ? ` ${unsent} kunjungan belum dicentang "sudah diinput di web BKI".` : '') + ' Form dikosongkan. Pilih nama kapal untuk memuat data kapal, lalu pilih lingkup survei dan isi tanggal. Ketuk Buka pada riwayat untuk melanjutkan agenda ini.' });
    load();
    onSaved?.();
    onClear?.();
  };

  const remove = async (r: Row) => {
    if (!supabase) return;
    // pembaruan manual yang tanggalnya setelah agenda ini ikut dibersihkan agar Survey Status tidak menyisakan data lama
    let manualIds: string[] = [];
    if (r.vessel_id && r.inspection_completion) {
      const m = await supabase.from('vessel_events').select('id').eq('vessel_id', r.vessel_id).gt('completion', r.inspection_completion);
      if (!m.error) manualIds = ((m.data ?? []) as { id: string }[]).map((x) => x.id);
    }
    const ask = manualIds.length
      ? `Hapus agenda ${r.agenda_no}? ${manualIds.length} pembaruan manual yang tanggalnya setelah agenda ini juga akan dihapus agar Survey Status tidak menyisakan data lama.`
      : `Hapus agenda ${r.agenda_no}?`;
    if (!window.confirm(ask)) return;
    const { error } = await supabase.from('agendas').delete().eq('id', r.id);
    if (error) {
      setMsg({ k: 'err', t: 'Gagal menghapus: ' + error.message });
      return;
    }
    if (manualIds.length) await supabase.from('vessel_events').delete().in('id', manualIds);
    load();
    onSaved?.();
  };

  // laporan selesai: tanggal disimpan di data agenda (pengingat 7 hari hilang)
  const markReport = async (r: Row) => {
    if (!supabase) return;
    const { error } = await supabase.from('agendas').update({ data: { ...(r.data ?? {}), reportDone: todayISO() } }).eq('id', r.id);
    if (error) return setMsg({ k: 'err', t: 'Gagal menandai laporan selesai: ' + error.message });
    setMsg({ k: 'ok', t: `Laporan agenda ${r.agenda_no} ditandai selesai.` });
    load();
  };
  const vname = (r: Row) => (Array.isArray(r.vessels) ? r.vessels[0] : r.vessels)?.name ?? '(tanpa nama kapal)';
  // agenda selesai (Finish) yang laporannya belum selesai; paling mendesak di atas
  const pendingReports = rows
    .filter((r) => r.finished && !reportDoneOf(r.data))
    .map((r) => ({ r, info: reportDue(r.inspection_completion, null) }))
    .filter((x): x is { r: Row; info: NonNullable<ReturnType<typeof reportDue>> } => x.info !== null)
    // agenda lama (tanpa kunjungan dan selesai lebih dari ±5 minggu lalu) dianggap sudah dilaporkan, agar daftar tidak penuh
    .filter((x) => nVisits(x.r.data) > 0 || x.info.days >= -30)
    .sort((a, b) => a.info.days - b.info.days);

  // kelompokkan per kapal; agenda terbaru di atas
  const groups: [string, Row[]][] = (() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const v = Array.isArray(r.vessels) ? r.vessels[0] : r.vessels;
      const base = v?.name ?? '(tanpa nama kapal)';
      const key = isAdmin && r.owner !== user?.id ? `${base} · data akun lain` : base;
      m.set(key, [...(m.get(key) ?? []), r]);
    });
    return Array.from(m.entries())
      .map(([k, l]) => [k, l.sort((a, b) => (b.inspection_completion ?? '').localeCompare(a.inspection_completion ?? ''))] as [string, Row[]])
      .sort((a, b) => a[0].localeCompare(b[0]));
  })();

  if (!configured) return <p className="text-sm text-slate-500">Supabase belum dikonfigurasi, penyimpanan tidak tersedia.</p>;
  if (loading) return <p className="text-sm text-slate-500">Memuat…</p>;
  if (!user) return <p className="text-sm text-slate-500">Masuk dulu untuk menyimpan agenda.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={() => save(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          Simpan agenda
        </button>
        <button disabled={busy} onClick={() => save(true)} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          Finish agenda
        </button>
        <span className="text-xs text-slate-500">Kapal: {vesselName || '—'} · No. Agenda: {agendaNo || '—'}</span>
      </div>
      {msg && <p className={'mt-2 text-sm ' + (msg.k === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.t}</p>}

      {pendingReports.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Laporan belum selesai ({pendingReports.length})</p>
          <ul className="mt-2 space-y-2">
            {pendingReports.map(({ r, info }) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{vname(r)}</span> · {r.agenda_no}
                </span>
                <span className="flex items-center gap-2">
                  <span className={'rounded-full px-2.5 py-0.5 text-[11px] font-bold ' + dueTone(info.days)}>{dueLabel(info.days)}</span>
                  <button onClick={() => markReport(r)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">Laporan selesai</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Riwayat agenda per kapal</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada agenda tersimpan.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {groups.map(([name, list]) => (
            <details key={name} open={name.split(' · data akun lain')[0].toLowerCase() === vesselName.trim().toLowerCase()} className="group rounded-xl border border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                <span className="text-sm font-bold">{name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {list.length} agenda
                  <span className="transition group-open:rotate-180">▼</span>
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                {list.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {r.agenda_no}
                          {r.finished ? (
                            <>
                              <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">SELESAI</span>
                              {reportDoneOf(r.data) && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">LAPORAN ✓</span>}
                            </>
                          ) : (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">BERJALAN</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {dmy(r.inspection_start)} – {dmy(r.inspection_completion)} · {(r.surveys ?? []).map((k) => LABEL[k] ?? k).join(', ') || '—'}
                          {nVisits(r.data) > 0 ? ` · ${nVisits(r.data)} kunjungan` : ''}
                        </p>
                        {r.scenario && <p className="text-xs text-slate-500">{r.scenario}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status && <span className={'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' + (TONE[r.status] ?? 'bg-slate-100 text-slate-600')}>{r.status}</span>}
                        <button onClick={() => r.data && onRestore(r.data)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                          Buka
                        </button>
                        <button onClick={() => remove(r)} className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Hapus
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
