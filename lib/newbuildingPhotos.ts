/* Foto dokumentasi temuan (punchlist). Bagian murni: tipe, label, penamaan, dan pemeriksaan.
   Unggah ke Storage ada di lib/photoUpload.ts. Tidak mengubah status temuan. */

   import { findingCode } from './newbuildingFindings';

   /** temuan = kondisi saat ditemukan; perbaikan = setelah diperbaiki. */
   export type PhotoPhase = 'temuan' | 'perbaikan';
   
   export type FindingPhoto = {
     id: string;
     finding_id: string;
     /** Lokasi berkas di bucket Storage. */
     path: string;
     caption: string | null;
     phase: PhotoPhase;
     /** Nomor foto per temuan (Foto 1, 2, ...). Diisi otomatis oleh database. */
     seq: number | null;
   };
   
   export const PHOTO_BUCKET = 'newbuilding-photos';
   export const PHOTO_PHASES: PhotoPhase[] = ['temuan', 'perbaikan'];
   export const PHOTO_PHASE_LABEL: Record<PhotoPhase, string> = { temuan: 'Kondisi temuan', perbaikan: 'Setelah perbaikan' };
   export const PHOTO_PHASE_SHORT: Record<PhotoPhase, string> = { temuan: 'Temuan', perbaikan: 'Perbaikan' };
   
   /** Batas ukuran hasil akhir (setelah dikecilkan) dan jenis file yang diterima. */
   export const PHOTO_MAX_MB = 5;
   /** Batas berkas asli dari kamera sebelum dikecilkan. */
   export const PHOTO_RAW_MAX_MB = 30;
   export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
   export const PHOTO_CAPTION_MAX = 200;
   
   export const photoCode = (seq: number | null | undefined): string => (seq == null ? 'Foto' : `Foto ${seq}`);
   
   /** Rujukan lengkap untuk rekap, mis. "PL-007 / Foto 2". */
   export const photoTitle = (findingSeq: number | null | undefined, photoSeq: number | null | undefined): string => {
     const f = findingCode(findingSeq);
     return f === '' ? photoCode(photoSeq) : `${f} / ${photoCode(photoSeq)}`;
   };
   
   /** Pesan galat bila file tidak bisa dipakai; null bila boleh dilanjutkan. */
   export function checkPhotoFile(f: { type: string; size: number }): string | null {
     if (!PHOTO_TYPES.includes(f.type.toLowerCase())) return 'Foto harus berformat JPG, PNG, atau WEBP.';
     if (f.size > PHOTO_RAW_MAX_MB * 1024 * 1024) return `Foto terlalu besar (maksimal ${PHOTO_RAW_MAX_MB} MB sebelum dikecilkan).`;
     return null;
   }
   
   /** Lokasi berkas: folder pertama = id akun (dipakai aturan akses Storage), lalu proyek dan temuan. */
   export const photoPath = (uid: string, projectId: string, findingId: string, fileId: string): string => `${uid}/${projectId}/${findingId}/${fileId}.jpg`;
   
   /** Bingkai thumbnail 4:3: dipotong di tengah saat unggah, dipakai di layar dan di Word. */
   export const THUMB_SIZE = { width: 480, height: 360 };
   
   /** Lokasi thumbnail satu foto, di folder yang sama: x.jpg menjadi x.thumb.jpg. */
   export const thumbPath = (path: string): string => path.replace(/\.jpg$/i, '') + '.thumb.jpg';
   
   /** Keterangan dari ketikan: dipangkas, kosong = null, maksimal 200 huruf. */
   export function normalizeCaption(v: string): string | null {
     const t = v.trim();
     return t === '' ? null : t.slice(0, PHOTO_CAPTION_MAX);
   }
   
   /** Urut menurut nomor foto; yang belum bernomor di akhir. */
   export function sortPhotos<T extends { seq: number | null }>(rows: T[]): T[] {
     return rows
       .map((r, i) => ({ r, i }))
       .sort((a, b) => {
         const sa = a.r.seq ?? Number.MAX_SAFE_INTEGER;
         const sb = b.r.seq ?? Number.MAX_SAFE_INTEGER;
         return sa !== sb ? sa - sb : a.i - b.i;
       })
       .map((x) => x.r);
   }
   
   /** Ringkasan singkat, mis. "3 foto (2 temuan, 1 perbaikan)". Kosong bila tidak ada foto. */
   export function photoSummary(rows: { phase: PhotoPhase }[]): string {
     if (rows.length === 0) return '';
     const parts = PHOTO_PHASES.map((p) => ({ p, n: rows.filter((r) => r.phase === p).length }))
       .filter((x) => x.n > 0)
       .map((x) => `${x.n} ${PHOTO_PHASE_SHORT[x.p].toLowerCase()}`);
     return `${rows.length} foto (${parts.join(', ')})`;
   }
   