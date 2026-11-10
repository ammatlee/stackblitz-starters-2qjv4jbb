/**
 * Daftar gambar/dokumen wajib BKI untuk penerimaan klas bangunan baru (tabel New Building).
 * Sumber: Daftar Persyaratan Gambar/Dokumen Penerimaan Klas dan Modifikasi Kapal Rev.03.
 *
 * Data diekstrak per kolom dari PDF asli lalu dicek pengguna (file "Daftar gambar wajib BKI Rev.03").
 * Hanya berubah bila BKI menerbitkan revisi: ganti baris di DRAWING_ROWS, lalu sesuaikan angka di tests/newbuildingDrawings.test.ts.
 *
 * Bentuk satu baris: [nomor, judul, kelompok, sel per kolom, judul khusus tongkang?].
 * Sel: 'M' = wajib; 'O' = jika ada/opsional; huruf + angka (mis. 'M2', 'O12') = bersyarat.
 * Syarat ditulis setelah tanda '|' (mis. 'M2|jika terpasang di kapal'); bila tidak ditulis, dipakai CODE_COND.
 * Kolom yang tidak muncul di sebuah baris = gambar itu tidak berlaku untuk kolom tersebut.
 */

export const DRAWING_LIST_REV = 'BKI Rev.03';

export type DrawingCol = 'TUG' | 'PONTOON' | 'OIL_TANKER' | 'CHEM_TANKER' | 'BARGE_A' | 'BARGE_B' | 'BARGE_C' | 'BARGE_D' | 'BARGE_E' | 'BARGE_F';

export const DRAWING_COLS: DrawingCol[] = ['TUG', 'PONTOON', 'OIL_TANKER', 'CHEM_TANKER', 'BARGE_A', 'BARGE_B', 'BARGE_C', 'BARGE_D', 'BARGE_E', 'BARGE_F'];

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
  O4: 'jika orang > 15 dan GT > 400',
  O5: 'jika GT > 400',
  O6: 'jika ruang mesin kategori A dan GT ≥ 500',
  O7: 'jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis',
  O8: 'jika DWT > 20.000',
  O9: 'jika DWT > 8.000 dan flash point < 60°C',
  O12: 'jika tidak memenuhi pengecualian torsional vibration',
};

export type DrawingRowData = [no: string, title: string, group: DrawingGroup, cells: Partial<Record<DrawingCol, string>>, bargeTitle?: string];

