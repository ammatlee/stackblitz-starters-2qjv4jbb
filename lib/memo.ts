/**
 * Memorandum awal survei untuk owner: daftar item pemeriksaan yang dibuat otomatis dari data aplikasi
 * (jenis survei, nomor Renewal, tabel UT/tangki, jangkar, clearance, Propeller Shaft).
 * Murni fungsi (tanpa React / Supabase) supaya mudah diuji.
 */
import { renewalTables, rudderMax, shaftLimits, LINER_WEAR_PCT, ANCHOR_MIN_RATIO, CHAIN_MIN_RATIO, SEGEL_M, segelsFor } from './classValidity/surveyRules';
import type { ShaftSys, TRow } from './classValidity/surveyRules';
import { PLANS, shaftView } from './shaftRules';
import type { Conn, OpenCfg, PlanKey } from './shaftRules';
import { roman } from './surveyStatus';
import { TUG_TYPES } from './vesselTypes';

export type MemoItem = { id: string; text: string; sub?: MemoItem[] };
export type MemoSection = { id: string; title: string; items: MemoItem[] };

export type MemoCtx = {
  vesselName: string;
  vType: string;
  age: number | null;
  rnNo: number | null; // nomor Renewal (null = belum diketahui → memakai aturan IV)
  renewal: boolean;
  docking: boolean;
  shaft: boolean;
  propelled: boolean;
  shaftSys: ShaftSys;
  propConn: Conn | '';
  openCfg: OpenCfg | '';
  shaftPlan: PlanKey | '';
  shaftD: (number | null)[]; // D tiap poros (diameter liner bila ada)
  shaftManual: (number | null)[]; // batas maksimum dari manual pabrikan per poros (menggantikan batas Rules; wajib untuk closed loop fresh water)
  rudderD: (number | null)[]; // [neck, pintle]
  notation: boolean; // notasi jangkar: tanpa notasi, butir jangkar & rantai tidak dimuat
  anchorO: number | null;
  chainO: number | null;
  chainLen: number | null; // panjang minimum rantai (m) dari perhitungan engineer; jumlah segel dihitung otomatis
};

export type MemoState = {
  to: string; cc: string; from: string; place: string; date: string; surveyor: string; email: string; segels: string; /* segels: data lama, kini digantikan panjang minimum rantai (chain.len) */
  off: Record<string, boolean>; // id butir yang dimatikan
  text: Record<string, string>; // id butir yang teksnya diubah
  extra: Record<string, string[]>; // butir tambahan per bagian
};
export const MEMO0: MemoState = { to: '', cc: 'Owner Surveyor', from: 'Surveyor BKI', place: 'Jakarta', date: '', surveyor: '', email: '', segels: '', off: {}, text: {}, extra: {} };

const nf = (n: number, dp = 2) => String(Number(n.toFixed(dp))).replace('.', ',');
const DOTS = '……';
const hidden = ['NONE', 'N/A', '—'];
const live = (rows: TRow[]) => rows.filter((r) => !hidden.includes(r.scope));

const words = (scope: string): string => {
  const m: Record<string, string> = {
    ONE: 'satu tangki', TWO: 'dua tangki', ALL: 'semua tangki', 'HALF, MIN. 2': 'setengah dari jumlah tangki, minimum dua tangki',
  };
  return m[scope] ?? scope;
};
const utWords: Record<string, (r: TRow) => string> = {
  U1: () => 'Area suspect / yang diduga mengalami deteriorasi;',
  U2: (r) => `${r.scope === 'ONE SECTION' ? 'Minimal satu' : r.scope === 'TWO SECTIONS' ? 'Minimal dua' : 'Minimal tiga'} penampang melintang pada 0,5L bagian tengah kapal;`,
  U3: () => 'Seluruh hatch cover dan coaming palka kargo (pelat dan stiffener);',
  U4: () => 'Internal tangki ceruk haluan dan buritan;',
  U5: () => 'Seluruh pelat geladak utama terbuka sepanjang kapal;',
  U6: () => 'Pelat geladak bangunan atas terbuka yang mewakili (geladak buritan, anjungan, dan haluan);',
  U7: () => 'Lajur terbawah pada semua sekat melintang beserta daerah internalnya;',
  U8: () => 'Semua lajur kering basah (wind & water strakes), lajur kiri dan kanan, sepanjang kapal;',
  U9: () => 'Semua pelat lunas sepanjang kapal beserta pelat alas pada ruang pemisah (cofferdam), ruang mesin, dan tangki di ujung-ujung;',
  U10: () => 'Pelat kotak laut, pelat kulit pada daerah lubang pembuangan yang dianggap perlu oleh Surveyor;',
};

