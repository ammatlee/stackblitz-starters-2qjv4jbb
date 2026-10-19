/**
 * Aturan Propeller Shaft Survey (ITS Part A 1.4.1 dan 1.4.2): interval, Method 1–4, dan extension.
 * Murni data + fungsi (tanpa React / Supabase). Item checklist ditulis sekali (kode `k`) lalu dirujuk tiap Method.
 */

export type Sys = 'oil' | 'fw' | 'open';
export type Conn = 'flanged' | 'keyless' | 'keyed';
export type OpenCfg = 'five' | 'three';
export type PlanKey = 'M1' | 'M2' | 'M3' | 'M4' | 'E25' | 'E1' | 'E3';

export type Step = { k: string; t: string; conn?: Conn[]; sys?: Sys[] };

export const CONN_LABEL: Record<Conn, string> = {
  flanged: 'Flanged',
  keyless: 'Keyless',
  keyed: 'Keyed',
};

export const OPEN_CFG_LABEL: Record<OpenCfg, string> = {
  five: 'Single shaft air tawar saja / single shaft dengan proteksi korosi memadai / semua susunan multiple shaft',
  three: 'Konfigurasi lainnya (mis. single shaft dilumasi air laut tanpa proteksi korosi memadai)',
};

/* ---------- item yang dipakai bersama ---------- */
const KEYED_KEYLESS: Conn[] = ['keyed', 'keyless'];
const S = {
  draw: { k: 'draw', t: 'Tarik poros; periksa seluruh poros, sistem seal, dan bearing' } as Step,
  drawOpen: { k: 'draw', t: 'Tarik poros; periksa seluruh poros (termasuk liner, sistem proteksi korosi, dan stress reducing features bila ada), sistem seal inboard, dan bearing' } as Step,
  propOff: { k: 'propoff', t: 'Lepas propeller untuk membuka ujung depan taper', conn: KEYED_KEYLESS } as Step,
  ndeLiner: { k: 'nde', t: 'NDE (surface crack detection) mengelilingi poros di area taper bagian depan, termasuk alur pasak bila ada. Poros berliner: NDE sampai tepi belakang liner', conn: KEYED_KEYLESS } as Step,
  nde: { k: 'nde', t: 'NDE (surface crack detection) mengelilingi poros di area taper bagian depan, termasuk alur pasak bila ada', conn: KEYED_KEYLESS } as Step,
  flange: { k: 'flange', t: 'Baut kopling dan flange radius: NDE bila baut dilepas atau flange radius terbuka saat overhaul/perbaikan, atau bila dianggap perlu oleh Surveyor', conn: ['flanged'] } as Step,
  clear: { k: 'clear', t: 'Periksa dan catat clearance bearing' } as Step,
  wear: { k: 'wear', t: 'Periksa dan catat pengukuran wear-down bearing' } as Step,
  wearPract: { k: 'wear', t: 'Periksa dan catat pengukuran wear-down bearing, sejauh dapat dilakukan' } as Step,
  visual: { k: 'visual', t: 'Pemeriksaan visual seluruh bagian sistem poros yang dapat diakses' } as Step,
  propBal: { k: 'propbal', t: 'Verifikasi propeller bebas kerusakan yang dapat membuat propeller tidak balans' } as Step,
  liner: { k: 'liner', t: 'Seal liner dalam kondisi memuaskan (atau dipasang baru)' } as Step,
  sealsReinstall: { k: 'seals', t: 'Verifikasi kondisi seal inboard dan outboard memuaskan saat pemasangan kembali poros dan propeller' } as Step,
  sealsM2: { k: 'seals', t: 'Verifikasi pemasangan kembali propeller memuaskan, termasuk kondisi seal inboard dan outboard' } as Step,
  sealsBoth: { k: 'seals', t: 'Verifikasi kondisi seal inboard dan outboard memuaskan' } as Step,
  sealsEffBoth: { k: 'seals', t: 'Verifikasi efektivitas seal inboard dan outboard' } as Step,
  sealInEff: { k: 'seals', t: 'Verifikasi efektivitas seal inboard' } as Step,
  sealInReinstall: { k: 'seals', t: 'Verifikasi kondisi seal inboard memuaskan saat pemasangan kembali poros dan propeller' } as Step,
};

