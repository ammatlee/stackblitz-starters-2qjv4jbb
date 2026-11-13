import { describe, expect, it } from 'vitest';
import { PHOTO_BUCKET, PHOTO_CAPTION_MAX, checkPhotoFile, normalizeCaption, photoCode, photoPath, photoSummary, photoTitle, sortPhotos } from '../lib/newbuildingPhotos';

describe('Foto temuan', () => {
  it('kode foto dan rujukan lengkap', () => {
    expect(photoCode(2)).toBe('Foto 2');
    expect(photoCode(null)).toBe('Foto');
    expect(photoTitle(7, 2)).toBe('PL-007 / Foto 2');
    expect(photoTitle(null, 2)).toBe('Foto 2');
  });

  it('pemeriksaan file: hanya JPG, PNG, WEBP dan tidak terlalu besar', () => {
    expect(checkPhotoFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toBeNull();
    expect(checkPhotoFile({ type: 'IMAGE/PNG', size: 1000 })).toBeNull();
    expect(checkPhotoFile({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(checkPhotoFile({ type: 'image/gif', size: 1000 })).not.toBeNull();
    expect(checkPhotoFile({ type: 'application/pdf', size: 1000 })).not.toBeNull();
    expect(checkPhotoFile({ type: 'image/jpeg', size: 31 * 1024 * 1024 })).not.toBeNull();
  });

  it('lokasi berkas diawali id akun lalu proyek dan temuan', () => {
    expect(photoPath('u1', 'p1', 'f1', 'x')).toBe('u1/p1/f1/x.jpg');
    expect(PHOTO_BUCKET).toBe('newbuilding-photos');
  });

  it('keterangan: dipangkas, kosong jadi null, dibatasi panjangnya', () => {
    expect(normalizeCaption('  las retak  ')).toBe('las retak');
    expect(normalizeCaption('   ')).toBeNull();
    expect(normalizeCaption('a'.repeat(300))?.length).toBe(PHOTO_CAPTION_MAX);
  });

  it('urutan menurut nomor foto, tanpa nomor di akhir, stabil', () => {
    const rows = [
      { id: 'c', seq: null },
      { id: 'b', seq: 2 },
      { id: 'a', seq: 1 },
      { id: 'd', seq: null },
    ];
    expect(sortPhotos(rows).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('ringkasan jumlah foto per fase', () => {
    expect(photoSummary([])).toBe('');
    expect(photoSummary([{ phase: 'temuan' }])).toBe('1 foto (1 temuan)');
    expect(photoSummary([{ phase: 'temuan' }, { phase: 'perbaikan' }, { phase: 'temuan' }])).toBe('3 foto (2 temuan, 1 perbaikan)');
    expect(photoSummary([{ phase: 'perbaikan' }])).toBe('1 foto (1 perbaikan)');
  });
});
