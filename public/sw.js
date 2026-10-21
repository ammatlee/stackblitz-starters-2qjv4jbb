/* RDK — service worker sederhana: halaman yang pernah dibuka tetap bisa dibuka tanpa sinyal.
   Permintaan ke Supabase (server lain) TIDAK disentuh sama sekali, jadi data dan login tetap lewat internet. */
const CACHE = 'rdk-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.indexOf('rdk-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const OFFLINE_HTML =
  '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tanpa sinyal</title></head>' +
  '<body style="font-family:Arial,sans-serif;background:#f1f5f9;color:#1e293b;margin:0;padding:24px">' +
  '<div style="max-width:420px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center">' +
  '<h2 style="margin:0 0 8px">Tidak ada sinyal</h2>' +
  '<p style="font-size:14px;color:#475569">Halaman ini belum pernah dibuka saat online, jadi belum tersimpan di HP. Sambungkan internet, buka halaman ini sekali, lalu halaman bisa dibuka tanpa sinyal.</p>' +
  '<button onclick="location.reload()" style="margin-top:12px;background:#0d9488;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:600">Coba lagi</button>' +
  '</div></body></html>';

const offlinePage = () =>
  new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

// Respons hasil redirect tidak boleh dipakai untuk membuka halaman; bersihkan dulu sebelum disimpan.
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function save(req, res) {
  try {
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(req, await clean(res));
    }
  } catch (e) {
    /* abaikan */
  }
}

// Jaringan dulu; kalau lambat (lewat batas waktu) atau gagal, pakai salinan tersimpan.
async function networkFirst(req, timeoutMs, isPage) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const net = fetch(req).then((res) => {
    save(req, res.clone());
    return res;
  });
  if (!cached) {
    return net.catch(() => (isPage ? offlinePage() : Response.error()));
  }
  const slow = new Promise((resolve) => setTimeout(() => resolve(cached), timeoutMs));
  return Promise.race([net, slow]).catch(() => cached);
}

// File bernama-acak (/_next/static/) tidak pernah berubah isinya: salinan tersimpan langsung dipakai.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  save(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase dan server lain: biarkan lewat apa adanya
  if (url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, 4000, true));
    return;
  }
  if (url.pathname.indexOf('/_next/static/') === 0) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(networkFirst(req, 3000, false));
});
