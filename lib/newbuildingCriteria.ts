/* Kriteria penerimaan (acuan) per item tahap Fabrication.
   Hanya baca: tidak mempengaruhi status Belum/Selesai/N/A maupun perhitungan progress.
   Sumber: IACS UR S14 Rev.7 (Dec 2022) dan IACS Rec. 47 Rev.10 Corr.1 (Oct 2025).
   Angka disalin dari PDF; periksa ulang tanda ≤ dan < ke dokumen asli bila menambah baris. */

   export const CRITERIA_SOURCES = {
    s14: 'IACS UR S14 Rev.7 (Dec 2022), berlaku untuk kontrak mulai 1 Jan 2024',
    rec47: 'IACS Rec. 47 Rev.10 Corr.1 (Oct 2025)',
  } as const;
  
  export const CRITERIA_DISCLAIMER = 'Acuan IACS. Keputusan akhir mengikuti Rules BKI, ITP, dan standar yang disetujui.';
  
  export type CriteriaRow = {
    param: string;
    /** Nilai tunggal (S14 tidak membedakan Standard dan Limit). */
    value?: string;
    /** Rec. 47: bisa kosong bila dokumen hanya memuat salah satunya. */
    standard?: string | null;
    limit?: string | null;
    note?: string;
    /** Rujukan pasal/tabel dan halaman PDF. */
    ref: string;
  };
  
  export type CriteriaGroup = {
    title?: string;
    columns: 'value' | 'stdlimit';
    /** Ditampilkan di lipatan "Selengkapnya" supaya daftar utama tetap pendek. */
    collapsed?: boolean;
    rows: CriteriaRow[];
  };
  
  export type CriteriaSet = {
    source: keyof typeof CRITERIA_SOURCES;
    groups: CriteriaGroup[];
    notes: string[];
    /** Kalkulator kecil yang ditampilkan di bawah tabel. */
    calc?: 'partC';
  };
  
  const LEAK: CriteriaSet = {
    source: 's14',
    groups: [
      {
        title: 'Metode dan nilai uji',
        columns: 'value',
        rows: [
          { param: 'Hose test', value: 'Tekanan di nozzle ≥ 2 bar; diameter dalam nozzle ≥ 12 mm; jarak tegak lurus ke sambungan ≤ 1,5 m; semprotan langsung ke las', note: 'Sambungan harus terlihat dari sisi seberangnya.', ref: 'S14 Part A 4.4.3, hlm. 6' },
          { param: 'Tank air test', value: 'Beda tekanan stabil ≥ 0,15 bar di atas atmosfer, dengan larutan pendeteksi bocor', note: 'U-tube atau dua manometer terkalibrasi. Periksa dua kali: segera setelah larutan diberikan, dan sekitar 4–5 menit kemudian.', ref: 'S14 Part A 4.4.4, hlm. 7' },
          { param: 'Compressed air fillet weld test', value: 'Tekanan udara ≥ 0,15 bar terverifikasi di tiap ujung semua lintasan yang diuji', note: 'Berlaku juga untuk partial penetration dengan root face besar (6–8 mm).', ref: 'S14 Part A 4.4.5, hlm. 7' },
          { param: 'Vacuum box test', value: 'Vakum 0,20–0,26 bar di dalam box', note: 'Larutan pendeteksi bocor di sekitar weld cap.', ref: 'S14 Part A 4.4.6, hlm. 7' },
          { param: 'Hydrostatic / hydropneumatic sebagai leak test', value: 'Boleh, asal permukaan yang diperiksa bebas embun', ref: 'S14 Part A 4.3 dan 4.7, hlm. 6 dan 8' },
          { param: 'Hose test tidak praktis (risiko merusak mesin, isolasi listrik, outfitting)', value: 'Diganti pemeriksaan visual teliti pada sambungan las, didukung dye penetrant atau uji ultrasonik bila perlu', ref: 'S14 Part A 4.4.3, hlm. 6' },
        ],
      },
      {
        title: 'Waktu uji, coating, dan akses (Tabel 3)',
        columns: 'value',
        rows: [
          { param: 'Saksi dan tahap', value: 'Dihadiri Surveyor, mendekati akhir pekerjaan, setelah pintu, jendela, dan penetrasi (termasuk sambungan pipa) terpasang, sebelum ceiling atau semen menutup sambungan', ref: 'S14 Part A 4.1, hlm. 5' },
          { param: 'Butt las otomatis', value: 'Leak test tidak wajib. Coating boleh sebelum leak test bila las sudah diperiksa visual dan memuaskan Surveyor', note: 'Surveyor berhak meminta leak test sebelum final coating pada erection butt otomatis.', ref: 'S14 Part A 4.5.1 dan Tabel 3, hlm. 8 dan 13' },
          { param: 'Butt las manual / semi-otomatis', value: 'Leak test wajib. Coating baru boleh setelah leak test. Akses aman wajib', note: 'Butt FCAW semi-otomatis tidak perlu diuji bila visual menunjukkan profil kontinu dan seragam, bebas repair, dan NDE tidak menunjukkan cacat berarti.', ref: 'S14 Part A Tabel 3 dan catatan 4, hlm. 13' },
          { param: 'Fillet batas tangki/kompartemen (termasuk penetrasi)', value: 'Leak test wajib. Coating baru boleh setelah leak test. Akses aman wajib', ref: 'S14 Part A Tabel 3, hlm. 13' },
          { param: 'Coating sementara yang bisa menutupi cacat', value: 'Mengikuti waktu yang sama dengan final coating. Shop primer dikecualikan', ref: 'S14 Part A 4.5.2, hlm. 8' },
        ],
      },
    ],
    notes: [
      'Leak test dilakukan per tangki atau kompartemen. Pencatatan per kompartemen tersedia di tahap berikutnya.',
      'Metode lain boleh bila Kelas menyetujuinya sebelum pengujian dimulai (4.4.9).',
    ],
  };
  
  const STRUCT: CriteriaSet = {
    source: 's14',
    calc: 'partC',
    groups: [
      {
        title: 'Tinggi uji (di atas top of tank)',
        columns: 'value',
        rows: [
          { param: 'Part A/B (kapal SOLAS): tangki dasar ganda, double side, deep tank, peak tank', value: 'Nilai terbesar dari: top of overflow, atau 2,4 m di atas top of tank. Dasar ganda dan double side juga sampai bulkhead deck', ref: 'S14 Part A Tabel 1 butir 1, 3, 5, 8, hlm. 9' },
          { param: 'Part A/B: tangki bahan bakar', value: 'Nilai terbesar dari: top of overflow, 2,4 m di atas top of tank, top of tank + tekanan uap desain, atau bulkhead deck', ref: 'S14 Part A Tabel 1 butir 21, hlm. 10' },
          { param: 'Part A/B: cargo oil tank', value: 'Nilai terbesar dari: top of overflow, 2,4 m di atas top of tank, atau top of tank + tekanan uap desain', ref: 'S14 Part A Tabel 1 butir 6, hlm. 9' },
          { param: 'Part C (non-SOLAS)', value: '0,3D + 0,76 m di atas top of tank, tidak perlu lebih dari 2,4 m (D = depth kapal)', note: 'Hanya menggantikan syarat 2,4 m. Syarat lain di Tabel 1 Part A (top of overflow, dll.) tetap berlaku.', ref: 'S14 Part C 2.3, hlm. 16' },
          { param: 'Chain locker', value: 'Sampai top of chain pipe', ref: 'S14 Part A Tabel 1 butir 18, hlm. 10' },
          { param: 'Ballast duct', value: 'Nilai terbesar dari tekanan maksimum pompa ballast atau setelan relief valve', ref: 'S14 Part A Tabel 1 butir 20, hlm. 10' },
        ],
      },
      {
        title: 'Metode, jumlah tangki, dan pengecualian',
        columns: 'value',
        rows: [
          { param: 'Metode', value: 'Hydrostatic. Hydropneumatic diterima bila ada keterbatasan praktis (kekuatan landasan, massa jenis cairan)', note: 'Seluruh permukaan luar diperiksa terhadap distorsi, bulging, buckling, kerusakan lain, dan bocor.', ref: 'S14 Part A 4.2.1, 4.4.1, 4.4.2, hlm. 5 dan 6' },
          { param: 'Kapan boleh dilakukan', value: 'Boleh saat kapal afloat, asal hasil leak test sudah memuaskan sebelum afloat', ref: 'S14 Part A 4.2.1, hlm. 5' },
          { param: 'Jumlah tangki (Part C)', value: 'Minimal satu tangki dari satu grup tangki yang mirip struktur, per kapal. Tangki lain diuji bocor dengan air test', note: 'Tidak berlaku untuk batas ruang kargo yang berdekatan dengan kompartemen lain pada tanker, atau tangki kargo terpisah/polutan: semuanya wajib uji struktural.', ref: 'S14 Part C 2.4, hlm. 16' },
          { param: 'Pemilihan tangki', value: 'Dipilih agar semua anggota struktur representatif teruji terhadap tarik dan tekan. Batas diuji dari minimal satu sisi', ref: 'S14 Part C 2.2, hlm. 16' },
          { param: 'Tangki < 2 m³', value: 'Uji struktural boleh diganti leak test', ref: 'S14 Part C 2.6, hlm. 16' },
          { param: 'Tambahan tangki', value: 'Dapat diminta bila perlu setelah uji tangki pertama', ref: 'S14 Part C 2.5, hlm. 16' },
          { param: 'Kapal kembar (sister ship)', value: 'Dapat dikecualikan bila semua tangki lolos leak test dan inspeksi, serta minimal satu tangki atau ruang per kapal diuji struktural', note: 'Sister ship dengan lunas diletakkan ≥ 2 tahun setelah serah terima kapal terakhir hanya atas kebijakan Kelas, dengan syarat tertentu.', ref: 'S14 Part C 2.7 dan 2.8, hlm. 17' },
          { param: 'Ruang non-tangki dan tangki di luar subdivisi kedap air', value: 'Uji struktural boleh dikecualikan bila kekedapan terbukti lewat leak test dan inspeksi. Tidak boleh dikecualikan untuk ballast hold, chain locker, dan satu cargo hold representatif bila dipakai ballast di pelabuhan', ref: 'S14 Part A 4.2.2.3 dan 4.2.2.4, hlm. 5' },
          { param: 'Tangki untuk kargo lebih berat dari air laut', value: 'Tinggi uji mensimulasikan muatan sebenarnya sejauh praktis, tidak melebihi tekanan desain internal maksimum di top of tank', ref: 'S14 Part A 4.4.1, hlm. 6' },
        ],
      },
    ],
    notes: [
      'Tug dan tongkang umumnya non-SOLAS (Part C). Konfirmasi rezim yang dipakai kapal ini bersama Surveyor/BKI.',
      'Top of tank adalah geladak yang membentuk bagian atas tangki, tanpa menghitung hatchway.',
    ],
  };
  
  
  const R = (param: string, standard: string | null, limit: string | null, ref: string, note?: string): CriteriaRow => ({ param, standard, limit, ref, ...(note ? { note } : {}) });
  
  const REC47_NOTES = [
    'Tanda "-" berarti dokumen tidak mencantumkan nilai itu. Bila Limit kosong, nilai di luar Standard diputuskan oleh Kelas (Rec. 47 Sec. 1.1–1.2).',
    'Rec. 47 berlaku sebagai pedoman bila tidak ada standar galangan atau nasional yang diterima Kelas. Untuk area kritis atau tegangan tinggi, Kelas dapat meminta toleransi lebih ketat (Sec. 1.3 dan 7).',
    'Kriteria penerimaan NDT ada di UR W33 dan tidak dimuat di sini.',
  ];
  
  const FITUP: CriteriaSet = {
    source: 'rec47',
    groups: [
      {
        title: 'Alignment dan gap komponen (mm)',
        columns: 'stdlimit',
        rows: [
          R('Butt weld: a, t = tebal pelat yang lebih tipis', null, 'a ≤ 0,15t (strength member); a ≤ 0,2t (lainnya), maks 4,0', 'Rec. 47 Tabel 7.1, hlm. 24'),
          R('Fillet weld: a, t1 = tebal member yang lebih tipis', null, 'a ≤ t1/3 (strength dan higher stress member); a ≤ t1/2 (lainnya)', 'Rec. 47 Tabel 7.1, hlm. 24', 'Boleh dicek dengan heel line. Bila t3 < t1, pakai t3 sebagai pengganti t1.'),
          R('Gap bracket/intercostal dengan stiffener', 'a ≤ 2,0', 'a = 3,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Gap lap weld', 'a ≤ 2,0', 'a = 3,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
        ],
      },
      {
        title: 'Gap persiapan tepi, las manual dan semi-otomatis (mm)',
        columns: 'stdlimit',
        rows: [
          R('Butt: square, bevel, vee (tanpa backing strip)', 'G ≤ 3', 'G = 5', 'Rec. 47 Tabel 8.1 dan 8.2, hlm. 27 dan 28'),
          R('Single vee butt, satu sisi dengan backing strip', 'G = 3 sampai 9', 'G = 16', 'Rec. 47 Tabel 8.2, hlm. 28'),
          R('Tee fillet dan inclined fillet', 'G ≤ 2', 'G = 3', 'Rec. 47 Tabel 8.3, hlm. 29'),
          R('Las otomatis SAW', '0 ≤ G ≤ 0,8', 'G = 2', 'Rec. 47 Tabel 8.6, hlm. 32'),
        ],
      },
    ],
    notes: [
      ...REC47_NOTES,
      'Tidak dimuat di sini, buka Rec. 47: alignment flange dan tinggi T-bar (Tabel 7.2, hlm. 25), gap beam-frame dan cut-out (Tabel 7.3, hlm. 26), jarak antar las (Tabel 8.7, hlm. 33), dimensi block assembly (Tabel 6.6, hlm. 17), dan tindakan perbaikan bila di luar Limit (Tabel 9.1 sampai 9.10, hlm. 34 sampai 43).',
    ],
  };
  
  const VISUAL: CriteriaSet = {
    source: 'rec47',
    groups: [
      {
        title: 'Profil las (Tabel 8.5)',
        columns: 'stdlimit',
        rows: [
          R('Butt weld toe angle θ dan tinggi reinforcement h', 'θ ≤ 60°; h ≤ 6 mm', 'θ ≤ 90°', 'Rec. 47 Tabel 8.5, hlm. 31'),
          R('Butt weld undercut D', null, 'D ≤ 0,5 mm (strength member); D ≤ 0,8 mm (lainnya)', 'Rec. 47 Tabel 8.5, hlm. 31'),
          R('Fillet weld leg length s dan throat a, atas ukuran desain sd dan ad', null, 's ≥ 0,9 sd; a ≥ 0,9 ad (pada las pendek)', 'Rec. 47 Tabel 8.5, hlm. 31'),
          R('Fillet weld toe angle θ', null, 'θ ≤ 90°', 'Rec. 47 Tabel 8.5, hlm. 31', 'Di area konsentrasi tegangan dan fatigue, Kelas dapat meminta sudut yang lebih kecil.'),
          R('Fillet weld undercut D', null, 'D ≤ 0,8 mm', 'Rec. 47 Tabel 8.5, hlm. 31'),
        ],
      },
      {
        title: 'Fairness pelat antar frame (mm)',
        columns: 'stdlimit',
        rows: [
          R('Shell plate bagian paralel (sisi dan dasar) serta tank top plate', '4', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Strength deck: bagian paralel', '4', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Bulkhead: longitudinal, transversal, swash', '6', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
        ],
      },
    ],
    notes: [
      ...REC47_NOTES,
      'Tidak dimuat di sini, buka Rec. 47: kekasaran gas cutting (Sec. 5, hlm. 8), fairness bagian haluan/buritan, geladak lain, dan interior member (Tabel 6.10, hlm. 21), fairness pelat dengan frame (Tabel 6.11, hlm. 22), kondisi permukaan material (Tabel 1, hlm. 6 dan 7), serta spatter dan arc strike (4.2.4, hlm. 8, dan Tabel 9.13 dan 9.14, hlm. 46 dan 47).',
    ],
  };
  
  /** Kunci sama dengan stageItemKey: "<tahap>.<item>". */
  export const CRITERIA: Record<string, CriteriaSet> = {
    'fabrication.fitup': FITUP,
    'fabrication.visual': VISUAL,
    'fabrication.leaktest': LEAK,
    'fabrication.structtest': STRUCT,
  };
  
  export const criteriaFor = (itemKey: string): CriteriaSet | null => CRITERIA[itemKey] ?? null;
  
  /** Tinggi uji struktural minimum Part C (m di atas top of tank): 0,3D + 0,76, maksimal 2,4. */
  export const partCMinHead = (depthD: number): number => Math.min(0.3 * depthD + 0.76, 2.4);
  
  /** Tinggi yang menentukan: nilai terbesar antara Part C dan top of overflow (m di atas top of tank). */
  export const governingHead = (depthD: number, overflowAbove: number | null): { head: number; by: 'partC' | 'overflow' } => {
    const c = partCMinHead(depthD);
    if (overflowAbove != null && overflowAbove > c) return { head: overflowAbove, by: 'overflow' };
    return { head: c, by: 'partC' };
  };
  
  export type Regime = 'A' | 'C';
  
  /** Tinggi uji minimum Part A/B (SOLAS): 2,4 m di atas top of tank. */
  export const PART_A_MIN_HEAD = 2.4;
  
  /** Tinggi yang menentukan untuk Part A/B: nilai terbesar antara 2,4 m dan top of overflow. */
  export const governingHeadA = (overflowAbove: number | null): { head: number; by: 'partA' | 'overflow' } =>
    overflowAbove != null && overflowAbove > PART_A_MIN_HEAD ? { head: overflowAbove, by: 'overflow' } : { head: PART_A_MIN_HEAD, by: 'partA' };
  
  /**
   * Saran rezim S14 dari data proyek. Hanya saran: status SOLAS ditentukan dokumen Kelas/Flag dan ITP.
   * Part B (pembebasan/kesetaraan resmi dari Flag) tidak bisa disimpulkan dari data ini.
   */
  export function suggestRegime(i: { propelled: boolean; international: boolean; gt: number | null }): { regime: Regime | null; reason: string } {
    if (!i.propelled) return { regime: 'C', reason: 'Kapal tanpa penggerak: umumnya non-SOLAS.' };
    if (!i.international) return { regime: 'C', reason: 'Bukan pelayaran internasional: umumnya non-SOLAS.' };
    if (i.gt == null) return { regime: null, reason: 'GT belum diisi, rezim belum bisa disarankan.' };
    if (i.gt >= 500) return { regime: 'A', reason: 'Internasional dan GT 500 ke atas: umumnya SOLAS.' };
    return { regime: 'C', reason: 'GT di bawah 500: umumnya non-SOLAS.' };
  }
  