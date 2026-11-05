import { describe, it, expect } from 'vitest';
import { computeStatus } from '../lib/classValidity/statusCalc';
import { BASE, pick } from './fixtures/cases';

/** Kapal rekaan; jatuh tempo poros (sudah termasuk extension tercatat) = 08.05.2026. */
const info = (shaftDue: string | null) => ({ nextAnniv: '2026-03-15', annCount: 3, intDone: true, dock1Done: true, shaftDone: false, lastDock: null, postponed: null, shaftDue });
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
  it('extension dipilih tetapi sudah lewat jatuh tempo → tetap terlambat (SUSPENDED)', () => {
    const r = run({ startDate: '2026-08-04', compDate: '2026-08-10', statusInfo: info('2026-05-08'), shaftPlan: 'E1' });
    expect(ps(r).status).toBe('SUSPENDED');
    expect(r.why(ps(r))).toContain('SEBELUM jatuh tempo');
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
