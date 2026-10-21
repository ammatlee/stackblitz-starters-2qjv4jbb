import React, { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthProvider';
import DateInput from '../DateInput';
import { Card, Field, inputCls } from './ui';
import { cx } from '../../lib/classValidity/dateUtils';
import type { Sel } from '../../lib/classValidity/surveyRules';

export type Visit = {
  id: string;
  ds: string; // tanggal mulai (yyyy-mm-dd)
  ts: string; // jam mulai (HH:MM)
  de: string; // tanggal selesai
  te: string; // jam selesai
  place: string;
  act: string; // kegiatan / item pemeriksaan (ketikan bebas)
  stage: 'On Progress' | 'Completion';
  surveyor: string;
  sent: boolean; // sudah diinput di web BKI
};

const pad = (n: number) => String(n).padStart(2, '0');
export const REPORT_DAYS = 7; // batas penyelesaian laporan setelah inspeksi selesai
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dmy = (s: string) => (s ? s.split('-').reverse().join('.') : '—');

/** Batas laporan = tanggal inspeksi selesai + REPORT_DAYS. days: sisa hari (negatif = terlambat). */
export function reportDue(completion: string | null | undefined, done?: string | null) {
  if (!completion || !/^\d{4}-\d{2}-\d{2}$/.test(completion)) return null;
  const [y, m, d] = completion.split('-').map(Number);
  const due = new Date(y, m - 1, d + REPORT_DAYS);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - t0.getTime()) / 86400000);
  const dueISO = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
  return { dueISO, days, done: !!done };
}
export const dueLabel = (days: number) => (days > 0 ? `sisa ${days} hari` : days === 0 ? 'batas hari ini' : `terlambat ${-days} hari`);
export const dueTone = (days: number) => (days < 0 ? 'bg-red-100 text-red-800' : days <= 3 ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-800');
const rid = () => Math.random().toString(36).slice(2, 10);

/** Isian tambahan untuk cetak Daftar Kunjungan Survey (disimpan bersama agenda). */
export type VisitMeta = { owner: string; reportNo: string; jenis: string | null; flags: string[] };
export const META0: VisitMeta = { owner: '', reportNo: '', jenis: null, flags: [] };
const FLAGS: [string, string][] = [
  ['kerja', 'Hari Kerja'],
  ['libur', 'Hari Libur'],
  ['luarjam', 'Diluar Jam Kerja'],
  ['luardok', 'Luar Dok'],
];

// jenis survei default dari lingkup survei yang dipilih (bisa diubah di kolom Jenis survei)
function jenisFromSel(sel: Sel): string {
  const out: string[] = [];
  if (sel.A1 || sel.A2 || sel.A3 || sel.A4 || sel.A5) out.push('SURVEY TAHUNAN');
  if (sel.INT) out.push('SURVEY ANTARA');
  if (sel.REN) out.push('SURVEY KHUSUS (PEMBARUAN KELAS)');
  if (sel.D1) out.push('SURVEY PENGEDOKAN');
  if (sel.PS) out.push('SURVEY POROS BALING-BALING');
  return out.join(', ');
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DAYS = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const dayDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]} / ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
};
const hm = (t: string) => (t ? t.replace(':', '.') : '');

