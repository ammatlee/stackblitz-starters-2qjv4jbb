'use client';

import React, { useEffect, useState } from 'react';

const toText = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : '');
const parseText = (t: string): string | null => {
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/** Input tanggal berformat dd.mm.yyyy (menyimpan nilai ISO yyyy-mm-dd). */
export default function DateInput({ value, onChange, className }: { value: string; onChange: (iso: string) => void; className?: string }) {
  const [text, setText] = useState(toText(value));

  useEffect(() => {
    // sinkron bila nilai berubah dari luar (mis. membuka agenda tersimpan)
    if (value !== (parseText(text) ?? '')) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(out);
    if (out === '') onChange('');
    else {
      const iso = parseText(out);
      if (iso) onChange(iso);
    }
  };
  const invalid = text.length === 10 && parseText(text) === null;

  return (
    <input
      inputMode="numeric"
      maxLength={10}
      placeholder="dd.mm.yyyy"
      className={(className ?? '') + (invalid ? ' border-red-500' : '')}
      value={text}
      onChange={(e) => handle(e.target.value)}
    />
  );
}
