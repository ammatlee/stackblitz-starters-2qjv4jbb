/* Alamat halaman Bangunan Baru. Proyek dan layar yang sedang dibuka disimpan di URL
   (?p=<id proyek>&v=<layar>) supaya tombol Back browser, refresh, dan tautan yang dibagikan bekerja. */

export type NbView = 'stage' | 'material' | 'drawing' | 'tank' | 'finding';

export const NB_VIEWS: NbView[] = ['stage', 'material', 'drawing', 'tank', 'finding'];

export type NbRoute = {
  /** null = daftar proyek. */
  projectId: string | null;
  view: NbView | null;
  /** Layar Material dibuka dari Tahapan: tombol kembali ke Tahapan, bukan ke daftar proyek. */
  fromStage?: boolean;
};

export const NB_BASE = '/newbuilding';

export const LIST_ROUTE: NbRoute = { projectId: null, view: null };

/** Baca alamat (bagian setelah "?"). Tanpa proyek = daftar proyek; layar tak dikenal = Tahapan. */
export function parseRoute(search: string): NbRoute {
  const q = new URLSearchParams(search);
  const p = q.get('p');
  if (!p) return LIST_ROUTE;
  const v = q.get('v');
  const view: NbView = NB_VIEWS.includes(v as NbView) ? (v as NbView) : 'stage';
  return view === 'material' && q.get('f') === 's' ? { projectId: p, view, fromStage: true } : { projectId: p, view };
}

/** Bagian "?..." untuk satu rute; kosong untuk daftar proyek. */
export function routeSearch(r: NbRoute): string {
  if (!r.projectId) return '';
  const view = r.view ?? 'stage';
  return `?p=${encodeURIComponent(r.projectId)}&v=${view}${view === 'material' && r.fromStage ? '&f=s' : ''}`;
}

export const routeHref = (r: NbRoute): string => NB_BASE + routeSearch(r);
