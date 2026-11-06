// Draft Bulletin yang disimpan di perangkat penulis (localStorage), bukan di database.
// Satu draft per pengguna per entri (entri baru memakai kunci "new"). Semua akses dibungkus try/catch
// karena localStorage bisa kosong, penuh, atau diblokir (mode privat).
const PREFIX = 'bulletin-draft:v1:';

export type DraftMeta = { entryId: string | null; savedAt: number; baseUpdated: string | null };
export type Draft<T> = DraftMeta & { form: T };

const keyOf = (uid: string, entryId: string | null) => PREFIX + uid + ':' + (entryId ?? 'new');

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(uid: string, entryId: string | null, form: T, baseUpdated: string | null): boolean {
  const s = store();
  if (!s) return false;
  try {
    const d: Draft<T> = { form, entryId, savedAt: Date.now(), baseUpdated };
    s.setItem(keyOf(uid, entryId), JSON.stringify(d));
    return true;
  } catch {
    return false; // penyimpanan penuh atau diblokir
  }
}

export function loadDraft<T>(uid: string, entryId: string | null): Draft<T> | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(keyOf(uid, entryId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft<T>;
    return d && typeof d === 'object' && d.form ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(uid: string, entryId: string | null): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(keyOf(uid, entryId));
  } catch {
    /* abaikan */
  }
}

/** Semua draft milik pengguna ini di perangkat ini, terbaru dulu. */
export function listDrafts<T extends { title?: string }>(uid: string): (Draft<T> & { title: string })[] {
  const s = store();
  if (!s) return [];
  const out: (Draft<T> & { title: string })[] = [];
  try {
    const prefix = PREFIX + uid + ':';
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      try {
        const d = JSON.parse(s.getItem(k) || '') as Draft<T>;
        if (d && d.form) out.push({ ...d, title: (d.form.title || '').trim() });
      } catch {
        /* draft rusak: lewati */
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export const fmtDraftTime = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
};
