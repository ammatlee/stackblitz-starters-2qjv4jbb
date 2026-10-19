/** Utilitas tanggal (UTC, perilaku EDATE seperti Excel) dan helper kecil untuk halaman Class Validity. */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const parseD = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
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
export const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) ? v : null;
};
export const daysBetween = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
export const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