/* ---------- prasyarat dokumen ---------- */
const Q = {
  service: { k: 'service', t: 'Tinjau catatan servis (service records)' } as Step,
  prevWearClear: { k: 'prev', t: 'Tinjau catatan wear-down dan/atau clearance sebelumnya', sys: ['oil', 'fw'] } as Step,
  prevClear: { k: 'prev', t: 'Tinjau catatan clearance sebelumnya', sys: ['open'] } as Step,
  testOil: { k: 'test', t: 'Tinjau catatan uji: analisa minyak pelumas', sys: ['oil'] } as Step,
  testFw: { k: 'test', t: 'Tinjau catatan uji: uji sampel air tawar', sys: ['fw'] } as Step,
  sampleOil: { k: 'sample', t: 'Pemeriksaan sampel minyak pelumas', sys: ['oil'] } as Step,
  sampleFw: { k: 'sample', t: 'Uji sampel air tawar', sys: ['fw'] } as Step,
  noRepair: { k: 'norepair', t: 'Verifikasi tidak ada perbaikan las atau gerinda pada poros dan/atau propeller' } as Step,
  chief: { k: 'chief', t: 'Konfirmasi dari Chief Engineer bahwa susunan poros dalam kondisi kerja baik' } as Step,
};
const DOC_CLOSED = [Q.service, Q.testOil, Q.testFw, Q.sampleOil, Q.sampleFw, Q.noRepair];

export const PLANS: Record<PlanKey, { title: string; brief: string; scope: Step[]; prereq: Step[] }> = {
  M1: {
    title: 'Method 1',
    brief: 'Paling lengkap: poros ditarik; propeller dilepas (keyed/keyless) atau baut kopling diperiksa (flanged).',
    scope: [S.draw, S.propOff, S.ndeLiner, S.flange, S.clear, S.propBal, S.sealsReinstall, { k: 'wear', t: 'Catat pengukuran wear-down bearing (setelah pemasangan kembali)' }],
    prereq: [],
  },
  M2: {
    title: 'Method 2',
    brief: 'Poros tidak ditarik. NDE taper (keyed/keyless) atau baut/flange (flanged), plus wear-down, visual, dan seal. Perlu prasyarat dokumen.',
    scope: [S.propOff, S.nde, S.flange, S.wear, S.visual, S.propBal, S.liner, S.sealsM2],
    prereq: DOC_CLOSED,
  },
  M3: {
    title: 'Method 3',
    brief: 'Tanpa membongkar: wear-down, visual, propeller, dan seal. Perlu prasyarat dokumen. Tidak boleh untuk sambungan keyed.',
    scope: [S.wear, S.visual, S.propBal, S.liner, S.sealsBoth],
    prereq: DOC_CLOSED,
  },
  M4: {
    title: 'Method 4',
    brief: 'Untuk sistem open (dilumasi air laut). Poros ditarik, mirip Method 1, ditambah pemeriksaan liner dan proteksi korosi.',
    scope: [S.drawOpen, S.propOff, S.ndeLiner, S.flange, S.clear, S.propBal, S.sealInReinstall],
    prereq: [],
  },
  E25: {
    title: 'Extension 2,5 tahun',
    brief: 'Survei ringan untuk menunda survei poros penuh sampai maks. 2,5 tahun. Hanya sistem tertutup.',
    scope: [S.wearPract, S.visual, S.propBal, S.sealsEffBoth],
    prereq: [...DOC_CLOSED, Q.chief],
  },
  E1: {
    title: 'Extension 1 tahun',
    brief: 'Survei ringan untuk menunda survei poros penuh sampai maks. 1 tahun.',
    scope: [
      S.visual,
      S.propBal,
      { ...S.clear, sys: ['open'] },
      { ...S.sealsEffBoth, sys: ['oil', 'fw'] },
      { ...S.sealInEff, sys: ['open'] },
    ],
    prereq: [Q.prevWearClear, Q.prevClear, Q.service, Q.testOil, Q.testFw, Q.sampleOil, Q.sampleFw, Q.noRepair, Q.chief],
  },
  E3: {
    title: 'Extension 3 bulan',
    brief: 'Survei ringan untuk menunda survei poros penuh sampai maks. 3 bulan.',
    scope: [
      S.visual,
      { ...S.propBal, sys: ['open'] },
      S.sealInEff,
    ],
    prereq: [Q.prevWearClear, Q.prevClear, Q.service, Q.testOil, Q.testFw, Q.sampleOil, Q.sampleFw, Q.noRepair, Q.chief],
  },
};

