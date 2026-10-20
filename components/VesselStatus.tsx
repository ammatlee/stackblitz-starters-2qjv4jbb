'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import DateInput from './DateInput';
import VesselTypeSelect from './VesselTypeSelect';
import { isNonPropelled } from '../lib/vesselTypes';
import { computeSurveyStatus, roman, toDMY, toISO } from '../lib/surveyStatus';
import type { Baseline, Ev } from '../lib/surveyStatus';

type VesselRow = Baseline & { id: string; owner: string; name: string; vessel_type: string | null; last_shaft: string | null; anchor_notation: boolean | null; propelled: boolean | null; shaft_system: string | null; prop_connection: string | null; open_config: string | null };
type AgRow = { vessel_id: string; agenda_no: string; surveys: string[] | null; inspection_start: string | null; inspection_completion: string | null; scenario: string | null; finished_at: string | null };
type EvRow = { id: string; vessel_id: string; surveys: string[] | null; completion: string; created_at: string };

export type ApplyValues = {
  name: string;
  type: string | null;
  yearBuilt: number | null;
  expiry: string | null;
  annivD: number | null;
  annivM: number | null;
  lastNo: number | null;
  propelled: boolean | null; // null = otomatis dari jenis kapal
  anchorNotation: boolean;
  shaftSystem: string | null; // open | oil | fw
  propConnection: string | null; // flanged | keyless | keyed
  openConfig: string | null; // five | three (hanya sistem open: interval 5 / 3 tahun)
  // ringkasan Survey Status untuk form inspeksi (survei yang sudah dikerjakan tidak ditawarkan lagi)
  info?: { nextAnniv: string; annCount: number; intDone: boolean; dock1Done: boolean; shaftDone: boolean; lastDock: string | null } | null;
};

const STATE_TONE: Record<string, string> = {
  OVERDUE: 'bg-red-100 text-red-800',
  'DALAM WINDOW': 'bg-amber-100 text-amber-900',
  'AKAN DATANG': 'bg-slate-100 text-slate-600',
  SELESAI: 'bg-emerald-100 text-emerald-800',
  'BERSAMA RENEWAL': 'bg-sky-100 text-sky-800',
};
const SURVEY_NAME: Record<string, string> = { PS: 'Propeller Shaft', A1: 'Annual 1', A2: 'Annual 2', A3: 'Annual 3', A4: 'Annual 4', A5: 'Annual 5', INT: 'Intermediate', D1: 'Docking', REN: 'Renewal + Docking 2' };
const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';
const EMPTY = { name: '', type: '', yb: '', expiry: '', ad: '', am: '', lastNo: '', lastSpecial: '', lastAnnual: '', lastAnnualNo: '', lastInt: '', lastDock: '', lastShaft: '', postponed: '', propelled: 'auto', notation: false, shaftSys: '', propConn: '', openCfg: '' };
const EMPTY_MU = { annual: '', int: false, dock: false, ren: false, ps: false, completion: '' };

const evsOf = (id: string, ags: AgRow[], mev: EvRow[]): Ev[] => [
  ...ags
    .filter((a) => a.vessel_id === id)
    .map((a) => ({ agenda_no: a.agenda_no, start: a.inspection_start, completion: a.inspection_completion, surveys: a.surveys ?? [], scenario: a.scenario, finished_at: a.finished_at })),
  ...mev
    .filter((m) => m.vessel_id === id)
    .map((m) => ({ agenda_no: 'Manual', start: null, completion: m.completion, surveys: m.surveys ?? [], scenario: null, finished_at: m.created_at })),
];

