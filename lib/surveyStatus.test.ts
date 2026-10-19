import { describe, it, expect } from 'vitest';
import { computeSurveyStatus, toDMY, roman, ageNo } from './surveyStatus';
import type { Baseline, Ev, StatusResult } from './surveyStatus';

/** Tanggal "hari ini" dibekukan supaya hasil tes tidak berubah seiring waktu. */
const TODAY = new Date(Date.UTC(2026, 9, 19)); // 19.10.2026

const baseline = (o: Partial<Baseline> = {}): Baseline => ({
  vessel_type: 'Tugboat',
  propelled: null,
  last_shaft: null,
  cert_expiry: '2028-06-30',
  anniv_day: null,
  anniv_month: null,
  year_built: 2010,
  last_renewal_no: null,
  last_special: '2023-06-30',
  last_annual: null,
  last_annual_no: null,
  last_intermediate: null,
  last_docking: null,
  postponed_until: null,
  baseline_at: null,
  ...o,
});

const ev = (o: Partial<Ev>): Ev => ({
  agenda_no: 'AG-1',
  start: null,
  completion: null,
  surveys: [],
  scenario: null,
  finished_at: '2026-01-01T00:00:00Z',
  ...o,
});

/** Agenda dihitung hanya bila di-finish SETELAH baseline_at. */
const AFTER_BASELINE = { baseline_at: '2025-01-01T00:00:00Z' };

const run = (b: Baseline, evs: Ev[] = [], today: Date = TODAY): StatusResult => {
  const r = computeSurveyStatus(b, evs, today);
  if (!r) throw new Error('computeSurveyStatus mengembalikan null');
  return r;
};
const row = (r: StatusResult, kindPrefix: string) => r.rows.find((x) => x.kind.startsWith(kindPrefix));

describe('helper', () => {
  it('roman', () => {
    expect(roman(4)).toBe('IV');
    expect(roman(9)).toBe('IX');
    expect(roman(14)).toBe('XIV');
  });
  it('ageNo: nomor Renewal menurut umur kapal (per 5 tahun)', () => {
    expect(ageNo(0)).toBe(0);
    expect(ageNo(-3)).toBe(0);
    expect(ageNo(5)).toBe(1);
    expect(ageNo(6)).toBe(2);
    expect(ageNo(10)).toBe(2);
    expect(ageNo(11)).toBe(3);
  });
  it('toDMY', () => {
    expect(toDMY(new Date(Date.UTC(2026, 0, 5)))).toBe('05.01.2026');
    expect(toDMY(null)).toBe('');
  });
});

describe('status awal (tanpa agenda)', () => {
  it('tanpa tanggal expiry sertifikat → null', () => {
    expect(computeSurveyStatus(baseline({ cert_expiry: null }), [], TODAY)).toBeNull();
  });

  it('baris Special, Intermediate, Annual, Docking dihitung dari expiry & periode', () => {
    const r = run(baseline());
    expect(toDMY(r.expiry)).toBe('30.06.2028');
    expect(toDMY(r.periodStart)).toBe('30.06.2023'); // expiry − 60 bulan
    expect(row(r, 'Special')?.due).toBe('30.06.2028');
    expect(row(r, 'Special')?.state).toBe('AKAN DATANG');
    // Intermediate: tahun ke-2 s/d ke-3 dari periode, ±3 bulan
    expect(row(r, 'Intermediate')?.range).toBe('30.03.2025 s/d 30.09.2026');
    expect(row(r, 'Intermediate')?.state).toBe('OVERDUE');
    expect(row(r, 'Annual Survey ke-1')?.range).toBe('30.03.2024 s/d 30.09.2024');
    // Docking: maksimum 36 bulan sejak awal periode bila belum pernah docking
    expect(row(r, 'Docking')?.due).toBe('30.06.2026');
    expect(row(r, 'Docking')?.state).toBe('OVERDUE');
  });

  it('nomor Renewal berikutnya mengikuti umur kapal', () => {
    expect(run(baseline()).nextNo).toBe(4); // dibangun 2010, expiry 2028 → umur 18 → IV
  });

  it('Docking memakai pembulatan akhir bulan (29 Feb + 36 bulan = 28 Feb)', () => {
    const r = run(baseline({ cert_expiry: '2029-02-28', last_special: '2024-02-29', last_docking: '2024-02-29' }));
    expect(row(r, 'Docking')?.due).toBe('28.02.2027');
  });
});

describe('Propeller Shaft: hanya kapal berpenggerak', () => {
  it('kapal bertenaga: ada baris, jatuh tempo 5 tahun dari Special bila tanggal terakhir kosong', () => {
    const r = run(baseline());
    expect(r.propelled).toBe(true);
    expect(row(r, 'Propeller Shaft')?.due).toBe('30.06.2028');
  });
  it('Barge tidak punya baris Propeller Shaft', () => {
    const r = run(baseline({ vessel_type: 'Barge' }));
    expect(r.propelled).toBe(false);
    expect(row(r, 'Propeller Shaft')).toBeUndefined();
  });
  it('jenis buatan sendiri bernama "tongkang" dianggap tanpa penggerak', () => {
    expect(row(run(baseline({ vessel_type: 'Tongkang Batubara' })), 'Propeller Shaft')).toBeUndefined();
  });
  it('flag propelled=true menimpa jenis kapal', () => {
    expect(row(run(baseline({ vessel_type: 'Barge', propelled: true })), 'Propeller Shaft')).toBeTruthy();
  });
});

