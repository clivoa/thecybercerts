const CACHE_VERSION = "sec-cert-roadmap-v6";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./mindmap.html",
  "./mindmap/",
  "./mindmap/index.html",
  "./wizard/",
  "./wizard/index.html",
  "./compare/",
  "./compare/index.html",
  "./matrix/",
  "./matrix/index.html",
  "./guide/",
  "./guide/index.html",
  "./assets/styles.css",
  "./assets/guide.css",
  "./assets/app.js",
  "./assets/mindmap.css",
  "./assets/mindmap.js",
  "./assets/wizard.css",
  "./assets/wizard.js",
  "./assets/compare.css",
  "./assets/compare.js",
  "./assets/matrix.css",
  "./assets/matrix.js",
  "./assets/vendor/js-yaml.mjs",
  "./data/index.yaml",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isSameOriginGet = (request) => {
  if (request.method !== "GET") {
    return false;
  }

  const requestUrl = new URL(request.url);
  return requestUrl.origin === self.location.origin;
};

const putInRuntimeCache = async (request, response) => {
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(request, response.clone());
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isSameOriginGet(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => putInRuntimeCache(request, response))
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("./index.html");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => putInRuntimeCache(request, response))
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});
