'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

export default function SiteHeader() {
  const { user, configured, approved, isAdmin, signOut } = useAuth();
  const path = usePathname();
  const [pending, setPending] = useState(0);

  // admin: tampilkan jumlah akun yang menunggu persetujuan
  useEffect(() => {
    (async () => {
      if (!supabase || !isAdmin) return setPending(0);
      const { count } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('approved', false);
      setPending(count ?? 0);
    })();
  }, [isAdmin, path]);

  const nav = [
    { href: '/', label: 'Menu Utama' },
    { href: '/bulletin', label: 'Bulletin' },
    { href: '/class-validity', label: 'Class Validity' },
    { href: '/fleet', label: 'Armada' },
    { href: '/audit', label: 'Riwayat' },
    ...(isAdmin ? [{ href: '/admin', label: pending > 0 ? `Persetujuan (${pending})` : 'Persetujuan' }] : []),
  ];
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-base font-extrabold tracking-tight text-slate-900">
          RDK <span className="font-medium text-slate-500">/ Class &amp; Technical</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {nav.map((n) => {
            const on = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={on ? 'rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white' : 'rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100'}
              >
                {n.label}
              </Link>
            );
          })}
          {!configured ? (
            <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Mode demo</span>
          ) : user ? (
            <>
              {!approved && <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Menunggu persetujuan</span>}
              <button onClick={() => signOut()} className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Keluar ({user.email})
              </button>
            </>
          ) : (
            <Link href="/login" className="ml-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
              Masuk
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
