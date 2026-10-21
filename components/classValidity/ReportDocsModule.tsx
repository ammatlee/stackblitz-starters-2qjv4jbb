import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthProvider';
import { Card, Fold, Field, inputCls } from './ui';
import { cx } from '../../lib/classValidity/dateUtils';
import { SURVEYS } from '../../lib/classValidity/surveyRules';
import type { Sel } from '../../lib/classValidity/surveyRules';
import { ATT_BY_COL, ATT_CONFIRM, ATT_GENERAL, ATT_OTHER, ATT_TESTS, CATEGORIES, COLS, COL_OF_SURVEY, SPECIAL, categoryOfType, formsFor } from '../../lib/reportDocs';
import type { Att, Col, FormRow } from '../../lib/reportDocs';

export type Mark = '' | 'ok' | 'na';
export type DocsState = { done: Record<string, Mark>; specials: string[]; extraCols: Col[]; cat: string; notes: string };
export const DOCS0: DocsState = { done: {}, specials: [], extraCols: [], cat: '', notes: '' };

type Props = {
  vType: string;
  sel: Sel;
  name: string;
  agenda: string;
  docs: DocsState;
  setDocs: Dispatch<SetStateAction<DocsState>>;
};

const NEXT: Record<Mark, Mark> = { '': 'ok', ok: 'na', na: '' };

function Row({ label, sub, tags, mark, onTap }: { label: string; sub?: string; tags?: string; mark: Mark; onTap: () => void }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={onTap}
        className={cx(
          'mt-0.5 w-[4.6rem] shrink-0 rounded-md px-2 py-1 text-[11px] font-bold print:ring-1 print:ring-slate-400',
          mark === 'ok' ? 'bg-emerald-100 text-emerald-800' : mark === 'na' ? 'bg-slate-200 text-slate-500' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-300'
        )}
      >
        {mark === 'ok' ? '✓ Siap' : mark === 'na' ? 'N/A' : 'Belum'}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm leading-snug', mark === 'na' && 'text-slate-400 line-through')}>{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
        {tags && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">{tags}</p>}
      </div>
    </li>
  );
}

