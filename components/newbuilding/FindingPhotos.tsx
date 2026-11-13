'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Chip } from '../Controls';
import { useDialog } from '../DialogProvider';
import { PHOTO_PHASES, PHOTO_PHASE_LABEL, normalizeCaption, photoCode, photoSummary, sortPhotos } from '../../lib/newbuildingPhotos';
import type { FindingPhoto, PhotoPhase } from '../../lib/newbuildingPhotos';
import { photoUrls, removePhotoFiles, uploadFindingPhoto } from '../../lib/photoUpload';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const COLS = 'id,finding_id,path,caption,phase,seq';

/** Keterangan foto: disimpan saat kolom ditinggalkan. */
function CaptionInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [t, setT] = useState(value);
  useEffect(() => {
    setT(value);
  }, [value]);
  return (
    <input
      className={INPUT}
      placeholder="Keterangan foto (mis. retak las, frame 24)"
      value={t}
      disabled={disabled}
      maxLength={200}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => {
        if (t.trim() !== value.trim()) onSave(t.trim());
      }}
    />
  );
}

/** Foto dokumentasi satu temuan: ambil dari kamera atau galeri, beri keterangan dan label Temuan/Perbaikan.
    known = jumlah foto yang sudah diketahui induk (untuk judul tanpa memuat semua); onChange memberi tahu induk bila berubah. */
export default function FindingPhotos({
  projectId,
  findingId,
  defaultPhase,
  disabled,
  known,
  onChange,
}: {
  projectId: string;
  findingId: string;
  defaultPhase: PhotoPhase;
  disabled?: boolean;
  known?: { phase: PhotoPhase }[];
  onChange?: (rows: { phase: PhotoPhase }[]) => void;
}) {
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FindingPhoto[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState('');
  const [busyId, setBusyId] = useState('');
  const [phase, setPhase] = useState<PhotoPhase>(defaultPhase);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const askedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('nb_finding_photos').select(COLS).eq('finding_id', findingId).order('seq', { ascending: true });
    if (error) {
      setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL foto temuan?)' : ''));
      setRows([]);
      return;
    }
    setRows(sortPhotos((data ?? []) as FindingPhoto[]));
  }, [findingId]);

  // induk tidak memberi jumlah: muat sendiri (hanya baris, tanpa tautan foto)
  useEffect(() => {
    if (known === undefined) load();
  }, [known, load]);

  const openIt = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null) load();
  };

  // tautan foto diminta hanya saat dibuka, sekali per foto (askedRef mencegah permintaan berulang bila ada yang gagal)
  useEffect(() => {
    if (!open || !rows) return;
    const missing = rows.map((r) => r.path).filter((p) => !urls[p] && !askedRef.current.has(p));
    if (missing.length === 0) return;
    missing.forEach((p) => askedRef.current.add(p));
    photoUrls(missing)
      .then((m) => setUrls((u) => ({ ...u, ...m })))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Foto tidak bisa dibuka.'));
  }, [open, rows, urls]);

  const phasesOf = (list: FindingPhoto[]) => list.map((r) => ({ phase: r.phase }));
  const commit = (list: FindingPhoto[]) => {
    setRows(list);
    onChange?.(phasesOf(list));
  };

  const addFiles = async (files: File[]) => {
    if (!supabase || files.length === 0 || rows === null) return;
    setErr('');
    let cur = rows;
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setUploading(`Mengunggah ${i + 1} dari ${files.length}…`);
      try {
        const path = await uploadFindingPhoto(f, projectId, findingId);
        const ins = await supabase.from('nb_finding_photos').insert({ finding_id: findingId, project_id: projectId, path, phase }).select(COLS).single();
        if (ins.error) {
          await removePhotoFiles([path]);
          throw new Error(ins.error.message);
        }
        cur = sortPhotos([...cur, ins.data as FindingPhoto]);
        commit(cur);
      } catch (e) {
        errs.push(`${f.name || 'Foto'}: ${e instanceof Error ? e.message : 'gagal diunggah'}`);
      }
    }
    setUploading('');
    if (errs.length > 0) setErr(errs.join(' | '));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    addFiles(list);
  };

  const patchPhoto = async (id: string, p: { caption?: string | null; phase?: PhotoPhase }) => {
    if (!supabase || rows === null) return;
    setBusyId(id);
    setErr('');
    const r = await supabase.from('nb_finding_photos').update(p).eq('id', id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    commit(rows.map((x) => (x.id === id ? { ...x, ...p } : x)));
  };

  const removePhoto = async (ph: FindingPhoto) => {
    if (!supabase || rows === null) return;
    if (!(await confirm({ title: `Hapus ${photoCode(ph.seq)}?`, message: 'Foto dihapus dari temuan dan dari penyimpanan.', confirmText: 'Hapus', tone: 'danger' }))) return;
    setBusyId(ph.id);
    setErr('');
    const r = await supabase.from('nb_finding_photos').delete().eq('id', ph.id);
    setBusyId('');
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    await removePhotoFiles([ph.path]);
    commit(rows.filter((x) => x.id !== ph.id));
  };

  const summary = photoSummary(known ?? (rows ? phasesOf(rows) : []));
  const locked = !!disabled || uploading !== '' || rows === null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white/70">
      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-bold text-slate-700" aria-expanded={open} onClick={openIt}>
        <span>Foto dokumentasi{summary ? ` · ${summary}` : ''}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 p-3">
          {err && <p className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-800">{err}</p>}

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">Foto baru sebagai</p>
            <div className="flex flex-wrap gap-2">
              {PHOTO_PHASES.map((p) => (
                <Chip key={p} selected={phase === p} disabled={locked} onClick={() => setPhase(p)}>
                  {PHOTO_PHASE_LABEL[p]}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={locked} onClick={() => cameraRef.current?.click()}>
                Ambil foto
              </Button>
              <Button size="sm" disabled={locked} onClick={() => galleryRef.current?.click()}>
                Pilih dari galeri
              </Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onPick} />
            {uploading && <p className="mt-2 text-xs font-semibold text-teal-700">{uploading}</p>}
          </div>

          {rows === null ? (
            <p className="text-xs text-slate-500">Memuat foto…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada foto.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((ph) => {
                const url = urls[ph.path];
                return (
                  <li key={ph.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={`Buka ${photoCode(ph.seq)} ukuran penuh`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={photoCode(ph.seq)} loading="lazy" className="h-24 w-24 rounded-lg bg-slate-100 object-cover" />
                      </a>
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-400">Memuat…</div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-extrabold text-slate-900">{photoCode(ph.seq)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PHOTO_PHASES.map((p) => (
                          <Chip key={p} selected={ph.phase === p} disabled={busyId === ph.id || !!disabled} onClick={() => ph.phase !== p && patchPhoto(ph.id, { phase: p })}>
                            {PHOTO_PHASE_LABEL[p]}
                          </Chip>
                        ))}
                      </div>
                      <CaptionInput value={ph.caption ?? ''} disabled={busyId === ph.id || !!disabled} onSave={(v) => patchPhoto(ph.id, { caption: normalizeCaption(v) })} />
                      <button type="button" className="rounded-md px-1 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" disabled={busyId === ph.id || !!disabled} onClick={() => removePhoto(ph)}>
                        Hapus foto
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
