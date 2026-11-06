import { describe, it, expect } from 'vitest';
import { TEMPLATES, hasPlaceholder, htmlToText, stripImages } from '../lib/bulletinTemplates';

describe('template bulletin', () => {
  it('setiap template punya teks polos dan penanda isi', () => {
    for (const t of TEMPLATES) {
      expect(t.text.length).toBeGreaterThan(20);
      expect(t.text).not.toMatch(/<[a-z]/i);
      expect(hasPlaceholder(t.text)).toBe(true);
    }
  });
  it('id template unik dan jenis valid', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    TEMPLATES.forEach((t) => expect(['catatan', 'materi', 'pengingat', undefined]).toContain(t.kind));
  });
  it('penanda hilang setelah diisi', () => {
    expect(hasPlaceholder('Ringkasan sudah lengkap')).toBe(false);
    expect(hasPlaceholder('Isi [isi: poin 1] belum')).toBe(true);
  });
  it('htmlToText memisah blok dan melepas entitas', () => {
    expect(htmlToText('<h2>A &amp; B</h2><p>satu</p><ul><li><p>x</p></li></ul>')).toBe('A & B\nsatu\nx');
  });
  it('stripImages membuang gambar dan menghitungnya', () => {
    const r = stripImages('<p>a</p><img src="x.jpg"><img alt="y" src="z.png"/>');
    expect(r.html).toBe('<p>a</p>');
    expect(r.removed).toBe(2);
  });
});
