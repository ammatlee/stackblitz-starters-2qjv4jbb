import { describe, it, expect } from 'vitest';
import { num, parseD, addM, fmt } from '../lib/classValidity/dateUtils';

describe('num — baca angka dari input teks', () => {
  it.each([['50', 50], ['50,5', 50.5], ['50.5', 50.5], ['1.234,5', 1234.5], ['1,234.5', 1234.5], [' 7 ', 7], ['-0,2', -0.2], ['.5', 0.5]])('"%s" → %d', (s, v) => expect(num(s)).toBe(v));
  it.each([[''], ['   '], ['abc'], ['12abc'], ['1,2,3'], ['--1']])('"%s" → null (bukan angka)', (s) => expect(num(s)).toBeNull());
});

describe('parseD — tanggal yyyy-mm-dd', () => {
  it('tanggal valid', () => expect(parseD('2028-03-15')?.toISOString().slice(0, 10)).toBe('2028-03-15'));
  it('29 Feb tahun kabisat valid', () => expect(parseD('2028-02-29')).not.toBeNull());
  it('30 Feb tidak digeser jadi 2 Mar → null', () => expect(parseD('2026-02-30')).toBeNull());
  it('29 Feb bukan tahun kabisat → null', () => expect(parseD('2027-02-29')).toBeNull());
  it('timestamp dari database: bagian jam diabaikan', () => expect(parseD('2026-01-05T10:00:00Z')?.toISOString().slice(0, 10)).toBe('2026-01-05'));
  it.each([[''], ['15-03-2028'], ['2028/03/15'], ['2028-13-01']])('"%s" → null', (s) => expect(parseD(s)).toBeNull());
});

describe('addM — tambah bulan gaya EDATE', () => {
  const a = (s: string, n: number) => addM(parseD(s)!, n).toISOString().slice(0, 10);
  it('31 Jan + 1 bulan → 28 Feb (tidak lompat ke Maret)', () => expect(a('2027-01-31', 1)).toBe('2027-02-28'));
  it('31 Jan + 1 bulan, tahun kabisat → 29 Feb', () => expect(a('2028-01-31', 1)).toBe('2028-02-29'));
  it('lintas tahun mundur: 15 Mar − 3 bulan → 15 Des tahun sebelumnya', () => expect(a('2028-03-15', -3)).toBe('2027-12-15'));
  it('+60 bulan = +5 tahun', () => expect(a('2028-03-15', 60)).toBe('2033-03-15'));
  it('fmt tampilan dd.mm.yyyy', () => expect(fmt(parseD('2028-03-05'))).toBe('05.03.2028'));
});
