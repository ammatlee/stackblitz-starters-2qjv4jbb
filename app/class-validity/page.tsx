'use client';

/**
 * RDK — VESSEL SURVEY STATUS & CLASS SCOPE MANAGEMENT
 * Dasar aturan : BKI Circular 15-SV-095
 * Sumber data  : Surveyor_Development_Program_Rev_2.xlsx
 *                (Class Status · Survey Scope · Dimensi Kemudi)
 *
 * Komponen halaman untuk Next.js App Router + Tailwind CSS. Konstanta/aturan ada di lib/classValidity,
 * komponen UI kecil di components/classValidity. Kalkulasi real-time (useMemo); Modul 1 mengikuti sheet 'Class Status'.
 */

import { useEffect, useMemo, useState } from 'react';
import type { SetStateAction } from 'react';
import { isNonPropelled } from '../../lib/vesselTypes';
import type { ApplyValues } from '../../components/VesselStatus';

import type { Conn, OpenCfg, PlanKey } from '../../lib/shaftRules';
import { cx, fmt, num, parseD } from '../../lib/classValidity/dateUtils';
import { SURVEYS, DMIN0, SHAFT0 } from '../../lib/classValidity/surveyRules';
import type { SurveyKey, Status, VType, Item, DminCfg, ShaftRow, ShaftSys, Sel } from '../../lib/classValidity/surveyRules';

import { computePropulsi } from '../../lib/classValidity/propulsiCalc';
import { computeStatus } from '../../lib/classValidity/statusCalc';
import StatusModule from '../../components/classValidity/StatusModule';
import ScopeModule from '../../components/classValidity/ScopeModule';
import PropulsiModule from '../../components/classValidity/PropulsiModule';
import ReportDocsModule, { DOCS0 } from '../../components/classValidity/ReportDocsModule';
import type { DocsState } from '../../components/classValidity/ReportDocsModule';
import VisitsModule, { META0, VISIT0 } from '../../components/classValidity/VisitsModule';
import type { Visit, VisitMeta } from '../../components/classValidity/VisitsModule';
import MemoModule from '../../components/classValidity/MemoModule';
import { MEMO0 } from '../../lib/memo';
import type { MemoCtx, MemoState } from '../../lib/memo';
import { Badge } from '../../components/classValidity/ui';
import { useAuth } from '../../components/AuthProvider';

