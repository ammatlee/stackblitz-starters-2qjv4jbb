import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Class &amp; Technical</p>
      <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Pilih menu</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/class-validity" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-500">
          <h2 className="text-lg font-bold text-slate-900">Class Validity</h2>
          <p className="mt-1 text-sm text-slate-600">Status kelas, jendela waktu survei, reinstatement, scope &amp; checklist.</p>
        </Link>
        <Link href="/bulletin" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-500">
          <h2 className="text-lg font-bold text-slate-900">Bulletin &amp; Artikel</h2>
          <p className="mt-1 text-sm text-slate-600">Catatan, materi, dan pengingat.</p>
        </Link>
      </div>
    </main>
  );
}