/** Batas dan akibat extension per jenis, menurut jenis sistem. */
export function extensionRules(sys: Sys): { key: PlanKey; label: string; limit: string; again: string }[] {
  if (sys === 'open') {
    return [
      { key: 'E1', label: '1 tahun', limit: 'Maksimum 1 kali. Tidak boleh extension jenis lain sesudahnya.', again: '—' },
      { key: 'E3', label: '3 bulan', limit: 'Maksimum 1 kali.', again: 'Bila minta lagi: syarat extension 1 tahun dipenuhi, jatuh tempo (sebelum extension) diperpanjang maks. 1 tahun.' },
    ];
  }
  return [
    { key: 'E25', label: '2,5 tahun', limit: 'Maksimum 1 kali. Tidak boleh extension jenis lain sesudahnya.', again: '—' },
    { key: 'E1', label: '1 tahun', limit: 'Maksimum 2 kali berturut-turut.', again: 'Bila minta lagi: syarat extension 2,5 tahun dipenuhi, jatuh tempo (sebelum extension) diperpanjang maks. 2,5 tahun.' },
    { key: 'E3', label: '3 bulan', limit: 'Maksimum 1 kali.', again: 'Bila minta lagi: syarat extension 1 tahun atau 2,5 tahun dipenuhi, jatuh tempo (sebelum extension) diperpanjang maks. 1 tahun atau 2,5 tahun.' },
  ];
}

export type ShaftView = {
  interval: number | null; // tahun
  intervalText: string;
  methods: PlanKey[];
  exts: PlanKey[];
  plan: PlanKey | '';
  scope: Step[];
  prereq: Step[];
  notes: string[];
};

const ok = (s: Step, sys: Sys, conn: Conn) => (!s.sys || s.sys.includes(sys)) && (!s.conn || s.conn.includes(conn));

export function shaftView(sys: Sys, conn: Conn | '', openCfg: OpenCfg | '', planIn: PlanKey | ''): ShaftView {
  const interval = sys === 'open' ? (openCfg === 'five' ? 5 : openCfg === 'three' ? 3 : null) : 5;
  const intervalText =
    interval === null ? 'Pilih konfigurasi poros untuk menentukan interval' : `Setiap ${interval} tahun${sys === 'open' ? ' (Method 4)' : ''}`;
  const methods: PlanKey[] = sys === 'open' ? ['M4'] : conn === 'keyed' ? ['M1', 'M2'] : conn ? ['M1', 'M2', 'M3'] : [];
  const exts: PlanKey[] = extensionRules(sys).map((x) => x.key);
  const plan: PlanKey | '' = planIn && (methods.includes(planIn) || exts.includes(planIn)) ? planIn : '';
  const notes: string[] = [];
  if (sys === 'oil' && conn === 'keyless') notes.push('Jarak antara dua survei Method 1 atau Method 2 maksimum 15 tahun (kecuali 1 extension maks. 3 bulan).');
  if (sys === 'fw') notes.push('Jarak antara dua survei Method 1 maksimum 15 tahun (kecuali 1 extension maks. 3 bulan).');
  if (sys === 'open' && conn === 'keyless') notes.push('Sambungan keyless: jarak antara dua pelepasan dan NDE kerucut poros maksimum 15 tahun.');
  if (conn === 'keyed' && sys !== 'open') notes.push('Method 3 tidak diizinkan untuk sambungan keyed.');
  notes.push('Survei yang selesai dalam 3 bulan sebelum jatuh tempo: periode berikutnya dihitung dari tanggal jatuh tempo.');
  const p = plan ? PLANS[plan] : null;
  const c = conn || 'flanged';
  return {
    interval,
    intervalText,
    methods,
    exts,
    plan,
    scope: p && conn ? p.scope.filter((s) => ok(s, sys, c)) : [],
    prereq: p && conn ? p.prereq.filter((s) => ok(s, sys, c)) : [],
    notes,
  };
}
