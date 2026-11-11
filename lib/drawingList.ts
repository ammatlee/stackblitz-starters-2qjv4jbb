/**
 * Daftar gambar/dokumen wajib BKI untuk penerimaan klas bangunan baru (tabel New Building).
 * Sumber: Daftar Persyaratan Gambar/Dokumen Penerimaan Klas dan Modifikasi Kapal Rev.03.
 *
 * Data diekstrak per kolom dari PDF asli lalu dicek pengguna (file "Daftar gambar wajib BKI Rev.03").
 * Kolom jenis kapal lain (cargo, kontainer, penumpang, gas, offshore, dll.) dibaca langsung dari PDF dengan cara yang sama
 * (cara bacanya diuji dulu pada 5 kolom yang sudah dicek: 425 sel cocok semua).
 * Hanya berubah bila BKI menerbitkan revisi: ganti baris di DRAWING_ROWS, lalu sesuaikan angka di tests/newbuildingDrawings.test.ts.
 *
 * Bentuk satu baris: [nomor, judul, kelompok, sel per kolom, judul khusus tongkang?].
 * Sel: 'M' = wajib; 'O' = jika ada/opsional; huruf + angka (mis. 'M2', 'O12') = bersyarat.
 * Syarat ditulis setelah tanda '|' (mis. 'M2|jika terpasang di kapal'); bila tidak ditulis, dipakai CODE_COND.
 * Kolom yang tidak muncul di sebuah baris = gambar itu tidak berlaku untuk kolom tersebut.
 */

export const DRAWING_LIST_REV = 'BKI Rev.03';

export type DrawingCol = 'TUG' | 'PONTOON' | 'OIL_TANKER' | 'CHEM_TANKER' | 'BARGE_A' | 'BARGE_B' | 'BARGE_C' | 'BARGE_D' | 'BARGE_E' | 'BARGE_F' | 'LCT'
  | 'GENERAL_CARGO'
  | 'BULK_CARRIER'
  | 'CONTAINER'
  | 'RORO_CARGO'
  | 'PASSENGER'
  | 'RORO_PASSENGER'
  | 'GAS_CARRIER'
  | 'DREDGER'
  | 'SUPPLY'
  | 'FISHING'
  | 'FPSO'
  | 'FSO';

export const DRAWING_COLS: DrawingCol[] = ['TUG', 'PONTOON', 'OIL_TANKER', 'CHEM_TANKER', 'BARGE_A', 'BARGE_B', 'BARGE_C', 'BARGE_D', 'BARGE_E', 'BARGE_F', 'LCT',
  'GENERAL_CARGO', 'BULK_CARRIER', 'CONTAINER', 'RORO_CARGO', 'PASSENGER', 'RORO_PASSENGER', 'GAS_CARRIER', 'DREDGER', 'SUPPLY', 'FISHING', 'FPSO', 'FSO'];

export const DRAWING_COL_LABEL: Record<DrawingCol, string> = {
  TUG: 'Tugboat / Anchor Handling Tug',
  PONTOON: 'Pontoon',
  OIL_TANKER: 'Oil Tanker',
  CHEM_TANKER: 'Chemical Tanker',
  BARGE_A: 'Oil/Chemical Barge, FP > 60°C',
  BARGE_B: 'Oil/Chemical Barge, FP ≤ 60°C',
  BARGE_C: 'Oil/Chemical Barge, FP > 60°C, self-propelled',
  BARGE_D: 'Oil/Chemical Barge, FP ≤ 60°C, self-propelled (SPOB)',
  BARGE_E: 'Barge lain',
  BARGE_F: 'Barge lain, self-propelled',
  LCT: 'LCT (Landing Craft Tank)',
  GENERAL_CARGO: 'General Dry Cargo',
  BULK_CARRIER: 'Bulk Carrier',
  CONTAINER: 'Container Ship',
  RORO_CARGO: 'Ro-Ro Cargo Ship',
  PASSENGER: 'Passenger Ship',
  RORO_PASSENGER: 'Ro-Ro Passenger Ship',
  GAS_CARRIER: 'Liquefied Gas Carrier',
  DREDGER: 'Dredger',
  SUPPLY: 'Offshore Service Vessel (PSV/OSV)',
  FISHING: 'Fishing Vessel',
  FPSO: 'FPSO (Floating Production, Storage and Offloading)',
  FSO: 'FSO (Floating Storage and Offloading)',
};

