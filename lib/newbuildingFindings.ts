/* Daftar temuan (punchlist) per proyek. Hanya pencatatan dan pengingat:
   tidak mengubah status item di Tahapan dan tidak masuk hitungan progress. */

   export type FindingStatus = 'open' | 'closed';

   export type FindingRow = {
     id: string;
     /** Kunci item Tahapan, mis. "fabrication.fitup". null = temuan umum. */
     item_key: string | null;
     description: string;
     /** Lokasi bebas: blok, frame, nama tangki. */
     location: string | null;
     status: FindingStatus;
     found_date: string | null;
     closed_date: string | null;
     note: string | null;
     /** Nomor urut per proyek (PL-001). Diisi otomatis oleh database. */
     seq: number | null;
     /** Temuan yang dibuat dari uji kompartemen: tangki dan jenis ujinya. null = dicatat manual. */
     source_tank_id: string | null;
     source_kind: 'leak' | 'struct' | null;
   };

   /** Kode temuan untuk dibaca dan dirujuk, mis. PL-007. Kosong bila nomor belum ada. */
   export const findingCode = (seq: number | null | undefined): string => (seq == null ? '' : `PL-${String(seq).padStart(3, '0')}`);
   
   export const FINDING_STATUSES: FindingStatus[] = ['open', 'closed'];
   export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = { open: 'Open', closed: 'Closed' };
   
   /** Item Tahapan yang bisa dikaitkan dengan temuan (semuanya di tahap Fabrication). */
   export const FINDING_ITEMS: { key: string; label: string }[] = [
     { key: 'fabrication.fitup', label: 'Fit up' },
     { key: 'fabrication.visual', label: 'Pemeriksaan visual' },
     { key: 'fabrication.leaktest', label: 'Leak test' },
     { key: 'fabrication.structtest', label: 'Structural test' },
   ];
   
   /** Kunci pengelompokan untuk temuan tanpa item. Tidak bentrok dengan kunci Tahapan (semuanya memakai titik). */
   export const GENERAL_KEY = 'umum';
   
   export const findingItemLabel = (key: string | null): string => (key == null ? 'Umum' : FINDING_ITEMS.find((i) => i.key === key)?.label ?? key);
   
   export type FindingSummary = {
     total: number;
     open: number;
     closed: number;
     /** Jumlah temuan Open per item; temuan tanpa item dihitung di GENERAL_KEY. */
     openByItem: Record<string, number>;
   };
   
   export function summarizeFindings(rows: { item_key: string | null; status: FindingStatus }[]): FindingSummary {
     const openByItem: Record<string, number> = {};
     let open = 0;
     for (const r of rows) {
       if (r.status !== 'open') continue;
       open += 1;
       const k = r.item_key ?? GENERAL_KEY;
       openByItem[k] = (openByItem[k] ?? 0) + 1;
     }
     return { total: rows.length, open, closed: rows.length - open, openByItem };
   }
   
   /** Open dulu, lalu yang terbaru di atas. Tanggal kosong dianggap paling lama. */
   export function sortFindings<T extends Pick<FindingRow, 'status' | 'found_date' | 'closed_date'>>(rows: T[]): T[] {
     const stamp = (r: T) => (r.status === 'open' ? r.found_date : r.closed_date ?? r.found_date) ?? '';
     return rows
       .map((r, i) => ({ r, i }))
       .sort((a, b) => {
         if (a.r.status !== b.r.status) return a.r.status === 'open' ? -1 : 1;
         const sa = stamp(a.r);
         const sb = stamp(b.r);
         if (sa !== sb) return sa < sb ? 1 : -1;
         return a.i - b.i;
       })
       .map((x) => x.r);
   }
   
   /** Teks pengingat singkat, mis. "3 temuan Open". */
   export const openFindingsText = (n: number): string => `${n} temuan Open`;
   
   /** Uraian otomatis temuan dari uji yang tidak lulus. detail = rincian hasil, mis. "3 titik bocor". */
   export const tankFindingDescription = (kind: 'leak' | 'struct', detail?: string | null): string =>
     (kind === 'leak' ? 'Leak test tidak lulus' : 'Structural test tidak lulus') + (detail ? `: ${detail}` : '');

   /** Isi awal temuan yang dibuat dari uji kompartemen yang tidak lulus. name = nama tampilan tangki (sudah dengan P/C/S). */
   export const tankFindingText = (name: string, kind: 'leak' | 'struct', detail?: string | null): { item_key: string; description: string; location: string } => ({
     item_key: kind === 'leak' ? 'fabrication.leaktest' : 'fabrication.structtest',
     description: tankFindingDescription(kind, detail),
     location: name,
   });
