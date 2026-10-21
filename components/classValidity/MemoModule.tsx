import React, { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Card, Field, inputCls } from './ui';
import { cx } from '../../lib/classValidity/dateUtils';
import { buildMemo, dateLong, memoHtml, memoSubject, memoText, resolveMemo } from '../../lib/memo';
import type { MemoCtx, MemoItem, MemoState } from '../../lib/memo';
import { useAuth } from '../AuthProvider';

type Pair = { o: string; a: string };
type Props = {
  ctx: MemoCtx;
  memo: MemoState;
  setMemo: Dispatch<SetStateAction<MemoState>>;
  ownerDefault: string; // Pemilik/Pemohon dari tab Laporan
  surveyorDefault: string; // nama surveyor dari kunjungan
  anchor: Pair;
  setAnchor: Dispatch<SetStateAction<Pair>>;
  chain: Pair;
  setChain: Dispatch<SetStateAction<Pair>>;
};

const todayISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/** MODUL 5 — Memorandum awal survei untuk owner: daftar item dibuat otomatis dari data survei, bisa diedit, lalu diunduh / disalin / dikirim lewat email sendiri. */
export default function MemoModule({ ctx, memo, setMemo, ownerDefault, surveyorDefault, anchor, setAnchor, chain, setChain }: Props) {
  const { user } = useAuth();
  const [msg, setMsg] = useState('');
  const savedName = String((user?.user_metadata as Record<string, unknown> | undefined)?.surveyor_name ?? '');
  const eff: MemoState = { ...memo, to: memo.to || ownerDefault, surveyor: memo.surveyor || savedName || surveyorDefault, date: memo.date || todayISO() };
  const secs = useMemo(() => buildMemo(ctx), [ctx]);
  const resolved = resolveMemo(secs, eff);
  const text = memoText(ctx, eff, resolved);
  const subject = memoSubject(ctx);

  const setF = (k: keyof MemoState, v: string) => setMemo((m) => ({ ...m, [k]: v }));
  const toggle = (id: string) => setMemo((m) => ({ ...m, off: { ...m.off, [id]: !m.off[id] } }));
  const edit = (id: string, v: string) => setMemo((m) => ({ ...m, text: { ...m.text, [id]: v } }));
  const addExtra = (sid: string) => setMemo((m) => ({ ...m, extra: { ...m.extra, [sid]: [...(m.extra[sid] ?? []), ''] } }));
  const editExtra = (sid: string, i: number, v: string) => setMemo((m) => ({ ...m, extra: { ...m.extra, [sid]: (m.extra[sid] ?? []).map((x, j) => (j === i ? v : x)) } }));
  const delExtra = (sid: string, i: number) => setMemo((m) => ({ ...m, extra: { ...m.extra, [sid]: (m.extra[sid] ?? []).filter((_, j) => j !== i) } }));
  const resetEdits = () => setMemo((m) => ({ ...m, off: {}, text: {}, extra: {} }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Teks memorandum tersalin.');
    } catch {
      setMsg('Gagal menyalin; pilih teks pada pratinjau lalu salin manual.');
    }
  };
  const download = () => {
    const blob = new Blob(['\ufeff', memoHtml(ctx, eff, resolved)], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Memorandum_${(ctx.vesselName || 'kapal').replace(/[^A-Za-z0-9]+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('File Word diunduh. Lampirkan ke email Anda.');
  };
  const mail = () => {
    const body = `Kepada Yth ${eff.to || ''},\n\nTerlampir ${subject.replace('Memorandum Awal', 'memorandum awal')}. Mohon item pada lampiran dapat dipersiapkan.\n\nHormat kami,\n${eff.surveyor}`;
    window.location.href = `mailto:${encodeURIComponent(eff.email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setMsg('Email dibuka di aplikasi surat Anda. Lampiran file Word dipasang manual.');
  };

  const none = !ctx.renewal;
  const numIn = (v: string, set: (s: string) => void) => <input inputMode="decimal" className={cx(inputCls, 'bg-yellow-50')} value={v} onChange={(e) => set(e.target.value)} />;

  const row = (it: MemoItem, sub: boolean) => {
    const off = !!memo.off[it.id];
    const val = memo.text[it.id] ?? it.text;
    return (
      <li key={it.id} className={cx('py-2', sub && 'ml-5')}>
        <div className="flex items-start gap-2">
          <input type="checkbox" className="mt-2 h-4 w-4 shrink-0 accent-teal-600" checked={!off} onChange={() => toggle(it.id)} aria-label="Sertakan butir ini" />
          <textarea
            className={cx(inputCls, 'text-xs leading-snug', off && 'bg-slate-100 text-slate-400 line-through')}
            rows={Math.max(2, Math.ceil(val.length / (sub ? 60 : 70)))}
            value={val}
            disabled={off}
            onChange={(e) => edit(it.id, e.target.value)}
          />
        </div>
        {!sub && it.sub && !off && <ul>{it.sub.map((x) => row(x, true))}</ul>}
      </li>
    );
  };

  return (
    <>
      <Card title="Memorandum untuk Owner" sub={subject}>
        {none ? (
          <p className="text-sm text-slate-600">Pilih survei Renewal di tab Status agar daftar item memorandum dapat dibuat.</p>
        ) : (
          <>
            <p className="text-xs text-slate-600">Daftar item dibuat otomatis dari jenis survei, nomor Renewal, umur kapal, dan data di tab Propulsi. Hilangkan centang untuk membuang butir, atau ubah teksnya langsung.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Kepada Yth (perusahaan owner)"><input className={inputCls} value={eff.to} onChange={(e) => setF('to', e.target.value)} placeholder="Mis. PT. Rimau Bahtera Shipping" /></Field>
              <Field label="Cq."><input className={inputCls} value={memo.cc} onChange={(e) => setF('cc', e.target.value)} /></Field>
              <Field label="Dari"><input className={inputCls} value={memo.from} onChange={(e) => setF('from', e.target.value)} /></Field>
              <Field label="Nama surveyor (tanda tangan)"><input className={inputCls} value={eff.surveyor} onChange={(e) => setF('surveyor', e.target.value)} /></Field>
              <Field label="Tempat"><input className={inputCls} value={memo.place} onChange={(e) => setF('place', e.target.value)} /></Field>
              <Field label="Tanggal memo" hint={dateLong(eff.date)}><input type="date" className={inputCls} value={eff.date} onChange={(e) => setF('date', e.target.value)} /></Field>
              <Field label="Email penerima (opsional)" hint="Hanya dipakai untuk mengisi kolom penerima saat membuka email."><input type="email" className={inputCls} value={memo.email} onChange={(e) => setF('email', e.target.value)} placeholder="owner@perusahaan.co.id" /></Field>
            </div>
            {ctx.renewal && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-700">Data jangkar (daftar perlengkapan BKI)</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Field label="Berat jangkar original (kg)">{numIn(anchor.o, (v) => setAnchor((x) => ({ ...x, o: v })))}</Field>
                  <Field label="Diameter rantai original (mm)">{numIn(chain.o, (v) => setChain((x) => ({ ...x, o: v })))}</Field>
                  <Field label="Jumlah segel rantai (27,5 m)">{numIn(memo.segels, (v) => setF('segels', v))}</Field>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Minimum dihitung otomatis: jangkar 88% dan diameter rantai 90% dari nilai original. Bila kosong, memo menampilkan titik-titik (……) untuk diisi.</p>
              </div>
            )}
          </>
        )}
      </Card>

      {!none && (
        <>
          {secs.map((s) => (
            <Card key={s.id} title={s.title} sub={`${s.items.filter((i) => !memo.off[i.id]).length} butir disertakan`}>
              <ul className="divide-y divide-slate-100">{s.items.map((it) => row(it, false))}</ul>
              {(memo.extra[s.id] ?? []).map((t, i) => (
                <div key={i} className="mt-2 flex items-start gap-2">
                  <textarea className={cx(inputCls, 'text-xs')} rows={2} value={t} placeholder="Butir tambahan…" onChange={(e) => editExtra(s.id, i, e.target.value)} />
                  <button type="button" onClick={() => delExtra(s.id, i)} className="shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-slate-50">Hapus</button>
                </div>
              ))}
              <button type="button" onClick={() => addExtra(s.id)} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">+ Tambah butir</button>
            </Card>
          ))}

          <Card title="Pratinjau & Kirim" sub="Memo dikirim dari email kantor Anda sendiri; web tidak mengirim email.">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700">Unduh Word (.doc)</button>
              <button type="button" onClick={copy} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold hover:bg-slate-50">Salin teks</button>
              <button type="button" onClick={mail} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold hover:bg-slate-50">Buka di email</button>
              <button type="button" onClick={resetEdits} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Kembalikan ke otomatis</button>
            </div>
            {msg && <p className="mt-2 text-xs text-teal-800">{msg}</p>}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">Pratinjau teks</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-800">{text}</pre>
            </details>
          </Card>
        </>
      )}
    </>
  );
}