export const DRAWING_ROWS: DrawingRowData[] = [
  ['1', 'General Arrangement', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['2', 'Profile Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['3', 'Midship Section', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['4', 'Shell Expansion', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['5', 'Bulkhead Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['6', 'Deck and Bottom Plan Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['7', 'Engine Foundation', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['8', 'After and Fore Peak Construction', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['9', 'Rudder and Rudder Stock Construction', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['10', 'Hatchways Construction', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2' }],
  ['11', 'Long. Strength Calculation / Loading Manual', 'hull', { PONTOON: 'M1|jika L ≥ 90 m untuk Pontoon', OIL_TANKER: 'M1|jika L ≥ 65 m untuk kapal laut', CHEM_TANKER: 'M1|jika L ≥ 65 m untuk kapal laut', BARGE_A: 'M1', BARGE_B: 'M1', BARGE_C: 'M1', BARGE_D: 'M1', BARGE_E: 'M1', BARGE_F: 'M1' }],
  ['12', 'Superstructure and Deckhouse Construction', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['13', 'Lashing and Stowage Devices', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2' }],
  ['14', 'Welding Schedule', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['15', 'X-Ray Plan', 'hull', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['16.1', 'Crane foundation', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2' }],
  ['16.2', 'Shaft Bracket/skeg', 'hull', { TUG: 'M2|jika terpasang di kapal', OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_C: 'M2', BARGE_D: 'M2', BARGE_F: 'M2' }],
  ['16.3', 'Propeller Nozzle', 'hull', { TUG: 'M2|jika terpasang di kapal', OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_C: 'M2', BARGE_D: 'M2', BARGE_F: 'M2' }],
  ['16.4', 'Towing pin / Shark and towing foundation', 'hull', { TUG: 'M' }],
  ['16.6', 'Ramp Door, Inner Door Construction & Bow Visor', 'hull', { BARGE_E: 'M2', BARGE_F: 'M2' }],
  ['16.7', 'Thruster Tunnel Construction', 'hull', { OIL_TANKER: 'M2|jika terpasang di kapal', CHEM_TANKER: 'M2|jika terpasang di kapal', BARGE_F: 'M2' }],
  ['16.8', 'Cargo Pressure Vessel Foundation', 'hull', { BARGE_F: 'M2' }],
  ['17', 'Structural Fire Protection (joiner & penetration, fire division & insulation, deck covering, door & window, escape way plan)', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }, 'Structural Fire Protection'],
  ['18', 'Door, Hatches, Windows & Sidescuttles Arrangement', 'hull', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['19', 'Cathodic Protection', 'hull', { TUG: 'M3|jika ada permohonan notasi tambahan IW', PONTOON: 'M3|jika ada permohonan notasi tambahan IW', OIL_TANKER: 'M3|jika ada permohonan notasi tambahan IW', CHEM_TANKER: 'M3|jika ada permohonan notasi tambahan IW', BARGE_A: 'M3', BARGE_B: 'M3', BARGE_C: 'M3', BARGE_D: 'M3', BARGE_E: 'M3', BARGE_F: 'M3' }],
  ['20', 'Docking Plan', 'hull', { OIL_TANKER: 'M4|jika L ≥ 120 m', CHEM_TANKER: 'M4|jika L ≥ 120 m' }],
  ['25', 'Helicopter Deck', 'hull', { BARGE_F: 'M2' }],
  ['35', 'Capacity Plan', 'stab', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['37', 'Lines Plan', 'stab', { TUG: 'M1|jika memenuhi kriteria "Note L&S"', PONTOON: 'M1|jika memenuhi kriteria "Note L&S"', OIL_TANKER: 'M1|jika memenuhi kriteria "Note L&S"', CHEM_TANKER: 'M1|jika memenuhi kriteria "Note L&S"', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['38', 'Intact Stability Booklet', 'stab', { TUG: 'M', PONTOON: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['39', 'Damage Stability', 'stab', { OIL_TANKER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25', CHEM_TANKER: 'M2|jika kapal dipersyaratkan Damage Stability Calculation, Rules BKI Vol. II Sect. 36.C Tabel 36.2; domestik: PM 44/2021 Pasal 25' }],
  ['43', 'Main Switch Board (MSB)', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['44', 'Wiring Diagram', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['45', 'Protection coordination study with all value > 3000 kVA', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M' }],
  ['46', 'Emergency Switchboard (ESB)', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M' }],
  ['47', 'Power Balance Calculation', 'elec', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['48', 'Short-Circuit Calculation, if where total generators output > 500 kVA', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M' }],
  ['49', 'Hazardous Area', 'elec', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'O', BARGE_D: 'O' }],
  ['50', 'Cargo Control System', 'elec', { OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['51', 'Public Address and General Alarm (PAGA)', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['56', 'General layout drawing (electrical plant, power generating and distribution)', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['57', 'Lighting Arrangement', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['58', 'Emergency lighting arrangement', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['59', 'Steering gear drive and control system', 'elec', { TUG: 'O|opsional', OIL_TANKER: 'O|opsional', CHEM_TANKER: 'O|opsional' }],
  ['70', 'Engine Room Layout', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['71', 'Pump/Component Room Arrangement', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_C: 'O', BARGE_D: 'M' }],
  ['73', 'Emergency Source Room Arrangement', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O' }],
  ['74', 'Boiler Room Arrangement', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O' }],
  ['75', 'Shafting Arrangement and Detail', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['76', 'Torsional Vibration Analysis, kapal < 2 tahun', 'mach', { TUG: 'O12|jika tidak memenuhi pengecualian torsional vibration, Rules Machinery Pt.1 Vol.III Sec.16', OIL_TANKER: 'O12|jika tidak memenuhi pengecualian torsional vibration', CHEM_TANKER: 'O12|jika tidak memenuhi pengecualian torsional vibration', BARGE_C: 'O12', BARGE_D: 'O12', BARGE_F: 'O12' }, 'Torsional Vibration Analysis'],
  ['77', 'Propeller', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['78', 'Venting Arrangement for Oil/Gas Cargo/Storage', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_D: 'M' }],
  ['79', 'Special Room/ Pump Room Ventilation', 'mach', { OIL_TANKER: 'O1|jika flash point < 60°C', CHEM_TANKER: 'O1|jika flash point < 60°C', BARGE_B: 'M', BARGE_D: 'M' }],
  ['81', 'Sounding, Filling & Air Pipe', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['82', 'Scupper Piping', 'mach', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_F: 'O' }],
  ['83', 'Exhaust Gas Piping System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O', BARGE_F: 'M' }],
  ['84', 'Fuel Oil Transfer/Supply System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O', BARGE_F: 'M' }],
  ['85', 'Lub. Oil System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['86', 'Compressed Air System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'O' }],
  ['87', 'Cooling System', 'mach', { TUG: 'O', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'M', BARGE_F: 'M' }],
  ['88', 'Bilge, Ballast & GS System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O2', BARGE_B: 'O2', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O2', BARGE_F: 'M' }],
  ['89', 'SW & FW Sanitary System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'O', BARGE_D: 'O', BARGE_F: 'M' }],
  ['90', 'Fixed Fire Main System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'O2', BARGE_B: 'O2', BARGE_C: 'M', BARGE_D: 'M', BARGE_E: 'O2', BARGE_F: 'M' }],
  ['91', 'Fire Fighting System (for FIFI Notation)', 'mach', { TUG: 'M' }],
  ['92', 'Sewage System', 'mach', { TUG: 'O4|jika orang > 15 dan GT > 400', OIL_TANKER: 'O4|jika orang > 15 dan GT > 400', CHEM_TANKER: 'O4|jika orang > 15 dan GT > 400', BARGE_C: 'O4', BARGE_D: 'O4', BARGE_F: 'O4' }],
  ['93', 'Oily Water Bilge Separator Syst.', 'mach', { TUG: 'O5|jika GT > 400', OIL_TANKER: 'O5|jika GT > 400', CHEM_TANKER: 'O5|jika GT > 400', BARGE_C: 'O5', BARGE_D: 'O5', BARGE_F: 'O5' }],
  ['94', 'CO2 System', 'mach', { TUG: 'O6|jika ruang mesin kategori A dan GT ≥ 500', OIL_TANKER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', CHEM_TANKER: 'O6|jika ruang mesin kategori A dan GT ≥ 500', BARGE_C: 'O6', BARGE_D: 'O6', BARGE_F: 'O6' }],
  ['95', 'Sprinkler System', 'mach', { OIL_TANKER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', CHEM_TANKER: 'O7|jika proteksi kebakaran struktur metode IIC dengan sprinkler otomatis', BARGE_C: 'O7', BARGE_D: 'O7', BARGE_F: 'O7' }],
  ['96', 'Cargo Oil Heating System', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O' }],
  ['99', 'Fuel Oil Heating System', 'mach', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O' }],
  ['100', 'Oil / Chemical / Gas Cargo System', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_A: 'M', BARGE_B: 'M', BARGE_C: 'M', BARGE_D: 'M' }, 'Oil Cargo / Gas Cargo System'],
  ['101', 'Stripping & Bilge System', 'mach', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'M', BARGE_D: 'M' }],
  ['102', 'Gastight Penetration Detail', 'mach', { OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_B: 'M', BARGE_D: 'M' }],
  ['104', 'Steering Gear System', 'mach', { TUG: 'M', OIL_TANKER: 'M', CHEM_TANKER: 'M', BARGE_C: 'M', BARGE_D: 'M', BARGE_F: 'M' }],
  ['108', 'Inert Gas Systems', 'mach', { OIL_TANKER: 'O9|jika DWT > 8.000 dan flash point muatan < 60°C, notasi inert gas', CHEM_TANKER: 'O9|jika DWT > 8.000 dan flash point muatan < 60°C, notasi inert gas', BARGE_D: 'O9' }],
  ['110', 'Damage Control Plan and Booklets', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O' }],
  ['111', 'Fire Control Plan', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_E: 'O', BARGE_F: 'O' }],
  ['113', 'Sewage Pollution Prevention Arrangement, > 400 GT dan > 15 orang', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O' }, 'Sewage Pollution Prevention Arrangement'],
  ['122', 'Oil Discharge Monitoring and Control (ODMC) Operational Manual', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O' }],
  ['124', 'Crude Oil Washing Operation and Equipment Manual (COW)', 'stat', { BARGE_C: 'O8', BARGE_D: 'O8' }],
  ['130', 'Safety Management System Manual', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O' }],
  ['134', 'De-Watering System', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_C: 'O', BARGE_D: 'O' }],
  ['135', 'Grey Water System', 'stat', { OIL_TANKER: 'O', CHEM_TANKER: 'O', BARGE_A: 'O', BARGE_B: 'O', BARGE_C: 'O', BARGE_D: 'O', BARGE_E: 'O', BARGE_F: 'O' }],
  ['136', 'Crude Oil Washing Operation and Equipment Manual, COW', 'stat', { OIL_TANKER: 'O8|jika DWT > 20.000' }],
  ['144', 'Fire detection and alarms system', 'stat', { TUG: 'O', OIL_TANKER: 'O', CHEM_TANKER: 'O' }],
];
