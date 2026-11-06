/** Konstanta domain, tabel scope/checklist, dan aturan perhitungan untuk halaman Class Validity (tanpa UI). */
import { TUG_TYPES, HOLD_TYPES } from '../vesselTypes';
import { num } from './dateUtils';

/* ============================================================================
 * 2. DOMAIN CONSTANTS
 * ========================================================================== */
export type SurveyKey = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'INT' | 'D1' | 'REN' | 'PS';
export type Status = 'VALID' | 'SUSPENDED' | 'WITHDRAWN' | 'INPUT REQUIRED';
export type VType = string;

export const SURVEYS: { key: SurveyKey; label: string }[] = [
  { key: 'A1', label: 'Annual Survey — Year 1' },
  { key: 'A2', label: 'Annual Survey — Year 2' },
  { key: 'A3', label: 'Annual Survey — Year 3' },
  { key: 'A4', label: 'Annual Survey — Year 4' },
  { key: 'A5', label: 'Annual Survey — Year 5' },
  { key: 'INT', label: 'Intermediate Survey' },
  { key: 'D1', label: 'Docking Survey 1' },
  { key: 'REN', label: 'Renewal Survey + Docking 2' },
  { key: 'PS', label: 'Propeller Shaft Survey' },
];
export const HIST_KEYS: SurveyKey[] = ['A1', 'A2', 'A3', 'A4', 'INT'];
export const isAnnual = (k: SurveyKey) => k === 'A1' || k === 'A2' || k === 'A3' || k === 'A4' || k === 'A5';

export const RULES = [
  ['Annual Year 1–4', 'Anniversary − 3 bulan', 'Anniversary + 3 bulan', 'Inspeksi pertama dimulai setelah window end', 'Completion > 6 bulan setelah window end'],
  ['Intermediate', 'Anniversary Year 2 − 3 bulan', 'Anniversary Year 3 + 3 bulan', 'Inspeksi pertama dimulai setelah window end', 'Completion > 6 bulan setelah window end'],
  ['Docking Survey 1', 'Tidak ada batas paling awal', 'Maks. 36 bulan setelah Bottom Survey sebelumnya', 'Mulai atau selesai setelah batas 36 bulan', 'Tidak ada perpanjangan; completion > 6 bulan setelah batas 36 bulan'],
  ['Renewal + Docking 2', 'Boleh mulai sebelum expiry (−3 bulan = acuan pergeseran)', 'Expiry atau extension disetujui (maks. 3 bulan)', 'Inspeksi pertama dimulai setelah batas berlaku', 'Completion > 6 bulan setelah expiry asli'],
];
export const CASES = [
  ['A. Annual / Intermediate Overdue', 'Reinstatement of Class Survey dengan lingkup Intermediate Survey.', 'Dapat dilakukan afloat atau di dry dock.'],
  ['B. Recommendation Overdue', 'Reinstatement of Class Survey + penyelesaian seluruh recommendation.', 'Semua recommendation wajib diselesaikan.'],
  ['C. Dua Annual + Intermediate Terlewat', 'Reinstatement of Class Survey dengan lingkup Class Renewal.', 'Wajib dry dock; terbitkan interim certificate dan mulai class period baru.'],
  ['D. Class Renewal Overdue', 'Reinstatement of Class Survey dengan lingkup Class Renewal sesuai umur kapal.', 'Terbitkan interim certificate dan mulai class period baru.'],
];

/* ============================================================================
 * 3. SURVEY SCOPE DATA (Sheet "Survey Scope")
 * ========================================================================== */
export type Item = { s: string; t: string; a: string; n?: string; g?: 'mid' | 'old'; x?: string[] };
/** Jenis kapal pengangkut kargo kering saja dan gas carrier: dikecualikan dari pemeriksaan "selected cargo spaces" Intermediate (BKI 1.2.2.4). */
const NO_CARGO_SPACE_IM = ['General Cargo', 'Bulk Carrier', 'Container Ship', 'Gas Carrier'];

