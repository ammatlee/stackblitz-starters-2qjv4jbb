import { describe, it, expect } from 'vitest';
import { sniffBytes, contentMatches } from '../lib/fileSniff';

const bytes = (...n: number[]) => new Uint8Array(n);

describe('sniffBytes', () => {
  it('mengenali PDF, JPEG, PNG, GIF, WEBP', () => {
    expect(sniffBytes(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('pdf');
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniffBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(sniffBytes(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('gif');
    expect(sniffBytes(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('webp');
  });
  it('menolak isi lain (mis. HTML atau exe yang diberi nama .pdf)', () => {
    expect(sniffBytes(new TextEncoder().encode('<html><script>'))).toBeNull();
    expect(sniffBytes(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    expect(sniffBytes(new Uint8Array(0))).toBeNull();
  });
  it('RIFF yang bukan WEBP (mis. WAV/AVI) ditolak', () => {
    expect(sniffBytes(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBeNull();
  });
});

describe('contentMatches', () => {
  it('cocok bila isi sesuai jenis yang diklaim', async () => {
    const pdf = new Blob([bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)]);
    expect(await contentMatches(pdf, 'application/pdf')).toBe(true);
    expect(await contentMatches(pdf, 'image/png')).toBe(false);
    expect(await contentMatches(new Blob(['hello']), 'application/pdf')).toBe(false);
    expect(await contentMatches(pdf, 'text/html')).toBe(false);
  });
});
