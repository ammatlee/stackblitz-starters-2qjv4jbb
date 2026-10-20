'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

/** Kolom nama kapal: ketik untuk mencari atau ketuk daftar kapal tersimpan (bisa digulir). */
export default function VesselNameInput({ value, onChange, className, refreshKey }: { value: string; onChange: (v: string) => void; className?: string; refreshKey?: number }) {
  const { user } = useAuth();
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!supabase || !user) return;
      const { data } = await supabase.from('vessels').select('name').order('name');
      setNames(Array.from(new Set(((data ?? []) as { name: string }[]).map((x) => x.name))));
    })();
  }, [user, refreshKey]);

  useEffect(() => {
    const close = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, []);

  const q = value.trim().toLowerCase();
  const exact = names.some((n) => n.toLowerCase() === q);
  const list = q && !exact ? names.filter((n) => n.toLowerCase().includes(q)) : names; // nama sudah lengkap/kosong: tampilkan semua kapal

  return (
    <div ref={box} className="relative">
      <input
        className={className}
        autoComplete="off"
        placeholder="Ketik atau pilih kapal…"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && names.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {list.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Tidak ada kapal yang cocok. Nama baru dibuat saat disimpan.</li>
          ) : (
            list.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                >
                  {n}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