export type DrawingGroup = 'hull' | 'stab' | 'elec' | 'mach' | 'stat';

/** Urutan tampil kelompok. */
export const DRAWING_GROUPS: DrawingGroup[] = ['hull', 'stab', 'elec', 'mach', 'stat'];

export const DRAWING_GROUP_LABEL: Record<DrawingGroup, string> = {
  hull: 'Konstruksi (lambung)',
  stab: 'Stabilitas & lambung timbul',
  elec: 'Listrik',
  mach: 'Mesin',
  stat: 'Statutory & manual',
};

/** Arti kode bersyarat bila sel tidak menuliskan syaratnya sendiri (dipakai kolom tongkang). */
export const CODE_COND: Record<string, string> = {
  M1: 'jika L ≥ 65 m (kapal laut)',
  M2: 'jika terpasang di kapal',
  M3: 'jika ada permohonan notasi tambahan IW',
  M4: 'jika L ≥ 120 m',
  O1: 'jika flash point < 60°C',
  O2: 'jika kapal berawak',
  O3: 'jika penumpang > 200',
  O4: 'jika orang > 15 dan GT > 400',
  O5: 'jika GT > 400',
  O6: 'jika ruang mesin kategori A dan GT ≥ 500',
  O7: 'jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis',
  O8: 'jika DWT > 20.000',
  O9: 'jika DWT > 8.000 dan flash point < 60°C',
  O12: 'jika tidak memenuhi pengecualian torsional vibration',
  O13: 'jika owner meminta notasi PLEM',
  O14: 'hanya untuk mesin bantu (auxiliary engine)',
  O15: 'jika L > 24 m',
};

export type DrawingRowData = [no: string, title: string, group: DrawingGroup, cells: Partial<Record<DrawingCol, string>>, bargeTitle?: string];

