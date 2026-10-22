/**
 * Kasus uji untuk computeStatus (Modul 1 – Class Status).
 *
 * KASUS-xx di bawah adalah data SINTETIS (kapal rekaan): hasil yang diharapkan diturunkan dari aturan ITS Part A /
 * Nota Dinas BKI 87/SVY/III/2020 seperti yang tertulis di surveyRules.ts, bukan dari kapal nyata.
 * Kasus nyata (mis. Aquarius, Dillah) ditaruh di REAL_CASES di bagian bawah — isi dengan angka dan hasil yang SUDAH
 * Anda verifikasi manual. Kasus nyata adalah penjaga terpenting: bila gagal, berarti aturan baru mengubah hasil lama.
 *
 * Kapal rekaan: sertifikat expiry 15 Mar 2028 → periode mulai 15 Mar 2023, anniversary 15 Mar.
 *   Window Annual 1 = 15 Des 2023 s/d 15 Jun 2024 (batas withdrawal 15 Des 2024)
 *   Window Annual 2 = 15 Des 2024 s/d 15 Jun 2025, Annual 3 = 15 Des 2025 s/d 15 Jun 2026
 *   Window Intermediate = 15 Des 2024 s/d 15 Jun 2026
 *   Renewal: boleh mulai 15 Des 2027; expiry 15 Mar 2028; withdrawal setelah 15 Sep 2028
 */
import type { StatusInput } from '../../lib/classValidity/statusCalc';
import type { Sel, SurveyKey } from '../../lib/classValidity/surveyRules';

export const NO_SEL: Sel = { A1: false, A2: false, A3: false, A4: false, A5: false, INT: false, D1: false, REN: false, PS: false };
export const pick = (...k: SurveyKey[]): Sel => k.reduce((s, x) => ({ ...s, [x]: true }), { ...NO_SEL });

export const BASE: StatusInput = {
  expiry: '2028-03-15', startDate: '', compDate: '', extension: '', yearBuilt: '2010',
  annivD: null, annivM: null, sel: NO_SEL, recDue: '', recDone: '', recAssess: '', lastNo: 3, statusInfo: null,
};

export type CaseDef = {
  id: string;
  title: string;
  input: Partial<StatusInput>;
  expect: {
    overall: string;
    /** status survei terpilih (atau yang otomatis dianggap terlewat) per kunci */
    statuses?: Partial<Record<SurveyKey, string>>;
    /** skenario reinstatement: 'A' | 'B' | 'C' | 'D' | null */
    scenario: string | null;
    recSt?: string;
    /** periode sertifikat baru (yyyy-mm-dd), null bila tidak ada */
    newPeriod?: { start: string; expiry: string } | null;
    /** anniversary Annual bergeser (Annual in advance) → [hari, bulan]; null = tidak bergeser */
    shiftTo?: [number, number] | null;
  };
};

