import { describe, expect, it } from 'vitest';
import { ALL_DOC_ITEMS, CERT_GATED, certGate, certItems, canDefer, formGroupOf, missingListText, resolveItem, summarizeCert } from '../lib/newbuildingCertDocs';
import type { CertCtx, CertInputs, DocStatus } from '../lib/newbuildingCertDocs';
import { STAGES, stageItemKey } from '../lib/newbuildingStages';
import { itemKey, trackerItems } from '../lib/materialTracker';
import { projectOverview } from '../lib/newbuildingOverview';

const TUG: CertCtx = { vesselType: 'Tugboat', propelled: true, loadLine: false, tipe: 'B' };
const BARGE: CertCtx = { vesselType: 'Barge', propelled: false, loadLine: false, tipe: 'C' };

const rowsOf = (m: Record<string, DocStatus>) => new Map(Object.entries(m).map(([k, status]) => [k, { status }]));
const inputs = (docs: Record<string, DocStatus> = {}, extra: Partial<CertInputs> = {}): CertInputs => ({ docRows: rowsOf(docs), matRows: new Map(), interimDone: false, ...extra });

/** Semua item material yang menentukan sertifikat material/komponen dan welding untuk ctx, ditandai diterima. */
function allMaterialDone(c: CertCtx) {
  const m = new Map<string, { status: 'diterima' }>();
  for (const it of trackerItems(c.tipe, false, { vesselType: c.vesselType, propelled: c.propelled })) m.set(itemKey(it), { status: 'diterima' });
  return m;
}

