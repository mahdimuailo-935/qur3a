const CACHE = 'qur3a-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;700&display=swap';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

async function warmFonts() {
  try {
    const c = await caches.open(CACHE);
    if (await c.match(FONT_CSS, { ignoreVary: true })) return;
    const r = await fetch(FONT_CSS);
    if (!r.ok) return;
    await c.put(FONT_CSS, r.clone());
    const css = await r.text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(x => x.ok && c.put(u, x)).catch(() => {})));
  } catch (err) {}
}

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    await warmFonts();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const nav = req.mode === 'navigate';
    if (nav) {
      try {
        const r = await fetch(req);
        if (r.ok) c.put('./', r.clone());
        return r;
      } catch (err) {
        return (await c.match('./', { ignoreSearch: true })) || Response.error();
      }
    }
    const hit = await c.match(req, { ignoreVary: true });
    const net = fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    return r || Response.error();
  })());
});
