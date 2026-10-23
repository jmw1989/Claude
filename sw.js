// Offline support: the app shell is cached; quiz data and APIs always try the network first.
const CACHE = 'quiznight-v8';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/sources.js',
  'js/offline-questions.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Network first, so new code and new weekly quizzes show up straight away.
  // `no-cache` makes the browser check with the server instead of reusing a stale copy.
  const request = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
