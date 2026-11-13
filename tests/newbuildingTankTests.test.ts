import { describe, expect, it } from 'vitest';
import { parseHead, summarizeTankTests, tankSummaryText } from '../lib/newbuildingTankTests';

describe('Daftar uji per kompartemen', () => {
  it('ringkasan tanpa data', () => {
    expect(summarizeTankTests([])).toEqual({ total: 0, leakPass: 0, structNeeded: 0, structPass: 0, failed: 0 });
  });

  it('ringkasan menghitung leak, struktural, dan yang tidak lulus', () => {
    const s = summarizeTankTests([
      { leak_status: 'lulus', struct_status: 'lulus' },
      { leak_status: 'lulus', struct_status: 'tidak_perlu' },
      { leak_status: 'tidak_lulus', struct_status: 'belum' },
      { leak_status: 'belum', struct_status: 'tidak_lulus' },
    ]);
    expect(s).toEqual({ total: 4, leakPass: 2, structNeeded: 3, structPass: 1, failed: 2 });
  });

  it('tanda tidak perlu tidak dihitung sebagai wajib uji struktural', () => {
    const s = summarizeTankTests([{ leak_status: 'lulus', struct_status: 'tidak_perlu' }]);
    expect(s.structNeeded).toBe(0);
    expect(tankSummaryText('struct', s)).toBe('0 dari 0 lulus uji struktural');
  });

  it('teks ringkasan leak', () => {
    const s = summarizeTankTests([{ leak_status: 'lulus', struct_status: 'belum' }, { leak_status: 'belum', struct_status: 'belum' }]);
    expect(tankSummaryText('leak', s)).toBe('1 dari 2 kompartemen lulus leak test');
  });

  it('parseHead menerima koma dan menolak yang bukan angka', () => {
    expect(parseHead('2,4')).toBe(2.4);
    expect(parseHead(' 1.66 ')).toBe(1.66);
    expect(parseHead('0')).toBe(0);
    expect(parseHead('abc')).toBeNull();
    expect(parseHead('-1')).toBeNull();
    expect(parseHead('1000')).toBeNull();
  });
});
