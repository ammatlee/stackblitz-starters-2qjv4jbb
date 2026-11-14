import { describe, it, expect } from 'vitest';
import { DRAWING_GATED, drawingGate } from '../lib/newbuildingStages';

describe('drawingGate — proyek tidak bisa selesai selama ada gambar Open', () => {
  it('persetujuan gambar terkunci bila masih ada gambar Open', () => {
    expect(drawingGate('drawing.disetujui', { open: 3, needFlashPoint: false })).toMatch(/3 gambar berstatus Open/);
  });
  it('terbuka bila semua gambar sudah Closed atau N/A', () => {
    expect(drawingGate('drawing.disetujui', { open: 0, needFlashPoint: false })).toBeNull();
  });
  it('tahap penyelesaian dan sertifikasi ikut terkunci', () => {
    for (const k of ['completion.completion', 'certificate.interim', 'certificate.final', 'certificate.permanent']) {
      expect(drawingGate(k, { open: 1, needFlashPoint: false })).not.toBeNull();
    }
  });
  it('item lain tidak terpengaruh', () => {
    expect(drawingGate('commencement.kickoff', { open: 5, needFlashPoint: false })).toBeNull();
    expect(drawingGate('drawing.diajukan', { open: 5, needFlashPoint: false })).toBeNull();
  });
  it('data gambar belum terbaca atau flash point kosong: tetap terkunci', () => {
    expect(drawingGate('drawing.disetujui', null)).toMatch(/belum bisa dibaca/);
    expect(drawingGate('drawing.disetujui', { open: 0, needFlashPoint: true })).toMatch(/Flash point/);
  });
  it('semua kunci yang dijaga benar-benar ada di daftar tahapan', async () => {
    const { STAGES, stageItemKey } = await import('../lib/newbuildingStages');
    const keys = STAGES.flatMap((s) => s.items.map((it) => stageItemKey(s, it)));
    for (const k of DRAWING_GATED) expect(keys.includes(k)).toBe(true);
  });
});

import { FINDING_GATED, findingGate } from '../lib/newbuildingFindings';

describe('findingGate — item Fabrication tidak bisa Selesai selama ada temuan Open', () => {
  it('terkunci bila ada temuan Open untuk item itu', () => {
    expect(findingGate('fabrication.leaktest', { 'fabrication.leaktest': 2 })).toMatch(/2 temuan Open untuk item ini/);
  });
  it('temuan item lain tidak mengunci item ini', () => {
    expect(findingGate('fabrication.fitup', { 'fabrication.leaktest': 2 })).toBeNull();
  });
  it('temuan umum mengunci semua item Fabrication', () => {
    for (const k of FINDING_GATED) expect(findingGate(k, { umum: 1 })).toMatch(/temuan umum/);
  });
  it('tanpa temuan Open: boleh', () => {
    expect(findingGate('fabrication.visual', {})).toBeNull();
  });
  it('item di luar Fabrication tidak dijaga (hanya pengingat)', () => {
    expect(findingGate('keel.keel', { umum: 4 })).toBeNull();
  });
  it('daftar temuan belum terbaca: tetap terkunci', () => {
    expect(findingGate('fabrication.fitup', null)).toMatch(/belum bisa dibaca/);
  });
});
