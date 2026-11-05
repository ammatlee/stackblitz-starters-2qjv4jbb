'use client';

import React from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import FleetView from '../../components/fleet/FleetView';
import { useFleetItems } from '../../components/fleet/useFleetItems';
import { Button, Skeleton } from '../../components/Controls';

export default function FleetPage() {
  const { user, configured, isAdmin } = useAuth();
  const { items, err, busy, at, load } = useFleetItems();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Class &amp; Technical</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Dashboard Armada</h1>
          <p className="mt-1 text-sm text-slate-600">Survei yang paling dekat jatuh tempo, diurutkan dari yang paling mendesak.</p>
        </div>
        {supabase && (
          <Button onClick={load} disabled={busy} size="sm">
            {busy ? 'Memuat…' : 'Muat ulang'}
          </Button>
        )}
      </div>
      {at && <p className="mt-1 text-xs text-slate-500">Diperbarui pukul {at}</p>}

      <div className="mt-5">
        {!configured || !supabase ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Mode demo: Supabase belum dikonfigurasi, jadi data kapal tidak tersedia.</p>
        ) : err ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">{err}</p>
        ) : items === null ? (
          <div role="status" aria-busy="true" className="space-y-4">
            <span className="sr-only">Memuat data kapal…</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <FleetView items={items} currentUserId={isAdmin ? user?.id : undefined} />
        )}
      </div>
    </main>
  );
}