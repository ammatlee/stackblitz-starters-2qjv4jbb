'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';

type P = { user_id: string; email: string | null; approved: boolean; created_at: string };
const dmy = (s: string) => s.slice(0, 10).split('-').reverse().join('.');

export default function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const [rows, setRows] = useState<P[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) setMsg('Gagal memuat: ' + error.message + ' (sudah menjalankan SQL persetujuan anggota?)');
    else setRows((data ?? []) as unknown as P[]);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const setApproved = async (id: string, v: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from('profiles').update({ approved: v }).eq('user_id', id);
    if (error) setMsg(error.message);
    else load();
  };

  if (loading) return <p className="p-10 text-center text-sm text-slate-500">Memuat…</p>;
  if (!user || !isAdmin) return <main className="mx-auto max-w-md px-4 py-10 text-sm text-slate-600">Halaman ini khusus admin.</main>;

  const sorted = [...rows].sort((a, b) => Number(a.approved) - Number(b.approved));
  const pending = rows.filter((r) => !r.approved).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Persetujuan anggota</h1>
      <p className="mt-1 text-sm text-slate-600">{pending > 0 ? `${pending} akun menunggu persetujuan.` : 'Tidak ada akun yang menunggu persetujuan.'}</p>
      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
      <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {sorted.map((r) => (
          <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{r.email ?? r.user_id}</p>
              <p className="text-xs text-slate-500">Mendaftar {dmy(r.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' + (r.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
                {r.approved ? 'DISETUJUI' : 'MENUNGGU'}
              </span>
              {r.user_id !== user.id &&
                (r.approved ? (
                  <button onClick={() => setApproved(r.user_id, false)} className="rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Cabut</button>
                ) : (
                  <button onClick={() => setApproved(r.user_id, true)} className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700">Setujui</button>
                ))}
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Belum ada akun terdaftar.</li>}
      </ul>
    </main>
  );
}
