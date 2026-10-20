import type { Dispatch, SetStateAction } from 'react';
import AgendaPanel from '../../components/AgendaPanel';
import VesselStatus from '../../components/VesselStatus';
import VesselTypeSelect from '../../components/VesselTypeSelect';
import VesselNameInput from '../../components/VesselNameInput';
import { inputCls, Field, Card, Fold, Badge, dateIn } from '../../components/classValidity/ui';
import { SURVEYS, RULES, CASES } from '../../lib/classValidity/surveyRules';
import { MON, fmt, fmtDM, cx } from '../../lib/classValidity/dateUtils';
import { BASIS } from '../../lib/classValidity/basis';
import type { ApplyValues } from '../../components/VesselStatus';
import type { StatusCalc } from '../../lib/classValidity/statusCalc';
import type { Sel, Status, SurveyKey, VType, ShaftSys } from '../../lib/classValidity/surveyRules';

export type StatusProps = {
  A: StatusCalc;
  agenda: string;
  setAgenda: Dispatch<SetStateAction<string>>;
  agendaSummary: { status: string; scenario: string | null; surveys: string[] };
  snapshot: Record<string, unknown>;
  restoreAgenda: (d: Record<string, unknown>) => void;
  applyVessel: (v: ApplyValues) => void;
  changeName: (n: string) => void;
  clearAll: () => void;
  chipVisible: (k: SurveyKey) => boolean;
  refreshKey: number;
  setRefreshKey: Dispatch<SetStateAction<number>>;
  name: string;
  vType: VType;
  setVType: Dispatch<SetStateAction<VType>>;
  yearBuilt: string;
  setYearBuilt: Dispatch<SetStateAction<string>>;
  expiry: string;
  setExpiry: Dispatch<SetStateAction<string>>;
  setAnnivD: Dispatch<SetStateAction<number | null>>;
  setAnnivM: Dispatch<SetStateAction<number | null>>;
  extension: string;
  setExtension: Dispatch<SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  compDate: string;
  setCompDate: Dispatch<SetStateAction<string>>;
  sel: Sel;
  setSel: Dispatch<SetStateAction<Sel>>;
  notation: boolean;
  setNotation: Dispatch<SetStateAction<boolean>>;
  propelled: boolean;
  propelledFlag: boolean | null;
  setPropelledFlag: Dispatch<SetStateAction<boolean | null>>;
  lastNo: number | null;
  setLastNo: Dispatch<SetStateAction<number | null>>;
  recDue: string;
  setRecDue: Dispatch<SetStateAction<string>>;
  recDone: string;
  setRecDone: Dispatch<SetStateAction<string>>;
  recAssess: string;
  setRecAssess: Dispatch<SetStateAction<string>>;
  shaftSys: ShaftSys;
  statusInfo: NonNullable<ApplyValues['info']> | null;
  setTab: Dispatch<SetStateAction<1 | 2 | 3>>;
};

