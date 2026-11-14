'use client';

import React, { useEffect, useState } from 'react';

/** Kelas bersama untuk kolom isian di layar Bangunan Baru. */
export const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

/** Kolom isian yang menyimpan saat kehilangan fokus, dan hanya bila isinya berubah. */
export function BlurInput({
  value,
  placeholder,
  disabled,
  onSave,
  inputMode,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onSave: (v: string) => void;
  inputMode?: 'decimal' | 'numeric';
}) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder={placeholder}
      inputMode={inputMode}
      value={t}
      disabled={disabled}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}
