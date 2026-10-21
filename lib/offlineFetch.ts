/**
 * Tahap 2c — data terakhir tetap bisa dilihat tanpa sinyal.
 *  - Setiap BACAAN dari database yang berhasil disimpan di HP (IndexedDB), terpisah per akun.
 *  - Tanpa sinyal / sinyal sangat lemah: bacaan dijawab dari salinan tersimpan.
 *  - MENYIMPAN perubahan tetap butuh sinyal (tidak diantrekan, supaya tidak ada data ganda/bentrok);
 *    kalau gagal, muncul pesan yang jelas.
 *  - Login, unggah file, dan server lain tidak disentuh.
 */
const DB_NAME = 'rdk-offline';
const STORE = 'reads';
const MAX_AGE_MS = 45 * 24 * 3600 * 1000;

type Entry = { at: number; status: number; statusText: string; headers: [string, string][]; body: string };

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const q = fn(d.transaction(STORE, mode).objectStore(STORE));
        q.onsuccess = () => resolve(q.result);
        q.onerror = () => reject(q.error);
      })
  );
}
const idbHas = (key: string) => tx<number>('readonly', (s) => s.count(key)).then((n) => n > 0).catch(() => false);
const idbGet = (key: string) => tx<Entry | undefined>('readonly', (s) => s.get(key) as IDBRequest<Entry | undefined>).catch(() => undefined);

/** Hapus semua salinan (dipanggil saat keluar akun, agar aman di HP bersama). */
export function clearOfflineCache(): Promise<void> {
  return tx<undefined>('readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined).catch(() => undefined);
}

let pruned = false;
function prune() {
  if (pruned) return;
  pruned = true;
  db()
    .then((d) => {
      const st = d.transaction(STORE, 'readwrite').objectStore(STORE);
      const cur = st.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        if (Date.now() - (c.value as Entry).at > MAX_AGE_MS) c.delete();
        c.continue();
      };
    })
    .catch(() => {});
}

async function save(key: string, res: Response) {
  try {
    if (res.status !== 200 && res.status !== 206) return;
    const body = await res.text();
    if (body.length > 8000000) return; // terlalu besar, lewati
    const headers: [string, string][] = [];
    res.headers.forEach((v, k) => {
      if (k !== 'content-encoding' && k !== 'content-length') headers.push([k, v]);
    });
    const e: Entry = { at: Date.now(), status: res.status, statusText: res.statusText, headers, body };
    await tx('readwrite', (s) => s.put(e, key));
    prune();
  } catch {
    /* penyimpanan penuh / tidak tersedia: abaikan */
  }
}

function fromEntry(e: Entry): Response {
  const h = new Headers(e.headers);
  h.set('x-rdk-offline', '1');
  return new Response(e.body, { status: e.status, statusText: e.statusText, headers: h });
}

function uidOf(authorization: string | null): string {
  try {
    const t = (authorization || '').replace(/^Bearer\s+/i, '').split('.')[1];
    if (!t) return 'anon';
    const json = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: string }).sub;
    return sub || 'anon';
  } catch {
    return 'anon';
  }
}

const isNetworkFailure = (e: unknown) => e instanceof TypeError; // fetch gagal terhubung (AbortError bukan TypeError)
function friendly(why: string): Error {
  const e = new Error(why);
  e.name = 'Tidak ada sinyal';
  return e;
}
const markStale = () => {
  try {
    window.dispatchEvent(new Event('rdk-stale'));
  } catch {
    /* abaikan */
  }
};

export function makeOfflineFetch(restPrefix: string, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts && opts.timeoutMs ? opts.timeoutMs : 10000;

  return async function offlineFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return fetch(input, init);
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (urlStr.indexOf(restPrefix) !== 0) return fetch(input, init); // login, file, dll: apa adanya
    const method = ((init && init.method) || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase();

    // MENYIMPAN / MENGUBAH: tetap butuh sinyal
    if (method !== 'GET') {
      try {
        return await fetch(input, init);
      } catch (e) {
        if (isNetworkFailure(e)) throw friendly('perubahan belum tersimpan di server. Coba lagi saat ada sinyal.');
        throw e;
      }
    }

    // MEMBACA
    const headers = new Headers((init && init.headers) || (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
    const key = [uidOf(headers.get('authorization')), urlStr, headers.get('accept') || '', headers.get('prefer') || '', headers.get('range') || ''].join('|');

    const serveSaved = async (): Promise<Response | null> => {
      const e = await idbGet(key);
      if (!e) return null;
      markStale();
      return fromEntry(e);
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const r = await serveSaved();
      if (r) return r;
      throw friendly('data ini belum pernah dimuat di HP saat online.');
    }

    const live = fetch(input, init).then((res) => {
      void save(key, res.clone());
      return res;
    });
    live.catch(() => {});

    const has = await idbHas(key);
    if (!has) {
      try {
        return await live;
      } catch (e) {
        if (isNetworkFailure(e)) throw friendly('data belum bisa dimuat. Periksa sinyal lalu coba lagi.');
        throw e;
      }
    }

    // ada salinan: jaringan diberi waktu; kalau terlalu lambat atau gagal, pakai salinan
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    try {
      const r = await Promise.race([live, timeout]);
      if (r) return r;
    } catch (e) {
      if (!isNetworkFailure(e)) throw e;
    }
    const saved = await serveSaved();
    if (saved) return saved;
    return live;
  };
}
