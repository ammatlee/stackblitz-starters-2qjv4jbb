'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Penampil file di dalam web (tanpa unduhan): PDF dan gambar.
// pdf.js dimuat dari CDN saat dibutuhkan, jadi tidak perlu memasang paket baru.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

let loader: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Hanya bisa dijalankan di peramban.'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!loader) {
    loader = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) {
          loader = null;
          rej(new Error('Pustaka PDF gagal dimuat.'));
          return;
        }
        lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
        res(lib);
      };
      s.onerror = () => {
        loader = null;
        rej(new Error('Pustaka PDF gagal dimuat. Periksa koneksi internet.'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

// pola watermark (nama + waktu) yang berulang menutupi halaman
function wmStyle(label: string): React.CSSProperties {
  const t = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="440" height="220">' +
    '<text x="30" y="120" transform="rotate(-25 220 110)" font-family="Arial,sans-serif" font-size="14" fill="rgba(70,70,70,0.17)">' +
    t +
    '</text></svg>';
  return {
    backgroundImage: 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")',
    backgroundRepeat: 'repeat',
  };
}

// lapisan transparan: menahan tekan-lama / klik kanan di atas halaman dan menampilkan watermark
function Shield({ label }: { label: string }) {
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'absolute', inset: 0, userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', ...wmStyle(label) } as React.CSSProperties}
    />
  );
}

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2, 3];

function PdfPage({ pdf, num, baseW, zoom, label }: { pdf: any; num: number; baseW: number; zoom: number; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [seen, setSeen] = useState(false);
  const cssW = Math.max(100, baseW * zoom);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (ents) => {
        if (ents.some((x) => x.isIntersecting)) setSeen(true);
      },
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || !pdf) return;
    let task: any = null;
    let dead = false;
    (async () => {
      const page = await pdf.getPage(num);
      const base = page.getViewport({ scale: 1 });
      if (dead) return;
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.min(cssW * dpr, 2400);
      const vp = page.getViewport({ scale: px / base.width });
      const c = cv.current;
      if (!c) return;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
    })().catch(() => {});
    return () => {
      dead = true;
      try {
        task && task.cancel();
      } catch {
        /* abaikan */
      }
    };
  }, [seen, pdf, num, cssW]);

  return (
    <div ref={wrap} data-page={num} style={{ position: 'relative', width: cssW, height: cssW * ratio, background: '#fff', flex: '0 0 auto' }} className="shadow-lg">
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} />
      <Shield label={label} />
    </div>
  );
}

type Props = {
  url: string;
  name: string;
  type?: string; // mis. application/pdf atau image/jpeg
  label?: string; // teks watermark, mis. email + waktu
  onClose: () => void;
};

export default function FileViewer({ url, name, type, label, onClose }: Props) {
  const lower = (name || '').toLowerCase();
  const isPdf = /pdf/i.test(type || '') || lower.endsWith('.pdf');
  const isImg = /^image\//i.test(type || '') || /\.(jpe?g|png|webp|gif)$/.test(lower);
  const wm = label || 'RDK';

  const box = useRef<HTMLDivElement>(null);
  const [baseW, setBaseW] = useState(320);
  const [zoom, setZoom] = useState(1);
  const [pdf, setPdf] = useState<any>(null);
  const [pages, setPages] = useState(0);
  const [cur, setCur] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(isPdf);

  // kunci gulir halaman di belakang, tutup dengan Esc
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // lebar dasar halaman = lebar layar
  useEffect(() => {
    const measure = () => {
      const w = box.current ? box.current.clientWidth : window.innerWidth;
      setBaseW(Math.max(200, Math.min(w - 24, 900)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // muat PDF
  useEffect(() => {
    if (!isPdf) return;
    let dead = false;
    let doc: any = null;
    (async () => {
      setBusy(true);
      setErr('');
      const lib = await loadPdfJs();
      const r = await fetch(url);
      if (!r.ok) throw new Error('File tidak bisa dibuka (kode ' + r.status + ').');
      const data = await r.arrayBuffer();
      doc = await lib.getDocument({ data }).promise;
      if (dead) return;
      setPdf(doc);
      setPages(doc.numPages);
      setBusy(false);
    })().catch((e) => {
      if (!dead) {
        setErr(e && e.message ? e.message : 'Dokumen gagal dibuka.');
        setBusy(false);
      }
    });
    return () => {
      dead = true;
      try {
        doc && doc.destroy();
      } catch {
        /* abaikan */
      }
    };
  }, [url, isPdf]);

  // nomor halaman saat menggulir
  const onScroll = useCallback(() => {
    const b = box.current;
    if (!b || !isPdf) return;
    const mid = b.scrollTop + b.clientHeight / 3;
    const kids = b.querySelectorAll<HTMLElement>('[data-page]');
    let n = 1;
    kids.forEach((k) => {
      if (k.offsetTop <= mid) n = Number(k.dataset.page) || n;
    });
    setCur(n);
  }, [isPdf]);

  const zi = ZOOMS.findIndex((z) => z === zoom);
  const zoomOut = () => setZoom(ZOOMS[Math.max(0, zi - 1)]);
  const zoomIn = () => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)]);

  const btn = 'flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-lg font-bold text-white active:bg-slate-700 disabled:opacity-40';

  return (
    <div className="fv-root fixed inset-0 z-[100] flex flex-col bg-slate-900" onContextMenu={(e) => e.preventDefault()}>
      <style>{'@media print{.fv-root{display:none!important}}'}</style>
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2">
        <button onClick={onClose} className={btn} aria-label="Kembali">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          {isPdf && pages > 0 && <p className="text-[11px] text-slate-400">Halaman {cur} / {pages}</p>}
        </div>
        <button onClick={zoomOut} disabled={zi <= 0} className={btn} aria-label="Perkecil">
          −
        </button>
        <span className="w-11 text-center text-xs font-semibold text-slate-200">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} disabled={zi >= ZOOMS.length - 1} className={btn} aria-label="Perbesar">
          +
        </button>
      </div>

      <div ref={box} onScroll={onScroll} className="flex-1 overflow-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {busy && <p className="p-6 text-center text-sm text-slate-300">Memuat dokumen…</p>}
        {err && <p className="m-4 rounded-xl bg-rose-950 p-4 text-sm text-rose-200">{err}</p>}
        {!isPdf && !isImg && (
          <p className="m-4 rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
            Jenis file ini belum bisa ditampilkan di sini. Unggah versi PDF atau gambar agar bisa dibuka di penampil.
          </p>
        )}
        {isPdf && pdf && (
          <div className="flex flex-col items-center gap-3 p-3" style={{ width: Math.max(baseW * zoom + 24, box.current ? box.current.clientWidth : 0) }}>
            {Array.from({ length: pages }, (_, i) => (
              <PdfPage key={i + 1} pdf={pdf} num={i + 1} baseW={baseW} zoom={zoom} label={wm} />
            ))}
          </div>
        )}
        {isImg && (
          <div className="flex flex-col items-center p-3" style={{ width: Math.max(baseW * zoom + 24, box.current ? box.current.clientWidth : 0) }}>
            <div style={{ position: 'relative', width: baseW * zoom }} className="shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} draggable={false} style={{ width: '100%', display: 'block', background: '#fff' }} />
              <Shield label={wm} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
