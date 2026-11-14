import { describe, expect, it } from 'vitest';
import { countTankStates, matchesQuery, tankState } from '../lib/newbuildingListView';

describe('matchesQuery', () => {
  it('ketikan kosong cocok dengan semuanya', () => {
    expect(matchesQuery('', ['apa saja'])).toBe(true);
    expect(matchesQuery('   ', [])).toBe(true);
  });

  it('semua kata harus ada, urutan bebas, huruf besar kecil tidak dibedakan', () => {
    expect(matchesQuery('bocor fore', ['Fore peak tank', 'Leak test: 5 titik bocor'])).toBe(true);
    expect(matchesQuery('BOCOR', ['titik bocor'])).toBe(true);
    expect(matchesQuery('bocor deformasi', ['titik bocor'])).toBe(false);
  });

  it('bagian kosong atau null diabaikan', () => {
    expect(matchesQuery('pl-003', [null, undefined, '', 'PL-003'])).toBe(true);
    expect(matchesQuery('x', [null, undefined])).toBe(false);
  });
});

describe('tankState', () => {
  it('gagal bila salah satu uji tidak lulus', () => {
    expect(tankState({ leak_status: 'tidak_lulus', struct_status: 'belum' })).toBe('gagal');
    expect(tankState({ leak_status: 'lulus', struct_status: 'tidak_lulus' })).toBe('gagal');
  });

  it('lulus bila leak lulus dan struktur lulus atau tidak perlu', () => {
    expect(tankState({ leak_status: 'lulus', struct_status: 'lulus' })).toBe('lulus');
    expect(tankState({ leak_status: 'lulus', struct_status: 'tidak_perlu' })).toBe('lulus');
  });

  it('selain itu belum selesai', () => {
    expect(tankState({ leak_status: 'belum', struct_status: 'belum' })).toBe('belum');
    expect(tankState({ leak_status: 'lulus', struct_status: 'belum' })).toBe('belum');
    expect(tankState({ leak_status: 'belum', struct_status: 'lulus' })).toBe('belum');
  });

  it('menghitung tiap keadaan', () => {
    const rows = [
      { leak_status: 'lulus' as const, struct_status: 'lulus' as const },
      { leak_status: 'tidak_lulus' as const, struct_status: 'belum' as const },
      { leak_status: 'belum' as const, struct_status: 'belum' as const },
      { leak_status: 'belum' as const, struct_status: 'tidak_perlu' as const },
    ];
    expect(countTankStates(rows)).toEqual({ gagal: 1, belum: 2, lulus: 1 });
  });
});
