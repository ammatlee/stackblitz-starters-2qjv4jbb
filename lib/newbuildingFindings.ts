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
     /** Nomor versi untuk penguncian edit bersamaan (sql/nb_versi_edit.sql). Tidak ada bila SQL itu belum dijalankan. */
     version?: number;
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
   
   /** Item Tahapan yang tidak boleh ditandai Selesai/N/A selama masih ada temuan Open (untuk item itu, atau temuan umum). */
   export const FINDING_GATED = FINDING_ITEMS.map((i) => i.key);

   /** Pesan alasan bila item ini belum boleh Selesai/N/A karena temuan; null bila boleh. openByItem null = daftar temuan belum bisa dibaca. */
   export function findingGate(itemKey: string, openByItem: Record<string, number> | null): string | null {
     if (!FINDING_GATED.includes(itemKey)) return null;
     if (openByItem === null) return 'Daftar temuan belum bisa dibaca, jadi item ini belum bisa diselesaikan. Muat ulang halaman.';
     const own = openByItem[itemKey] ?? 0;
     if (own > 0) return `Masih ada ${own} temuan Open untuk item ini. Tutup (Closed) di daftar temuan dulu.`;
     const general = openByItem[GENERAL_KEY] ?? 0;
     if (general > 0) return `Masih ada ${general} temuan umum Open. Tutup (Closed) di daftar temuan dulu.`;
     return null;
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