export const ANNUAL: Item[] = [
  { s: 'Hull & Closing Appliances', t: 'Kondisi umum lambung, pelat kulit di atas garis air, closing appliances, kekuatan struktur dan bukaan di bawah freeboard deck.', a: 'ALL', n: 'Pastikan tidak ada deteriorasi / modifikasi tanpa persetujuan.' },
  { s: 'Watertight Integrity', t: 'Sekat kedap (collision/lainnya); uji lokal dan remote pintu kedap.', a: 'IF FITTED' },
  { s: 'Anchoring & Mooring', t: 'Jangkar, peralatan mooring dan kondisi visual; pembatasan safe-working untuk kapal dibangun setelah 01-Jan-2007.', a: 'ALL', n: 'Termasuk spurling pipe dan proteksi chain locker.' },
  { s: 'Ballast, Bilge & Drainage', t: 'Sistem ballast, pompa bilge kompartemen kedap, drain, wells, alarm, detektor dan pompa forward.', a: 'IF FITTED' },
  { s: 'Machinery & Pressure Systems', t: 'Mesin, boiler, bejana tekan, pipa/fitting, guard, bahaya api/ledakan; auxiliaries esensial dan dead-ship recovery.', a: 'ALL' },
  { s: 'Steering & Communications', t: 'Steering utama/bantu, kontrol dan alarm; komunikasi anjungan–steering, rudder indicator, info emergency steering.', a: 'ALL' },
  { s: 'Machinery Control & Ventilation', t: 'Remote propulsion control, ruang kontrol mesin, ventilasi, telegraph, alarm engineer dan unattended machinery.', a: 'IF FITTED' },
  { s: 'Electrical & Emergency Power', t: 'Daya utama, penerangan, generator, motor, kabel/switchgear, sumber darurat dan proteksi bahaya listrik.', a: 'ALL' },
  { s: 'Fire Integrity & Escape', t: 'Proteksi api struktural, pintu api manual/otomatis, penutup ventilasi dan jalur evakuasi.', a: 'ALL' },
  { s: 'Fire-Fighting Systems', t: 'Pompa/main/hydrant/hose, APAR, outfit, SCBA/EEBD, sistem tetap, kontrol CO2, deteksi, alarm, remote oil-valve closure.', a: 'ALL / IF FITTED', n: 'Termasuk kesiapan operasional.' },
  { s: 'Load Line & Markings', t: 'Deck/load line, perubahan lambung/superstruktur dan kekuatan struktur.', a: 'IF LOAD LINE APPLIES', n: 'Re-mark atau cat ulang bila perlu.' },
  { s: 'Weather Deck Openings', t: 'Sekat ujung superstruktur, hatch/bukaan, air pipe, ventilator, scupper, side scuttle, bulwark dan perlindungan awak.', a: 'IF FITTED' },
  { s: 'Air Pipes & Vents', t: 'Las air pipe ke deck, kondisi eksternal head, flame screen bunker tank, penutup ventilator.', a: 'IF FITTED' },
  { s: 'Cargo Hatch Covers & Coamings', t: 'Kondisi, sealing, pengikat, mekanisme dan hidrolik hatch cover.', a: 'N/A FOR COVERED VESSEL TYPES' },
  { s: 'Special Arrangements', t: 'Helideck, dangerous goods, ruang kendaraan/Ro-Ro, gas detection, timber deck cargo, special freeboard.', a: 'IF FITTED / APPLICABLE' },
  { s: 'Towing Winch', t: 'Pemeriksaan visual dan konfirmasi operasi emergency-release towing winch.', a: 'TUGBOAT — IF FITTED' },
  { s: 'Suspect Areas & Ballast Follow-up', t: 'Area suspect dan tangki ballast dari temuan Renewal/Intermediate sebelumnya; ambil/perluas UT bila ada korosi.', a: 'AS REQUIRED', n: 'UT wajib selesai sebelum kredit Annual.' },
];
export const INTERMEDIATE: Item[] = [
  { s: 'Survey Planning', t: 'Planning meeting sebelum survei dimulai.', a: 'REQUIRED' },
  { s: 'Representative Ballast Tanks', t: 'Pemeriksaan internal umum; perluas ke tipe tangki sama bila coating tidak ada / soft / POOR.', a: 'REQUIRED', g: 'mid', n: 'Kapal umur 5–10 tahun.' },
  { s: 'All Ballast Tanks', t: 'Pemeriksaan internal umum seluruh tangki ballast; dapat dibatasi ke verifikasi proteksi korosi bila tidak ada cacat.', a: 'REQUIRED', g: 'old', n: 'Kapal > 10 tahun.' },
  { s: 'Annual Tank Follow-up', t: 'Tangki terdampak dapat memerlukan pemeriksaan internal tahunan bila coating tidak ada/soft/POOR dan tidak diperbaiki.', a: 'AS REQUIRED' },
  { s: 'Cargo Holds', t: 'Pemeriksaan internal palka terpilih.', a: 'N/A FOR CURRENT VESSEL TYPES' },
  { s: 'Selected Cargo Spaces', t: 'Pemeriksaan internal ruang kargo terpilih.', a: 'IF FITTED / VERIFY NOTATION', g: 'old', x: NO_CARGO_SPACE_IM, n: 'Kapal > 10 tahun; tidak untuk kapal kargo kering saja, gas carrier, dan tanker ESP.' },
  { s: 'Machinery Measurements', t: 'Crank web deflection main engine, crank deflection diesel bantu, insulation resistance generator/motor/kabel/switchgear.', a: 'ALL / WHERE RELEVANT' },
  { s: 'Operational Tests', t: 'Emergency generator/switchboard, emergency bilge valve, drain air receiver, operasi umum mesin/listrik.', a: 'ALL / IF FITTED' },
  { s: 'Crediting Restriction', t: 'Intermediate dan Class Renewal tidak boleh dikreditkan bersamaan (termasuk thickness measurement).', a: 'REQUIRED' },
];
export const RENEWAL: Item[] = [
  { s: 'Schedule & Planning', t: 'Planning meeting; boleh mulai pada Annual ke-4. Bila mulai lebih awal, selesaikan dalam 15 bulan.', a: 'REQUIRED', n: 'Extension disetujui maks. 3 bulan.' },
  { s: 'Survey Crediting', t: 'Tidak boleh kredit bersamaan dengan Intermediate Survey atau thickness measurement.', a: 'REQUIRED' },
  { s: 'Hull, Equipment & Piping', t: 'Cakupan cukup untuk menegaskan kondisi memuaskan untuk class period 5 tahun baru.', a: 'ALL' },
  { s: 'Underwater Parts', t: 'Pemeriksaan bagian bawah air bersamaan dengan docking Renewal.', a: 'REQUIRED' },
  { s: 'Anchors & Chain Cables', t: 'Range dan periksa jangkar/rantai, chain locker, holdfast, hawse pipe, stopper; uji sistem pemompaan chain locker.', a: 'ALL', n: 'Gauge rantai mulai Renewal II (±3 link per 27,5 m).' },
  { s: 'Internal Spaces', t: 'Periksa internal semua palka, tangki, pump room, tunnel, ruang mesin, cofferdam, void.', a: 'ALL FITTED SPACES', n: 'Rincian tangki: tabel di bawah.' },
  { s: 'Engine-Room Structure', t: 'Tank top, shell, bracket, sekat, bilge well, sea suction, pipa pendingin, overboard valve.', a: 'IF FITTED', n: 'UT bila ada wastage.' },
  { s: 'Ballast-Tank Coating', t: 'Sistem proteksi korosi; follow-up tahunan dan UT bila coating absent/soft/semi-hard/POOR.', a: 'IF BALLAST TANKS FITTED' },
  { s: 'Tank Pressure Tests', t: 'Ballast/air laut hingga air-pipe head; FO/LO/FW hingga level cairan layanan tertinggi.', a: 'REQUIRED / SURVEYOR DECISION' },
  { s: 'Cargo Hatch Covers & Coamings', t: 'Survei close-up, operasi penuh dan uji sealing.', a: 'N/A FOR COVERED VESSEL TYPES' },
  { s: 'Thickness Measurements', t: 'Cakupan minimum menurut nomor Renewal; perluas bila korosi substansial.', a: 'REQUIRED', n: 'Lihat tabel UT di bawah.' },
  { s: 'Bilge & Ballast Piping', t: 'Periksa dan uji operasi pada tekanan kerja.', a: 'ALL FITTED SYSTEMS' },
  { s: 'Automatic Air Pipe Heads', t: 'Pemeriksaan eksternal dan internal; lepas head bila bagian dalam tidak terjangkau.', a: 'ALL EXCEPT PASSENGER SHIPS', n: 'Lihat tabel Air Pipe Head di bawah.' },
  { s: 'Towing Winch Emergency Release', t: 'Uji fungsi penuh (daya normal & blackout) pada yang lebih kecil dari 30% beban desain maks. atau 80% bollard pull.', a: 'TUGBOAT — IF FITTED', n: 'Gunakan bollard-pull test atau strong point bersertifikat.' },
  { s: 'Certificate Period', t: 'Ditentukan oleh tanggal completion (bukan tanggal mulai). Completion > 3 bulan sebelum expiry → periode & anniversary baru dari tanggal completion. Completion dalam 3 bulan sebelum expiry sampai 6 bulan setelah expiry → periode baru mulai dari expiry, anniversary lama dipertahankan. Completion > 6 bulan setelah expiry → periode & anniversary baru dari completion.', a: 'REQUIRED' },
  // Ditaruh di akhir daftar supaya nomor item lama (RN-0 … RN-14) dan checklist yang sudah tersimpan tidak bergeser.
  { s: 'Crank Web Deflection', t: 'Ukur crank web deflection main engine dan diesel bantu yang memiliki crankcase door (umumnya setelah kapal turun dok), atau buktikan dengan protokol terbaru; buat laporan.', a: 'ALL / WHERE RELEVANT', n: 'BKI 1.3.2.1 → 1.2.2.5(A). Lampiran: laporan crankweb deflection.' },
  { s: 'Insulation Resistance (Megger)', t: 'Tahanan isolasi generator, motor listrik esensial, kabel, panel listrik dan MSB, atau buktikan dengan protokol terbaru; buat laporan.', a: 'ALL / IF FITTED', n: 'BKI 1.3.2.1 → 1.2.2.5(A). Kapal tanpa penggerak: hanya bila ada instalasi listrik.' },
  { s: 'Pushing / Being Pushed Arrangement', t: 'Periksa titik sambung dan area kontak dengan struktur penumpu, serta peralatan penyambung termasuk locking device.', a: 'IF FITTED', n: 'BKI 1.3.2.18. Tug pendorong dan tongkang yang didorong.' },
];
export const DOCKING: Item[] = [
  { s: 'Survey Method', t: 'Normalnya dry-dock/slipway; In-water Survey dapat diterima sesuai ketentuan dan persetujuan.', a: 'ALL', n: 'Owner memberi tahu BKI saat bottom tersedia.' },
  { s: 'Age / ESP Restriction', t: 'In-water Survey kapal ≥ 15 tahun perlu pertimbangan khusus.', a: 'AGE-BASED', n: 'Kapal ESP ≥ 15 tahun wajib di dry-dock.' },
  { s: 'Five-Year Frequency', t: 'Minimal dua pemeriksaan bottom per periode Class Renewal 5 tahun.', a: 'A100 SEAGOING SHIPS', n: 'Satu pemeriksaan bersama Class Renewal.' },
  { s: 'Maximum Interval', t: 'Interval antar dua pemeriksaan bottom tidak boleh > 36 bulan.', a: 'REQUIRED', n: 'Tidak ada perpanjangan di atas 36 bulan.' },
  { s: 'Renewal Credit Timing', t: 'Bottom Survey yang dikreditkan ke Renewal boleh dilakukan hingga 15 bulan sebelum completion Renewal.', a: 'WHEN CREDITED TO RENEWAL' },
  { s: 'Survey Coordination', t: 'Boleh dilakukan bersama Intermediate Survey terjadwal.', a: 'IF APPLICABLE' },
  { s: 'Shell Plating & Appendages', t: 'Pelat kulit termasuk bottom dan bow, keel, bilge keel, stern frame, rudder.', a: 'ALL' },
  { s: 'Sea Chests & Valves', t: 'Sea chest, grating, sea connection, overboard valve/cock dan hull fastening.', a: 'ALL FITTED ITEMS', n: 'Open-up minimal sekali per periode Renewal.' },
  { s: 'Rudder & Steering Parts', t: 'Rudder, pintle, stock/shaft, coupling, stern frame; ukur dan catat bearing clearance (→ Modul 3).', a: 'ALL FITTED ITEMS', n: 'Angkat rudder / pressure test bila diminta Surveyor.' },
  { s: 'Propeller & Stern Bush', t: 'Propeller dan stern bush; ukur dan catat clearance stern bush dan efisiensi oil gland (→ Modul 3).', a: 'ALL FITTED ITEMS' },
  { s: 'Side Thrusters / Other Propulsors', t: 'Side thruster dan propulsor lain secara eksternal.', a: 'IF FITTED' },
  { s: 'Additional Bottom Surveys', t: 'Kehadiran Surveyor untuk Bottom Survey tambahan di luar minimum class.', a: 'WHEN PERFORMED' },
  { s: 'SOLAS / Ship-Type Requirements', t: 'Konfirmasi interval bottom statutori/tipe kapal yang lebih pendek.', a: 'VERIFY' },
];
// [System, Component, Method(1/2/6), Applicability]
export const MACHINERY: [string, string, string, string][] = [
  ['Propulsion', 'Propulsion driver — diesel engine', '1', 'IF FITTED'],
  ['Propulsion', 'Propulsion driver — steam turbine', '1', 'IF FITTED'],
  ['Propulsion', 'Propulsion driver — gas turbine', '6', 'IF FITTED'],
  ['Propulsion', 'Electric power units & hydraulic motors', '2', 'IF FITTED'],
  ['Propulsion', 'Thrust/intermediate shafts, bearings, clutches, couplings, dampers', '2', 'IF FITTED'],
  ['Propulsion', 'Gears — shafts, pinions, wheels, PTO/PTI', '2', 'IF FITTED'],
  ['Propulsion', 'CPP servo mechanism', '2', 'IF FITTED'],
  ['Propulsion', 'CPP hydraulic power system', '2', 'IF FITTED'],
  ['Main & Emergency Electric Power', 'Generator driver — diesel engine', '1', 'IF FITTED'],
  ['Main & Emergency Electric Power', 'Generator driver — steam turbine', '1', 'IF FITTED'],
  ['Main & Emergency Electric Power', 'Generator driver — gas turbine', '6', 'IF FITTED'],
  ['Main & Emergency Electric Power', 'Generators', '2', 'REQUIRED'],
  ['Main & Emergency Electric Power', 'Shafts, clutches, couplings, dampers', '2', 'IF FITTED'],
  ['Main & Emergency Electric Power', 'Gears — shafts, pinions, wheels, PTO/PTI', '2', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Heat exchangers', '1', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Pipes, valves and filters in machinery space', '2', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Pumps', '2', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Pump drivers — electric motors', '2', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Pump drivers — steam turbines', '1', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Condensers', '1', 'IF FITTED'],
  ['Feed Water, Steam & Condensate', 'Fresh-water generators — steam-turbine propulsion only', '1', 'IF FITTED'],
  ['Fuel & Lubrication Oil', 'Heat exchangers', '1', 'IF FITTED'],
  ['Fuel & Lubrication Oil', 'Pipes, valves, filters, pumps and pump drivers', '2', 'REQUIRED / IF FITTED'],
  ['Incineration', 'Incinerator', '1', 'IF FITTED'],
  ['Sea Water', 'Pumps and heat exchangers', '1', 'IF FITTED'],
  ['Sea Water', 'Pipes, valves, filters and pump drivers', '2', 'IF FITTED'],
  ['Fresh Water', 'Heat exchangers', '1', 'IF FITTED'],
  ['Fresh Water', 'Pipes, valves, filters, pumps and pump drivers', '2', 'IF FITTED'],
  ['Bilge', 'Pumps and ejectors', '1', 'REQUIRED / IF FITTED'],
  ['Bilge', 'Pipes, valves, filters in machinery space, and pump drivers', '2', 'REQUIRED / IF FITTED'],
  ['Compressed Air', 'Compressors', '2', 'IF FITTED'],
  ['Compressed Air', 'Air receivers', '1', 'IF FITTED'],
  ['Compressed Air', 'Pipes, valves and filters in machinery space', '2', 'IF FITTED'],
  ['Exhaust Gas NOx/SOx Cleaning', 'Treatment-fluid pipes, valves, filters, pumps, drivers', '2', 'IF FITTED'],
  ['Exhaust Gas', 'Fans and fan drivers (function test fan only)', '1', 'IF FITTED'],
  ['Inert Gas', 'Pumps and fans', '2', 'N/A'],
  ['Cargo Piping', 'Compressors', '1', 'N/A'],
  ['Cargo Tank Cleaning', 'Pump, fan, compressor drivers — diesel & steam turbine', '1', 'N/A'],
  ['Cargo Refrigeration', 'Pump, fan, compressor drivers — electric & hydraulic motors', '2', 'N/A'],
  ['Cargo Regasification', 'Hydraulic power systems of drivers', '2', 'N/A'],
  ['Cargo Reliquefaction', 'Heat exchangers, scrubbers and vaporizers', '1', 'N/A'],
  ['Cargo Reliquefaction', 'Pipes, valves and filters', '2', 'N/A'],
];
export const METHOD: Record<string, string> = {
  '1': 'Method 1 — Open-up visual; uji fungsi/tekanan bila relevan',
  '2': 'Method 2 — Visual tanpa bongkar; performance test; verifikasi overhaul terakhir',
  '6': 'Note 6 — Verifikasi catatan overhaul; overhaul oleh OEM / OEM-authorized',
};

