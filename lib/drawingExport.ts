/**
 * Ekspor status gambar (pelacak gambar) ke CSV yang dibuka di Excel. Fungsi murni kecuali yang dipanggil dari peramban.
 * Memakai format yang sama dengan ekspor Dashboard Armada: titik koma, baris "sep=;", BOM UTF-8, dan perlindungan rumus.
 */
import { DRAWING_COL_LABEL, DRAWING_GROUP_LABEL } from './drawingList';
import type { DrawingCol } from './drawingList';
import { DRAWING_REQ_LABEL, DRAWING_STATUS_LABEL, countsInProgress, drawingProgress } from './newbuildingDrawings';
import type { Drawing, DrawingRowsLike, DrawingRow } from './newbuildingDrawings';
import { safeCell } from './fleetExport';

export const DRAWING_CSV_HEAD = ['No', 'Gambar / dokumen', 'Kelompok', 'Kewajiban', 'Syarat', 'Dihitung ke progress', 'Status', 'Tanggal diajukan', 'Tanggal closed', 'Revisi', 'Catatan'];

const quote = (v: string | number): string => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** 2026-11-10 → 10-11-2026; nilai yang bukan tanggal ISO ditampilkan apa adanya. */
export const isoToDMY = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso ?? '';
};

export function drawingsToCSV(projectName: string, col: DrawingCol, list: Drawing[], rows: ReadonlyMap<string, DrawingRow>): string {
  const prog = drawingProgress(list, rows as DrawingRowsLike);
  const body = list.map((d) => {
    const r = rows.get(d.key);
    return [
      d.no,
      safeCell(d.title),
      DRAWING_GROUP_LABEL[d.group],
      DRAWING_REQ_LABEL[d.req] + (d.code ? ` ${d.code}` : ''),
      safeCell(d.cond ?? ''),
      countsInProgress(d) ? 'Ya' : 'Tidak',
      DRAWING_STATUS_LABEL[r?.status ?? 'open'],
      isoToDMY(r?.submit_date),
      isoToDMY(r?.done_date),
      safeCell(r?.rev ?? ''),
      safeCell(r?.note ?? ''),
    ];
  });
  const lines = [
    'sep=;',
    quote(`Status gambar BKI: ${safeCell(projectName)}`),
    quote(`Daftar: ${DRAWING_COL_LABEL[col]}. Closed ${prog.closed} dari ${prog.total} (${prog.pct}%)`),
    DRAWING_CSV_HEAD.map(quote).join(';'),
    ...body.map((r) => r.map(quote).join(';')),
  ];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const slugName = (s: string): string => s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'proyek';
