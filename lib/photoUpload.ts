import { supabase } from './supabase';
import { contentMatches } from './fileSniff';
import { PHOTO_BUCKET, PHOTO_MAX_MB, THUMB_SIZE, checkPhotoFile, photoPath, thumbPath } from './newbuildingPhotos';

/* Unggah dan buka foto temuan di bucket privat newbuilding-photos.
   Baris di tabel nb_finding_photos dibuat oleh pemanggil setelah unggah berhasil. */

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function readImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Foto tidak bisa dibaca. Pakai format JPG atau PNG.'));
    i.src = url;
  });
}

// thumbnail 4:3: dipotong di tengah sampai memenuhi bingkai
async function thumbnail(file: File, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await readImage(url);
    const { width, height } = THUMB_SIZE;
    const k = Math.max(width / Math.max(1, img.naturalWidth), height / Math.max(1, img.naturalHeight));
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('Peramban tidak bisa membuat thumbnail.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat thumbnail.'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// kecilkan foto: sisi terpanjang maksimal 1600 px, JPEG kualitas 80%
async function shrink(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await readImage(url);
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('Peramban tidak bisa mengecilkan foto.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal mengecilkan foto.'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Kecilkan lalu unggah satu foto. Hasilnya lokasi berkas (path) yang disimpan di nb_finding_photos. */
export async function uploadFindingPhoto(file: File, projectId: string, findingId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const bad = checkPhotoFile(file);
  if (bad) throw new Error(bad);
  if (!(await contentMatches(file, file.type.toLowerCase()))) throw new Error('Isi file tidak cocok dengan jenis fotonya. Pakai foto asli (JPG, PNG, atau WEBP).');
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Masuk dulu untuk mengunggah foto.');
  const blob = await shrink(file);
  if (blob.size > PHOTO_MAX_MB * 1024 * 1024) throw new Error(`Foto terlalu besar (maksimal ${PHOTO_MAX_MB} MB).`);
  const path = photoPath(data.user.id, projectId, findingId, newId());
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error('Gagal mengunggah foto: ' + error.message + (/not found|bucket/i.test(error.message) ? ' (bucket newbuilding-photos belum dibuat di Supabase)' : ''));
  // thumbnail untuk layar dan Word; bila gagal, unggahan tetap sah (tampilan memakai foto penuh)
  try {
    const th = await thumbnail(file);
    await supabase.storage.from(PHOTO_BUCKET).upload(thumbPath(path), th, { contentType: 'image/jpeg' });
  } catch {
    /* abaikan */
  }
  return path;
}

/** Tautan bertanda waktu (1 jam) untuk banyak foto sekaligus. Kunci hasil = path. Foto yang gagal dibuka tidak ikut. */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!supabase || paths.length === 0) return out;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) throw new Error('Foto tidak bisa dibuka: ' + (error?.message ?? 'tidak ada akses') + '. Masuk dulu bila belum.');
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Hapus berkas foto dari bucket. Galat diabaikan: berkas yatim tidak mengganggu tampilan. */
export async function removePhotoFiles(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return;
  const all = paths.flatMap((p) => [p, thumbPath(p)]);
  for (let i = 0; i < all.length; i += 100) {
    try {
      await supabase.storage.from(PHOTO_BUCKET).remove(all.slice(i, i + 100));
    } catch {
      /* abaikan */
    }
  }
}
