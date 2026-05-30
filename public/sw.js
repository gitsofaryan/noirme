const CACHE_NAME = "norby-pwa-cache-v1.0.1";

const STATIC_ASSETS = [
  "/",
  "/profile",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "https://js.puter.com/v2/"
];

// Install: pre-cache critical app shell files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[norby-sw] Pre-caching core app shell.");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[norby-sw] App shell pre-cache partial match or offline during installation:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[norby-sw] Deleting old cache version:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: intercept network requests and apply smart caching
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip WebSocket, API, and Puter KV writes
  if (req.method !== "GET" || url.protocol === "ws:" || url.protocol === "wss:" || url.pathname.includes("/api/") || url.href.includes("puter")) {
    return;
  }

  // Caching Strategy: Stale-While-Revalidate for static resources (JS, CSS, images, fonts, icons)
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".json") ||
    url.hostname.includes("cartocdn") || // Leaflet Map Tiles
    url.hostname.includes("tile.openstreetmap") ||
    url.hostname.includes("api.dicebear.com") // DiceBear Avatars
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cachedResponse) => {
          const fetchPromise = fetch(req).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Fetch failed, return cached response if exists
            return cachedResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Network-First with Cache-Fallback for Page Document routes (/ and /profile)
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // If offline and no cache, return the cached index "/" page
          return caches.match("/");
        });
      })
  );
});
