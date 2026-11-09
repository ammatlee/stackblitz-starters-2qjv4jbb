/**
 * BKI Circular 22-SV-185 (15 Des 2022), Lampiran 1:
 * persyaratan minimum material dan komponen kapal yang dibangun di bawah pengawasan BKI.
 *
 * Hanya berlaku bila permohonan penerimaan klas diterima sejak CIRCULAR_185_START.
 * Hal yang tidak diatur di sini merujuk ke Rules BKI dan dikoordinasikan dengan Divisi Survey.
 * Data ditranskrip dari gambar lampiran: cek sampel sebelum dipakai untuk keputusan.
 */

export type MatTipe = 'A' | 'B' | 'C' | 'D';

export const CIRCULAR_185_START = '2022-12-15';

/** Arti kolom. Tipe A–C punya 3 kolom (MP, TA, PC); tipe D hanya satu kolom (teks). */
export const COL_LEGEND = {
  MP: 'Persetujuan proses pembuatan (manufacturing process approval)',
  TA: 'Persetujuan tipe (type approval)',
  PC: 'Sertifikat produk/individu (product certificate)',
} as const;

/** Arti kode di sel. '-' = tidak disyaratkan. */
export const CELL_LEGEND = {
  V: 'Sertifikat BKI (melalui proses sertifikasi BKI atau resertifikasi dari klas IACS)',
  X: 'Sertifikat klas IACS dapat diterima',
  M: 'Sertifikat manufaktur (manufacture certificate / certify of origin)',
} as const;

/** Syarat tipe kapal (butir 2 circular). */
export const TIPE_LEGEND: Record<MatTipe, string> = {
  A: 'Pelayaran internasional, GT ≥ 500, notasi Unrestricted/P/L',
  B: 'Non-internasional GT ≥ 500, atau internasional GT < 500 (notasi Unrestricted/P/L)',
  C: 'Non-internasional GT < 500 (notasi Unrestricted/P/L), atau kapal tanpa instalasi penggerak',
  D: 'Non-internasional, semua GT, notasi pelayanan dibatasi max L(20)',
};

/** Catatan angka di belakang V atau X (mis. V4, X3, V1,3). */
export const NOTES: Record<number, string> = {
  1: 'Section (profile, bars, beams, dsb) harus diuji untuk item dengan supplier yang sama dan pembatasan tonase.',
  2: 'Pelat harus bersertifikat BKI atau klas IACS, dilengkapi bukti (tanpa resertifikasi).',
  3: 'Untuk kapal ≥ 500 GT.',
  4: 'Manufaktur wajib memiliki WPS dan sertifikat welder.',
  5: 'Untuk kapal tanker.',
  6: 'Untuk daya P > 100 kW.',
  7: 'Untuk daya P > 1000 kW.',
  8: 'Untuk daya P > 2500 kW.',
  9: 'Bejana tekan Class I & II.',
  10: 'Untuk Class I & II.',
  11: 'Mengacu ke Rules for Machinery Installations (Pt.1, Vol.III) Tabel 11.3 "Approved Materials and Type of Material Certificates".',
  12: 'Untuk daya P > 50 kW.',
  13: 'Untuk daya P > 100 kVA.',
  14: 'Untuk connected power ≥ 500 kVA.',
  15: 'Jika persetujuan tipe tidak tersedia, pengujian individual di manufaktur dapat diterima.',
  16: 'Untuk kapal dengan notasi tambahan OT.',
};

/** Welding shop, WPS, dan welder: yang menyetujui per tipe. null = tidak disyaratkan. */
export type Approver = 'BKI' | 'BKI/IACS' | null;
export const WELDING: Record<'weldingShop' | 'wps' | 'welder', Record<MatTipe, Approver>> = {
  weldingShop: { A: 'BKI', B: 'BKI', C: null, D: null },
  wps: { A: 'BKI', B: 'BKI/IACS', C: 'BKI/IACS', D: null },
  welder: { A: 'BKI', B: 'BKI/IACS', C: 'BKI/IACS', D: null },
};

/** [MP, TA, PC]; '-' = tidak disyaratkan; huruf V/X/M boleh diikuti nomor catatan. */
export type Tri = [string, string, string];

export type MatItem = {
  no: number;
  product: string;
  kind?: string;
  A: Tri;
  B: Tri;
  C: Tri;
  /** Tipe D: satu kolom ('M', teks syarat, atau '-'). */
  D: string;
};

const N: Tri = ['-', '-', '-'];
const MK = 'Maker Certificate jika ada, Test Report (visual inspection dan uji material)';
const VM = 'Visual Inspection dan Manufacture Certificate';
const VN = 'Visual Inspection, dimension check dan NDT';

