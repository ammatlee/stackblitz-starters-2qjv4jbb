import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { inputCls, Field, Card, Badge, Gauge } from '../../components/classValidity/ui';
import { K_OPTS, SHAFT0, SHAFT_SYS } from '../../lib/classValidity/surveyRules';
import type { DminCfg, ShaftKind, ShaftRow, ShaftSys, Status } from '../../lib/classValidity/surveyRules';
import { num, cx } from '../../lib/classValidity/dateUtils';
import type { PropulsiResult } from '../../lib/classValidity/propulsiCalc';

type Pair = { o: string; a: string };

export type PropulsiProps = {
  S: PropulsiResult;
  dimActive: boolean;
  propelled: boolean;
  propelledFlag: boolean | null;
  vType: string;
  showShaft: boolean;
  showRudder: boolean;
  showDmin: boolean;
  showAnchor: boolean;
  showClear: boolean;
  shaftSys: ShaftSys;
  setShaftSys: Dispatch<SetStateAction<ShaftSys>>;
  shaftCond: 'new' | 'max';
  setShaftCond: Dispatch<SetStateAction<'new' | 'max'>>;
  shafts: ShaftRow[];
  setShafts: Dispatch<SetStateAction<ShaftRow[]>>;
  dmin: DminCfg;
  setDmin: Dispatch<SetStateAction<DminCfg>>;
  wd: { a: string; then: string; now: string };
  setWd: Dispatch<SetStateAction<{ a: string; then: string; now: string }>>;
  anchor: Pair;
  setAnchor: Dispatch<SetStateAction<Pair>>;
  chain: Pair;
  setChain: Dispatch<SetStateAction<Pair>>;
  rudder: { d: string; a: string }[];
  setRudder: Dispatch<SetStateAction<{ d: string; a: string }[]>>;
};