describe('Annual: anniversary', () => {
  it('dikerjakan dalam window → anniversary tidak bergeser', () => {
    const r = run(baseline({ last_annual: '2024-06-15', last_annual_no: 1 }));
    expect(r.annCount).toBe(1);
    expect(toDMY(r.nextAnniv)).toBe('30.06.2025');
    expect(row(r, 'Annual Survey ke-2')?.last).toBe('15.06.2024 (Annual 1)');
  });
  it('dikerjakan lebih awal dari window → anniversary baru = completion + 3 bulan', () => {
    const r = run(baseline({ last_annual: '2024-02-10', last_annual_no: 1 }));
    expect([r.ad, r.am]).toEqual([10, 5]);
    expect(toDMY(r.nextAnniv)).toBe('10.05.2025');
  });
  it('Annual lama (sebelum awal periode) tidak dihitung', () => {
    const r = run(baseline({ last_annual: '2022-06-30', last_annual_no: 4 }));
    expect(r.annCount).toBe(0);
  });
});

describe('agenda & pembaruan manual', () => {
  it('agenda yang di-finish SEBELUM baseline diabaikan', () => {
    const r = run(
      baseline(AFTER_BASELINE),
      [ev({ agenda_no: 'LAMA', completion: '2024-06-10', surveys: ['A1'], finished_at: '2024-07-01T00:00:00Z' })]
    );
    expect(r.applied).toEqual([]);
    expect(r.annCount).toBe(0);
  });

  it('agenda yang di-finish SETELAH baseline dikreditkan', () => {
    const r = run(
      baseline(AFTER_BASELINE),
      [ev({ agenda_no: 'BARU', completion: '2024-06-10', surveys: ['A1'], finished_at: '2025-02-01T00:00:00Z' })]
    );
    expect(r.applied).toEqual(['BARU']);
    expect(r.annCount).toBe(1);
    expect(row(r, 'Annual Survey ke-2')?.last).toBe('10.06.2024 (Annual 1)');
  });

  it('Intermediate berdiri sendiri: selesai, tidak menggeser hitungan Annual', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2025-09-01', surveys: ['INT'] })]);
    expect(r.intDone).toBe(true);
    expect(row(r, 'Intermediate')?.state).toBe('SELESAI');
    expect(row(r, 'Intermediate')?.last).toBe('01.09.2025');
    expect(r.annCount).toBe(0);
  });

  it('Propeller Shaft selesai → jatuh tempo berikutnya 5 tahun dari completion', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2025-09-01', surveys: ['PS'] })]);
    expect(r.shaftDone).toBe(true);
    expect(row(r, 'Propeller Shaft')?.due).toBe('01.09.2030');
  });

  it('agenda tanpa survei yang dikenali diabaikan', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2025-09-01', surveys: [] })]);
    expect(r.applied).toEqual([]);
  });
});

describe('Renewal', () => {
  const REN_TODAY = new Date(Date.UTC(2028, 6, 1));

  it('selesai DALAM window → periode baru dihitung dari expiry lama (+5 tahun)', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ agenda_no: 'R1', completion: '2028-05-10', surveys: ['REN'], finished_at: '2028-05-11T00:00:00Z' })], REN_TODAY);
    expect(toDMY(r.expiry)).toBe('30.06.2033');
    expect(toDMY(r.periodStart)).toBe('30.06.2028');
    expect(r.nextNo).toBe(5);
    expect(r.annCount).toBe(0);
    expect(r.intDone).toBe(false); // siklus survei periodik di-reset
  });

  it('selesai TERLALU AWAL (> 3 bulan sebelum expiry) → periode baru dari tanggal completion', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2027-11-10', surveys: ['REN'] })]);
    expect(toDMY(r.expiry)).toBe('10.11.2032');
    expect([r.ad, r.am]).toEqual([10, 11]);
  });

  it('selesai TERLAMBAT (> 6 bulan setelah expiry, withdrawn) → periode baru dari tanggal completion', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2029-02-01', surveys: ['REN'] })], new Date(Date.UTC(2029, 2, 1)));
    expect(toDMY(r.expiry)).toBe('01.02.2034');
  });

  it('Renewal juga meng-update Docking terakhir', () => {
    const r = run(baseline(AFTER_BASELINE), [ev({ completion: '2028-05-10', surveys: ['REN'], finished_at: '2028-05-11T00:00:00Z' })], REN_TODAY);
    expect(r.lastDock && toDMY(r.lastDock)).toBe('10.05.2028');
    expect(row(r, 'Docking')?.due).toBe('10.05.2031');
  });
});

describe('perpanjangan / postponed', () => {
  const lewat = { cert_expiry: '2026-06-30', last_special: '2021-06-30' };

  it('lewat expiry tanpa postponed → OVERDUE', () => {
    expect(row(run(baseline(lewat)), 'Special')?.state).toBe('OVERDUE');
  });
  it('postponed setelah expiry → masih DALAM WINDOW sampai tanggal postponed', () => {
    const r = run(baseline({ ...lewat, postponed_until: '2027-01-31' }));
    expect(row(r, 'Special')?.state).toBe('DALAM WINDOW');
    expect(row(r, 'Special')?.postponed).toBe('31.01.2027');
  });
});
