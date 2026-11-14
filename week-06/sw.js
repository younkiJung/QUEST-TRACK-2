// 오늘 급식 앱의 서비스 워커
// - 앱 파일(화면·함수·아이콘)을 저장해 두고, 인터넷이 끊기면 저장한 것으로 연다.
// - 인터넷이 되면 늘 새 파일을 먼저 받는다 (고친 것이 바로 보이게).
// - 나이스 급식 정보는 여기서 다루지 않는다. 마지막으로 받은 급식은 앱(meal.js)이 따로 기억한다.
// 앱 파일 목록을 바꾸면 VERSION 숫자도 올린다.

const VERSION = 'meal-app-v1';
const FILES = [
  './',
  './index.html',
  './meal.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('meal-app-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // 같은 주소(내 앱 파일)의 GET 만 다룬다. 나이스 서버로 가는 요청은 그대로 보낸다.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || (request.mode === 'navigate' ? caches.match('./index.html') : undefined))
        .then((hit) => hit || new Response('인터넷이 끊겨 이 파일을 열 수 없어요.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })))
  );
});
