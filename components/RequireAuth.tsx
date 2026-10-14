'use client';

import React from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();

  if (!configured) {
    return (
      <>
        <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          Mode demo: Supabase belum dikonfigurasi, jadi login tidak diperlukan.
        </div>
        {children}
      </>
    );
  }
  if (loading) return <p className="p-10 text-center text-sm text-slate-500">Memuat…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold">Khusus anggota</h2>
          <p className="mt-2 text-sm text-slate-600">Masuk dulu untuk membuka Class Validity.</p>
          <Link href="/login" className="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  return <>{children}</>;
}