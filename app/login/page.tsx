'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';

import { Button, Notice } from '../../components/Controls';
export default function LoginPage() {
  const { signIn, signUp, resetPassword, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const r = mode === 'in' ? await signIn(email.trim(), password) : mode === 'up' ? await signUp(email.trim(), password) : await resetPassword(email.trim());
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: r.error });
    if (r.info) return setMsg({ kind: 'ok', text: r.info });
    router.push('/');
  };
  const cls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{mode === 'in' ? 'Masuk' : mode === 'up' ? 'Daftar' : 'Lupa password'}</h1>
        {!configured && <Notice tone="warn" size="xs" className="mt-3">Supabase belum dikonfigurasi. Periksa file .env.local.</Notice>}
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Email
            <input type="email" className={cls + ' mt-1'} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'forgot' && (
          <label className="block text-xs font-semibold text-slate-600">
            Password (minimal 6 karakter)
            <input type="password" className={cls + ' mt-1'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          )}
        </div>
        {msg && <p className={'mt-3 text-sm ' + (msg.kind === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.text}</p>}
        <Button disabled={busy || !email || (mode !== 'forgot' && !password)} onClick={submit} variant="primary" className="mt-5 w-full">
          {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : mode === 'up' ? 'Daftar' : 'Kirim tautan atur ulang'}
        </Button>
        {mode === 'in' && (
          <button onClick={() => { setMode('forgot'); setMsg(null); }} className="mt-3 w-full text-center text-xs font-semibold text-teal-700 underline">
            Lupa password?
          </button>
        )}
        <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }} className="mt-3 w-full text-center text-xs font-semibold text-teal-700 underline">
          {mode === 'in' ? 'Belum punya akun? Daftar' : mode === 'up' ? 'Sudah punya akun? Masuk' : 'Kembali ke Masuk'}
        </button>
      </div>
    </main>
  );
}