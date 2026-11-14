import { describe, expect, it } from 'vitest';
import { todayIso } from '../lib/todayIso';

describe('todayIso', () => {
  it('memakai tanggal setempat dengan angka nol di depan', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 10, 14, 0, 1))).toBe('2026-11-14');
  });
});
