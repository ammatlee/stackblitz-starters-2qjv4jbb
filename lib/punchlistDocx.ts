/* Punchlist → file Word (.docx): tabel temuan per item, lalu lampiran foto dengan nomor dan keterangan.
   Library "docx" dimuat hanya saat tombol Unduh ditekan. Foto dikecilkan (maks. 900 px) supaya file tidak berat. */

   import { supabase } from './supabase';
   import { findingCode } from './newbuildingFindings';
   import { PHOTO_BUCKET, PHOTO_PHASE_LABEL, photoCode, sortPhotos } from './newbuildingPhotos';
   import type { PhotoPhase } from './newbuildingPhotos';
   import { dmy, photoRefs, punchTitle, punchlistCounts, punchlistSummaryText } from './punchlist';
   import type { PunchGroup } from './punchlist';
   
   export type DocImage = { data: Uint8Array; width: number; height: number };
   export type DocPhoto = { id: string; seq: number | null; phase: PhotoPhase; caption: string | null; image: DocImage | null };
   
   /** Unduh satu foto dari Storage dan kecilkan untuk dokumen. null bila gagal (foto itu ditulis "tidak dapat dimuat"). Hanya di peramban. */
   export async function loadDocImage(path: string, maxSide = 900, quality = 0.75): Promise<DocImage | null> {
     if (!supabase) return null;
     const dl = await supabase.storage.from(PHOTO_BUCKET).download(path);
     if (dl.error || !dl.data) return null;
     const url = URL.createObjectURL(dl.data);
     try {
       const img = await new Promise<HTMLImageElement>((res, rej) => {
         const i = new Image();
         i.onload = () => res(i);
         i.onerror = () => rej(new Error('gagal dibaca'));
         i.src = url;
       });
       const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
       const width = Math.max(1, Math.round(img.naturalWidth * k));
       const height = Math.max(1, Math.round(img.naturalHeight * k));
       const cv = document.createElement('canvas');
       cv.width = width;
       cv.height = height;
       const ctx = cv.getContext('2d');
       if (!ctx) return null;
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(0, 0, width, height);
       ctx.drawImage(img, 0, 0, width, height);
       const blob = await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/jpeg', quality));
       if (!blob) return null;
       return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
     } catch {
       return null;
     } finally {
       URL.revokeObjectURL(url);
     }
   }
   
   /** Ukuran foto di dokumen (piksel), menjaga perbandingan, maksimal 300 x 300. */
   export function fitImage(w: number, h: number, maxW = 300, maxH = 300): { width: number; height: number } {
     const k = Math.min(1, maxW / Math.max(1, w), maxH / Math.max(1, h));
     return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
   }
   
   export async function punchlistDocxBlob(o: { projectName: string; dateIso: string; groups: PunchGroup[]; photos: Record<string, DocPhoto[]> }): Promise<Blob> {
     const d = await import('docx');
     const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle, ImageRun, Footer, PageNumber, TableLayoutType } = d;
   
     type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
     const kids: Block[] = [];
   
     const para = (text: string, p: { bold?: boolean; italics?: boolean; size?: number; before?: number; after?: number; center?: boolean; keepNext?: boolean; pageBreakBefore?: boolean } = {}) =>
       new Paragraph({
         alignment: p.center ? AlignmentType.CENTER : undefined,
         keepNext: p.keepNext,
         pageBreakBefore: p.pageBreakBefore,
         spacing: { before: p.before ?? 0, after: p.after ?? 40 },
         children: [new TextRun({ text, bold: p.bold, italics: p.italics, size: p.size })],
       });
   
     const W = [1000, 2000, 4038, 1200, 1400]; // jumlah 9638 = lebar halaman A4 dikurangi margin
     const cell = (w: number, paras: InstanceType<typeof Paragraph>[], fill?: string) =>
       new TableCell({
         width: { size: w, type: WidthType.DXA },
         margins: { top: 60, bottom: 60, left: 90, right: 90 },
         shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
         children: paras,
       });
   
     const counts = punchlistCounts(o.groups);
     kids.push(para('PUNCHLIST', { bold: true, size: 30, center: true, after: 60 }));
     kids.push(para(o.projectName, { bold: true, size: 24, center: true, after: 60 }));
     kids.push(para(`Per ${dmy(o.dateIso)} · ${punchlistSummaryText(counts)}`, { size: 20, center: true, after: 200 }));
   
     if (counts.total === 0) kids.push(para('Tidak ada temuan.'));
   
     for (const g of o.groups) {
       kids.push(para(`${g.label} (${g.rows.length})`, { bold: true, size: 22, before: 240, after: 80, keepNext: true }));
       const head = ['No', 'Lokasi', 'Uraian temuan', 'Tgl temuan', 'Status'];
       const rows = [
         new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(W[i], [para(h, { bold: true, size: 18 })], 'E2E8F0')) }),
         ...g.rows.map((r) => {
           const ref = photoRefs(o.photos[r.id] ?? []);
           const desc = [para(r.description, { size: 18 })];
           if (r.note) desc.push(para(`Tindak lanjut: ${r.note}`, { italics: true, size: 16 }));
           const status = [para(r.status === 'open' ? 'Open' : 'Closed', { bold: true, size: 18 })];
           if (r.status === 'closed' && r.closed_date) status.push(para(dmy(r.closed_date), { size: 16 }));
           if (ref) status.push(para(`${ref} (lihat lampiran)`, { size: 16 }));
           return new TableRow({
             cantSplit: true,
             children: [
               cell(W[0], [para(findingCode(r.seq) || '-', { bold: true, size: 18 })]),
               cell(W[1], [para(r.location ?? '-', { size: 18 })]),
               cell(W[2], desc),
               cell(W[3], [para(dmy(r.found_date) || '-', { size: 18 })]),
               cell(W[4], status),
             ],
           });
         }),
       ];
       kids.push(new Table({ width: { size: 9638, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, rows }));
       kids.push(para('', { after: 0 }));
     }
   
     // Lampiran foto: hanya temuan yang punya foto, dua foto per baris
     const withPhotos = o.groups.flatMap((g) => g.rows).filter((r) => (o.photos[r.id] ?? []).length > 0);
     if (withPhotos.length > 0) {
       kids.push(para('LAMPIRAN FOTO', { bold: true, size: 24, after: 120, pageBreakBefore: true, keepNext: true }));
       const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
       const noBorders = { top: none, bottom: none, left: none, right: none };
       const photoCell = (ph: DocPhoto | undefined) => {
         const inner: InstanceType<typeof Paragraph>[] = [];
         if (ph) {
           if (ph.image) {
             const sz = fitImage(ph.image.width, ph.image.height);
             inner.push(new Paragraph({ spacing: { after: 40 }, children: [new ImageRun({ type: 'jpg', data: ph.image.data, transformation: sz })] }));
           } else {
             inner.push(para('(foto tidak dapat dimuat)', { italics: true, size: 16 }));
           }
           inner.push(para(`${photoCode(ph.seq)} · ${PHOTO_PHASE_LABEL[ph.phase]}`, { bold: true, size: 16, after: 0 }));
           if (ph.caption) inner.push(para(ph.caption, { size: 16, after: 0 }));
         } else {
           inner.push(new Paragraph({ children: [] }));
         }
         return new TableCell({ width: { size: 4819, type: WidthType.DXA }, borders: noBorders, margins: { top: 40, bottom: 80, left: 60, right: 60 }, children: inner });
       };
   
       for (const r of withPhotos) {
         kids.push(para(`${punchTitle(r)}: ${r.description}`, { bold: true, size: 20, before: 200, after: 80, keepNext: true }));
         const list = sortPhotos(o.photos[r.id] ?? []);
         const trs: InstanceType<typeof TableRow>[] = [];
         for (let i = 0; i < list.length; i += 2) trs.push(new TableRow({ cantSplit: true, children: [photoCell(list[i]), photoCell(list[i + 1])] }));
         kids.push(
           new Table({
             width: { size: 9638, type: WidthType.DXA },
             columnWidths: [4819, 4819],
             layout: TableLayoutType.FIXED,
             borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
             rows: trs,
           })
         );
         kids.push(para('', { after: 0 }));
       }
     }
   
     const doc = new Document({
       creator: 'Surveyor',
       title: `Punchlist ${o.projectName}`,
       styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
       sections: [
         {
           properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
           footers: {
             default: new Footer({
               children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${o.projectName} · Punchlist · hal. `, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })] })],
             }),
           },
           children: kids,
         },
       ],
     });
     return Packer.toBlob(doc);
   }
   