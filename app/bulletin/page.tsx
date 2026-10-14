'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import DateInput from '../../components/DateInput';

type Visibility = 'private' | 'members' | 'public';
type Entry = {
  id: string;
  owner: string;
  title: string;
  kind: string;
  category: string | null;
  tags: string[];
  body: string;
  visibility: Visibility;
  remind_on: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

const KINDS: [string, string][] = [['catatan', 'Catatan'], ['materi', 'Materi'], ['pengingat', 'Pengingat']];
const CATS = ['Umum', 'Annual', 'Intermediate', 'Renewal', 'Docking', 'Clearance', 'Regulasi', 'Keselamatan'];
const VIS: [Visibility, string][] = [['private', 'Hanya saya'], ['members', 'Anggota (login)'], ['public', 'Publik']];
const VIS_TONE: Record<Visibility, string> = {
  private: 'bg-slate-100 text-slate-700',
  members: 'bg-sky-100 text-sky-800',
  public: 'bg-emerald-100 text-emerald-800',
};
const EMPTY = { title: '', kind: 'catatan', category: 'Umum', tags: '', body: '', visibility: 'private' as Visibility, remind_on: '', pinned: false };

const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';
const dmy = (s: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '');

/* ---------- penampil isi: judul (# / ##), poin (- * • ◦ ▪ –), nomor (1. / 1)), tabel (| a | b | atau tab), **tebal**, paragraf ---------- */
function Inline({ t }: { t: string }) {
  return (
    <>
      {t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.length > 4 && p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>
  );
}
const BULLET = /^(\s*)([-*•·▪◦‣●○–—])\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const isPipe = (ln: string) => /^\s*\|.*\|\s*$/.test(ln);
const isTab = (ln: string) => ln.includes('\t') && ln.trim() !== '';
type ListState = { ordered: boolean; items: { t: string; lvl: number }[] };

function Table({ rows }: { rows: string[][] }) {
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={ri === 0 ? 'bg-slate-100 font-semibold' : ''}>
              {Array.from({ length: w }, (_, ci) => (
                <td key={ci} className="border border-slate-300 px-2 py-1 align-top"><Inline t={r[ci] ?? ''} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Body({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: ListState | null = null;
  const lvlOf = (indent: string) => Math.min(2, Math.floor(indent.replace(/\t/g, '  ').length / 2));

  const flushPara = (k: number) => {
    if (para.length) {
      out.push(<p key={'p' + k} className="whitespace-pre-line"><Inline t={para.join('\n')} /></p>);
      para = [];
    }
  };
  const flushList = (k: number) => {
    if (!list) return;
    const L: ListState = list;
    const items = L.items.map((it, i) => (
      <li key={i} style={{ marginLeft: it.lvl * 16 }} className="pl-1"><Inline t={it.t} /></li>
    ));
    out.push(
      L.ordered ? (
        <ol key={'l' + k} className="ml-5 list-decimal space-y-1">{items}</ol>
      ) : (
        <ul key={'l' + k} className="ml-5 list-disc space-y-1">{items}</ul>
      )
    );
    list = null;
  };

  const lines = text.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // tabel: baris "| a | b |" atau baris bertab (hasil salin dari Word/Excel)
    if (isPipe(ln) || isTab(ln)) {
      const pipe = isPipe(ln);
      const block: string[] = [];
      while (i < lines.length && (pipe ? isPipe(lines[i]) : isTab(lines[i]))) {
        block.push(lines[i]);
        i++;
      }
      i--;
      flushPara(i);
      flushList(i);
      const rows = block
        .map((l) => (pipe ? l.trim().replace(/^\||\|$/g, '').split('|') : l.split('\t')).map((c) => c.trim()))
        .filter((r) => !r.every((c) => c === '' || /^:?-{2,}:?$/.test(c)));
      if (rows.length) out.push(<Table key={'t' + i} rows={rows} />);
      continue;
    }

    const b = ln.match(BULLET);
    const n = ln.match(NUMBERED);
    if (b || n) {
      flushPara(i);
      const ordered = !!n && !b;
      const t = (b ? b[3] : n![3]).trim();
      const lvl = lvlOf(b ? b[1] : n![1]);
      if (list && list.ordered !== ordered) flushList(i);
      if (!list) list = { ordered, items: [] };
      list.items.push({ t, lvl });
      continue;
    }
    if (ln.trim() === '') {
      flushPara(i);
      flushList(i);
      continue;
    }
    flushList(i);
    if (ln.startsWith('## ')) {
      flushPara(i);
      out.push(<h4 key={i} className="pt-1 text-sm font-bold">{ln.slice(3)}</h4>);
    } else if (ln.startsWith('# ')) {
      flushPara(i);
      out.push(<h3 key={i} className="pt-1 text-base font-bold">{ln.slice(2)}</h3>);
    } else {
      para.push(ln);
    }
  }
  flushPara(lines.length);
  flushList(lines.length);
  return <div className="space-y-3 text-sm leading-relaxed text-slate-800">{out}</div>;
}

/* ---------- konversi hasil salin dari Word/Excel/web (HTML) menjadi teks berformat ---------- */
function htmlToMarkup(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const SKIP = ['style', 'script', 'head', 'title', 'meta', 'xml'];
  const MARK = /^[\s\u00a0]*[·•o§▪◦‣●○\-–—][\s\u00a0]+/;
  const out: string[] = [];
  const blank = () => {
    if (out.length && out[out.length - 1] !== '') out.push('');
  };
  const txt = (n: Node): string => {
    if (n.nodeType === 3) return (n.textContent ?? '').replace(/[\s\u00a0]+/g, ' ');
    if (n.nodeType !== 1) return '';
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (SKIP.includes(tag)) return '';
    if (tag === 'br') return '\n';
    if (/mso-list\s*:\s*ignore/i.test(el.getAttribute('style') ?? '')) return ''; // penanda bullet buatan Word
    const inner = Array.from(el.childNodes).map(txt).join('');
    return (tag === 'b' || tag === 'strong') && inner.trim() ? '**' + inner.trim() + '**' : inner;
  };
  const hasBlock = (el: HTMLElement) => !!el.querySelector('p,div,table,ul,ol,h1,h2,h3,h4,h5,h6');

  const listWalk = (el: HTMLElement, ordered: boolean, depth: number) => {
    Array.from(el.children).forEach((li) => {
      if (li.tagName.toLowerCase() !== 'li') return;
      const own = Array.from(li.childNodes)
        .filter((c) => !(c.nodeType === 1 && /^(ul|ol)$/i.test((c as HTMLElement).tagName)))
        .map(txt)
        .join('')
        .trim();
      if (own) out.push('  '.repeat(depth) + (ordered ? '1. ' : '- ') + own);
      Array.from(li.children).forEach((c) => {
        const t = c.tagName.toLowerCase();
        if (t === 'ul' || t === 'ol') listWalk(c as HTMLElement, t === 'ol', depth + 1);
      });
    });
  };

  const walk = (n: Node) => {
    if (n.nodeType !== 1) {
      const t = txt(n).trim();
      if (t) {
        out.push(t);
        blank();
      }
      return;
    }
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (SKIP.includes(tag)) return;
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      rows.forEach((tr, ri) => {
        const cells = Array.from(tr.children)
          .filter((c) => /^(td|th)$/i.test(c.tagName))
          .map((c) => txt(c).replace(/\s+/g, ' ').trim().replace(/\|/g, '/'));
        if (cells.length === 0) return;
        out.push('| ' + cells.join(' | ') + ' |');
        if (ri === 0) out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
      });
      blank();
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      listWalk(el, tag === 'ol', 0);
      blank();
      return;
    }
    if (/^h[1-6]$/.test(tag)) {
      const t = txt(el).trim();
      if (t) {
        out.push((tag === 'h1' ? '# ' : '## ') + t);
        blank();
      }
      return;
    }
    if (hasBlock(el)) {
      Array.from(el.childNodes).forEach(walk);
      return;
    }
    const t = txt(el).replace(/[ \t]+\n/g, '\n').trim();
    if (!t) return;
    const cls = el.getAttribute('class') ?? '';
    const st = el.getAttribute('style') ?? '';
    if (/MsoList/i.test(cls) || /mso-list\s*:\s*l\d/i.test(st)) {
      const marker = el.querySelector('[style*="mso-list:Ignore" i]')?.textContent ?? '';
      const ordered = /^\s*\d+[.)]/.test(marker);
      const lvl = Math.max(0, Number(/level(\d)/i.exec(st)?.[1] ?? '1') - 1);
      out.push('  '.repeat(lvl) + (ordered ? '1. ' : '- ') + t.replace(MARK, ''));
    } else {
      out.push(t);
      blank();
    }
  };

  Array.from(doc.body.childNodes).forEach(walk);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default function BulletinPage() {
  const { user, configured, loading } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [cur, setCur] = useState<Entry | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setFetching(true);
    const { data, error } = await supabase
      .from('bulletins')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setFetching(false);
    if (error) setMsg({ k: 'err', t: 'Gagal memuat: ' + error.message + ' (sudah menjalankan SQL Bulletin?)' });
    else setEntries((data ?? []) as unknown as Entry[]);
  }, []);

  useEffect(() => {
    if (!loading) load();
  }, [load, loading, user]);

  useEffect(() => {
    (async () => {
      if (!supabase || !user) return setIsAdmin(false);
      const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!cat || e.category === cat) &&
        (!s || e.title.toLowerCase().includes(s) || e.body.toLowerCase().includes(s) || (e.tags ?? []).some((t) => t.toLowerCase().includes(s)))
    );
  }, [entries, q, cat]);

  const reminders = useMemo(() => {
    if (!user) return [];
    const limit = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return entries.filter((e) => e.owner === user.id && e.remind_on && e.remind_on <= limit).sort((a, b) => (a.remind_on ?? '').localeCompare(b.remind_on ?? ''));
  }, [entries, user]);

  const openNew = () => {
    setCur(null);
    setF(EMPTY);
    setMsg(null);
    setView('edit');
  };
  const openEdit = (e: Entry) => {
    setCur(e);
    setF({ title: e.title, kind: e.kind, category: e.category ?? 'Umum', tags: (e.tags ?? []).join(', '), body: e.body, visibility: e.visibility, remind_on: e.remind_on ?? '', pinned: e.pinned });
    setMsg(null);
    setView('edit');
  };
  const openDetail = (e: Entry) => {
    setCur(e);
    setMsg(null);
    setView('detail');
  };

  const save = async () => {
    if (!supabase || !user) return;
    if (!f.title.trim()) return setMsg({ k: 'err', t: 'Judul wajib diisi.' });
    setBusy(true);
    setMsg(null);
    const payload = {
      title: f.title.trim(),
      kind: f.kind,
      category: f.category || null,
      tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean),
      body: f.body,
      visibility: f.visibility,
      remind_on: f.remind_on || null,
      pinned: f.pinned,
      updated_at: new Date().toISOString(),
    };
    const r = cur ? await supabase.from('bulletins').update(payload).eq('id', cur.id) : await supabase.from('bulletins').insert({ owner: user.id, ...payload });
    setBusy(false);
    if (r.error) return setMsg({ k: 'err', t: r.error.message + ' (hanya akun admin yang boleh menulis)' });
    await load();
    setView('list');
    setMsg({ k: 'ok', t: 'Tersimpan.' });
  };

  const remove = async (e: Entry) => {
    if (!supabase || !window.confirm(`Hapus "${e.title}"?`)) return;
    const { error } = await supabase.from('bulletins').delete().eq('id', e.id);
    if (error) return setMsg({ k: 'err', t: error.message });
    await load();
    setView('list');
  };

  // tempel dari Word/Excel/web: tabel, judul, poin, dan huruf tebal ikut terbaca
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html || !/<(table|ul|ol|li|h[1-6]|b|strong|p)[\s>]/i.test(html)) return; // teks biasa: tempel seperti biasa
    e.preventDefault();
    const md = htmlToMarkup(html);
    const ta = taRef.current;
    const v = f.body;
    const st = ta ? ta.selectionStart : v.length;
    const en = ta ? ta.selectionEnd : v.length;
    setF({ ...f, body: v.slice(0, st) + md + v.slice(en) });
    const pos = st + md.length;
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  // sisipkan format di posisi kursor (tombol di atas kolom isi)
  const insert = (before: string, after = '', block = false) => {
    const ta = taRef.current;
    const v = f.body;
    const st = ta ? ta.selectionStart : v.length;
    const en = ta ? ta.selectionEnd : v.length;
    const pre = block && st > 0 && v[st - 1] !== '\n' ? '\n' + before : before;
    const picked = v.slice(st, en);
    setF({ ...f, body: v.slice(0, st) + pre + picked + after + v.slice(en) });
    const pos = st + pre.length + picked.length + after.length;
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  if (!configured) return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-600">Supabase belum dikonfigurasi.</main>;

  /* ---------------- tampilan edit ---------------- */
  if (view === 'edit')
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => setView(cur ? 'detail' : 'list')} className="text-sm font-semibold text-teal-700">← Kembali</button>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-bold">{cur ? 'Ubah entri' : 'Tulis baru'}</h1>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Judul<input className={inp + ' mt-1'} value={f.title} onChange={set('title')} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">Jenis
                <select className={inp + ' mt-1'} value={f.kind} onChange={set('kind')}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Kategori
                <select className={inp + ' mt-1'} value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Tag (pisahkan dengan koma)
              <input className={inp + ' mt-1'} placeholder="mis. anniversary, annual in advance" value={f.tags} onChange={set('tags')} />
            </label>
            <div>
              <p className="text-xs font-semibold text-slate-600">Isi</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => insert('## ', '', true)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">Judul</button>
                <button type="button" onClick={() => insert('- ', '', true)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">• Poin</button>
                <button type="button" onClick={() => insert('1. ', '', true)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">1. Nomor</button>
                <button type="button" onClick={() => insert('**', '**')} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold hover:bg-slate-50">Tebal</button>
              </div>
              <textarea ref={taRef} onPaste={onPaste} className={inp + ' mt-2 min-h-[240px]'} placeholder={'Tulis atau tempel teks di sini.\nBaris kosong = paragraf baru.\nBullet dari WhatsApp/Word (•, -, 1.) otomatis dikenali.'} value={f.body} onChange={set('body')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">Siapa yang boleh baca
                <select className={inp + ' mt-1'} value={f.visibility} onChange={set('visibility')}>{VIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Tanggal pengingat (opsional)
                <div className="mt-1"><DateInput className={inp} value={f.remind_on} onChange={(iso) => setF({ ...f, remind_on: iso })} /></div>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
              Sematkan di atas daftar
            </label>
          </div>
          {msg && <p className={'mt-3 text-sm ' + (msg.k === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.t}</p>}
          <button disabled={busy} onClick={save} className="mt-4 w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </main>
    );

  /* ---------------- tampilan detail ---------------- */
  if (view === 'detail' && cur)
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => setView('list')} className="text-sm font-semibold text-teal-700">← Kembali ke daftar</button>
        <article className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className={'rounded-full px-2.5 py-0.5 ' + VIS_TONE[cur.visibility]}>{VIS.find((v) => v[0] === cur.visibility)?.[1]}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{KINDS.find((k) => k[0] === cur.kind)?.[1]}</span>
            {cur.category && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{cur.category}</span>}
            {cur.remind_on && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">Pengingat {dmy(cur.remind_on)}</span>}
          </div>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight">{cur.title}</h1>
          <p className="mt-1 text-xs text-slate-500">Diperbarui {dmy(cur.updated_at)}</p>
          <div className="mt-4"><Body text={cur.body} /></div>
          {(cur.tags ?? []).length > 0 && (
            <p className="mt-4 text-xs text-slate-500">{cur.tags.map((t) => '#' + t).join('  ')}</p>
          )}
          {user && cur.owner === user.id && isAdmin && (
            <div className="mt-5 flex gap-2">
              <button onClick={() => openEdit(cur)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Ubah</button>
              <button onClick={() => remove(cur)} className="rounded-lg px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Hapus</button>
            </div>
          )}
        </article>
      </main>
    );

  /* ---------------- tampilan daftar ---------------- */
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Bulletin</h1>
        {isAdmin && <button onClick={openNew} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">+ Tulis baru</button>}
      </div>
      <p className="mt-1 text-sm text-slate-600">Catatan, materi, dan pengingat.{!user && ' Masuk untuk melihat entri anggota.'}</p>
      {msg && <p className={'mt-2 text-sm ' + (msg.k === 'err' ? 'text-red-700' : 'text-emerald-700')}>{msg.t}</p>}

      {reminders.length > 0 && (
        <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Pengingat (7 hari ke depan atau terlewat)</h2>
          <ul className="mt-2 space-y-1">
            {reminders.map((e) => (
              <li key={e.id}>
                <button onClick={() => openDetail(e)} className="text-left text-sm text-amber-950 underline">{dmy(e.remind_on)} — {e.title}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 flex gap-2">
        <input className={inp} placeholder="Cari judul, isi, atau tag…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp + ' max-w-[9rem]'} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Semua</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {fetching ? (
        <p className="mt-6 text-sm text-slate-500">Memuat…</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{entries.length === 0 ? 'Belum ada entri.' : 'Tidak ada entri yang cocok.'}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((e) => (
            <li key={e.id}>
              <button onClick={() => openDetail(e)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-teal-500">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  {e.pinned && <span>📌</span>}
                  <span className={'rounded-full px-2.5 py-0.5 ' + VIS_TONE[e.visibility]}>{VIS.find((v) => v[0] === e.visibility)?.[1]}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{KINDS.find((k) => k[0] === e.kind)?.[1]}</span>
                  {e.category && <span className="text-slate-500">{e.category}</span>}
                </div>
                <p className="mt-2 text-base font-bold text-slate-900">{e.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{e.body.replace(/[#*•·▪◦‣●○]/g, '').replace(/\s+/g, ' ').slice(0, 160)}</p>
                <p className="mt-2 text-[11px] text-slate-400">{dmy(e.updated_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