export function memoParts(c: Pick<MemoCtx, 'renewal' | 'docking' | 'shaft' | 'propelled'>): string[] {
  const p: string[] = [];
  if (c.renewal) p.push('Survey Pembaruan Klasifikasi dan Garis Muat', 'Survey Pengedokan');
  else if (c.docking) p.push('Survey Pengedokan');
  if (c.shaft && c.propelled) p.push('Survey Poros Baling-Baling'); // kapal tanpa penggerak tidak punya Propeller Shaft Survey
  return p;
}
const joinId = (a: string[]) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1]);
export const memoSubject = (c: MemoCtx) => `Memorandum Awal ${joinId(memoParts(c))} Kapal ${c.vesselName.toUpperCase() || DOTS}`;
export const memoIntro = (c: MemoCtx) => `Dalam rangka ${joinId(memoParts(c))}, item berikut agar dilaksanakan:`;

/** Clearance maksimum tiap poros (mm): manual pabrikan bila diisi (menggantikan Rules, ITS Part A 1.10.2), selain itu rumus Rules dari D (diameter liner / poros). */
export function shaftMaxes(c: Pick<MemoCtx, 'shaftSys' | 'shaftD' | 'shaftManual'>): (number | null)[] {
  return c.shaftD.map((d, i) => c.shaftManual[i] ?? shaftLimits(c.shaftSys, 'max', d).hi);
}

export type MemoGap = { text: string; tab: 'propulsi' | 'memo' };
/** Isian yang masih kosong sehingga angka pada memo belum bisa dihitung (ditampilkan sebagai peringatan, tidak ikut tercetak). */
export function memoGaps(c: MemoCtx): MemoGap[] {
  const g: MemoGap[] = [];
  const bottom = c.renewal || c.docking;
  if (c.propelled && bottom) {
    if (rudderMax('Neck Bearing', c.rudderD[0] ?? null) === null) g.push({ text: 'Diameter neck bearing (tongkat kemudi) belum diisi: clearance maksimum neck bearing belum dapat dihitung.', tab: 'propulsi' });
    if (rudderMax('Pintle Bearing', c.rudderD[1] ?? null) === null) g.push({ text: 'Diameter pintle bearing (tongkat kemudi) belum diisi: clearance maksimum pintle bearing belum dapat dihitung.', tab: 'propulsi' });
  }
  if (c.propelled && (c.renewal || c.docking || c.shaft)) {
    shaftMaxes(c).forEach((hi, i) => {
      if (hi !== null) return;
      const lbl = c.shaftD.length > 1 ? `Poros ${i + 1}` : 'Poros baling-baling';
      g.push({
        text: c.shaftSys === 'fw'
          ? `${lbl}: closed loop fresh water, isi batas maksimum dari manual pabrikan agar clearance maksimum tampil.`
          : `${lbl}: diameter poros / liner belum diisi, clearance maksimum belum dapat dihitung.`,
        tab: 'propulsi',
      });
    });
  }
  if (c.renewal && c.notation) {
    if ((c.rnNo ?? 4) >= 2) {
      if (c.anchorO === null) g.push({ text: 'Berat jangkar original belum diisi.', tab: 'memo' });
      if (c.chainO === null) g.push({ text: 'Diameter rantai original belum diisi.', tab: 'memo' });
      if (c.chainLen === null) g.push({ text: 'Panjang minimum rantai (dari perhitungan engineer) belum diisi: jumlah segel belum dapat dihitung.', tab: 'memo' });
    }
  }
  return g;
}

