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