export default function VesselStatus({ refreshKey, vesselName, onApply }: { refreshKey: number; vesselName: string; onApply: (v: ApplyValues) => void }) {
  const { user, configured, isAdmin } = useAuth();
  const [vessels, setVessels] = useState<VesselRow[]>([]);
  const [ags, setAgs] = useState<AgRow[]>([]);
  const [mev, setMev] = useState<EvRow[]>([]);
  const [selId, setSelId] = useState('');
  const [panel, setPanel] = useState<'none' | 'baseline' | 'manual'>('none');
  const [f, setF] = useState(EMPTY);
  const [mu, setMu] = useState(EMPTY_MU);
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const selRef = useRef('');
  selRef.current = selId;
  const applyRef = useRef(onApply);
  applyRef.current = onApply;
  const nameRef = useRef(vesselName);
  nameRef.current = vesselName;

  const load = useCallback(async () => {
    if (!supabase || !user) return null;
    const v = await supabase.from('vessels').select('*').order('name');
    const a = await supabase.from('agendas').select('vessel_id,agenda_no,surveys,inspection_start,inspection_completion,scenario,finished_at').eq('finished', true);
    const m = await supabase.from('vessel_events').select('id,vessel_id,surveys,completion,created_at').order('completion', { ascending: false });
    if (v.error) {
      setMsg({ k: 'err', t: 'Gagal memuat kapal: ' + v.error.message });
      return null;
    }
    const vs = (v.data ?? []) as unknown as VesselRow[];
    const as = (a.data ?? []) as unknown as AgRow[];
    const ev = (m.error ? [] : (m.data ?? [])) as unknown as EvRow[];
    setVessels(vs);
    setAgs(as);
    setMev(ev);
    return { vs, as, ev };
  }, [user]);

  const emit = useCallback((v: VesselRow, all: AgRow[], evr: EvRow[]) => {
    const r = computeSurveyStatus(v, evsOf(v.id, all, evr), new Date());
    const auto = r ? r.ad === r.expiry.getUTCDate() && r.am === r.expiry.getUTCMonth() + 1 : true;
    applyRef.current({
      name: v.name,
      type: v.vessel_type,
      yearBuilt: v.year_built,
      expiry: r ? toISO(r.expiry) : null,
      annivD: r && !auto ? r.ad : null,
      annivM: r && !auto ? r.am : null,
      lastNo: r ? r.lastNo : null,
      propelled: v.propelled ?? null,
      anchorNotation: !!v.anchor_notation,
      shaftSystem: v.shaft_system ?? null,
      propConnection: v.prop_connection ?? null,
      openConfig: v.open_config ?? null,
      info: r
        ? { nextAnniv: toISO(r.nextAnniv), annCount: r.annCount, intDone: r.intDone, dock1Done: r.dock1Done, shaftDone: r.shaftDone, lastDock: r.lastDock ? toISO(r.lastDock) : null }
        : null,
    });
  }, []);

  // muat ulang (mis. setelah Finish agenda) lalu perbarui form dengan status terbaru kapal yang dipilih
  useEffect(() => {
    (async () => {
      const d = await load();
      if (d && selRef.current) {
        const v = d.vs.find((x) => x.id === selRef.current);
        // hanya memuat ulang form bila form masih mengerjakan kapal ini (tidak setelah form dikosongkan)
        if (v && nameRef.current.trim().toLowerCase() === v.name.toLowerCase()) emit(v, d.as, d.ev);
      }
    })();
  }, [load, emit, refreshKey]);

  const sel = vessels.find((x) => x.id === selId) ?? null;
  const result = useMemo(() => (sel ? computeSurveyStatus(sel, evsOf(sel.id, ags, mev), new Date()) : null), [sel, ags, mev]);
  const selEvents = useMemo(() => mev.filter((m) => m.vessel_id === selId), [mev, selId]);

  const choose = (id: string) => {
    setSelId(id);
    setPanel('none');
    setMsg(null);
    const v = vessels.find((x) => x.id === id);
    if (v) emit(v, ags, mev);
  };

  // ketik/pilih nama kapal di form inspeksi → otomatis memilih kapal tersimpan
  useEffect(() => {
    const n = vesselName.trim().toLowerCase();
    if (!n) return;
    const v = vessels.find((x) => x.name.toLowerCase() === n);
    if (v) {
      if (v.id !== selRef.current) choose(v.id);
    } else if (selRef.current) {
      // nama diganti ke kapal yang belum ada di database: lepas pilihan kapal sebelumnya
      setSelId('');
      setPanel('none');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vesselName, vessels]);

  const openBaseline = (isNew: boolean) => {
    setMsg(null);
    if (isNew || !sel) {
      setSelId('');
      setF({ ...EMPTY, name: vesselName });
    } else {
      setF({
        name: sel.name,
        type: sel.vessel_type ?? '',
        yb: sel.year_built ? String(sel.year_built) : '',
        expiry: sel.cert_expiry ?? '',
        ad: sel.anniv_day ? String(sel.anniv_day) : '',
        am: sel.anniv_month ? String(sel.anniv_month) : '',
        lastNo: sel.last_renewal_no !== null ? String(sel.last_renewal_no) : '',
        lastSpecial: sel.last_special ?? '',
        lastAnnual: sel.last_annual ?? '',
        lastAnnualNo: sel.last_annual_no !== null ? String(sel.last_annual_no) : '',
        lastInt: sel.last_intermediate ?? '',
        lastDock: sel.last_docking ?? '',
        lastShaft: sel.last_shaft ?? '',
        postponed: sel.postponed_until ?? '',
        propelled: sel.propelled === null || sel.propelled === undefined ? 'auto' : sel.propelled ? 'yes' : 'no',
        notation: !!sel.anchor_notation,
        shaftSys: sel.shaft_system ?? '',
        propConn: sel.prop_connection ?? '',
        openCfg: sel.open_config ?? '',
      });
    }
    setPanel('baseline');
  };

  const saveBaseline = async () => {
    if (!supabase || !user) return;
    if (!f.expiry) return setMsg({ k: 'err', t: 'Isi tanggal expiry sertifikat (dd.mm.yyyy).' });
    if (!selId && !f.name.trim()) return setMsg({ k: 'err', t: 'Isi nama kapal.' });
    setBusy(true);
    setMsg(null);
    const n = (s: string) => (s ? Number(s) : null);
    const payload = {
      vessel_type: f.type || null,
      year_built: n(f.yb),
      cert_expiry: f.expiry,
      anniv_day: n(f.ad),
      anniv_month: n(f.am),
      last_renewal_no: n(f.lastNo),
      last_special: f.lastSpecial || null,
      last_annual: f.lastAnnual || null,
      last_annual_no: n(f.lastAnnualNo),
      last_intermediate: f.lastInt || null,
      last_docking: f.lastDock || null,
      last_shaft: f.lastShaft || null,
      propelled: f.propelled === 'auto' ? null : f.propelled === 'yes',
      anchor_notation: f.notation,
      shaft_system: f.shaftSys || null,
      prop_connection: f.propConn || null,
      open_config: f.shaftSys === 'open' ? f.openCfg || null : null,
      postponed_until: f.postponed || null,
      baseline_at: new Date().toISOString(),
    };
    let id = selId;
    if (selId) {
      const r = await supabase.from('vessels').update(payload).eq('id', selId);
      if (r.error) {
        setBusy(false);
        return setMsg({ k: 'err', t: r.error.message });
      }
    } else {
      const r = await supabase.from('vessels').insert({ owner: user.id, name: f.name.trim(), ...payload }).select('id').single();
      if (r.error) {
        setBusy(false);
        return setMsg({ k: 'err', t: r.error.message });
      }
      id = (r.data as { id: string }).id;
    }
    const fresh = await load();
    setBusy(false);
    setSelId(id);
    setPanel('none');
    setMsg({ k: 'ok', t: 'Status awal tersimpan.' });
    const v = fresh?.vs.find((x) => x.id === id);
    if (v && fresh) emit(v, fresh.as, fresh.ev);
  };

  const saveManual = async () => {
    if (!supabase || !user || !selId) return;
    const surveys: string[] = [];
    if (mu.annual) surveys.push('A' + mu.annual);
    if (mu.int) surveys.push('INT');
    if (mu.dock) surveys.push('D1');
    if (mu.ren) surveys.push('REN');
    if (mu.ps) surveys.push('PS');
    if (surveys.length === 0) return setMsg({ k: 'err', t: 'Pilih minimal satu jenis survei.' });
    if (!mu.completion) return setMsg({ k: 'err', t: 'Isi tanggal selesai (dd.mm.yyyy).' });
    setBusy(true);
    setMsg(null);
    const r = await supabase.from('vessel_events').insert({ owner: vessels.find((x) => x.id === selId)?.owner ?? user.id, vessel_id: selId, surveys, completion: mu.completion });
    if (r.error) {
      setBusy(false);
      return setMsg({ k: 'err', t: r.error.message + ' (sudah menjalankan SQL pembaruan manual?)' });
    }
    const fresh = await load();
    setBusy(false);
    setMu(EMPTY_MU);
    setMsg({ k: 'ok', t: 'Status kapal diperbarui.' });
    const v = fresh?.vs.find((x) => x.id === selId);
    if (v && fresh) emit(v, fresh.as, fresh.ev);
  };

  const removeManual = async (id: string) => {
    if (!supabase || !window.confirm('Hapus pembaruan ini?')) return;
    const r = await supabase.from('vessel_events').delete().eq('id', id);
    if (r.error) return setMsg({ k: 'err', t: r.error.message });
    const fresh = await load();
    const v = fresh?.vs.find((x) => x.id === selId);
    if (v && fresh) emit(v, fresh.as, fresh.ev);
  };

  if (!configured) return <p className="text-sm text-slate-500">Supabase belum dikonfigurasi.</p>;
  if (!user) return <p className="text-sm text-slate-500">Masuk dulu untuk melihat Survey Status kapal.</p>;

  const fld = (label: string, el: React.ReactNode) => (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <div className="mt-1">{el}</div>
    </label>
  );
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const setD = (k: keyof typeof EMPTY) => (iso: string) => setF({ ...f, [k]: iso });

  return (
    <div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Pilih kapal tersimpan</span>
          <select className={inp} value={selId} onChange={(e) => choose(e.target.value)}>
            <option value="">— pilih kapal —</option>
            {vessels.map((v) => (
              <option key={v.id} value={v.id}>{v.name}{isAdmin && v.owner !== user?.id ? ' · data akun lain' : ''}</option>
            ))}
          </select>
        </div>
        <button onClick={() => openBaseline(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">+ Kapal baru</button>
      </div>
      {sel && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => openBaseline(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Edit data kapal &amp; status awal</button>
          <button onClick={() => { setPanel(panel === 'manual' ? 'none' : 'manual'); setMsg(null); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">Update status (tanpa agenda)</button>
        </div>
      )}
      {msg && <p className={'mt-2 text-sm ' + (msg.k === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.t}</p>}

      {/* ---------- status awal ---------- */}
      {panel === 'baseline' && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold">Status awal kapal</p>
          <p className="mt-1 text-xs text-slate-600">
            Isi sesuai sertifikat kelas saat ini. Hanya tanggal expiry yang wajib. Agenda yang di-Finish dan pembaruan manual <b>setelah</b> status awal ini disimpan akan memperbarui Survey Status otomatis.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {!selId && fld('Nama kapal', <input className={inp} value={f.name} onChange={set('name')} />)}
            <div>
              <span className="block text-xs font-semibold text-slate-600">Jenis kapal</span>
              <div className="mt-1"><VesselTypeSelect className={inp} value={f.type} onChange={(v, info) => setF({ ...f, type: v, propelled: info && info.propelled !== null ? (info.propelled ? 'yes' : 'no') : 'auto' })} /></div>
            </div>
            {fld('Penggerak (propulsi)', (
              <select className={inp} value={f.propelled} onChange={set('propelled')}>
                <option value="auto">Otomatis dari jenis kapal</option>
                <option value="yes">Berpenggerak</option>
                <option value="no">Tanpa penggerak</option>
              </select>
            ))}
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={f.notation} onChange={(e) => setF({ ...f, notation: e.target.checked })} />
              Notasi jangkar
            </label>
            {fld('Sistem pelumasan poros', (
              <select className={inp} value={f.shaftSys} onChange={set('shaftSys')}>
                <option value="">— belum diatur —</option>
                <option value="open">Open loop (dilumasi air laut)</option>
                <option value="oil">Closed loop — oil</option>
                <option value="fw">Closed loop — fresh water</option>
              </select>
            ))}
            {fld('Tipe sambungan propeller', (
              <select className={inp} value={f.propConn} onChange={set('propConn')}>
                <option value="">— belum diatur —</option>
                <option value="flanged">Flanged</option>
                <option value="keyless">Keyless</option>
                <option value="keyed">Keyed</option>
              </select>
            ))}
            {f.shaftSys === 'open' && fld('Konfigurasi poros (sistem open)', (
              <select className={inp} value={f.openCfg} onChange={set('openCfg')}>
                <option value="">— belum diatur —</option>
                <option value="five">5 tahun — single shaft air tawar / proteksi korosi memadai / multiple shaft</option>
                <option value="three">3 tahun — konfigurasi lainnya</option>
              </select>
            ))}
            {fld('Tahun dibangun', <input className={inp} inputMode="numeric" value={f.yb} onChange={set('yb')} />)}
            {fld('Certificate expiry *', <DateInput className={inp} value={f.expiry} onChange={setD('expiry')} />)}
            {fld('Anniversary — hari (opsional)', <input className={inp} inputMode="numeric" placeholder="otomatis dari expiry" value={f.ad} onChange={set('ad')} />)}
            {fld('Anniversary — bulan 1–12 (opsional)', <input className={inp} inputMode="numeric" placeholder="otomatis dari expiry" value={f.am} onChange={set('am')} />)}
            {fld('Renewal terakhir selesai ke- (opsional)', <input className={inp} inputMode="numeric" placeholder="kosong = ikut umur kapal" value={f.lastNo} onChange={set('lastNo')} />)}
            {fld('Special Survey terakhir', <DateInput className={inp} value={f.lastSpecial} onChange={setD('lastSpecial')} />)}
            {fld('Annual terakhir (periode ini)', <DateInput className={inp} value={f.lastAnnual} onChange={setD('lastAnnual')} />)}
            {fld('Annual terakhir itu yang ke- (1–5)', <input className={inp} inputMode="numeric" placeholder="mis. 2" value={f.lastAnnualNo} onChange={set('lastAnnualNo')} />)}
            {fld('Intermediate terakhir (periode ini)', <DateInput className={inp} value={f.lastInt} onChange={setD('lastInt')} />)}
            {fld('Docking terakhir', <DateInput className={inp} value={f.lastDock} onChange={setD('lastDock')} />)}
            {(f.propelled === 'yes' || (f.propelled === 'auto' && !isNonPropelled(f.type))) && fld('Propeller Shaft Survey terakhir', <DateInput className={inp} value={f.lastShaft} onChange={setD('lastShaft')} />)}
            {fld('Postponed s/d (opsional)', <DateInput className={inp} value={f.postponed} onChange={setD('postponed')} />)}
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={saveBaseline} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Simpan status awal</button>
            <button onClick={() => setPanel('none')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-white">Batal</button>
          </div>
        </div>
      )}

      {/* ---------- update manual tanpa agenda ---------- */}
      {panel === 'manual' && sel && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold">Update status {sel.name} (tanpa nomor agenda)</p>
          <p className="mt-1 text-xs text-slate-600">
            Untuk survei yang dikerjakan surveyor lain. Cukup pilih jenis survei dan tanggal selesai.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fld('Annual', (
              <select className={inp} value={mu.annual} onChange={(e) => setMu({ ...mu, annual: e.target.value })}>
                <option value="">— tidak —</option>
                {[1, 2, 3, 4, 5].filter((n) => n <= 4 || result?.showA5 || mu.annual === '5').map((n) => <option key={n} value={n}>Annual {n}</option>)}
              </select>
            ))}
            {fld('Tanggal selesai *', <DateInput className={inp} value={mu.completion} onChange={(iso) => setMu({ ...mu, completion: iso })} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={mu.int} onChange={(e) => setMu({ ...mu, int: e.target.checked })} />Intermediate</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={mu.dock} onChange={(e) => setMu({ ...mu, dock: e.target.checked })} />Docking</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={mu.ren} onChange={(e) => setMu({ ...mu, ren: e.target.checked })} />Renewal + Docking 2</label>
            {result?.propelled !== false && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={mu.ps} onChange={(e) => setMu({ ...mu, ps: e.target.checked })} />Propeller Shaft</label>}
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={saveManual} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Simpan pembaruan</button>
            <button onClick={() => setPanel('none')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-white">Tutup</button>
          </div>
          {selEvents.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pembaruan manual tersimpan</p>
              <ul className="mt-1 divide-y divide-slate-200">
                {selEvents.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{toDMY(new Date(m.completion + 'T00:00:00Z'))} · {(m.surveys ?? []).map((k) => SURVEY_NAME[k] ?? k).join(', ')}</span>
                    <button onClick={() => removeManual(m.id)} className="text-xs font-semibold text-red-700">Hapus</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {sel && !result && panel === 'none' && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Kapal ini belum punya status awal. Ketuk <b>Edit status awal</b> dan isi tanggal expiry sertifikat.</p>
      )}

      {/* ---------- tabel Survey Status ---------- */}
      {sel && result && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-extrabold tracking-wide">SURVEY STATUS OF CLASS — {sel.name}</h3>
            <p className="text-xs text-slate-500">Format tanggal: dd.mm.yyyy</p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Jenis kapal: <b>{sel.vessel_type ?? '—'}</b> · Tahun dibangun: <b>{sel.year_built ?? '—'}</b> · Penggerak: <b>{result.propelled ? 'Ya' : 'Tidak'}</b> · Notasi jangkar: <b>{sel.anchor_notation ? 'Ya' : 'Tidak'}</b>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Anniversary date of Class Survey : <b>{String(result.ad).padStart(2, '0')}.{String(result.am).padStart(2, '0')}</b> · Periode berjalan: {toDMY(result.periodStart)} – {toDMY(result.expiry)}
            {result.nextNo !== null && <> · Renewal berikutnya: <b>Renewal {roman(result.nextNo)}</b></>}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-slate-300 text-xs text-slate-500">
                <tr><th className="py-2 pr-3">Kind of Survey</th><th className="pr-3">Due Date</th><th className="pr-3">Range Date</th><th className="pr-3">Postponed</th><th className="pr-3">Last Date</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((r) => (
                  <tr key={r.kind} className="align-top">
                    <td className="py-2 pr-3 font-medium">{r.kind}{r.note && <span className="block text-[11px] font-normal text-slate-500">{r.note}</span>}</td>
                    <td className="pr-3">{r.due || '—'}</td>
                    <td className="pr-3">{r.range || '—'}</td>
                    <td className="pr-3">{r.postponed || '—'}</td>
                    <td className="pr-3">{r.last || '—'}</td>
                    <td><span className={'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' + (STATE_TONE[r.state] ?? 'bg-slate-100 text-slate-600')}>{r.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.applied.length > 0 && <p className="mt-2 text-[11px] text-slate-500">Diperbarui oleh: {result.applied.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}