'use client';

import React, { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const st = () => setStale(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('rdk-stale', st);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('rdk-stale', st);
    };
  }, []);

  if (online && !stale) return null;

  const base = 'fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-50 px-4 py-2 text-center text-xs font-medium shadow-lg md:bottom-0 ';

  if (!online) {
    return (
      <div className={base + 'bg-amber-500 text-white'} role="status">
        Tanpa sinyal — data yang tampil adalah salinan terakhir di HP. Menyimpan perubahan butuh sinyal.
      </div>
    );
  }
  return (
    <div className={base + 'bg-sky-600 text-white'} role="status">
      Data yang tampil adalah salinan lama.{' '}
      <button type="button" onClick={() => window.location.reload()} className="ml-1 rounded bg-white/90 px-2 py-0.5 font-semibold text-sky-700">
        Muat ulang
      </button>
    </div>
  );
}