describe('Daftar dokumen: butir dan kunci', () => {
  it('kunci unik dan bentuknya stabil', () => {
    const keys = ALL_DOC_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('26 butir Lampiran PKBB semuanya ada di daftar (padanan: kick-off sampai corrosion protection)', () => {
    const keys = new Set(ALL_DOC_ITEMS.map((i) => i.key));
    for (const k of ['p.kickoff', 'p.keel', 'p.launch', 'p.itp', 'p.welder', 'p.wps', 'p.trace', 'p.ukur', 'p.laut', 'p.builder', 'p.ndt', 'p.iplt', 'p.keeldefl', 'p.maindim', 'l.consumable', 'p.compcert', 'l.antifouling', 'l.interim', 'p.log', 'l.patrol', 'l.shipyard', 'p.megger', 'p.crank', 'p.seatrial', 'p.align', 'l.corrosion']) {
      expect(keys.has(k)).toBe(true);
    }
  });
  it('butir yang boleh menyusul (foto) tidak wajib Interim; Grosse Akte, safety device, dan PNBP-nya masuk Permanent', () => {
    const by = (k: string) => ALL_DOC_ITEMS.find((i) => i.key === k)!;
    for (const k of ['p.keeldefl', 'p.maindim', 'p.align', 'p.crank', 'p.loadtest', 'p.megger', 'p.safety', 'p.seatrial', 'p.grosse', 'p.log']) expect(by(k).interim).toBe(false);
    for (const k of ['u.particulars', 'u.materials', 'u.photos', 'p.kickoff', 'p.shop', 'p.wps', 'p.welder', 'p.itp', 'p.keel', 'p.trace', 'p.compcert', 'p.ndt', 'p.iplt', 'p.launch', 'p.builder', 'p.ukur', 'p.laut']) expect(by(k).interim).toBe(true);
  });
});

describe('Grup form tambahan', () => {
  it('pemetaan jenis kapal ke grup', () => {
    expect(formGroupOf('Tugboat')).toBe('A');
    expect(formGroupOf('General Cargo')).toBe('B');
    expect(formGroupOf('SPOB')).toBe('B');
    expect(formGroupOf('Passenger Ship')).toBe('C');
    expect(formGroupOf('Oil Tanker')).toBe('D');
    expect(formGroupOf('Gas Carrier')).toBe('E');
    expect(formGroupOf('Pontoon')).toBe('PB');
    expect(formGroupOf('Barge')).toBe('PB');
    expect(formGroupOf('Bulk Carrier')).toBeNull();
    expect(formGroupOf('FSO / FPSO')).toBeNull();
    expect(formGroupOf(null)).toBeNull();
  });
  it('jenis buatan sendiri dikenali dari kata kuncinya', () => {
    expect(formGroupOf('Self Propelled Barge')).toBe('B');
    expect(formGroupOf('Tongkang batubara')).toBe('PB');
    expect(formGroupOf('Kapal penumpang cepat')).toBe('C');
  });
  const formCodes = (c: CertCtx) => certItems(c).filter((i) => i.groups).map((i) => i.code);
  it('grup A: 12 form; tanpa F21.2.29/30', () => {
    const f = formCodes({ ...TUG });
    expect(f).toHaveLength(12);
    expect(f).not.toContain('F21.2.29');
    expect(f).toContain('F21.2.25');
  });
  it('grup B: 14 form; grup C: 15 form (tambah F21.2.44)', () => {
    expect(formCodes({ ...TUG, vesselType: 'General Cargo' })).toHaveLength(14);
    const c = formCodes({ ...TUG, vesselType: 'Passenger Ship' });
    expect(c).toHaveLength(15);
    expect(c).toContain('F21.2.44');
  });
  it('grup D: 20 form termasuk F21.2.09/11/12/13/16/19; grup E: 16 form termasuk F21.2.10 dan F21.2.13', () => {
    const d = formCodes({ ...TUG, vesselType: 'Oil Tanker' });
    expect(d).toHaveLength(20);
    for (const c of ['F21.2.09', 'F21.2.11', 'F21.2.12', 'F21.2.13', 'F21.2.16', 'F21.2.19']) expect(d).toContain(c);
    const e = formCodes({ ...TUG, vesselType: 'Gas Carrier' });
    expect(e).toHaveLength(16);
    expect(e).toContain('F21.2.10');
    expect(e).toContain('F21.2.13');
    expect(e).not.toContain('F21.2.09');
  });
  it('pontoon/barge dan jenis tanpa grup: tidak ada form tambahan', () => {
    expect(formCodes(BARGE)).toHaveLength(0);
    expect(formCodes({ ...TUG, vesselType: 'Bulk Carrier' })).toHaveLength(0);
  });
});

describe('Penyaringan: load line dan penggerak', () => {
  it('tanpa permohonan load line: F23, BA tanda garis muat, dan PNBP disembunyikan', () => {
    const keys = certItems(TUG).map((i) => i.key);
    for (const k of ['u.statutory', 'u.llAssign', 'u.llSurvey', 'p.iplt']) expect(keys).not.toContain(k);
    const on = certItems({ ...TUG, loadLine: true }).map((i) => i.key);
    for (const k of ['u.statutory', 'u.llAssign', 'u.llSurvey', 'p.iplt']) expect(on).toContain(k);
  });
  it('kapal tanpa penggerak: alignment, crankshaft, safety device, sea trial disembunyikan; megger dan load test tetap (bisa N/A)', () => {
    const keys = certItems(BARGE).map((i) => i.key);
    for (const k of ['p.align', 'p.crank', 'p.safety', 'p.seatrial']) expect(keys).not.toContain(k);
    expect(keys).toContain('p.megger');
    expect(keys).toContain('p.loadtest');
    expect(summarizeCert(BARGE, inputs()).hidden).toBeGreaterThan(0);
  });
  it('tipe D (tanpa welding): butir welding shop, WPS, welder, consumable disembunyikan', () => {
    const keys = certItems({ ...TUG, tipe: 'D' }).map((i) => i.key);
    for (const k of ['p.shop', 'p.wps', 'p.welder', 'l.consumable']) expect(keys).not.toContain(k);
  });
});

describe('Status: satu centang berlaku untuk Interim dan Permanent', () => {
  it('Interim adalah bagian dari Permanent', () => {
    const s = summarizeCert(TUG, inputs());
    expect(s.permanent.total).toBeGreaterThan(s.interim.total);
    const interimKeys = s.items.filter((r) => r.item.interim).map((r) => r.item.key);
    for (const k of interimKeys) expect(s.items.some((r) => r.item.key === k)).toBe(true);
  });
  it('mencentang dokumen Interim menaikkan hitungan Interim dan Permanent sekaligus', () => {
    const a = summarizeCert(TUG, inputs());
    const b = summarizeCert(TUG, inputs({ 'u.particulars': 'ada' }));
    expect(b.interim.done).toBe(a.interim.done + 1);
    expect(b.permanent.done).toBe(a.permanent.done + 1);
  });
  it('N/A tidak dihitung ke total dan tidak dianggap kurang', () => {
    const a = summarizeCert(TUG, inputs());
    const b = summarizeCert(TUG, inputs({ 'p.megger': 'tidak_ada' }));
    expect(b.permanent.total).toBe(a.permanent.total - 1);
    expect(b.permanent.missing.some((r) => r.item.key === 'p.megger')).toBe(false);
  });
  it('Menyusul tetap dihitung kurang', () => {
    const s = summarizeCert(TUG, inputs({ 'p.grosse': 'menyusul' }));
    expect(s.permanent.missing.find((r) => r.item.key === 'p.grosse')?.status).toBe('menyusul');
    expect(canDefer(ALL_DOC_ITEMS.find((i) => i.key === 'p.grosse')!)).toBe(true);
    expect(canDefer(ALL_DOC_ITEMS.find((i) => i.key === 'p.kickoff')!)).toBe(false);
    expect(canDefer(ALL_DOC_ITEMS.find((i) => i.key === 'p.wps')!)).toBe(false);
  });
});

describe('Butir turunan dari pelacak material dan status Interim', () => {
  const by = (k: string) => ALL_DOC_ITEMS.find((i) => i.key === k)!;
  it('welding shop mengikuti pelacak material (item 85)', () => {
    const none = resolveItem(by('p.shop'), TUG, inputs());
    expect(none.status).toBe('belum');
    const ok = resolveItem(by('p.shop'), TUG, inputs({}, { matRows: new Map([['85', { status: 'diterima' as const }]]) }));
    expect(ok.status).toBe('ada');
    const na = resolveItem(by('p.shop'), TUG, inputs({}, { matRows: new Map([['85', { status: 'tidak_ada' as const }]]) }));
    expect(na.status).toBe('tidak_ada');
  });
  it('sertifikat material dan komponen lengkap bila semua item pelacak material Ada atau N/A', () => {
    const all = allMaterialDone(TUG);
    expect(resolveItem(by('p.compcert'), TUG, inputs({}, { matRows: all })).status).toBe('ada');
    const first = [...all.keys()].find((k) => k !== '85' && k !== '86' && k !== '87' && !k.startsWith('84'))!;
    all.delete(first);
    const r = resolveItem(by('p.compcert'), TUG, inputs({}, { matRows: all }));
    expect(r.status).toBe('belum');
    expect(r.detail).toMatch(/dari/);
  });
  it('tipe material belum diketahui (GT kosong): butir turunan Belum dengan petunjuk mengisi GT', () => {
    const r = resolveItem(by('p.compcert'), { ...TUG, tipe: null }, inputs());
    expect(r.status).toBe('belum');
    expect(r.detail).toMatch(/GT/);
  });
  it('data pelacak material tidak terbaca: butir turunan Belum', () => {
    const r = resolveItem(by('p.shop'), TUG, { docRows: new Map(), matRows: null, interimDone: false });
    expect(r.status).toBe('belum');
  });
  it('sertifikat sementara otomatis Ada saat Interim Selesai', () => {
    expect(resolveItem(by('l.interim'), TUG, inputs()).status).toBe('belum');
    expect(resolveItem(by('l.interim'), TUG, inputs({}, { interimDone: true })).status).toBe('ada');
  });
  it('N/A pilihan pengguna berlaku juga untuk butir turunan', () => {
    expect(resolveItem(by('p.compcert'), TUG, inputs({ 'p.compcert': 'tidak_ada' })).status).toBe('tidak_ada');
  });
});

/** Mengisi semua dokumen wajib Interim (manual) dan material. */
function fullInterim(c: CertCtx): CertInputs {
  const docs: Record<string, DocStatus> = {};
  for (const it of certItems(c)) if (it.interim && !it.derived) docs[it.key] = 'ada';
  return { docRows: rowsOf(docs), matRows: allMaterialDone(c) as CertInputs['matRows'], interimDone: false };
}

describe('Penjaga sertifikat', () => {
  it('hanya Interim dan Permanent yang dijaga; item lain bebas', () => {
    expect(CERT_GATED).toEqual(['certificate.interim', 'certificate.permanent']);
    expect(certGate('certificate.final', null, false)).toBeNull();
    expect(certGate('commencement.kickoff', null, false)).toBeNull();
  });
  it('item kunci benar-benar ada di daftar tahapan', () => {
    const keys = STAGES.flatMap((s) => s.items.map((it) => stageItemKey(s, it)));
    for (const k of CERT_GATED) expect(keys).toContain(k);
  });
  it('Interim terkunci selama ada dokumen wajib yang kurang, dan menyebut contohnya', () => {
    const g = certGate('certificate.interim', summarizeCert(TUG, inputs()), false);
    expect(g?.kind).toBe('docs');
    expect(g?.msg).toMatch(/Interim belum lengkap: masih kurang \d+/);
  });
  it('Interim terbuka bila semua dokumen wajib Interim Ada, walau dokumen yang boleh menyusul belum ada', () => {
    const s = summarizeCert(TUG, fullInterim(TUG));
    expect(s.interim.missing).toHaveLength(0);
    expect(s.permanent.missing.length).toBeGreaterThan(0);
    expect(certGate('certificate.interim', s, false)).toBeNull();
  });
  it('Permanent terkunci selama ada dokumen kurang (termasuk yang boleh menyusul dan form)', () => {
    const s = summarizeCert(TUG, fullInterim(TUG));
    const g = certGate('certificate.permanent', s, true);
    expect(g?.kind).toBe('docs');
  });
  it('Permanent: semua dokumen lengkap tetapi Final belum Selesai = terkunci (urutan)', () => {
    const inp = fullInterim(TUG);
    const docs = new Map(inp.docRows);
    for (const it of certItems(TUG)) if (!it.derived) docs.set(it.key, { status: 'ada' });
    const s = summarizeCert(TUG, { docRows: docs, matRows: inp.matRows, interimDone: true });
    expect(s.permanent.missing).toHaveLength(0);
    expect(certGate('certificate.permanent', s, false)).toEqual({ msg: 'Final survey report belum Selesai.', kind: 'order' });
    expect(certGate('certificate.permanent', s, true)).toBeNull();
  });
  it('Permanent terkunci bila Interim belum Selesai (sertifikat sementara kurang)', () => {
    const inp = fullInterim(TUG);
    const docs = new Map(inp.docRows);
    for (const it of certItems(TUG)) if (!it.derived) docs.set(it.key, { status: 'ada' });
    const s = summarizeCert(TUG, { docRows: docs, matRows: inp.matRows, interimDone: false });
    expect(s.permanent.missing.map((r) => r.item.key)).toEqual(['l.interim']);
    expect(certGate('certificate.permanent', s, true)?.kind).toBe('docs');
  });
  it('data dokumen belum terbaca: tetap terkunci', () => {
    expect(certGate('certificate.interim', null, false)?.msg).toMatch(/belum bisa dibaca/);
    expect(certGate('certificate.permanent', null, true)?.msg).toMatch(/belum bisa dibaca/);
  });
});

describe('Daftar kekurangan dan ringkasan proyek', () => {
  it('teks daftar kekurangan memuat Interim dulu, lalu tambahan Permanent tanpa mengulang', () => {
    const t = missingListText('MV Contoh', summarizeCert(TUG, inputs({ 'u.particulars': 'ada' })));
    expect(t).toMatch(/^Daftar dokumen yang masih kurang: MV Contoh/);
    expect(t).toMatch(/INTERIM: \d+\/\d+, kurang \d+/);
    expect(t).not.toMatch(/F21\.2\.07/); // sudah ada
    expect(t).toMatch(/Tambahan di luar Interim:/);
    const tail = t.split('Tambahan di luar Interim:')[1];
    expect(tail).not.toMatch(/Kick-off/);
  });
  it('proyek lengkap: teks menyatakan lengkap', () => {
    const inp = fullInterim(TUG);
    const docs = new Map(inp.docRows);
    for (const it of certItems(TUG)) if (!it.derived) docs.set(it.key, { status: 'ada' });
    const t = missingListText('X', summarizeCert(TUG, { docRows: docs, matRows: inp.matRows, interimDone: true }));
    expect(t).toMatch(/INTERIM: lengkap/);
    expect(t).toMatch(/PERMANENT: lengkap/);
  });
  it('ringkasan proyek memuat ringkasan dokumen; null bila tabel dokumen tidak terbaca', () => {
    const input = { vesselType: 'Tugboat', propelled: true, tipe: 'B' as const, fpAbove60: null, override: null };
    const o = projectOverview(input, new Map(), new Map(), { docRows: new Map(), matRows: new Map() });
    expect(o.cert?.permanent.total).toBeGreaterThan(0);
    expect(projectOverview(input, new Map(), new Map(), { docRows: null, matRows: null }).cert).toBeNull();
    expect(projectOverview(input, new Map(), new Map()).cert).toBeNull();
  });
  it('status Interim Selesai di tahapan ikut menghitung sertifikat sementara di ringkasan', () => {
    const input = { vesselType: 'Tugboat', propelled: true, tipe: 'B' as const, fpAbove60: null, override: null };
    const stage = new Map([['certificate.interim', { item_key: 'certificate.interim', status: 'selesai' as const, done_date: null, note: null }]]);
    const o = projectOverview(input, stage, new Map(), { docRows: new Map(), matRows: new Map() });
    expect(o.cert?.items.find((r) => r.item.key === 'l.interim')?.status).toBe('ada');
  });
});