export function buildMemo(c: MemoCtx): MemoSection[] {
  const sections: MemoSection[] = [];
  const rnEff = Math.min(c.rnNo ?? 4, 4);
  const rnLabel = roman(c.rnNo ?? 4);
  const T = renewalTables(rnEff, c.age, c.vType, c.propelled);
  const bottom = c.renewal || c.docking;
  const shaftOn = c.shaft && c.propelled; // sel.PS bisa tersisa bila jenis kapal diganti menjadi tanpa penggerak
  const np = !c.propelled; // kapal tanpa penggerak (tongkang, ponton): item yang bergantung pada instalasi mesin diberi "bila ada" atau dihapus
  const hull: MemoItem[] = [];
  const mach: MemoItem[] = [];

  /* ---------------- LAMBUNG ---------------- */
  if (c.renewal) {
    const ut = live(T.ut);
    hull.push({
      id: 'h-ut',
      text: `Agar dilaksanakan pengukuran ketebalan pelat sesuai ketentuan survey pembaruan kelas No. ${rnLabel}, yaitu pada area di bawah ini:`,
      sub: [
        ...ut.map((r) => ({ id: `h-ut-${r.id}`, text: (utWords[r.id] ?? (() => `${r.item};`))(r) })),
        { id: 'h-ut-lain', text: 'Ruangan / daerah lain di kapal akan disampaikan setelah dilakukan pemeriksaan di kapal.' },
      ],
    });
    hull.push({
      id: 'h-ut-co',
      text: 'Perusahaan pelaksana pengukuran ketebalan harus memiliki sertifikat persetujuan penyedia jasa dari BKI. Jika dalam pelaksanaan terdapat hasil pengukuran dibawah 20% dari ketebalan original, agar pelat diganti baru dengan menggunakan pelat bersertifikat klas dan hasil pengelasan dan pengujian kekedapan agar diperiksakan kepada Surveyor.',
    });
    if (c.notation) {
      const chainMin = c.chainO !== null ? nf(c.chainO * CHAIN_MIN_RATIO) : DOTS;
      const anchorMin = c.anchorO !== null ? nf(c.anchorO * ANCHOR_MIN_RATIO, 1) : DOTS;
      const gauge = (c.rnNo ?? 4) >= 2;
      const segels = segelsFor(c.chainLen);
      hull.push({
        id: 'h-anchor',
        text: gauge
          ? 'Jangkar dan rantai jangkar agar diturunkan, direntangkan, dibersihkan dan dilaksanakan pengukuran diameter 3 tautan per segel (27,5 m):'
          : 'Jangkar dan rantai jangkar agar diturunkan, direntangkan, dan dibersihkan; chain locker, holdfast, hawse pipe dan stopper agar diperiksa.',
        sub: gauge
          ? [
              { id: 'h-anchor-d', text: `Ukuran rantai jangkar sesuai daftar perlengkapan BKI: diameter rantai ${c.chainO !== null ? nf(c.chainO) : DOTS} mm dan minimum diameter: ${chainMin} mm;` },
              { id: 'h-anchor-l', text: `Total panjang rantai yang dipersyaratkan minimum ${c.chainLen !== null ? nf(c.chainLen, 1) : DOTS} m (${segels !== null ? `${segels} segel = ${nf(segels * SEGEL_M, 1)} m` : `${DOTS} segel`});` },
              { id: 'h-anchor-w', text: `Berat jangkar ${c.anchorO !== null ? nf(c.anchorO, 1) : DOTS} kg, minimum berat yang dipersyaratkan ${anchorMin} kg;` },
              { id: 'h-anchor-r', text: 'Jika hasil pengukuran menunjukkan nilai di bawah data di atas, rantai jangkar agar diganti baru bersertifikat klas dan panjang rantai disesuaikan dengan data di atas.' },
            ]
          : undefined,
      });
    }
  }
  if (bottom) {
    hull.push({ id: 'h-dock', text: `Kapal agar dinaikkan ke dok / slipway (atau in-water survey bila disetujui BKI) dan bagian bawah air dibersihkan dari fouling untuk pemeriksaan ${np ? 'pelat kulit, lunas, bilge keel, dan skeg (bila ada)' : 'pelat kulit, lunas, bilge keel, stern frame, dan rudder'}.` });
    hull.push({ id: 'h-seachest', text: np ? 'Grating sea chest (bila ada) agar dibuka untuk pemeriksaan pelat sea chest.' : 'Grating sea chest agar dibuka untuk pemeriksaan pelat sea chest.' });
    if (c.propelled) {
      const nMax = rudderMax('Neck Bearing', c.rudderD[0] ?? null);
      const pMax = rudderMax('Pintle Bearing', c.rudderD[1] ?? null);
      // hanya batas maksimum hasil perhitungan (tanpa rumus); bila diameter belum diisi tampil titik-titik dan muncul peringatan di tab Memo
      hull.push({
        id: 'h-rudder',
        text:
          'Agar dilaksanakan pengukuran clearance tongkat kemudi (ki/ka) dengan bantalannya. ' +
          `Clearance maksimum untuk kapal ini: neck bearing ${nMax !== null ? nf(nMax) : DOTS} mm, pintle bearing ${pMax !== null ? nf(pMax) : DOTS} mm.` +
          ' Jika clearance telah melebihi batas, bantalan agar diganti baru.',
      });
    }
  }
  if (c.renewal) {
    hull.push({ id: 'h-seal', text: 'Karet-karet dan pengunci pada bukaan-bukaan (seperti pintu, small hatch, manhole dll) agar diperbaiki jika terdapat kerusakan.' });
    const fo = live(T.tanks).filter((r) => ['T2', 'T3', 'T4', 'T5', 'T6'].includes(r.id));
    const lbl: Record<string, string> = { T2: 'Tangki bahan bakar di engine room', T3: 'Tangki bahan bakar di cargo length area', T4: 'Tangki bahan bakar tambahan di luar engine room', T5: 'Tangki minyak pelumas', T6: 'Tangki air tawar' };
    hull.push({
      id: 'h-tank',
      text: 'Seluruh tangki ballast, FPT, APT, cofferdam, chain locker, void, dan ruang-ruang lain (kecuali tangki bahan bakar, minyak pelumas dan air tawar) agar dibuka, dibersihkan dan di-free gas untuk pemeriksaan internal. Agar diberikan label pada tangki-tangki yang telah di-free gas.',
    });
    if (fo.length > 0) {
      hull.push({
        id: 'h-tank-fo',
        text: `Tangki bahan bakar, minyak pelumas dan air tawar agar dibuka untuk pemeriksaan internal sesuai Tabel 3.3 (Renewal No. ${rnLabel}); bila hanya sebagian yang dipilih, tangki yang diperiksa bergantian dari Renewal sebelumnya:`,
        sub: fo.map((r) => ({ id: `h-tank-${r.id}`, text: `${lbl[r.id]}: ${words(r.scope)}${r.id === 'T3' && rnEff >= 3 ? ' (termasuk satu deep tank bahan bakar bila ada)' : ''};` })),
      });
    }
    const duct = live(T.tanks).find((r) => r.id === 'T9');
    if (duct) hull.push({ id: 'h-duct', text: 'Structural downflooding duct dan structural ventilation duct agar diperiksa internal (bila ada).' });
    hull.push({ id: 'h-press', text: 'Uji tekan (pressure test) tangki ballast sampai ketinggian kepala pipa udara; tangki bahan bakar, minyak pelumas dan air tawar sesuai keputusan Surveyor.' });
    const air = live(T.air);
    if (air.length > 0) {
      hull.push({
        id: 'h-air',
        text: 'Semua kepala pipa udara otomatis yang terletak di geladak terbuka agar dibuka, diperiksa dan diservis jika terdapat kerusakan. Jumlah yang diperiksa:',
        sub: air.map((r) => ({ id: `h-air-${r.id}`, text: `${r.item}: ${r.scope};` })),
      });
    }
    hull.push({ id: 'h-pipe', text: 'Semua sistem perpipaan bilga dan balas diperiksa dan diuji operasional hingga tekanan kerja untuk dipastikan kekedapan dan dalam kondisi baik. Jika ada penggantian pipa agar dilaksanakan uji kekedapan.' });
    hull.push({ id: 'h-mark', text: 'Marka lambung timbul, nama kapal dan pelabuhan pendaftaran agar terlihat jelas.' });
    hull.push({ id: 'h-repl', text: 'Konstruksi yang ditemukan keropos, tipis maupun deformasi agar dipotong dan diganti baru menggunakan pelat yang bersertifikat klas.' });
  }
  if (hull.length) sections.push({ id: 'hull', title: 'LAMBUNG', items: hull });

  /* ---------------- INSTALASI MESIN DAN LISTRIK ---------------- */
  if (c.renewal) {
    mach.push({ id: 'm-open', text: `${c.propelled ? 'Mesin induk, mesin bantu' : 'Mesin bantu (bila ada)'} dan seluruh pompa-pompa (OWS, bilga, balas, GS dan lain-lain) agar dibuka lengkap dan diperiksa oleh BKI Class.` });
    if (c.propelled) mach.push({ id: 'm-crank', text: 'Agar dilaksanakan pengukuran crankweb deflection untuk M/E dan A/E yang memiliki crankcase door setelah kapal turun dok dan dibuatkan laporan.' });
    mach.push({ id: 'm-megger', text: `Agar dilaksanakan pengukuran tahanan isolasi seluruh generator, electromotor, panel listrik dan MSB${np ? ' (bila ada)' : ''} dan dibuatkan laporan.` });
  }
  const showShaftClear = c.propelled && (c.renewal || c.docking || c.shaft);
  if (showShaftClear) {
    // hanya batas maksimum hasil perhitungan (tanpa rumus); bila belum dapat dihitung tampil titik-titik dan muncul peringatan di tab Memo
    const maxes = shaftMaxes(c);
    const per = maxes.length === 1
      ? `${maxes[0] !== null ? nf(maxes[0]) : DOTS} mm`
      : maxes.map((hi, i) => `poros ${i + 1}: ${hi !== null ? nf(hi) : DOTS} mm`).join('; ');
    mach.push({
      id: 'm-clear',
      text:
        'Agar dilaksanakan pengukuran clearance poros baling-baling (ki/ka) dengan bantalannya. ' +
        `Clearance maksimum untuk kapal ini: ${per}.` +
        ' Jika clearance telah melebihi batas, bantalan agar diganti baru.',
    });
    if (c.shaftSys === 'oil') mach.push({ id: 'm-liner', text: `Aus (wear) shaft liner agar diukur dan dicatat: toleransi maksimum ${LINER_WEAR_PCT.bearing}% dari tebal liner di area bearing dan ${LINER_WEAR_PCT.packing}% di area packing.` });
  }
  if (shaftOn) {
    const sv = shaftView(c.shaftSys, c.propConn, c.openCfg, c.shaftPlan);
    if (sv.plan && sv.scope.length > 0) {
      mach.push({
        id: 'm-plan',
        text: `Survey poros baling-baling (${PLANS[sv.plan].title}) agar dilaksanakan dengan lingkup berikut:`,
        sub: sv.scope.map((s) => ({ id: `m-plan-${s.k}`, text: `${s.t};` })),
      });
    } else {
      mach.push({ id: 'm-draw', text: 'Poros baling-baling (ki/ka) agar dicabut dan dilaksanakan pengujian tak merusak (NDT) di area tirus dan rumah pasak dan dibuatkan laporan.' });
      mach.push({ id: 'm-prop', text: 'Baling-baling (ki/ka) agar dilaksanakan pengujian tak merusak (NDT) di area pangkal dan ujung daun serta dilaksanakan balancing test dan dibuatkan laporan.' });
    }
  } else if ((c.renewal || c.docking) && c.propelled) {
    mach.push({ id: 'm-stern', text: 'Baling-baling dan stern bush agar diperiksa; clearance stern bush dan efisiensi oil gland agar diukur dan dicatat.' });
  }
  if (c.renewal || c.docking) {
    mach.push({ id: 'm-sea', text: np ? 'Katup laut (sea valve), bila ada, agar dibuka, dibersihkan dan dirawat serta dilaksanakan hydro test.' : 'Katup laut (sea valve) agar dibuka, dibersihkan dan dirawat serta dilaksanakan hydro test.' });
  }
  if (c.renewal) {
    // item kamar mesin / steering gear: hanya kapal berpenggerak (kapal tanpa penggerak tidak punya engine room dan steering gear room)
    if (c.propelled) {
      mach.push({ id: 'm-over', text: 'Overboard valve daerah kamar mesin agar diservice.' });
      mach.push({ id: 'm-emerg', text: 'Seluruh peralatan emergency (emergency stop fan/blower, emergency stop F.O, quick closing valve test F.O) agar dipastikan berfungsi untuk diuji fungsi saat final survei.' });
      mach.push({ id: 'm-drip', text: 'Got-got tumpahan minyak dan air pada engine room dan steering gear room agar dibersihkan.' });
    }
    mach.push({ id: 'm-fire', text: `Fire detection, fire alarm dan fire water hydrant${np ? ' (bila terpasang)' : ''} agar dipastikan berfungsi untuk diuji fungsi saat final survei.` });
    // sama dengan checklist Scope: towing winch hanya untuk tugboat / anchor handling tug (bila terpasang)
    if (TUG_TYPES.includes(c.vType)) mach.push({ id: 'm-tow', text: 'Towing winch (bila terpasang) agar diperiksa secara visual dan dikonfirmasi pengoperasian emergency-release-nya.' });
  }
  if ((c.renewal || c.docking || shaftOn) && c.propelled) mach.push({ id: 'm-trial', text: 'Setelah turun dok agar dilaksanakan sea trial dan disaksikan BKI Class.' });
  mach.push({ id: 'm-rec', text: 'Rekomendasi tambahan (jika ada) akan diberikan pada kesempatan pertama setelah dilaksanakan pemeriksaan di kapal.' });
  if (mach.length > 1 || hull.length === 0) sections.push({ id: 'mach', title: 'INSTALASI MESIN DAN LISTRIK', items: mach });

  /* ---------------- DOKUMEN ---------------- */
  const docs: MemoItem[] = [{ id: 'd-cert', text: 'Sertifikat BKI Lama' }];
  if (bottom) docs.push({ id: 'd-dock', text: 'Laporan Dok' });
  if (c.renewal) docs.push({ id: 'd-utm', text: 'Laporan UTM' });
  if (shaftOn || (c.renewal && c.propelled)) docs.push({ id: 'd-ndt', text: 'Laporan NDT Poros Baling-Baling (ka/ki)' });
  if (c.renewal) docs.push({ id: 'd-megger', text: np ? 'Laporan Megger Test (bila ada instalasi listrik)' : 'Laporan Megger Test' }, ...(c.propelled ? [{ id: 'd-crank', text: 'Laporan Crankshaft Deflection' }] : []), { id: 'd-laut', text: 'Surat Laut' }, { id: 'd-ukur', text: 'Surat Ukur' }, { id: 'd-plate', text: 'Sertifikat Pelat Pengganti (jika dilaksanakan replating)' });
  if (shaftOn) {
    const sv = shaftView(c.shaftSys, c.propConn, c.openCfg, c.shaftPlan);
    sv.prereq.forEach((s) => docs.push({ id: `d-pre-${s.k}`, text: s.t }));
  }
  sections.push({ id: 'docs', title: 'Dokumen yang perlu disiapkan', items: docs });
  return sections;
}

