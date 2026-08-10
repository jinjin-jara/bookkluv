// 북끄럽 서비스워커 — 껍데기는 캐시에서, 데이터는 늘 네트워크에서.

const CACHE = 'bookkluv-v1';

// 로컬에서 작업할 때는 캐시가 수정을 가려버린다. 아예 끈다.
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const SHELL = [
  './',
  './index.html',
  './meeting.html',
  './picks.html',
  './admin.html',
  './css/style.css',
  './js/shelf.js',
  './js/mask.js',
  './js/parser.js',
  './assets/mascot.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  if (DEV) return self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (DEV) return;
  const url = new URL(e.request.url);

  // Supabase 등 외부 요청은 손대지 않는다. 늘 최신 데이터를 받아야 한다.
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  // 껍데기: 캐시 먼저, 없으면 네트워크. 받아오면 캐시에 채운다.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const live = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || live;
    })
  );
});
