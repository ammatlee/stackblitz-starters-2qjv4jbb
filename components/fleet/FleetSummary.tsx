'use client';

import React from 'react';
import Link from 'next/link';
import { countFleet, daysLabel, dmy } from '../../lib/fleet';
import type { Urgency } from '../../lib/fleet';
import { Button, Notice, Skeleton } from '../Controls';
import { useFleetItems } from './useFleetItems';

const URG_TEXT: Record<Urgency, string> = {
  OVERDUE: 'text-red-700',
  'DALAM WINDOW': 'text-amber-800',
  'AKAN DATANG': 'text-slate-600',
};

function StatLink({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <Link href="/fleet" className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400">
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-xs font-medium text-slate-600">{label}</p>
    </Link>
  );
}

/** Ringkasan armada untuk beranda: jumlah kapal mendesak dan tiga survei terdekat. */
export default function FleetSummary() {
  const { items, err, busy, load } = useFleetItems();

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-label="Ringkasan armada">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900">Ringkasan armada</h2>
        <Link href="/fleet" className="text-xs font-semibold text-teal-700 hover:underline">
          Buka dashboard →
        </Link>
      </div>

      {err ? (
        <Notice tone="warn" size="xs" className="mt-3">
          <p>Ringkasan belum bisa dimuat.</p>
          <Button size="sm" className="mt-2" onClick={load} disabled={busy}>
            Coba lagi
          </Button>
        </Notice>
      ) : items === null ? (
        <div role="status" aria-busy="true" className="mt-3 space-y-3">
          <span className="sr-only">Memuat ringkasan armada…</span>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Belum ada kapal. Tambahkan lewat Class Validity → Kapal baru.</p>
      ) : (
        (() => {
          const c = countFleet(items);
          const urgent = items.filter((i) => i.next).slice(0, 3);
          return (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <StatLink value={c.overdue} label="Ada survei OVERDUE" tone="text-red-700" />
                <StatLink value={c.d30} label="Jatuh tempo ≤ 30 hari" tone="text-amber-700" />
                <StatLink value={c.d90} label="Jatuh tempo ≤ 90 hari" tone="text-teal-700" />
              </div>
              {urgent.length > 0 ? (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">Paling mendesak</p>
                  <ul className="mt-1 divide-y divide-slate-200">
                    {urgent.map((it) => {
                      const n = it.next!;
                      return (
                        <li key={it.id}>
                          <Link href="/fleet" className="block py-2 hover:bg-white">
                            <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                            <p className="text-xs text-slate-600">
                              {n.kind} · batas {dmy(n.deadline)} · <span className={`font-semibold ${URG_TEXT[n.urgency]}`}>{daysLabel(n.days)}</span>
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Tidak ada survei yang menunggu.</p>
              )}
            </>
          );
        })()
      )}
    </section>
  );
}