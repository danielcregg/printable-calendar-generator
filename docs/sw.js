// Service worker for the Printable Calendar Generator PWA.
// Cache-first: the whole app shell is precached so the app works fully offline.
//
// IMPORTANT: bump CACHE whenever any precached asset below changes, otherwise
// returning visitors keep being served the old cached file.
const CACHE = "printable-calendar-v23";

const ASSETS = [
  "./",
  "./index.html",
  "./today.html",
  "./styles.css",
  "./app.js",
  "./today.js",
  "./vendor/jspdf.umd.min.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Serve precached assets first, fall back to the network. Only same-origin GET
// requests are handled; ignoreSearch lets a versioned request such as
// app.js?v=... match the cached app.js.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request))
  );
});
