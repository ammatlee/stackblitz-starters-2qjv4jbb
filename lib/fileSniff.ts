/**
 * Memeriksa ISI file (bukan hanya ekstensi / tipe dari peramban) sebelum diunggah.
 * Fungsi murni: menerima beberapa byte awal file.
 */
export type SniffedKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'gif' | null;

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

export function sniffBytes(b: Uint8Array): SniffedKind {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif'; // GIF8
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF....WEBP
  return null;
}

export const KIND_BY_MIME: Record<string, SniffedKind> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** true bila isi file cocok dengan jenis yang diklaim (mis. file .pdf benar-benar PDF). */
export async function contentMatches(file: Blob, claimedMime: string): Promise<boolean> {
  const want = KIND_BY_MIME[claimedMime];
  if (!want) return false;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffBytes(head) === want;
}
