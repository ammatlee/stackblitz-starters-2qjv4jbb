/* Rekap punchlist: pengelompokan temuan per item, hitungan, dan teks ringkas untuk disalin (mis. ke WhatsApp).
   Fungsi murni. Pembuatan file Word ada di lib/punchlistDocx.ts. */

   import { FINDING_ITEMS, GENERAL_KEY, findingCode, findingItemLabel } from './newbuildingFindings';
   import type { FindingRow } from './newbuildingFindings';
   
   /** Label status khusus rekap (salinan teks dan Word): seluruhnya berbahasa Indonesia, searah dengan tombol "Tutup temuan" / "Buka kembali".
   Label di layar daftar (Open/Closed) tidak diubah. */
export const RECAP_STATUS_LABEL: Record<'open' | 'closed', string> = { open: 'Terbuka', closed: 'Ditutup' };

/** Judul rekap, dipakai di salinan teks dan file Word. */
export const RECAP_TITLE = 'DAFTAR TEMUAN (PUNCHLIST)';

/** Kolom temuan yang dipakai rekap. */
   export type PunchRow = Pick<FindingRow, 'id' | 'item_key' | 'description' | 'location' | 'status' | 'found_date' | 'closed_date' | 'note' | 'seq'>;
   
   export type PunchGroup<T extends PunchRow = PunchRow> = { key: string; label: string; rows: T[] };
   
   /** 2026-11-13 → 13-11-2026; nilai yang bukan tanggal ISO ditampilkan apa adanya. */
   export const dmy = (iso: string | null | undefined): string => {
     const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
     return m ? `${m[3]}-${m[2]}-${m[1]}` : iso ?? '';
   };
   
   const groupKeyOf = (r: PunchRow): string => r.item_key ?? GENERAL_KEY;
   
   /** Kelompokkan per item Tahapan (urutan seperti daftar item, lalu item lain, Umum terakhir). Kelompok kosong dibuang.
       Dalam kelompok: Open dulu, lalu menurut nomor PL (tanpa nomor di akhir). includeClosed=false membuang temuan Closed. */
   export function groupPunchlist<T extends PunchRow>(rows: T[], includeClosed: boolean): PunchGroup<T>[] {
     const use = rows.filter((r) => includeClosed || r.status === 'open');
     const known = FINDING_ITEMS.map((i) => i.key);
     const keys: string[] = [];
     for (const k of known) if (use.some((r) => groupKeyOf(r) === k)) keys.push(k);
     for (const r of use) {
       const k = groupKeyOf(r);
       if (k !== GENERAL_KEY && !known.includes(k) && !keys.includes(k)) keys.push(k);
     }
     if (use.some((r) => groupKeyOf(r) === GENERAL_KEY)) keys.push(GENERAL_KEY);
   
     const order = (r: T) => (r.seq == null ? Number.MAX_SAFE_INTEGER : r.seq);
     return keys.map((k) => ({
       key: k,
       label: k === GENERAL_KEY ? 'Umum' : findingItemLabel(k),
       rows: use
         .map((r, i) => ({ r, i }))
         .filter((x) => groupKeyOf(x.r) === k)
         .sort((a, b) => {
           if (a.r.status !== b.r.status) return a.r.status === 'open' ? -1 : 1;
           const d = order(a.r) - order(b.r);
           return d !== 0 ? d : a.i - b.i;
         })
         .map((x) => x.r),
     }));
   }
   
   export function punchlistCounts(groups: PunchGroup[]): { open: number; closed: number; total: number } {
     let open = 0;
     let closed = 0;
     for (const g of groups) {
       for (const r of g.rows) {
         if (r.status === 'open') open += 1;
         else closed += 1;
       }
     }
     return { open, closed, total: open + closed };
   }
   
   /** Rujukan foto untuk satu temuan, mis. "Foto 1, 2, 5". Kosong bila tidak ada foto. */
   export function photoRefs(photos: { seq: number | null }[]): string {
     if (photos.length === 0) return '';
     const nums = photos.map((p) => p.seq).filter((n): n is number => n != null).sort((a, b) => a - b);
     const extra = photos.length - nums.length;
     const parts = nums.map(String);
     if (extra > 0) parts.push(`${extra} lainnya`);
     return `Foto ${parts.join(', ')}`;
   }
   
   /** Judul baris temuan di rekap: kode PL, lalu lokasi bila ada. */
   export const punchTitle = (r: PunchRow): string => [findingCode(r.seq), r.location ?? ''].filter((x) => x !== '').join(' · ') || 'Temuan';
   
   /** Ringkasan satu baris: "2 terbuka · 1 ditutup". Bagian "ditutup" tidak ditulis bila 0. */
   export function punchlistSummaryText(c: { open: number; closed: number }): string {
     return c.closed > 0 ? `${c.open} terbuka · ${c.closed} ditutup` : `${c.open} terbuka`;
   }
   
   /** Teks polos untuk disalin ke pesan. photos: nomor foto per id temuan. */
   export function punchlistText(o: { projectName: string; dateIso: string; groups: PunchGroup[]; photos: Record<string, { seq: number | null }[]> }): string {
     const c = punchlistCounts(o.groups);
     const lines: string[] = [`${RECAP_TITLE}: ${o.projectName}`, `Per ${dmy(o.dateIso)} · ${punchlistSummaryText(c)}`];
     for (const g of o.groups) {
       lines.push('', g.label.toUpperCase());
       for (const r of g.rows) {
         lines.push(`${punchTitle(r)}${r.status === 'closed' ? ` [${RECAP_STATUS_LABEL.closed}${r.closed_date ? ' ' + dmy(r.closed_date) : ''}]` : ''}`);
         lines.push(r.description);
         if (r.note) lines.push(`Tindak lanjut: ${r.note}`);
         const ref = photoRefs(o.photos[r.id] ?? []);
         if (ref) lines.push(ref);
       }
     }
     if (c.total === 0) lines.push('', 'Tidak ada temuan.');
     return lines.join('\n');
   }
   