/** MODUL 3 — hanya Renewal + notasi jangkar (berdiri sendiri). Dipanggil sebagai komponen dari halaman Class Validity. */
export default function PropulsiModule(p: PropulsiProps) {
  const { S, dimActive, propelled, propelledFlag, vType, showShaft, showRudder, showDmin, showAnchor, showClear, shaftSys, setShaftSys, shaftCond, setShaftCond, shafts, setShafts, dmin, setDmin, wd, setWd, anchor, setAnchor, chain, setChain, rudder, setRudder } = p;
  if (!dimActive) return null; // tidak ada item pengukuran: modul disembunyikan
  const numIn = (v: string, set: (s: string) => void) => (
    <input inputMode="decimal" className={cx(inputCls, 'bg-yellow-50')} value={v} onChange={(e) => set(e.target.value)} />
  );
  const f2 = (v: number | null) => (v === null ? '—' : String(Number(v.toFixed(4))));
  const sum = S.measured === 0 ? 'BELUM DIUKUR' : S.fails > 0 ? 'NON-COMPLIANT' : 'COMPLIANT';
  const sysName = SHAFT_SYS.find((x) => x[0] === shaftSys)?.[1] ?? '';
  const setShaftRow = (i: number, k: keyof ShaftRow, v: string) => {
    setShafts((rows) =>
      rows.map((x, j) => {
        if (j !== i) return x;
        return { ...x, [k]: v };
      })
    );
  };

  return (
    <>
      <Card title="Ringkasan" sub={propelled ? 'Kapal berpenggerak: poros, rudder, jangkar, dan rantai jangkar' : 'Kapal tanpa penggerak: hanya jangkar dan rantai jangkar'} right={<Badge v={sum} big />}>
        <p className="text-sm">{S.measured} dari {S.total} item terukur · <b>{S.fails}</b> di luar kriteria.</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Status penggerak: {propelled ? 'berpenggerak' : 'tanpa penggerak'} ({propelledFlag === null ? `otomatis dari jenis kapal ${vType}` : 'diatur manual pada data kapal'}).
        </p>
      </Card>

      <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
        {[
          showShaft ? 'clearance poros baling-baling' : '',
          showRudder ? 'rudder stock (neck & pintle)' : '',
          showDmin && propelled ? 'diameter minimum poros' : '',
          showAnchor ? 'berat jangkar dan diameter rantai jangkar' : '',
        ].filter(Boolean).join(' · ') || 'Tidak ada item yang diukur untuk survei dan jenis kapal ini'}
      </p>

      {propelled && (
        <>
          {showShaft && (
          <Card title="Poros Baling-baling (Propeller Shaft Clearance)" sub="Pilih sistem pelumasan; hanya aturan yang sesuai yang dipakai.">
            <div className="flex flex-wrap gap-2">
              {SHAFT_SYS.map(([k, l]) => (
                <button key={k} onClick={() => setShaftSys(k)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', shaftSys === k ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}>
                  {l}
                </button>
              ))}
            </div>
            {shaftSys !== 'fw' && (
              <div className="mt-3 max-w-xs">
                <Field label="Kondisi pengukuran">
                  <select className={inputCls} value={shaftCond} onChange={(e) => setShaftCond(e.target.value as 'new' | 'max')}>
                    <option value="max">Dalam pemakaian (Maximum Clearance)</option>
                    <option value="new">Perakitan baru (New Assembly)</option>
                  </select>
                </Field>
              </div>
            )}
            {shaftSys === 'fw' && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Closed loop fresh water: batas maksimum clearance mengikuti manual pabrikan (ITS Part A 1.10.3). Isi nilainya pada kolom di tiap poros.</p>}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {S.shaftRes.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">Poros {i + 1}</p>
                      <p className="text-xs text-slate-500">{sysName}</p>
                    </div>
                    <Badge v={r.v || 'BELUM DIUKUR'} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Diameter (mm)">{numIn(shafts[i].d, (v) => setShaftRow(i, 'd', v))}</Field>
                    <Field label="Actual (mm)">{numIn(shafts[i].a, (v) => setShaftRow(i, 'a', v))}</Field>
                  </div>
                  <div className="mt-3">
                    <Field
                      label={shaftSys === 'fw' ? 'Maksimum menurut manual pabrikan (mm) *' : 'Maks. menurut manual pabrikan (opsional)'}
                      hint={shaftSys === 'fw' ? undefined : 'Bila ada instruksi pabrikan, nilainya menggantikan batas Rules (ITS Part A 1.10.2).'}
                    >
                      {numIn(shafts[i].m ?? '', (v) => setShaftRow(i, 'm', v))}
                    </Field>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    {r.hi === null
                      ? shaftSys === 'fw' ? 'Isi batas maksimum dari manual pabrikan.' : 'Isi diameter poros untuk melihat batas.'
                      : r.lo !== null
                      ? `Lower ${f2(r.lo)} · Upper ${f2(r.hi)} mm`
                      : `Maksimum ${f2(r.hi)} mm`}
                    {r.manual ? ' (manual pabrikan)' : ''}
                  </p>
                  <Gauge lo={r.lo} hi={r.hi} a={r.a} />
                  {shafts.length > 1 && (
                    <button onClick={() => setShafts((rows) => rows.filter((_, j) => j !== i))} className="mt-3 text-xs font-semibold text-red-700">Hapus poros ini</button>
                  )}
                </div>
              ))}
            </div>
            {shafts.length < 4 && (
              <button onClick={() => setShafts((rows) => [...rows, SHAFT0])} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                + Tambah poros (mis. twin screw)
              </button>
            )}
          </Card>
          )}

          {showDmin && (
          <Card title="Diameter Minimum Desain" sub="Formula (1) dan (2) Rules BKI: diameter aktual (da) harus ≥ diameter minimum (d)">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis poros">
                <select className={inputCls} value={dmin.kind} onChange={(e) => { const kind = e.target.value as ShaftKind; setDmin({ ...dmin, kind, kId: K_OPTS[kind][0].id }); }}>
                  <option value="prop">Propeller shaft</option>
                  <option value="inter">Intermediate shaft</option>
                  <option value="thrust">Thrust shaft</option>
                </select>
              </Field>
              <Field label="Faktor k">
                <select className={inputCls} value={dmin.kId} onChange={(e) => setDmin({ ...dmin, kId: e.target.value })}>
                  {K_OPTS[dmin.kind].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
              {dmin.kind !== 'prop' && (
                <>
                  <Field label="Faktor F">
                    <select className={inputCls} value={dmin.f} onChange={(e) => setDmin({ ...dmin, f: e.target.value })}>
                      <option value="95">95 — turbin, diesel dengan hydraulic slip coupling, propulsi listrik</option>
                      <option value="100">100 — instalasi propulsi lainnya</option>
                    </select>
                  </Field>
                  <Field label="Material poros">
                    <select className={inputCls} value={dmin.mat} onChange={(e) => setDmin({ ...dmin, mat: e.target.value as 'cmn' | 'alloy' })}>
                      <option value="cmn">Carbon / carbon-manganese (Rm maks. 760)</option>
                      <option value="alloy">Alloy steel (Rm maks. 800)</option>
                    </select>
                  </Field>
                </>
              )}
              <Field label={`Rm material (N/mm²) — maks. ${dmin.kind === 'prop' ? 600 : dmin.mat === 'alloy' ? 800 : 760}`} hint="Kosong = pakai batas Rules. Nilai di atas batas dipotong ke batas Rules.">
                <input inputMode="decimal" className={cx(inputCls, 'bg-yellow-50')} value={dmin.rm} onChange={(e) => setDmin({ ...dmin, rm: e.target.value })} />
              </Field>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              Rules (Material B.1): Rm untuk menghitung faktor material Cw tidak boleh melebihi 600 N/mm² untuk propeller shaft (pengecualian perlu persetujuan khusus BKI), 760 untuk poros carbon / carbon-manganese selain propeller shaft, dan 800 untuk alloy steel selain propeller shaft. F propeller shaft = 100.
            </p>
            <div className="mt-4 space-y-3">
              {S.dminRes.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">Poros {i + 1} <span className="font-normal text-slate-500">· da = {shafts[i].d || '—'} mm</span></p>
                    <Badge v={r.v || 'BELUM DIUKUR'} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Field label="Daya Pw (kW)">{numIn(shafts[i].p ?? '', (v) => setShaftRow(i, 'p', v))}</Field>
                    <Field label="Putaran n (rpm)">{numIn(shafts[i].n ?? '', (v) => setShaftRow(i, 'n', v))}</Field>
                    <Field label="Bore di (mm)">{numIn(shafts[i].b ?? '', (v) => setShaftRow(i, 'b', v))}</Field>
                  </div>
                  <p className="mt-3 text-sm">
                    Diameter minimum d: <b>{r.dmin === null ? '—' : `${r.dmin.toFixed(1)} mm`}</b>
                    {r.dmin !== null && r.da !== null && <span className="text-slate-600"> · selisih {(r.da - r.dmin >= 0 ? '+' : '') + (r.da - r.dmin).toFixed(1)} mm</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">F = {r.F} · k = {r.k} · Rm = {r.rm} N/mm² · Cw = {r.cw.toFixed(3)}{r.capped ? ' · Rm dipotong ke batas Rules' : ''}</p>
                  {shafts[i].b && r.da !== null && num(shafts[i].b) !== null && (num(shafts[i].b) as number) / r.da <= 0.4 && <p className="mt-1 text-[11px] text-slate-500">Bore ≤ 0,4·da: suku bore dihitung 1,0.</p>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Pw = daya terukur motor penggerak (kerugian gear box dan bearing tidak dikurangi); n = putaran poros pada daya tersebut. Isi diameter poros pada kartu clearance di atas.</p>
          </Card>
          )}

          {showShaft && shaftSys === 'oil' && (
            <Card title="Clearance poros oil — dari wear-down gauge" sub="Poros tidak ditarik; piston acuan di TDC (ITS Part A 1.10.4)">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Actual clearance saat poros ditarik (mm)">{numIn(wd.a, (v) => setWd((x) => ({ ...x, a: v })))}</Field>
                <Field label="Wear-down saat itu (mm)">{numIn(wd.then, (v) => setWd((x) => ({ ...x, then: v })))}</Field>
                <Field label="Wear-down sekarang (mm)">{numIn(wd.now, (v) => setWd((x) => ({ ...x, now: v })))}</Field>
              </div>
              <p className="mt-3 text-sm">Clearance akhir: <b>{S.wdFinal === null ? '—' : `${f2(S.wdFinal)} mm`}</b></p>
              <p className="mt-1 text-[11px] text-slate-500">Clearance akhir = actual clearance saat poros ditarik + selisih nilai wear-down (sekarang − saat itu).</p>
              {S.wdFinal !== null && (
                <button onClick={() => setShaftRow(0, 'a', String(Math.round((S.wdFinal as number) * 10000) / 10000))} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                  Pakai sebagai Actual pada Poros 1
                </button>
              )}
            </Card>
          )}

          {showRudder && (
          <Card title="Rudder Stock Clearance" sub="Neck: min(0,01d + 2; 4). Pintle: d<50 → 3; 50–100 → 5; d>100 → min(0,01d + 4; 6)">
            <div className="grid gap-4 md:grid-cols-2">
              {S.rudderRes.map((r, i) => (
                <div key={r.item} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold">{r.item}</p><Badge v={r.v || 'BELUM DIUKUR'} /></div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Diameter (mm)">{numIn(rudder[i].d, (v) => setRudder((s) => s.map((x, j) => (j === i ? { ...x, d: v } : x))))}</Field>
                    <Field label="Actual (mm)">{numIn(rudder[i].a, (v) => setRudder((s) => s.map((x, j) => (j === i ? { ...x, a: v } : x))))}</Field>
                  </div>
                  <p className="mt-3 text-sm">Maksimum: <b>{r.mx === null ? '—' : `${r.mx.toFixed(2)} mm`}</b></p>
                  <Gauge lo={null} hi={r.mx} a={r.a} />
                </div>
              ))}
            </div>
          </Card>
          )}
        </>
      )}

      {showAnchor && (
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Anchor Weight" sub="Minimum 88% berat asli" right={<Badge v={S.anchorV || 'BELUM DIUKUR'} />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Original (kg)">{numIn(anchor.o, (v) => setAnchor((x) => ({ ...x, o: v })))}</Field>
            <Field label="Actual (kg)">{numIn(anchor.a, (v) => setAnchor((x) => ({ ...x, a: v })))}</Field>
          </div>
          <p className="mt-3 text-sm">Minimum: <b>{S.anchorMin === null ? '—' : `${S.anchorMin.toFixed(1)} kg`}</b></p>
        </Card>
        <Card title="Anchor Chain Diameter" sub="Minimum 90% diameter asli" right={<Badge v={S.chainV || 'BELUM DIUKUR'} />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Original (mm)">{numIn(chain.o, (v) => setChain((x) => ({ ...x, o: v })))}</Field>
            <Field label="Actual (mm)">{numIn(chain.a, (v) => setChain((x) => ({ ...x, a: v })))}</Field>
          </div>
          <p className="mt-3 text-sm">Minimum: <b>{S.chainMin === null ? '—' : `${S.chainMin.toFixed(2)} mm`}</b></p>
        </Card>
      </div>
      )}

      {showClear && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Data clearance rudder stock dan propeller shaft wajib dicantumkan pada survey report terkait (ITS Part A 1.9 dan 1.10.1).</p>}
    </>
  );
}
