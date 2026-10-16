'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { VESSEL_TYPES } from '../lib/vesselTypes';

const OTHER = '__other__';

/** Pilihan jenis kapal. "Others" memungkinkan mengetik jenis baru yang disimpan di database dan muncul lagi di pilihan berikutnya. */
export default function VesselTypeSelect({ value, onChange, className }: { value: string; onChange: (v: string, info?: { propelled: boolean | null }) => void; className?: string }) {
  const { user } = useAuth();
  const [custom, setCustom] = useState<{ name: string; propelled: boolean }[]>([]);
  const [propelledNew, setPropelledNew] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase.from('vessel_types_custom').select('name,propelled').order('name');
    setCustom(((data ?? []) as { name: string; propelled: boolean | null }[]).map((x) => ({ name: x.name, propelled: x.propelled !== false })));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const all = [...VESSEL_TYPES, ...custom.map((c) => c.name).filter((c) => !VESSEL_TYPES.includes(c))];

  const add = async () => {
    const name = text.trim();
    if (!name) return;
    setErr('');
    if (supabase && user) {
      const r = await supabase.from('vessel_types_custom').insert({ owner: user.id, name, propelled: propelledNew });
      if (r.error && !/duplicate|unique/i.test(r.error.message)) {
        setErr(r.error.message + ' (sudah menjalankan SQL jenis kapal?)');
        return;
      }
    }
    setCustom((c) => (c.some((x) => x.name === name) ? c : [...c, { name, propelled: propelledNew }].sort((a, b) => a.name.localeCompare(b.name))));
    onChange(name, { propelled: propelledNew });
    setAdding(false);
    setText('');
  };

  return (
    <div>
      <select
        className={className}
        value={adding ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) setAdding(true);
          else {
            setAdding(false);
            const c = custom.find((x) => x.name === e.target.value);
            onChange(e.target.value, { propelled: c ? c.propelled : null }); // jenis bawaan: otomatis
          }
        }}
      >
        <option value="">— pilih jenis kapal —</option>
        {all.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
        {value && !all.includes(value) && <option value={value}>{value}</option>}
        <option value={OTHER}>Others (ketik jenis sendiri)…</option>
      </select>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input className={className} placeholder="Nama jenis kapal" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" onClick={add} className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">Simpan jenis</button>
        </div>
      )}
      {adding && (
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={propelledNew} onChange={(e) => setPropelledNew(e.target.checked)} />
          Berpenggerak (poros baling-baling dan rudder perlu diukur)
        </label>
      )}
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </div>
  );
}
