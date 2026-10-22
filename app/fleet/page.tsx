'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import FleetView from '../../components/fleet/FleetView';
import { buildFleet, todayUTC } from '../../lib/fleet';
import { plansQuery, withPlans } from '../../lib/shaftPlans';
import { fetchAllRows } from '../../lib/fetchAll';
import type { PlanRow } from '../../lib/shaftPlans';
import type { AgInput, EvInput, FleetItem, VesselInput } from '../../lib/fleet';

export default function FleetPage() {
  const { user, configured, isAdmin } = useAuth();
  const [items, setItems] = useState<FleetItem[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setBusy(true);
    setErr('');
    const sb = supabase;
    const v = await fetchAllRows((f, t) => sb.from('vessels').select('*').order('name').order('id').range(f, t));
    const a = await fetchAllRows((f, t) => sb.from('agendas').select('vessel_id,agenda_no,surveys,inspection_start,inspection_completion,scenario,finished_at').eq('finished', true).order('id').range(f, t));
    const m = await fetchAllRows((f, t) => sb.from('vessel_events').select('*').order('id').range(f, t));
    const pl = await fetchAllRows((f, t) => sb.from('agendas').select(plansQuery).eq('finished', true).order('id').range(f, t));
    if (v.error) {
      setErr('Gagal memuat kapal: ' + v.error.message);
      setBusy(false);
      return;
    }
    const vessels = (v.data ?? []) as unknown as VesselInput[];
    const ags = withPlans((a.error ? [] : (a.data ?? [])) as unknown as AgInput[], (pl.error ? [] : pl.data) as unknown as PlanRow[]);
    const mev = (m.error ? [] : (m.data ?? [])) as unknown as EvInput[];
    setItems(buildFleet(vessels, ags, mev, todayUTC()));
    setAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setBusy(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Class &amp; Technical</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Dashboard Armada</h1>
          <p className="mt-1 text-sm text-slate-600">Survei yang paling dekat jatuh tempo, diurutkan dari yang paling mendesak.</p>
        </div>
        {supabase && (
          <button onClick={load} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy ? 'Memuat…' : 'Muat ulang'}
          </button>
        )}
      </div>
      {at && <p className="mt-1 text-xs text-slate-400">Diperbarui pukul {at}</p>}

      <div className="mt-5">
        {!configured || !supabase ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Mode demo: Supabase belum dikonfigurasi, jadi data kapal tidak tersedia.</p>
        ) : err ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">{err}</p>
        ) : items === null ? (
          <p className="p-6 text-center text-sm text-slate-500">Memuat data kapal…</p>
        ) : (
          <FleetView items={items} currentUserId={isAdmin ? user?.id : undefined} />
        )}
      </div>
    </main>
  );
}
