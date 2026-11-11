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
    'Hasil ukur sebaiknya tersebar merata di sekitar nilai nominal. Distribusi yang miring menuntut galangan memperbaiki proses kerjanya (Sec. 1.5).',
    'Kriteria penerimaan NDT ada di UR W33 dan tidak dimuat di sini.',
  ];
  
  const FITUP: CriteriaSet = {
    source: 'rec47',
    groups: [
      {
        title: 'Alignment (mm)',
        columns: 'stdlimit',
        rows: [
          R('Butt weld: a, t = tebal pelat yang lebih tipis', null, 'a ≤ 0,15t (strength member); a ≤ 0,2t (lainnya), maks 4,0', 'Rec. 47 Tabel 7.1, hlm. 24'),
          R('Fillet weld: a, t1 = tebal member yang lebih tipis', null, 'a ≤ t1/3 (strength dan higher stress member); a ≤ t1/2 (lainnya)', 'Rec. 47 Tabel 7.1, hlm. 24', 'Boleh dicek dengan heel line. Bila t3 < t1, pakai t3 sebagai pengganti t1.'),
          R('Flange T-longitudinal: b = lebar flange', 'a ≤ 0,04b (strength member)', 'a = 8,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Tinggi T-bar, L-angle, bulb: t = tebal', 'a ≤ 0,15t (strength member); a ≤ 0,20t (lainnya)', 'a = 3,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Panel stiffener: L = panjang', 'd ≤ L/50', null, 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Gap bracket/intercostal dengan stiffener', 'a ≤ 2,0', 'a = 3,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Gap lap weld', 'a ≤ 2,0', 'a = 3,0', 'Rec. 47 Tabel 7.2, hlm. 25'),
          R('Gap antara beam dan frame', 'a ≤ 2,0', 'a = 5,0', 'Rec. 47 Tabel 7.3, hlm. 26'),
          R('Gap di sekitar cut-out stiffener', 's ≤ 2,0', 's = 3,0', 'Rec. 47 Tabel 7.3, hlm. 26'),
        ],
      },
      {
        title: 'Gap persiapan tepi, las manual dan semi-otomatis (mm)',
        columns: 'stdlimit',
        rows: [
          R('Butt: square, single bevel, double bevel, double vee', 'G ≤ 3', 'G = 5', 'Rec. 47 Tabel 8.1, hlm. 27'),
          R('Single vee butt', 'G ≤ 3', 'G = 5', 'Rec. 47 Tabel 8.2, hlm. 28'),
          R('Single vee butt, satu sisi dengan backing strip', 'G = 3 sampai 9', 'G = 16', 'Rec. 47 Tabel 8.2, hlm. 28'),
          R('Tee fillet dan inclined fillet', 'G ≤ 2', 'G = 3', 'Rec. 47 Tabel 8.3, hlm. 29'),
          R('Single bevel tee, double bevel tee (t > 19)', 'G ≤ 3', null, 'Rec. 47 Tabel 8.3 dan 8.4, hlm. 29 dan 30'),
          R('Las otomatis SAW', '0 ≤ G ≤ 0,8', 'G = 2', 'Rec. 47 Tabel 8.6, hlm. 32'),
        ],
      },
      {
        title: 'Jarak antar las (mm)',
        columns: 'stdlimit',
        rows: [
          R('Butt weld dengan fillet weld, d diukur dari toe ke toe', null, 'd ≥ 10 (strength member); d ≥ 0 (lainnya)', 'Rec. 47 Tabel 8.7, hlm. 33'),
          R('Scallop di atas seam las', null, 'd ≥ 5 (strength member); d ≥ 0 (lainnya)', 'Rec. 47 Tabel 8.7, hlm. 33'),
          R('Antar butt weld di sekitar cut-out', 'd ≥ 30', null, 'Rec. 47 Tabel 8.7, hlm. 33'),
          R('Antar butt weld pada margin plate', 'd ≥ 300', '150', 'Rec. 47 Tabel 8.7, hlm. 33'),
        ],
      },
      {
        title: 'Selengkapnya: dimensi block assembly (mm)',
        columns: 'stdlimit',
        collapsed: true,
        rows: [
          R('Flat plate assembly: panjang dan lebar', '± 4', '± 6', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat plate assembly: distorsi', '± 10', '± 20', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat plate assembly: squareness', '± 5', '± 10', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat plate assembly: deviasi interior member dari pelat', '5', '10', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: panjang dan lebar', '± 4', '± 6', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: distorsi', '± 10', '± 20', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: squareness', '± 5', '± 10', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: deviasi interior member dari pelat', '5', '10', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: twist', '± 10', '± 20', 'Rec. 47 Tabel 6.6, hlm. 17'),
          R('Flat cubic assembly: deviasi antara pelat atas dan bawah', '± 5', '± 10', 'Rec. 47 Tabel 6.6, hlm. 17'),
        ],
      },
      {
        title: 'Selengkapnya: bila di luar Limit (remedial)',
        columns: 'value',
        collapsed: true,
        rows: [
          { param: 'Butt misalignment melewati Limit (a > 0,15t / 0,2t atau > 4 mm)', value: 'Release dan adjust', ref: 'Rec. 47 Tabel 9.1, hlm. 34' },
          { param: 'Fillet misalignment', value: 'Strength member: t1/3 < a ≤ t1/2, umumnya throat las ditambah 10%. a > t1/2: release dan adjust minimal sepanjang 50a (strength member) atau 30a (lainnya)', ref: 'Rec. 47 Tabel 9.1, hlm. 34' },
          { param: 'Gap butt manual/semi-otomatis', value: 'Square butt: G ≤ 10 mm chamfer 45° dan build up. G > 10 mm: build up dengan backing strip lalu back gouge dan seal weld, atau insert plate lebar minimal 300 mm. Bevel/vee: 5 < G ≤ 1,5t (maks 25 mm) build up sampai maks 0,5t. G > 25 mm atau 1,5t (mana yang lebih kecil): insert plate lebar minimal 300 mm', ref: 'Rec. 47 Tabel 9.4 dan 9.5, hlm. 37 dan 38' },
          { param: 'Gap tee fillet', value: '3 < G ≤ 5 mm: leg length jadi leg aturan + (G − 2). 5 < G ≤ 16 mm atau G ≤ 1,5t: chamfer 30–45°, build up, grind, las. G > 16 mm atau 1,5t: insert plate lebar minimal 300 mm', ref: 'Rec. 47 Tabel 9.6, hlm. 39' },
          { param: 'Gap bracket/intercostal dengan stiffener', value: '3 < a ≤ 5 mm: leg length ditambah sebesar kelebihan gap di atas 3 mm. 5 < a ≤ 10 mm: chamfer 30–40° dan build up dengan backing. a > 10 mm: perlebar gap sekitar 50 mm dan pasang collar plate', ref: 'Rec. 47 Tabel 9.2, hlm. 35' },
          { param: 'Gap beam dan frame, serta lap weld', value: '3 < a ≤ 5 mm: leg length ditambah sebesar kelebihan gap di atas 3 mm. a > 5 mm: release dan adjust (lap weld: align ulang)', ref: 'Rec. 47 Tabel 9.1 dan 9.2, hlm. 34 dan 35' },
          { param: 'Gap di sekitar cut-out stiffener', value: '3 < s ≤ 5 mm: leg length ditambah sebesar kelebihan gap di atas 2 mm. 5 < s ≤ 10 mm: nib di-chamfer dan build up. s > 10 mm: potong nib dan pasang collar plate setinggi nib', ref: 'Rec. 47 Tabel 9.3, hlm. 36' },
          { param: 'Jarak scallop ke butt weld kurang', value: 'Lubang dipotong dan digerinda halus sampai jarak tercapai', ref: 'Rec. 47 Tabel 9.10, hlm. 43' },
        ],
      },
    ],
    notes: REC47_NOTES,
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
        title: 'Kekasaran hasil gas cutting (µm)',
        columns: 'stdlimit',
        rows: [
          R('Free edge: strength member', '150', '300', 'Rec. 47 Sec. 5, hlm. 8'),
          R('Free edge: lainnya', '500', '1000', 'Rec. 47 Sec. 5, hlm. 8'),
          R('Welding edge: strength member', '400', '800', 'Rec. 47 Sec. 5, hlm. 8'),
          R('Welding edge: lainnya', '800', '1500', 'Rec. 47 Sec. 5, hlm. 8'),
        ],
      },
      {
        title: 'Fairness pelat antar frame, s = jarak antar frame (mm)',
        columns: 'stdlimit',
        rows: [
          R('Shell plate: bagian paralel (sisi dan dasar)', '4', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Shell plate: bagian haluan dan buritan', '5', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Tank top plate', '4', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Bulkhead: longitudinal, transversal, swash', '6', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Strength deck: bagian paralel', '4', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Interior member (web girder dll.)', '5', '7', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Floor dan girder dasar ganda', '5', '8', 'Rec. 47 Tabel 6.10, hlm. 21'),
        ],
      },
      {
        title: 'Fairness pelat dengan frame, l = bentang frame dalam mm (min 3000)',
        columns: 'stdlimit',
        rows: [
          R('Shell plate: bagian paralel', '± 2 l/1000', '± 3 l/1000', 'Rec. 47 Tabel 6.11, hlm. 22', 'Contoh l = 3000 mm: Standard 6 mm, Limit 9 mm.'),
          R('Shell plate: bagian haluan dan buritan', '± 3 l/1000', '± 4 l/1000', 'Rec. 47 Tabel 6.11, hlm. 22'),
          R('Strength deck (tanpa cross deck) dan top plate dasar ganda', '± 3 l/1000', '± 4 l/1000', 'Rec. 47 Tabel 6.11, hlm. 22'),
          R('Bulkhead', null, '± 5 l/1000', 'Rec. 47 Tabel 6.11, hlm. 22'),
          R('Akomodasi di atas strength deck dan lainnya', '± 5 l/1000', '± 6 l/1000', 'Rec. 47 Tabel 6.11, hlm. 22'),
        ],
      },
      {
        title: 'Selengkapnya: fairness antar frame, geladak dan dinding (mm)',
        columns: 'stdlimit',
        collapsed: true,
        rows: [
          R('Strength deck: haluan dan buritan', '6', '9', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Strength deck: bagian tertutup', '7', '9', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Second deck: terbuka / tertutup', '6 / 7', '8 / 9', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Forecastle dan poop deck: terbuka / tertutup', '4 / 6', '8 / 9', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Geladak bangunan atas: terbuka / tertutup', '4 / 7', '6 / 9', 'Rec. 47 Tabel 6.10, hlm. 21'),
          R('Dinding rumah geladak: luar / dalam / tertutup', '4 / 6 / 7', '6 / 8 / 9', 'Rec. 47 Tabel 6.10, hlm. 21'),
        ],
      },
      {
        title: 'Selengkapnya: kondisi permukaan material (Tabel 1)',
        columns: 'value',
        collapsed: true,
        rows: [
          { param: 'Kedalaman cacat minor yang boleh dibiarkan, t < 20 mm', value: 'Luas area terpengaruh 15–20%: 0,2 mm. 5–15%: 0,4 mm. 0–5%: 0,5 mm', note: 'Rasio = luas terpengaruh dibagi luas pelat x 100%. Luas diukur dengan garis 20 mm di sekeliling cacat.', ref: 'Rec. 47 4.2.2 dan Tabel 1, hlm. 6 dan 7' },
          { param: 'Kedalaman cacat minor yang boleh dibiarkan, 20 ≤ t < 50 mm', value: '15–20%: 0,2 mm. 5–15%: 0,6 mm. 0–5%: 0,7 mm', ref: 'Rec. 47 Tabel 1, hlm. 6' },
          { param: 'Kedalaman cacat minor yang boleh dibiarkan, t ≥ 50 mm', value: '15–20%: 0,2 mm. 5–15%: 0,7 mm. 0–5%: 0,9 mm', ref: 'Rec. 47 Tabel 1, hlm. 6' },
          { param: 'Cacat di atas batas tabel', value: 'Diperbaiki dengan grinding dan/atau pengelasan sesuai UR W11', ref: 'Rec. 47 4.2.3, hlm. 8' },
        ],
      },
      {
        title: 'Selengkapnya: spatter dan arc strike',
        columns: 'value',
        collapsed: true,
        rows: [
          { param: 'Loose weld spatter wajib dibersihkan sampai permukaan logam bersih, sesuai sistem cat, pada', value: 'Shell plating, geladak terbuka, tangki kargo kimia, tangki air tawar dan air minum, tangki minyak lumas dan hidrolik (termasuk tangki servis)', ref: 'Rec. 47 4.2.4.2, hlm. 8' },
          { param: 'Cara membersihkan spatter', value: 'Sebelum blasting: scraper atau chipping hammer. Setelah blasting: chipping hammer atau scraper; bila sulit, gerinda sudut tajamnya sampai tumpul. Permukaan las pada prinsipnya tidak digerinda', ref: 'Rec. 47 Tabel 9.13, hlm. 46' },
          { param: 'Arc strike pada baja HT, cast steel, mild steel grade E, TMCP, baja suhu rendah', value: 'Zona yang mengeras dihilangkan dengan grinding atau cara lain seperti overlapped weld bead. Acuan short bead di Tabel 9.14', ref: 'Rec. 47 Tabel 9.13 dan 9.14, hlm. 46 dan 47' },
        ],
      },
    ],
    notes: REC47_NOTES,
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
  