const CACHE_NAME = "date-roulette-v1.3.14";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./cards/index.js",
  "./cards/rules.js",
  "./cards/chaos.js",
  "./cards/makeup.js",
  "./cards/blindfold.js",
  "./cards/cute.js",
  "./cards/flirty.js",
  "./cards/oohlala.js",
  "./cards/disney.js",
  "./cards/jacuzzi.js",
  "./cards/special.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put("./index.html", response.clone());
    return response;
  } catch (error) {
    return (await cache.match("./index.html")) || Response.error();
  }
}

async function cacheFirstWithRefresh(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse || Response.error());

  return cachedResponse || fetchPromise;
}
