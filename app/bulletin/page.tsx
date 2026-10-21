'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import DateInput from '../../components/DateInput';
import RichEditor, { RichView } from '../../components/RichEditor';
import FileViewer from '../../components/FileViewer';
import { legacyToHtml } from '../../lib/legacyBody';
import { uploadAttachment, uploadImage, removeFiles, removeAttachments, attachmentUrl, pathsInHtml, fmtSize, MAX_MB, type Attachment } from '../../lib/uploads';

type Visibility = 'private' | 'members' | 'public';
type Status = 'pending' | 'approved' | 'rejected';
type Entry = {
  id: string;
  owner: string;
  title: string;
  kind: string;
  category: string | null;
  tags: string[];
  body: string;
  body_html: string | null;
  summary: string | null;
  cover_url: string | null;
  attachments: Attachment[] | null;
  visibility: Visibility;
  remind_on: string | null;
  pinned: boolean;
  status: Status;
  review_note: string | null;
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
const STATUS_LABEL: Record<Status, string> = { pending: 'Menunggu persetujuan', approved: 'Disetujui', rejected: 'Ditolak' };
const STATUS_TONE: Record<Status, string> = { pending: 'bg-amber-100 text-amber-900', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-rose-100 text-rose-800' };
// hanya alamat http(s) yang boleh jadi tautan lampiran (mencegah alamat berbahaya dari data yang dibuat manual)
const EMPTY = { title: '', kind: 'catatan', category: 'Umum', tags: '', body: '', body_html: '', summary: '', cover_url: '', attachments: [] as Attachment[], visibility: 'private' as Visibility, remind_on: '', pinned: false };

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

export default function BulletinPage() {
  const { user, configured, loading, approved, isAdmin } = useAuth();
  const canWrite = !!user && (approved || isAdmin);
  const [tab, setTab] = useState<'all' | 'pending' | 'mine'>('all');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [cur, setCur] = useState<Entry | null>(null);
  const [viewing, setViewing] = useState<{ att: Attachment; label: string } | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);

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

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!cat || e.category === cat) &&
        (tab === 'all' || (tab === 'pending' ? e.status === 'pending' : !!user && e.owner === user.id)) &&
        (!s || e.title.toLowerCase().includes(s) || e.body.toLowerCase().includes(s) || (e.summary ?? '').toLowerCase().includes(s) || (e.tags ?? []).some((t) => t.toLowerCase().includes(s)))
    );
  }, [entries, q, cat, tab, user]);

  const reminders = useMemo(() => {
    if (!user) return [];
    const limit = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return entries.filter((e) => e.owner === user.id && e.remind_on && e.remind_on <= limit).sort((a, b) => (a.remind_on ?? '').localeCompare(b.remind_on ?? ''));
  }, [entries, user]);

  const pendingCount = useMemo(() => entries.filter((e) => e.status === 'pending').length, [entries]);

  const openNew = () => {
    setCur(null);
    setF(EMPTY);
    setMsg(null);
    setView('edit');
  };
  const openEdit = (e: Entry) => {
    setCur(e);
    setF({ title: e.title, kind: e.kind, category: e.category ?? 'Umum', tags: (e.tags ?? []).join(', '), body: e.body, body_html: e.body_html || legacyToHtml(e.body), summary: e.summary ?? '', cover_url: e.cover_url ?? '', attachments: e.attachments ?? [], visibility: e.visibility, remind_on: e.remind_on ?? '', pinned: e.pinned });
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
      body_html: f.body_html || null,
      summary: f.summary.trim() || null,
      cover_url: f.cover_url || null,
      attachments: f.attachments,
      // anggota biasa: selalu untuk umum, tidak bisa menyematkan, dan harus disetujui admin dulu (juga dipaksa di database)
      visibility: isAdmin ? f.visibility : 'public',
      remind_on: f.remind_on || null,
      pinned: isAdmin ? f.pinned : false,
      updated_at: new Date().toISOString(),
    };
    const r = cur
      ? await supabase.from('bulletins').update(payload).eq('id', cur.id)
      : await supabase.from('bulletins').insert({ owner: user.id, ...(isAdmin ? {} : { status: 'pending' }), ...payload });
    setBusy(false);
    if (r.error) return setMsg({ k: 'err', t: r.error.message });
    if (cur) {
      // hapus file yang sudah tidak dipakai lagi (lampiran yang dibuang, gambar yang dihapus dari isi)
      const keepAtt = f.attachments.map((a) => a.path);
      const keepImg = pathsInHtml(f.body_html);
      await removeAttachments((cur.attachments ?? []).filter((a) => keepAtt.indexOf(a.path) < 0));
      await removeFiles([
        ...pathsInHtml(cur.body_html).filter((x) => keepImg.indexOf(x) < 0),
        ...pathsInHtml(cur.cover_url).filter((x) => pathsInHtml(f.cover_url).indexOf(x) < 0),
      ]);
    }
    await load();
    setView('list');
    setMsg({ k: 'ok', t: isAdmin ? 'Tersimpan.' : 'Terkirim — menunggu persetujuan admin sebelum tampil untuk umum.' });
  };

  const remove = async (e: Entry) => {
    if (!supabase || !window.confirm(`Hapus "${e.title}"?`)) return;
    const { error } = await supabase.from('bulletins').delete().eq('id', e.id);
    if (error) return setMsg({ k: 'err', t: error.message });
    await removeAttachments(e.attachments ?? []);
    await removeFiles([...pathsInHtml(e.body_html), ...pathsInHtml(e.cover_url)]);
    await load();
    setView('list');
  };

  // admin: setujui atau tolak entri anggota
  const review = async (e: Entry, status: 'approved' | 'rejected') => {
    if (!supabase || !isAdmin) return;
    let note: string | null = null;
    if (status === 'rejected') {
      const r = window.prompt('Alasan penolakan (opsional):');
      if (r === null) return;
      note = r.trim() || null;
    }
    const { error } = await supabase.from('bulletins').update({ status, review_note: note }).eq('id', e.id);
    if (error) return setMsg({ k: 'err', t: error.message });
    await load();
    setView('list');
    setMsg({ k: 'ok', t: status === 'approved' ? 'Disetujui dan tampil untuk umum.' : 'Ditolak.' });
  };

  // lampiran: tambah dan buang file di form
  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from((e.target.files ?? []) as ArrayLike<File>);
    e.target.value = '';
    if (!list.length) return;
    setUpBusy(true);
    setMsg(null);
    for (const file of list) {
      try {
        const a = await uploadAttachment(file);
        setF((p) => ({ ...p, attachments: [...p.attachments, a] }));
      } catch (err) {
        setMsg({ k: 'err', t: (err as Error).message });
      }
    }
    setUpBusy(false);
  };
  // buka lampiran di penampil; lampiran di bucket privat memakai tautan bertanda waktu
  const openAtt = async (a: Attachment) => {
    try {
      const url = await attachmentUrl(a);
      setViewing({ att: { ...a, url }, label: 'RDK · Class & Technical' });
    } catch (err) {
      setMsg({ k: 'err', t: (err as Error).message });
    }
  };
  const dropAtt = async (a: Attachment) => {
    setF((p) => ({ ...p, attachments: p.attachments.filter((x) => x.path !== a.path) }));
    const saved = (cur?.attachments ?? []).some((x) => x.path === a.path);
    if (!saved) await removeAttachments([a]); // yang sudah tersimpan baru dihapus setelah tombol Simpan
  };

  // foto sampul kartu (opsional)
  const addCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpBusy(true);
    setMsg(null);
    try {
      const url = await uploadImage(file);
      const old = f.cover_url;
      setF((p) => ({ ...p, cover_url: url }));
      if (old && old !== (cur?.cover_url ?? '')) await removeFiles(pathsInHtml(old));
    } catch (err) {
      setMsg({ k: 'err', t: (err as Error).message });
    }
    setUpBusy(false);
  };
  const dropCover = async () => {
    const old = f.cover_url;
    setF((p) => ({ ...p, cover_url: '' }));
    if (old && old !== (cur?.cover_url ?? '')) await removeFiles(pathsInHtml(old)); // yang sudah tersimpan baru dihapus setelah Simpan
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
            <label className="block text-xs font-semibold text-slate-600">Ringkasan (tampil di kartu, maks. 300 huruf)
              <textarea className={inp + ' mt-1'} rows={3} maxLength={300} value={f.summary} onChange={set('summary')} placeholder="Poin penting saja. Kosongkan untuk memakai cuplikan isi secara otomatis." />
            </label>
            <div>
              <p className="text-xs font-semibold text-slate-600">Foto sampul (opsional)</p>
              {f.cover_url && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.cover_url} alt="" className="h-40 w-full rounded-lg object-cover" />
                  <button type="button" onClick={dropCover} className="mt-1 text-xs font-semibold text-red-700">Buang foto sampul</button>
                </div>
              )}
              <label className="mt-2 inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                {upBusy ? 'Mengunggah…' : f.cover_url ? 'Ganti foto' : '+ Pilih foto'}
                <input type="file" accept=".jpg,.jpeg,.png,.webp" disabled={upBusy} className="hidden" onChange={addCover} />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Tag (pisahkan dengan koma)
              <input className={inp + ' mt-1'} placeholder="mis. anniversary, annual in advance" value={f.tags} onChange={set('tags')} />
            </label>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Isi</p>
              <RichEditor
                key={cur ? cur.id : 'baru'}
                value={f.body_html}
                onChange={(html, text) => setF((p) => ({ ...p, body_html: html, body: text }))}
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Lampiran (PDF atau gambar JPG/PNG/WEBP; maks. {MAX_MB} MB; hanya bisa dibaca di penampil)</p>
              {f.attachments.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {f.attachments.map((a) => (
                    <li key={a.path} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <span className="min-w-0 truncate">📎 {a.name} <span className="text-slate-400">({fmtSize(a.size)})</span></span>
                      <button type="button" onClick={() => dropAtt(a)} className="shrink-0 font-semibold text-red-700">Buang</button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="mt-2 inline-block cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                {upBusy ? 'Mengunggah…' : '+ Tambah file'}
                <input type="file" multiple disabled={upBusy} className="hidden" onChange={addFiles}
                  accept=".pdf,.jpg,.jpeg,.png,.webp" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {isAdmin && (
                <label className="block text-xs font-semibold text-slate-600">Siapa yang boleh baca
                  <select className={inp + ' mt-1'} value={f.visibility} onChange={set('visibility')}>{VIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-600">Tanggal pengingat (opsional)
                <div className="mt-1"><DateInput className={inp} value={f.remind_on} onChange={(iso) => setF({ ...f, remind_on: iso })} /></div>
              </label>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
                Sematkan di atas daftar
              </label>
            )}
            {!isAdmin && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Entri ini akan tampil untuk umum setelah disetujui admin.{cur && cur.status === 'approved' ? ' Perubahan akan dikirim ulang untuk persetujuan, dan entri disembunyikan sampai disetujui.' : ''}
              </p>
            )}
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
        {viewing && <FileViewer url={viewing.att.url} name={viewing.att.name} type={viewing.att.type} label={viewing.label} onClose={() => setViewing(null)} />}
        <button onClick={() => setView('list')} className="text-sm font-semibold text-teal-700">← Kembali ke daftar</button>
        <article className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {cur.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.cover_url} alt="" className="mb-4 h-52 w-full rounded-xl object-cover" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            {cur.status !== 'approved' && <span className={'rounded-full px-2.5 py-0.5 ' + STATUS_TONE[cur.status]}>{STATUS_LABEL[cur.status]}</span>}
            <span className={'rounded-full px-2.5 py-0.5 ' + VIS_TONE[cur.visibility]}>{VIS.find((v) => v[0] === cur.visibility)?.[1]}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{KINDS.find((k) => k[0] === cur.kind)?.[1]}</span>
            {cur.category && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{cur.category}</span>}
            {cur.remind_on && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">Pengingat {dmy(cur.remind_on)}</span>}
          </div>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight">{cur.title}</h1>
          <p className="mt-1 text-xs text-slate-500">Diperbarui {dmy(cur.updated_at)}</p>
          {cur.summary && <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">{cur.summary}</p>}
          {cur.status === 'rejected' && cur.review_note && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">Alasan penolakan: {cur.review_note}</p>}
          <div className="mt-4">{cur.body_html ? <RichView html={cur.body_html} /> : <Body text={cur.body} />}</div>
          {(cur.attachments ?? []).length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-600">Dokumen lengkap</p>
              <ul className="mt-2 space-y-1.5">
                {(cur.attachments ?? []).map((a) => (
                  <li key={a.path}>
                    <button
                      type="button"
                      onClick={() => openAtt(a)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-teal-800 hover:border-teal-500"
                    >
                      <span className="min-w-0 truncate">📖 {a.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">Baca · {fmtSize(a.size)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(cur.tags ?? []).length > 0 && (
            <p className="mt-4 text-xs text-slate-500">{cur.tags.map((t) => '#' + t).join('  ')}</p>
          )}
          {user && (isAdmin || (canWrite && cur.owner === user.id)) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {isAdmin && cur.status !== 'approved' && <button onClick={() => review(cur, 'approved')} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Setujui</button>}
              {isAdmin && cur.status === 'pending' && <button onClick={() => review(cur, 'rejected')} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Tolak</button>}
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
        {canWrite && <button onClick={openNew} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">+ Tulis baru</button>}
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

      {canWrite && (
        <div className="mt-4 flex gap-2 text-xs font-semibold">
          {([['all', 'Semua'], ...(isAdmin ? [['pending', `Menunggu persetujuan${pendingCount ? ` (${pendingCount})` : ''}`]] : []), ['mine', 'Milik saya']] as [string, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as 'all' | 'pending' | 'mine')} className={'rounded-full px-3 py-1.5 ' + (tab === k ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{l}</button>
          ))}
        </div>
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
              <button onClick={() => openDetail(e)} className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm hover:border-teal-500">
                {e.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.cover_url} alt="" loading="lazy" className="h-44 w-full object-cover" />
                )}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    {e.pinned && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">📌 Disematkan</span>}
                    {e.status !== 'approved' && <span className={'rounded-full px-2.5 py-0.5 ' + STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</span>}
                    <span className={'rounded-full px-2.5 py-0.5 ' + VIS_TONE[e.visibility]}>{VIS.find((v) => v[0] === e.visibility)?.[1]}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">{KINDS.find((k) => k[0] === e.kind)?.[1]}</span>
                    {e.category && <span className="text-slate-500">{e.category}</span>}
                  </div>
                  <p className="mt-2 text-base font-bold text-slate-900">{e.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-slate-600">{e.summary || e.body.replace(/[#*•·▪◦‣●○]/g, '').replace(/\s+/g, ' ').slice(0, 200)}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {dmy(e.updated_at)}
                    {(e.attachments ?? []).length > 0 && <span className="ml-2 font-semibold text-teal-700">📖 Dokumen lengkap</span>}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
