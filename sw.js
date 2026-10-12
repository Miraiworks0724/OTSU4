/* オフライン対応（ネットワーク優先・失敗時はキャッシュ） */
const CACHE = 'otsu4-v3';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/util.js',
  'js/data/topics.js',
  'js/data/notes.js',
  'js/data/substances.js',
  'js/data/statements.js',
  'js/generators.js',
  'js/storage.js',
  'js/engine.js',
  'js/app.js',
  'manifest.webmanifest',
  'icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
