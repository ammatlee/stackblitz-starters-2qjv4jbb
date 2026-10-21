import { supabase } from './supabase';

export const BUCKET = 'bulletin-files';
export const MAX_MB = 5;
// lampiran (PDF/foto) disimpan di bucket PRIVAT dan dibuka lewat tautan bertanda waktu; gambar di isi/sampul tetap di bucket publik
export const PRIVATE_BUCKET = 'bulletin-private';

// bucket kosong = lampiran lama di bucket publik (pakai url tersimpan); bucket terisi = bucket privat (url dibuat saat dibuka)
export type Attachment = { name: string; path: string; url: string; size: number; type: string; bucket?: string };

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

async function userId(): Promise<string> {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Masuk dulu untuk mengunggah file.');
  return data.user.id;
}

// kecilkan foto: sisi terpanjang maksimal 1600 px, JPEG kualitas 80%
async function shrink(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Gambar tidak bisa dibaca. Pakai format JPG atau PNG.'));
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('Peramban tidak bisa mengecilkan gambar.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) =>
      cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal mengecilkan gambar.'))), 'image/jpeg', quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const publicUrl = (path: string) => supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;

// gambar untuk disisipkan di isi: dikecilkan lalu diunggah, hasilnya alamat gambar
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error('Gambar harus JPG, PNG, WEBP, atau GIF.');
  const uid = await userId();
  const gif = file.type === 'image/gif';
  const blob: Blob = gif ? file : await shrink(file);
  if (blob.size > MAX_MB * 1024 * 1024) throw new Error('Gambar terlalu besar (maksimal ' + MAX_MB + ' MB).');
  const path = uid + '/' + newId() + (gif ? '.gif' : '.jpg');
  const { error } = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType: gif ? 'image/gif' : 'image/jpeg' });
  if (error) throw new Error('Gagal mengunggah gambar: ' + error.message);
  return publicUrl(path);
}

// lampiran: PDF atau gambar (maksimal 5 MB), hanya bisa dibaca di penampil
export async function uploadAttachment(file: File): Promise<Attachment> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = MIME_BY_EXT[ext];
  if (!type) throw new Error('Jenis file tidak didukung: ' + file.name + ' (boleh PDF, JPG, PNG, atau WEBP). Word/Excel: ubah dulu ke PDF.');
  if (file.size > MAX_MB * 1024 * 1024 && type === 'application/pdf') throw new Error(file.name + ' terlalu besar (maksimal ' + MAX_MB + ' MB).');
  const uid = await userId();
  const isImg = type.startsWith('image/');
  const blob: Blob = isImg ? await shrink(file, 2400, 0.85) : file;
  if (blob.size > MAX_MB * 1024 * 1024) throw new Error(file.name + ' terlalu besar (maksimal ' + MAX_MB + ' MB).');
  const base = file.name.replace(/\.[^.]+$/, '');
  const finalName = isImg ? base + '.jpg' : file.name;
  const finalType = isImg ? 'image/jpeg' : type;
  const safe = finalName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  const path = uid + '/' + newId() + '/' + safe;
  const { error } = await supabase!.storage.from(PRIVATE_BUCKET).upload(path, blob, { contentType: finalType });
  if (error) throw new Error('Gagal mengunggah ' + file.name + ': ' + error.message + (/not found|bucket/i.test(error.message) ? ' (bucket privat belum dibuat di Supabase)' : ''));
  return { name: finalName, path, url: '', size: blob.size, type: finalType, bucket: PRIVATE_BUCKET };
}

// alamat untuk membuka lampiran: lampiran lama pakai url tersimpan, lampiran baru memakai tautan bertanda waktu (1 jam)
export async function attachmentUrl(a: Attachment): Promise<string> {
  if (!a.bucket) return a.url;
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await supabase.storage.from(a.bucket).createSignedUrl(a.path, 3600);
  if (error || !data) throw new Error('Lampiran tidak bisa dibuka: ' + (error?.message ?? 'tidak ada akses') + '. Masuk dulu bila belum.');
  return data.signedUrl;
}

// hapus lampiran dari bucket masing-masing (lama = publik, baru = privat)
export async function removeAttachments(list: Attachment[]): Promise<void> {
  if (!supabase || list.length === 0) return;
  const by = new Map<string, string[]>();
  list.forEach((a) => by.set(a.bucket ?? BUCKET, [...(by.get(a.bucket ?? BUCKET) ?? []), a.path]));
  for (const [bucket, paths] of Array.from(by.entries())) {
    try {
      await supabase.storage.from(bucket).remove(paths);
    } catch {
      /* abaikan: file yatim tidak mengganggu tampilan */
    }
  }
}

export async function removeFiles(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    /* abaikan: file yatim tidak mengganggu tampilan */
  }
}

// daftar path gambar milik bucket ini yang dipakai di dalam HTML isi
export function pathsInHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const re = new RegExp('/storage/v1/object/public/' + BUCKET + '/([^"\'?\\s<>]+)', 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(decodeURIComponent(m[1]));
    } catch {
      out.push(m[1]);
    }
  }
  return out;
}

export const fmtSize = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
