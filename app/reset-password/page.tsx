'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

/** Halaman tujuan tautan "Lupa password" dari email. Supabase otomatis membuat sesi sementara dari tautan itu. */
export default function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 6) return setMsg({ kind: 'err', text: 'Password minimal 6 karakter.' });
    if (pw !== pw2) return setMsg({ kind: 'err', text: 'Kedua password tidak sama.' });
    setBusy(true);
    setMsg(null);
    const r = await updatePassword(pw);
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: r.error });
    setMsg({ kind: 'ok', text: 'Password berhasil diganti. Mengalihkan…' });
    setTimeout(() => router.push('/'), 1200);
  };
  const cls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

  if (loading) return <p className="p-10 text-center text-sm text-slate-500">Memuat…</p>;
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Atur ulang password</h1>
        {!user ? (
          <>
            <p className="mt-3 text-sm text-slate-600">Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru lewat “Lupa password?”.</p>
            <Link href="/login" className="mt-4 inline-block rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700">Ke halaman Masuk</Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-slate-500">{user.email}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                Password baru (minimal 6 karakter)
                <input type="password" className={cls + ' mt-1'} value={pw} onChange={(e) => setPw(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Ulangi password baru
                <input type="password" className={cls + ' mt-1'} value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
              </label>
            </div>
            {msg && <p className={'mt-3 text-sm ' + (msg.kind === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.text}</p>}
            <button disabled={busy || !pw || !pw2} onClick={submit} className="mt-5 w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? 'Menyimpan…' : 'Simpan password baru'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
