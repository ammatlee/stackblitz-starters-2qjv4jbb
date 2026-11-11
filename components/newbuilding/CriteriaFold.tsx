'use client';

import React, { useState } from 'react';
import { Chip } from '../Controls';
import { CRITERIA_DISCLAIMER, CRITERIA_SOURCES, PART_A_MIN_HEAD, governingHead, governingHeadA, partCMinHead } from '../../lib/newbuildingCriteria';
import type { CriteriaGroup, CriteriaSet, Regime } from '../../lib/newbuildingCriteria';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
const num = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function Group({ g }: { g: CriteriaGroup }) {
  return (
    <div className="mt-3">
      {g.title && <p className="text-xs font-bold text-slate-700">{g.title}</p>}
      <ul className="mt-1 space-y-2">
        {g.rows.map((r) => (
          <li key={r.param} className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">{r.param}</p>
            {g.columns === 'value' ? (
              r.value && <p className="mt-0.5">{r.value}</p>
            ) : (
              <p className="mt-0.5 tabular-nums">
                Standard: {r.standard ?? '-'} · Limit: {r.limit ?? '-'}
              </p>
            )}
            {r.note && <p className="mt-0.5 text-slate-500">{r.note}</p>}
            <p className="mt-0.5 text-[11px] text-slate-400">{r.ref}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kalkulator tinggi uji struktural S14. Hanya di layar, tidak disimpan. */
function HeadCalc({ hint }: { hint: { regime: Regime | null; reason: string } | null }) {
  const [pick, setPick] = useState<Regime | null>(null);
  const [d, setD] = useState('');
  const [ov, setOv] = useState('');
  const regime: Regime = pick ?? hint?.regime ?? 'C';
  const depth = num(d);
  const overflow = num(ov);
  return (
    <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/60 p-2 text-xs text-slate-700">
      <p className="font-bold text-slate-800">Hitung tinggi uji</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Chip selected={regime === 'A'} onClick={() => setPick('A')}>Part A/B (SOLAS)</Chip>
        <Chip selected={regime === 'C'} onClick={() => setPick('C')}>Part C (non-SOLAS)</Chip>
      </div>
      {hint && <p className="mt-1 text-slate-500">Saran dari data proyek: {hint.reason} Rezim yang dipakai tetap mengikuti dokumen Kelas/Flag dan ITP.</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {regime === 'C' && (
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-600">Depth kapal D (m)</span>
            <input className={INPUT} inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block font-semibold text-slate-600">Top of overflow di atas top of tank (m), opsional</span>
          <input className={INPUT} inputMode="decimal" value={ov} onChange={(e) => setOv(e.target.value)} />
        </label>
      </div>
      {regime === 'A' && (
        <p className="mt-2">
          Minimum Part A/B: <b>{fmt(PART_A_MIN_HEAD)} m</b> di atas top of tank.
          {overflow != null && (
            <>
              {' '}
              Yang menentukan: <b>{fmt(governingHeadA(overflow).head)} m</b> ({governingHeadA(overflow).by === 'overflow' ? 'top of overflow' : 'Part A/B'}).
            </>
          )}{' '}
          Syarat lain di Tabel 1 (bulkhead deck, tekanan uap desain) belum dihitung.
        </p>
      )}
      {regime === 'C' && depth != null && (
        <p className="mt-2">
          0,3D + 0,76 = <b>{fmt(0.3 * depth + 0.76)} m</b>
          {0.3 * depth + 0.76 > 2.4 ? ' (dibatasi 2,4 m)' : ''}. Minimum Part C: <b>{fmt(partCMinHead(depth))} m</b> di atas top of tank.
          {overflow != null && (
            <>
              {' '}
              Yang menentukan: <b>{fmt(governingHead(depth, overflow).head)} m</b> ({governingHead(depth, overflow).by === 'overflow' ? 'top of overflow' : 'Part C'}). Syarat lain di Tabel 1 (bulkhead deck, tekanan uap desain) belum dihitung.
            </>
          )}
        </p>
      )}
    </div>
  );
}

export default function CriteriaFold({ set, regimeHint = null }: { set: CriteriaSet; regimeHint?: { regime: Regime | null; reason: string } | null }) {
  return (
    <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-teal-700">Kriteria penerimaan (acuan)</summary>
      <div className="border-t border-slate-200 px-3 pb-3">
        <p className="mt-2 text-[11px] text-slate-500">{CRITERIA_SOURCES[set.source]}</p>
        {set.groups.map((g, i) =>
          g.collapsed ? (
            <details key={g.title ?? i} className="mt-3 rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-bold text-slate-700">{g.title ?? 'Selengkapnya'}</summary>
              <div className="px-2 pb-2">
                <Group g={{ ...g, title: undefined }} />
              </div>
            </details>
          ) : (
            <Group key={g.title ?? i} g={g} />
          )
        )}
        {set.calc === 'partC' && <HeadCalc hint={regimeHint} />}
        {set.notes.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
            {set.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] italic text-slate-500">{CRITERIA_DISCLAIMER}</p>
      </div>
    </details>
  );
}
