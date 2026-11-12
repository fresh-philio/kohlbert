importScripts('alerts.js');

const CACHE = 'kohlbert-v1-1'; // bei Änderungen hochzählen
const STATE_CACHE = 'kohlbert-state';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'alerts.js', 'manifest.webmanifest',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  // cache:'reload' umgeht den HTTP-Cache, sonst landen beim Update ggf. alte Dateien im neuen Cache
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== STATE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});

/* App schickt ihren Stand, damit der SW im Hintergrund prüfen kann */
self.addEventListener('message', e => {
  const d = e.data;
  if (d && d.type === 'state') {
    e.waitUntil(caches.open(STATE_CACHE).then(c => c.put('state', new Response(JSON.stringify(d.state)))));
  }
});

async function backgroundCheck() {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.some(w => w.visibilityState === 'visible')) return;

  const cache = await caches.open(STATE_CACHE);
  const res = await cache.match('state');
  if (!res) return;
  const s = await res.json();
  const t = Date.now();

  const { woke } = KB.step(s, (t - s.last) / 3600000);
  s.__woke = woke;
  if (!s.notify) return;
  const a = KB.due(s, t);
  if (!a) return;

  const stored = await (await cache.match('state')).json();
  stored.lastNotify = Object.assign({}, stored.lastNotify, { [a.id]: t });
  await cache.put('state', new Response(JSON.stringify(stored)));
  await self.registration.showNotification(a.title, {
    body: a.body, tag: 'kohlbert-' + a.id, icon: 'icon-192.png', badge: 'icon-192.png', renotify: true
  });
}

self.addEventListener('periodicsync', e => {
  if (e.tag === 'kohlbert-check') e.waitUntil(backgroundCheck());
});

/* Echter Web-Push (falls später ein Server angebunden wird) */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Kohlbert', {
    body: d.body || 'Kohlbert braucht dich!', tag: d.tag || 'kohlbert-push', icon: 'icon-192.png', badge: 'icon-192.png'
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
