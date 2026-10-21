import React, { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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

  // jenis survey yang dipilih di agenda → kolom di standar (+ EC/OS yang ditambahkan manual)
  const cols = useMemo(() => {
    const s = new Set<Col>(docs.extraCols);
    SURVEYS.forEach((x) => {
      if (sel[x.key]) s.add(COL_OF_SURVEY[x.key]);
    });
    return COLS.map((c) => c.key).filter((k) => s.has(k));
  }, [sel, docs.extraCols]);

  const mark = (k: string): Mark => docs.done[k] ?? '';
  const tap = (k: string) => setDocs((d) => ({ ...d, done: { ...d.done, [k]: NEXT[d.done[k] ?? ''] } }));
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

  const keys = [...forms.map((f) => 'f:' + f.row.code), ...atts.map((x) => 'a:' + x.a.id)];
  const relevant = keys.filter((k) => mark(k) !== 'na');
  const ready = relevant.filter((k) => mark(k) === 'ok').length;
  const pct = relevant.length ? Math.round((ready / relevant.length) * 100) : 0;
  const tagOf = (cs: Col[]) => (cs.length ? cs.join(' · ') : '');

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
      <Card
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
        <p className="mt-3 text-[11px] text-slate-500">Ketuk tombol di kiri tiap item: Belum → ✓ Siap → N/A (tidak berlaku).</p>
      </Card>

      {cols.length > 0 && cat && (
        <Card title="Form yang harus diunggah" sub={`${forms.length} form sesuai jenis kapal dan survei`}>
          <ul className="divide-y divide-slate-100">
            {forms.map(({ row, cols: cs, extra }) => (
              <Row key={row.code} label={`${row.code} — ${row.title}`} sub={row.note} tags={(extra ? 'Form tambahan · ' : '') + tagOf(cs)} mark={mark('f:' + row.code)} onTap={() => tap('f:' + row.code)} />
            ))}
          </ul>
        </Card>
      )}

      {cols.length > 0 && !cat && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pilih kategori kapal di atas untuk melihat daftar form.</p>}

      {atts.length > 0 && (
        <Card title="Dokumen lampiran pendukung" sub="Lampiran umum + tambahan menurut jenis survei">
          <ul className="divide-y divide-slate-100">
            {atts.map(({ a, cols: cs }) => (
              <Row key={a.id} label={a.label} sub={a.cond} tags={cs.length ? tagOf(cs) : 'Umum'} mark={mark('a:' + a.id)} onTap={() => tap('a:' + a.id)} />
            ))}
          </ul>
        </Card>
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
