'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

export default function LoginPage() {
  const { signIn, signUp, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const r = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: r.error });
    if (r.info) return setMsg({ kind: 'ok', text: r.info });
    router.push('/');
  };
  const cls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{mode === 'in' ? 'Masuk' : 'Daftar'}</h1>
        {!configured && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Supabase belum dikonfigurasi. Periksa file .env.local.</p>}
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Email
            <input type="email" className={cls + ' mt-1'} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Password (minimal 6 karakter)
            <input type="password" className={cls + ' mt-1'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
        </div>
        {msg && <p className={'mt-3 text-sm ' + (msg.kind === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.text}</p>}
        <button disabled={busy || !email || !password} onClick={submit} className="mt-5 w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : 'Daftar'}
        </button>
        <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }} className="mt-3 w-full text-center text-xs font-semibold text-teal-700 underline">
          {mode === 'in' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </div>
    </main>
  );
}