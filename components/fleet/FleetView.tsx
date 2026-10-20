'use client';

import React, { useMemo, useState } from 'react';
import { countFleet, daysLabel, dmy, matchesFilter } from '../../lib/fleet';
import type { FleetFilter, FleetItem, Pending, Urgency } from '../../lib/fleet';

const URG: Record<Urgency, { badge: string; text: string; label: string }> = {
  OVERDUE: { badge: 'bg-red-100 text-red-800', text: 'text-red-700', label: 'OVERDUE' },
  'DALAM WINDOW': { badge: 'bg-amber-100 text-amber-900', text: 'text-amber-800', label: 'DALAM WINDOW' },
  'AKAN DATANG': { badge: 'bg-slate-100 text-slate-700', text: 'text-slate-600', label: 'AKAN DATANG' },
};

function Tile({ on, onClick, value, label, tone }: { on: boolean; onClick: () => void; value: number; label: string; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-2xl border p-3 text-left shadow-sm transition ${on ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200 hover:border-slate-400'} bg-white`}
    >
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </button>
  );
}

function PendingLine({ p }: { p: Pending }) {
  const u = URG[p.urgency];
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
      <span className="font-medium text-slate-800">{p.kind}</span>
      <span className="text-xs text-slate-600">
        {p.windowStart && p.urgency === 'AKAN DATANG' ? `mulai ${dmy(p.windowStart)} · ` : ''}batas {dmy(p.deadline)} · <span className={`font-semibold ${u.text}`}>{daysLabel(p.days)}</span>
      </span>
    </li>
  );
}

export default function FleetView({ items, owners }: { items: FleetItem[]; owners?: Record<string, string> }) {
  const [filter, setFilter] = useState<FleetFilter>('all');
  const [q, setQ] = useState('');
  const counts = useMemo(() => countFleet(items), [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => matchesFilter(i, filter) && (!s || i.name.toLowerCase().includes(s) || i.type.toLowerCase().includes(s) || (owners?.[i.owner] ?? '').toLowerCase().includes(s)));
  }, [items, filter, q, owners]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile on={filter === 'all'} onClick={() => setFilter('all')} value={counts.total} label="Semua kapal" tone="text-slate-900" />
        <Tile on={filter === 'overdue'} onClick={() => setFilter('overdue')} value={counts.overdue} label="Ada survei OVERDUE" tone="text-red-700" />
        <Tile on={filter === 'd30'} onClick={() => setFilter('d30')} value={counts.d30} label="Jatuh tempo ≤ 30 hari" tone="text-amber-700" />
        <Tile on={filter === 'd90'} onClick={() => setFilter('d90')} value={counts.d90} label="Jatuh tempo ≤ 90 hari" tone="text-teal-700" />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={owners ? 'Cari nama, jenis kapal, atau pemilik…' : 'Cari nama atau jenis kapal…'}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
      />

      {shown.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {items.length === 0 ? 'Belum ada kapal. Tambahkan lewat menu Class Validity → Kapal baru.' : 'Tidak ada kapal yang cocok dengan filter ini.'}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((it) => {
          const n = it.next;
          const u = n ? URG[n.urgency] : null;
          return (
            <li key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-slate-900">{it.name}</p>
                  <p className="text-xs text-slate-500">
                    {it.type || 'Jenis belum diisi'}
                    {it.expiry ? ` · sertifikat s/d ${dmy(it.expiry)}` : ''}
                  </p>
                  {owners && it.owner && <p className="text-xs text-slate-400">Pemilik: {owners[it.owner] ?? 'akun lain'}</p>}
                </div>
                {u && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.badge}`}>{u.label}</span>}
              </div>

              {n ? (
                <>
                  <p className="mt-3 text-sm text-slate-800">
                    <span className="font-semibold">{n.kind}</span> · batas {dmy(n.deadline)} ·{' '}
                    <span className={`font-semibold ${u!.text}`}>{daysLabel(n.days)}</span>
                  </p>
                  {it.pending.length > 1 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-teal-700">Semua survei berjalan ({it.pending.length})</summary>
                      <ul className="mt-1 divide-y divide-slate-100">
                        {it.pending.map((p) => (
                          <PendingLine key={p.kind} p={p} />
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{it.expiry ? 'Tidak ada survei yang menunggu.' : 'Tanggal sertifikat belum diisi. Lengkapi lewat Class Validity → Edit data kapal.'}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
