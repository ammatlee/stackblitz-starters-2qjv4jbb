import React from 'react';

/* Komponen kontrol bersama: Button, Chip, Notice.
   Berdiri sendiri (tanpa impor berat) supaya aman dipakai di semua halaman, termasuk Login dan header. */
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'warn';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  warn: 'border border-amber-400 bg-white text-amber-900 hover:bg-amber-100',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm',
        BTN[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

/** Tombol pilihan (toggle) berbentuk pil; selected menandai pilihan aktif. */
export function Chip({
  selected,
  tone = 'teal',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; tone?: 'teal' | 'dark' }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={cx(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        selected
          ? tone === 'dark'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-teal-600 bg-teal-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500',
        className
      )}
    >
      {children}
    </button>
  );
}

type NoticeTone = 'info' | 'warn' | 'error' | 'success';
const NOTICE: Record<NoticeTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-red-300 bg-red-50 text-red-800',
  success: 'border-teal-200 bg-teal-50 text-teal-900',
};

/** Kotak informasi atau peringatan di dalam kartu. */
export function Notice({
  tone = 'info',
  size = 'sm',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: NoticeTone; size?: 'xs' | 'sm' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      {...rest}
      className={cx('rounded-xl border p-3', size === 'xs' ? 'text-xs' : 'text-sm', NOTICE[tone], className)}
    >
      {children}
    </div>
  );
}