// Service worker Love Quest: bisa dipasang ke home screen, bisa dimainin offline,
// dan menampilkan notifikasi streak.
const CACHE = 'love-quest-v22';
const FONT_CACHE = 'love-quest-fonts';
const PHOTO_CACHE = 'love-quest-photos';

// Semua file game disimpan dari awal (kalau nambah file, tambahin juga di sini).
// Halaman admin/owner sengaja nggak disimpan: harus online.
const PRECACHE = [
  '/', '/index.html', '/manifest.webmanifest', '/css/style.css',
  '/js/boot.js', '/js/main.js', '/js/config.js', '/js/audio.js', '/js/music.js', '/js/confetti.js', '/js/util.js',
  '/js/streak.js', '/js/personal.js', '/js/themes.js', '/js/level-map.js', '/js/showcase.js',
  '/js/games/memory.js', '/js/games/catch.js', '/js/games/pop.js', '/js/games/quiz.js', '/js/games/puzzle.js',
  '/js/games/odd.js', '/js/games/simon.js', '/js/games/fly.js', '/js/games/stack.js', '/js/games/runner.js',
  '/js/games/throw.js', '/js/games/maze.js', '/js/games/timing.js',
  '/img/contoh-foto.jpg',
  ...['nadia', 'raka', 'salsa', 'dimas', 'ayu', 'bima', 'nadia-raka', 'salsa-dimas', 'ayu-bima'].map((n) => `/img/contoh/${n}.jpg`),
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icons/badge-96.png', '/icons/favicon-64.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // satu file gagal nggak bikin semuanya gagal
      .then((c) => Promise.allSettled(PRECACHE.map((url) => c.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  const keep = [CACHE, FONT_CACHE, PHOTO_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Ambil dari simpanan dulu; kalau belum ada, ambil dari internet lalu simpan
function cacheFirst(cacheName, req) {
  return caches.open(cacheName).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') c.put(req, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Font Google: simpan sekali, pakai terus
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(FONT_CACHE, req));
    return;
  }
  // Foto pasangan dari CMS (Supabase Storage): nama filenya unik & nggak pernah berubah
  if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
    e.respondWith(cacheFirst(PHOTO_CACHE, req).catch(() => Response.error()));
    return;
  }
  // Selain itu cuma file situs sendiri (API Supabase tetap langsung ke internet)
  if (url.origin !== location.origin) return;
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin.') || url.pathname === '/owner' || url.pathname.startsWith('/owner.')) return;

  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : null));
  const saveCopy = (res) => {
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  // Gambar & ikon: langsung dari simpanan (cepat, nggak nunggu internet)
  if (/\.(?:jpg|jpeg|png|webp|gif)$/i.test(url.pathname)) {
    e.respondWith(fromCache().then((hit) => hit || fetch(req).then(saveCopy)).catch(() => Response.error()));
    return;
  }

  // Kode & halaman game (termasuk /c/<kode>): coba versi terbaru, maksimal nunggu internet 3 detik
  e.respondWith(new Promise((resolve) => {
    let settled = false;
    const useCache = () => fromCache().then((hit) => {
      if (hit && !settled) { settled = true; resolve(hit); }
      return hit;
    });
    const timer = setTimeout(useCache, 3000);
    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        saveCopy(res);
        if (!settled) { settled = true; resolve(res); }
      })
      .catch(() => {
        clearTimeout(timer);
        useCache().then((hit) => { if (!settled) { settled = true; resolve(hit || Response.error()); } });
      });
  }));
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() }; }
  const jobs = [
    self.registration.showNotification(data.title || 'Love Quest 💖', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'streak',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  ];
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    jobs.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
  }
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => 'focus' in w && new URL(w.url).pathname === target);
      return win ? win.focus() : self.clients.openWindow(target);
    }),
  );
});
