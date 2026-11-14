/** Tanggal hari ini menurut jam perangkat, bentuk YYYY-MM-DD (bukan UTC, supaya tidak bergeser sehari di malam hari). */
export const todayIso = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
