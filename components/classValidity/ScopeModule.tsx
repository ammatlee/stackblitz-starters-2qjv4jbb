import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Card, Fold, Progress, CheckRow } from '../../components/classValidity/ui';
import { ANNUAL, INTERMEDIATE, RENEWAL, DOCKING, MACHINERY, METHOD, applicability, renewalTables, SHAFT_SYS } from '../../lib/classValidity/surveyRules';
import { fmt, cx } from '../../lib/classValidity/dateUtils';
import { PLANS, CONN_LABEL, OPEN_CFG_LABEL, extensionRules, shaftView } from '../../lib/shaftRules';
import { CARGO_SYSTEM_TYPES } from '../../lib/vesselTypes';
import { roman } from '../../lib/surveyStatus';
import type { StatusCalc } from '../../lib/classValidity/statusCalc';
import type { Conn, OpenCfg, PlanKey } from '../../lib/shaftRules';
import type { Item, Sel, ShaftSys, Status, SurveyKey, TRow } from '../../lib/classValidity/surveyRules';

export type ScopeProps = {
  A: StatusCalc;
  checks: Record<string, string>;
  setCheck: (id: string, v: string) => void;
  setChecks: Dispatch<SetStateAction<Record<string, string>>>;
  name: string;
  vType: string;
  sel: Sel;
  expiry: string;
  extension: string;
  yearBuilt: string;
  lastNo: number | null;
  shaftSys: ShaftSys;
  setShaftSys: Dispatch<SetStateAction<ShaftSys>>;
  shaftPlan: PlanKey | '';
  setShaftPlan: Dispatch<SetStateAction<PlanKey | ''>>;
  propConn: Conn | '';
  setPropConn: Dispatch<SetStateAction<Conn | ''>>;
  openCfg: OpenCfg | '';
  setOpenCfg: Dispatch<SetStateAction<OpenCfg | ''>>;
};

