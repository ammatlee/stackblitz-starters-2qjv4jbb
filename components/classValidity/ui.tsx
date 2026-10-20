import React from 'react';
import DateInput from '../DateInput';
import { cx } from '../../lib/classValidity/dateUtils';
import { RESULTS } from '../../lib/classValidity/surveyRules';

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}
export function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {right}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
export function Fold({ title, sub, right, children, open, noPrint }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; open?: boolean; noPrint?: boolean }) {
  return (
    <details open={open} className={cx('group rounded-2xl border border-slate-200 bg-white shadow-sm', noPrint && 'print:hidden')}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        <div className="flex items-center gap-3">
          {right}
          <span className="text-xs text-slate-400 transition group-open:rotate-180">▼</span>
        </div>
      </summary>
      <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>
    </details>
  );
}
export const BADGE: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  COMPLIANT: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  OPEN: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  SUSPENDED: 'bg-amber-100 text-amber-900 ring-amber-600/30',
  WITHDRAWN: 'bg-red-100 text-red-800 ring-red-600/20',
  'NON-COMPLIANT': 'bg-red-100 text-red-800 ring-red-600/20',
};
export function Badge({ v, big }: { v: string; big?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        big ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-[11px]',
        BADGE[v] ?? 'bg-slate-100 text-slate-600 ring-slate-400/20'
      )}
    >
      {v}
    </span>
  );
}
export function Progress({ done, total, def }: { done: number; total: number; def: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-teal-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <span className="tabular-nums text-slate-600">{done}/{total}</span>
      {def > 0 && <Badge v="NON-COMPLIANT" />}
    </div>
  );
}
export function CheckRow({ title, desc, meta, chip, value, onChange }: { title: string; desc?: string; meta?: string; chip?: string; value: string; onChange: (v: string) => void }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="sm:max-w-[72%]">
        <p className="text-sm font-semibold">
          {title}
          {chip && <span className="ml-2 rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">{chip}</span>}
        </p>
        {desc && <p className="text-xs leading-relaxed text-slate-600">{desc}</p>}
        {meta && <p className="mt-0.5 text-[11px] text-slate-500">{meta}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'rounded-md border px-2 py-1 text-xs font-semibold',
          value === 'SATISFACTORY' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : value === 'DEFICIENCY' ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-white'
        )}
      >
        {RESULTS.filter((r) => r !== 'N/A').map((r) => <option key={r}>{r}</option>)}
      </select>
    </li>
  );
}
export function Gauge({ lo, hi, a }: { lo: number | null; hi: number | null; a: number | null }) {
  if (hi === null) return null;
  const max = hi * 1.5;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="relative mt-2 h-2.5 rounded-full bg-red-100">
      <div className="absolute h-full rounded-full bg-emerald-300" style={{ left: pct(lo ?? 0), width: `${((hi - (lo ?? 0)) / max) * 100}%` }} />
      {a !== null && <div className="absolute -top-1 w-1 rounded bg-slate-900" style={{ left: pct(a), height: '1.125rem' }} />}
    </div>
  );
}
export const dateIn = (v: string, set: (s: string) => void) => <DateInput className={inputCls} value={v} onChange={set} />;
