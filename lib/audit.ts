/** Riwayat perubahan: mengubah baris audit_log menjadi kalimat yang mudah dibaca. Fungsi murni. */
import { SHAFT_PLAN_OPTS } from './shaftPlans';

export type AuditRow = {
  id: number;
  at: string;
  actor: string | null;
  actor_email: string | null;
  tbl: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  vessel_id: string | null;
  vessel_name: string | null;
  owner: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const LABEL: Record<string, string> = {
  name: 'Nama kapal',
  vessel_type: 'Jenis kapal',
  year_built: 'Tahun dibangun',
  cert_expiry: 'Expiry sertifikat',
  anniv_day: 'Anniversary (hari)',
  anniv_month: 'Anniversary (bulan)',
  last_renewal_no: 'Renewal terakhir ke-',
  last_special: 'Special Survey terakhir',
  last_annual: 'Annual terakhir',
  last_annual_no: 'Annual terakhir ke-',
  last_intermediate: 'Intermediate terakhir',
  last_docking: 'Docking terakhir',
  last_shaft: 'Propeller Shaft terakhir',
  last_shaft_plan: 'Method poros terakhir',
  last_shaft_major: 'Method 1/2 terakhir (batas 15 tahun)',
  shaft_exts: 'Extension poros',
  shaft_plan: 'Method / extension poros',
  postponed_until: 'Postponed s/d',
  propelled: 'Penggerak',
  anchor_notation: 'Notasi jangkar',
  shaft_system: 'Sistem pelumasan poros',
  prop_connection: 'Sambungan propeller',
  open_config: 'Konfigurasi poros open',
  surveys: 'Survei',
  completion: 'Tanggal selesai',
  agenda_no: 'Nomor agenda',
  inspection_start: 'Inspeksi mulai',
  inspection_completion: 'Inspeksi selesai',
  status: 'Status agenda',
  scenario: 'Skenario',
  finished: 'Ditandai selesai',
  finished_at: 'Waktu ditandai selesai',
};
const HIDDEN = new Set(['id', 'owner', 'vessel_id', 'created_at', 'updated_at', 'baseline_at', 'data']);
const SURVEY_NAME: Record<string, string> = { PS: 'Propeller Shaft', A1: 'Annual 1', A2: 'Annual 2', A3: 'Annual 3', A4: 'Annual 4', A5: 'Annual 5', INT: 'Intermediate', D1: 'Docking', REN: 'Renewal + Docking 2' };
const EXT_NAME: Record<string, string> = { E25: '2,5 tahun', E1: '1 tahun', E3: '3 bulan' };
const SHAFT_SYS: Record<string, string> = { open: 'Open loop', oil: 'Closed loop — oil', fw: 'Closed loop — fresh water' };

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function fmtVal(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    const names = key === 'surveys' ? SURVEY_NAME : key === 'shaft_exts' ? EXT_NAME : null;
    return v.map((x) => (names ? names[String(x)] ?? String(x) : String(x))).join(', ');
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return dmy(v);
    if (key === 'shaft_system') return SHAFT_SYS[v] ?? v;
    if (key === 'last_shaft_plan' || key === 'shaft_plan') return SHAFT_PLAN_OPTS.find((o) => o[0] === v)?.[1] ?? v;
    return v;
  }
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

export type ChangeLine = { label: string; from?: string; to?: string };

export function describeAudit(r: AuditRow): { title: string; lines: ChangeLine[] } {
  // [dibuat, diubah, dihapus] menurut tabelnya; tabel lain dianggap pembaruan manual
  const T: Record<string, [string, string, string]> = {
    vessels: ['Kapal dibuat', 'Data kapal diubah', 'Kapal dihapus'],
    agendas: ['Agenda dibuat', 'Agenda diubah', 'Agenda dihapus'],
  };
  const t = T[r.tbl] ?? ['Pembaruan manual ditambahkan', 'Pembaruan manual diubah', 'Pembaruan manual dihapus'];
  const title = r.op === 'INSERT' ? t[0] : r.op === 'DELETE' ? t[2] : t[1];

  const keys = (d: Record<string, unknown> | null) => Object.keys(d ?? {}).filter((k) => !HIDDEN.has(k));
  const lines: ChangeLine[] = [];
  if (r.op === 'UPDATE') {
    const ks = Array.from(new Set([...keys(r.old_data), ...keys(r.new_data)]));
    for (const k of ks) lines.push({ label: LABEL[k] ?? k, from: fmtVal(k, r.old_data?.[k]), to: fmtVal(k, r.new_data?.[k]) });
  } else {
    const d = r.op === 'INSERT' ? r.new_data : r.old_data;
    // ringkas: hanya isian yang berisi
    const ks = keys(d).filter((k) => k !== 'name' && d?.[k] !== null && d?.[k] !== '' && !(Array.isArray(d?.[k]) && (d?.[k] as unknown[]).length === 0) && d?.[k] !== false);
    for (const k of ks.slice(0, 8)) lines.push({ label: LABEL[k] ?? k, to: fmtVal(k, d?.[k]) });
  }
  return { title, lines };
}

/**
 * Nama pelaku yang ditampilkan. Admin melihat email; anggota biasa hanya melihat "Anda" atau "Admin"
 * (anggota hanya bisa melihat riwayat datanya sendiri, jadi pelaku selain dirinya pasti admin).
 */
export function actorLabel(r: AuditRow, viewer: { isAdmin: boolean; userId?: string | null }): string {
  if (viewer.isAdmin) return r.actor_email ?? 'sistem / SQL Editor';
  if (!r.actor) return 'Sistem';
  return r.actor === viewer.userId ? 'Anda' : 'Admin';
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
