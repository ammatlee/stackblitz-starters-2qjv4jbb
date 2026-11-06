'use client';

import React, { useState } from 'react';

type Props = {
  /** tag dipisah koma (format yang disimpan di form) */
  value: string;
  onChange: (v: string) => void;
  /** semua tag yang pernah dipakai, urut dari yang paling sering */
  suggestions?: string[];
};

const parse = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

/** Isian tag berbentuk chip: Enter atau koma menambah, Backspace di kolom kosong menghapus yang terakhir. */
export default function TagInput({ value, onChange, suggestions = [] }: Props) {
  const [text, setText] = useState('');
  const tags = parse(value);
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

  const add = (raw: string) => {
    const next = [...tags];
    raw.split(',').forEach((p) => {
      const t = p.trim().replace(/^#/, '');
      if (t && !next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t);
    });
    onChange(next.join(', '));
    setText('');
  };
  const drop = (t: string) => onChange(tags.filter((x) => x !== t).join(', '));

  const q = text.trim().toLowerCase();
  const hints = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q))).slice(0, 8);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/25">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
            #{t}
            <button type="button" onClick={() => drop(t)} aria-label={'Hapus tag ' + t} className="text-teal-700 hover:text-red-700">×</button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => (e.target.value.indexOf(',') >= 0 ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && !text && tags.length) drop(tags[tags.length - 1]);
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={tags.length ? '' : 'mis. anniversary, annual in advance'}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm focus:outline-none focus:ring-0"
        />
      </div>
      {hints.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Sudah pernah dipakai:</span>
          {hints.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-slate-300 px-2.5 py-0.5 font-semibold text-slate-600 hover:border-teal-500 hover:text-teal-800">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
