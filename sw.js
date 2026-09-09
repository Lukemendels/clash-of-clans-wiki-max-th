const CACHE = 'max-th-v5';
const SHELL = ['./', './index.html', './app.css', './app-fixes.css', './app-data.js', './app-planner.js', './app-ui.js', './app-fixes.js', './manifest.webmanifest', './assets/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // App-shell files should prefer the deployed version whenever online so a normal
  // refresh picks up planner changes immediately. Cached copies remain the offline fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Version-pinned external game data can stay cache-first for offline performance.
  event.respondWith(cacheFirst(event.request));
});