export const CASES: CaseDef[] = [
  { id: 'KASUS-01', title: 'Annual 1 dalam window → VALID',
    input: { sel: pick('A1'), startDate: '2024-02-01', compDate: '2024-02-05' },
    expect: { overall: 'VALID', statuses: { A1: 'VALID' }, scenario: null, newPeriod: null, shiftTo: null } },
  { id: 'KASUS-02', title: 'Annual 1 dimulai tepat di window end (15 Jun 2024) → masih VALID',
    input: { sel: pick('A1'), startDate: '2024-06-15', compDate: '2024-06-20' },
    expect: { overall: 'VALID', statuses: { A1: 'VALID' }, scenario: null } },
  { id: 'KASUS-03', title: 'Annual 1 dimulai sehari setelah window end → SUSPENDED',
    input: { sel: pick('A1'), startDate: '2024-06-16', compDate: '2024-06-16' },
    expect: { overall: 'SUSPENDED', statuses: { A1: 'SUSPENDED' }, scenario: null } },
  { id: 'KASUS-04', title: 'Annual 1 selesai tepat di batas withdrawal (15 Des 2024) → masih SUSPENDED',
    input: { sel: pick('A1'), startDate: '2024-12-15', compDate: '2024-12-15' },
    expect: { overall: 'SUSPENDED', statuses: { A1: 'SUSPENDED' }, scenario: null } },
  { id: 'KASUS-05', title: 'Annual 1 selesai sehari setelah batas withdrawal → WITHDRAWN, Case A',
    input: { sel: pick('A1'), startDate: '2024-12-16', compDate: '2024-12-16' },
    expect: { overall: 'WITHDRAWN', statuses: { A1: 'WITHDRAWN' }, scenario: 'A' } },
  { id: 'KASUS-06', title: 'Annual 1 lebih awal dari window start → anniversary bergeser ke 3 bulan setelah completion',
    input: { sel: pick('A1'), startDate: '2023-10-01', compDate: '2023-10-01' },
    expect: { overall: 'VALID', statuses: { A1: 'VALID' }, scenario: null, shiftTo: [1, 1] } },
  { id: 'KASUS-07', title: 'Renewal tepat waktu → periode lama berlaku (expiry lama + 5 tahun)',
    input: { sel: pick('REN'), startDate: '2028-02-01', compDate: '2028-03-01' },
    expect: { overall: 'VALID', statuses: { REN: 'VALID' }, scenario: null, newPeriod: { start: '2028-03-15', expiry: '2033-03-15' } } },
  { id: 'KASUS-08', title: 'Renewal selesai > 3 bulan sebelum expiry → periode baru dari completion',
    input: { sel: pick('REN'), startDate: '2027-12-01', compDate: '2027-12-14' },
    expect: { overall: 'VALID', statuses: { REN: 'VALID' }, scenario: null, newPeriod: { start: '2027-12-14', expiry: '2032-12-14' } } },
  { id: 'KASUS-09', title: 'Renewal selesai tepat expiry − 3 bulan → belum dianggap early',
    input: { sel: pick('REN'), startDate: '2027-12-01', compDate: '2027-12-15' },
    expect: { overall: 'VALID', statuses: { REN: 'VALID' }, scenario: null, newPeriod: { start: '2028-03-15', expiry: '2033-03-15' } } },
  { id: 'KASUS-10', title: 'Renewal dimulai & selesai pada masa suspend → SUSPENDED, periode dari sertifikat lama (Nota Dinas 5a)',
    input: { sel: pick('REN'), startDate: '2028-04-01', compDate: '2028-05-01' },
    expect: { overall: 'SUSPENDED', statuses: { REN: 'SUSPENDED' }, scenario: null, newPeriod: { start: '2028-03-15', expiry: '2033-03-15' } } },
  { id: 'KASUS-11', title: 'Renewal selesai tepat expiry + 6 bulan → masih SUSPENDED',
    input: { sel: pick('REN'), startDate: '2028-04-01', compDate: '2028-09-15' },
    expect: { overall: 'SUSPENDED', statuses: { REN: 'SUSPENDED' }, scenario: null, newPeriod: { start: '2028-03-15', expiry: '2033-03-15' } } },
  { id: 'KASUS-12', title: 'Renewal selesai sehari setelah expiry + 6 bulan → WITHDRAWN, Case D, periode baru dari completion',
    input: { sel: pick('REN'), startDate: '2028-09-16', compDate: '2028-09-16' },
    expect: { overall: 'WITHDRAWN', statuses: { REN: 'WITHDRAWN' }, scenario: 'D', newPeriod: { start: '2028-09-16', expiry: '2033-09-16' } } },
  { id: 'KASUS-13', title: 'Renewal dengan extension 3 bulan disetujui: dimulai dalam extension → VALID',
    input: { sel: pick('REN'), extension: '2028-06-15', startDate: '2028-05-01', compDate: '2028-06-01' },
    expect: { overall: 'VALID', statuses: { REN: 'VALID' }, scenario: null, newPeriod: { start: '2028-03-15', expiry: '2033-03-15' } } },
  { id: 'KASUS-14', title: 'Extension diinput > 3 bulan dibatasi 15 Jun 2028: mulai 15 Jun → VALID',
    input: { sel: pick('REN'), extension: '2029-01-01', startDate: '2028-06-15', compDate: '2028-06-20' },
    expect: { overall: 'VALID', statuses: { REN: 'VALID' }, scenario: null } },
  { id: 'KASUS-15', title: 'Extension diinput > 3 bulan dibatasi: mulai 16 Jun → SUSPENDED',
    input: { sel: pick('REN'), extension: '2029-01-01', startDate: '2028-06-16', compDate: '2028-06-20' },
    expect: { overall: 'SUSPENDED', statuses: { REN: 'SUSPENDED' }, scenario: null } },
  { id: 'KASUS-16', title: 'Recommendation diselesaikan tepat due + 6 bulan → SUSPENDED (belum withdrawn)',
    input: { sel: pick('A1'), startDate: '2024-02-01', compDate: '2024-02-05', recDue: '2026-01-01', recDone: '2026-07-01' },
    expect: { overall: 'SUSPENDED', statuses: { A1: 'VALID' }, scenario: null, recSt: 'SUSPENDED' } },
  { id: 'KASUS-17', title: 'Recommendation diselesaikan sehari setelah due + 6 bulan → WITHDRAWN, Case B',
    input: { sel: pick('A1'), startDate: '2024-02-01', compDate: '2024-02-05', recDue: '2026-01-01', recDone: '2026-07-02' },
    expect: { overall: 'WITHDRAWN', statuses: { A1: 'VALID' }, scenario: 'B', recSt: 'WITHDRAWN' } },
  { id: 'KASUS-18', title: 'Annual 1 terlewat jauh: Annual 2, 3 dan Intermediate ikut lewat batas → Case C, periode baru',
    input: { sel: pick('A1'), startDate: '2027-01-10', compDate: '2027-01-10' },
    expect: { overall: 'WITHDRAWN', statuses: { A1: 'WITHDRAWN', A2: 'WITHDRAWN', A3: 'WITHDRAWN', INT: 'WITHDRAWN' }, scenario: 'C', newPeriod: { start: '2027-01-10', expiry: '2032-01-10' } } },
  { id: 'KASUS-19', title: 'Prioritas skenario: Annual dan Renewal sama-sama withdrawn → Case D (bukan A)',
    input: { sel: pick('A1', 'REN'), startDate: '2028-10-01', compDate: '2028-10-01' },
    expect: { overall: 'WITHDRAWN', statuses: { A1: 'WITHDRAWN', REN: 'WITHDRAWN' }, scenario: 'D', newPeriod: { start: '2028-10-01', expiry: '2033-10-01' } } },
  { id: 'KASUS-20', title: 'Tanggal inspeksi belum diisi → INPUT REQUIRED',
    input: { sel: pick('A1') },
    expect: { overall: 'INPUT REQUIRED', statuses: { A1: 'INPUT REQUIRED' }, scenario: null } },
];

/**
 * KASUS NYATA — isi di sini.
 * Salin satu blok CaseDef di atas, ganti `input` dengan angka kapal asli (expiry, yearBuilt, lastNo, tanggal inspeksi,
 * survei yang dicentang) dan `expect` dengan hasil yang SUDAH Anda yakini benar (dari sheet Excel / keputusan BKI).
 * Beri id nama kapal, mis. 'AQUARIUS-01', 'DILLAH-01'.
 */
export const REAL_CASES: CaseDef[] = [];
