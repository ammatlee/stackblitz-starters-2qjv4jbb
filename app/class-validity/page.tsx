'use client';

/**
 * RDK — VESSEL SURVEY STATUS & CLASS SCOPE MANAGEMENT
 * Dasar aturan : BKI Circular 15-SV-095
 * Sumber data  : Surveyor_Development_Program_Rev_2.xlsx
 *                (Class Status · Survey Scope · Dimensi Kemudi)
 *
 * Single-file component untuk Next.js App Router (app/page.tsx) + Tailwind CSS.
 * Semua kalkulasi real-time (useMemo). Logika Modul 1 mengikuti rumus sheet 'Class Status'.
 */

import React, { useMemo, useState } from 'react';
import AgendaPanel from '../../components/AgendaPanel';
import VesselStatus from '../../components/VesselStatus';
import DateInput from '../../components/DateInput';
import VesselTypeSelect from '../../components/VesselTypeSelect';
import VesselNameInput from '../../components/VesselNameInput';
import { TUG_TYPES, HOLD_TYPES, CARGO_SYSTEM_TYPES, isNonPropelled } from '../../lib/vesselTypes';
import type { ApplyValues } from '../../components/VesselStatus';
import { roman } from '../../lib/surveyStatus';
import { PLANS, CONN_LABEL, OPEN_CFG_LABEL, extensionRules, shaftView } from '../../lib/shaftRules';
import type { Conn, OpenCfg, PlanKey } from '../../lib/shaftRules';