export default function Page() {
  const [tab, setTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  // StatusModule memakai tipe tab lama (1 | 2 | 3)
  const goTab = (v: SetStateAction<1 | 2 | 3>) => setTab(typeof v === 'function' ? v(tab as 1 | 2 | 3) : v);

  /* ---- Modul 1 ---- */
  const [name, setName] = useState('');
  const [agenda, setAgenda] = useState('');
  const [vType, setVType] = useState<VType>('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [expiry, setExpiry] = useState('');
  const [annivD, setAnnivD] = useState<number | null>(null);
  const [annivM, setAnnivM] = useState<number | null>(null);
  const [extension, setExtension] = useState('');
  const [startDate, setStartDate] = useState('');
  const [compDate, setCompDate] = useState('');
  const [sel, setSel] = useState<Sel>({ A1: false, A2: false, A3: false, A4: false, A5: false, INT: false, D1: false, REN: false, PS: false });
  const [notation, setNotation] = useState(false); // notasi jangkar (data induk kapal)
  const [propelledFlag, setPropelledFlag] = useState<boolean | null>(null); // null = otomatis dari jenis kapal
  const [lastNo, setLastNo] = useState<number | null>(null); // nomor Renewal terakhir yang selesai
  const [statusRaw, setStatusInfo] = useState<NonNullable<ApplyValues['info']> | null>(null); // ringkasan Survey Status kapal terpilih
  const [statusName, setStatusName] = useState('');
  // hanya berlaku bila nama kapal di form masih sama dengan kapal yang dimuat statusnya
  const statusInfo = statusRaw && statusName.trim().toLowerCase() === name.trim().toLowerCase() ? statusRaw : null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [recDue, setRecDue] = useState('');
  const [recDone, setRecDone] = useState('');
  const [recAssess, setRecAssess] = useState('');

  /* ---- Modul 2 ---- */
  const [checks, setChecks] = useState<Record<string, string>>({});
  const setCheck = (id: string, v: string) => setChecks((c) => ({ ...c, [id]: v }));

  /* ---- Modul 4: form & lampiran laporan ---- */
  const [docs, setDocs] = useState<DocsState>(DOCS0);
  const [visits, setVisits] = useState<Visit[]>([]); // kunjungan survey agenda ini
  const [vmeta, setVmeta] = useState<VisitMeta>(META0); // isian cetak Daftar Kunjungan Survey
  const [memo, setMemo] = useState<MemoState>(MEMO0); // memorandum awal survei untuk owner (tab Memo)
  const [reportDone, setReportDone] = useState(''); // tanggal laporan selesai (pengingat 7 hari hilang bila terisi)
  const [finished, setFinished] = useState(false); // agenda yang sedang dibuka sudah di-Finish (deadline laporan baru berlaku setelah ini)

  /* ---- Modul 3 ---- */
  const [shaftSys, setShaftSys] = useState<ShaftSys>('open');
  const [propConn, setPropConn] = useState<Conn | ''>(''); // tipe sambungan propeller (Scope Propeller Shaft)
  const [openCfg, setOpenCfg] = useState<OpenCfg | ''>(''); // konfigurasi poros sistem open (menentukan interval 5 / 3 tahun)
  const [shaftPlan, setShaftPlan] = useState<PlanKey | ''>(''); // Method / extension yang dikerjakan
  const [shaftCond, setShaftCond] = useState<'new' | 'max'>('max');
  const [shafts, setShafts] = useState<ShaftRow[]>([SHAFT0]); // satu baris per poros (mis. port / starboard)
  const [dmin, setDmin] = useState<DminCfg>(DMIN0);
  const [wd, setWd] = useState({ a: '', then: '', now: '' }); // wear-down gauge (oil lubricated)
  const [anchor, setAnchor] = useState({ o: '', a: '' });
  const [chain, setChain] = useState({ o: '', a: '' });
  const [rudder, setRudder] = useState([{ d: '', a: '' }, { d: '', a: '' }]);
  // kapal berpenggerak: otomatis dari jenis kapal (pontoon, barge, crane barge = tanpa penggerak), bisa dikoreksi per kapal
  const propelled = propelledFlag ?? !isNonPropelled(vType);

  /* ======================= MODUL 1: kalkulasi (mengikuti sheet Class Status) ======================= */
  const A = useMemo(
    () => computeStatus({ expiry, startDate, compDate, extension, yearBuilt, annivD, annivM, sel, recDue, recDone, recAssess, lastNo, statusInfo }),
    [expiry, startDate, compDate, extension, yearBuilt, annivD, annivM, sel, recDue, recDone, recAssess, lastNo, statusInfo]
  );

  /* ======================= MODUL 3: kalkulasi (sheet Dimensi Kemudi) ======================= */
  // Item Modul Propulsi menurut jenis survei (modul hanya muncul bila ada item yang diukur):
  //  Docking 1 / Renewal → clearance poros + rudder (neck & pintle), hanya kapal berpenggerak
  //  Propeller Shaft     → diameter minimum + clearance poros + rudder (neck & pintle), hanya kapal berpenggerak
  //  Renewal + notasi jangkar → berat jangkar + diameter rantai jangkar (kapal berpenggerak maupun tidak)
  const showShaft = propelled && (sel.D1 || A.active.renewal || sel.PS);
  const showRudder = propelled && (sel.D1 || A.active.renewal || sel.PS);
  const showClear = showShaft || showRudder;
  const showDmin = propelled && sel.PS;
  const showAnchor = notation && A.active.renewal;
  const propActive = showClear || showDmin || showAnchor;
  const S = useMemo(
    () => computePropulsi({ shafts, dmin, shaftSys, shaftCond, wd, anchor, chain, rudder, propelled, showShaft, showRudder, showAnchor, showDmin }),
    [shaftSys, shaftCond, shafts, dmin, wd, anchor, chain, rudder, propelled, showShaft, showRudder, showAnchor, showDmin]
  );

  // tanggal inspeksi mengikuti kunjungan: mulai = kunjungan pertama, selesai = kunjungan terakhir
  useEffect(() => {
    if (visits.length === 0) return;
    const st = visits.map((v) => v.ds).filter(Boolean).sort();
    const en = visits.map((v) => v.de || v.ds).filter(Boolean).sort();
    if (st.length) setStartDate(st[0]);
    if (en.length) setCompDate(en[en.length - 1]);
  }, [visits]);

  // ---- Simpan / buka agenda (Supabase) ----
  const snapshot = { name, agenda, vType, yearBuilt, expiry, annivD, annivM, extension, startDate, compDate, sel, notation, lastNo, recDue, recDone, recAssess, checks, shaftSys, propConn, openCfg, shaftPlan, shaftCond, shafts, dmin, wd, anchor, chain, rudder, docs, visits, reportDone, vmeta, memo };
  const agendaSummary = {
    status: A.overall as string,
    scenario: A.c ? A.caseTitle[A.c] : null,
    surveys: SURVEYS.filter((x) => sel[x.key]).map((x) => x.key as string),
  };
  const restoreAgenda = (d: Record<string, unknown>) => {
    if (typeof d.name === 'string') setName(d.name);
    if (typeof d.agenda === 'string') setAgenda(d.agenda);
    // jenis kapal & tahun dibangun adalah data induk kapal: tidak ditimpa oleh agenda lama
    if (typeof d.expiry === 'string') setExpiry(d.expiry);
    setAnnivD(typeof d.annivD === 'number' ? d.annivD : null);
    setAnnivM(typeof d.annivM === 'number' ? d.annivM : null);
    if (typeof d.extension === 'string') setExtension(d.extension);
    if (typeof d.startDate === 'string') setStartDate(d.startDate);
    if (typeof d.compDate === 'string') setCompDate(d.compDate);
    if (d.sel && typeof d.sel === 'object') setSel(d.sel as Sel);
    // notasi jangkar & penggerak adalah data induk kapal: tidak ditimpa oleh agenda lama
    setLastNo(typeof d.lastNo === 'number' ? d.lastNo : null);
    if (typeof d.recDue === 'string') setRecDue(d.recDue);
    if (typeof d.recDone === 'string') setRecDone(d.recDone);
    if (typeof d.recAssess === 'string') setRecAssess(d.recAssess);
    if (d.checks && typeof d.checks === 'object') setChecks(d.checks as Record<string, string>);
    if (d.shaftSys === 'open' || d.shaftSys === 'oil' || d.shaftSys === 'fw') setShaftSys(d.shaftSys);
    if (d.shaftCond === 'new' || d.shaftCond === 'max') setShaftCond(d.shaftCond);
    if (d.propConn === 'flanged' || d.propConn === 'keyless' || d.propConn === 'keyed') setPropConn(d.propConn);
    if (d.openCfg === 'five' || d.openCfg === 'three') setOpenCfg(d.openCfg);
    if (typeof d.shaftPlan === 'string') setShaftPlan(d.shaftPlan as PlanKey | '');
    if (Array.isArray(d.shafts) && d.shafts.length > 0) setShafts((d.shafts as Partial<ShaftRow>[]).map((x) => ({ ...SHAFT0, ...x })));
    if (d.dmin && typeof d.dmin === 'object') setDmin({ ...DMIN0, ...(d.dmin as Partial<DminCfg>) });
    if (d.wd && typeof d.wd === 'object') setWd(d.wd as typeof wd);
    if (d.anchor && typeof d.anchor === 'object') setAnchor(d.anchor as typeof anchor);
    if (d.chain && typeof d.chain === 'object') setChain(d.chain as typeof chain);
    if (Array.isArray(d.rudder)) setRudder(d.rudder as typeof rudder);
    setReportDone(typeof d.reportDone === 'string' ? d.reportDone : '');
    setFinished(d.finished === true);
    setVmeta(d.vmeta && typeof d.vmeta === 'object' ? { ...META0, ...(d.vmeta as Partial<VisitMeta>) } : META0);
    setMemo(d.memo && typeof d.memo === 'object' ? { ...MEMO0, ...(d.memo as Partial<MemoState>) } : MEMO0);
    setVisits(Array.isArray(d.visits) ? (d.visits as Partial<Visit>[]).map((x) => ({ ...VISIT0, ...x })) : []);
    setDocs(d.docs && typeof d.docs === 'object' ? { ...DOCS0, ...(d.docs as Partial<DocsState>) } : DOCS0);
    setTab(1);
  };

  // ---- Draf otomatis (disimpan di browser ini; dihapus setelah agenda berhasil disimpan ke Supabase) ----
  type Draft = { savedAt: string; tab: 1 | 2 | 3 | 4 | 5; data: Record<string, unknown> };
  const { user: draftUser } = useAuth();
  const draftKey = draftUser ? `rdk-draft-v1:${draftUser.id}` : null;
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const hasContent = Boolean(agenda.trim() || visits.length > 0);
  const snapJson = JSON.stringify({ ...snapshot, finished, master: { vType, yearBuilt, notation, propelledFlag } });

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        if (d && d.data && typeof d.data === 'object') {
          setDraftPrompt(d);
          return;
        }
      }
    } catch {
      /* draf rusak: abaikan */
    }
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftReady || !hasContent) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ savedAt: new Date().toISOString(), tab, data: JSON.parse(snapJson) }));
      } catch {
        /* penyimpanan penuh / diblokir: abaikan */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [draftKey, draftReady, hasContent, snapJson, tab]);

  const discardDraft = () => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* abaikan */
    }
  };
  const resumeDraft = () => {
    if (!draftPrompt) return;
    const d = draftPrompt.data;
    restoreAgenda(d);
    const m = (d.master && typeof d.master === 'object' ? d.master : {}) as Record<string, unknown>;
    if (typeof m.vType === 'string') setVType(m.vType as VType);
    if (typeof m.yearBuilt === 'string') setYearBuilt(m.yearBuilt);
    setNotation(m.notation === true);
    setPropelledFlag(typeof m.propelledFlag === 'boolean' ? m.propelledFlag : null);
    setTab(draftPrompt.tab);
    setDraftPrompt(null);
    setDraftReady(true);
  };
  const dropDraft = () => {
    discardDraft();
    setDraftPrompt(null);
    setDraftReady(true);
  };

  const applyVessel = (v: ApplyValues) => {
    setName(v.name);
    if (v.type) setVType(v.type);
    if (v.yearBuilt) setYearBuilt(String(v.yearBuilt));
    if (v.expiry) {
      setExpiry(v.expiry);
      setAnnivD(v.annivD);
      setAnnivM(v.annivM);
      setLastNo(v.lastNo);
    }
    setPropelledFlag(v.propelled);
    setNotation(v.anchorNotation);
    setShaftSys(v.shaftSystem === 'oil' || v.shaftSystem === 'fw' ? v.shaftSystem : 'open');
    setPropConn(v.propConnection === 'flanged' || v.propConnection === 'keyless' || v.propConnection === 'keyed' ? v.propConnection : '');
    setOpenCfg(v.openConfig === 'five' || v.openConfig === 'three' ? v.openConfig : '');
    setStatusInfo(v.info ?? null);
    setStatusName(v.name);
  };

  // isian PER AGENDA (dikosongkan setelah agenda tersimpan / di-Finish dan saat berganti kapal)
  const clearAgenda = () => {
    setAgenda(''); setExtension(''); setStartDate(''); setCompDate('');
    setSel({ A1: false, A2: false, A3: false, A4: false, A5: false, INT: false, D1: false, REN: false, PS: false });
    setRecDue(''); setRecDone(''); setRecAssess(''); setChecks({});
    setShaftPlan(''); setShaftCond('max'); setShafts([SHAFT0]); setDmin(DMIN0); setWd({ a: '', then: '', now: '' });
    setAnchor({ o: '', a: '' }); setChain({ o: '', a: '' }); setRudder([{ d: '', a: '' }, { d: '', a: '' }]);
    setDocs(DOCS0);
    setVisits([]);
    setReportDone('');
    setFinished(false);
    setVmeta(META0);
    setMemo(MEMO0);
    setTab(1);
  };
  // DATA KAPAL (tahun dibangun, expiry, anniversary, jenis, dll.): terisi otomatis dari database saat kapal tersimpan dipilih
  const clearMaster = () => {
    setVType(''); setYearBuilt(''); setExpiry(''); setAnnivD(null); setAnnivM(null); setLastNo(null);
    setNotation(false); setPropelledFlag(null); setShaftSys('open'); setPropConn(''); setOpenCfg(''); setStatusInfo(null); setStatusName('');
  };
  // berganti ke kapal lain: isian agenda dan data kapal sebelumnya dikosongkan; data kapal baru dimuat otomatis bila ada di database
  const changeName = (n: string) => {
    const was = name.trim().toLowerCase();
    const loaded = statusName.trim().toLowerCase();
    if (loaded && was === loaded && n.trim().toLowerCase() !== loaded) {
      clearAgenda();
      clearMaster();
    }
    setName(n);
  };
  // setelah agenda tersimpan / di-Finish: semua isian dikosongkan; data kapal dimuat lagi otomatis saat nama kapal dipilih
  const clearAll = () => {
    discardDraft();
    clearAgenda();
    clearMaster();
    setName('');
  };

  // modul Propulsi hanya muncul untuk kapal bernotasi jangkar, saat Renewal atau Propeller Shaft Survey
  const dimActive = propActive;

  // survei yang sudah tercatat pada periode berjalan tidak ditawarkan lagi (hanya yang belum dikerjakan)
  const chipVisible = (k: SurveyKey) => {
    if (sel[k]) return true;
    if (k === 'A5' && !A.a5Applicable) return false;
    if (k === 'PS' && !propelled) return false;
    if (statusInfo) {
      if (k.length === 2 && k[0] === 'A' && Number(k[1]) <= statusInfo.annCount) return false;
      if (k === 'INT' && statusInfo.intDone) return false;
      if (k === 'D1' && statusInfo.dock1Done) return false;
    }
    return true;
  };
  const memoActive = A.active.renewal; // memorandum hanya untuk Renewal (docking dan poros ikut bila dipilih bersama Renewal)
  const memoCtx: MemoCtx = useMemo(
    () => ({
      vesselName: name, vType, age: A.age, rnNo: A.rn, renewal: A.active.renewal, docking: A.active.docking, shaft: A.active.shaft, propelled,
      shaftSys, propConn, openCfg, shaftPlan,
      shaftD: shafts.map((r) => num(r.l ?? '') ?? num(r.d)),
      rudderD: rudder.map((r) => num(r.d)),
      anchorO: num(anchor.o), chainO: num(chain.o), segels: num(memo.segels),
    }),
    [name, vType, A.age, A.rn, A.active.renewal, A.active.docking, A.active.shaft, propelled, shaftSys, propConn, openCfg, shaftPlan, shafts, rudder, anchor.o, chain.o, memo.segels]
  );
  const surveyorDefault = [...visits].sort((a, b) => (a.ds + a.ts).localeCompare(b.ds + b.ts))[0]?.surveyor || '';
  const tabs: [1 | 2 | 3 | 4 | 5, string, string][] = [
    [1, 'Status', 'Validity class'],
    [2, 'Scope', 'Checklist survei'],
    ...(propActive ? ([[3, 'Propulsi', [showClear ? 'Clearance' : '', showDmin ? 'Dimensi minimum' : '', showAnchor ? 'Jangkar' : ''].filter(Boolean).join(' · ')]] as [1 | 2 | 3 | 4 | 5, string, string][]) : []),
    [4, 'Laporan', 'Kunjungan · form · lampiran'],
    ...(memoActive ? ([[5, 'Memo', 'Memorandum owner']] as [1 | 2 | 3 | 4 | 5, string, string][]) : []),
  ];
  const shownTab = (tab === 3 && !propActive) || (tab === 5 && !memoActive) ? 1 : tab;

  // saat cetak: buka semua panel lipat dan isi tanggal cetak (berlaku juga untuk Ctrl+P / menu cetak browser)
  useEffect(() => {
    const before = () => {
      document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
      const el = document.getElementById('print-date');
      if (el) el.textContent = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    window.addEventListener('beforeprint', before);
    return () => window.removeEventListener('beforeprint', before);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* kop laporan: hanya tampil saat dicetak */}
      <div className="hidden px-3 pb-3 pt-1 print:block">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">RDK — Laporan Class Validity</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {name || 'Kapal'}
          {vType ? ` · ${vType}` : ''}
        </h1>
        <p className="mt-1 text-xs text-slate-700">
          {agenda ? `Agenda ${agenda} · ` : ''}
          {startDate || compDate ? `Inspeksi ${fmt(parseD(startDate))} s/d ${fmt(parseD(compDate))} · ` : ''}
          Status {A.overall}
          {A.c ? ` · ${A.caseTitle[A.c]}` : ''} · Dicetak <span id="print-date" />
        </p>
      </div>
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-white shadow print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-bold tracking-tight sm:text-lg">RDK — Vessel Survey Status &amp; Class Scope</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden text-slate-300 sm:inline">{name || 'Kapal'} · {vType}</span>
            <Badge v={A.overall} />
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-100 hover:bg-slate-800">
              Cetak / PDF
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs.map(([k, a, b]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('shrink-0 rounded-lg px-4 py-2 text-left text-xs transition', tab === k ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800')}>
              <span className="block font-bold">{a}</span>
              <span className="block opacity-80">{b}</span>
            </button>
          ))}
        </nav>
      </header>

      {draftPrompt && (
        <div className="px-3 pt-3 print:hidden">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span>
              <b>Ada draf yang belum disimpan</b>
              {typeof draftPrompt.data.name === 'string' && draftPrompt.data.name ? ` · ${draftPrompt.data.name}` : ''}
              {typeof draftPrompt.data.agenda === 'string' && draftPrompt.data.agenda ? ` · Agenda ${draftPrompt.data.agenda}` : ''}
              {Array.isArray(draftPrompt.data.visits) ? ` · ${draftPrompt.data.visits.length} kunjungan` : ''}
              {' · '}{new Date(draftPrompt.savedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={resumeDraft} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Lanjutkan</button>
              <button type="button" onClick={dropDraft} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">Buang</button>
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
        {shownTab === 1 && (
          <StatusModule
            A={A} agenda={agenda} setAgenda={setAgenda} agendaSummary={agendaSummary} snapshot={snapshot} restoreAgenda={restoreAgenda} applyVessel={applyVessel} changeName={changeName} clearAll={clearAll} chipVisible={chipVisible} refreshKey={refreshKey} setRefreshKey={setRefreshKey} name={name} vType={vType} setVType={setVType} yearBuilt={yearBuilt} setYearBuilt={setYearBuilt} expiry={expiry} setExpiry={setExpiry} setAnnivD={setAnnivD} setAnnivM={setAnnivM} extension={extension} setExtension={setExtension} startDate={startDate} setStartDate={setStartDate} compDate={compDate} setCompDate={setCompDate} sel={sel} setSel={setSel} notation={notation} setNotation={setNotation} propelled={propelled} propelledFlag={propelledFlag} setPropelledFlag={setPropelledFlag} lastNo={lastNo} setLastNo={setLastNo} recDue={recDue} setRecDue={setRecDue} recDone={recDone} setRecDone={setRecDone} recAssess={recAssess} setRecAssess={setRecAssess} shaftSys={shaftSys} statusInfo={statusInfo} setTab={goTab}
          />
        )}
        {shownTab === 2 && (
          <ScopeModule
            A={A} checks={checks} setCheck={setCheck} setChecks={setChecks} name={name} vType={vType} sel={sel}
            expiry={expiry} extension={extension} yearBuilt={yearBuilt} lastNo={lastNo}
            shaftSys={shaftSys} setShaftSys={setShaftSys} shaftPlan={shaftPlan} setShaftPlan={setShaftPlan}
            propConn={propConn} setPropConn={setPropConn} openCfg={openCfg} setOpenCfg={setOpenCfg}
          />
        )}
        {shownTab === 3 && (
          <PropulsiModule
            S={S} dimActive={dimActive} propelled={propelled} propelledFlag={propelledFlag} vType={vType}
            showShaft={showShaft} showRudder={showRudder} showDmin={showDmin} showAnchor={showAnchor} showClear={showClear}
            shaftSys={shaftSys} setShaftSys={setShaftSys} shaftCond={shaftCond} setShaftCond={setShaftCond}
            shafts={shafts} setShafts={setShafts} dmin={dmin} setDmin={setDmin} wd={wd} setWd={setWd}
            anchor={anchor} setAnchor={setAnchor} chain={chain} setChain={setChain} rudder={rudder} setRudder={setRudder}
          />
        )}
        {shownTab === 4 && (
          <>
            <VisitsModule visits={visits} setVisits={setVisits} vesselName={name} agenda={agenda} compDate={compDate} finished={finished} reportDone={reportDone} setReportDone={setReportDone} sel={sel} meta={vmeta} setMeta={setVmeta} />
            <ReportDocsModule vType={vType} sel={sel} name={name} agenda={agenda} docs={docs} setDocs={setDocs} />
          </>
        )}
        {shownTab === 5 && (
          <MemoModule ctx={memoCtx} memo={memo} setMemo={setMemo} ownerDefault={vmeta.owner} surveyorDefault={surveyorDefault} anchor={anchor} setAnchor={setAnchor} chain={chain} setChain={setChain} />
        )}
        <p className="pb-6 text-center text-[11px] text-slate-500">Alat bantu perhitungan; keputusan akhir mengacu pada aturan BKI dan penilaian Surveyor. · Versi 2026.10.21-a</p>
      </main>
    </div>
  );
}
