/* Beranda Aplikasi — Service Worker */
var CACHE = "beranda-aplikasi-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return; // biarkan POST ke GAS lewat jaringan
  var url = new URL(req.url);

  // Jangan pernah cache backend sinkronisasi — selalu ke jaringan agar data segar
  if (url.hostname.indexOf("script.google.com") !== -1 ||
      url.hostname.indexOf("googleusercontent.com") !== -1) {
    return;
  }

  if (url.origin === location.origin) {
    // App shell: cache-first, fallback ke index.html untuk navigasi offline
    e.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return caches.match("./index.html"); });
      })
    );
  } else {
    // Aset pihak ketiga (font, dsb): stale-while-revalidate
    e.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
  }
});