/* ============================================================================
 * 1. DATE UTILITIES (UTC, perilaku EDATE seperti Excel)
 * ========================================================================== */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const parseD = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
};
const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const mk = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m, 1));
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, dim(t.getUTCFullYear(), t.getUTCMonth()))));
};
const addM = (d: Date, n: number) => mk(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
const fmt = (d: Date | null | undefined) =>
  d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '—';
const fmtDM = (d: number, m: number) => `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) ? v : null;
};
const daysBetween = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/* ============================================================================
 * 2. DOMAIN CONSTANTS
 * ========================================================================== */
type SurveyKey = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'INT' | 'D1' | 'REN' | 'PS';
type Status = 'VALID' | 'SUSPENDED' | 'WITHDRAWN' | 'INPUT REQUIRED';
type VType = string;

const SURVEYS: { key: SurveyKey; label: string }[] = [
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
const HIST_KEYS: SurveyKey[] = ['A1', 'A2', 'A3', 'A4', 'INT'];
const isAnnual = (k: SurveyKey) => k === 'A1' || k === 'A2' || k === 'A3' || k === 'A4' || k === 'A5';

const RULES = [
  ['Annual Year 1–4', 'Anniversary − 3 bulan', 'Anniversary + 3 bulan', 'Inspeksi pertama dimulai setelah window end', 'Completion > 6 bulan setelah window end'],
  ['Intermediate', 'Anniversary Year 2 − 3 bulan', 'Anniversary Year 3 + 3 bulan', 'Inspeksi pertama dimulai setelah window end', 'Completion > 6 bulan setelah window end'],
  ['Docking Survey 1', 'Target bulan ke-24 setelah Renewal/Docking sebelumnya', 'Maks. 36 bulan setelah Bottom Survey sebelumnya', 'Mulai atau selesai setelah batas 36 bulan', 'Tidak ada perpanjangan; keterlambatan tetap SUSPENDED'],
  ['Renewal + Docking 2', 'Boleh mulai sebelum expiry (−3 bulan = acuan pergeseran)', 'Expiry atau extension disetujui (maks. 3 bulan)', 'Inspeksi pertama dimulai setelah batas berlaku', 'Completion > 6 bulan setelah expiry asli'],
];
const CASES = [
  ['A. Annual / Intermediate Overdue', 'Reinstatement of Class Survey dengan lingkup Intermediate Survey.', 'Dapat dilakukan afloat atau di dry dock.'],
  ['B. Recommendation Overdue', 'Reinstatement of Class Survey + penyelesaian seluruh recommendation.', 'Semua recommendation wajib diselesaikan.'],
  ['C. Dua Annual + Intermediate Terlewat', 'Reinstatement of Class Survey dengan lingkup Class Renewal.', 'Wajib dry dock; terbitkan interim certificate dan mulai class period baru.'],
  ['D. Class Renewal Overdue', 'Reinstatement of Class Survey dengan lingkup Class Renewal sesuai umur kapal.', 'Terbitkan interim certificate dan mulai class period baru.'],
];

/* ============================================================================
 * 3. SURVEY SCOPE DATA (Sheet "Survey Scope")
 * ========================================================================== */
type Item = { s: string; t: string; a: string; n?: string; g?: 'mid' | 'old' };

const ANNUAL: Item[] = [
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
const INTERMEDIATE: Item[] = [
  { s: 'Survey Planning', t: 'Planning meeting sebelum survei dimulai.', a: 'REQUIRED' },
  { s: 'Representative Ballast Tanks', t: 'Pemeriksaan internal umum; perluas ke tipe tangki sama bila coating tidak ada / soft / POOR.', a: 'REQUIRED', g: 'mid', n: 'Kapal umur 5–10 tahun.' },
  { s: 'All Ballast Tanks', t: 'Pemeriksaan internal umum seluruh tangki ballast; dapat dibatasi ke verifikasi proteksi korosi bila tidak ada cacat.', a: 'REQUIRED', g: 'old', n: 'Kapal > 10 tahun.' },
  { s: 'Annual Tank Follow-up', t: 'Tangki terdampak dapat memerlukan pemeriksaan internal tahunan bila coating tidak ada/soft/POOR dan tidak diperbaiki.', a: 'AS REQUIRED' },
  { s: 'Cargo Holds', t: 'Pemeriksaan internal palka terpilih.', a: 'N/A FOR CURRENT VESSEL TYPES' },
  { s: 'Selected Cargo Spaces', t: 'Pemeriksaan internal ruang kargo terpilih.', a: 'IF FITTED / VERIFY NOTATION', n: 'Kapal > 10 tahun.' },
  { s: 'Machinery Measurements', t: 'Crank web deflection main engine, crank deflection diesel bantu, insulation resistance generator/motor/kabel/switchgear.', a: 'ALL / WHERE RELEVANT' },
  { s: 'Operational Tests', t: 'Emergency generator/switchboard, emergency bilge valve, drain air receiver, operasi umum mesin/listrik.', a: 'ALL / IF FITTED' },
  { s: 'Crediting Restriction', t: 'Intermediate dan Class Renewal tidak boleh dikreditkan bersamaan (termasuk thickness measurement).', a: 'REQUIRED' },
];
const RENEWAL: Item[] = [
  { s: 'Schedule & Planning', t: 'Planning meeting; boleh mulai pada Annual ke-4. Bila mulai lebih awal, selesaikan dalam 15 bulan.', a: 'REQUIRED', n: 'Extension disetujui maks. 3 bulan.' },
  { s: 'Survey Crediting', t: 'Tidak boleh kredit bersamaan dengan Intermediate Survey atau thickness measurement.', a: 'REQUIRED' },
  { s: 'Hull, Equipment & Piping', t: 'Cakupan cukup untuk menegaskan kondisi memuaskan untuk class period 5 tahun baru.', a: 'ALL' },
  { s: 'Underwater Parts', t: 'Pemeriksaan bagian bawah air bersamaan dengan docking Renewal.', a: 'REQUIRED' },
  { s: 'Anchors & Chain Cables', t: 'Range dan periksa jangkar/rantai, chain locker, holdfast, hawse pipe, stopper.', a: 'ALL', n: 'Gauge rantai mulai Renewal II (±3 link per 27,5 m).' },
  { s: 'Internal Spaces', t: 'Periksa internal semua palka, tangki, pump room, tunnel, ruang mesin, cofferdam, void.', a: 'ALL FITTED SPACES', n: 'Rincian tangki: tabel di bawah.' },
  { s: 'Engine-Room Structure', t: 'Tank top, shell, bracket, sekat, bilge well, sea suction, pipa pendingin, overboard valve.', a: 'IF FITTED', n: 'UT bila ada wastage.' },
  { s: 'Ballast-Tank Coating', t: 'Sistem proteksi korosi; follow-up tahunan dan UT bila coating absent/soft/semi-hard/POOR.', a: 'IF BALLAST TANKS FITTED' },
  { s: 'Tank Pressure Tests', t: 'Ballast/air laut hingga air-pipe head; FO/LO/FW hingga level cairan layanan tertinggi.', a: 'REQUIRED / SURVEYOR DECISION' },
  { s: 'Cargo Hatch Covers & Coamings', t: 'Survei close-up, operasi penuh dan uji sealing.', a: 'N/A FOR COVERED VESSEL TYPES' },
  { s: 'Thickness Measurements', t: 'Cakupan minimum menurut nomor Renewal; perluas bila korosi substansial.', a: 'REQUIRED', n: 'Lihat tabel UT di bawah.' },
  { s: 'Bilge & Ballast Piping', t: 'Periksa dan uji operasi pada tekanan kerja.', a: 'ALL FITTED SYSTEMS' },
  { s: 'Automatic Air Pipe Heads', t: 'Pemeriksaan eksternal dan internal; lepas head bila bagian dalam tidak terjangkau.', a: 'ALL EXCEPT PASSENGER SHIPS', n: 'Lihat tabel Air Pipe Head di bawah.' },
  { s: 'Towing Winch Emergency Release', t: 'Uji fungsi penuh (daya normal & blackout) pada yang lebih kecil dari 30% beban desain maks. atau 80% bollard pull.', a: 'TUGBOAT — IF FITTED', n: 'Gunakan bollard-pull test atau strong point bersertifikat.' },
  { s: 'Certificate Period', t: 'Completion < 3 bulan sebelum expiry → periode & anniversary baru dari completion. Antara −3 s.d. +6 bulan → anniversary lama dipertahankan. > 6 bulan setelah expiry → periode baru dari completion.', a: 'REQUIRED' },
];
const DOCKING: Item[] = [
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
const MACHINERY: [string, string, string, string][] = [
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
const METHOD: Record<string, string> = {
  '1': 'Method 1 — Open-up visual; uji fungsi/tekanan bila relevan',
  '2': 'Method 2 — Visual tanpa bongkar; performance test; verifikasi overhaul terakhir',
  '6': 'Note 6 — Verifikasi catatan overhaul; overhaul oleh OEM / OEM-authorized',
};

/* ============================================================================
 * 4. SCOPE HELPERS
 * ========================================================================== */
const RESULTS = ['NOT CHECKED', 'SATISFACTORY', 'DEFICIENCY', 'N/A'];

function applicability(a: string, g: Item['g'], vt: VType, age: number | null): string {
  if (a.startsWith('N/A')) return HOLD_TYPES.includes(vt) ? 'IF FITTED' : 'N/A';
  if (a.includes('TUGBOAT') && !TUG_TYPES.includes(vt)) return 'N/A';
  if (age !== null) {
    if (g === 'mid' && !(age >= 5 && age <= 10)) return 'N/A';
    if (g === 'old' && !(age > 10)) return 'N/A';
  }
  return a;
}

type TRow = { id: string; cat: string; item: string; scope: string; note: string };
function renewalTables(rn: number, age: number | null) {
  const none = 'NONE';
  const tanks: TRow[] = [
    { id: 'T1', cat: 'Internal', item: 'Ballast-water, Forepeak & Afterpeak Tanks', scope: 'ALL', note: 'Berlaku di setiap Renewal.' },
    { id: 'T2', cat: 'Internal', item: 'FO Tank di Engine Room', scope: rn <= 2 ? none : 'ONE', note: 'Renewal I–II: tidak ada; III & IV+: satu tangki.' },
    { id: 'T3', cat: 'Internal', item: 'FO Tank di Cargo Length Area', scope: 'N/A', note: 'Tidak berlaku untuk Tugboat, Pontoon, Oil Barge.' },
    { id: 'T4', cat: 'Internal', item: 'FO Tank Tambahan di luar Engine Room', scope: rn === 1 ? none : rn <= 3 ? 'ONE' : 'TWO', note: 'I: tidak ada; II–III: satu; IV+: dua.' },
    { id: 'T5', cat: 'Internal', item: 'Lube-Oil Tank', scope: rn === 4 ? 'ONE' : none, note: 'I–III: tidak ada; IV+: satu.' },
    { id: 'T6', cat: 'Internal', item: 'Fresh-Water Tank', scope: rn === 1 ? none : rn === 2 ? 'ONE' : 'ALL', note: 'I: tidak ada; II: satu; III & IV+: semua.' },
    { id: 'T7', cat: 'Pressure Test', item: 'Ballast', scope: 'REQUIRED', note: 'Pressure test batas tangki ballast.' },
    { id: 'T8', cat: 'Pressure Test', item: 'FO / LO / Fresh-Water Tanks', scope: 'SURVEYOR DECISION', note: 'Pertimbangan khusus Surveyor.' },
  ];
  const ut: TRow[] = [
    { id: 'U1', cat: 'UT', item: 'Suspect Areas', scope: 'REQUIRED', note: 'Area yang tampak/diduga mengalami deteriorasi.' },
    { id: 'U2', cat: 'UT', item: 'Transverse Sections of Deck Plating (0,5L midship)', scope: rn === 1 ? none : rn === 2 ? 'ONE SECTION' : rn === 3 ? 'TWO SECTIONS' : 'THREE SECTIONS', note: 'Bertambah menurut nomor Renewal.' },
    { id: 'U3', cat: 'UT', item: 'Cargo Hold Hatch Covers & Coamings', scope: 'N/A', note: 'Tidak berlaku untuk tipe kapal ini.' },
    { id: 'U4', cat: 'UT', item: 'Forepeak & Afterpeak Ballast Tanks (internal)', scope: rn >= 3 ? 'REQUIRED' : none, note: 'Berlaku mulai Renewal III.' },
    { id: 'U5', cat: 'UT', item: 'Exposed Main Deck Plating', scope: rn === 4 ? 'REQUIRED' : none, note: 'Renewal IV ke atas.' },
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
type ShaftKind = 'prop' | 'inter' | 'thrust';
const K_OPTS: Record<ShaftKind, { id: string; k: number; label: string }[]> = {
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
type DminCfg = { kind: ShaftKind; kId: string; f: string; mat: 'cmn' | 'alloy'; rm: string };
const DMIN0: DminCfg = { kind: 'prop', kId: 'p122', f: '100', mat: 'cmn', rm: '' };
type ShaftRow = { d: string; a: string; m: string; p: string; n: string; b: string };
const SHAFT0: ShaftRow = { d: '', a: '', m: '', p: '', n: '', b: '' };

function minDiameter(cfg: DminCfg, da: number | null, pw: number | null, n: number | null, di: number | null) {
  // batas Rm untuk perhitungan Cw (Rules B.1): propeller shaft 600; carbon/CMn selain propeller 760; alloy selain propeller 800
  const cap = cfg.kind === 'prop' ? 600 : cfg.mat === 'alloy' ? 800 : 760;
  const rmIn = num(cfg.rm);
  const rm = Math.min(rmIn ?? cap, cap);
  const capped = rmIn !== null && rmIn > cap;
  const cw = 560 / (rm + 160); // formula (2)
  const opt = K_OPTS[cfg.kind].find((o) => o.id === cfg.kId) ?? K_OPTS[cfg.kind][0];
  const F = cfg.kind === 'prop' ? 100 : Number(cfg.f);
  if (da === null || pw === null || n === null || pw <= 0 || n <= 0) return { dmin: null as number | null, rm, cw, capped, k: opt.k, F, cap };
  const ratio = di !== null && da > 0 ? di / da : 0;
  const bore = ratio <= 0.4 ? 1 : 1 - Math.pow(ratio, 4); // bore ≤ 0,4·da → suku bore dianggap 1,0
  const dmin = F * opt.k * Math.cbrt((pw / (n * bore)) * cw); // formula (1)
  return { dmin, rm, cw, capped, k: opt.k, F, cap };
}

type ShaftSys = 'open' | 'oil' | 'fw';
const SHAFT_SYS: [ShaftSys, string][] = [
  ['open', 'Open loop (dilumasi air laut)'],
  ['oil', 'Closed loop — oil'],
  ['fw', 'Closed loop — fresh water'],
];
/** Open loop = rumus Water Lubricated; Closed loop oil = rumus Oil Lubricated; Closed loop fresh water = batas dari manual pabrikan. */
function shaftLimits(sys: ShaftSys, cond: 'new' | 'max', d: number | null): { lo: number | null; hi: number | null } {
  if (d === null || sys === 'fw') return { lo: null, hi: null };
  if (sys === 'open') return cond === 'new' ? { lo: 0.003 * d + 0.2, hi: 0.004 * d + 0.5 } : { lo: null, hi: 0.01 * d + 2.5 };
  return cond === 'new' ? { lo: 0.001 * d + 0.03, hi: 0.001 * d + 0.5 } : { lo: null, hi: 0.0015 * d + 0.65 };
}
function rudderMax(item: 'Neck Bearing' | 'Pintle Bearing', d: number | null): number | null {
  if (d === null) return null;
  if (item === 'Neck Bearing') return Math.min(0.01 * d + 2, 4);
  if (d < 50) return 3;
  if (d <= 100) return 5;
  return Math.min(0.01 * d + 4, 6);
}
type Verdict = 'COMPLIANT' | 'NON-COMPLIANT' | '';

/* ============================================================================
 * 6. UI PRIMITIVES
 * ========================================================================== */
// Sheet "Class Status" (M6): Docking Survey 1 hanya SUSPENDED bila lewat 36 bulan.
// Ubah ke true bila kebijakan Anda: > 36 bulan = SUSPENDED, > 36 + 6 bulan = WITHDRAWN.
const DOCKING_CAN_WITHDRAW = false;

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}
function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {right}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
function Fold({ title, sub, right, children, open }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        <div className="flex items-center gap-3">
          {right}
          <span className="text-xs text-slate-400 transition group-open:rotate-180">▼</span>
        </div>
      </summary>
      <div className="border-t border-slate-100 p-4 sm:p-5">{children}</div>
    </details>
  );
}
const BADGE: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  COMPLIANT: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  OPEN: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  SUSPENDED: 'bg-amber-100 text-amber-900 ring-amber-600/30',
  WITHDRAWN: 'bg-red-100 text-red-800 ring-red-600/20',
  'NON-COMPLIANT': 'bg-red-100 text-red-800 ring-red-600/20',
};
function Badge({ v, big }: { v: string; big?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        big ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-[11px]',
        BADGE[v] ?? 'bg-slate-100 text-slate-600 ring-slate-400/20'
      )}
    >
      {v}
    </span>
  );
}
function Progress({ done, total, def }: { done: number; total: number; def: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-teal-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <span className="tabular-nums text-slate-600">{done}/{total}</span>
      {def > 0 && <Badge v="NON-COMPLIANT" />}
    </div>
  );
}
function CheckRow({ title, desc, meta, chip, value, onChange }: { title: string; desc?: string; meta?: string; chip?: string; value: string; onChange: (v: string) => void }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="sm:max-w-[72%]">
        <p className="text-sm font-semibold">
          {title}
          {chip && <span className="ml-2 rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">{chip}</span>}
        </p>
        {desc && <p className="text-xs leading-relaxed text-slate-600">{desc}</p>}
        {meta && <p className="mt-0.5 text-[11px] text-slate-500">{meta}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'rounded-md border px-2 py-1 text-xs font-semibold',
          value === 'SATISFACTORY' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : value === 'DEFICIENCY' ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 bg-white'
        )}
      >
        {RESULTS.filter((r) => r !== 'N/A').map((r) => <option key={r}>{r}</option>)}
      </select>
    </li>
  );
}
function Gauge({ lo, hi, a }: { lo: number | null; hi: number | null; a: number | null }) {
  if (hi === null) return null;
  const max = hi * 1.5;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <div className="relative mt-2 h-2.5 rounded-full bg-red-100">
      <div className="absolute h-full rounded-full bg-emerald-300" style={{ left: pct(lo ?? 0), width: `${((hi - (lo ?? 0)) / max) * 100}%` }} />
      {a !== null && <div className="absolute -top-1 w-1 rounded bg-slate-900" style={{ left: pct(a), height: '1.125rem' }} />}
    </div>
  );
}
const dateIn = (v: string, set: (s: string) => void) => <DateInput className={inputCls} value={v} onChange={set} />;

/* ============================================================================
 * 7. MAIN PAGE
 * ========================================================================== */
type Sel = Record<SurveyKey, boolean>;

/* Dasar aturan: ITS Part A (bersumber dari Rules) dan Nota Dinas BKI No. 87/SVY/III/2020 (18 Maret 2020). */
const BASIS: Record<string, { title: string; its: string; nd: string }> = {
  'renewal-status': {
    title: 'Status kelas bila Renewal terlambat',
    its: 'Rules Vol I Sec. 2.B.2.2.1: Class otomatis SUSPENDED bila Renewal belum selesai pada due date atau expiry extension. Rules Sec. 2.B.4.5: Class di-WITHDRAWN bila suspended selama 6 bulan (suspension lebih lama dapat diberikan untuk kapal lay-up atau menunggu disposisi casualty).',
    nd: 'Poin 4: melewati expiry tetapi masih dalam 6 bulan = SUSPEND; lebih dari 6 bulan sejak expiry = WITHDRAWN. Dengan extension (maks. 3 bulan): VALID sampai extension berakhir, SUSPEND pada 3 bulan berikutnya, WITHDRAWN setelah 6 bulan.',
  },
  'renewal-window': {
    title: 'Periode sertifikat baru — Renewal dimulai sebelum expiry',
    its: 'Sec. 3.B.1.3.4: dimulai sebelum expiry atau dalam extension window dan selesai setelah expiry → periode lama berlaku (periode kelas dimulai dari expiry sertifikat sebelumnya). Selesai dalam window Annual ke-1 → Annual ke-1 ditiadakan, biaya survei tetap dikenakan.',
    nd: 'Poin 8: hal di luar Nota Dinas mengikuti Rules Vol I, ITS Part A, dan Circular yang berlaku.',
  },
  'renewal-suspend': {
    title: 'Renewal dimulai dan selesai pada masa SUSPEND',
    its: 'Sec. 3.B.1.3.3: bila Renewal selesai setelah expiry, sertifikat baru berlaku dari completion sampai paling lama 5 tahun sejak expiry sertifikat lama. (Sec. 3.B.1.3.5 "reclass" dipahami BKI sebagai kondisi WITHDRAWN, lihat Nota Dinas.)',
    nd: 'Poin 5a: dimulai dan completion pada masa suspend → lingkup Survey Pembaruan Kelas; masa berlaku sertifikat permanen dihitung dari masa berlaku sertifikat sebelumnya.',
  },
  'renewal-withdrawn': {
    title: 'Renewal pada kondisi WITHDRAWN',
    its: 'Sec. 3.B.1.3.5: survei dimulai setelah expiry (reclass) → periode kelas baru dimulai dari tanggal completion, lingkup berdasarkan umur kapal. Sec. 2.B.4.2 butir 4: scope re-classification = Renewal Survey + Bottom Survey.',
    nd: 'Poin 5b–5c: dimulai dan selesai pada status withdrawn, atau dimulai pada status valid/suspend tetapi completion saat withdrawn → Survey Penerimaan Kelas Kembali; masa berlaku sertifikat permanen dimulai dari tanggal completion (new period).',
  },
  'case-A': {
    title: 'Case A — Annual / Intermediate overdue',
    its: 'Sec. 2.B.4.2 butir 1: satu Annual overdue → scope re-classification = Intermediate Survey; bila Bottom Survey juga jatuh tempo, dilaksanakan bersamaan.',
    nd: 'Poin 3: suspended 6 bulan karena Annual/Intermediate/Special/survei lain overdue → kelas di-withdraw. Poin 2: setelah repair dan survey re-admission, kelas dapat diberikan kembali dengan periode baru.',
  },
  'case-B': {
    title: 'Case B — Recommendation overdue',
    its: 'Sec. 2.B.4.2: seluruh recommendation diselesaikan tuntas sebelum kapal berangkat; endorse "Visa no.1 dealt with" dan "Class reassigned and confirmed".',
    nd: 'Poin 3: recommendation yang overdue hingga suspended 6 bulan → kelas di-withdraw; poin 2: kelas dapat diberikan kembali setelah repair dan survey re-admission.',
  },
  'case-C': {
    title: 'Case C — Dua Annual + Intermediate terlewat',
    its: 'Sec. 2.B.4.2: scope re-classification = Renewal Survey + Bottom Survey (dry dock); terbitkan interim certificate dan tetapkan periode kelas baru.',
    nd: 'Poin 2 dan 5b–5c: Survey Penerimaan Kelas Kembali; masa berlaku sertifikat permanen dimulai dari tanggal completion (new period).',
  },
  'case-D': {
    title: 'Case D — Class Renewal overdue',
    its: 'Sec. 2.B.4.2 butir 4: scope re-classification = Renewal Survey + Bottom Survey dengan lingkup sesuai umur kapal.',
    nd: 'Poin 4b dan 5b–5c: lebih dari 6 bulan setelah expiry = WITHDRAWN; Survey Penerimaan Kelas Kembali dengan periode baru dari tanggal completion.',
  },
  'annual-advance': {
    title: 'Annual dikerjakan lebih awal (Annual in advance)',
    its: 'Sec. 3.B.1.1.3: anniversary baru = 3 bulan setelah tanggal completion dan dicatat lewat endorsement sertifikat; Annual berikutnya mengikuti interval anniversary baru. Intermediate: Sec. 3.B.1.2.3.',
    nd: 'Tidak diatur dalam Nota Dinas; ikuti ITS Part A (poin 8).',
  },
};

export default function Page() {
  const [tab, setTab] = useState<1 | 2 | 3>(1);

  /* ---- Modul 1 ---- */
  const [name, setName] = useState('');
  const [agenda, setAgenda] = useState('');
  const [vType, setVType] = useState<VType>('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [expiry, setExpiry] = useState('');
  const [annivD, setAnnivD] = useState<number | null>(null);
  const [annivM, setAnnivM] = useState<number | null>(null);
  const [extension, setExtension] = useState('');
  const [startDate, setStartDate] = useState('');
  const [compDate, setCompDate] = useState('');
  const [sel, setSel] = useState<Sel>({ A1: false, A2: false, A3: false, A4: false, A5: false, INT: false, D1: false, REN: false, PS: false });
  const [notation, setNotation] = useState(false); // notasi jangkar (data induk kapal)
  const [propelledFlag, setPropelledFlag] = useState<boolean | null>(null); // null = otomatis dari jenis kapal
  const [lastNo, setLastNo] = useState<number | null>(null); // nomor Renewal terakhir yang selesai
  const [statusRaw, setStatusInfo] = useState<NonNullable<ApplyValues['info']> | null>(null); // ringkasan Survey Status kapal terpilih
  const [statusName, setStatusName] = useState('');
  // hanya berlaku bila nama kapal di form masih sama dengan kapal yang dimuat statusnya
  const statusInfo = statusRaw && statusName.trim().toLowerCase() === name.trim().toLowerCase() ? statusRaw : null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [recDue, setRecDue] = useState('');
  const [recDone, setRecDone] = useState('');
  const [recAssess, setRecAssess] = useState('');

  /* ---- Modul 2 ---- */
  const [checks, setChecks] = useState<Record<string, string>>({});
  const setCheck = (id: string, v: string) => setChecks((c) => ({ ...c, [id]: v }));

  /* ---- Modul 3 ---- */
  const [shaftSys, setShaftSys] = useState<ShaftSys>('open');
  const [propConn, setPropConn] = useState<Conn | ''>(''); // tipe sambungan propeller (Scope Propeller Shaft)
  const [openCfg, setOpenCfg] = useState<OpenCfg | ''>(''); // konfigurasi poros sistem open (menentukan interval 5 / 3 tahun)
  const [shaftPlan, setShaftPlan] = useState<PlanKey | ''>(''); // Method / extension yang dikerjakan
  const [shaftCond, setShaftCond] = useState<'new' | 'max'>('max');
  const [shafts, setShafts] = useState<ShaftRow[]>([SHAFT0]); // satu baris per poros (mis. port / starboard)
  const [dmin, setDmin] = useState<DminCfg>(DMIN0);
  const [wd, setWd] = useState({ a: '', then: '', now: '' }); // wear-down gauge (oil lubricated)
  const [anchor, setAnchor] = useState({ o: '', a: '' });
  const [chain, setChain] = useState({ o: '', a: '' });
  const [rudder, setRudder] = useState([{ d: '', a: '' }, { d: '', a: '' }]);
  // kapal berpenggerak: otomatis dari jenis kapal (pontoon, barge, crane barge = tanpa penggerak), bisa dikoreksi per kapal
  const propelled = propelledFlag ?? !isNonPropelled(vType);

  /* ======================= MODUL 1: kalkulasi (mengikuti sheet Class Status) ======================= */
  const A = useMemo(() => {
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
  }, [expiry, startDate, compDate, extension, yearBuilt, annivD, annivM, sel, recDue, recDone, recAssess, lastNo, statusInfo]);

  /* ======================= MODUL 3: kalkulasi (sheet Dimensi Kemudi) ======================= */
  // Item Modul Propulsi menurut jenis survei (modul hanya muncul bila ada item yang diukur):
  //  Docking 1 / Renewal → clearance poros + rudder (neck & pintle), hanya kapal berpenggerak
  //  Propeller Shaft     → diameter minimum + clearance poros + rudder (neck & pintle), hanya kapal berpenggerak
  //  Renewal + notasi jangkar → berat jangkar + diameter rantai jangkar (kapal berpenggerak maupun tidak)
  const showShaft = propelled && (sel.D1 || A.active.renewal || sel.PS);
  const showRudder = propelled && (sel.D1 || A.active.renewal || sel.PS);
  const showClear = showShaft || showRudder;
  const showDmin = propelled && sel.PS;
  const showAnchor = notation && A.active.renewal;
  const propActive = showClear || showDmin || showAnchor;
  const S = useMemo(() => {
    const dminRes = shafts.map((r) => {
      const da = num(r.d);
      const m = minDiameter(dmin, da, num(r.p ?? ''), num(r.n ?? ''), num(r.b ?? ''));
      const v: Verdict = m.dmin !== null && da !== null ? (da >= m.dmin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
      return { ...m, da, v };
    });
    const shaftRes = shafts.map((r) => {
      const d = num(r.d);
      const a = num(r.a);
      const { lo, hi: hiRule } = shaftLimits(shaftSys, shaftCond, d);
      const manual = num(r.m ?? ''); // ITS Part A 1.10.2: instruksi pabrikan boleh menggantikan batas Rules
      const hi = manual !== null ? manual : hiRule;
      let v: Verdict = '';
      if (a !== null && hi !== null) v = lo !== null ? (a >= lo && a <= hi ? 'COMPLIANT' : 'NON-COMPLIANT') : a <= hi ? 'COMPLIANT' : 'NON-COMPLIANT';
      return { d, a, lo, hi, v, manual: manual !== null };
    });
    const wdA = num(wd.a), wdT = num(wd.then), wdN = num(wd.now);
    const wdFinal = wdA !== null && wdT !== null && wdN !== null ? wdA + (wdN - wdT) : null;
    const ao = num(anchor.o), aa = num(anchor.a), co2 = num(chain.o), ca = num(chain.a);
    const anchorMin = ao !== null ? ao * 0.88 : null;
    const chainMin = co2 !== null ? co2 * 0.9 : null;
    const anchorV: Verdict = aa !== null && anchorMin !== null ? (aa >= anchorMin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
    const chainV: Verdict = ca !== null && chainMin !== null ? (ca >= chainMin ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
    const rudderRes = (['Neck Bearing', 'Pintle Bearing'] as const).map((item, i) => {
      const d = num(rudder[i].d);
      const a = num(rudder[i].a);
      const mx = rudderMax(item, d);
      const v: Verdict = a !== null && mx !== null ? (a <= mx ? 'COMPLIANT' : 'NON-COMPLIANT') : '';
      return { item, d, a, mx, v };
    });
    // kapal tanpa penggerak: hanya jangkar dan rantai jangkar yang dinilai
    const all: Verdict[] = [...(propelled ? [...(showShaft ? shaftRes.map((x) => x.v) : []), ...(showRudder ? rudderRes.map((x) => x.v) : []), ...(showDmin ? dminRes.map((x) => x.v) : [])] : []), ...(showAnchor ? [anchorV, chainV] : [])];
    return { shaftRes, dminRes, wdFinal, anchorMin, chainMin, anchorV, chainV, rudderRes, measured: all.filter((v) => v !== '').length, fails: all.filter((v) => v === 'NON-COMPLIANT').length, total: all.length };
  }, [shaftSys, shaftCond, shafts, dmin, wd, anchor, chain, rudder, propelled, showShaft, showRudder, showAnchor, showDmin]);

  // ---- Simpan / buka agenda (Supabase) ----
  const snapshot = { name, agenda, vType, yearBuilt, expiry, annivD, annivM, extension, startDate, compDate, sel, notation, lastNo, recDue, recDone, recAssess, checks, shaftSys, propConn, openCfg, shaftPlan, shaftCond, shafts, dmin, wd, anchor, chain, rudder };
  const agendaSummary = {
    status: A.overall as string,
    scenario: A.c ? A.caseTitle[A.c] : null,
    surveys: SURVEYS.filter((x) => sel[x.key]).map((x) => x.key as string),
  };
  const restoreAgenda = (d: Record<string, unknown>) => {
    if (typeof d.name === 'string') setName(d.name);
    if (typeof d.agenda === 'string') setAgenda(d.agenda);
    // jenis kapal & tahun dibangun adalah data induk kapal: tidak ditimpa oleh agenda lama
    if (typeof d.expiry === 'string') setExpiry(d.expiry);
    setAnnivD(typeof d.annivD === 'number' ? d.annivD : null);
    setAnnivM(typeof d.annivM === 'number' ? d.annivM : null);
    if (typeof d.extension === 'string') setExtension(d.extension);
    if (typeof d.startDate === 'string') setStartDate(d.startDate);
    if (typeof d.compDate === 'string') setCompDate(d.compDate);
    if (d.sel && typeof d.sel === 'object') setSel(d.sel as Sel);
    // notasi jangkar & penggerak adalah data induk kapal: tidak ditimpa oleh agenda lama
    setLastNo(typeof d.lastNo === 'number' ? d.lastNo : null);
    if (typeof d.recDue === 'string') setRecDue(d.recDue);
    if (typeof d.recDone === 'string') setRecDone(d.recDone);
    if (typeof d.recAssess === 'string') setRecAssess(d.recAssess);
    if (d.checks && typeof d.checks === 'object') setChecks(d.checks as Record<string, string>);
    if (d.shaftSys === 'open' || d.shaftSys === 'oil' || d.shaftSys === 'fw') setShaftSys(d.shaftSys);
    if (d.shaftCond === 'new' || d.shaftCond === 'max') setShaftCond(d.shaftCond);
    if (d.propConn === 'flanged' || d.propConn === 'keyless' || d.propConn === 'keyed') setPropConn(d.propConn);
    if (d.openCfg === 'five' || d.openCfg === 'three') setOpenCfg(d.openCfg);
    if (typeof d.shaftPlan === 'string') setShaftPlan(d.shaftPlan as PlanKey | '');
    if (Array.isArray(d.shafts) && d.shafts.length > 0) setShafts((d.shafts as Partial<ShaftRow>[]).map((x) => ({ ...SHAFT0, ...x })));
    if (d.dmin && typeof d.dmin === 'object') setDmin({ ...DMIN0, ...(d.dmin as Partial<DminCfg>) });
    if (d.wd && typeof d.wd === 'object') setWd(d.wd as typeof wd);
    if (d.anchor && typeof d.anchor === 'object') setAnchor(d.anchor as typeof anchor);
    if (d.chain && typeof d.chain === 'object') setChain(d.chain as typeof chain);
    if (Array.isArray(d.rudder)) setRudder(d.rudder as typeof rudder);
    setTab(1);
  };

  const applyVessel = (v: ApplyValues) => {
    setName(v.name);
    if (v.type) setVType(v.type);
    if (v.yearBuilt) setYearBuilt(String(v.yearBuilt));
    if (v.expiry) {
      setExpiry(v.expiry);
      setAnnivD(v.annivD);
      setAnnivM(v.annivM);
      setLastNo(v.lastNo);
    }
    setPropelledFlag(v.propelled);
    setNotation(v.anchorNotation);
    setShaftSys(v.shaftSystem === 'oil' || v.shaftSystem === 'fw' ? v.shaftSystem : 'open');
    setPropConn(v.propConnection === 'flanged' || v.propConnection === 'keyless' || v.propConnection === 'keyed' ? v.propConnection : '');
    setOpenCfg(v.openConfig === 'five' || v.openConfig === 'three' ? v.openConfig : '');
    setStatusInfo(v.info ?? null);
    setStatusName(v.name);
  };

  // isian PER AGENDA (dikosongkan setelah agenda tersimpan / di-Finish dan saat berganti kapal)
  const clearAgenda = () => {
    setAgenda(''); setExtension(''); setStartDate(''); setCompDate('');
    setSel({ A1: false, A2: false, A3: false, A4: false, A5: false, INT: false, D1: false, REN: false, PS: false });
    setRecDue(''); setRecDone(''); setRecAssess(''); setChecks({});
    setShaftPlan(''); setShaftCond('max'); setShafts([SHAFT0]); setDmin(DMIN0); setWd({ a: '', then: '', now: '' });
    setAnchor({ o: '', a: '' }); setChain({ o: '', a: '' }); setRudder([{ d: '', a: '' }, { d: '', a: '' }]);
    setTab(1);
  };
  // DATA KAPAL (tahun dibangun, expiry, anniversary, jenis, dll.): terisi otomatis dari database saat kapal tersimpan dipilih
  const clearMaster = () => {
    setVType(''); setYearBuilt(''); setExpiry(''); setAnnivD(null); setAnnivM(null); setLastNo(null);
    setNotation(false); setPropelledFlag(null); setShaftSys('open'); setPropConn(''); setOpenCfg(''); setStatusInfo(null); setStatusName('');
  };
  // berganti ke kapal lain: isian agenda dan data kapal sebelumnya dikosongkan; data kapal baru dimuat otomatis bila ada di database
  const changeName = (n: string) => {
    const was = name.trim().toLowerCase();
    const loaded = statusName.trim().toLowerCase();
    if (loaded && was === loaded && n.trim().toLowerCase() !== loaded) {
      clearAgenda();
      clearMaster();
    }
    setName(n);
  };
  // setelah agenda tersimpan / di-Finish: semua isian dikosongkan; data kapal dimuat lagi otomatis saat nama kapal dipilih
  const clearAll = () => {
    clearAgenda();
    clearMaster();
    setName('');
  };

  // modul Propulsi hanya muncul untuk kapal bernotasi jangkar, saat Renewal atau Propeller Shaft Survey
  const dimActive = propActive;

  // survei yang sudah tercatat pada periode berjalan tidak ditawarkan lagi (hanya yang belum dikerjakan)
  const chipVisible = (k: SurveyKey) => {
    if (sel[k]) return true;
    if (k === 'A5' && !A.a5Applicable) return false;
    if (k === 'PS' && !propelled) return false;
    if (statusInfo) {
      if (k.length === 2 && k[0] === 'A' && Number(k[1]) <= statusInfo.annCount) return false;
      if (k === 'INT' && statusInfo.intDone) return false;
      if (k === 'D1' && statusInfo.dock1Done) return false;
    }
    return true;
  };
  const tabs: [1 | 2 | 3, string, string][] = [
    [1, 'Status', 'Validity class'],
    [2, 'Scope', 'Checklist survei'],
    ...(propActive ? ([[3, 'Propulsi', [showClear ? 'Clearance' : '', showDmin ? 'Dimensi minimum' : '', showAnchor ? 'Jangkar' : ''].filter(Boolean).join(' · ')]] as [1 | 2 | 3, string, string][]) : []),
  ];
  const shownTab = tab === 3 && !propActive ? 1 : tab;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-base font-bold tracking-tight sm:text-lg">RDK — Vessel Survey Status &amp; Class Scope</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden text-slate-300 sm:inline">{name || 'Kapal'} · {vType}</span>
            <Badge v={A.overall} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs.map(([k, a, b]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('shrink-0 rounded-lg px-4 py-2 text-left text-xs transition', tab === k ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800')}>
              <span className="block font-bold">{a}</span>
              <span className="block opacity-80">{b}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4">
        {shownTab === 1 && Module1()}
        {shownTab === 2 && Module2()}
        {shownTab === 3 && Module3()}
        <p className="pb-6 text-center text-[11px] text-slate-500">Alat bantu perhitungan; keputusan akhir mengacu pada aturan BKI dan penilaian Surveyor. · Versi 2026.10.18-a</p>
      </main>
    </div>
  );

    /* ====================================================================
   * MODUL 1 — ringkas: status besar dulu, input di bawah
   * ==================================================================== */
    function Module1() {
      const tone =
        A.overall === 'WITHDRAWN' ? 'from-red-600 to-red-700' : A.overall === 'SUSPENDED' ? 'from-amber-500 to-amber-600' : A.overall === 'VALID' ? 'from-emerald-600 to-emerald-700' : 'from-slate-500 to-slate-600';
      return (
        <>
          {/* ---------- HERO ---------- */}
          <section className={cx('rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg sm:p-6', tone)}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Class Validity</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{A.overall}</p>
            <p className="mt-3 text-sm font-semibold">
              {A.c ? A.caseTitle[A.c] : A.overall === 'INPUT REQUIRED' ? 'Lengkapi tanggal & pilih survei' : A.overall === 'VALID' ? 'Tidak ada skenario withdrawal' : 'Tidak ada skenario withdrawal (status SUSPENDED)'}
            </p>
            {A.c && <p className="mt-2 text-xs leading-relaxed opacity-90">{A.trigger[A.c]}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <span className="rounded-full bg-white/20 px-3 py-1">Scope: <b>{A.c ? A.scopeLbl[A.c] : 'Normal sesuai survei terpilih'}</b></span>
              <span className="rounded-full bg-white/20 px-3 py-1">Umur: <b>{A.age ?? '—'} th · {A.rnLabel}</b></span>
            </div>
          </section>
  
          {sel.INT && sel.REN && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              PERINGATAN: Intermediate dan Class Renewal tidak boleh dikreditkan bersamaan (termasuk thickness measurement). Pengecualian (ITS Part A 1.1.3): bila Intermediate dikerjakan lebih awal sebagai Annual in advance, scope-nya boleh dikreditkan ke Renewal.
            </p>
          )}
  
          {A.c && (
            <Card title="Lingkup Survei Reinstatement / Re-classification" sub="Otomatis dari skenario yang terdeteksi (ITS Part A 2.B.4.2)">
              <dl className="grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Survei yang harus dilakukan</dt>
                  <dd className="mt-1 font-semibold">{A.reinst[A.c][0]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500">Docking / Sertifikat</dt>
                  <dd className="mt-1 font-semibold">{A.reinst[A.c][1]}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {([['annual', 'Annual'], ['inter', 'Intermediate'], ['renewal', 'Renewal + Tangki/UT/Air Pipe'], ['docking', 'Docking'], ['shaft', 'Propeller Shaft'], ['machinery', 'Mesin & Utilitas']] as const)
                  .filter(([k]) => A.active[k] && (k !== 'annual' || A.c === 'A' || A.c === 'C' || A.c === 'D' || (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).some((x) => sel[x])))
                  .map(([k, l]) => <span key={k} className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{l}</span>)}
              </div>
              <button onClick={() => setTab(2)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Lihat detail scope &amp; checklist</button>
            </Card>
          )}
  
          <Fold title="Kapal & Survey Status" sub="Pilih kapal, lihat Last/Next tiap survei" open>
            <VesselStatus refreshKey={refreshKey} vesselName={name} onApply={applyVessel} />
          </Fold>
  
          <Fold title="Agenda & Riwayat" sub="Simpan hasil asesmen per nomor agenda" open>
            <AgendaPanel
              vesselName={name}
              vesselType={vType}
              yearBuilt={yearBuilt}
              agendaNo={agenda}
              start={startDate}
              completion={compDate}
              snapshot={snapshot}
              summary={agendaSummary}
              onRestore={restoreAgenda}
              onSaved={() => setRefreshKey((k) => k + 1)}
              anchorNotation={notation}
              propelled={propelledFlag}
              shaftSystem={shaftSys}
              onClear={clearAll}
            />
          </Fold>
  
          {/* ---------- INPUT ---------- */}
          <Card title="Data Kapal & Inspeksi">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Nama Kapal</span>
                <VesselNameInput className={inputCls} value={name} onChange={changeName} refreshKey={refreshKey} />
                <span className="mt-1 block text-[11px] leading-snug text-slate-500">Ketik untuk mencari atau ketuk daftar kapal tersimpan.</span>
              </div>
              <Field label="No. Agenda"><input className={inputCls} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></Field>
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Jenis Kapal</span>
                <VesselTypeSelect className={inputCls} value={vType} onChange={(v, info) => { setVType(v); setPropelledFlag(info?.propelled ?? null); }} />
              </div>
              <Field label="Year Built"><input className={inputCls} inputMode="numeric" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} /></Field>
              <Field label="Certificate Expiry">{dateIn(expiry, setExpiry)}</Field>
              <Field label="Inspection Start">{dateIn(startDate, setStartDate)}</Field>
              <Field label="Inspection Completion">{dateIn(compDate, setCompDate)}</Field>
              <Field label="Renewal terakhir selesai (ke-)" hint="Kosong = ikut umur kapal. Naik 1 tingkat bila periode melewati hitungan umur.">
                <input className={inputCls} inputMode="numeric" value={lastNo ?? ''} onChange={(e) => setLastNo(e.target.value === '' ? null : Number(e.target.value) || null)} />
              </Field>
              <Field label="Anniversary" hint={A.anniversaryAuto ? 'Otomatis dari expiry' : 'Diubah manual'}>
                <div className="flex gap-2">
                  <select className={inputCls} value={A.ad} onChange={(e) => setAnnivD(Number(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select className={inputCls} value={A.am} onChange={(e) => setAnnivM(Number(e.target.value))}>
                    {MON.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                {!A.anniversaryAuto && (
                  <button className="mt-1 text-[11px] font-semibold text-teal-700 underline" onClick={() => { setAnnivD(null); setAnnivM(null); }}>Kembali ke otomatis</button>
                )}
              </Field>
            </div>
  
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-slate-600">Lingkup survei yang dikerjakan (boleh lebih dari satu)</p>
              <div className="flex flex-wrap gap-2">
                {SURVEYS.filter((s) => chipVisible(s.key)).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSel((p) => ({ ...p, [s.key]: !p[s.key] }))}
                    className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', sel[s.key] ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}
                  >
                    {sel[s.key] ? '✓ ' : ''}{s.label.replace('Annual Survey — ', 'Annual ').replace('Renewal Survey + Docking 2', 'Renewal + Docking 2')}
                  </button>
                ))}
              </div>
              {statusInfo && <p className="mt-2 text-[11px] text-slate-500">Hanya survei yang belum dikerjakan pada periode ini yang ditampilkan. Untuk memilih survei yang sudah tercatat, hapus dulu pembaruan manual atau agendanya.</p>}
              {A.a5Applicable && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-[11px] text-sky-900">Annual 5 diperlukan: anniversary yang dipercepat membuat Annual ke-5 jatuh sebelum jendela Renewal (expiry − 3 bulan). Pilih Annual 5 untuk menilainya.</p>}
              <p className="mt-2 text-[11px] text-slate-500">
                Survei yang dicentang dinilai dengan tanggal inspeksi di atas. Annual/Intermediate setelahnya yang sudah lewat batas withdrawal otomatis dihitung terlewat; bila ≥ 2 Annual + Intermediate terlewat → Case C (scope Renewal).
              </p>
            </div>
  
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={notation} onChange={(e) => setNotation(e.target.checked)} className="h-4 w-4 accent-teal-600" />
                Notasi jangkar (menampilkan modul Propulsi: clearance dan dimensi saat Renewal)
              </label>
              {sel.REN && (
                <div className="w-56"><Field label="Approved Renewal Extension (opsional)">{dateIn(extension, setExtension)}</Field></div>
              )}
            </div>
          </Card>
  
          {/* ---------- STATUS PER SURVEI ---------- */}
          <Card title="Status per Survei" sub={`${fmt(A.st)} – ${fmt(A.co)}`}>
            {A.implied.length > 0 && (
              <ul className="mb-2 divide-y divide-slate-100 rounded-xl border border-red-200 bg-red-50 px-3">
                {A.implied.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-xs text-slate-600">Terlewat otomatis — window end {fmt(r.w?.end)}, batas withdrawal {fmt(A.limit(r.key))} sudah lewat.</p>
                    </div>
                    <Badge v="WITHDRAWN" />
                  </li>
                ))}
              </ul>
            )}
            {A.rows.length === 0 ? (
              <p className="text-sm text-slate-500">Pilih survei yang dikerjakan di atas.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {A.rows.map((r) => (
                  <li key={r.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-xs text-slate-500">
                        {r.key === 'D1' ? 'Maksimum 36 bulan dari Docking/Renewal terakhir — tanpa batas paling awal' : r.key === 'PS' ? 'Interval 5 tahun — dicatat di Survey Status' : <>Window {fmt(r.w?.start)} – {fmt(r.w?.end)}</>}
                        {r.key === 'PS' ? '' : r.key === 'D1' ? ` · batas ${fmt(r.w?.end)}` : r.key === 'REN' ? ` · withdrawal > ${fmt(A.limit('REN'))}` : ` · withdrawal > ${fmt(A.limit(r.key))}`}
                      </p>
                      {A.why(r) && <p className="mt-0.5 text-xs text-slate-600">{A.why(r)}</p>}
                    </div>
                    <Badge v={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
  
          {/* ---------- SIKLUS BARU ---------- */}
          {(A.newPeriod || A.shift?.shifted) && (
            <Card title="Anniversary & Siklus Sertifikat">
              {A.shift?.shifted && (
                <div className="mb-3 rounded-xl border border-teal-300 bg-teal-50 p-3 text-sm">
                  <p className="font-semibold">Anniversary bergeser</p>
                  <p className="text-xs">{A.shift.txt}</p>
                  <p className="mt-1 text-[11px] text-slate-600">Tersimpan otomatis ke Survey Status saat agenda ini di-Finish. Pilih ulang kapal setelahnya untuk memuat anniversary terbaru.</p>
                </div>
              )}
              {A.newPeriod && (
                <div className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><p className="text-xs text-slate-500">Class Period Baru</p><p className="font-semibold">{fmt(A.newPeriod.start)}</p></div>
                    <div><p className="text-xs text-slate-500">Expiry Baru</p><p className="font-semibold">{fmt(A.newPeriod.expiry)}</p></div>
                    <div><p className="text-xs text-slate-500">Anniversary Baru</p><p className="font-semibold">{fmtDM(A.newPeriod.ad, A.newPeriod.am)}</p></div>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{A.newPeriod.note}</p>
                </div>
              )}
            </Card>
          )}
  
          <Fold title="Dasar Aturan" sub="ITS Part A dan Nota Dinas BKI untuk hasil saat ini" open>
            {A.basis.length === 0 ? (
              <p className="text-sm text-slate-500">Pilih survei dan isi tanggal inspeksi untuk melihat dasar aturan yang berlaku.</p>
            ) : (
              <div className="space-y-3">
                {A.basis.map((k) => {
                  const b = BASIS[k];
                  if (!b) return null;
                  return (
                    <div key={k} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-bold">{b.title}</p>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ITS Part A / Rules</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-700">{b.its}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">Nota Dinas BKI 87/SVY/III/2020</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-700">{b.nd}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-slate-500">
                  ITS Part A bersumber dari Rules. Nota Dinas adalah penjelasan internal BKI untuk menyeragamkan penentuan status dan tanggal. Bila ragu, hubungi SM Mempertahankan Klas (Nota Dinas poin 7).
                </p>
              </div>
            )}
          </Fold>
  
          <Fold title="Recommendation (Case B)" sub="Opsional — isi bila ada recommendation" right={<Badge v={A.recSt} />}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Due Date">{dateIn(recDue, setRecDue)}</Field>
              <Field label="Actual Completion">{dateIn(recDone, setRecDone)}</Field>
              <Field label="Assessment Date" hint="Bila masih terbuka">{dateIn(recAssess, setRecAssess)}</Field>
            </div>
            <p className="mt-2 text-xs text-slate-500">Selesai setelah due date = SUSPENDED. Outstanding &gt; 6 bulan = WITHDRAWN. Penundaan rekomendasi hanya boleh 1 kali, hanya bila kapal tidak sedang dalam prosedur suspension, dan persetujuan akhir ada di BKI Pusat (ITS Part A Annex C).</p>
          </Fold>
  
          <Fold title="Referensi Aturan" sub="Time window dan Case A–D">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-2 pr-3">Rule</th><th className="pr-3">Window Start</th><th className="pr-3">Window End</th><th className="pr-3">Suspended</th><th>Withdrawn</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {RULES.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className={cx('py-2 pr-3', i === 0 && 'font-semibold')}>{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-2 pr-3">Case</th><th className="pr-3">Reinstatement</th><th>Docking / Sertifikat</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {CASES.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className={cx('py-2 pr-3', i === 0 && 'font-semibold')}>{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
          </Fold>
        </>
      );
    }
  
    /* ====================================================================
     * MODUL 2 — hanya scope yang aktif; item N/A / NONE disembunyikan
     * ==================================================================== */
    function Module2() {
      const age = A.age;
      const rn = A.rn ?? 4;
      const t = renewalTables(Math.min(rn, 4), age); // tabel scope: IV dan seterusnya memakai aturan yang sama
      const val = (id: string) => checks[id] ?? 'NOT CHECKED';
      const prog = (ids: string[]) => ({ total: ids.length, done: ids.filter((i) => val(i) !== 'NOT CHECKED').length, def: ids.filter((i) => val(i) === 'DEFICIENCY').length });
      const P = ({ ids }: { ids: string[] }) => {
        const p = prog(ids);
        return <Progress done={p.done} total={p.total} def={p.def} />;
      };
      const hiddenNote = (n: number) => n > 0 && <p className="mt-2 text-[11px] text-slate-400">{n} item tidak berlaku untuk {vType}/umur kapal — disembunyikan.</p>;
  
      const checklist = (id: string, items: Item[]) => {
        const all = items.map((it, i) => ({ it, id: `${id}-${i}`, ap: applicability(it.a, it.g, vType, age) }));
        const rows = all.filter((r) => r.ap !== 'N/A');
        return { rows, ids: rows.map((r) => r.id), hidden: all.length - rows.length };
      };
      const listOf = (rows: { it: Item; id: string; ap: string }[]) => (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <CheckRow key={r.id} title={r.it.s} desc={r.it.t} meta={[r.ap, r.it.n].filter(Boolean).join(' · ')} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />
          ))}
        </ul>
      );
      const tableList = (rows: TRow[]) => {
        const live = rows.filter((r) => !['NONE', 'N/A', '—'].includes(r.scope));
        return { live, ids: live.map((r) => r.id), hidden: rows.length - live.length };
      };
      const tblUi = (live: TRow[]) => (
        <ul className="divide-y divide-slate-100">
          {live.map((r) => <CheckRow key={r.id} title={r.item} chip={r.scope} meta={r.note} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />)}
        </ul>
      );
  
      const an = checklist('AN', ANNUAL);
      const inn = checklist('IN', INTERMEDIATE);
      const rnw = checklist('RN', RENEWAL);
      const dk = checklist('DK', DOCKING);
      const tank = tableList(t.tanks);
      const ut = tableList(t.ut);
      const air = tableList(t.air);
      const mach = MACHINERY.map((m, i) => ({ m, id: `M-${i}` })).filter((r) => r.m[3] !== 'N/A' || CARGO_SYSTEM_TYPES.includes(vType));
      const systems = Array.from(new Set(mach.map((r) => r.m[0])));
      const nothing = !Object.values(A.active).some(Boolean);
      // judul "Annual" hanya dipakai bila Annual memang dipilih atau pada kasus khusus (reinstatement A/C/D)
      const annualNamed = (['A1', 'A2', 'A3', 'A4', 'A5'] as SurveyKey[]).some((k) => sel[k]) || A.c === 'A' || A.c === 'C' || A.c === 'D';
  
      return (
        <>
          <Card title="Scope Aktif" sub={`${name || 'Kapal'} · ${vType} · ${age ?? '—'} th · ${A.rnLabel}`}
            right={<button onClick={() => setChecks({})} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Reset checklist</button>}>
            <div className="flex flex-wrap gap-2 text-xs">
              {nothing && <span className="text-slate-500">Pilih survei di tab Status.</span>}
              {([['annual', 'Annual'], ['inter', 'Intermediate'], ['renewal', 'Renewal'], ['docking', 'Docking'], ['shaft', 'Propeller Shaft'], ['machinery', 'Mesin & Utilitas']] as const)
                .filter(([k]) => A.active[k] && (k !== 'annual' || annualNamed))
                .map(([k, l]) => <span key={k} className="rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{l}</span>)}
            </div>
            {A.c && (
              <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-slate-700">
                <p className="font-bold">Reinstatement — {A.caseTitle[A.c]}</p>
                <p className="mt-1">{A.reinst[A.c][0]}</p>
                <p className="mt-1 font-semibold">{A.reinst[A.c][1]}</p>
              </div>
            )}
            {A.active.renewal && <p className="mt-3 text-xs text-slate-600">Tangki, UT, dan air pipe head dihitung otomatis dari Year Built {yearBuilt} dan expiry {fmt(A.exp)} → umur {age ?? '—'} tahun, <b>{A.rnLabel}</b>{A.rnBumped ? ` (naik karena Renewal sebelumnya ke-${roman(lastNo ?? 0)})` : ''}. Aturan scope tangki/UT mengikuti tabel &quot;IV dan seterusnya&quot; untuk Renewal IV ke atas.</p>}
            {sel.INT && sel.REN && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Intermediate & Renewal tidak boleh dikreditkan bersamaan.</p>}
          </Card>
  
          {A.active.annual && (
            <Fold
              title={annualNamed ? 'Annual Survey' : 'Pemeriksaan dasar'}
              sub={annualNamed ? 'Hull, safety, mesin, listrik, fire-fighting' : 'Cakupan Intermediate/Renewal memperluas pemeriksaan dasar ini. Annual yang belum dikerjakan tetap harus dikerjakan terpisah.'}
              right={<P ids={an.ids} />}
              open
            >
              {listOf(an.rows)}{hiddenNote(an.hidden)}
            </Fold>
          )}
          {A.active.inter && (
            <Fold title="Intermediate Survey" sub="Tambahan di atas Annual" right={<P ids={inn.ids} />} open>
              {listOf(inn.rows)}{hiddenNote(inn.hidden)}
            </Fold>
          )}
  
          {A.active.renewal && (
            <>
              <Fold title={`Renewal — Tangki (${A.rnLabel})`} sub="Pemeriksaan internal & pressure test" right={<P ids={tank.ids} />} open>
                {tblUi(tank.live)}{hiddenNote(tank.hidden)}
              </Fold>
              <Fold title={`Renewal — UT Thickness (${A.rnLabel})`} sub="Lokasi pengukuran minimum" right={<P ids={ut.ids} />} open>
                {tblUi(ut.live)}{hiddenNote(ut.hidden)}
              </Fold>
              <Fold title="Renewal — Air Pipe Heads" sub={`Umur ${age ?? '—'} tahun`} right={<P ids={air.ids} />} open>
                {tblUi(air.live)}
              </Fold>
              <Fold title="Renewal — Item Umum" sub="Hull, jangkar, struktur, sertifikat" right={<P ids={rnw.ids} />} open>
                {listOf(rnw.rows)}{hiddenNote(rnw.hidden)}
              </Fold>
            </>
          )}
  
          {A.active.shaft && (() => {
            const sv = shaftView(shaftSys, propConn, openCfg, shaftPlan);
            const plan = sv.plan ? PLANS[sv.plan] : null;
            const isExt = sv.plan === 'E25' || sv.plan === 'E1' || sv.plan === 'E3';
            const sid = (k: string) => `PS-${sv.plan}-${k}`;
            const qid = (k: string) => `PQ-${sv.plan}-${k}`;
            const ids = [...sv.scope.map((x) => sid(x.k)), ...sv.prereq.map((x) => qid(x.k))];
            const pill = (on: boolean) => cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', on ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500');
            const step = (n: number, t: string) => <p className="mb-2 mt-4 text-xs font-bold text-slate-700"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] text-white">{n}</span>{t}</p>;
            const ext = extensionRules(shaftSys);
            return (
              <Fold title="Propeller Shaft Survey" sub="Ikuti langkah 1–3; checklist menyesuaikan pilihan Anda" right={plan ? <P ids={ids} /> : undefined} open>
                {step(1, 'Sistem pelumasan poros')}
                <div className="flex flex-wrap gap-2">
                  {SHAFT_SYS.map(([k, l]) => <button key={k} onClick={() => setShaftSys(k)} className={pill(shaftSys === k)}>{l}</button>)}
                </div>

                {step(2, 'Tipe sambungan propeller')}
                <div className="flex flex-wrap gap-2">
                  {(['flanged', 'keyless', 'keyed'] as Conn[]).map((c) => <button key={c} onClick={() => setPropConn(c)} className={pill(propConn === c)}>{CONN_LABEL[c]}</button>)}
                </div>
                {shaftSys === 'open' && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">Konfigurasi poros (menentukan interval)</p>
                    <div className="space-y-2">
                      {(['five', 'three'] as OpenCfg[]).map((c) => (
                        <button key={c} onClick={() => setOpenCfg(c)} className={cx('block w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition', openCfg === c ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}>
                          {c === 'five' ? '5 tahun — ' : '3 tahun — '}{OPEN_CFG_LABEL[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-slate-700">
                  <p className="font-bold text-teal-900">{sv.intervalText}</p>
                  {sv.methods.length > 0 && <p className="mt-1">Method yang boleh dipakai: <b>{sv.methods.map((m) => PLANS[m].title).join(', ')}</b></p>}
                  {!propConn && <p className="mt-1">Pilih tipe sambungan propeller untuk melihat Method yang boleh dipakai.</p>}
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">{sv.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>

                {propConn && (
                  <>
                    {step(3, 'Yang dikerjakan pada survei ini')}
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Survei poros penuh</p>
                    <div className="flex flex-wrap gap-2">
                      {sv.methods.map((m) => <button key={m} onClick={() => setShaftPlan(m)} className={pill(sv.plan === m)}>{PLANS[m].title}</button>)}
                    </div>
                    <p className="mb-1 mt-3 text-[11px] font-semibold text-slate-500">Atau perpanjangan (extension)</p>
                    <div className="flex flex-wrap gap-2">
                      {sv.exts.map((m) => <button key={m} onClick={() => setShaftPlan(m)} className={pill(sv.plan === m)}>{PLANS[m].title}</button>)}
                    </div>
                    <details className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                      <summary className="cursor-pointer font-semibold">Apa itu extension?</summary>
                      <p className="mt-2 leading-relaxed">Extension adalah survei <b>ringan</b> untuk menunda jatuh tempo survei poros penuh, tanpa membongkar poros. Syaratnya prasyarat dokumen terpenuhi. Dilakukan sebaiknya dalam <b>1 bulan</b> dari tanggal jatuh tempo, dan masa perpanjangan dihitung dari tanggal jatuh tempo. Bila dilakukan lebih dari 1 bulan sebelum jatuh tempo, masa perpanjangan dihitung dari tanggal survei extension selesai.</p>
                      <ul className="mt-2 space-y-2">
                        {ext.map((e) => (
                          <li key={e.key} className="rounded-lg border border-slate-200 bg-white p-2">
                            <p className="font-semibold">{e.label}</p>
                            <p className="text-slate-600">{e.limit}</p>
                            {e.again !== '—' && <p className="text-slate-600">{e.again}</p>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}

                {plan && (
                  <div className="mt-4">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-bold">{plan.title}{isExt ? ' — extension' : ''}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{plan.brief}</p>
                    </div>
                    {sv.prereq.length > 0 && (
                      <>
                        <p className="mb-1 mt-4 text-xs font-bold text-slate-700">Prasyarat (harus terpenuhi dulu)</p>
                        <ul className="divide-y divide-slate-100">
                          {sv.prereq.map((x) => <CheckRow key={x.k} title={x.t} value={val(qid(x.k))} onChange={(v) => setCheck(qid(x.k), v)} />)}
                        </ul>
                      </>
                    )}
                    <p className="mb-1 mt-4 text-xs font-bold text-slate-700">Lingkup survei</p>
                    <ul className="divide-y divide-slate-100">
                      {sv.scope.map((x) => <CheckRow key={x.k} title={x.t} value={val(sid(x.k))} onChange={(v) => setCheck(sid(x.k), v)} />)}
                    </ul>
                  </div>
                )}
              </Fold>
            );
          })()}

          {A.active.docking && (
            <Fold title="Docking / Bottom Survey" sub="Interval maksimum 36 bulan" right={<P ids={dk.ids} />} open>
              {listOf(dk.rows)}{hiddenNote(dk.hidden)}
            </Fold>
          )}
  
          {A.active.machinery && (
            <Fold title="Class Renewal — Mesin & Utilitas" sub="Aktif otomatis saat Renewal / Case C / Case D" right={<P ids={mach.map((r) => r.id)} />} open>
              <div className="space-y-4">
                {systems.map((sys) => (
                  <div key={sys}>
                    <h3 className="text-xs font-bold text-slate-700">{sys}</h3>
                    <ul className="divide-y divide-slate-100">
                      {mach.filter((r) => r.m[0] === sys).map((r) => (
                        <CheckRow key={r.id} title={r.m[1]} meta={`${METHOD[r.m[2]]} · ${r.m[3] === 'N/A' ? 'IF FITTED' : r.m[3]}`} value={val(r.id)} onChange={(v) => setCheck(r.id, v)} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {hiddenNote(MACHINERY.length - mach.length)}
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                <p className="font-bold text-slate-700">Method / Source Notes</p>
                <p><b>Method 1:</b> Pemeriksaan visual dengan membuka sebagian/seluruhnya sesuai penilaian Surveyor; uji fungsi atau tekanan bila relevan.</p>
                <p><b>Method 2:</b> Pemeriksaan visual tanpa bongkar; performance test wajib; open-up bila dinilai perlu; verifikasi overhaul terakhir.</p>
                <p>(1) Fuel mencakup fuel oil, fuel gas, dan cairan low-flashpoint. (2) Lepas insulasi bila perlu untuk memudahkan inspeksi. (3) Sisi non-return valve dan pompa yang terpapar fluida korosif diperiksa dengan Method 1. (4) Exhaust gas hanya uji fungsi fan. (5) Inert gas berlaku apapun jenis gas/tujuan kecuali fire-fighting. (6) Gas turbine: verifikasi catatan overhaul onboard dan laporan general-overhaul; overhaul oleh OEM/OEM-authorized.</p>
              </div>
            </Fold>
          )}
        </>
      );
    }

      /* ====================================================================
   * MODUL 3 — hanya Renewal + notasi jangkar (berdiri sendiri)
   * ==================================================================== */
  function Module3() {
    if (!dimActive) return null; // tidak ada item pengukuran: modul disembunyikan
    const numIn = (v: string, set: (s: string) => void) => (
      <input inputMode="decimal" className={cx(inputCls, 'bg-yellow-50')} value={v} onChange={(e) => set(e.target.value)} />
    );
    const f2 = (v: number | null) => (v === null ? '—' : String(Number(v.toFixed(4))));
    const sum = S.measured === 0 ? 'BELUM DIUKUR' : S.fails > 0 ? 'NON-COMPLIANT' : 'COMPLIANT';
    const sysName = SHAFT_SYS.find((x) => x[0] === shaftSys)?.[1] ?? '';
    const setShaftRow = (i: number, k: keyof ShaftRow, v: string) => {
      setShafts((rows) =>
        rows.map((x, j) => {
          if (j !== i) return x;
          return { ...x, [k]: v };
        })
      );
    };

    return (
      <>
        <Card title="Ringkasan" sub={propelled ? 'Kapal berpenggerak: poros, rudder, jangkar, dan rantai jangkar' : 'Kapal tanpa penggerak: hanya jangkar dan rantai jangkar'} right={<Badge v={sum} big />}>
          <p className="text-sm">{S.measured} dari {S.total} item terukur · <b>{S.fails}</b> di luar kriteria.</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Status penggerak: {propelled ? 'berpenggerak' : 'tanpa penggerak'} ({propelledFlag === null ? `otomatis dari jenis kapal ${vType}` : 'diatur manual pada data kapal'}).
          </p>
        </Card>

        <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">
          {[
            showShaft ? 'clearance poros baling-baling' : '',
            showRudder ? 'rudder stock (neck & pintle)' : '',
            showDmin && propelled ? 'diameter minimum poros' : '',
            showAnchor ? 'berat jangkar dan diameter rantai jangkar' : '',
          ].filter(Boolean).join(' · ') || 'Tidak ada item yang diukur untuk survei dan jenis kapal ini'}
        </p>

        {propelled && (
          <>
            {showShaft && (
            <Card title="Poros Baling-baling (Propeller Shaft Clearance)" sub="Pilih sistem pelumasan; hanya aturan yang sesuai yang dipakai.">
              <div className="flex flex-wrap gap-2">
                {SHAFT_SYS.map(([k, l]) => (
                  <button key={k} onClick={() => setShaftSys(k)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold transition', shaftSys === k ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-500')}>
                    {l}
                  </button>
                ))}
              </div>
              {shaftSys !== 'fw' && (
                <div className="mt-3 max-w-xs">
                  <Field label="Kondisi pengukuran">
                    <select className={inputCls} value={shaftCond} onChange={(e) => setShaftCond(e.target.value as 'new' | 'max')}>
                      <option value="max">Dalam pemakaian (Maximum Clearance)</option>
                      <option value="new">Perakitan baru (New Assembly)</option>
                    </select>
                  </Field>
                </div>
              )}
              {shaftSys === 'fw' && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Closed loop fresh water: batas maksimum clearance mengikuti manual pabrikan (ITS Part A 1.10.3). Isi nilainya pada kolom di tiap poros.</p>}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {S.shaftRes.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">Poros {i + 1}</p>
                        <p className="text-xs text-slate-500">{sysName}</p>
                      </div>
                      <Badge v={r.v || 'BELUM DIUKUR'} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Diameter (mm)">{numIn(shafts[i].d, (v) => setShaftRow(i, 'd', v))}</Field>
                      <Field label="Actual (mm)">{numIn(shafts[i].a, (v) => setShaftRow(i, 'a', v))}</Field>
                    </div>
                    <div className="mt-3">
                      <Field
                        label={shaftSys === 'fw' ? 'Maksimum menurut manual pabrikan (mm) *' : 'Maks. menurut manual pabrikan (opsional)'}
                        hint={shaftSys === 'fw' ? undefined : 'Bila ada instruksi pabrikan, nilainya menggantikan batas Rules (ITS Part A 1.10.2).'}
                      >
                        {numIn(shafts[i].m ?? '', (v) => setShaftRow(i, 'm', v))}
                      </Field>
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      {r.hi === null
                        ? shaftSys === 'fw' ? 'Isi batas maksimum dari manual pabrikan.' : 'Isi diameter poros untuk melihat batas.'
                        : r.lo !== null
                        ? `Lower ${f2(r.lo)} · Upper ${f2(r.hi)} mm`
                        : `Maksimum ${f2(r.hi)} mm`}
                      {r.manual ? ' (manual pabrikan)' : ''}
                    </p>
                    <Gauge lo={r.lo} hi={r.hi} a={r.a} />
                    {shafts.length > 1 && (
                      <button onClick={() => setShafts((rows) => rows.filter((_, j) => j !== i))} className="mt-3 text-xs font-semibold text-red-700">Hapus poros ini</button>
                    )}
                  </div>
                ))}
              </div>
              {shafts.length < 4 && (
                <button onClick={() => setShafts((rows) => [...rows, SHAFT0])} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                  + Tambah poros (mis. twin screw)
                </button>
              )}
            </Card>
            )}

            {showDmin && (
            <Card title="Diameter Minimum Desain" sub="Formula (1) dan (2) Rules BKI: diameter aktual (da) harus ≥ diameter minimum (d)">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Jenis poros">
                  <select className={inputCls} value={dmin.kind} onChange={(e) => { const kind = e.target.value as ShaftKind; setDmin({ ...dmin, kind, kId: K_OPTS[kind][0].id }); }}>
                    <option value="prop">Propeller shaft</option>
                    <option value="inter">Intermediate shaft</option>
                    <option value="thrust">Thrust shaft</option>
                  </select>
                </Field>
                <Field label="Faktor k">
                  <select className={inputCls} value={dmin.kId} onChange={(e) => setDmin({ ...dmin, kId: e.target.value })}>
                    {K_OPTS[dmin.kind].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </Field>
                {dmin.kind !== 'prop' && (
                  <>
                    <Field label="Faktor F">
                      <select className={inputCls} value={dmin.f} onChange={(e) => setDmin({ ...dmin, f: e.target.value })}>
                        <option value="95">95 — turbin, diesel dengan hydraulic slip coupling, propulsi listrik</option>
                        <option value="100">100 — instalasi propulsi lainnya</option>
                      </select>
                    </Field>
                    <Field label="Material poros">
                      <select className={inputCls} value={dmin.mat} onChange={(e) => setDmin({ ...dmin, mat: e.target.value as 'cmn' | 'alloy' })}>
                        <option value="cmn">Carbon / carbon-manganese (Rm maks. 760)</option>
                        <option value="alloy">Alloy steel (Rm maks. 800)</option>
                      </select>
                    </Field>
                  </>
                )}
                <Field label={`Rm material (N/mm²) — maks. ${dmin.kind === 'prop' ? 600 : dmin.mat === 'alloy' ? 800 : 760}`} hint="Kosong = pakai batas Rules. Nilai di atas batas dipotong ke batas Rules.">
                  <input inputMode="decimal" className={cx(inputCls, 'bg-yellow-50')} value={dmin.rm} onChange={(e) => setDmin({ ...dmin, rm: e.target.value })} />
                </Field>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                Rules (Material B.1): Rm untuk menghitung faktor material Cw tidak boleh melebihi 600 N/mm² untuk propeller shaft (pengecualian perlu persetujuan khusus BKI), 760 untuk poros carbon / carbon-manganese selain propeller shaft, dan 800 untuk alloy steel selain propeller shaft. F propeller shaft = 100.
              </p>
              <div className="mt-4 space-y-3">
                {S.dminRes.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">Poros {i + 1} <span className="font-normal text-slate-500">· da = {shafts[i].d || '—'} mm</span></p>
                      <Badge v={r.v || 'BELUM DIUKUR'} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <Field label="Daya Pw (kW)">{numIn(shafts[i].p ?? '', (v) => setShaftRow(i, 'p', v))}</Field>
                      <Field label="Putaran n (rpm)">{numIn(shafts[i].n ?? '', (v) => setShaftRow(i, 'n', v))}</Field>
                      <Field label="Bore di (mm)">{numIn(shafts[i].b ?? '', (v) => setShaftRow(i, 'b', v))}</Field>
                    </div>
                    <p className="mt-3 text-sm">
                      Diameter minimum d: <b>{r.dmin === null ? '—' : `${r.dmin.toFixed(1)} mm`}</b>
                      {r.dmin !== null && r.da !== null && <span className="text-slate-600"> · selisih {(r.da - r.dmin >= 0 ? '+' : '') + (r.da - r.dmin).toFixed(1)} mm</span>}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">F = {r.F} · k = {r.k} · Rm = {r.rm} N/mm² · Cw = {r.cw.toFixed(3)}{r.capped ? ' · Rm dipotong ke batas Rules' : ''}</p>
                    {shafts[i].b && r.da !== null && num(shafts[i].b) !== null && (num(shafts[i].b) as number) / r.da <= 0.4 && <p className="mt-1 text-[11px] text-slate-500">Bore ≤ 0,4·da: suku bore dihitung 1,0.</p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">Pw = daya terukur motor penggerak (kerugian gear box dan bearing tidak dikurangi); n = putaran poros pada daya tersebut. Isi diameter poros pada kartu clearance di atas.</p>
            </Card>
            )}

            {showShaft && shaftSys === 'oil' && (
              <Card title="Clearance poros oil — dari wear-down gauge" sub="Poros tidak ditarik; piston acuan di TDC (ITS Part A 1.10.4)">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Actual clearance saat poros ditarik (mm)">{numIn(wd.a, (v) => setWd((x) => ({ ...x, a: v })))}</Field>
                  <Field label="Wear-down saat itu (mm)">{numIn(wd.then, (v) => setWd((x) => ({ ...x, then: v })))}</Field>
                  <Field label="Wear-down sekarang (mm)">{numIn(wd.now, (v) => setWd((x) => ({ ...x, now: v })))}</Field>
                </div>
                <p className="mt-3 text-sm">Clearance akhir: <b>{S.wdFinal === null ? '—' : `${f2(S.wdFinal)} mm`}</b></p>
                <p className="mt-1 text-[11px] text-slate-500">Clearance akhir = actual clearance saat poros ditarik + selisih nilai wear-down (sekarang − saat itu).</p>
                {S.wdFinal !== null && (
                  <button onClick={() => setShaftRow(0, 'a', String(Math.round((S.wdFinal as number) * 10000) / 10000))} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                    Pakai sebagai Actual pada Poros 1
                  </button>
                )}
              </Card>
            )}

            {showRudder && (
            <Card title="Rudder Stock Clearance" sub="Neck: min(0,01d + 2; 4). Pintle: d<50 → 3; 50–100 → 5; d>100 → min(0,01d + 4; 6)">
              <div className="grid gap-4 md:grid-cols-2">
                {S.rudderRes.map((r, i) => (
                  <div key={r.item} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between"><p className="text-sm font-bold">{r.item}</p><Badge v={r.v || 'BELUM DIUKUR'} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Diameter (mm)">{numIn(rudder[i].d, (v) => setRudder((s) => s.map((x, j) => (j === i ? { ...x, d: v } : x))))}</Field>
                      <Field label="Actual (mm)">{numIn(rudder[i].a, (v) => setRudder((s) => s.map((x, j) => (j === i ? { ...x, a: v } : x))))}</Field>
                    </div>
                    <p className="mt-3 text-sm">Maksimum: <b>{r.mx === null ? '—' : `${r.mx.toFixed(2)} mm`}</b></p>
                    <Gauge lo={null} hi={r.mx} a={r.a} />
                  </div>
                ))}
              </div>
            </Card>
            )}
          </>
        )}

        {showAnchor && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Anchor Weight" sub="Minimum 88% berat asli" right={<Badge v={S.anchorV || 'BELUM DIUKUR'} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Original (kg)">{numIn(anchor.o, (v) => setAnchor((x) => ({ ...x, o: v })))}</Field>
              <Field label="Actual (kg)">{numIn(anchor.a, (v) => setAnchor((x) => ({ ...x, a: v })))}</Field>
            </div>
            <p className="mt-3 text-sm">Minimum: <b>{S.anchorMin === null ? '—' : `${S.anchorMin.toFixed(1)} kg`}</b></p>
          </Card>
          <Card title="Anchor Chain Diameter" sub="Minimum 90% diameter asli" right={<Badge v={S.chainV || 'BELUM DIUKUR'} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Original (mm)">{numIn(chain.o, (v) => setChain((x) => ({ ...x, o: v })))}</Field>
              <Field label="Actual (mm)">{numIn(chain.a, (v) => setChain((x) => ({ ...x, a: v })))}</Field>
            </div>
            <p className="mt-3 text-sm">Minimum: <b>{S.chainMin === null ? '—' : `${S.chainMin.toFixed(2)} mm`}</b></p>
          </Card>
        </div>
        )}

        {showClear && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Data clearance rudder stock dan propeller shaft wajib dicantumkan pada survey report terkait (ITS Part A 1.9 dan 1.10.1).</p>}
      </>
    );
  }
}