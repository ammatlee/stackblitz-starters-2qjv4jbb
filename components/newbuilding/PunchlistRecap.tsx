'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip, Notice } from '../Controls';
import type { FindingRow } from '../../lib/newbuildingFindings';
import type { FindingPhoto } from '../../lib/newbuildingPhotos';
import { groupPunchlist, punchlistCounts, punchlistSummaryText, punchlistText } from '../../lib/punchlist';

const PHOTO_COLS = 'id,finding_id,path,caption,phase,seq';

const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Nama berkas aman: huruf, angka, strip. */
const safeName = (s: string): string => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'proyek';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Rekap punchlist: pilih sertakan temuan ditutup dan foto, lalu salin teks atau unduh Word. */
export default function PunchlistRecap({ projectId, projectName, rows }: { projectId: string; projectName: string; rows: FindingRow[] }) {
  const [open, setOpen] = useState(false);
  const [withClosed, setWithClosed] = useState(false);
  const [withPhotos, setWithPhotos] = useState(true);
  const [busy, setBusy] = useState<'' | 'copy' | 'docx'>('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warn'; text: string } | null>(null);

  const groups = useMemo(() => groupPunchlist(rows, withClosed), [rows, withClosed]);
  const counts = useMemo(() => punchlistCounts(groups), [groups]);

  /** Foto proyek, dikelompokkan per temuan; hanya temuan yang ikut rekap. */
  const fetchPhotos = async (): Promise<Record<string, FindingPhoto[]>> => {
    const out: Record<string, FindingPhoto[]> = {};
    if (!supabase) return out;
    const ids = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)));
    const { data, error } = await supabase.from('nb_finding_photos').select(PHOTO_COLS).eq('project_id', projectId);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as FindingPhoto[]) if (ids.has(p.finding_id)) (out[p.finding_id] ??= []).push(p);
    return out;
  };

  const copy = async () => {
    setBusy('copy');
    setMsg(null);
    try {
      const photos = withPhotos ? await fetchPhotos() : {};
      const text = punchlistText({ projectName, dateIso: todayIso(), groups, photos });
      setMsg((await copyToClipboard(text)) ? { tone: 'success', text: 'Teks rekap sudah disalin. Tinggal ditempel ke WhatsApp atau email.' } : { tone: 'error', text: 'Teks tidak dapat disalin. Coba lagi atau izinkan akses papan klip di peramban.' });
    } catch (e) {
      setMsg({ tone: 'error', text: `Gagal menyiapkan teks: ${e instanceof Error ? e.message : 'galat tidak diketahui'}` });
    } finally {
      setBusy('');
    }
  };

  const download = async () => {
    setBusy('docx');
    setMsg(null);
    try {
      const { punchlistDocxBlob, loadDocImage } = await import('../../lib/punchlistDocx');
      const meta = withPhotos ? await fetchPhotos() : {};
      const photos: Record<string, Awaited<ReturnType<typeof toDocPhotos>>> = {};
      let failed = 0;
      for (const [fid, list] of Object.entries(meta)) {
        photos[fid] = await toDocPhotos(list, loadDocImage);
        failed += photos[fid].filter((x) => x.image === null).length;
      }
      const dateIso = todayIso();
      const blob = await punchlistDocxBlob({ projectName, dateIso, groups, photos });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Daftar-temuan-${safeName(projectName)}-${dateIso}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMsg(failed > 0 ? { tone: 'warn', text: `File Word sudah diunduh, tetapi ${failed} foto tidak dapat dimuat dan ditandai di lampiran.` } : { tone: 'success', text: 'File Word sudah diunduh.' });
    } catch (e) {
      setMsg({ tone: 'error', text: `Gagal membuat file Word: ${e instanceof Error ? e.message : 'galat tidak diketahui'}` });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mt-4">
      <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Rekap punchlist {open ? '▴' : '▾'}
      </Button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold text-slate-700">Rekap punchlist</p>
          <p className="mt-1 text-xs text-slate-600">{counts.total === 0 ? 'Tidak ada temuan untuk direkap.' : `${counts.total} temuan akan dimuat (${punchlistSummaryText(counts)}).`}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip selected={withClosed} onClick={() => setWithClosed((v) => !v)}>
              Sertakan temuan ditutup
            </Chip>
            <Chip selected={withPhotos} onClick={() => setWithPhotos((v) => !v)}>
              Sertakan foto
            </Chip>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy !== '' || counts.total === 0} onClick={copy}>
              {busy === 'copy' ? 'Menyiapkan…' : 'Salin teks'}
            </Button>
            <Button size="sm" variant="primary" disabled={busy !== '' || counts.total === 0} onClick={download}>
              {busy === 'docx' ? 'Membuat file…' : 'Unduh Word'}
            </Button>
          </div>
          {busy === 'docx' && withPhotos && <p className="mt-2 text-xs text-slate-500">Foto dikecilkan lebih dulu, jadi proses bisa memakan waktu bila fotonya banyak.</p>}
          {msg && (
            <Notice tone={msg.tone} size="xs" className="mt-2">
              {msg.text}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}

/** Unduh dan kecilkan foto satu temuan, empat sekaligus. */
async function toDocPhotos(list: FindingPhoto[], load: (path: string) => Promise<import('../../lib/punchlistDocx').DocImage | null>) {
  const out: import('../../lib/punchlistDocx').DocPhoto[] = [];
  for (let i = 0; i < list.length; i += 4) {
    const part = list.slice(i, i + 4);
    const imgs = await Promise.all(part.map((p) => load(p.path)));
    part.forEach((p, k) => out.push({ id: p.id, seq: p.seq, phase: p.phase, caption: p.caption, image: imgs[k] }));
  }
  return out;
}
