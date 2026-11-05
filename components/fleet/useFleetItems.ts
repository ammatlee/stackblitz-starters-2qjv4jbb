'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthProvider';
import { buildFleet, todayUTC } from '../../lib/fleet';
import { plansQuery, withPlans } from '../../lib/shaftPlans';
import { fetchAllRows } from '../../lib/fetchAll';
import type { PlanRow } from '../../lib/shaftPlans';
import type { AgInput, EvInput, FleetItem, VesselInput } from '../../lib/fleet';

/** Memuat data armada (kapal, agenda selesai, pembaruan manual) dan menghitung status tiap kapal. */
export function useFleetItems(enabled = true) {
  const { user } = useAuth();
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
    if (enabled) load();
  }, [load, enabled]);

  return { items, err, busy, at, load };
}