export const DRAWING_ROWS: DrawingRowData[] = [
  ['1', 'General Arrangement', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['2', 'Profile Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['3', 'Midship Section', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['4', 'Shell Expansion', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['5', 'Bulkhead Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['6', 'Deck and Bottom Plan Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['7', 'Engine Foundation', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M' }],
  ['8', 'After and Fore Peak Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['9', 'Rudder and Rudder Stock Construction', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M' }],
  ['10', 'Hatchways Construction', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M' }],
  ['11', 'Long. Strength Calculation / Loading Manual', 'hull', { PONTOON: 'M1|jika L ≥ 90 m untuk Pontoon', OIL_TANKER: 'M1|jika L ≥ 65 m untuk kapal laut', CHEM_TANKER: 'M1|jika L ≥ 65 m untuk kapal laut', BARGE_A: 'M1', BARGE_B: 'M1', BARGE_C: 'M1', BARGE_D: 'M1', BARGE_E: 'M1', BARGE_F: 'M1', LCT: 'M1|jika L ≥ 65 m untuk kapal laut', GENERAL_CARGO: 'M1|jika L ≥ 65 m untuk kapal laut', BULK_CARRIER: 'M1|jika L ≥ 65 m untuk kapal laut', CONTAINER: 'M1|jika L ≥ 65 m untuk kapal laut', RORO_CARGO: 'M1|jika L ≥ 65 m untuk kapal laut', PASSENGER: 'M1|jika L ≥ 65 m untuk kapal laut', RORO_PASSENGER: 'M1|jika L ≥ 65 m untuk kapal laut', GAS_CARRIER: 'M1|jika L ≥ 65 m untuk kapal laut', DREDGER: 'M1|jika L ≥ 65 m untuk kapal laut', SUPPLY: 'M1|jika L ≥ 65 m untuk kapal laut', FPSO: 'M', FSO: 'M' }],
  ['12', 'Superstructure and Deckhouse Construction', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['13', 'Lashing and Stowage Devices', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2', LCT: 'M', CONTAINER: 'M', RORO_CARGO: 'M', RORO_PASSENGER: 'M', SUPPLY: 'M2' }],
  ['14', 'Welding Schedule', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['15', 'X-Ray Plan', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['16.1', 'Crane foundation', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2', GENERAL_CARGO: 'M2', BULK_CARRIER: 'M2', CONTAINER: 'M2', DREDGER: 'M2', SUPPLY: 'M2', FPSO: 'M2', FSO: 'M2' }],
  ['16.2', 'Shaft Bracket/skeg', 'hull', { TUG: 'M2|jika terpasang di kapal', OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_C: 'M2', BARGE_D: 'M2', BARGE_F: 'M2', LCT: 'M2|jika terpasang di kapal', GENERAL_CARGO: 'M2|jika terpasang di kapal', BULK_CARRIER: 'M2|jika terpasang di kapal', CONTAINER: 'M2|jika terpasang di kapal', RORO_CARGO: 'M2|jika terpasang di kapal', PASSENGER: 'M2|jika terpasang di kapal', RORO_PASSENGER: 'M2|jika terpasang di kapal', GAS_CARRIER: 'M2|jika terpasang di kapal', DREDGER: 'M2|jika terpasang di kapal', SUPPLY: 'M2|jika terpasang di kapal', FISHING: 'M2|jika terpasang di kapal' }],
  ['16.3', 'Propeller Nozzle', 'hull', { TUG: 'M2|jika terpasang di kapal', OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_C: 'M2', BARGE_D: 'M2', BARGE_F: 'M2', LCT: 'M2|jika terpasang di kapal', GENERAL_CARGO: 'M2|jika terpasang di kapal', BULK_CARRIER: 'M2|jika terpasang di kapal', CONTAINER: 'M2|jika terpasang di kapal', RORO_CARGO: 'M2|jika terpasang di kapal', PASSENGER: 'M2|jika terpasang di kapal', RORO_PASSENGER: 'M2|jika terpasang di kapal', GAS_CARRIER: 'M2|jika terpasang di kapal', DREDGER: 'M2|jika terpasang di kapal', SUPPLY: 'M2|jika terpasang di kapal', FISHING: 'M2|jika terpasang di kapal' }],
  ['16.4', 'Towing pin / Shark and towing foundation', 'hull', { TUG: 'M', SUPPLY: 'M2' }],
  ['16.5', 'Stern Roller Detail', 'hull', { SUPPLY: 'M2' }],
  ['16.6', 'Ramp Door, Inner Door Construction & Bow Visor', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2', LCT: 'M', RORO_CARGO: 'M', RORO_PASSENGER: 'M' }],
  ['16.7', 'Thruster Tunnel Construction', 'hull', { OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_F: 'M2', GENERAL_CARGO: 'M2|jika terpasang di kapal', BULK_CARRIER: 'M2|jika terpasang di kapal', CONTAINER: 'M2|jika terpasang di kapal', RORO_CARGO: 'M2|jika terpasang di kapal', PASSENGER: 'M2|jika terpasang di kapal', RORO_PASSENGER: 'M2|jika terpasang di kapal', GAS_CARRIER: 'M2|jika terpasang di kapal', DREDGER: 'M2|jika terpasang di kapal', SUPPLY: 'M2|jika terpasang di kapal' }],
  ['16.8', 'Cargo Pressure Vessel Foundation', 'hull', { BARGE_F: 'M2', GAS_CARRIER: 'M' }],
  ['17', 'Structural Fire Protection (joiner & penetration, fire division & insulation, deck covering, door & window, escape way plan)', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }, 'Structural Fire Protection'],
  ['18', 'Door, Hatches, Windows & Sidescuttles Arrangement', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['19', 'Cathodic Protection', 'hull', { TUG: 'M3|jika ada permohonan notasi tambahan IW', PONTOON: 'M3|jika ada permohonan notasi tambahan IW', OIL_TANKER: 'M3|jika ada permohonan notasi tambahan IW', CHEM_TANKER: 'M3|jika ada permohonan notasi tambahan IW', BARGE_A: 'M3', BARGE_B: 'M3', BARGE_C: 'M3', BARGE_D: 'M3', BARGE_E: 'M3', BARGE_F: 'M3', LCT: 'M3|jika ada permohonan notasi tambahan IW', GENERAL_CARGO: 'M3|jika ada permohonan notasi tambahan IW', BULK_CARRIER: 'M3|jika ada permohonan notasi tambahan IW', CONTAINER: 'M3|jika ada permohonan notasi tambahan IW', RORO_CARGO: 'M3|jika ada permohonan notasi tambahan IW', PASSENGER: 'M3|jika ada permohonan notasi tambahan IW', RORO_PASSENGER: 'M3|jika ada permohonan notasi tambahan IW', GAS_CARRIER: 'M3|jika ada permohonan notasi tambahan IW', DREDGER: 'M3|jika ada permohonan notasi tambahan IW', SUPPLY: 'M3|jika ada permohonan notasi tambahan IW', FISHING: 'M3|jika ada permohonan notasi tambahan IW', FPSO: 'M', FSO: 'M' }],
  ['20', 'Docking Plan', 'hull', { OIL_TANKER: 'M4|jika L ≥ 120 m', CHEM_TANKER: 'M4|jika L ≥ 120 m', LCT: 'M4|jika L ≥ 120 m', GENERAL_CARGO: 'M4|jika L ≥ 120 m', BULK_CARRIER: 'M4|jika L ≥ 120 m', CONTAINER: 'M4|jika L ≥ 120 m', RORO_CARGO: 'M4|jika L ≥ 120 m', PASSENGER: 'M4|jika L ≥ 120 m', RORO_PASSENGER: 'M4|jika L ≥ 120 m', GAS_CARRIER: 'M4|jika L ≥ 120 m', DREDGER: 'M4|jika L ≥ 120 m', FPSO: 'M', FSO: 'M' }],
  ['21', 'Mooring Arrangement & Detail', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['22', 'Mooring Foundation', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['23', 'Anchoring Arrangement', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['25', 'Helicopter Deck', 'hull', { BARGE_F: 'M2', FPSO: 'M2', FSO: 'M2' }],
  ['26', 'Foundation Anchoring Equipment', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['27', 'Mooring Turret & Yoke System', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['28', 'Mooring Analysis', 'hull', { FPSO: 'M2', FSO: 'M2' }],
  ['29', 'Fatigue Assessment', 'hull', { FPSO: 'M', FSO: 'M' }],
  ['30', 'Plans & Analysis Module Structure for Production Facility', 'hull', { FPSO: 'M' }],
  ['31', 'Installation, Hook Up and Commissioning', 'hull', { FPSO: 'M' }],
  ['34', 'Material Test Result (FRP Material)', 'hull', { FISHING: 'M4|jika lambung dari bahan FRP' }],
  ['35', 'Capacity Plan', 'stab', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['37', 'Lines Plan', 'stab', { TUG: 'M1|jika memenuhi kriteria "Note L&S"', PONTOON: 'M1|jika memenuhi kriteria "Note L&S"', OIL_TANKER: 'M1|jika memenuhi kriteria "Note L&S"', CHEM_TANKER: 'M1|jika memenuhi kriteria "Note L&S"', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M1|jika memenuhi kriteria "Note L&S"', GENERAL_CARGO: 'M1|jika memenuhi kriteria "Note L&S"', BULK_CARRIER: 'M1|jika memenuhi kriteria "Note L&S"', CONTAINER: 'M1|jika memenuhi kriteria "Note L&S"', RORO_CARGO: 'M1|jika memenuhi kriteria "Note L&S"', PASSENGER: 'M1|jika memenuhi kriteria "Note L&S"', RORO_PASSENGER: 'M1|jika memenuhi kriteria "Note L&S"', GAS_CARRIER: 'M1|jika memenuhi kriteria "Note L&S"', DREDGER: 'M1|jika memenuhi kriteria "Note L&S"', SUPPLY: 'M1|jika memenuhi kriteria "Note L&S"', FISHING: 'M1|jika memenuhi kriteria "Note L&S"' }],
  ['38', 'Intact Stability Booklet', 'stab', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['39', 'Damage Stability', 'stab', { OIL_TANKER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', CHEM_TANKER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', LCT: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', GENERAL_CARGO: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', BULK_CARRIER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', CONTAINER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', RORO_CARGO: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', PASSENGER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', RORO_PASSENGER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', GAS_CARRIER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', SUPPLY: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', FPSO: 'M', FSO: 'M' }],
  ['40', 'Bottom Damage', 'stab', { GENERAL_CARGO: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)', BULK_CARRIER: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)', CONTAINER: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)', RORO_CARGO: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)', PASSENGER: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)', RORO_PASSENGER: 'M3|jika tidak dilengkapi atau tidak memenuhi ketentuan double bottom (passenger dan cargo ship)' }],
  ['41', 'Diagram P&ID', 'elec', { FPSO: 'M', FSO: 'O' }],
  ['42', 'Emergency Shutdown System (ESD)', 'elec', { FPSO: 'M', FSO: 'O' }],
  ['43', 'Main Switch Board (MSB)', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'O' }],
  ['44', 'Wiring Diagram', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'O' }],
  ['45', 'Protection coordination study with all value > 3000 kVA', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'O' }],
  ['46', 'Emergency Switchboard (ESB)', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M', LCT: 'O', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'O', FPSO: 'M', FSO: 'O' }],
  ['47', 'Power Balance Calculation', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'O' }],
  ['48', 'Short-Circuit Calculation, if where total generators output > 500 kVA', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'O' }],
  ['49', 'Hazardous Area', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'O', BARGE_D: 'O', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'O' }],
  ['50', 'Cargo Control System', 'elec', { OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'O' }],
  ['51', 'Public Address and General Alarm (PAGA)', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', LCT: 'O|opsional', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O', FPSO: 'M', FSO: 'O' }],
  ['52', 'Watertight door and operating and position monitoring system', 'elec', { RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', FSO: 'O' }],
  ['53', 'Fire door operating and position monitoring system', 'elec', { RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', FSO: 'O' }],
  ['55', 'Main cableways', 'elec', { RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', FSO: 'O' }],
  ['56', 'General layout drawing (electrical plant, power generating and distribution)', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', LCT: 'O|opsional', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O', FPSO: 'O', FSO: 'O' }],
  ['57', 'Lighting Arrangement', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', LCT: 'O|opsional', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O', FPSO: 'M', FSO: 'M' }],
  ['58', 'Emergency lighting arrangement', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', LCT: 'O|opsional', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O', FPSO: 'M', FSO: 'M' }],
  ['59', 'Steering gear drive and control system', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional', LCT: 'O|opsional', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O' }],
  ['63', 'Pipe Line End Manifold (PLEM)', 'mach', { FPSO: 'O13', FSO: 'O13' }],
  ['64', 'Risk Analysis', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['65', 'Position Mooring System', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['66', 'Overview of field development plan', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['67', 'Hydrocarbon Production and Processing Systems', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['68', 'Piping and Instrumentation Diagrams (P&IDs)', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['69', 'Metering System', 'mach', { FPSO: 'M', FSO: 'M' }],
  ['70', 'Engine Room Layout', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['71', 'Pump/Component Room Arrangement', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_C: 'O', BARGE_D: 'M', GAS_CARRIER: 'M', DREDGER: 'O', FPSO: 'M', FSO: 'M' }],
  ['72', 'Generator Room Arrangement', 'mach', { RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', FPSO: 'M', FSO: 'M' }],
  ['73', 'Emergency Source Room Arrangement', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FPSO: 'O', FSO: 'O' }],
  ['74', 'Boiler Room Arrangement', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', BULK_CARRIER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', FPSO: 'M', FSO: 'M' }],
  ['75', 'Shafting Arrangement and Detail', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'M', FPSO: 'O', FSO: 'O' }],
  ['76', 'Torsional Vibration Analysis, kapal < 2 tahun', 'mach', { TUG: 'O12|jika tidak memenuhi pengecualian torsional vibration, Rules Machinery Pt.1 Vol.III Sec.16', OIL_TANKER: 'O12|jika tidak memenuhi pengecualian torsional vibration', CHEM_TANKER: 'O12|jika tidak memenuhi pengecualian torsional vibration', BARGE_C: 'O12', BARGE_D: 'O12', BARGE_F: 'O12', LCT: 'O12|jika tidak memenuhi pengecualian torsional vibration', GENERAL_CARGO: 'O12|jika tidak memenuhi pengecualian torsional vibration', BULK_CARRIER: 'O12|jika tidak memenuhi pengecualian torsional vibration', CONTAINER: 'O12|jika tidak memenuhi pengecualian torsional vibration', RORO_CARGO: 'O12|jika tidak memenuhi pengecualian torsional vibration', PASSENGER: 'O12|jika tidak memenuhi pengecualian torsional vibration', RORO_PASSENGER: 'O12|jika tidak memenuhi pengecualian torsional vibration', GAS_CARRIER: 'O12|jika tidak memenuhi pengecualian torsional vibration', DREDGER: 'O12|jika tidak memenuhi pengecualian torsional vibration', SUPPLY: 'O12|jika tidak memenuhi pengecualian torsional vibration', FISHING: 'O12|jika tidak memenuhi pengecualian torsional vibration' }, 'Torsional Vibration Analysis'],
  ['77', 'Propeller', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'M', FPSO: 'O', FSO: 'O' }],
  ['78', 'Venting Arrangement for Oil/Gas Cargo/Storage', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_D: 'M', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'M' }],
  ['79', 'Special Room/ Pump Room Ventilation', 'mach', { OIL_TANKER: 'O1|jika flash point < 60°C', CHEM_TANKER: 'O1|jika flash point < 60°C', BARGE_B: 'M', BARGE_D: 'M', GAS_CARRIER: 'O1|jika flash point < 60°C', FISHING: 'M', FPSO: 'O', FSO: 'O' }],
  ['81', 'Sounding, Filling & Air Pipe', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'O15', FPSO: 'M', FSO: 'M' }],
  ['82', 'Scupper Piping', 'mach', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_F: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O', FPSO: 'O', FSO: 'O' }],
  ['83', 'Exhaust Gas Piping System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'M', FPSO: 'O14', FSO: 'O14' }],
  ['84', 'Fuel Oil Transfer/Supply System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['85', 'Lub. Oil System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', SUPPLY: 'M', FISHING: 'O', FPSO: 'M', FSO: 'M' }],
  ['86', 'Compressed Air System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'O', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', SUPPLY: 'M', FISHING: 'O', FPSO: 'O', FSO: 'O' }],
  ['87', 'Cooling System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'O', FPSO: 'M', FSO: 'M' }],
  ['88', 'Bilge, Ballast & GS System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O2', BARGE_B: 'O2', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O2', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['89', 'SW & FW Sanitary System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'O', BARGE_D: 'O', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'O', FPSO: 'M', FSO: 'M' }],
  ['90', 'Fixed Fire Main System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O2', BARGE_B: 'O2', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O2', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'M', SUPPLY: 'M', FISHING: 'M', FPSO: 'M', FSO: 'M' }],
  ['91', 'Fire Fighting System (for FIFI Notation)', 'mach', { TUG: 'M', SUPPLY: 'M' }],
  ['92', 'Sewage System', 'mach', { TUG: 'O4|jika orang > 15 dan GT > 400', OIL_TANKER: 'O4|jika orang > 15 dan GT > 400', CHEM_TANKER: 'O4|jika orang > 15 dan GT > 400', BARGE_C: 'O4', BARGE_D: 'O4', BARGE_F: 'O4', LCT: 'O4|jika orang > 15 dan GT > 400', GENERAL_CARGO: 'O4|jika orang > 15 dan GT > 400', BULK_CARRIER: 'O4|jika orang > 15 dan GT > 400', CONTAINER: 'O4|jika orang > 15 dan GT > 400', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'O4|jika orang > 15 dan GT > 400', DREDGER: 'O4|jika orang > 15 dan GT > 400', SUPPLY: 'O4|jika orang > 15 dan GT > 400', FISHING: 'O', FPSO: 'O4|jika orang > 15 dan GT > 400', FSO: 'O4|jika orang > 15 dan GT > 400' }],
  ['93', 'Oily Water Bilge Separator Syst.', 'mach', { TUG: 'O5|jika GT > 400', OIL_TANKER: 'O5|jika GT > 400', CHEM_TANKER: 'O5|jika GT > 400', BARGE_C: 'O5', BARGE_D: 'O5', BARGE_F: 'O5', LCT: 'O5|jika GT > 400', GENERAL_CARGO: 'O5|jika GT > 400', BULK_CARRIER: 'O5|jika GT > 400', CONTAINER: 'O5|jika GT > 400', RORO_CARGO: 'O5|jika GT > 400', PASSENGER: 'O5|jika GT > 400', RORO_PASSENGER: 'O5|jika GT > 400', GAS_CARRIER: 'O5|jika GT > 400', DREDGER: 'O5|jika GT > 400', SUPPLY: 'O5|jika GT > 400', FISHING: 'O', FPSO: 'O', FSO: 'O' }],
  ['94', 'CO2 System', 'mach', { TUG: 'O6|jika ruang mesin kategori A dan GT ≥ 500', OIL_TANKER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', CHEM_TANKER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', BARGE_C: 'O6', BARGE_D: 'O6', BARGE_F: 'O6', LCT: 'O6|jika ruang mesin kategori A dan GT ≥ 500', GENERAL_CARGO: 'O6|jika ruang mesin kategori A dan GT ≥ 500', BULK_CARRIER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', CONTAINER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', RORO_CARGO: 'O6|jika ruang mesin kategori A dan GT ≥ 500', PASSENGER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', RORO_PASSENGER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', GAS_CARRIER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', DREDGER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', SUPPLY: 'O6|jika ruang mesin kategori A dan GT ≥ 500', FISHING: 'O', FPSO: 'O', FSO: 'O' }],
  ['95', 'Sprinkler System', 'mach', { OIL_TANKER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', CHEM_TANKER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', BARGE_C: 'O7', BARGE_D: 'O7', BARGE_F: 'O7', LCT: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', GENERAL_CARGO: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', BULK_CARRIER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', CONTAINER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', FPSO: 'O', FSO: 'O' }],
  ['96', 'Cargo Oil Heating System', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O', FPSO: 'O', FSO: 'O' }],
  ['97', 'Gas Liquefaction-Regasification System for LNG', 'mach', { GAS_CARRIER: 'O' }],
  ['99', 'Fuel Oil Heating System', 'mach', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', SUPPLY: 'O' }],
  ['100', 'Oil / Chemical / Gas Cargo System', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', GAS_CARRIER: 'M', FPSO: 'M', FSO: 'M' }, 'Oil Cargo / Gas Cargo System'],
  ['101', 'Stripping & Bilge System', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'M', BARGE_D: 'M', GAS_CARRIER: 'O', FPSO: 'O', FSO: 'O' }],
  ['102', 'Gastight Penetration Detail', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_D: 'M', GAS_CARRIER: 'M', FPSO: 'O', FSO: 'O' }],
  ['103', 'Cargo Unloading System for Bulk / "X" Carrier', 'mach', { BULK_CARRIER: 'O' }],
  ['104', 'Steering Gear System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M', LCT: 'M', GENERAL_CARGO: 'M', BULK_CARRIER: 'M', CONTAINER: 'M', RORO_CARGO: 'M', PASSENGER: 'M', RORO_PASSENGER: 'M', GAS_CARRIER: 'M', DREDGER: 'O', SUPPLY: 'M', FISHING: 'O' }],
  ['105', 'HVAC System', 'mach', { RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O' }],
  ['106', 'Pressurized Cargo Control System', 'mach', { GAS_CARRIER: 'M' }],
  ['107', 'Gas Cargo Pressure Vessel', 'mach', { GAS_CARRIER: 'M' }],
  ['108', 'Inert Gas Systems', 'mach', { OIL_TANKER: 'O9|jika DWT > 8.000 dan flash point muatan < 60°C, notasi inert gas', CHEM_TANKER: 'O9|jika DWT > 8.000 dan flash point muatan < 60°C, notasi inert gas', BARGE_D: 'O9' }],
  ['110', 'Damage Control Plan and Booklets', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O' }],
  ['111', 'Fire Control Plan', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_E: 'O', BARGE_F: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O' }],
  ['113', 'Sewage Pollution Prevention Arrangement, > 400 GT dan > 15 orang', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', SUPPLY: 'O' }, 'Sewage Pollution Prevention Arrangement'],
  ['121', 'Document of authorization for the carriage of grain and grain loading manual', 'stat', { GENERAL_CARGO: 'O', BULK_CARRIER: 'O' }],
  ['122', 'Oil Discharge Monitoring and Control (ODMC) Operational Manual', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', GAS_CARRIER: 'O' }],
  ['124', 'Crude Oil Washing Operation and Equipment Manual (COW)', 'stat', { BARGE_C: 'O8', BARGE_D: 'O8' }],
  ['130', 'Safety Management System Manual', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O' }],
  ['134', 'De-Watering System', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O' }],
  ['135', 'Grey Water System', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_E: 'O', BARGE_F: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O' }],
  ['136', 'Crude Oil Washing Operation and Equipment Manual, COW', 'stat', { OIL_TANKER: 'O8|jika DWT > 20.000' }],
  ['144', 'Fire detection and alarms system', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', LCT: 'O', GENERAL_CARGO: 'O', BULK_CARRIER: 'O', CONTAINER: 'O', RORO_CARGO: 'O', PASSENGER: 'O', RORO_PASSENGER: 'O', GAS_CARRIER: 'O', DREDGER: 'O', SUPPLY: 'O', FISHING: 'O' }],
];
