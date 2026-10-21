'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AuditView from '../../components/audit/AuditView';
import type { AuditRow } from '../../lib/audit';

const PAGE = 100;

export default function AuditPage() {
  const { user, configured, isAdmin } = useAuth();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [vessel, setVessel] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ?vessel=<id> dari tombol "Riwayat perubahan" di Class Validity
  useEffect(() => {
    setVessel(new URLSearchParams(window.location.search).get('vessel') ?? '');
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setBusy(true);
    setErr('');
    let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
    if (vessel) q = q.eq('vessel_id', vessel);
    const r = await q;
    if (r.error) {
      setErr(/audit_log/.test(r.error.message) ? 'Tabel riwayat belum ada. Jalankan SQL 04_audit_log.sql di Supabase dulu.' : 'Gagal memuat riwayat: ' + r.error.message);
      setBusy(false);
      return;
    }
    setRows((r.data ?? []) as unknown as AuditRow[]);
    setBusy(false);
  }, [user, limit, vessel]);

  useEffect(() => {
    load();
  }, [load]);

  const filterName = vessel && rows && rows.length > 0 ? rows[0].vessel_name ?? undefined : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Class &amp; Technical</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Riwayat Perubahan</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isAdmin ? 'Semua perubahan data kapal, agenda, dan pembaruan manual, terbaru di atas.' : 'Perubahan pada data kapal dan agenda milikmu, terbaru di atas.'}
          </p>
        </div>
        <div className="flex gap-2">
          {vessel && (
            <button onClick={() => setVessel('')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Semua kapal
            </button>
          )}
          {supabase && (
            <button onClick={load} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {busy ? 'Memuat…' : 'Muat ulang'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        {!configured || !supabase ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Mode demo: Supabase belum dikonfigurasi.</p>
        ) : err ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">{err}</p>
        ) : rows === null ? (
          <p className="p-6 text-center text-sm text-slate-500">Memuat riwayat…</p>
        ) : (
          <>
            <AuditView rows={rows} vesselFilterName={filterName} isAdmin={isAdmin} userId={user?.id} />
            {rows.length >= limit && (
              <button onClick={() => setLimit(limit + PAGE)} disabled={busy} className="mt-4 w-full rounded-xl border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Muat lebih banyak
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
