/** Utilitas tanggal (UTC, perilaku EDATE seperti Excel) dan helper kecil untuk halaman Class Validity. */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** Terima 'yyyy-mm-dd' (bagian setelah 10 karakter pertama diabaikan, mis. timestamp). Tanggal tidak valid (30 Feb) → null, tidak digeser. */
export const parseD = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const t = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(t + 'T00:00:00Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : d;
};
export const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const mk = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, 1));
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, dim(t.getUTCFullYear(), t.getUTCMonth()))));
};
export const addM = (d: Date, n: number) => mk(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
export const fmt = (d: Date | null | undefined) =>
  d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '—';
export const fmtDM = (d: number, m: number) => `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
/**
 * Baca angka dari input teks. Koma = desimal ("50,5"); bila ada titik dan koma, yang muncul terakhir adalah desimal
 * ("1.234,5" = 1234,5; "1,234.5" = 1234,5). Teks bukan angka murni ("12abc") → null, bukan dibaca sebagian.
 */
export const num = (s: string): number | null => {
  let u = (s ?? '').trim();
  if (!u) return null;
  if (u.includes(',') && u.includes('.')) u = u.lastIndexOf(',') > u.lastIndexOf('.') ? u.replace(/\./g, '').replace(',', '.') : u.replace(/,/g, '');
  else u = u.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(u)) return null;
  const v = Number(u);
  return isFinite(v) ? v : null;
};
export const daysBetween = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
