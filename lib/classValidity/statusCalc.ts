/** Kalkulasi Modul 1 (Class Status): window survei, status tiap survei, skenario reinstatement, dll. Fungsi murni, tanpa React. */
import { SURVEYS, HIST_KEYS, isAnnual, ANNUAL, INTERMEDIATE, RENEWAL, DOCKING, DOCKING_CAN_WITHDRAW } from './surveyRules';
import type { SurveyKey, Status } from './surveyRules';
import { parseD, mk, addM, fmt, fmtDM, num, daysBetween } from './dateUtils';
import { roman, EXT_MONTHS } from '../surveyStatus';
import { hasNoIntermediate } from '../vesselTypes';
import type { Sel } from './surveyRules';
import type { ApplyValues } from '../../components/VesselStatus';

export type StatusInput = {
  expiry: string;
  startDate: string;
  compDate: string;
  extension: string;
  yearBuilt: string;
  vType?: string; // jenis kapal: Pontoon tidak punya Intermediate
  annivD: number | null;
  annivM: number | null;
  sel: Sel;
  shaftPlan?: string; // Method / extension poros yang dikerjakan pada agenda ini ('' = belum dipilih)
  recDue: string;
  recDone: string;
  recAssess: string;
  lastNo: number | null;
  statusInfo: NonNullable<ApplyValues['info']> | null;
};

