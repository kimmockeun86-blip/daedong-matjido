// 대동맛지도 PWA Service Worker
const CACHE_NAME = 'daedong-matjido-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch requests to the network.
  // Can be expanded to cache tiles and offline data later.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