/** Dokumen HTML Daftar Kunjungan Survey (format FQ.088-2014/Rev.0), siap cetak / simpan PDF. */
function buildVisitListHtml(o: { vessel: string; owner: string; surveyor: string; reportNo: string; jenis: string; flags: string[]; visits: Visit[] }) {
  const rows = [...o.visits]
    .sort((a, b) => (a.ds + a.ts).localeCompare(b.ds + b.ts))
    .map((v, i) => {
      const items = v.act.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => '- ' + esc(x.toUpperCase())).join('<br>');
      const tgl = v.de && v.de !== v.ds ? `${dayDate(v.ds)}<br>s/d ${dayDate(v.de)}` : dayDate(v.ds);
      return `<tr><td class="c">${i + 1}.</td><td>${tgl}</td><td class="c">${esc(hm(v.ts))}</td><td class="c">${esc(hm(v.te))}</td><td>${esc(v.place.toUpperCase())}</td><td>${esc(o.jenis)}</td><td>${items}</td><td></td></tr>`;
    })
    .join('');
  const box = (k: string, label: string) => `<div class="fl"><span>${label}</span><span class="bx">${o.flags.includes(k) ? '&#10003;' : ''}</span></div>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Daftar Kunjungan Survey - ${esc(o.vessel)}</title>
<style>
@page{size:A4 landscape;margin:12mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:12px;font-size:12px}
h1{margin:0;text-align:center;font-size:18px;letter-spacing:.5px}
.sub{text-align:center;font-size:12px;margin:2px 0 12px}
.top{display:flex;justify-content:space-between;gap:16px;margin-bottom:10px}
.meta td{padding:2px 8px 2px 0;vertical-align:top}
.fl{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:3px}
.bx{display:inline-block;width:14px;height:14px;border:1.5px solid #111;text-align:center;line-height:12px;font-size:12px}
table.t{width:100%;border-collapse:collapse}
table.t th,table.t td{border:1px solid #111;padding:5px 6px;vertical-align:top}
table.t th{text-align:center;font-weight:700}
.c{text-align:center}
.ft{margin-top:6px;font-size:11px}
.bar{position:sticky;top:0;background:#0f172a;color:#fff;padding:8px 12px;margin:-12px -12px 12px;display:flex;gap:8px;align-items:center;font-size:13px}
.bar button{background:#14b8a6;border:0;color:#042f2e;font-weight:700;padding:8px 14px;border-radius:8px;font-size:13px}
@media print{.bar{display:none}body{padding:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Cetak / Simpan PDF</button><span>Pilih &quot;Simpan sebagai PDF&quot; di dialog cetak untuk membuat file.</span></div>
<h1>DAFTAR KUNJUNGAN SURVEY</h1><div class="sub">(LIST OF VISIT SURVEY)</div>
<div class="top">
<table class="meta"><tr><td>NAMA KAPAL</td><td>: ${esc(o.vessel.toUpperCase())}</td></tr><tr><td>PEMILIK/PEMOHON</td><td>: ${esc(o.owner.toUpperCase())}</td></tr><tr><td>NAMA SURVEYOR</td><td>: ${esc(o.surveyor.toUpperCase())}</td></tr><tr><td>NO. LAPORAN</td><td>: ${esc(o.reportNo)}</td></tr></table>
<div style="min-width:190px">${FLAGS.map(([k, l]) => box(k, l)).join('')}</div>
</div>
<table class="t"><thead><tr><th rowspan="2" style="width:34px">No.</th><th rowspan="2" style="width:130px">Hari/Tanggal</th><th colspan="2">Jam</th><th rowspan="2" style="width:100px">Tempat</th><th rowspan="2" style="width:170px">Jenis Survey</th><th rowspan="2">Item Pemeriksaan</th><th rowspan="2" style="width:120px">Tanda Tangan OS/Crew</th></tr><tr><th style="width:56px">Mulai</th><th style="width:56px">Selesai</th></tr></thead><tbody>${rows}</tbody></table>
<div class="ft">FQ.088-2014/Rev.0</div>
</body></html>`;
}

export const VISIT0: Visit = { id: '', ds: '', ts: '', de: '', te: '', place: '', act: '', stage: 'On Progress', surveyor: '', sent: false };

type Props = {
  visits: Visit[];
  setVisits: Dispatch<SetStateAction<Visit[]>>;
  vesselName: string;
  agenda: string;
  compDate: string;
  finished: boolean;
  reportDone: string;
  setReportDone: (v: string) => void;
  sel: Sel;
  meta: VisitMeta;
  setMeta: Dispatch<SetStateAction<VisitMeta>>;
};

