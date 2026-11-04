'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

/** Penjaga error tingkat halaman: satu kesalahan di sebuah halaman tidak lagi membuat layar putih. Header dan menu tetap tampil. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Terjadi kesalahan di halaman ini</h1>
        <p className="mt-2 text-sm text-slate-600">
          Data Anda di server tidak berubah. Pada Class Validity, isian form tersimpan otomatis sebagai draf di perangkat ini dan akan dipulihkan saat halaman dibuka lagi.
        </p>
        {error.message && <p className="mt-3 break-words rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">{error.message}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Coba lagi
          </button>
          <button onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Muat ulang
          </button>
          <Link href="/" className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ke menu
          </Link>
        </div>
      </div>
    </main>
  );
}
