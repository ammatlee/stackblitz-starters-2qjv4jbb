/**
 * Ekspor Dashboard Armada: CSV (dibuka di Excel) dan ICS (kalender). Fungsi murni kecuali downloadText.
 * Tanpa library tambahan.
 */
import type { FleetItem } from './fleet';
import { toDMY } from './surveyStatus';

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Teks dari pengguna (nama kapal, catatan) bisa diawali = + - @ dan dijalankan Excel sebagai rumus (CSV injection).
 * Diberi apostrof di depan supaya selalu dibaca sebagai teks.
 */
export const safeCell = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

const quote = (v: string | number): string => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export const CSV_HEAD = ['Kapal', 'Jenis', 'Sertifikat s/d', 'Survei', 'Window mulai', 'Batas', 'Sisa hari', 'Status', 'Catatan'];

/**
 * Satu baris per survei yang menunggu; kapal tanpa survei menunggu tetap muncul satu baris.
 * Pemisah titik koma + baris "sep=;" + BOM UTF-8 agar Excel (termasuk pengaturan regional Indonesia) membuka kolom dengan benar.
 */
export function fleetToCSV(items: FleetItem[]): string {
  const rows: (string | number)[][] = [];
  for (const it of items) {
    const base = [safeCell(it.name), safeCell(it.type), toDMY(it.expiry)];
    if (it.pending.length === 0) {
      rows.push([...base, '-', '', '', '', it.expiry ? 'Tidak ada survei menunggu' : 'Tanggal sertifikat belum diisi', '']);
      continue;
    }
    for (const p of it.pending) {
      rows.push([...base, safeCell(p.kind), toDMY(p.windowStart), toDMY(p.deadline), p.days, p.urgency, safeCell([p.note, p.warn].filter(Boolean).join(' | '))]);
    }
  }
  const lines = ['sep=;', CSV_HEAD.map(quote).join(';'), ...rows.map((r) => r.map(quote).join(';'))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d: Date) => iso(d).replace(/-/g, '');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// batas 75 karakter per baris (RFC 5545); lanjutan diawali satu spasi
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    out.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return out.join('\r\n');
}

/** Kalender: satu acara sehari penuh pada BATAS setiap survei yang menunggu, dengan pengingat 14 dan 7 hari sebelumnya. */
export function fleetToICS(items: FleetItem[], now: Date = new Date()): string {
  const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RDK//Class Validity//ID', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:RDK — Batas survei'];
  for (const it of items) {
    for (const p of it.pending) {
      const end = new Date(p.deadline.getTime() + 86400000);
      const desc = [it.type && `Jenis: ${it.type}`, p.windowStart && `Window mulai: ${toDMY(p.windowStart)}`, `Status: ${p.urgency}`, p.note, p.warn && `Peringatan: ${p.warn}`].filter(Boolean).join('\n');
      L.push(
        'BEGIN:VEVENT',
        `UID:${it.id}-${p.kind.replace(/[^A-Za-z0-9]+/g, '')}-${ymd(p.deadline)}@rdk`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;VALUE=DATE:${ymd(p.deadline)}`,
        `DTEND;VALUE=DATE:${ymd(end)}`,
        `SUMMARY:${icsText(`Batas ${p.kind} — ${it.name}`)}`,
        `DESCRIPTION:${icsText(desc)}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Batas ${p.kind} — ${it.name}`)}`, 'TRIGGER:-P14D', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Batas ${p.kind} — ${it.name}`)}`, 'TRIGGER:-P7D', 'END:VALARM',
        'END:VEVENT'
      );
    }
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/** Hanya di peramban: mengunduh teks sebagai file. */
export function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const exportStamp = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