export default function ReportDocsModule({ vType, sel, name, agenda, docs, setDocs }: Props) {
  const auto = categoryOfType(vType);
  const cat = docs.cat || auto || '';
  const catInfo = CATEGORIES.find((c) => c.id === cat) ?? null;
  const { user } = useAuth();

  // N/A permanen: tersimpan per akun + jenis kapal + jenis survei, berlaku untuk agenda berikutnya
  const [prefs, setPrefs] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [err, setErr] = useState('');
  const canSave = !!(supabase && user && vType);

  useEffect(() => {
    let dead = false;
    setPrefs(new Set());
    if (!supabase || !user || !vType) return;
    (async () => {
      const { data, error } = await supabase!.from('report_na').select('col,item').eq('owner', user.id).eq('vessel_type', vType);
      if (dead) return;
      if (error) {
        setErr('N/A tersimpan belum bisa dimuat: ' + error.message);
        return;
      }
      setErr('');
      setPrefs(new Set(((data ?? []) as { col: string; item: string }[]).map((r) => r.col + '|' + r.item)));
    })();
    return () => {
      dead = true;
    };
  }, [user, vType]);

  const savePref = useCallback(
    async (cs: Col[], item: string, on: boolean) => {
      if (!supabase || !user || !vType || cs.length === 0) return;
      setPrefs((p) => {
        const n = new Set(p);
        cs.forEach((c) => (on ? n.add(c + '|' + item) : n.delete(c + '|' + item)));
        return n;
      });
      if (on) {
        const { error } = await supabase.from('report_na').upsert(cs.map((c) => ({ owner: user.id, vessel_type: vType, col: c, item })), { onConflict: 'owner,vessel_type,col,item' });
        if (error) setErr('Gagal menyimpan N/A: ' + error.message);
      } else {
        const { error } = await supabase.from('report_na').delete().eq('owner', user.id).eq('vessel_type', vType).eq('item', item).in('col', cs);
        if (error) setErr('Gagal memperbarui N/A: ' + error.message);
      }
    },
    [user, vType]
  );

  const resetPrefs = async () => {
    if (!supabase || !user || !vType) return;
    if (!window.confirm(`Reset semua N/A tersimpan untuk jenis kapal ${vType}? Semua form dan lampiran akan muncul kembali seperti awal.`)) return;
    const { error } = await supabase.from('report_na').delete().eq('owner', user.id).eq('vessel_type', vType);
    if (error) return setErr('Gagal reset: ' + error.message);
    setErr('');
    setPrefs(new Set());
    setShowHidden(false);
    setDocs((d) => ({ ...d, done: Object.fromEntries(Object.entries(d.done).filter(([, v]) => v !== 'na')) as Record<string, Mark> }));
  };

  // jenis survey yang dipilih di agenda → kolom di standar (+ EC/OS yang ditambahkan manual)
  const cols = useMemo(() => {
    const s = new Set<Col>(docs.extraCols);
    SURVEYS.forEach((x) => {
      if (sel[x.key]) s.add(COL_OF_SURVEY[x.key]);
    });
    return COLS.map((c) => c.key).filter((k) => s.has(k));
  }, [sel, docs.extraCols]);

  // cs = kolom survei yang menuntut item ini; kosong (lampiran umum) = semua survei yang dipilih
  const eff = (cs: Col[]) => (cs.length ? cs : cols);
  const hidden = (k: string, cs: Col[]) => {
    const e = eff(cs);
    return e.length > 0 && e.every((c) => prefs.has(c + '|' + k));
  };
  const mark = (k: string, cs: Col[] = []): Mark => (hidden(k, cs) ? 'na' : docs.done[k] ?? '');
  const tap = (k: string, cs: Col[] = []) => {
    const cur = mark(k, cs);
    const nxt = NEXT[cur];
    // hanya form (f:) dan lampiran inti (a:) yang N/A-nya diingat untuk agenda berikutnya
    const persist = k.startsWith('f:') || k.startsWith('a:');
    if (persist && nxt === 'na') savePref(eff(cs), k, true);
    if (persist && cur === 'na') savePref(eff(cs), k, false);
    setDocs((d) => ({ ...d, done: { ...d.done, [k]: nxt } }));
  };
  const labelOf = (c: Col) => COLS.find((x) => x.key === c)?.label ?? c;

  // form: gabungan semua kolom terpilih (satu kali per kode, dengan keterangan survey yang memerlukannya)
  const forms = useMemo(() => {
    const out: { row: FormRow; cols: Col[]; extra: boolean }[] = [];
    if (!cat) return out;
    cols.forEach((c) => {
      const f = formsFor(cat, c);
      ([...f.main.map((r) => ({ r, extra: false })), ...f.extra.map((r) => ({ r, extra: true }))]).forEach(({ r, extra }) => {
        const ex = out.find((o) => o.row.code === r.code);
        if (ex) ex.cols.push(c);
        else out.push({ row: r, cols: [c], extra });
      });
    });
    return out;
  }, [cat, cols]);

  // lampiran: umum + tambahan per kolom
  const atts = useMemo(() => {
    const out: { a: Att; cols: Col[] }[] = [];
    if (cols.length === 0) return out;
    ATT_GENERAL.forEach((a) => out.push({ a, cols: [] }));
    cols.forEach((c) => {
      (ATT_BY_COL[c] ?? []).forEach((a) => {
        const ex = out.find((o) => o.a.id === a.id);
        if (ex) ex.cols.push(c);
        else out.push({ a, cols: [c] });
      });
    });
    return out;
  }, [cols]);

  const keys: { k: string; cs: Col[] }[] = [...forms.map((f) => ({ k: 'f:' + f.row.code, cs: f.cols })), ...atts.map((x) => ({ k: 'a:' + x.a.id, cs: x.cols }))];
  const relevant = keys.filter((x) => mark(x.k, x.cs) !== 'na');
  const ready = relevant.filter((x) => mark(x.k, x.cs) === 'ok').length;
  const hiddenCount = keys.filter((x) => hidden(x.k, x.cs)).length;
  const showForm = (f: { row: FormRow; cols: Col[] }) => showHidden || !hidden('f:' + f.row.code, f.cols);
  const showAtt = (x: { a: Att; cols: Col[] }) => showHidden || !hidden('a:' + x.a.id, x.cols);
  const pct = relevant.length ? Math.round((ready / relevant.length) * 100) : 0;
  const tagOf = (cs: Col[]) => (cs.length ? cs.join(' · ') : '');
  // badge progres per bagian (tetap terlihat saat bagian diminimize)
  const progBadge = (prefix: string) => {
    const rel = relevant.filter((x) => x.k.startsWith(prefix));
    if (rel.length === 0) return undefined;
    const ok = rel.filter((x) => mark(x.k, x.cs) === 'ok').length;
    return <span className={cx('rounded-full px-3 py-1 text-xs font-bold', ok === rel.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>{ok} / {rel.length} siap</span>;
  };

  const toggleExtra = (c: Col) => setDocs((d) => ({ ...d, extraCols: d.extraCols.includes(c) ? d.extraCols.filter((x) => x !== c) : [...d.extraCols, c] }));
  const toggleSpecial = (id: string) => setDocs((d) => ({ ...d, specials: d.specials.includes(id) ? d.specials.filter((x) => x !== id) : [...d.specials, id] }));

  const simpleList = (prefix: string, items: Att[]) => (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => (
        <Row key={a.id} label={a.label} sub={a.cond} mark={mark(prefix + a.id)} onTap={() => tap(prefix + a.id)} />
      ))}
    </ul>
  );

  return (
    <>
      <Fold open
        title="Form & Lampiran Laporan"
        sub={name ? `${name}${vType ? ' · ' + vType : ''}${agenda ? ' · Agenda ' + agenda : ''}` : 'Pilih kapal dan jenis survei di tab Status'}
        right={relevant.length > 0 ? <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">{ready} / {relevant.length} siap · {pct}%</span> : undefined}
      >
        <p className="text-xs text-slate-600">
          Jenis survei terdeteksi: <b>{cols.length ? cols.map(labelOf).join(', ') : 'belum ada (pilih lingkup survei di tab Status)'}</b>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="self-center text-slate-500">Tambahkan:</span>
          {(['EC', 'OS'] as Col[]).map((c) => (
            <button key={c} type="button" onClick={() => toggleExtra(c)} className={cx('rounded-full border px-3 py-1.5 transition', docs.extraCols.includes(c) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}>
              {labelOf(c)}
            </button>
          ))}
        </div>
        <div className="mt-4 max-w-md">
          <Field
            label="Kategori kapal di standar"
            hint={auto ? `Otomatis dari jenis kapal ${vType}. Ubah hanya bila perlu.` : vType ? `Jenis kapal "${vType}" belum punya tabel di standar. Pilih kategori yang paling mendekati.` : 'Pilih jenis kapal di tab Status, atau pilih kategori manual.'}
          >
            <select className={inputCls} value={docs.cat} onChange={(e) => setDocs((d) => ({ ...d, cat: e.target.value }))}>
              <option value="">{auto ? `Otomatis — ${CATEGORIES.find((c) => c.id === auto)?.label.split(' — ')[0].slice(0, 40)}` : '— pilih kategori —'}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.id}. {c.label.slice(0, 70)}</option>
              ))}
            </select>
          </Field>
        </div>
        {catInfo && <p className="mt-2 text-[11px] text-slate-500">Tabel {catInfo.id}: {catInfo.label}</p>}
        <p className="mt-3 text-[11px] text-slate-500">Ketuk tombol di kiri tiap item: Belum → ✓ Siap → N/A (tidak berlaku). N/A pada form dan lampiran inti diingat untuk jenis kapal dan jenis survei yang sama, dan disembunyikan di agenda berikutnya.</p>
      </Fold>

      {err && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{err}</p>}
      {cols.length > 0 && (hiddenCount > 0 || prefs.size > 0 || !canSave) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 print:hidden">
          {!canSave ? (
            <span>{vType ? 'Masuk ke akun agar N/A bisa diingat untuk agenda berikutnya.' : 'Pilih jenis kapal agar N/A bisa diingat untuk agenda berikutnya.'}</span>
          ) : (
            <>
              <span>{hiddenCount} item disembunyikan (N/A tersimpan untuk {vType})</span>
              {hiddenCount > 0 && (
                <button type="button" onClick={() => setShowHidden((v) => !v)} className="font-semibold text-teal-700 underline">
                  {showHidden ? 'Sembunyikan lagi' : 'Tampilkan'}
                </button>
              )}
              {prefs.size > 0 && (
                <button type="button" onClick={resetPrefs} className="font-semibold text-red-700 underline">
                  Reset N/A jenis kapal ini
                </button>
              )}
            </>
          )}
        </div>
      )}

      {cols.length > 0 && cat && (
        <Fold title="Form yang harus diunggah" sub={`${forms.length} form sesuai jenis kapal dan survei`} right={progBadge('f:')}>
          <ul className="divide-y divide-slate-100">
            {forms.filter((f) => showForm({ row: f.row, cols: f.cols })).map(({ row, cols: cs, extra }) => (
              <Row key={row.code} label={`${row.code} — ${row.title}`} sub={row.note} tags={(extra ? 'Form tambahan · ' : '') + tagOf(cs)} mark={mark('f:' + row.code, cs)} onTap={() => tap('f:' + row.code, cs)} />
            ))}
          </ul>
        </Fold>
      )}

      {cols.length > 0 && !cat && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pilih kategori kapal di atas untuk melihat daftar form.</p>}

      {atts.length > 0 && (
        <Fold title="Dokumen lampiran pendukung" sub="Lampiran umum + tambahan menurut jenis survei" right={progBadge('a:')}>
          <ul className="divide-y divide-slate-100">
            {atts.filter((x) => showAtt(x)).map(({ a, cols: cs }) => (
              <Row key={a.id} label={a.label} sub={a.cond} tags={cs.length ? tagOf(cs) : 'Umum'} mark={mark('a:' + a.id, cs)} onTap={() => tap('a:' + a.id, cs)} />
            ))}
          </ul>
        </Fold>
      )}

      {cols.length > 0 && (
        <>
          <Fold title="Pengujian / pengukuran relevan" sub="Lampirkan sesuai lingkup survei yang dikerjakan" noPrint>
            {simpleList('t:', ATT_TESTS)}
          </Fold>
          <Fold title="Konfirmasi" sub="Saat melapor / penerbitan sertifikat" noPrint>
            {simpleList('c:', ATT_CONFIRM)}
          </Fold>
          <Fold title="Kasus khusus" sub="Aktifkan yang berlaku pada agenda ini" noPrint>
            <div className="space-y-4">
              {SPECIAL.map((g) => {
                const on = docs.specials.includes(g.id);
                return (
                  <div key={g.id} className="rounded-xl border border-slate-200 p-3">
                    <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-teal-600" checked={on} onChange={() => toggleSpecial(g.id)} />
                      <span>{g.title}</span>
                    </label>
                    {on && <ul className="mt-2 divide-y divide-slate-100">{g.items.map((a) => <Row key={a.id} label={a.label} sub={a.cond} mark={mark('s:' + g.id + ':' + a.id)} onTap={() => tap('s:' + g.id + ':' + a.id)} />)}</ul>}
                  </div>
                );
              })}
            </div>
          </Fold>
          <Fold title="Lampiran lain-lain" sub="Dokumen lain yang dianggap relevan" noPrint>
            {simpleList('o:', ATT_OTHER)}
          </Fold>
        </>
      )}

      <Card title="Catatan inspeksi" sub="Catatan pribadi untuk bahan laporan; tersimpan bersama agenda">
        <textarea
          className={cx(inputCls, 'min-h-[9rem]')}
          placeholder="Mis. temuan, item yang masih kurang, dokumen yang diminta ke kapal, hal yang harus dilaporkan…"
          value={docs.notes}
          onChange={(e) => setDocs((d) => ({ ...d, notes: e.target.value }))}
        />
      </Card>

      <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        Sumber: Standard Pemeriksaan Laporan Survey — Penerimaan Klas dan Mempertahankan Klas (Divisi Survey, 2026, rev4). Daftar ini alat bantu; ikuti ketentuan BKI terbaru bila ada perubahan.
      </p>
    </>
  );
}
