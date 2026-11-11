import { describe, expect, it } from 'vitest';
import { drawingsFor } from '../lib/newbuildingDrawings';
import type { DrawingRow } from '../lib/newbuildingDrawings';
import { DRAWING_CSV_HEAD, drawingsToCSV, isoToDMY, slugName } from '../lib/drawingExport';

const list = drawingsFor('TUG');
const row = (key: string, p: Partial<DrawingRow>): [string, DrawingRow] => [key, { item_key: key, status: 'open', submit_date: null, done_date: null, rev: null, note: null, ...p }];

describe('Ekspor status gambar ke CSV', () => {
  it('bentuk berkas: sep, BOM, judul, header, dan satu baris per gambar', () => {
    const csv = drawingsToCSV('MT Contoh', 'TUG', list, new Map());
    const lines = csv.trim().split('\r\n');
    expect(csv.startsWith('﻿sep=;')).toBe(true);
    expect(lines[3]).toBe(DRAWING_CSV_HEAD.join(';'));
    expect(lines).toHaveLength(4 + list.length);
  });

  it('status, tanggal, revisi, dan catatan ikut ditulis', () => {
    const k = list[0].key;
    const csv = drawingsToCSV('X', 'TUG', list, new Map([row(k, { status: 'closed', submit_date: '2026-10-01', done_date: '2026-11-10', rev: 'Rev.1', note: 'Disetujui; lihat email' })]));
    const line = csv.split('\r\n').find((l) => l.startsWith(list[0].no + ';')) as string;
    expect(line).toContain(';Closed;01-10-2026;10-11-2026;Rev.1;"Disetujui; lihat email"');
  });

  it('gambar tanpa catatan berstatus Open; N/A dan "jika ada" ditandai', () => {
    const optional = list.find((d) => d.req === 'O') as (typeof list)[number];
    const csv = drawingsToCSV('X', 'TUG', list, new Map([row(list[1].key, { status: 'tidak_ada' })]));
    expect(csv).toContain(';N/A;');
    expect(csv.split('\r\n').find((l) => l.startsWith(optional.no + ';'))).toContain(';Tidak;Open;');
  });

  it('teks yang diawali = + - @ tidak dijalankan Excel sebagai rumus', () => {
    const csv = drawingsToCSV('=HYPERLINK("x")', 'TUG', list, new Map([row(list[0].key, { note: '=1+1', rev: '@cmd' })]));
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(";'=1+1");
    expect(csv).toContain(";'@cmd;");
  });

  it('tanggal dan nama berkas', () => {
    expect(isoToDMY('2026-11-10')).toBe('10-11-2026');
    expect(isoToDMY(null)).toBe('');
    expect(slugName('MT. Contoh / 1')).toBe('MT-Contoh-1');
    expect(slugName('???')).toBe('proyek');
  });
});