/** MODUL 1 — Class Status: data kapal, survei yang dikerjakan, hasil validitas, window survei, dan agenda. */
export default function StatusModule(p: StatusProps) {
  const { A, agenda, setAgenda, agendaSummary, snapshot, restoreAgenda, applyVessel, changeName, clearAll, chipVisible, refreshKey, setRefreshKey, name, vType, setVType, yearBuilt, setYearBuilt, expiry, setExpiry, setAnnivD, setAnnivM, extension, setExtension, startDate, setStartDate, compDate, setCompDate, sel, setSel, notation, setNotation, propelled, propelledFlag, setPropelledFlag, lastNo, setLastNo, recDue, setRecDue, recDone, setRecDone, recAssess, setRecAssess, shaftSys, statusInfo, setTab } = p;
  const tone =
    A.overall === 'WITHDRAWN' ? 'from-red-600 to-red-700' : A.overall === 'SUSPENDED' ? 'from-amber-500 to-amber-600' : A.overall === 'VALID' ? 'from-emerald-600 to-emerald-700' : 'from-slate-500 to-slate-600';
  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className={cx('rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg sm:p-6', tone)}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Class Validity</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{A.overall}</p>
        <p className="mt-3 text-sm font-semibold">
          {A.c ? A.caseTitle[A.c] : A.overall === 'INPUT REQUIRED' ? 'Lengkapi tanggal & pilih survei' : A.overall === 'VALID' ? 'Tidak ada skenario withdrawal' : 'Tidak ada skenario withdrawal (status SUSPENDED)'}
        </p>
        {A.c && <p className="mt-2 text-xs leading-relaxed opacity-90">{A.trigger[A.c]}</p>}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-white/20 px-3 py-1">Scope: <b>{A.c ? A.scopeLbl[A.c] : 'Normal sesuai survei terpilih'}</b></span>
          <span className="rounded-full bg-white/20 px-3 py-1">Umur: <b>{A.age ?? '—'} th · {A.rnLabel}</b></span>
        </div>
      </section>
  
      {sel.INT && sel.REN && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          PERINGATAN: Intermediate dan Class Renewal tidak boleh dikreditkan bersamaan (termasuk thickness measurement). Pengecualian (ITS Part A 1.1.3): bila Intermediate dikerjakan lebih awal sebagai Annual in advance, scope-nya boleh dikreditkan ke Renewal.
        </p>
      )}
  
      {A.c && (
        <Card title="Lingkup Survei Reinstatement / Re-classification" sub="Otomatis dari skenario yang terdeteksi (ITS Part A 2.B.4.2)">
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Survei yang harus dilakukan</dt>
              <dd className="mt-1 font-semibold">{A.reinst[A.c][0]}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Docking / Sertifikat</dt>
              <dd className="mt-1 font-semibold">{A.reinst[A.c][1]}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {([['annual', 'Annual'], ['inter', 'Intermediate'], ['renewal', 'Renewal + Tangki/UT/Air Pipe'], ['docking', 'Docking'], ['shaft', 'Propeller Shaft'], ['machinery', 'Mesin & Utilitas']] as const)
              .filter(([k]) => A.active[k] && (k !== 'annual' || A.c === 'A' || A.c === 'C' || A.c === 'D' || (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).some((x) => sel[x])))
              .map(([k, l]) => <span key={k} className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{l}</span>)}
          </div>
          <button onClick={() => setTab(2)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Lihat detail scope &amp; checklist</button>
        </Card>
      )}
  
      <Fold title="Kapal & Survey Status" sub="Pilih kapal, lihat Last/Next tiap survei" open noPrint>
        <VesselStatus refreshKey={refreshKey} vesselName={name} onApply={applyVessel} />
      </Fold>
  
      <Fold title="Agenda & Riwayat" sub="Simpan hasil asesmen per nomor agenda" open noPrint>
        <AgendaPanel
          vesselName={name}
          vesselType={vType}
          yearBuilt={yearBuilt}
          agendaNo={agenda}
          start={startDate}
          completion={compDate}
          snapshot={snapshot}
          summary={agendaSummary}
          onRestore={restoreAgenda}
          onSaved={() => setRefreshKey((k) => k + 1)}
          anchorNotation={notation}
          propelled={propelledFlag}
          shaftSystem={shaftSys}
          onClear={clearAll}
        />
      </Fold>
  
      {/* ---------- INPUT ---------- */}
      <Card title="Data Kapal & Inspeksi">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Nama Kapal</span>
            <VesselNameInput className={inputCls} value={name} onChange={changeName} refreshKey={refreshKey} />
            <span className="mt-1 block text-[11px] leading-snug text-slate-500">Ketik untuk mencari atau ketuk daftar kapal tersimpan.</span>
          </div>
          <Field label="No. Agenda"><input className={inputCls} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Jenis Kapal</span>
            <VesselTypeSelect className={inputCls} value={vType} onChange={(v, info) => { setVType(v); setPropelledFlag(info?.propelled ?? null); }} />
          </div>
          <Field label="Year Built"><input className={inputCls} inputMode="numeric" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} /></Field>
          <Field label="Certificate Expiry">{dateIn(expiry, setExpiry)}</Field>
          <Field label="Inspection Start">{dateIn(startDate, setStartDate)}</Field>
          <Field label="Inspection Completion">{dateIn(compDate, setCompDate)}</Field>
          <Field label="Renewal terakhir selesai (ke-)" hint="Kosong = ikut umur kapal. Naik 1 tingkat bila periode melewati hitungan umur.">
            <input className={inputCls} inputMode="numeric" value={lastNo ?? ''} onChange={(e) => setLastNo(e.target.value === '' ? null : Number(e.target.value) || null)} />
          </Field>
          <Field label="Anniversary" hint={A.anniversaryAuto ? 'Otomatis dari expiry' : 'Diubah manual'}>
            <div className="flex gap-2">
              <select className={inputCls} value={A.ad} onChange={(e) => setAnnivD(Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={inputCls} value={A.am} onChange={(e) => setAnnivM(Number(e.target.value))}>
                {MON.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {!A.anniversaryAuto && (
              <button className="mt-1 text-[11px] font-semibold text-teal-700 underline" onClick={() => { setAnnivD(null); setAnnivM(null); }}>Kembali ke otomatis</button>
            )}
          </Field>
        </div>
  
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-slate-600">Lingkup survei yang dikerjakan (boleh lebih dari satu)</p>
          <div className="flex flex-wrap gap-2">
            {SURVEYS.filter((s) => chipVisible(s.key)).map((s) => (
              <button
                key={s.key}
                onClick={() => setSel((p) => ({ ...p, [s.key]: !p[s.key] }))}
                className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', sel[s.key] ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}
              >
                {sel[s.key] ? '✓ ' : ''}{s.label.replace('Annual Survey — ', 'Annual ').replace('Renewal Survey + Docking 2', 'Renewal + Docking 2')}
              </button>
            ))}
          </div>
          {statusInfo && <p className="mt-2 text-[11px] text-slate-500">Hanya survei yang belum dikerjakan pada periode ini yang ditampilkan. Untuk memilih survei yang sudah tercatat, hapus dulu pembaruan manual atau agendanya.</p>}
          {A.a5Applicable && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-[11px] text-sky-900">Annual 5 diperlukan: anniversary yang dipercepat membuat Annual ke-5 jatuh sebelum jendela Renewal (expiry − 3 bulan). Pilih Annual 5 untuk menilainya.</p>}
          <p className="mt-2 text-[11px] text-slate-500">
            Survei yang dicentang dinilai dengan tanggal inspeksi di atas. Annual/Intermediate setelahnya yang sudah lewat batas withdrawal otomatis dihitung terlewat; bila ≥ 2 Annual + Intermediate terlewat → Case C (scope Renewal).
          </p>
        </div>
  
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={notation} onChange={(e) => setNotation(e.target.checked)} className="h-4 w-4 accent-teal-600" />
            Notasi jangkar (menampilkan modul Propulsi: clearance dan dimensi saat Renewal)
          </label>
          {sel.REN && (
            <div className="w-56"><Field label="Approved Renewal Extension (opsional)">{dateIn(extension, setExtension)}</Field></div>
          )}
        </div>
      </Card>
  
      {/* ---------- STATUS PER SURVEI ---------- */}
      <Card title="Status per Survei" sub={`${fmt(A.st)} – ${fmt(A.co)}`}>
        {A.implied.length > 0 && (
          <ul className="mb-2 divide-y divide-slate-100 rounded-xl border border-red-200 bg-red-50 px-3">
            {A.implied.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="text-xs text-slate-600">Terlewat otomatis — window end {fmt(r.w?.end)}, batas withdrawal {fmt(A.limit(r.key))} sudah lewat.</p>
                </div>
                <Badge v="WITHDRAWN" />
              </li>
            ))}
          </ul>
        )}
        {A.rows.length === 0 ? (
          <p className="text-sm text-slate-500">Pilih survei yang dikerjakan di atas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {A.rows.map((r) => (
              <li key={r.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="text-xs text-slate-500">
                    {r.key === 'D1' ? 'Maksimum 36 bulan dari Docking/Renewal terakhir — tanpa batas paling awal' : r.key === 'PS' ? 'Interval 5 tahun — dicatat di Survey Status' : <>Window {fmt(r.w?.start)} – {fmt(r.w?.end)}</>}
                    {r.key === 'PS' ? '' : r.key === 'D1' ? ` · batas ${fmt(r.w?.end)}` : r.key === 'REN' ? ` · withdrawal > ${fmt(A.limit('REN'))}` : ` · withdrawal > ${fmt(A.limit(r.key))}`}
                  </p>
                  {A.why(r) && <p className="mt-0.5 text-xs text-slate-600">{A.why(r)}</p>}
                </div>
                <Badge v={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
  
      {/* ---------- SIKLUS BARU ---------- */}
      {(A.newPeriod || A.shift?.shifted) && (
        <Card title="Anniversary & Siklus Sertifikat">
          {A.shift?.shifted && (
            <div className="mb-3 rounded-xl border border-teal-300 bg-teal-50 p-3 text-sm">
              <p className="font-semibold">Anniversary bergeser</p>
              <p className="text-xs">{A.shift.txt}</p>
              <p className="mt-1 text-[11px] text-slate-600">Tersimpan otomatis ke Survey Status saat agenda ini di-Finish. Pilih ulang kapal setelahnya untuk memuat anniversary terbaru.</p>
            </div>
          )}
          {A.newPeriod && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-slate-500">Class Period Baru</p><p className="font-semibold">{fmt(A.newPeriod.start)}</p></div>
                <div><p className="text-xs text-slate-500">Expiry Baru</p><p className="font-semibold">{fmt(A.newPeriod.expiry)}</p></div>
                <div><p className="text-xs text-slate-500">Anniversary Baru</p><p className="font-semibold">{fmtDM(A.newPeriod.ad, A.newPeriod.am)}</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-600">{A.newPeriod.note}</p>
            </div>
          )}
        </Card>
      )}
  
      <Fold title="Dasar Aturan" sub="ITS Part A dan Nota Dinas BKI untuk hasil saat ini" open>
        {A.basis.length === 0 ? (
          <p className="text-sm text-slate-500">Pilih survei dan isi tanggal inspeksi untuk melihat dasar aturan yang berlaku.</p>
        ) : (
          <div className="space-y-3">
            {A.basis.map((k) => {
              const b = BASIS[k];
              if (!b) return null;
              return (
                <div key={k} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold">{b.title}</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ITS Part A / Rules</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{b.its}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">Nota Dinas BKI 87/SVY/III/2020</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">{b.nd}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-slate-500">
              ITS Part A bersumber dari Rules. Nota Dinas adalah penjelasan internal BKI untuk menyeragamkan penentuan status dan tanggal. Bila ragu, hubungi SM Mempertahankan Klas (Nota Dinas poin 7).
            </p>
          </div>
        )}
      </Fold>
  
      <Fold title="Recommendation (Case B)" sub="Opsional — isi bila ada recommendation" right={<Badge v={A.recSt} />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Due Date">{dateIn(recDue, setRecDue)}</Field>
          <Field label="Actual Completion">{dateIn(recDone, setRecDone)}</Field>
          <Field label="Assessment Date" hint="Bila masih terbuka">{dateIn(recAssess, setRecAssess)}</Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">Selesai setelah due date = SUSPENDED. Outstanding &gt; 6 bulan = WITHDRAWN. Penundaan rekomendasi hanya boleh 1 kali, hanya bila kapal tidak sedang dalam prosedur suspension, dan persetujuan akhir ada di BKI Pusat (ITS Part A Annex C).</p>
      </Fold>
  
      <Fold title="Referensi Aturan" sub="Time window dan Case A–D">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-2 pr-3">Rule</th><th className="pr-3">Window Start</th><th className="pr-3">Window End</th><th className="pr-3">Suspended</th><th>Withdrawn</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {RULES.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className={cx('py-2 pr-3', i === 0 && 'font-semibold')}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-2 pr-3">Case</th><th className="pr-3">Reinstatement</th><th>Docking / Sertifikat</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {CASES.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className={cx('py-2 pr-3', i === 0 && 'font-semibold')}>{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </Fold>
    </>
  );
}
