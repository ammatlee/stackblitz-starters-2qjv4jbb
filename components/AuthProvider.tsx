'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../lib/supabase';

type Result = { error?: string; info?: string };
type Ctx = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  approved: boolean; // akun sudah disetujui admin
  isAdmin: boolean;
  recheck: () => Promise<void>; // periksa ulang status persetujuan (tanpa memuat ulang halaman)
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<Result>; // kirim email tautan atur ulang password
  updatePassword: (password: string) => Promise<Result>; // simpan password baru (setelah membuka tautan email)
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  configured: false,
  approved: false,
  isAdmin: false,
  recheck: async () => {},
  signIn: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
  signUp: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
  signOut: async () => {},
  resetPassword: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
  updatePassword: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
});

export const useAuth = () => useContext(AuthCtx);

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Sesi login disimpan Supabase di HP; dibaca hanya untuk tampilan saat tidak ada sinyal (data tetap dilindungi aturan database).
function storedUser(): User | null {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const v = JSON.parse(localStorage.getItem(k) || 'null') as { user?: User } | null;
        if (v && v.user && v.user.id) return v.user;
      }
    }
  } catch {
    /* abaikan */
  }
  return null;
}
const authKey = (id: string) => `rdk-auth-v1:${id}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // id akun yang status persetujuannya sudah selesai diperiksa; selama berbeda dari user.id, tampilan tetap "Memuat…"
  const [checkedUid, setCheckedUid] = useState<string | null>(null);
  const uidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? (isOffline() ? storedUser() : null));
      })
      .catch(() => {
        // gagal membaca sesi: jangan terjebak di "Memuat…"
        setUser(isOffline() ? storedUser() : null);
      })
      .finally(() => setSessionLoading(false));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event !== 'SIGNED_OUT' && isOffline()) return; // tanpa sinyal: pertahankan tampilan login
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // aplikasi offline (service worker): hanya di versi produksi agar tidak mengganggu saat mengedit
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // versi baru terpasang saat halaman masih terbuka: beri tahu pengguna (lihat OfflineBanner)
          reg.addEventListener('updatefound', () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener('statechange', () => {
              if (w.state === 'installed' && navigator.serviceWorker.controller) window.dispatchEvent(new Event('rdk-update'));
            });
          });
          // aplikasi yang dibiarkan terbuka berhari-hari (PWA) tetap memeriksa versi baru saat dibuka kembali
          const check = () => document.visibilityState === 'visible' && reg.update().catch(() => {});
          document.addEventListener('visibilitychange', check);
        })
        .catch(() => {});
    }
  }, []);

  // status persetujuan: admin otomatis disetujui; anggota lain menunggu persetujuan admin
  const uid = user?.id;
  uidRef.current = uid;
  const runCheck = useCallback(async (id: string) => {
    if (!supabase) return;
    let adm = false;
    let ok = false;
    let failed = false;
    try {
      const a = await supabase.from('admins').select('user_id').eq('user_id', id).maybeSingle();
      adm = !!a.data;
      ok = adm;
      if (!adm) {
        const p = await supabase.from('profiles').select('approved').eq('user_id', id).maybeSingle();
        ok = !!(p.data as { approved: boolean } | null)?.approved;
        failed = !!a.error && !!p.error;
      }
    } catch {
      failed = true;
    }
    if (failed) {
      // gagal menghubungi server (mis. tanpa sinyal): pakai status terakhir yang tersimpan di HP
      try {
        const c = JSON.parse(localStorage.getItem(authKey(id)) || 'null') as { adm: boolean; ok: boolean } | null;
        if (c) {
          adm = !!c.adm;
          ok = !!c.ok;
        }
      } catch {
        /* abaikan */
      }
    } else {
      try {
        localStorage.setItem(authKey(id), JSON.stringify({ adm, ok, at: Date.now() }));
      } catch {
        /* abaikan */
      }
    }
    if (uidRef.current !== id) return; // akun sudah berganti saat menunggu server: abaikan hasil lama
    setIsAdmin(adm);
    setApproved(ok);
    setCheckedUid(id);
  }, []);

  useEffect(() => {
    if (!supabase || !uid) {
      setApproved(false);
      setIsAdmin(false);
      setCheckedUid(null);
      return;
    }
    runCheck(uid);
  }, [uid, runCheck]);

  const recheck = useCallback(async () => {
    if (uid) await runCheck(uid);
  }, [uid, runCheck]);

  // true sejak ada akun sampai pemeriksaan persetujuannya selesai (dihitung saat render, jadi tidak ada kedipan "Menunggu persetujuan")
  const checking = !!supabase && !!user && checkedUid !== user.id;

  const signIn = async (email: string, password: string): Promise<Result> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };
  const signUp = async (email: string, password: string): Promise<Result> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (error) return { error: error.message };
    return data.session
      ? { info: 'Akun dibuat. Akun perlu disetujui admin sebelum bisa dipakai.' }
      : { info: 'Akun dibuat. Konfirmasi email Anda, lalu tunggu persetujuan admin sebelum bisa dipakai.' };
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };
  const resetPassword = async (email: string): Promise<Result> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + '/reset-password' : undefined,
    });
    return error ? { error: error.message } : { info: 'Jika email terdaftar, tautan atur ulang password sudah dikirim. Cek inbox (dan folder spam).' };
  };
  const updatePassword = async (password: string): Promise<Result> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.' };
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: error.message } : { info: 'Password berhasil diganti.' };
  };

  return (
    <AuthCtx.Provider value={{ user, loading: sessionLoading || checking, configured: isConfigured, approved, isAdmin, recheck, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthCtx.Provider>
  );
}
