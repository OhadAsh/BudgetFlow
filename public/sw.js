/* Offline support: hashed build assets are cached forever, navigations prefer the
   network so a new deploy is picked up, and fall back to the cached shell offline. */
const CACHE_NAME = 'expense-tracker-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = request.mode === 'navigate';

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (!isNavigation) {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
      }

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        if (isNavigation) {
          const shell = await cache.match(new URL('./index.html', self.registration.scope).href);
          if (shell) {
            return shell;
          }
        }
        throw error;
      }
    })()
  );
});
