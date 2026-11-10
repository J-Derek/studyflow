/*
 * StudyFlow service worker. This is a TEMPLATE: vite.config.ts fills in the version and the file list (the two placeholders further down) at build time and writes it to
 * /sw.js. It exists so the app opens with no connection after the first visit.
 *
 * What it does, and on purpose does NOT do:
 *  - Keeps a copy of the app shell (index.html) and the built files (/assets/..., which have a hash in their name, so a copy never goes stale).
 *  - Pages: the network first (so a new deploy shows up straight away), the saved shell when there is no connection or it is very slow.
 *  - /assets files: the saved copy first, fetched and saved the first time.
 *  - Never touches: anything that is not a GET, other websites (Firebase, Google), or /__/ (the sign-in handler). Student data is not cached
 *    here at all; Firestore keeps its own copy on the device.
 *  - A new version waits until every open tab is closed before it takes over, so a running page never has its files swapped underneath it.
 */
const VERSION = '__VERSION__';
const CACHE = 'studyflow-' + VERSION;
const PRECACHE = __PRECACHE__;
const SHELL = '/index.html';
const SLOW_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // One missing file must not stop the install; whatever is missed is saved the first time it is used.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) await cache.put(url, res);
          } catch {
            /* offline during install, or a file that moved */
          }
        })
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('studyflow-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function openPage(request) {
  const cache = await caches.open(CACHE);
  const saved = () => cache.match(SHELL, { ignoreVary: true });
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), SLOW_MS))
    ]);
    // Keep the newest shell for the next time there is no connection.
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) cache.put(SHELL, res.clone());
    return res;
  } catch {
    const copy = await saved();
    if (copy) return copy;
    // Nothing saved yet (the very first visit was cut off): let the browser show its own offline page.
    return fetch(request);
  }
}

async function assetFirst(request) {
  const cache = await caches.open(CACHE);
  // ignoreVary: the copy was fetched by the worker, the page's own request carries different headers (for example Origin), and a server's
  // Vary header would otherwise make every lookup miss.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/')) return;
  if (request.mode === 'navigate') {
    // Only the app's own pages (no dot in the address). Files such as /sitemap.xml go straight to the network.
    if (url.pathname.includes('.')) return;
    event.respondWith(openPage(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(assetFirst(request));
  }
});
