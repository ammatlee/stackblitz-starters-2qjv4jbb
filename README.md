# RDK — Class Validity

Aplikasi web untuk memantau status kelas kapal (BKI Circular 15-SV-095): jendela waktu survei, reinstatement, scope & checklist,
dashboard armada, agenda/kunjungan survei, memo, dan Bulletin. Next.js 13 (static export) + Tailwind + Supabase. Bisa dipasang sebagai PWA dan
membaca data terakhir tanpa sinyal.

## Menjalankan

```bash
npm ci
cp .env.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:3000
```

Tanpa variabel Supabase, aplikasi berjalan dalam **mode demo** (tanpa login, tanpa penyimpanan).

| Perintah | Fungsi |
| --- | --- |
| `npm test` | Tes logika (vitest) |
| `npm run typecheck` | Tipe kode aplikasi dan kode tes |
| `npm run lint` | ESLint |
| `npm run build` | Build statis ke `out/` |

CI (`.github/workflows/ci.yml`) menjalankan tes, tipe, lint, dan build pada setiap push/PR.

## Struktur

- `app/` — halaman: `/` menu, `/fleet` dashboard armada, `/class-validity`, `/bulletin`, `/audit`, `/admin`, `/login`.
- `lib/classValidity/` — aturan dan perhitungan murni (tanpa React/Supabase): `surveyRules`, `statusCalc`, `propulsiCalc`.
- `lib/surveyStatus.ts`, `lib/fleet.ts` — status survei per kapal dan ringkasan armada (satu sumber angka untuk semua halaman).
- `lib/offlineFetch.ts`, `public/sw.js` — cache bacaan data (IndexedDB) dan halaman (service worker). Perubahan data tetap butuh sinyal.
- `lib/optimisticLock.ts` — mencegah dua orang saling menimpa (kolom `version`).
- `lib/backup.ts`, `lib/restore.ts` — cadangan dan pemulihan JSON.
- `lib/uploads.ts`, `lib/fileSniff.ts` — unggah lampiran/gambar; isi file diperiksa, bukan hanya ekstensinya.
- `components/` — UI; `components/classValidity/` untuk modul tab Class Validity.

## Prinsip yang dijaga

1. **Data tidak lengkap tidak boleh menghasilkan status survei.** Bila kapal, agenda selesai, atau pembaruan manual gagal dibaca,
   dashboard menampilkan galat, bukan angka dari data kosong.
2. **Tabel besar dibaca dengan paging** (`fetchAllRows`), karena Supabase memotong hasil diam-diam di sekitar 1.000 baris.
3. **Aturan survei ditulis di satu tempat** (`lib/classValidity/surveyRules.ts`) dan dijaga tes. Tambah kasus nyata yang sudah
   diverifikasi ke `REAL_CASES` di `tests/fixtures/cases.ts` setiap kali aturan diubah.

## Deploy

Hosting statis (Cloudflare Pages). Isi variabel lingkungan di dashboard hosting. Header keamanan (CSP, dll.) ada di `public/_headers`.
Database, RLS, dan bucket Storage (`bulletin-files`, `bulletin-private`) dikelola di Supabase.