export default function VisitsModule({ visits, setVisits, vesselName, agenda, compDate, finished, reportDone, setReportDone, sel, meta, setMeta }: Props) {
  const due = finished ? reportDue(compDate, reportDone) : null;
  const { user } = useAuth();
  const saved = String((user?.user_metadata as Record<string, unknown> | undefined)?.surveyor_name ?? '');
  const [nm, setNm] = useState(saved);
  const [nmMsg, setNmMsg] = useState('');
  useEffect(() => setNm(saved), [saved]);

  const saveName = async () => {
    if (!supabase || !user) return;
    const { error } = await supabase.auth.updateUser({ data: { surveyor_name: nm.trim() } });
    setNmMsg(error ? 'Gagal menyimpan: ' + error.message : 'Nama surveyor tersimpan di akunmu.');
  };

  // Pemilik/Pemohon: otomatis diisi dari agenda terakhir kapal yang sama (isi sekali per kapal)
  useEffect(() => {
    if (!supabase || !user || !vesselName.trim() || meta.owner) return;
    let dead = false;
    (async () => {
      const { data } = await supabase!.from('agendas').select('data,vessels!inner(name)').eq('vessels.name', vesselName.trim()).order('created_at', { ascending: false }).limit(10);
      if (dead) return;
      const hit = ((data ?? []) as unknown as { data: Record<string, unknown> | null }[])
        .map((r) => (r.data?.vmeta as { owner?: string } | undefined)?.owner)
        .find((o) => typeof o === 'string' && o.trim() !== '');
      if (hit) setMeta((m) => (m.owner ? m : { ...m, owner: hit }));
    })();
    return () => {
      dead = true;
    };
  }, [vesselName, user, meta.owner, setMeta]);

  const jenisDefault = jenisFromSel(sel);
  const printList = () => {
    const w = window.open('', '_blank');
    if (!w) {
      window.alert('Pop-up diblokir. Izinkan pop-up untuk situs ini, lalu coba lagi.');
      return;
    }
    const surveyor = saved || [...visits].sort((a, b) => (a.ds + a.ts).localeCompare(b.ds + b.ts))[0]?.surveyor || '';
    w.document.write(buildVisitListHtml({ vessel: vesselName, owner: meta.owner, surveyor, reportNo: meta.reportNo, jenis: meta.jenis ?? jenisDefault, flags: meta.flags, visits }));
    w.document.close();
  };

  const sorted = [...visits].sort((a, b) => (a.ds + a.ts).localeCompare(b.ds + b.ts));
  const pending = visits.filter((v) => !v.sent).length;

  const upd = (id: string, patch: Partial<Visit>) =>
    setVisits((list) =>
      list.map((v) => {
        if (v.id !== id) return v;
        const n = { ...v, ...patch };
        // tanggal selesai mengikuti tanggal mulai bila kosong atau lebih awal
        if (patch.ds !== undefined && (!n.de || n.de < n.ds)) n.de = n.ds;
        return n;
      })
    );
  const add = () => {
    const last = sorted[sorted.length - 1];
    const d = todayISO();
    setVisits((list) => [...list, { ...VISIT0, id: rid(), ds: d, de: d, place: last?.place ?? '', surveyor: saved || last?.surveyor || '' }]);
  };
  const del = (id: string) => {
    if (window.confirm('Hapus kunjungan ini?')) setVisits((list) => list.filter((v) => v.id !== id));
  };

  return (
    <>
    {!finished && visits.length > 0 && (
      <Card
        title="Survei berjalan"
        sub={`Kunjungan terakhir ${dmy(compDate)} · deadline laporan (${REPORT_DAYS} hari) baru dihitung setelah agenda di-Finish.`}
        right={<span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">On Progress</span>}
      >
        <p className="text-[11px] text-slate-500">Tanggal completion mengikuti kunjungan terakhir dan bisa bergeser bila ada kunjungan baru. Saat Finish, tanggal itu dikunci dan pengingat laporan mulai berjalan.</p>
      </Card>
    )}
    {due && (
      <Card
        title="Pengingat laporan"
        sub={`Batas ${dmy(due.dueISO)} · ${REPORT_DAYS} hari setelah inspeksi selesai (${dmy(compDate)}).`}
        right={<span className={cx('rounded-full px-3 py-1 text-xs font-bold', reportDone ? 'bg-emerald-100 text-emerald-800' : dueTone(due.days))}>{reportDone ? '✓ Laporan selesai' : dueLabel(due.days)}</span>}
      >
        {reportDone ? (
          <p className="text-sm text-slate-700">
            Laporan selesai pada <b>{dmy(reportDone)}</b>.{' '}
            <button type="button" onClick={() => setReportDone('')} className="font-semibold text-red-700 underline">Batalkan</button>
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Field label="Laporan selesai pada"><DateInput value={reportDone} onChange={setReportDone} className={inputCls} /></Field>
            </div>
            <button type="button" onClick={() => setReportDone(todayISO())} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Selesai hari ini</button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Setelah tanggal diisi, tekan <b>Simpan agenda</b>; pengingat di Riwayat hilang.</p>
      </Card>
    )}
    <Card
      title="Kunjungan Survey"
      sub={`${vesselName || 'Kapal'}${agenda ? ' · Agenda ' + agenda : ''}`}
      right={visits.length > 0 ? <span className={cx('rounded-full px-3 py-1 text-xs font-bold', pending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800')}>{visits.length} kunjungan · {pending ? `${pending} belum di web BKI` : 'semua sudah di web BKI'}</span> : undefined}
    >
      {user && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <Field label="Nama surveyor (isi sekali, tersimpan di akunmu)" hint="Dipakai otomatis pada kunjungan baru. Tiap kunjungan tetap bisa diubah.">
            <div className="flex gap-2">
              <input className={inputCls} value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Mis. Rachmat Hidayat" />
              <button type="button" onClick={saveName} disabled={nm.trim() === saved.trim()} className="shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-40">Simpan</button>
            </div>
          </Field>
          {nmMsg && <p className="mt-1 text-[11px] text-slate-600">{nmMsg}</p>}
        </div>
      )}

      {sorted.length === 0 && <p className="mb-3 text-sm text-slate-500">Belum ada kunjungan. Tambahkan satu untuk setiap hari inspeksi; agenda tetap berstatus Berjalan sampai kamu menekan Finish.</p>}

      <div className="space-y-2">
        {sorted.map((v, i) => (
          <details key={v.id} open={i === sorted.length - 1} className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-sm font-semibold">
                {i + 1}. {dmy(v.ds)}
                {v.ts ? ` · ${v.ts}${v.te ? '–' + v.te : ''}` : ''}
              </span>
              <span className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={cx('rounded-full px-2 py-0.5', v.stage === 'Completion' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800')}>{v.stage}</span>
                <span className={cx('rounded-full px-2 py-0.5', v.sent ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>{v.sent ? '✓ di web BKI' : 'belum di web BKI'}</span>
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal mulai"><DateInput value={v.ds} onChange={(x) => upd(v.id, { ds: x })} className={inputCls} /></Field>
                <Field label="Jam mulai"><input type="time" className={inputCls} value={v.ts} onChange={(e) => upd(v.id, { ts: e.target.value })} /></Field>
                <Field label="Tanggal selesai"><DateInput value={v.de} onChange={(x) => upd(v.id, { de: x })} className={inputCls} /></Field>
                <Field label="Jam selesai"><input type="time" className={inputCls} value={v.te} onChange={(e) => upd(v.id, { te: e.target.value })} /></Field>
              </div>
              <Field label="Tempat"><input className={inputCls} value={v.place} onChange={(e) => upd(v.id, { place: e.target.value })} placeholder="Mis. Pangkal Pinang" /></Field>
              <Field label="Kegiatan / item pemeriksaan" hint="Ketikan bebas, satu baris per item.">
                <textarea className={cx(inputCls, 'min-h-[6rem]')} value={v.act} onChange={(e) => upd(v.id, { act: e.target.value })} placeholder={'Pemeriksaan plat bottom\nPemeriksaan propeller P/S'} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Stage">
                  <select className={inputCls} value={v.stage} onChange={(e) => upd(v.id, { stage: e.target.value as Visit['stage'] })}>
                    <option value="On Progress">On Progress</option>
                    <option value="Completion">Completion</option>
                  </select>
                </Field>
                <Field label="Surveyor"><input className={inputCls} value={v.surveyor} onChange={(e) => upd(v.id, { surveyor: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={v.sent} onChange={(e) => upd(v.id, { sent: e.target.checked })} />
                Sudah diinput di web BKI
              </label>
              <button type="button" onClick={() => del(v.id)} className="text-xs font-semibold text-red-700">Hapus kunjungan</button>
            </div>
          </details>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Tambah kunjungan</button>
      <p className="mt-2 text-[11px] text-slate-500">Ingat menekan <b>Simpan agenda</b> di tab Status agar kunjungan tersimpan.</p>
    </Card>
    {visits.length > 0 && (
      <Card title="Cetak Daftar Kunjungan Survey" sub="Format FQ.088-2014/Rev.0 dari kunjungan di atas; kolom tanda tangan OS/Crew dikosongkan">
        <div className="space-y-3">
          <Field label="Pemilik / Pemohon" hint="Terisi otomatis dari agenda terakhir kapal ini bila pernah diisi.">
            <input className={inputCls} value={meta.owner} onChange={(e) => setMeta((m) => ({ ...m, owner: e.target.value }))} placeholder="Mis. PT. Pahala Harapan Lestari" />
          </Field>
          <Field label="No. Laporan (boleh kosong)"><input className={inputCls} value={meta.reportNo} onChange={(e) => setMeta((m) => ({ ...m, reportNo: e.target.value }))} /></Field>
          <Field label="Jenis survey (di kolom tabel)" hint="Otomatis dari lingkup survei; ubah bila perlu.">
            <input className={inputCls} value={meta.jenis ?? jenisDefault} onChange={(e) => setMeta((m) => ({ ...m, jenis: e.target.value }))} />
          </Field>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FLAGS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={meta.flags.includes(k)} onChange={() => setMeta((m) => ({ ...m, flags: m.flags.includes(k) ? m.flags.filter((x) => x !== k) : [...m.flags, k] }))} />
                {l}
              </label>
            ))}
          </div>
          <button type="button" onClick={printList} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Buka untuk cetak / simpan PDF</button>
        </div>
      </Card>
    )}
    </>
  );
}
