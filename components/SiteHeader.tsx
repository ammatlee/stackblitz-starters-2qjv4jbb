'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { Button } from './Controls';

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ikon garis sederhana untuk navigasi bawah di HP
const ICON = {
  home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  bars: 'M5 20V10M12 20V4M19 20v-7',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  user: 'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
};
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

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
    { href: '/', label: 'Menu Utama', short: 'Menu', icon: ICON.home },
    { href: '/bulletin', label: 'Bulletin', short: 'Bulletin', icon: ICON.doc },
    { href: '/class-validity', label: 'Class Validity', short: 'Validity', icon: ICON.shield },
    { href: '/fleet', label: 'Armada', short: 'Armada', icon: ICON.bars },
    { href: '/audit', label: 'Riwayat', short: 'Riwayat', icon: ICON.clock },
    ...(isAdmin ? [{ href: '/admin', label: pending > 0 ? `Persetujuan (${pending})` : 'Persetujuan', short: 'Admin', icon: ICON.user, badge: pending }] : []),
  ];
  const isOn = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className="text-base font-extrabold tracking-tight text-slate-900">
            RDK <span className="hidden font-medium text-slate-600 sm:inline">/ Class &amp; Technical</span>
          </Link>
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {/* menu atas: layar lebar. Di HP menu pindah ke bilah bawah. */}
            <nav className="hidden flex-wrap items-center gap-1 md:flex" aria-label="Menu utama">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={isOn(n.href) ? 'page' : undefined}
                  className={isOn(n.href) ? 'rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white' : 'rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100'}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            {!configured ? (
              <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Mode demo</span>
            ) : user ? (
              <>
                {!approved && <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Menunggu persetujuan</span>}
                <Button onClick={() => signOut()} title={user.email ?? undefined} size="sm" className="ml-2">
                  Keluar<span className="hidden md:inline"> ({user.email})</span>
                </Button>
              </>
            ) : (
              <Link href="/login" className="ml-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* bilah navigasi bawah (HP) */}
      <nav
        aria-label="Menu utama"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {nav.map((n) => {
          const on = isOn(n.href);
          const badge = 'badge' in n ? n.badge : 0;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? 'page' : undefined}
              className={cx('relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold', on ? 'text-teal-700' : 'text-slate-600')}
            >
              {on && <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-teal-600" />}
              <span className="relative">
                <Icon d={n.icon} />
                {badge ? <span className="absolute -right-2.5 -top-1.5 min-w-[1rem] rounded-full bg-red-600 px-1 text-center text-xs leading-4 text-white">{badge}</span> : null}
              </span>
              {n.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}