export function computeStatus(input: StatusInput) {
  const { expiry, startDate, compDate, extension, yearBuilt, annivD, annivM, sel, recDue, recDone, recAssess, lastNo, statusInfo } = input;
  const shaftPlan = input.shaftPlan ?? '';
  const exp = parseD(expiry);
  const noInt = hasNoIntermediate(input.vType);
  const st = parseD(startDate);
  const co = parseD(compDate);
  // extension isian agenda; bila kosong, pakai Postponed/Extension dari Survey Status kapal (supaya dua mesin sama)
  const ext = parseD(extension) ?? (statusInfo?.postponed ? parseD(statusInfo.postponed) : null);
  const yb = num(yearBuilt);
  const rec = { due: parseD(recDue), done: parseD(recDone), assess: parseD(recAssess) };

  const ad = annivD ?? (exp ? exp.getUTCDate() : 1);
  const am = annivM ?? (exp ? exp.getUTCMonth() + 1 : 1);
  const ageRaw = exp && yb ? exp.getUTCFullYear() - yb : null;
  // Tahun bangun ≥ tahun expiry mustahil (kapal baru pun berumur 5 pada expiry pertamanya) → salah input, jangan ditebak.
  const ageInvalid = ageRaw !== null && ageRaw <= 0;
  const age = ageInvalid ? null : ageRaw;
  // Nomor Renewal = yang lebih besar antara hitungan umur kapal (per 5 tahun) dan Renewal terakhir + 1.
  const rnAge = age === null || age <= 0 ? null : Math.max(1, Math.ceil(age / 5));
  const rnPrev = lastNo !== null ? lastNo + 1 : null;
  const rn = ageInvalid ? null : rnAge === null ? rnPrev : rnPrev === null ? rnAge : Math.max(rnAge, rnPrev);
  const rnBumped = rnAge !== null && rnPrev !== null && rnPrev > rnAge;
  const rnLabel = rn === null ? 'INPUT REQUIRED' : `RENEWAL ${roman(rn)}`;
  const prev = exp ? addM(exp, -60) : null;
  // Tanggal dari Survey Status dibaca lewat parseD: teks rusak menjadi null (kembali ke hitungan dasar), bukan Invalid Date yang merambat jadi NaN
  const nextAnnivD = statusInfo ? parseD(statusInfo.nextAnniv) : null;
  const lastDockD = statusInfo?.lastDock ? parseD(statusInfo.lastDock) : null;
  // Jatuh tempo poros efektif (interval + extension yang sudah tercatat) dihitung di Survey Status; di sini hanya dibandingkan dengan inspeksi.
  const shaftDueD = statusInfo?.shaftDue ? parseD(statusInfo.shaftDue) : null;
  const isExtPlan = shaftPlan === 'E25' || shaftPlan === 'E1' || shaftPlan === 'E3';
  // Hanya sistem OPEN: extension boleh dipilih walau sudah lewat jatuh tempo; penundaan dari jatuh tempo poros tercatat,
  // dibatasi jatuh tempo asli + 1 tahun (= shaftCap dari Survey Status; null untuk closed loop → extension harus SEBELUM jatuh tempo).
  const shaftCapD = statusInfo?.shaftCap ? parseD(statusInfo.shaftCap) : null;
  const extDueD = (() => {
    if (!isExtPlan || !shaftDueD || !shaftCapD) return null;
    const x = addM(shaftDueD, EXT_MONTHS[shaftPlan] ?? 0);
    return shaftCapD && +x > +shaftCapD ? shaftCapD : x;
  })();
  const extLbl: Record<string, string> = { E25: '2,5 tahun', E1: '1 tahun', E3: '3 bulan' };

  const win: Partial<Record<SurveyKey, { start: Date; end: Date }>> = {};
  if (exp && prev) {
    // Annual ke-n: bila Survey Status kapal tersedia, ikuti rantai anniversary-nya (tetap benar setelah anniversary bergeser)
    const an = (n: number) =>
      statusInfo && nextAnnivD
        ? mk(nextAnnivD.getUTCFullYear() + (n - (statusInfo.annCount + 1)), am - 1, ad)
        : mk(prev.getUTCFullYear() + n, am - 1, ad);
    win.A1 = { start: addM(an(1), -3), end: addM(an(1), 3) };
    win.A2 = { start: addM(an(2), -3), end: addM(an(2), 3) };
    win.A3 = { start: addM(an(3), -3), end: addM(an(3), 3) };
    win.A4 = { start: addM(an(4), -3), end: addM(an(4), 3) };
    win.A5 = { start: addM(an(5), -3), end: addM(an(5), 3) };
    // Intermediate tetap mengikuti anniversary asli (tanggal & bulan expiry); pergeseran Annual tidak memengaruhinya.
    const anI = (n: number) => mk(prev.getUTCFullYear() + n, exp.getUTCMonth(), exp.getUTCDate());
    win.INT = { start: addM(anI(2), -3), end: addM(anI(3), 3) };
    const lim3 = addM(exp, 3);
    const renWin = { start: addM(exp, -3), end: ext && +ext > +exp ? (+ext < +lim3 ? ext : lim3) : exp };
    win.REN = renWin;
    // Docking: maksimum 36 bulan dari Docking/Renewal terakhir (bukan dari anniversary).
    // Bila 36 bulan itu melewati akhir jendela Renewal, Docking dikerjakan bersama Special Survey: batas akhirnya = akhir jendela Renewal.
    const dockBase = lastDockD ?? prev;
    const d1End = +addM(dockBase, 36) > +renWin.end ? renWin.end : addM(dockBase, 36);
    const d1Start = +addM(dockBase, 24) > +d1End ? d1End : addM(dockBase, 24);
    win.D1 = { start: d1Start, end: d1End };
  }

  // Annual ke-5 hanya ada bila anniversary ke-5 (setelah bergeser) jatuh sebelum jendela Renewal (expiry − 3 bulan)
  const an5 = prev
    ? statusInfo && nextAnnivD
      ? mk(nextAnnivD.getUTCFullYear() + (5 - (statusInfo.annCount + 1)), am - 1, ad)
      : mk(prev.getUTCFullYear() + 5, am - 1, ad)
    : null;
  const a5Applicable = !!exp && !!an5 && +an5 < +addM(exp, -3);

  const limit = (k: SurveyKey) => {
    const w = win[k];
    if (!w || !exp) return null;
    return k === 'REN' ? addM(exp, 6) : addM(w.end, 6);
  };
  const evalS = (k: SurveyKey): Status => {
    if (k === 'PS') {
      // Interval dan extension yang sudah tercatat dihitung di Survey Status (jatuh tempo efektif).
      // Dimulai setelah jatuh tempo → SUSPENDED; selesai lebih dari 6 bulan setelah jatuh tempo → WITHDRAWN.
      // Extension yang dipilih pada agenda ini boleh menutup keterlambatan selama tanggal mulai masih ≤ jatuh tempo baru (maks. dari jatuh tempo asli).
      // Bila jatuh tempo belum diketahui (Survey Status belum terisi), tidak bisa dinilai terlambat.
      if (!st || !co) return 'INPUT REQUIRED';
      if (!shaftDueD || +st <= +shaftDueD) return 'VALID';
      if (extDueD && +st <= +extDueD) return 'VALID';
      return +co > +addM(shaftDueD, 6) ? 'WITHDRAWN' : 'SUSPENDED';
    }
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
      ? SURVEYS.filter((x) => HIST_KEYS.includes(x.key) && !(noInt && x.key === 'INT') && !sel[x.key] && win[x.key] && (+win[x.key]!.start > +firstStart || +win[x.key]!.end > +firstEnd) && +co > +addM(win[x.key]!.end, 6)).map((x) => ({
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
    else if (annualW >= 2 && (intW || noInt)) c = 'C';
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

  // Docking 1 WITHDRAWN: hanya statusnya yang WITHDRAWN, bukan skenario baru. Reinstatement tetap berupa Docking Survey;
  // bila ada survei lain yang terlewat, lingkupnya digabung lewat skenario A–D di atas (C dan D sudah memuat Docking).
  const dockW = rows.some((r) => r.key === 'D1' && r.status === 'WITHDRAWN');
  const dockReinst: [string, string] | null = dockW
    ? [
        'Re-classification Survey dengan lingkup Docking Survey (Bottom Survey).',
        c ? 'Bila ada survei lain yang terlewat, lingkupnya digabung dengan skenario di atas.' : 'Tidak ada survei lain yang terlewat; lingkup hanya Docking.',
      ]
    : null;

  // Penjelasan per survei terpilih
  const why = (r: (typeof rows)[number]) => {
    if (r.key === 'PS') {
      // jatuh tempo poros dihitung di Survey Status (interval, extension, Method terakhir); di sini hanya dibandingkan dengan tanggal inspeksi
      if (!shaftDueD || !st) return '';
      if (+st > +shaftDueD) {
        const late = daysBetween(shaftDueD, st);
        if (extDueD && +st <= +extDueD) {
          const capped = !!shaftCapD && +addM(shaftDueD, EXT_MONTHS[shaftPlan] ?? 0) > +shaftCapD;
          return `Inspeksi extension dimulai ${fmt(st)}, ${late} hari setelah jatuh tempo poros ${fmt(shaftDueD)}. Extension ${extLbl[shaftPlan]} dihitung dari jatuh tempo: jatuh tempo baru ${fmt(extDueD)}${capped ? ' (dibatasi batas maksimum extension dari jatuh tempo asli)' : ''}. Pastikan extension disetujui BKI; setelah agenda Finish, jatuh tempo di Survey Status ikut bergeser.`;
        }
        const lim = addM(shaftDueD, 6);
        const wd = !!co && +co > +lim;
        const head = `Inspeksi poros dimulai ${fmt(st)}, ${late} hari setelah jatuh tempo poros ${fmt(shaftDueD)} (sudah termasuk extension yang tercatat).`;
        const stat = wd
          ? ` Completion ${fmt(co!)} lebih dari 6 bulan setelah jatuh tempo (batas ${fmt(lim)}) → WITHDRAWN.`
          : ` Masih dalam 6 bulan setelah jatuh tempo (batas ${fmt(lim)}) → SUSPENDED; lewat tanggal itu menjadi WITHDRAWN.`;
        const tail = isExtPlan && !extDueD
          ? ` Extension ${extLbl[shaftPlan]} hanya sah bila dikerjakan SEBELUM jatuh tempo (sistem closed loop). Lakukan survei poros penuh (Method), atau catat extension yang telah dikerjakan sebelum jatuh tempo di Survey Status.`
          : isExtPlan
          ? ` Extension ${extLbl[shaftPlan]} tidak lagi menutup tanggal inspeksi (jatuh tempo terjauh ${fmt(extDueD!)}, batas extension tercapai). Lakukan survei poros penuh (Method).`
          : `${shaftPlan ? '' : ' Method/extension belum dipilih.'} Bila ingin extension, pilih extension di tab Scope (maks. 3 bulan atau 1 tahun dari jatuh tempo untuk sistem open); bila ada extension yang sudah dikerjakan, catat di Survey Status (Update status).`;
        return head + stat + tail;
      }
      return `Jatuh tempo poros menurut Survey Status: ${fmt(shaftDueD)}${isExtPlan ? '. Extension dihitung dari tanggal ini.' : '.'}`;
    }
    const w = r.w;
    if (!w || !st || !co || !exp) return '';
    if (r.key === 'D1')
      return r.status === 'WITHDRAWN'
        ? `Completion ${fmt(co)} lebih dari 6 bulan setelah batas 36 bulan (batas withdrawal ${fmt(addM(w.end, 6))}); status kelas WITHDRAWN.`
        : +st > +w.end
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

  return { exp, st, co, age, ageInvalid, rn, rnBumped, rnLabel, prev, ad, am, win, rows, recSt, c, caseTitle, action, scopeLbl, why, basis, overall, implied, reinst, trigger, dockW, dockReinst, newPeriod, shift, active, limit,
    a5Applicable, anniversaryAuto: annivD === null && annivM === null };
}

export type StatusCalc = ReturnType<typeof computeStatus>;