export const MATERIAL_ITEMS: MatItem[] = [
  { no: 1, product: 'Plate', kind: 'Steel / Aluminium alloys', A: ['V', '-', 'V'], B: ['-', '-', 'X2'], C: ['-', '-', 'X2'], D: MK },
  { no: 2, product: 'Strips, Section (profile, angle bar, beam), and Bars', kind: 'Steel / Aluminium alloys', A: ['V', '-', 'V'], B: ['-', '-', 'V1,3'], C: N, D: '-' },
  { no: 3, product: 'Steel-Aluminium Welding Joints', A: ['V', '-', 'V'], B: ['V', '-', 'V2,3'], C: ['-', '-', 'V2'], D: MK },
  { no: 4, product: 'Loading Computer/Instrument', A: ['-', 'V', '-'], B: N, C: N, D: '-' },
  { no: 5, product: 'Door', kind: 'Watertight door', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 5, product: 'Door', kind: 'Weathertight door', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 5, product: 'Door', kind: 'Fire door', A: ['-', 'V', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 6, product: 'Rudder Stock', A: ['-', '-', 'V'], B: ['-', '-', 'V'], C: ['-', '-', 'V'], D: MK },
  { no: 7, product: 'Pintles', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 8, product: 'Coupling bolts', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 9, product: 'Hatch Covers', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 10, product: 'Hatch Coaming', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 11, product: 'Anchor', kind: 'Normal Holding Power', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: VM },
  { no: 11, product: 'Anchor', kind: 'HHP / VHHP', A: ['V', 'V', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: VM },
  { no: 11, product: 'Anchor', kind: 'Welded Anchor HHP/VHHP', A: ['-', 'V', 'V4'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: VM },
  { no: 12, product: 'Chain Cable & Asesoris', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: VM },
  { no: 13, product: 'Side Scuttle', A: ['-', '-', 'V'], B: ['-', '-', 'V3'], C: N, D: '-' },
  { no: 14, product: 'Windows', A: ['-', '-', 'V'], B: ['-', '-', 'V3'], C: N, D: '-' },
  { no: 15, product: 'Securing Device (stowing & lashing equipment)', A: ['-', 'V', '-'], B: N, C: N, D: '-' },
  { no: 16, product: 'Protective coating system for Ballast Tank', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: ['-', 'X', '-'], D: '-' },
  { no: 17, product: 'Protective coating system for Cargo Oil Tank', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: ['-', 'X', '-'], D: '-' },
  { no: 18, product: 'Emergency Towing Arrangements', A: ['-', 'V', 'V5'], B: ['-', 'V', 'V5'], C: N, D: '-' },
  { no: 19, product: 'FRP Gratings (access to tanker bow)', A: ['-', 'V5', '-'], B: ['-', 'X5', '-'], C: ['-', 'X5', '-'], D: '-' },
  { no: 20, product: 'Fire Protection Material (Type A, B, C Class)', kind: 'Partition, Fire Damper, Duct penetration, Insulation Material, Linings, Ceiling, Surface material, Deck Covering', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 21, product: 'Oiltight Hatch Cover', A: ['-', '-', 'X5'], B: ['-', '-', 'X5'], C: N, D: '-' },
  { no: 22, product: 'Hose Assembly', A: ['-', 'X', '-'], B: N, C: N, D: '-' },
  { no: 23, product: 'Flexible Hose Assembly', A: ['-', 'X', '-'], B: N, C: N, D: '-' },
  { no: 24, product: 'Compensator', A: ['-', 'X', '-'], B: N, C: N, D: '-' },
  { no: 25, product: 'Flame protection covers for non-metallic hoses', A: ['-', 'X', '-'], B: N, C: N, D: '-' },
  { no: 26, product: 'CO2 Hoses', A: ['-', 'X', '-'], B: N, C: N, D: '-' },
  { no: 27, product: 'Towing hook and attached load transmitting elements, including slip device (for TOW notation)', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 28, product: 'Towing winch: frame, drum shaft(s), couplings, brakes, and gear(s) (for TOW notation)', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 29, product: 'Towrope(s), including certification of breaking force (for TOW notation)', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 30, product: 'Antifouling System', A: ['-', 'V', '-'], B: ['-', 'V', '-'], C: ['-', 'V', '-'], D: '-' },
  { no: 31, product: 'Sacrificial Anode', A: ['-', 'V', '-'], B: N, C: N, D: '-' },
  { no: 32, product: 'Diesel Engine', A: ['-', 'V', 'V'], B: ['-', 'V6', 'V6'], C: ['-', 'V6', 'M'], D: 'M' },
  { no: 33, product: 'Gas Engine (with additional notation GF(DF) dan GF(SF))', A: ['-', 'V', 'V'], B: ['-', 'V6', 'V6'], C: ['-', 'V6', 'M'], D: 'M' },
  { no: 34, product: 'Air Compressor', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 35, product: 'Steam Turbines', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 36, product: 'Gas Turbine', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 37, product: 'Exhaust Gas Turbocharger', A: ['-', 'V7', 'V8'], B: ['-', 'X7', 'X8'], C: N, D: '-' },
  { no: 38, product: 'Shaft', A: ['-', '-', 'V'], B: ['-', '-', 'V'], C: ['-', '-', 'V'], D: MK },
  { no: 39, product: 'Shaft Sealing (Oil Lubricated)', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 40, product: 'Shaft Liner', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 41, product: 'Shaft Coupling', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 42, product: 'Shaft Bolt', A: ['-', '-', 'V'], B: N, C: N, D: '-' },
  { no: 43, product: 'Stern Tube', A: ['-', '-', 'V'], B: ['-', '-', 'V3'], C: N, D: '-' },
  { no: 44, product: 'Gear', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 45, product: 'Gearing System (Gearbox)', A: ['-', '-', 'V'], B: ['-', '-', 'V3'], C: ['-', '-', 'M'], D: 'M' },
  { no: 46, product: 'Tooth Coupling', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 47, product: 'Flexible Coupling', A: ['-', 'V', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 48, product: 'Flange & Clamp-Type Coupling', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 49, product: 'Clutch', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 50, product: 'Propeller', kind: 'FPP / CPP', A: ['V', '-', 'V'], B: ['V', '-', 'V'], C: ['-', '-', 'X'], D: VN },
  { no: 51, product: 'Steam Boiler', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 52, product: 'Hot Water Generators Plant', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 53, product: 'Flue Gas Economizer', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 54, product: 'Thermal Oil System', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 55, product: 'Pressure Vessel', A: ['V9', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 56, product: 'Heat Exchanger', A: ['V9', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 57, product: 'Gas Cylinder', A: ['-', 'V', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 58, product: 'Oil Burner', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 59, product: 'Pipes, Fitting and Valve', A: ['V10', '-', 'V11'], B: ['-', '-', 'X11'], C: N, D: '-' },
  { no: 60, product: 'Plastic Pipe System', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  {
    no: 61,
    product: 'Pumps',
    kind: 'Bilge/ballast/cooling/fire/emergency fire/condensate/boiler feed/boiler circulating/lubricating oil/fuel oil booster and transfer/thermal oil/brine/refrigerant/cargo/fuel injection valve cooling/CPP hydraulic/drencher pumps',
    A: ['V10', '-', 'V'],
    B: ['-', '-', 'V3'],
    C: ['-', '-', 'M'],
    D: 'M',
  },
  { no: 62, product: 'Steering Gear', A: ['-', '-', 'V'], B: ['-', '-', 'V3'], C: N, D: '-' },
  { no: 63, product: 'Hyd. Pump & Hyd. Motor', A: ['-', 'V12', 'V12'], B: ['-', '-', 'X12'], C: N, D: '-' },
  { no: 64, product: 'Rudder Propeller Unit', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 65, product: 'Lateral Thrust Unit', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 66, product: 'Windlasses', A: ['-', '-', 'V4'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 67, product: 'Winches', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 68, product: 'Hydraulic System', kind: 'Penggerak hatch cover, closing appliances shell dan bulkhead, hoist', A: ['-', '-', 'V'], B: ['-', '-', 'X3'], C: N, D: '-' },
  { no: 69, product: 'Fire Door Control System', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 70, product: 'Stabilizers drive unit', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 71, product: 'Electrical machines', kind: 'Generators and motors for electric propulsion plants', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'X'], D: '-' },
  { no: 71, product: 'Electrical machines', kind: 'Generators and motors for essential equipment', A: ['-', '-', 'V13'], B: ['-', '-', 'X13'], C: ['-', '-', 'M'], D: '-' },
  { no: 71, product: 'Electrical machines', kind: 'Power transformer', A: ['-', '-', 'V13'], B: ['-', '-', 'X13'], C: N, D: '-' },
  { no: 71, product: 'Electrical machines', kind: 'Autotransformers', A: ['-', '-', 'V13'], B: ['-', '-', 'X13'], C: N, D: '-' },
  { no: 72, product: 'Power electronic', kind: 'Power electronic propulsion plants', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: ['-', '-', 'M'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Main switchboards', A: ['V', '-', 'V'], B: ['-', '-', 'V13'], C: ['-', '-', 'V13'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Emergency switchboards', A: ['V', '-', 'V'], B: ['-', '-', 'V13'], C: ['-', '-', 'V13'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Switchboards for electric propulsion plants', A: ['-', '-', 'V'], B: ['-', '-', 'V13'], C: ['-', '-', 'V13'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Switchboards for operation of equipment with Class Notation, e.g. cargo-refrigerating systems RIC', A: ['-', '-', 'V'], B: ['-', '-', 'V13'], C: ['-', '-', 'V13'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Distribution switchboards', A: ['-', '-', 'V14'], B: ['-', '-', 'V14'], C: N, D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Starters for motors for essential equipment', A: ['-', '-', 'V13'], B: ['-', '-', 'X13'], C: ['-', '-', 'M'], D: '-' },
  { no: 73, product: 'Switchboards', kind: 'Starters for and control for steam boilers and thermal oil systems', A: ['-', '-', 'V13'], B: ['-', '-', 'X13'], C: ['-', '-', 'M'], D: '-' },
  { no: 74, product: 'Computer systems', A: ['-', 'V', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 75, product: 'Cable and accessories', kind: 'Power cables and insulated wires', A: ['-', 'V15', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 75, product: 'Cable and accessories', kind: 'Sealing compound and packing systems for bulkhead and deck penetrations', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 75, product: 'Cable and accessories', kind: 'Busbar trunking systems for the installation', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 75, product: 'Cable and accessories', kind: 'Cable trays/protective casings made of plastic materials', A: ['-', 'V', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 76, product: 'Installations, applied by the rules for construction for automated and/or remotely controlled systems', A: ['-', 'V16', '-'], B: ['-', 'X', '-'], C: N, D: '-' },
  { no: 77, product: 'Electric heater', kind: 'Fuel oil heating systems', A: ['-', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 78, product: 'Wire Ropes (towing line, mooring line & cargo handling)', kind: 'Medium, high carbon steel, stainless steel', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 79, product: 'Fibre Ropes (towing line, mooring line & cargo handling)', kind: 'Natural and synthetic fibres', A: ['V', '-', 'V'], B: ['-', '-', 'X'], C: N, D: '-' },
  { no: 80, product: 'Gelcoat and/or laminating resins', A: ['-', 'V', '-'], B: ['-', 'V', '-'], C: ['-', 'V', '-'], D: '-' },
  { no: 81, product: 'Reinforcing materials', A: ['-', 'V', '-'], B: ['-', 'V', '-'], C: ['-', 'X', '-'], D: '-' },
  { no: 82, product: 'Prepregs', A: ['-', 'X', '-'], B: ['-', 'X', '-'], C: ['-', 'X', '-'], D: '-' },
  { no: 83, product: 'Core materials', A: ['-', 'X', '-'], B: ['-', 'X', '-'], C: ['-', 'X', '-'], D: '-' },
  { no: 84, product: 'Welding consumable', kind: 'Covered electrode / Other', A: ['-', 'V', '-'], B: ['-', 'V', '-'], C: ['-', 'X', '-'], D: '-' },
];

/** Hasil baca satu sel: kode (V/X/M) dan nomor catatannya. */
export type ParsedCell = { code: 'V' | 'X' | 'M'; notes: number[] };
export function parseCell(s: string): ParsedCell | null {
  const m = /^([VXM])(\d+(?:,\d+)*)?$/.exec(s.trim());
  if (!m) return null; // '-' atau teks
  return { code: m[1] as 'V' | 'X' | 'M', notes: m[2] ? m[2].split(',').map(Number) : [] };
}

export type MatInput = {
  /** Notasi pelayanan dibatasi max L(20). */
  notasiL20: boolean;
  /** Kapal punya instalasi penggerak sendiri. */
  propelled: boolean;
  /** Berlayar internasional. */
  international: boolean;
  /** Gross tonnage; null bila belum diisi. */
  gt: number | null;
};

/**
 * Tipe material menurut butir 2 circular. Urutan: L(20) → D; tanpa penggerak → C;
 * lalu internasional dan GT. null bila GT dibutuhkan tetapi belum diisi.
 */
export function materialTipe(i: MatInput): MatTipe | null {
  if (i.notasiL20) return 'D';
  if (!i.propelled) return 'C';
  if (i.gt == null) return null;
  const big = i.gt >= 500;
  if (i.international) return big ? 'A' : 'B';
  return big ? 'B' : 'C';
}

/** True bila circular berlaku (permohonan klas diterima sejak 15 Des 2022). Tanggal ISO yyyy-mm-dd. */
export const circularApplies = (applicationDate: string | null | undefined): boolean =>
  !!applicationDate && applicationDate >= CIRCULAR_185_START;

/** Sel yang berlaku untuk item pada tipe tertentu: tipe A–C berupa 3 kolom, tipe D berupa teks. */
export function cellsFor(item: MatItem, tipe: MatTipe): Tri | string {
  return tipe === 'D' ? item.D : item[tipe];
}

/** Item yang disyaratkan (ada sel selain '-') untuk tipe tertentu. */
export function itemsRequired(tipe: MatTipe): MatItem[] {
  return MATERIAL_ITEMS.filter((it) => {
    const c = cellsFor(it, tipe);
    return typeof c === 'string' ? c !== '-' : c.some((x) => x !== '-');
  });
}
