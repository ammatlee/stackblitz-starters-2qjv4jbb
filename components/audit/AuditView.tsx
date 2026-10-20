'use client';

import React, { useMemo, useState } from 'react';
import { describeAudit, fmtWhen } from '../../lib/audit';
import type { AuditRow } from '../../lib/audit';

const OP_TONE: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-amber-100 text-amber-900',
  DELETE: 'bg-red-100 text-red-800',
};
const OP_LABEL: Record<string, string> = { INSERT: 'BARU', UPDATE: 'DIUBAH', DELETE: 'DIHAPUS' };

export default function AuditView({ rows, vesselFilterName }: { rows: AuditRow[]; vesselFilterName?: string }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'vessels' | 'vessel_events'>('all');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (kind === 'all' || r.tbl === kind) && (!s || (r.vessel_name ?? '').toLowerCase().includes(s) || (r.actor_email ?? '').toLowerCase().includes(s)));
  }, [rows, q, kind]);

  const chip = (k: typeof kind, label: string) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      aria-pressed={kind === k}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {vesselFilterName && <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900">Menampilkan riwayat untuk kapal: <b>{vesselFilterName}</b></p>}
      <div className="flex flex-wrap gap-2">
        {chip('all', 'Semua')}
        {chip('vessels', 'Data kapal')}
        {chip('vessel_events', 'Pembaruan manual')}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama kapal atau email pelaku…"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
      />

      {shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {rows.length === 0 ? 'Belum ada perubahan tercatat. Riwayat mulai terisi setelah SQL 04 dijalankan dan data diubah.' : 'Tidak ada catatan yang cocok.'}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((r) => {
          const d = describeAudit(r);
          return (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{r.vessel_name ?? '(kapal tidak diketahui)'}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${OP_TONE[r.op] ?? 'bg-slate-100 text-slate-700'}`}>{OP_LABEL[r.op] ?? r.op}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtWhen(r.at)} · {r.actor_email ?? 'sistem / SQL Editor'}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-800">{d.title}</p>
              {d.lines.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                  {d.lines.map((l, i) => (
                    <li key={i}>
                      <span className="text-slate-500">{l.label}:</span>{' '}
                      {l.from !== undefined ? (
                        <>
                          <span className="text-red-700 line-through decoration-red-300">{l.from}</span> <span aria-hidden>→</span> <span className="font-semibold text-emerald-800">{l.to}</span>
                        </>
                      ) : (
                        <span className="font-medium">{l.to}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