/** MODUL 2 — checklist scope: hanya scope yang aktif; item N/A / NONE disembunyikan. */
export default function ScopeModule(p: ScopeProps) {
  const { A, checks, setCheck, setChecks, name, vType, sel, expiry, extension, yearBuilt, lastNo, shaftSys, setShaftSys, shaftPlan, setShaftPlan, propConn, setPropConn, openCfg, setOpenCfg } = p;
  const age = A.age;
  const rn = A.rn ?? 4;
  const t = renewalTables(Math.min(rn, 4), age, vType); // tabel scope: IV dan seterusnya memakai aturan yang sama
  const val = (id: string) => checks[id] ?? 'NOT CHECKED';
  const prog = (ids: string[]) => ({ total: ids.length, done: ids.filter((i) => val(i) !== 'NOT CHECKED').length, def: ids.filter((i) => val(i) === 'DEFICIENCY').length });
  const P = ({ ids }: { ids: string[] }) => {
    const p = prog(ids);
    return <Progress done={p.done} total={p.total} def={p.def} />;
  };
  const hiddenNote = (n: number) => n > 0 && <p className="mt-2 text-[11px] text-slate-400">{n} item tidak berlaku untuk {vType}/umur kapal — disembunyikan.</p>;
  
  const checklist = (id: string, items: Item[]) => {
    const all = items.map((it, i) => ({ it, id: `${id}-${i}`, ap: applicability(it.a, it.g, vType, age) }));
    const rows = all.filter((r) => r.ap !== 'N/A');
    return { rows, ids: rows.map((r) => r.id), hidden: all.length - rows.length };
  };
  const listOf = (rows: { it: Item; id: string; ap: string }[]) => (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <CheckRow key={r.id} title={r.it.s} desc={r.it.t} meta={[r.ap, r.it.n].filter(Boolean).join(' · ')} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />
      ))}
    </ul>
  );
  const tableList = (rows: TRow[]) => {
    const live = rows.filter((r) => !['NONE', 'N/A', '—'].includes(r.scope));
    return { live, ids: live.map((r) => r.id), hidden: rows.length - live.length };
  };
  const tblUi = (live: TRow[]) => (
    <ul className="divide-y divide-slate-100">
      {live.map((r) => <CheckRow key={r.id} title={r.item} chip={r.scope} meta={r.note} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />)}
    </ul>
  );
  
  const an = checklist('AN', ANNUAL);
  const inn = checklist('IN', INTERMEDIATE);
  const rnw = checklist('RN', RENEWAL);
  const dk = checklist('DK', DOCKING);
  const tank = tableList(t.tanks);
  const ut = tableList(t.ut);
  const air = tableList(t.air);
  const mach = MACHINERY.map((m, i) => ({ m, id: `M-${i}` })).filter((r) => r.m[3] !== 'N/A' || CARGO_SYSTEM_TYPES.includes(vType));
  const systems = Array.from(new Set(mach.map((r) => r.m[0])));
  const nothing = !Object.values(A.active).some(Boolean);
  // judul "Annual" hanya dipakai bila Annual memang dipilih atau pada kasus khusus (reinstatement A/C/D)
  const annualNamed = (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).some((k) => sel[k]) || A.c === 'A' || A.c === 'C' || A.c === 'D';
  
  return (
    <>
      <Card title="Scope Aktif" sub={`${name || 'Kapal'} · ${vType} · ${age ?? '—'} th · ${A.rnLabel}`}
        right={<button onClick={() => setChecks({})} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Reset checklist</button>}>
        <div className="flex flex-wrap gap-2 text-xs">
          {nothing && <span className="text-slate-500">Pilih survei di tab Status.</span>}
          {([['annual', 'Annual'], ['inter', 'Intermediate'], ['renewal', 'Renewal'], ['docking', 'Docking'], ['shaft', 'Propeller Shaft'], ['machinery', 'Mesin & Utilitas']] as const)
            .filter(([k]) => A.active[k] && (k !== 'annual' || annualNamed))
            .map(([k, l]) => <span key={k} className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{l}</span>)}
        </div>
        {A.c && (
          <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-slate-700">
            <p className="font-bold">Reinstatement — {A.caseTitle[A.c]}</p>
            <p className="mt-1">{A.reinst[A.c][0]}</p>
            <p className="mt-1 font-semibold">{A.reinst[A.c][1]}</p>
          </div>
        )}
        {A.active.renewal && <p className="mt-3 text-xs text-slate-600">Tangki, UT, dan air pipe head dihitung otomatis dari Year Built {yearBuilt} dan expiry {fmt(A.exp)} → umur {age ?? '—'} tahun, <b>{A.rnLabel}</b>{A.rnBumped ? ` (naik karena Renewal sebelumnya ke-${roman(lastNo ?? 0)})` : ''}. Aturan scope tangki/UT mengikuti tabel &quot;IV dan seterusnya&quot; untuk Renewal IV ke atas.</p>}
        {sel.INT && sel.REN && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Intermediate & Renewal tidak boleh dikreditkan bersamaan.</p>}
      </Card>
  
      {A.active.annual && (
        <Fold
          title={annualNamed ? 'Annual Survey' : 'Pemeriksaan dasar'}
          sub={annualNamed ? 'Hull, safety, mesin, listrik, fire-fighting' : 'Cakupan Intermediate/Renewal memperluas pemeriksaan dasar ini. Annual yang belum dikerjakan tetap harus dikerjakan terpisah.'}
          right={<P ids={an.ids} />}
          open
        >
          {listOf(an.rows)}{hiddenNote(an.hidden)}
        </Fold>
      )}
      {A.active.inter && (
        <Fold title="Intermediate Survey" sub="Tambahan di atas Annual" right={<P ids={inn.ids} />} open>
          {listOf(inn.rows)}{hiddenNote(inn.hidden)}
        </Fold>
      )}
  
      {A.active.renewal && (
        <>
          <Fold title={`Renewal — Tangki (${A.rnLabel})`} sub="Pemeriksaan internal & pressure test" right={<P ids={tank.ids} />} open>
            {tblUi(tank.live)}{hiddenNote(tank.hidden)}
            <p className="mt-2 text-[11px] text-slate-500">Peak tank (semua jenis) diperiksa internal di setiap Renewal. Bila hanya sebagian tangki FO/LO/FW yang dipilih, tangki yang diperiksa harus bergantian dari Renewal ke Renewal (Tabel 3.3, catatan 2). Tabel berlaku untuk tangki tipe integral/struktural.</p>
          </Fold>
          <Fold title={`Renewal — UT Thickness (${A.rnLabel})`} sub="Lokasi pengukuran minimum" right={<P ids={ut.ids} />} open>
            {tblUi(ut.live)}{hiddenNote(ut.hidden)}
          </Fold>
          <Fold title="Renewal — Air Pipe Heads" sub={`Umur ${age ?? '—'} tahun`} right={<P ids={air.ids} />} open>
            {tblUi(air.live)}
          </Fold>
          <Fold title="Renewal — Item Umum" sub="Hull, jangkar, struktur, sertifikat" right={<P ids={rnw.ids} />} open>
            {listOf(rnw.rows)}{hiddenNote(rnw.hidden)}
          </Fold>
        </>
      )}
  
      {A.active.shaft && (() => {
        const sv = shaftView(shaftSys, propConn, openCfg, shaftPlan);
        const plan = sv.plan ? PLANS[sv.plan] : null;
        const isExt = sv.plan === 'E25' || sv.plan === 'E1' || sv.plan === 'E3';
        const sid = (k: string) => `PS-${sv.plan}-${k}`;
        const qid = (k: string) => `PQ-${sv.plan}-${k}`;
        const ids = [...sv.scope.map((x) => sid(x.k)), ...sv.prereq.map((x) => qid(x.k))];
        const pill = (on: boolean) => cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', on ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500');
        const step = (n: number, t: string) => <p className="mb-2 mt-4 text-xs font-bold text-slate-700"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] text-white">{n}</span>{t}</p>;
        const ext = extensionRules(shaftSys);
        return (
          <Fold title="Propeller Shaft Survey" sub="Ikuti langkah 1–3; checklist menyesuaikan pilihan Anda" right={plan ? <P ids={ids} /> : undefined} open>
            {step(1, 'Sistem pelumasan poros')}
            <div className="flex flex-wrap gap-2">
              {SHAFT_SYS.map(([k, l]) => <button key={k} onClick={() => setShaftSys(k)} className={pill(shaftSys === k)}>{l}</button>)}
            </div>

            {step(2, 'Tipe sambungan propeller')}
            <div className="flex flex-wrap gap-2">
              {(['flanged', 'keyless', 'keyed'] as Conn[]).map((c) => <button key={c} onClick={() => setPropConn(c)} className={pill(propConn === c)}>{CONN_LABEL[c]}</button>)}
            </div>
            {shaftSys === 'open' && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">Konfigurasi poros (menentukan interval)</p>
                <div className="space-y-2">
                  {(['five', 'three'] as OpenCfg[]).map((c) => (
                    <button key={c} onClick={() => setOpenCfg(c)} className={cx('block w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition', openCfg === c ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}>
                      {c === 'five' ? '5 tahun — ' : '3 tahun — '}{OPEN_CFG_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-slate-700">
              <p className="font-bold text-teal-900">{sv.intervalText}</p>
              {sv.methods.length > 0 && <p className="mt-1">Method yang boleh dipakai: <b>{sv.methods.map((m) => PLANS[m].title).join(', ')}</b></p>}
              {!propConn && <p className="mt-1">Pilih tipe sambungan propeller untuk melihat Method yang boleh dipakai.</p>}
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">{sv.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>

            {propConn && (
              <>
                {step(3, 'Yang dikerjakan pada survei ini')}
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Survei poros penuh</p>
                <div className="flex flex-wrap gap-2">
                  {sv.methods.map((m) => <button key={m} onClick={() => setShaftPlan(m)} className={pill(sv.plan === m)}>{PLANS[m].title}</button>)}
                </div>
                <p className="mb-1 mt-3 text-[11px] font-semibold text-slate-500">Atau perpanjangan (extension)</p>
                <div className="flex flex-wrap gap-2">
                  {sv.exts.map((m) => <button key={m} onClick={() => setShaftPlan(m)} className={pill(sv.plan === m)}>{PLANS[m].title}</button>)}
                </div>
                <details className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                  <summary className="cursor-pointer font-semibold">Apa itu extension?</summary>
                  <p className="mt-2 leading-relaxed">Extension adalah survei <b>ringan</b> untuk menunda jatuh tempo survei poros penuh, tanpa membongkar poros. Syaratnya prasyarat dokumen terpenuhi. Dilakukan sebaiknya dalam <b>1 bulan</b> dari tanggal jatuh tempo, dan masa perpanjangan dihitung dari tanggal jatuh tempo. Bila dilakukan lebih dari 1 bulan sebelum jatuh tempo, masa perpanjangan dihitung dari tanggal survei extension selesai.</p>
                  <ul className="mt-2 space-y-2">
                    {ext.map((e) => (
                      <li key={e.key} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="font-semibold">{e.label}</p>
                        <p className="text-slate-600">{e.limit}</p>
                        {e.again !== '—' && <p className="text-slate-600">{e.again}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}

            {plan && (
              <div className="mt-4">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold">{plan.title}{isExt ? ' — extension' : ''}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{plan.brief}</p>
                </div>
                {sv.prereq.length > 0 && (
                  <>
                    <p className="mb-1 mt-4 text-xs font-bold text-slate-700">Prasyarat (harus terpenuhi dulu)</p>
                    <ul className="divide-y divide-slate-100">
                      {sv.prereq.map((x) => <CheckRow key={x.k} title={x.t} value={val(qid(x.k))} onChange={(v) => setCheck(qid(x.k), v)} />)}
                    </ul>
                  </>
                )}
                <p className="mb-1 mt-4 text-xs font-bold text-slate-700">Lingkup survei</p>
                <ul className="divide-y divide-slate-100">
                  {sv.scope.map((x) => <CheckRow key={x.k} title={x.t} value={val(sid(x.k))} onChange={(v) => setCheck(sid(x.k), v)} />)}
                </ul>
              </div>
            )}
          </Fold>
        );
      })()}

      {A.active.docking && (
        <Fold title="Docking / Bottom Survey" sub="Interval maksimum 36 bulan" right={<P ids={dk.ids} />} open>
          {listOf(dk.rows)}{hiddenNote(dk.hidden)}
        </Fold>
      )}
  
      {A.active.machinery && (
        <Fold title="Class Renewal — Mesin & Utilitas" sub="Aktif otomatis saat Renewal / Case C / Case D" right={<P ids={mach.map((r) => r.id)} />} open>
          <div className="space-y-4">
            {systems.map((sys) => (
              <div key={sys}>
                <h3 className="text-xs font-bold text-slate-700">{sys}</h3>
                <ul className="divide-y divide-slate-100">
                  {mach.filter((r) => r.m[0] === sys).map((r) => (
                    <CheckRow key={r.id} title={r.m[1]} meta={`${METHOD[r.m[2]]} · ${r.m[3] === 'N/A' ? 'IF FITTED' : r.m[3]}`} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {hiddenNote(MACHINERY.length - mach.length)}
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
            <p className="font-bold text-slate-700">Method / Source Notes</p>
            <p><b>Method 1:</b> Pemeriksaan visual dengan membuka sebagian/seluruhnya sesuai penilaian Surveyor; uji fungsi atau tekanan bila relevan.</p>
            <p><b>Method 2:</b> Pemeriksaan visual tanpa bongkar; performance test wajib; open-up bila dinilai perlu; verifikasi overhaul terakhir.</p>
            <p>(1) Fuel mencakup fuel oil, fuel gas, dan cairan low-flashpoint. (2) Lepas insulasi bila perlu untuk memudahkan inspeksi. (3) Sisi non-return valve dan pompa yang terpapar fluida korosif diperiksa dengan Method 1. (4) Exhaust gas hanya uji fungsi fan. (5) Inert gas berlaku apapun jenis gas/tujuan kecuali fire-fighting. (6) Gas turbine: verifikasi catatan overhaul onboard dan laporan general-overhaul; overhaul oleh OEM/OEM-authorized.</p>
          </div>
        </Fold>
      )}
    </>
  );
}
