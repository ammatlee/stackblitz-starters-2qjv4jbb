import { describe, it, expect } from 'vitest';
import { fleetToCSV, fleetToICS, safeCell, CSV_HEAD } from '../lib/fleetExport';
import type { FleetItem, Pending } from '../lib/fleet';

const d = (s: string) => new Date(s + 'T00:00:00Z');
const pend = (o: Partial<Pending> = {}): Pending => ({ kind: 'Annual 2', urgency: 'DALAM WINDOW', deadline: d('2026-12-15'), days: 36, windowStart: d('2026-09-15'), ...o });
const item = (o: Partial<FleetItem> = {}): FleetItem => ({ id: 'v1', owner: 'u', name: 'KM Aquarius', type: 'Tug', expiry: d('2028-03-15'), pending: [pend()], next: pend(), ...o });

describe('safeCell', () => {
  it('menetralkan awalan rumus', () => {
    expect(safeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(safeCell('+1')).toBe("'+1");
    expect(safeCell('-x')).toBe("'-x");
    expect(safeCell('@cmd')).toBe("'@cmd");
    expect(safeCell('KM Biasa')).toBe('KM Biasa');
  });
});

describe('fleetToCSV', () => {
  it('berisi BOM, sep=; , header, dan satu baris per survei menunggu', () => {
    const csv = fleetToCSV([item({ pending: [pend(), pend({ kind: 'Intermediate', days: -3, urgency: 'OVERDUE', deadline: d('2026-11-06') })] })]);
    const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(lines[0]).toBe('sep=;');
    expect(lines[1]).toBe(CSV_HEAD.join(';'));
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe('KM Aquarius;Tug;15.03.2028;Annual 2;15.09.2026;15.12.2026;36;DALAM WINDOW;');
    expect(lines[3]).toContain(';-3;OVERDUE;'); // angka negatif tidak diberi apostrof
  });
  it('kapal tanpa survei menunggu tetap muncul', () => {
    const csv = fleetToCSV([item({ pending: [], next: null }), item({ id: 'v2', name: 'B', expiry: null, pending: [], next: null })]);
    expect(csv).toContain('Tidak ada survei menunggu');
    expect(csv).toContain('Tanggal sertifikat belum diisi');
  });
  it('nama berawalan rumus dan berisi titik koma / tanda kutip aman', () => {
    const csv = fleetToCSV([item({ name: '=HYPERLINK("x")', type: 'a;b' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a;b"');
  });
});

describe('fleetToICS', () => {
  const ics = fleetToICS([item()], new Date('2026-11-09T08:00:00Z'));
  it('membuat acara sehari penuh pada tanggal batas', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261215');
    expect(ics).toContain('DTEND;VALUE=DATE:20261216');
    expect(ics).toContain('DTSTAMP:20261109T080000Z');
    expect(ics).toContain('UID:v1-Annual2-20261215@rdk');
    expect(ics).toContain('TRIGGER:-P14D');
    expect(ics).toContain('TRIGGER:-P7D');
  });
  it('tidak ada baris lebih dari 75 karakter dan semua baris diakhiri CRLF', () => {
    const long = fleetToICS([item({ pending: [pend({ note: 'x'.repeat(300) })] })]);
    long.split('\r\n').forEach((l) => expect(l.length).toBeLessThanOrEqual(75));
    expect(long.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
  it('karakter khusus di-escape', () => {
    const e = fleetToICS([item({ name: 'A;B,C' })]);
    expect(e).toContain('SUMMARY:Batas Annual 2 — A\;B\\,C');
  });
  it('tanpa survei menunggu: kalender kosong yang valid', () => {
    const e = fleetToICS([item({ pending: [], next: null })]);
    expect(e).not.toContain('BEGIN:VEVENT');
  });
});
