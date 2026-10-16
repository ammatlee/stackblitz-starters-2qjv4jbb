'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  configured: false,
  approved: false,
  isAdmin: false,
  signIn: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
  signUp: async () => ({ error: 'Supabase belum dikonfigurasi.' }),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // status persetujuan: admin otomatis disetujui; anggota lain menunggu persetujuan admin
  const uid = user?.id;
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase || !uid) {
        setApproved(false);
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setChecking(true);
      const a = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
      const adm = !!a.data;
      let ok = adm;
      if (!adm) {
        const p = await supabase.from('profiles').select('approved').eq('user_id', uid).maybeSingle();
        ok = !!(p.data as { approved: boolean } | null)?.approved;
      }
      if (!alive) return;
      setIsAdmin(adm);
      setApproved(ok);
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

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

  return (
    <AuthCtx.Provider value={{ user, loading: sessionLoading || checking, configured: isConfigured, approved, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
