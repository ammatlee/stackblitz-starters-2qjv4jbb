'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

type Snapshot = Record<string, unknown>;
type VesselRef = { name: string; vessel_type: string | null };
type Row = {
  id: string;
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
const dmy = (s: string | null) => (s ? s.split('-').reverse().join('.') : '—');
const TONE: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800',
  SUSPENDED: 'bg-amber-100 text-amber-900',
  WITHDRAWN: 'bg-red-100 text-red-800',
};

export default function AgendaPanel({ vesselName, vesselType, yearBuilt, agendaNo, start, completion, snapshot, summary, onRestore, onSaved, anchorNotation, propelled, shaftSystem, onClear }: Props) {
  const { user, configured, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from('agendas')
      .select('id,vessel_id,agenda_no,surveys,inspection_start,inspection_completion,status,scenario,finished,data,vessels(name,vessel_type)')
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

    const found = await supabase.from('vessels').select('id').eq('owner', user.id).eq('name', name).maybeSingle();
    if (found.error) {
      setBusy(false);
      return setMsg({ k: 'err', t: 'Gagal membaca data kapal: ' + found.error.message });
    }
    let vesselId = (found.data as { id: string } | null)?.id;
    if (vesselId) {
      await supabase.from('vessels').update(vinfo).eq('id', vesselId);
    } else {
      const ins = await supabase.from('vessels').insert({ owner: user.id, name, ...vinfo }).select('id').single();
      if (ins.error) {
        setBusy(false);
        return setMsg({ k: 'err', t: 'Gagal menyimpan kapal: ' + ins.error.message });
      }
      vesselId = (ins.data as { id: string }).id;
    }

    const row = {
      owner: user.id,
      vessel_id: vesselId,
      agenda_no: no,
      surveys: summary.surveys,
      inspection_start: start || null,
      inspection_completion: completion || null,
      status: summary.status,
      scenario: summary.scenario,
      data: snapshot,
      ...(finish ? { finished: true, finished_at: new Date().toISOString() } : {}),
    };
    const up = await supabase.from('agendas').upsert(row, { onConflict: 'owner,agenda_no' });
    setBusy(false);
    if (up.error) return setMsg({ k: 'err', t: 'Gagal menyimpan agenda: ' + up.error.message });
    setMsg({ k: 'ok', t: (finish ? `Agenda ${no} ditandai selesai dan tersimpan.` : `Agenda ${no} tersimpan.`) + ' Form dikosongkan. Pilih nama kapal untuk memuat data kapal, lalu pilih lingkup survei dan isi tanggal. Ketuk Buka pada riwayat untuk melanjutkan agenda ini.' });
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

  // kelompokkan per kapal; agenda terbaru di atas
  const groups: [string, Row[]][] = (() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      const v = Array.isArray(r.vessels) ? r.vessels[0] : r.vessels;
      const key = v?.name ?? '(tanpa nama kapal)';
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

      <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Riwayat agenda per kapal</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Belum ada agenda tersimpan.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {groups.map(([name, list]) => (
            <details key={name} open={name.toLowerCase() === vesselName.trim().toLowerCase()} className="group rounded-xl border border-slate-200">
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
                          {r.finished && <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">SELESAI</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {dmy(r.inspection_start)} – {dmy(r.inspection_completion)} · {(r.surveys ?? []).map((k) => LABEL[k] ?? k).join(', ') || '—'}
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