/* ============================================================================
 * 4. SCOPE HELPERS
 * ========================================================================== */
export const RESULTS = ['NOT CHECKED', 'SATISFACTORY', 'DEFICIENCY', 'N/A'];

export function applicability(a: string, g: Item['g'], vt: VType, age: number | null, x?: string[]): string {
  if (x?.includes(vt)) return 'N/A';
  if (a.startsWith('N/A')) return HOLD_TYPES.includes(vt) ? 'IF FITTED' : 'N/A';
  if (a.includes('TUGBOAT') && !TUG_TYPES.includes(vt)) return 'N/A';
  if (age !== null) {
    if (g === 'mid' && !(age >= 5 && age <= 10)) return 'N/A';
    if (g === 'old' && !(age > 10)) return 'N/A';
  }
  return a;
}

export type TRow = { id: string; cat: string; item: string; scope: string; note: string };
/** Jenis kapal tanpa tangki FO di cargo length area (Tabel 3.3 baris "Cargo Length Area" tidak berlaku). */
/** Jenis kapal dengan hatch cover & coaming palka kargo (UT wajib mulai Renewal III). Tanker/gas carrier tidak masuk: tidak punya palka kargo. */
export const HATCH_TYPES = ['General Cargo', 'Bulk Carrier', 'Container Ship'];
const NO_CARGO_FO = ['Tugboat', 'Anchor Handling Tug', 'Pontoon', 'Oil Barge'];
/** Item checklist yang tidak berlaku untuk kapal tanpa penggerak (tongkang, ponton). */
export const NA_UNPROPELLED = ['Steering & Communications', 'Machinery Control & Ventilation', 'Rudder & Steering Parts', 'Propeller & Stern Bush', 'Side Thrusters / Other Propulsors', 'Crank Web Deflection'];
export function renewalTables(rnIn: number, age: number | null, vt?: string, propelled = true) {
  const rn = Math.min(rnIn, 4); // Renewal IV dan seterusnya memakai aturan yang sama (tabel hanya sampai IV)
  const none = 'NONE';
  const tanks: TRow[] = [
    { id: 'T1', cat: 'Internal', item: 'Ballast-water, Forepeak & Afterpeak Tanks', scope: 'ALL', note: 'Berlaku di setiap Renewal.' },
    { id: 'T2', cat: 'Internal', item: 'FO Tank di Engine Room', scope: !propelled ? 'N/A' : rn <= 2 ? none : 'ONE', note: 'Renewal I–II: tidak ada; III & IV+: satu tangki. Kapal tanpa penggerak tidak punya engine room.' },
    {
      id: 'T3', cat: 'Internal', item: 'FO Tank di Cargo Length Area',
      scope: !propelled || !vt || NO_CARGO_FO.includes(vt) ? 'N/A' : rn === 1 ? none : rn === 2 ? 'ONE' : rn === 3 ? 'TWO' : 'HALF, MIN. 2',
      note: 'I: tidak ada; II: satu; III: dua; IV+: setengah, minimum 2 (bila ada tangki FO di area ini).' + (rn >= 3 ? ' Termasuk satu deep tank FO bila ada (catatan 4).' : ''),
    },
    { id: 'T4', cat: 'Internal', item: 'FO Tank Tambahan di luar Engine Room', scope: rn === 1 ? none : rn <= 3 ? 'ONE' : 'TWO', note: 'Hanya bila tidak ada tangki FO di Cargo Length Area. I: tidak ada; II–III: satu; IV+: dua.' },
    { id: 'T5', cat: 'Internal', item: 'Lube-Oil Tank', scope: rn === 4 ? 'ONE' : none, note: 'I–III: tidak ada; IV+: satu.' },
    { id: 'T6', cat: 'Internal', item: 'Fresh-Water Tank', scope: rn === 1 ? none : rn === 2 ? 'ONE' : 'ALL', note: 'I: tidak ada; II: satu; III & IV+: semua.' },
    { id: 'T9', cat: 'Internal', item: 'Structural Downflooding & Ventilation Ducts', scope: rn >= 3 ? 'REQUIRED' : none, note: 'Renewal III dan seterusnya; bila ada.' },
    { id: 'T7', cat: 'Pressure Test', item: 'Ballast', scope: 'REQUIRED', note: 'Pressure test batas tangki ballast.' },
    { id: 'T8', cat: 'Pressure Test', item: 'FO / LO / Fresh-Water Tanks', scope: 'SURVEYOR DECISION', note: 'Pertimbangan khusus Surveyor.' },
  ];
  const ut: TRow[] = [
    { id: 'U1', cat: 'UT', item: 'Suspect Areas', scope: 'REQUIRED', note: 'Area yang tampak/diduga mengalami deteriorasi.' },
    { id: 'U2', cat: 'UT', item: 'Transverse Sections of Deck Plating (0,5L midship)', scope: rn === 1 ? none : rn === 2 ? 'ONE SECTION' : rn === 3 ? 'TWO SECTIONS' : 'THREE SECTIONS', note: 'Bertambah menurut nomor Renewal. Kapal < 100 m boleh dikurangi: 1 penampang (Renewal III), 2 penampang (IV+) — catatan 3.' },
    { id: 'U3', cat: 'UT', item: 'Cargo Hold Hatch Covers & Coamings', scope: !vt || !HATCH_TYPES.includes(vt) ? 'N/A' : rn >= 3 ? 'REQUIRED' : none, note: 'Renewal III dan seterusnya (pelat dan stiffener); hanya kapal dengan hatch cover palka kargo (Tabel 3.1 butir 3). Hatch cover desain approved yang strukturnya tidak punya akses ke internal: ukur bagian yang dapat diakses (catatan 5).' },
    { id: 'U4', cat: 'UT', item: 'Forepeak & Afterpeak Ballast Tanks (internal)', scope: rn >= 3 ? 'REQUIRED' : none, note: 'Berlaku mulai Renewal III. Pengukuran internal dapat dipertimbangkan khusus oleh Surveyor bila hard coating dalam kondisi GOOD (catatan 2).' },
    { id: 'U5', cat: 'UT', item: 'Exposed Main Deck Plating', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV ke atas. Kapal > 100 m pada Renewal III: pengukuran geladak terbuka pada 0,5L tengah kapal dapat dipersyaratkan (catatan 4).' },
    { id: 'U6', cat: 'UT', item: 'Exposed Superstructure Deck Plating', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV ke atas.' },
    { id: 'U7', cat: 'UT', item: 'Transverse Bulkheads in Cargo Spaces', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV+ bila ruang kargo ada.' },
    { id: 'U8', cat: 'UT', item: 'Wind & Water Strakes', scope: rn === 4 ? 'REQUIRED' : none, note: 'Port & starboard, full length.' },
    { id: 'U9', cat: 'UT', item: 'Keel & Additional Bottom Plates', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV ke atas.' },
    { id: 'U10', cat: 'UT', item: 'Sea Chests & Overboard Discharges', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV ke atas; extent sesuai Surveyor.' },
  ];
  const air: TRow[] = [
    { id: 'P1', cat: 'Air Pipe Head', item: 'Forward 0.25L', scope: age === null ? '—' : age <= 5 ? 'Dua head: 1 port & 1 starboard' : 'Semua air pipe head', note: 'Prioritaskan head yang melayani tangki ballast.' },
    { id: 'P2', cat: 'Air Pipe Head', item: 'Aft of 0.25L', scope: age === null ? '—' : age <= 5 ? 'Dua head: 1 port & 1 starboard' : age <= 10 ? 'Minimal 20% air pipe head' : 'Semua air pipe head', note: 'Pada exposed deck; prioritaskan ballast.' },
  ];
  return { tanks, ut, air };
}

/* ============================================================================
 * 5. SHAFT CLEARANCE & DIMENSI (Sheet "Dimensi Kemudi")
 * ========================================================================== */
/* ---------- Diameter minimum desain poros (Rules BKI: formula (1) dan (2), material B.1) ---------- */
export type ShaftKind = 'prop' | 'inter' | 'thrust';
export const K_OPTS: Record<ShaftKind, { id: string; k: number; label: string }[]> = {
  prop: [
    { id: 'p122', k: 1.22, label: '1,22 — flens / keyless taper (bagian antara tepi depan bearing paling belakang dan muka depan hub, min. 2,5·d)' },
    { id: 'p126', k: 1.26, label: '1,26 — baling-baling dengan pasak pada taper' },
    { id: 'p140', k: 1.4, label: '1,40 — poros di stern tube dilumasi grease' },
    { id: 'p115', k: 1.15, label: '1,15 — antara ujung depan bearing paling belakang dan ujung depan seal stern tube' },
  ],
  inter: [
    { id: 'i100', k: 1.0, label: '1,0 — bagian polos dengan flens tempa integral / shrink-fitted keyless' },
    { id: 'i110k', k: 1.1, label: '1,10 — flens dipasang dengan pasak' },
    { id: 'i110r', k: 1.1, label: '1,10 — lubang radial ≤ 0,3·da' },
    { id: 'i115', k: 1.15, label: '1,15 — multi-splined' },
    { id: 'i120', k: 1.2, label: '1,20 — slot memanjang (sesuai batasan)' },
  ],
  thrust: [{ id: 't110', k: 1.1, label: '1,10 — dekat bearing polos kedua sisi thrust collar / axial bearing' }],
};
export type DminCfg = { kind: ShaftKind; kId: string; f: string; mat: 'cmn' | 'alloy'; rm: string };
export const DMIN0: DminCfg = { kind: 'prop', kId: 'p122', f: '100', mat: 'cmn', rm: '' };
/** t = tebal liner original (mm); wb / wp = aus liner terukur di area bearing / packing (mm) — hanya sistem oil. */
export type ShaftRow = { d: string; a: string; m: string; p: string; n: string; b: string; l?: string; t?: string; wb?: string; wp?: string };
export const SHAFT0: ShaftRow = { d: '', a: '', m: '', p: '', n: '', b: '', l: '', t: '', wb: '', wp: '' };

/**
 * Diameter minimum poros, Rules BKI formula (1): da ≥ d ≥ F·k·∛[ Pw / (n·(1 − (di/da)⁴)) · Cw ], Cw = 560/(Rm+160) (formula (2)).
 * Bore ≤ 0,4·da → suku (1 − (di/da)⁴) dianggap 1,0.
 *  - Poros pejal (bore kosong): d TIDAK memerlukan diameter aktual; da hanya dipakai untuk vonis COMPLIANT / NON-COMPLIANT.
 *  - Poros berlubang + da terisi: d dihitung langsung dengan da aktual.
 *  - Poros berlubang + da kosong: suku bore bergantung pada da, maka yang dicari adalah diameter luar TERKECIL (da) yang memenuhi
 *    da ≥ d(da) untuk bore tersebut (hasil `solved` = true).
 *  - Bore ≥ da mustahil → dmin null dan `badBore` = true.
 */
export function minDiameter(cfg: DminCfg, da: number | null, pw: number | null, n: number | null, di: number | null) {
  // batas Rm untuk perhitungan Cw (Rules B.1): propeller shaft 600; carbon/CMn selain propeller 760; alloy selain propeller 800
  const cap = cfg.kind === 'prop' ? 600 : cfg.mat === 'alloy' ? 800 : 760;
  const rmIn = num(cfg.rm);
  const rm = Math.min(rmIn ?? cap, cap);
  const capped = rmIn !== null && rmIn > cap;
  const cw = 560 / (rm + 160); // formula (2)
  const opt = K_OPTS[cfg.kind].find((o) => o.id === cfg.kId) ?? K_OPTS[cfg.kind][0];
  const Fn = cfg.kind === 'prop' ? 100 : num(cfg.f);
  const F = Fn ?? 0;
  const none = (badBore = false) => ({ dmin: null as number | null, rm, cw, capped, k: opt.k, F, cap, solved: false, badBore });
  // F kosong / bukan angka / ≤ 0 → tidak dinilai (dmin null), jangan dianggap 0 yang membuat semua poros COMPLIANT
  if (pw === null || n === null || pw <= 0 || n <= 0 || Fn === null || Fn <= 0) return none();
  const solid = F * opt.k * Math.cbrt((pw / n) * cw); // suku bore = 1,0
  const out = (dmin: number, solved = false) => ({ dmin, rm, cw, capped, k: opt.k, F, cap, solved, badBore: false });
  if (di === null || di <= 0) return out(solid); // pejal: tidak perlu diameter aktual
  const boreTerm = (d: number) => (di / d <= 0.4 ? 1 : 1 - Math.pow(di / d, 4));
  const dAt = (d: number) => F * opt.k * Math.cbrt((pw / (n * boreTerm(d))) * cw);
  if (da !== null && da > 0) {
    if (di >= da) return none(true); // bore tidak mungkin sebesar atau lebih dari diameter luar
    return out(dAt(da));
  }
  // da kosong: cari da terkecil dengan da ≥ d(da). g(da) = da − d(da) naik terus terhadap da, jadi cukup bisection.
  let lo = di;
  let hi = Math.max(solid, di / 0.4); // di titik ini suku bore = 1 → g = hi − solid ≥ 0
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid - dAt(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return out(hi, true);
}

export type ShaftSys = 'open' | 'oil' | 'fw';
export const SHAFT_SYS: [ShaftSys, string][] = [
  ['open', 'Open loop (dilumasi air laut)'],
  ['oil', 'Closed loop — oil'],
  ['fw', 'Closed loop — fresh water'],
];
/** D = diameter LINER (bukan diameter poros) bila poros berliner. Open loop = rumus Water Lubricated; Closed loop oil = rumus Oil Lubricated; Closed loop fresh water = batas dari manual pabrikan. */
/** Koefisien batas clearance poros: [pengali D, konstanta mm]. Satu-satunya sumber: dipakai perhitungan, Modul Propulsi, dan Memo. */
export const SHAFT_COEF = {
  open: { newLo: [0.003, 0.2], newHi: [0.004, 0.5], max: [0.01, 2.5] },
  oil: { newLo: [0.001, 0.3], newHi: [0.001, 0.5], max: [0.0015, 0.65] },
} as const;
const lin = (c: readonly number[], d: number) => c[0] * d + c[1];
export const idn = (n: number) => String(n).replace('.', ',');
const f1 = (n: number) => n.toFixed(1).replace('.', ',');
export function shaftLimits(sys: ShaftSys, cond: 'new' | 'max', d: number | null): { lo: number | null; hi: number | null } {
  if (d === null || sys === 'fw') return { lo: null, hi: null };
  const k = SHAFT_COEF[sys];
  return cond === 'new' ? { lo: lin(k.newLo, d), hi: lin(k.newHi, d) } : { lo: null, hi: lin(k.max, d) };
}
/** Teks rumus maksimum clearance (kondisi dalam pemakaian), mis. "0,01·D + 2,5 mm". */
export const shaftMaxRule = (sys: ShaftSys): string => (sys === 'fw' ? 'sesuai manual pabrikan' : `${idn(SHAFT_COEF[sys].max[0])}·D + ${idn(SHAFT_COEF[sys].max[1])} mm`);
/** Toleransi aus shaft liner pada sistem oil (persen dari tebal liner). */
export const LINER_WEAR_PCT = { bearing: 25, packing: 50 };
/** Batas clearance rudder stock (mm). Satu-satunya sumber untuk perhitungan, Modul Propulsi, dan Memo. */
export const RUDDER = { neck: { k: 0.01, c: 2, cap: 4 }, pintle: { lo: 50, hi: 100, small: 3, mid: 5, k: 0.01, c: 4, cap: 6 } };
export function rudderMax(item: 'Neck Bearing' | 'Pintle Bearing', d: number | null): number | null {
  if (d === null) return null;
  if (item === 'Neck Bearing') return Math.min(RUDDER.neck.k * d + RUDDER.neck.c, RUDDER.neck.cap);
  const p = RUDDER.pintle;
  if (d < p.lo) return p.small;
  if (d <= p.hi) return p.mid;
  return Math.min(p.k * d + p.c, p.cap);
}
const R = RUDDER;
export const RUDDER_RULE_SHORT = `Neck: min(${idn(R.neck.k)}d + ${R.neck.c}; ${R.neck.cap}). Pintle: d<${R.pintle.lo} → ${R.pintle.small}; ${R.pintle.lo}–${R.pintle.hi} → ${R.pintle.mid}; d>${R.pintle.hi} → min(${idn(R.pintle.k)}d + ${R.pintle.c}; ${R.pintle.cap})`;
export const RUDDER_RULE_MEMO = `Neck bearing: maks. ${idn(R.neck.k)}·D + ${f1(R.neck.c)} mm (maks. ${f1(R.neck.cap)} mm). Pintle bearing: d < ${R.pintle.lo} mm → ${f1(R.pintle.small)} mm; ${R.pintle.lo}–${R.pintle.hi} mm → ${f1(R.pintle.mid)} mm; d > ${R.pintle.hi} mm → ${idn(R.pintle.k)}·d + ${f1(R.pintle.c)} mm (maks. ${f1(R.pintle.cap)} mm).`;
export type Verdict = 'COMPLIANT' | 'NON-COMPLIANT' | '';
/** Batas minimum jangkar dan rantai jangkar terhadap nilai asli (dipakai modul Propulsi dan Memorandum). */
export const ANCHOR_MIN_RATIO = 0.9; // berat jangkar: minimum 90% dari berat asli
export const CHAIN_MIN_RATIO = 0.88; // diameter rantai jangkar: minimum 88% dari diameter asli
/** Panjang 1 segel (shackle) rantai jangkar, meter. */
export const SEGEL_M = 27.5;
/** Jumlah segel untuk panjang minimum rantai (m): dibulatkan ke atas karena rantai hanya tersedia per segel utuh. */
export const segelsFor = (lenM: number | null): number | null => (lenM !== null && lenM > 0 ? Math.ceil(lenM / SEGEL_M - 1e-9) : null);
/** Data rantai jangkar: o = diameter original (mm), a = diameter aktual (mm), len = panjang minimum yang dipersyaratkan (m, dari perhitungan engineer). */
export type ChainState = { o: string; a: string; len: string };
export const CHAIN0: ChainState = { o: '', a: '', len: '' };

/* ============================================================================
 * 6. UI PRIMITIVES
 * ========================================================================== */
// Docking Survey 1: lewat batas 36 bulan = SUSPENDED; selesai lebih dari 6 bulan setelah batas 36 bulan = WITHDRAWN
// (keputusan pengguna). Ubah ke false bila kebijakan kembali ke "hanya SUSPENDED" (sheet Class Status M6 lama).
export const DOCKING_CAN_WITHDRAW = true;

export type Sel = Record<SurveyKey, boolean>;
