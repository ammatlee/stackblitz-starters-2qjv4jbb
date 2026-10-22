import { describe, it, expect } from 'vitest';
import { fetchAllRows, PAGE_SIZE } from '../lib/fetchAll';

const fake = (total: number) => (from: number, to: number) =>
  Promise.resolve({ data: Array.from({ length: Math.max(0, Math.min(total, to + 1) - from) }, (_, i) => from + i), error: null });

describe('fetchAllRows — paging', () => {
  it('data kurang dari satu halaman', async () => expect((await fetchAllRows(fake(5))).data).toHaveLength(5));
  it('tepat satu halaman penuh: halaman kosong berikutnya menghentikan', async () => expect((await fetchAllRows(fake(PAGE_SIZE))).data).toHaveLength(PAGE_SIZE));
  it('2.500 baris tidak terpotong di 1.000', async () => {
    const r = await fetchAllRows(fake(2500));
    expect(r.data).toHaveLength(2500);
    expect(r.data[2499]).toBe(2499);
  });
  it('kesalahan di tengah dikembalikan, bukan data setengah jadi', async () => {
    let n = 0;
    const r = await fetchAllRows(() => Promise.resolve(++n === 2 ? { data: null, error: { message: 'gagal' } } : { data: Array.from({ length: PAGE_SIZE }, () => 0), error: null }));
    expect(r.error?.message).toBe('gagal');
    expect(r.data).toHaveLength(0);
  });
});
