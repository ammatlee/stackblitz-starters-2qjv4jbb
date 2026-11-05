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
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const r = mode === 'in' ? await signIn(email.trim(), password) : mode === 'up' ? await signUp(email.trim(), password) : await resetPassword(email.trim());
    setBusy(false);
    if (r.error) return setMsg({ kind: 'err', text: r.error });
    if (r.info) return setMsg({ kind: 'ok', text: r.info });
    router.push('/');
  };
  const canSubmit = !busy && !!email && (mode === 'forgot' || !!password);
  const cls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">{mode === 'in' ? 'Masuk' : mode === 'up' ? 'Daftar' : 'Lupa password'}</h1>
        {!configured && <Notice tone="warn" size="xs" className="mt-3">Supabase belum dikonfigurasi. Periksa file .env.local.</Notice>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
        >
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Email
              <input type="email" autoComplete="email" inputMode="email" className={cls + ' mt-1'} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode !== 'forgot' && (
              <label className="block text-xs font-semibold text-slate-600">
                Password (minimal 6 karakter)
                <div className="relative mt-1">
                  <input
                    type={showPw ? 'text' : 'password'}
                    autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                    className={cls + ' pr-24'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-pressed={showPw}
                    className="absolute inset-y-0 right-1 rounded-md px-3 text-xs font-semibold text-teal-700 hover:bg-slate-50"
                  >
                    {showPw ? 'Sembunyikan' : 'Tampilkan'}
                  </button>
                </div>
              </label>
            )}
          </div>
          {msg && (
            <Notice tone={msg.kind === 'err' ? 'error' : 'success'} className="mt-3" role={msg.kind === 'err' ? 'alert' : 'status'}>
              {msg.text}
            </Notice>
          )}
          <Button type="submit" disabled={!canSubmit} variant="primary" className="mt-5 w-full">
            {busy ? 'Memproses…' : mode === 'in' ? 'Masuk' : mode === 'up' ? 'Daftar' : 'Kirim tautan atur ulang'}
          </Button>
        </form>
        {mode === 'in' && (
          <button type="button" onClick={() => { setMode('forgot'); setMsg(null); }} className="mt-3 w-full text-center text-xs font-semibold text-teal-700 underline">
            Lupa password?
          </button>
        )}
        <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }} className="mt-3 w-full text-center text-xs font-semibold text-teal-700 underline">
          {mode === 'in' ? 'Belum punya akun? Daftar' : mode === 'up' ? 'Sudah punya akun? Masuk' : 'Kembali ke Masuk'}
        </button>
      </div>
    </main>
  );
}