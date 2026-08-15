/* Africa Vision — Service Worker
   Stratégie : network-first pour les pages (jamais de version périmée servie),
   cache-first pour les icônes et polices (rapide et stable).
   ⚠️ INCRÉMENTER CACHE_VERSION à CHAQUE mise en ligne d'une nouvelle version. */

const CACHE_VERSION = 'av-v12';
const CORE_CACHE = CACHE_VERSION + '-core';
const ASSET_CACHE = CACHE_VERSION + '-assets';

const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* ---- Installation : mise en cache du socle ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pré-cache partiel :', err))
  );
});

/* ---- Activation : suppression des anciens caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(CACHE_VERSION))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- Interception des requêtes ---- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // On ne gère que les GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ne jamais mettre en cache les appels à la base de données
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  // Icônes, images et polices : cache d'abord
  if (/\.(png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname) ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(ASSET_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Pages : réseau d'abord, cache en secours si hors ligne
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CORE_CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});

/* ---- Mise à jour forcée depuis la page ---- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
