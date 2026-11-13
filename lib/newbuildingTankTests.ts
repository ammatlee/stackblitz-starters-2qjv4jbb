/* Daftar uji Leak dan Structural per kompartemen. Hanya pencatatan:
   tidak mengubah status item Leak test/Structural test di Tahapan dan tidak masuk hitungan progress. */

   export type TestStatus = 'belum' | 'lulus' | 'tidak_lulus';
   export type StructStatus = TestStatus | 'tidak_perlu';
   export type LeakMethod = 'hose' | 'air' | 'vacuum' | 'hydro' | 'lainnya';
   
   export type TankTestRow = {
     id: string;
     name: string;
     leak_status: TestStatus;
     leak_method: LeakMethod | null;
     leak_date: string | null;
     struct_status: StructStatus;
     /** Tinggi uji yang dipakai, meter di atas top of tank. */
     struct_head: number | null;
     struct_date: string | null;
     note: string | null;
   };
   
   export const LEAK_STATUSES: TestStatus[] = ['belum', 'lulus', 'tidak_lulus'];
   export const STRUCT_STATUSES: StructStatus[] = ['belum', 'lulus', 'tidak_lulus', 'tidak_perlu'];
   export const LEAK_METHODS: LeakMethod[] = ['hose', 'air', 'vacuum', 'hydro', 'lainnya'];
   
   export const LEAK_STATUS_LABEL: Record<TestStatus, string> = { belum: 'Belum', lulus: 'Lulus', tidak_lulus: 'Tidak lulus' };
   export const STRUCT_STATUS_LABEL: Record<StructStatus, string> = { ...LEAK_STATUS_LABEL, tidak_perlu: 'Tidak perlu' };
   export const LEAK_METHOD_LABEL: Record<LeakMethod, string> = {
     hose: 'Hose test',
     air: 'Air test',
     vacuum: 'Vacuum box',
     hydro: 'Hidrostatik',
     lainnya: 'Lainnya',
   };
   
   export type TankSummary = {
     total: number;
     leakPass: number;
     /** Kompartemen yang wajib uji struktural (di luar yang ditandai tidak perlu). */
     structNeeded: number;
     structPass: number;
     failed: number;
   };
   
   export function summarizeTankTests(rows: { leak_status: TestStatus; struct_status: StructStatus }[]): TankSummary {
     const needed = rows.filter((r) => r.struct_status !== 'tidak_perlu');
     return {
       total: rows.length,
       leakPass: rows.filter((r) => r.leak_status === 'lulus').length,
       structNeeded: needed.length,
       structPass: needed.filter((r) => r.struct_status === 'lulus').length,
       failed: rows.filter((r) => r.leak_status === 'tidak_lulus' || r.struct_status === 'tidak_lulus').length,
     };
   }
   
   /** Angka meter dari ketikan, boleh memakai koma. null bila bukan angka atau negatif. */
   export function parseHead(v: string): number | null {
     const n = parseFloat(v.trim().replace(',', '.'));
     return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 100) / 100 : null;
   }
   
   export const tankSummaryText = (kind: 'leak' | 'struct', s: TankSummary): string =>
     kind === 'leak' ? `${s.leakPass} dari ${s.total} kompartemen lulus leak test` : `${s.structPass} dari ${s.structNeeded} lulus uji struktural`;
   