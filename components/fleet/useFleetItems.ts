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
    // keempat query berjalan bersamaan (dulu berurutan)
    const [v, a, m, pl] = await Promise.all([
      fetchAllRows((f, t) => sb.from('vessels').select('*').order('name').order('id').range(f, t)),
      fetchAllRows((f, t) => sb.from('agendas').select('vessel_id,agenda_no,surveys,inspection_start,inspection_completion,scenario,finished_at').eq('finished', true).order('id').range(f, t)),
      fetchAllRows((f, t) => sb.from('vessel_events').select('*').order('id').range(f, t)),
      fetchAllRows((f, t) => sb.from('agendas').select(plansQuery).eq('finished', true).order('id').range(f, t)),
    ]);
    // Kapal, agenda selesai, dan pembaruan manual menentukan status survei. Bila salah satunya gagal dibaca,
    // JANGAN hitung dengan data kosong (hasilnya menyesatkan: survei yang sudah selesai tampak belum). Tampilkan galat.
    // Kolom rencana poros (pl) boleh gagal: dihitung tanpa rencana (kompatibel dengan database lama).
    const failed = v.error ? ['kapal', v.error.message] : a.error ? ['agenda selesai', a.error.message] : m.error ? ['pembaruan manual', m.error.message] : null;
    if (failed) {
      setErr(`Gagal memuat ${failed[0]}: ${failed[1]}. Angka tidak ditampilkan agar tidak menyesatkan; coba muat ulang.`);
      setBusy(false);
      return;
    }
    const vessels = (v.data ?? []) as unknown as VesselInput[];
    const ags = withPlans((a.data ?? []) as unknown as AgInput[], (pl.error ? [] : pl.data) as unknown as PlanRow[]);
    const mev = (m.data ?? []) as unknown as EvInput[];
    setItems(buildFleet(vessels, ags, mev, todayUTC()));
    setAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setBusy(false);
  }, [user]);

  useEffect(() => {
    if (enabled) load();
  }, [load, enabled]);

  return { items, err, busy, at, load };
}