/* ---------------- penerapan edit pengguna & keluaran ---------------- */
export type ResolvedSection = { title: string; items: { text: string; sub: string[] }[] };

export function resolveMemo(secs: MemoSection[], st: MemoState): ResolvedSection[] {
  const txt = (it: MemoItem) => (st.text[it.id] ?? it.text).trim();
  return secs.map((s) => ({
    title: s.title,
    items: [
      ...s.items
        .filter((it) => !st.off[it.id])
        .map((it) => {
          const sub = (it.sub ?? []).filter((x) => !st.off[x.id]).map(txt).filter(Boolean);
          if (sub.length) sub[sub.length - 1] = sub[sub.length - 1].replace(/;$/, '.'); // butir terakhir diakhiri titik
          return { text: txt(it), sub };
        }),
      ...(st.extra[s.id] ?? []).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t, sub: [] as string[] })),
    ].filter((it) => it.text),
  }));
}

export const dateLong = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const mon = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${m[3]} ${mon[Number(m[2]) - 1]} ${m[1]}`;
};
const letter = (i: number) => String.fromCharCode(97 + i);

export function memoText(c: MemoCtx, st: MemoState, secs: ResolvedSection[]): string {
  const L: string[] = ['MEMORANDUM', '', `Kepada Yth\t: ${st.to || DOTS}${st.cc ? `, Cq. ${st.cc}` : ''}`, `Dari\t\t: ${st.from}`, `Perihal\t\t: ${memoSubject(c)}`, '', memoIntro(c), ''];
  secs.forEach((s) => {
    L.push(s.title);
    s.items.forEach((it, i) => {
      L.push(`${i + 1}. ${it.text}`);
      it.sub.forEach((x, j) => L.push(`    ${letter(j)}. ${x}`));
    });
    L.push('');
  });
  L.push('Note :', 'Sertifikat sementara akan diterbitkan setelah semua dokumen pendukung lengkap.', '', 'Demikian disampaikan atas perhatian dan kerjasamanya diucapkan terimakasih.', '');
  L.push(`${st.place}, ${dateLong(st.date) || DOTS}`, st.from, '', '', st.surveyor);
  return L.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** HTML yang dibuka Word sebagai dokumen (.doc), bisa diedit lagi di Word. */
export function memoHtml(c: MemoCtx, st: MemoState, secs: ResolvedSection[]): string {
  const body = secs
    .map(
      (s) =>
        `<p style="margin:12pt 0 4pt"><b>${esc(s.title)}</b></p><ol style="margin-top:0">${s.items
          .map((it) => `<li style="text-align:justify">${esc(it.text)}${it.sub.length ? `<ol type="a">${it.sub.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</li>`)
          .join('')}</ol>`
    )
    .join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Memorandum</title>
<style>@page{size:21cm 29.7cm;margin:2cm 2.2cm} body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.25} td{vertical-align:top;font-size:12pt}</style></head><body>
<p style="text-align:center;font-size:14pt"><b><u>MEMORANDUM</u></b></p>
<table style="border-collapse:collapse"><tr><td>Kepada Yth</td><td>:&nbsp;</td><td>${esc(st.to || DOTS)}${st.cc ? `, Cq. ${esc(st.cc)}` : ''}</td></tr>
<tr><td>Dari</td><td>:&nbsp;</td><td>${esc(st.from)}</td></tr>
<tr><td>Perihal</td><td>:&nbsp;</td><td>${esc(memoSubject(c))}</td></tr></table><hr>
<p style="text-align:justify">${esc(memoIntro(c))}</p>${body}
<p style="margin-top:12pt"><b>Note :</b><br>Sertifikat sementara akan diterbitkan setelah semua dokumen pendukung lengkap.</p>
<p>Demikian disampaikan atas perhatian dan kerjasamanya diucapkan terimakasih.</p>
<p style="margin-top:18pt;margin-left:11cm">${esc(st.place)}, ${esc(dateLong(st.date) || DOTS)}<br>${esc(st.from)}<br><br><br><br>${esc(st.surveyor)}</p></body></html>`;
}
