/**
 * Mengambil SEMUA baris sebuah query dengan paging. Supabase memotong hasil di batas baris per permintaan
 * (biasanya 1.000) tanpa pesan kesalahan, sehingga data bisa hilang diam-diam bila tidak di-page.
 * Query harus punya urutan yang stabil (akhiri dengan .order('id')) supaya halaman tidak tumpang tindih.
 */
type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export const PAGE_SIZE = 1000;
const MAX_PAGES = 100; // pengaman: maksimal 100.000 baris

export async function fetchAllRows(build: (from: number, to: number) => Page): Promise<{ data: unknown[]; error: { message: string } | null }> {
  const out: unknown[] = [];
  for (let p = 0; p < MAX_PAGES; p += 1) {
    const from = p * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: [], error };
    const rows = Array.isArray(data) ? data : [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { data: out, error: null };
}
