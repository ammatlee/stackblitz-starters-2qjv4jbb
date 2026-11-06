// Template kerangka entri Bulletin dan bantuan untuk menggandakan entri.
// Bagian yang harus diisi penulis ditandai "[isi: ...]"; entri yang masih memuat tanda itu diberi peringatan saat disimpan.

export type BulletinTemplate = {
    id: string;
    label: string;
    hint: string;
    kind?: string; // mengisi kolom Jenis bila diberikan
    category?: string; // mengisi kolom Kategori bila diberikan; kosong = biarkan pilihan penulis
    html: string;
    text: string;
  };
  
  /** HTML sederhana -> teks polos (untuk kolom `body` yang dipakai pencarian dan cuplikan kartu). */
  export function htmlToText(html: string): string {
    return html
      .replace(/<\/p>(?=<\/(li|td|th|blockquote)>)/gi, '') // paragraf di dalam butir / sel / kutipan tidak memberi baris kosong
      .replace(/<\/(p|h[1-6]|li|blockquote|tr)>/gi, '\n')
      .replace(/<\/(td|th)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
  
  const PLACEHOLDER = /\[isi[:\s][^\]]*\]/i;
  export const hasPlaceholder = (text: string) => PLACEHOLDER.test(text || '');
  
  const p = (t: string) => '<p>' + t + '</p>';
  const ul = (items: string[]) => '<ul>' + items.map((t) => '<li><p>' + t + '</p></li>').join('') + '</ul>';
  const ol = (items: string[]) => '<ol>' + items.map((t) => '<li><p>' + t + '</p></li>').join('') + '</ol>';
  const h2 = (t: string) => '<h2>' + t + '</h2>';
  const h3 = (t: string) => '<h3>' + t + '</h3>';
  const note = (t: string) => '<blockquote><p>' + t + '</p></blockquote>';
  const table = (head: string[], rows: string[][]) =>
    '<table><tbody><tr>' + head.map((c) => '<th><p>' + c + '</p></th>').join('') + '</tr>' +
    rows.map((r) => '<tr>' + r.map((c) => '<td><p>' + c + '</p></td>').join('') + '</tr>').join('') +
    '</tbody></table>';
  
  const make = (t: Omit<BulletinTemplate, 'text'>): BulletinTemplate => ({ ...t, text: htmlToText(t.html) });
  
  export const TEMPLATES: BulletinTemplate[] = [
    make({
      id: 'catatan',
      label: 'Catatan singkat',
      hint: 'Ringkasan, poin penting, tindak lanjut',
      kind: 'catatan',
      category: 'Umum',
      html:
        h2('Ringkasan') + p('[isi: inti catatan dalam 1–2 kalimat]') +
        h3('Poin penting') + ul(['[isi: poin 1]', '[isi: poin 2]', '[isi: poin 3]']) +
        h3('Tindak lanjut') + p('[isi: apa yang perlu dilakukan, oleh siapa, dan kapan]'),
    }),
    make({
      id: 'aturan',
      label: 'Materi aturan',
      hint: 'Dasar aturan, isi ketentuan, penerapan, tanya-jawab',
      kind: 'materi',
      category: 'Regulasi',
      html:
        h2('Ringkasan') + p('[isi: inti ketentuan dalam 1–2 kalimat]') +
        h3('Dasar aturan') + p('[isi: nama dan nomor aturan, serta bagian atau pasal yang dirujuk]') +
        h3('Isi ketentuan') + p('[isi: penjelasan ketentuan]') +
        h3('Penerapan di lapangan') + ul(['[isi: contoh penerapan 1]', '[isi: contoh penerapan 2]']) +
        h3('Pertanyaan yang sering muncul') + ul(['[isi: pertanyaan dan jawabannya]']) +
        note('[isi: pengecualian atau catatan penting]'),
    }),
    make({
      id: 'prosedur',
      label: 'Prosedur langkah demi langkah',
      hint: 'Tujuan, persiapan, langkah bernomor, kesalahan umum',
      kind: 'materi',
      html:
        h2('Tujuan') + p('[isi: apa yang ingin dicapai]') +
        h3('Persiapan') + ul(['[isi: dokumen atau alat yang disiapkan]']) +
        h3('Langkah') + ol(['[isi: langkah 1]', '[isi: langkah 2]', '[isi: langkah 3]']) +
        h3('Hasil yang diharapkan') + p('[isi: tanda bahwa prosedur berhasil]') +
        note('[isi: kesalahan umum yang perlu dihindari]'),
    }),
    make({
      id: 'persiapan',
      label: 'Persiapan survei',
      hint: 'Jadwal, dokumen, tabel daftar pemeriksaan',
      kind: 'catatan',
      html:
        h2('Ringkasan') + p('[isi: jenis survei dan kapal]') +
        h3('Jadwal dan lokasi') + p('[isi: tanggal, tempat, pihak yang hadir]') +
        h3('Dokumen yang disiapkan') + ul(['[isi: dokumen 1]', '[isi: dokumen 2]']) +
        h3('Daftar pemeriksaan') +
        table(['Item', 'Status', 'Catatan'], [['[isi: item]', '', ''], ['[isi: item]', '', ''], ['[isi: item]', '', '']]) +
        h3('Catatan') + p('[isi: hal lain yang perlu diingat]'),
    }),
    make({
      id: 'tenggat',
      label: 'Pengingat tenggat',
      hint: 'Yang harus dilakukan, batas waktu, penanggung jawab',
      kind: 'pengingat',
      html:
        h2('Yang harus dilakukan') + p('[isi: tindakan yang harus selesai]') +
        h3('Batas waktu') + p('[isi: tanggal]  (isi juga "Tanggal pengingat" di panel Detail agar muncul di daftar pengingat)') +
        h3('Penanggung jawab') + p('[isi: nama atau bagian]') +
        h3('Catatan') + p('[isi: hal lain yang perlu diingat]'),
    }),
  ];
  
  /**
   * Bahan untuk entri hasil gandaan: gambar di isi dibuang karena file gambar milik entri asal
   * (bila entri asal dihapus atau gambarnya dibersihkan, salinan ikut rusak).
   */
  export function stripImages(html: string): { html: string; removed: number } {
    let removed = 0;
    const out = (html || '').replace(/<img\b[^>]*>/gi, () => {
      removed++;
      return '';
    });
    return { html: out, removed };
  }
  