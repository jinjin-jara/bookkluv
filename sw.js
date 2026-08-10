// 북끄럽 서비스워커
//
// 네트워크를 먼저 본다. 새로 배포한 파일이 바로 반영되는 게 우선이고,
// 캐시는 오프라인이거나 네트워크가 죽었을 때만 꺼내 쓴다.
// (캐시를 먼저 보면 배포해도 옛 화면이 계속 뜬다.)

const CACHE = 'bookkluv-v3';

// 로컬에서 작업할 때는 캐시가 수정을 가려버린다. 아예 끈다.
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);

const SHELL = [
  './',
  './index.html',
  './meeting.html',
  './calendar.html',
  './picks.html',
  './admin.html',
  './css/style.css',
  './assets/mascot.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  if (DEV) return self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting())
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
  if (url.origin !== location.origin) return;   // Supabase 등 외부는 손대지 않는다
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
