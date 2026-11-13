/* Punchlist → file Word (.docx): tabel temuan per item, lalu lampiran foto dengan nomor dan keterangan.
   Library "docx" dimuat hanya saat tombol Unduh ditekan. Foto dipotong di tengah ke bingkai 4:3 supaya semuanya berukuran sama dan file tidak berat. Halaman landscape. */

   import { supabase } from './supabase';
   import { findingCode } from './newbuildingFindings';
   import { PHOTO_BUCKET, PHOTO_PHASE_LABEL, photoCode, sortPhotos } from './newbuildingPhotos';
   import type { PhotoPhase } from './newbuildingPhotos';
   import { RECAP_STATUS_LABEL, RECAP_TITLE, dmy, punchlistCounts, punchlistSummaryText } from './punchlist';
   import type { PunchGroup } from './punchlist';
   
   export type DocImage = { data: Uint8Array; width: number; height: number };
   export type DocPhoto = { id: string; seq: number | null; phase: PhotoPhase; caption: string | null; image: DocImage | null };
   
   /** Bingkai foto seragam (4:3). Piksel hasil unduh dan ukuran tampil di dokumen. */
   export const PHOTO_BOX = { width: 640, height: 480 };
   export const PHOTO_DOC_SIZE = { width: 228, height: 171 };
   
   /** Unduh satu foto dari Storage, lalu potong di tengah ke bingkai 4:3 (memenuhi bingkai), jadi semua foto berukuran sama. null bila gagal (foto itu ditulis "tidak dapat dimuat"). Hanya di peramban. */
   export async function loadDocImage(path: string, quality = 0.75): Promise<DocImage | null> {
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
       const { width, height } = PHOTO_BOX;
       const k = Math.max(width / Math.max(1, img.naturalWidth), height / Math.max(1, img.naturalHeight));
       const w = img.naturalWidth * k;
       const h = img.naturalHeight * k;
       const cv = document.createElement('canvas');
       cv.width = width;
       cv.height = height;
       const ctx = cv.getContext('2d');
       if (!ctx) return null;
       ctx.fillStyle = '#ffffff';
       ctx.fillRect(0, 0, width, height);
       ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
       const blob = await new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/jpeg', quality));
       if (!blob) return null;
       return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
     } catch {
       return null;
     } finally {
       URL.revokeObjectURL(url);
     }
   }
   
   export async function punchlistDocxBlob(o: { projectName: string; dateIso: string; groups: PunchGroup[]; photos: Record<string, DocPhoto[]> }): Promise<Blob> {
     const d = await import('docx');
     const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, ImageRun, Footer, PageNumber, TableLayoutType, PageOrientation } = d;
   
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
   
     const PAGE_W = 14570; // A4 landscape (16838) dikurangi margin kiri-kanan
     const hasPhotos = o.groups.some((g) => g.rows.some((r) => (o.photos[r.id] ?? []).length > 0));
     // Tanpa foto: lima kolom. Dengan foto: dua kolom foto di sebelah kanan Status.
     const W = hasPhotos ? [800, 1500, 2300, 1300, 1300, 3685, 3685] : [1300, 2700, 6670, 1700, 2200]; // jumlah = PAGE_W
     const cell = (w: number, paras: InstanceType<typeof Paragraph>[], fill?: string) =>
       new TableCell({
         width: { size: w, type: WidthType.DXA },
         margins: { top: 60, bottom: 60, left: 90, right: 90 },
         shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
         children: paras,
       });
   
     /** Sel foto satu tahap (kondisi temuan / setelah perbaikan); bila ada beberapa foto, ditumpuk. */
     const photoCell = (w: number, list: DocPhoto[]) => {
       const inner: InstanceType<typeof Paragraph>[] = [];
       if (list.length === 0) inner.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '-', size: 18, color: '94A3B8' })] }));
       list.forEach((ph, i) => {
         if (ph.image) inner.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: i > 0 ? 120 : 0, after: 40 }, children: [new ImageRun({ type: 'jpg', data: ph.image.data, transformation: PHOTO_DOC_SIZE })] }));
         else inner.push(para('(foto tidak dapat dimuat)', { italics: true, size: 16, center: true }));
         inner.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: photoCode(ph.seq), bold: true, size: 16 }), ...(ph.caption ? [new TextRun({ text: ` · ${ph.caption}`, size: 16 })] : [])] }));
       });
       return cell(w, inner);
     };
   
     const counts = punchlistCounts(o.groups);
     kids.push(para(RECAP_TITLE, { bold: true, size: 30, center: true, after: 60 }));
     kids.push(para(o.projectName, { bold: true, size: 24, center: true, after: 60 }));
     kids.push(para(`Per ${dmy(o.dateIso)} · ${punchlistSummaryText(counts)}`, { size: 20, center: true, after: 200 }));
   
     if (counts.total === 0) kids.push(para('Tidak ada temuan.'));
   
     for (const g of o.groups) {
       kids.push(para(`${g.label} (${g.rows.length})`, { bold: true, size: 22, before: 240, after: 80, keepNext: true }));
       const head = ['No.', 'Lokasi', 'Uraian temuan', 'Tanggal temuan', 'Status', ...(hasPhotos ? [`Foto ${PHOTO_PHASE_LABEL.temuan.toLowerCase()}`, `Foto ${PHOTO_PHASE_LABEL.perbaikan.toLowerCase()}`] : [])];
       const rows = [
         new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(W[i], [para(h, { bold: true, size: 18, center: i >= 5 })], 'E2E8F0')) }),
         ...g.rows.map((r) => {
           const list = sortPhotos(o.photos[r.id] ?? []);
           const desc = [para(r.description, { size: 18 })];
           if (r.note) desc.push(para(`Tindak lanjut: ${r.note}`, { italics: true, size: 16 }));
           const status = [para(RECAP_STATUS_LABEL[r.status], { bold: true, size: 18 })];
           if (r.status === 'closed' && r.closed_date) status.push(para(dmy(r.closed_date), { size: 16 }));
           return new TableRow({
             cantSplit: true,
             children: [
               cell(W[0], [para(findingCode(r.seq) || '-', { bold: true, size: 18 })]),
               cell(W[1], [para(r.location ?? '-', { size: 18 })]),
               cell(W[2], desc),
               cell(W[3], [para(dmy(r.found_date) || '-', { size: 18 })]),
               cell(W[4], status),
               ...(hasPhotos ? [photoCell(W[5], list.filter((x) => x.phase === 'temuan')), photoCell(W[6], list.filter((x) => x.phase === 'perbaikan'))] : []),
             ],
           });
         }),
       ];
       kids.push(new Table({ width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, rows }));
       kids.push(para('', { after: 0 }));
     }
   
     const doc = new Document({
       creator: 'Surveyor',
       title: `Daftar temuan ${o.projectName}`,
       styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
       sections: [
         {
           properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
           footers: {
             default: new Footer({
               children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${o.projectName} · Daftar temuan · hal. `, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })] })],
             }),
           },
           children: kids,
         },
       ],
     });
     return Packer.toBlob(doc);
   }
   