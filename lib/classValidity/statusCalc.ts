/** Kalkulasi Modul 1 (Class Status): window survei, status tiap survei, skenario reinstatement, dll. Fungsi murni, tanpa React. */
import { SURVEYS, HIST_KEYS, isAnnual, ANNUAL, INTERMEDIATE, RENEWAL, DOCKING, DOCKING_CAN_WITHDRAW } from './surveyRules';
import type { SurveyKey, Status } from './surveyRules';
import { parseD, mk, addM, fmt, fmtDM, num, daysBetween } from './dateUtils';
import { roman } from '../surveyStatus';
import type { Sel } from './surveyRules';
import type { ApplyValues } from '../../components/VesselStatus';

export type StatusInput = {
  expiry: string;
  startDate: string;
  compDate: string;
  extension: string;
  yearBuilt: string;
  annivD: number | null;
  annivM: number | null;
  sel: Sel;
  recDue: string;
  recDone: string;
  recAssess: string;
  lastNo: number | null;
  statusInfo: NonNullable<ApplyValues['info']> | null;
};

export function computeStatus(input: StatusInput) {
  const { expiry, startDate, compDate, extension, yearBuilt, annivD, annivM, sel, recDue, recDone, recAssess, lastNo, statusInfo } = input;
  const exp = parseD(expiry);
  const st = parseD(startDate);
  const co = parseD(compDate);
  const ext = parseD(extension);
  const yb = num(yearBuilt);
  const rec = { due: parseD(recDue), done: parseD(recDone), assess: parseD(recAssess) };

  const ad = annivD ?? (exp ? exp.getUTCDate() : 1);
  const am = annivM ?? (exp ? exp.getUTCMonth() + 1 : 1);
  const age = exp && yb ? exp.getUTCFullYear() - yb : null;
  // Nomor Renewal = yang lebih besar antara hitungan umur kapal (per 5 tahun) dan Renewal terakhir + 1.
  const rnAge = age === null || age <= 0 ? null : Math.max(1, Math.ceil(age / 5));
  const rnPrev = lastNo !== null ? lastNo + 1 : null;
  const rn = rnAge === null ? rnPrev : rnPrev === null ? rnAge : Math.max(rnAge, rnPrev);
  const rnBumped = rnAge !== null && rnPrev !== null && rnPrev > rnAge;
  const rnLabel = rn === null ? 'INPUT REQUIRED' : `RENEWAL ${roman(rn)}`;
  const prev = exp ? addM(exp, -60) : null;

  const win: Partial<Record<SurveyKey, { start: Date; end: Date }>> = {};
  if (exp && prev) {
    // Annual ke-n: bila Survey Status kapal tersedia, ikuti rantai anniversary-nya (tetap benar setelah anniversary bergeser)
    const an = (n: number) =>
      statusInfo
        ? mk(new Date(statusInfo.nextAnniv + 'T00:00:00Z').getUTCFullYear() + (n - (statusInfo.annCount + 1)), am - 1, ad)
        : mk(prev.getUTCFullYear() + n, am - 1, ad);
    win.A1 = { start: addM(an(1), -3), end: addM(an(1), 3) };
    win.A2 = { start: addM(an(2), -3), end: addM(an(2), 3) };
    win.A3 = { start: addM(an(3), -3), end: addM(an(3), 3) };
    win.A4 = { start: addM(an(4), -3), end: addM(an(4), 3) };
    win.A5 = { start: addM(an(5), -3), end: addM(an(5), 3) };
    // Intermediate tetap mengikuti anniversary asli (tanggal & bulan expiry); pergeseran Annual tidak memengaruhinya.
    const anI = (n: number) => mk(prev.getUTCFullYear() + n, exp.getUTCMonth(), exp.getUTCDate());
    win.INT = { start: addM(anI(2), -3), end: addM(anI(3), 3) };
    // Docking: maksimum 36 bulan dari Docking/Renewal terakhir (bukan dari anniversary)
    const dockBase = statusInfo?.lastDock ? new Date(statusInfo.lastDock + 'T00:00:00Z') : prev;
    win.D1 = { start: addM(dockBase, 24), end: addM(dockBase, 36) };
    const lim3 = addM(exp, 3);
    win.REN = { start: addM(exp, -3), end: ext && +ext > +exp ? (+ext < +lim3 ? ext : lim3) : exp };
  }

  // Annual ke-5 hanya ada bila anniversary ke-5 (setelah bergeser) jatuh sebelum jendela Renewal (expiry − 3 bulan)
  const an5 = prev
    ? statusInfo
      ? mk(new Date(statusInfo.nextAnniv + 'T00:00:00Z').getUTCFullYear() + (5 - (statusInfo.annCount + 1)), am - 1, ad)
      : mk(prev.getUTCFullYear() + 5, am - 1, ad)
    : null;
  const a5Applicable = !!exp && !!an5 && +an5 < +addM(exp, -3);

  const limit = (k: SurveyKey) => {
    const w = win[k];
    if (!w || !exp) return null;
    return k === 'REN' ? addM(exp, 6) : addM(w.end, 6);
  };
  const evalS = (k: SurveyKey): Status => {
    if (k === 'PS') return st && co ? 'VALID' : 'INPUT REQUIRED'; // interval 5 tahun, dicatat di Survey Status
    const w = win[k];
    if (!w || !exp || !st || !co) return 'INPUT REQUIRED';
    if (k === 'D1') {
      if (+st > +w.end || +co > +w.end) return DOCKING_CAN_WITHDRAW && +co > +addM(w.end, 6) ? 'WITHDRAWN' : 'SUSPENDED';
      return 'VALID';
    }
    if (+co > +limit(k)!) return 'WITHDRAWN';
    return +st <= +w.end ? 'VALID' : 'SUSPENDED';
  };

  // Semua survei yang dicentang memakai satu pasang tanggal inspeksi (sama seperti sheet).
  const rows = SURVEYS.filter((s) => sel[s.key]).map((s) => ({ ...s, w: win[s.key], status: evalS(s.key) }));
  // Survei yang urutannya SETELAH survei yang sedang dikerjakan dan sudah lewat batas withdrawal
  // (window end + 6 bulan) dianggap terlewat otomatis — tanpa perlu dicentang.
  const doingW = rows.filter((r) => isAnnual(r.key) || r.key === 'INT').map((r) => win[r.key]).filter((w): w is { start: Date; end: Date } => !!w);
  const minD = (ds: Date[]) => ds.reduce((a, b) => (+a < +b ? a : b));
  const firstStart = doingW.length ? minD(doingW.map((w) => w.start)) : null;
  const firstEnd = doingW.length ? minD(doingW.map((w) => w.end)) : null;
  const implied =
    firstStart && firstEnd && co
      ? SURVEYS.filter((x) => HIST_KEYS.includes(x.key) && !sel[x.key] && win[x.key] && (+win[x.key]!.start > +firstStart || +win[x.key]!.end > +firstEnd) && +co > +addM(win[x.key]!.end, 6)).map((x) => ({
          ...x, w: win[x.key], status: 'WITHDRAWN' as Status,
        }))
      : [];
  const stOf = (k: SurveyKey): Status | undefined => rows.find((r) => r.key === k)?.status ?? implied.find((r) => r.key === k)?.status;
  const annualW = (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).filter((k) => stOf(k) === 'WITHDRAWN').length;
  const intW = stOf('INT') === 'WITHDRAWN';

  // Recommendation (J33)
  let recSt = 'NOT ASSESSED';
  if (rec.due) {
    if (!rec.done && !rec.assess) recSt = 'INPUT REQUIRED';
    else if (rec.done) recSt = +rec.done > +addM(rec.due, 6) ? 'WITHDRAWN' : +rec.done > +rec.due ? 'SUSPENDED' : 'VALID';
    else if (rec.assess) recSt = +rec.assess > +addM(rec.due, 6) ? 'WITHDRAWN' : +rec.assess > +rec.due ? 'SUSPENDED' : 'OPEN';
  }

  // Skenario (J19): B > D > C > A
  type CaseId = 'A' | 'B' | 'C' | 'D' | null;
  let c: CaseId = null;
  if (co) {
    if (recSt === 'WITHDRAWN') c = 'B';
    else if (stOf('REN') === 'WITHDRAWN') c = 'D';
    else if (annualW >= 2 && intW) c = 'C';
    else if (annualW > 0 || intW) c = 'A';
  }
  const caseTitle: Record<string, string> = {
    A: 'A. ANNUAL / INTERMEDIATE SURVEY OVERDUE',
    B: 'B. RECOMMENDATION OVERDUE',
    C: 'C. TWO ANNUAL + INTERMEDIATE SURVEYS MISSED',
    D: 'D. CLASS RENEWAL SURVEY OVERDUE',
  };
  const action: Record<string, string> = {
    A: 'Terapkan checklist Annual diperluas dengan checklist Intermediate lengkap. Reinstatement boleh afloat atau di dry dock.',
    B: 'Selesaikan seluruh recommendation melalui Reinstatement of Class Survey.',
    C: 'Terapkan checklist Annual dan Class Renewal termasuk dry dock, pemeriksaan mesin, tangki, UT dan air pipe head sesuai umur. Terbitkan interim certificate dan mulai class period baru dari tanggal completion.',
    D: 'Terapkan checklist Annual dan Class Renewal sesuai umur kapal termasuk Docking, mesin, tangki, UT dan air pipe head. Terbitkan interim certificate dan mulai class period baru dari tanggal completion.',
  };
  const scopeLbl: Record<string, string> = {
    A: 'ANNUAL + INTERMEDIATE',
    B: 'SEMUA OUTSTANDING RECOMMENDATION',
    C: 'ANNUAL + RENEWAL + DOCKING + MESIN + TANGKI/UT/AIR-PIPE SESUAI UMUR',
    D: 'ANNUAL + RENEWAL + DOCKING + MESIN + TANGKI/UT/AIR-PIPE SESUAI UMUR',
  };

  const wlist = HIST_KEYS.filter((k) => stOf(k) === 'WITHDRAWN').map((k) => SURVEYS.find((x) => x.key === k)!.label.replace('Annual Survey — ', 'Annual '));
  const reinst: Record<string, [string, string]> = {
    A: ['Re-classification Survey dengan lingkup Intermediate Survey (checklist Annual + Intermediate lengkap).', 'Afloat; bila Bottom Survey juga jatuh tempo, dilaksanakan bersamaan (dry dock). Class reassigned and confirmed.'],
    B: ['Re-classification Survey + seluruh recommendation diselesaikan tuntas (tanpa outstanding) sebelum kapal berangkat.', 'Endorse: Visa no.1 dealt with; Class reassigned and confirmed.'],
    C: ['Re-classification Survey dengan lingkup Renewal Survey + Bottom Survey (dry dock), mencakup Annual, Mesin & Utilitas, Tangki/UT/Air Pipe sesuai umur.', 'Dry dock WAJIB; terbitkan interim certificate dan tetapkan class period baru.'],
    D: ['Re-classification Survey dengan lingkup Renewal Survey + Bottom Survey (dry dock) sesuai umur kapal, mencakup Annual, Mesin & Utilitas, Tangki/UT/Air Pipe.', 'Terbitkan interim certificate dan tetapkan class period baru.'],
  };
  const trigger: Record<string, string> = {
    A: `Survei terlewat melewati batas withdrawal: ${wlist.join(', ') || '—'}. Hanya satu Annual/Intermediate yang terlewat, belum memenuhi Case C.`,
    B: 'Recommendation outstanding lebih dari 6 bulan setelah due date.',
    C: `Terlewat: ${wlist.join(', ')} — dua Annual dan Intermediate sudah melewati batas withdrawal (window end + 6 bulan).`,
    D: 'Completion Renewal lebih dari 6 bulan setelah certificate expiry.',
  };

  // Penjelasan per survei terpilih
  const why = (r: (typeof rows)[number]) => {
    const w = r.w;
    if (!w || !st || !co || !exp) return '';
    if (r.key === 'D1')
      return +st > +w.end
        ? `Inspeksi dimulai ${fmt(st)} setelah batas 36 bulan (${fmt(w.end)}).`
        : +co > +w.end
        ? `Completion ${fmt(co)} melewati batas 36 bulan (${fmt(w.end)}); walau inspeksi dimulai tepat waktu, kelas tetap SUSPENDED.`
        : 'Dimulai dan selesai sebelum batas 36 bulan.';
    const lim = limit(r.key)!;
    if (r.status === 'WITHDRAWN') return `Completion ${fmt(co)} lebih dari 6 bulan setelah ${r.key === 'REN' ? 'expiry' : 'window end'} (batas ${fmt(lim)}).`;
    if (r.status === 'SUSPENDED') return `Inspeksi pertama ${fmt(st)} dimulai setelah ${r.key === 'REN' ? 'batas berlaku' : 'window end'} ${fmt(w.end)}.`;
    if (+co > +w.end) return `Dimulai tepat waktu, selesai setelah due date namun sebelum batas withdrawal (${fmt(lim)}); kelas tetap VALID.`;
    return 'Dalam jendela waktu.';
  };

  // Status akhir = yang terburuk dari semua survei terpilih + recommendation
  const all: string[] = [...rows.map((r) => r.status), ...implied.map((r) => r.status), recSt];
  let overall: Status = 'VALID';
  if (all.includes('WITHDRAWN')) overall = 'WITHDRAWN';
  else if (all.includes('SUSPENDED')) overall = 'SUSPENDED';
  else if (rows.length === 0 || rows.some((r) => r.status === 'INPUT REQUIRED') || recSt === 'INPUT REQUIRED') overall = 'INPUT REQUIRED';

  // Siklus sertifikat baru (J25–J27)
  let newPeriod: { start: Date; expiry: Date; ad: number; am: number; note: string } | null = null;
  if (exp && co && (sel.REN || c === 'C' || c === 'D')) {
    const forced = c === 'C' || c === 'D';
    const early = +co < +addM(exp, -3);
    const late = +co > +addM(exp, 6);
    const suspendedStart = !!st && !!win.REN && +st > +win.REN.end; // dimulai pada masa suspend
    const s = forced || early || late ? co : exp;
    newPeriod = {
      start: s, expiry: addM(s, 60), ad: s.getUTCDate(), am: s.getUTCMonth() + 1,
      note: forced
        ? 'Case C/D (Survey Penerimaan Kelas Kembali): periode & anniversary baru mengikuti tanggal completion; terbitkan interim certificate (Nota Dinas poin 5b–5c).'
        : early
        ? `Completion lebih dari 3 bulan sebelum expiry (${fmt(addM(exp, -3))}) → anniversary bergeser mengikuti completion.`
        : late
        ? 'Completion lebih dari 6 bulan setelah expiry → periode & anniversary baru dari completion.'
        : suspendedStart
        ? 'Dimulai dan selesai pada masa suspend → Survey Pembaruan Kelas; masa berlaku sertifikat baru dihitung dari sertifikat sebelumnya (expiry lama + 5 tahun) — Nota Dinas poin 5a, selaras ITS Part A Sec. 3.B.1.3.3.'
        : 'Survei dimulai sebelum expiry/dalam extension → periode lama berlaku: sertifikat baru berakhir 5 tahun dari expiry lama, anniversary dipertahankan (ITS Part A Sec. 3.B.1.3.3–1.3.4).',
    };
  }
  // Early completion Annual/Intermediate → anniversary bergeser
  let shift: { shifted: boolean; txt: string; nd?: number; nm?: number } | null = null;
  const annRows = rows.filter((r) => isAnnual(r.key) && r.w);
  const first = annRows.length ? annRows.reduce((a, b) => (+b.w!.start > +a.w!.start ? b : a)) : undefined;
  if (first && first.w && co) {
    const na = addM(co, 3); // ITS Part A 1.1.3: anniversary baru = 3 bulan setelah tanggal completion
    shift = +co < +first.w.start
      ? { shifted: true, nd: na.getUTCDate(), nm: na.getUTCMonth() + 1, txt: `${first.label}: completion ${fmt(co)} lebih awal ${daysBetween(co, first.w.start)} hari dari window start (${fmt(first.w.start)}) → Annual in advance. Anniversary baru = 3 bulan setelah completion = ${fmtDM(na.getUTCDate(), na.getUTCMonth() + 1)} (ITS Part A 1.1.3); expiry, Intermediate, dan Docking tidak berubah.` }
      : { shifted: false, txt: `Completion dalam/sesudah window start (${fmt(first.w.start)}) → anniversary tetap ${fmtDM(ad, am)}.` };
  }

  // Dasar aturan yang relevan untuk hasil saat ini (ITS Part A dan Nota Dinas BKI)
  const basis: string[] = [];
  const renStartedLate = !!st && !!win.REN && +st > +win.REN.end;
  if (sel.REN || c === 'C' || c === 'D') basis.push('renewal-status');
  if (sel.REN && co && exp) {
    if (c === 'D' || (renStartedLate && +co > +addM(exp, 6))) basis.push('renewal-withdrawn');
    else if (renStartedLate) basis.push('renewal-suspend');
    else basis.push('renewal-window');
  }
  if (c) basis.push('case-' + c);
  if (shift?.shifted) basis.push('annual-advance');

  // Scope aktif (Modul 2)
  const hasAnnual = (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).some((k) => sel[k]);
  const active = {
    annual: hasAnnual || sel.INT || sel.REN || c === 'A' || c === 'C' || c === 'D',
    inter: sel.INT || c === 'A',
    renewal: sel.REN || c === 'C' || c === 'D',
    docking: sel.D1 || sel.REN || c === 'C' || c === 'D',
    shaft: sel.PS,
    machinery: sel.REN || c === 'C' || c === 'D',
  };

  return { exp, st, co, age, rn, rnBumped, rnLabel, prev, ad, am, win, rows, recSt, c, caseTitle, action, scopeLbl, why, basis, overall, implied, reinst, trigger, newPeriod, shift, active, limit,
    a5Applicable, anniversaryAuto: annivD === null && annivM === null };
}

export type StatusCalc = ReturnType<typeof computeStatus>;
