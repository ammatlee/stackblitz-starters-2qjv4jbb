'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Pengganti window.confirm / window.prompt / window.alert.
 * Pemakaian: const { confirm, prompt, alert } = useDialog();
 *   if (!(await confirm({ message: 'Hapus kunjungan ini?', confirmText: 'Hapus', tone: 'danger' }))) return;
 *   const alasan = await prompt({ title: 'Tolak entri', message: 'Alasan (opsional):' }); // null = dibatalkan
 */

type Tone = 'default' | 'danger';
type Texts = { title?: string; confirmText?: string; cancelText?: string; tone?: Tone };
export type ConfirmOpts = Texts & { message: string };
export type PromptOpts = Texts & { message?: string; defaultValue?: string; placeholder?: string };
export type AlertOpts = { title?: string; message: string; okText?: string };

type DialogApi = {
  confirm: (o: ConfirmOpts | string) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts | string) => Promise<void>;
};

// cadangan bila komponen dipakai di luar provider: tetap berfungsi lewat dialog bawaan browser
const fallback: DialogApi = {
  confirm: async (o) => window.confirm(typeof o === 'string' ? o : o.message),
  prompt: async (o) => window.prompt(o.message ?? o.title ?? '', o.defaultValue ?? ''),
  alert: async (o) => window.alert(typeof o === 'string' ? o : o.message),
};

const Ctx = createContext<DialogApi>(fallback);
export const useDialog = () => useContext(Ctx);

type Open =
  | { id: number; kind: 'confirm'; o: ConfirmOpts; done: (v: boolean) => void }
  | { id: number; kind: 'prompt'; o: PromptOpts; done: (v: string | null) => void }
  | { id: number; kind: 'alert'; o: AlertOpts; done: () => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [cur, setCur] = useState<Open | null>(null);
  const curRef = useRef<Open | null>(null);
  curRef.current = cur;
  const seq = useRef(0);

  // dialog baru muncul saat yang lama masih terbuka: yang lama dianggap dibatalkan
  const cancelCurrent = () => {
    const c = curRef.current;
    if (!c) return;
    if (c.kind === 'confirm') c.done(false);
    else if (c.kind === 'prompt') c.done(null);
    else c.done();
  };

  const confirm = useCallback((o: ConfirmOpts | string) => {
    cancelCurrent();
    const opts = typeof o === 'string' ? { message: o } : o;
    return new Promise<boolean>((done) => setCur({ id: ++seq.current, kind: 'confirm', o: opts, done }));
  }, []);
  const prompt = useCallback((o: PromptOpts) => {
    cancelCurrent();
    return new Promise<string | null>((done) => setCur({ id: ++seq.current, kind: 'prompt', o, done }));
  }, []);
  const alert = useCallback((o: AlertOpts | string) => {
    cancelCurrent();
    const opts = typeof o === 'string' ? { message: o } : o;
    return new Promise<void>((done) => setCur({ id: ++seq.current, kind: 'alert', o: opts, done }));
  }, []);

  const api = useRef<DialogApi>({ confirm, prompt, alert }).current;

  return (
    <Ctx.Provider value={api}>
      {children}
      {cur && <Modal key={cur.id} cur={cur} close={() => setCur(null)} />}
    </Ctx.Provider>
  );
}

function Modal({ cur, close }: { cur: Open; close: () => void }) {
  const [text, setText] = useState(cur.kind === 'prompt' ? cur.o.defaultValue ?? '' : '');
  const primary = useRef<HTMLButtonElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const danger = cur.kind !== 'alert' && cur.o.tone === 'danger';

  const cancel = () => {
    if (cur.kind === 'confirm') cur.done(false);
    else if (cur.kind === 'prompt') cur.done(null);
    else cur.done();
    close();
  };
  const ok = () => {
    if (cur.kind === 'confirm') cur.done(true);
    else if (cur.kind === 'prompt') cur.done(text);
    else cur.done();
    close();
  };

  // fokus: kolom isian untuk prompt; tombol Batal untuk aksi berbahaya (mencegah Enter tak sengaja); selain itu tombol utama
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    if (cur.kind === 'prompt') {
      input.current?.focus();
      input.current?.select();
    } else if (danger) cancelBtn.current?.focus();
    else primary.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    cur.o.title ?? (cur.kind === 'confirm' ? (danger ? 'Konfirmasi hapus' : 'Konfirmasi') : cur.kind === 'prompt' ? 'Isi dulu' : 'Perhatian');
  const message = cur.o.message;
  const okText = cur.kind === 'alert' ? cur.o.okText ?? 'Mengerti' : cur.o.confirmText ?? (cur.kind === 'prompt' ? 'Simpan' : 'Ya, lanjut');
  const cancelText = cur.kind === 'alert' ? null : cur.o.cancelText ?? 'Batal';

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Tab') {
      // jaga fokus tetap di dalam dialog
      const f = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, input')).filter((x) => !x.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && cur.kind !== 'alert') cancel();
      }}
    >
      <div
        role={cur.kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dlg-title"
        aria-describedby="dlg-msg"
        onKeyDown={onKey}
        className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <h2 id="dlg-title" className="text-base font-bold text-slate-900">{title}</h2>
        {message && <p id="dlg-msg" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{message}</p>}
        {cur.kind === 'prompt' && (
          <input
            ref={input}
            value={text}
            placeholder={cur.o.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ok();
              }
            }}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25"
          />
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {cancelText && (
            <button
              ref={cancelBtn}
              type="button"
              onClick={cancel}
              className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={primary}
            type="button"
            onClick={ok}
            className={
              'min-h-[44px] rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              (danger ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600' : 'bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600')
            }
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}