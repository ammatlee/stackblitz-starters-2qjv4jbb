import { describe, it, expect } from 'vitest';
import { computeStatus } from '../lib/classValidity/statusCalc';
import { BASE, pick } from './fixtures/cases';

/** Kapal rekaan; jatuh tempo poros (sudah termasuk extension tercatat) = 08.05.2026. */
/** shaftCap = jatuh tempo asli + batas extension (sistem open: 1 tahun → 08.05.2027). */
const info = (shaftDue: string | null, shaftCap: string | null = '2027-05-08') => ({ nextAnniv: '2026-03-15', annCount: 3, intDone: true, dock1Done: true, shaftDone: false, lastDock: null, postponed: null, shaftDue, shaftCap });
const run = (o: Partial<Parameters<typeof computeStatus>[0]>) => computeStatus({ ...BASE, sel: pick('PS'), ...o });
const ps = (r: ReturnType<typeof computeStatus>) => r.rows.find((x) => x.key === 'PS')!;

describe('Propeller Shaft Survey — jatuh tempo poros', () => {
  it('terlambat ≤ 6 bulan dari jatuh tempo → SUSPENDED (bukan VALID)', () => {
    const r = run({ startDate: '2026-08-04', compDate: '2026-08-10', statusInfo: info('2026-05-08'), shaftPlan: 'M4' });
    expect(ps(r).status).toBe('SUSPENDED');
    expect(r.overall).toBe('SUSPENDED');
    expect(r.why(ps(r))).toContain('→ SUSPENDED');
  });
  it('selesai tepat di batas 6 bulan (08.11.2026) → masih SUSPENDED; sehari setelahnya → WITHDRAWN', () => {
    expect(ps(run({ startDate: '2026-08-01', compDate: '2026-11-08', statusInfo: info('2026-05-08') })).status).toBe('SUSPENDED');
    const r = run({ startDate: '2026-08-01', compDate: '2026-11-09', statusInfo: info('2026-05-08') });
    expect(ps(r).status).toBe('WITHDRAWN');
    expect(r.overall).toBe('WITHDRAWN');
    expect(r.why(ps(r))).toContain('WITHDRAWN');
  });
  it('kasus Karya Agung: mulai 04.11.2026, selesai 10.11.2026, due 08.05.2026 → WITHDRAWN', () => {
    const r = run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: info('2026-05-08'), shaftPlan: 'M4' });
    expect(ps(r).status).toBe('WITHDRAWN');
  });
  it('Method/extension belum dipilih → tetap terlambat, dengan penjelasan', () => {
    const r = run({ startDate: '2026-08-04', compDate: '2026-08-10', statusInfo: info('2026-05-08'), shaftPlan: '' });
    expect(ps(r).status).toBe('SUSPENDED');
    expect(r.why(ps(r))).toContain('belum dipilih');
  });
  it('extension 3 bulan dipilih, mulai 04.08.2026 (≤ 08.08.2026) → VALID, jatuh tempo baru dari jatuh tempo asli', () => {
    const r = run({ startDate: '2026-08-04', compDate: '2026-08-10', statusInfo: info('2026-05-08'), shaftPlan: 'E3' });
    expect(ps(r).status).toBe('VALID');
    expect(r.why(ps(r))).toContain('08.08.2026');
  });
  it('extension 3 bulan tetapi mulai 04.11.2026 (lewat 08.08.2026) → tidak menutup, SUSPENDED/WITHDRAWN menurut jatuh tempo asli', () => {
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-08', statusInfo: info('2026-05-08'), shaftPlan: 'E3' })).status).toBe('SUSPENDED');
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: info('2026-05-08'), shaftPlan: 'E3' })).status).toBe('WITHDRAWN');
  });
  it('extension 1 tahun, mulai 04.11.2026 → VALID (maks. 08.05.2027 dari jatuh tempo asli)', () => {
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: info('2026-05-08'), shaftPlan: 'E1' })).status).toBe('VALID');
  });
  it('extension 1 tahun mulai 09.05.2027 (lewat batas 1 tahun) → tidak valid', () => {
    expect(ps(run({ startDate: '2027-05-09', compDate: '2027-05-12', statusInfo: info('2026-05-08'), shaftPlan: 'E1' })).status).toBe('SUSPENDED');
  });
  it('sudah ada extension 3 bulan tercatat (due 08.08.2026, cap 08.05.2027) + extension 1 tahun → dibatasi cap 08.05.2027', () => {
    const r = run({ startDate: '2027-05-01', compDate: '2027-05-05', statusInfo: info('2026-08-08'), shaftPlan: 'E1' });
    expect(ps(r).status).toBe('VALID');
    expect(r.why(ps(r))).toContain('dibatasi');
  });
  it('closed loop: extension setelah jatuh tempo tidak menutup (parameter lama) → SUSPENDED, WITHDRAWN bila > 6 bulan', () => {
    const r = run({ startDate: '2026-08-04', compDate: '2026-08-10', statusInfo: info('2026-05-08', null), shaftPlan: 'E1' });
    expect(ps(r).status).toBe('SUSPENDED');
    expect(r.why(ps(r))).toContain('SEBELUM jatuh tempo');
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: info('2026-05-08', null), shaftPlan: 'E25' })).status).toBe('WITHDRAWN');
  });
  it('dimulai tepat pada hari jatuh tempo → VALID', () => {
    expect(ps(run({ startDate: '2026-05-08', compDate: '2026-05-12', statusInfo: info('2026-05-08') })).status).toBe('VALID');
  });
  it('dimulai sebelum jatuh tempo, selesai sesudahnya → VALID (yang dinilai tanggal mulai)', () => {
    expect(ps(run({ startDate: '2026-05-01', compDate: '2026-06-01', statusInfo: info('2026-05-08') })).status).toBe('VALID');
  });
  it('jatuh tempo belum diketahui (Survey Status kosong) → tidak bisa dinilai terlambat, VALID', () => {
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: null })).status).toBe('VALID');
    expect(ps(run({ startDate: '2026-11-04', compDate: '2026-11-10', statusInfo: info(null) })).status).toBe('VALID');
  });
  it('tanggal inspeksi kosong → INPUT REQUIRED', () => {
    expect(ps(run({ statusInfo: info('2026-05-08') })).status).toBe('INPUT REQUIRED');
  });
});
