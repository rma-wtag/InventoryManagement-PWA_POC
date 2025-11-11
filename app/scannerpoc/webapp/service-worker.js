const CACHE_NAME = "fiori-pwa-cache-v1";
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./Component.js",
  "https://ui5.sap.com/resources/sap-ui-core.js",
  "https://ui5.sap.com/resources/sap/ndc/library.js",
  "https://ui5.sap.com/resources/sap/ndc/BarcodeScanner.js",
  "https://ui5.sap.com/resources/sap/ndc/BarcodeScannerButton.js"
];

/** INSTALL — Pre-cache app shell */
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app shell...");
      return cache.addAll(urlsToCache);
    })
  );
});

/** ACTIVATE — Clean up old caches */
self.addEventListener("activate", (event) => {
  console.log("Activating new Service Worker...");
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (!cacheWhitelist.includes(name)) {
            console.log("Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/** FETCH — Smart routing */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Navigation → fallback to index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 2. OData API → network first, cache fallback
  if (url.pathname.includes("/odata/v4/catalog/Books")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. UI5 resources → cache first, then update in background
  if (url.origin === "https://ui5.sap.com") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request, { mode: "no-cors" }).then((networkRes) => {
          if (networkRes && networkRes.status < 400) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkRes.clone()));
          }
          return networkRes;
        });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Default: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((res) => res || fetch(request))
  );
});

/** AUTO-UPDATE: Every 15 minutes */
function startBackgroundUpdate() {
  setInterval(() => {
    if (navigator.onLine) {
      console.log("Background cache update triggered (every 15 min)");
      updateCache();
    }
  }, UPDATE_INTERVAL);
}

/** AUTO-UPDATE: When internet comes back */
self.addEventListener("online", () => {
  console.log("Internet is back! Updating cache...");
  updateCache();
});

/** Core update function */
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    console.log("Updating cached resources...");
    await Promise.all(
      urlsToCache.map((url) =>
        fetch(url, { cache: "reload" }).then((res) => {
          if (res && res.status < 400) {
            return cache.put(url, res);
          }
        }).catch(() => console.warn("Failed to update:", url))
      )
    );
    console.log("Cache updated successfully");

    // Notify all open tabs
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "CACHE_UPDATED" });
    });
  } catch (err) {
    console.error("Cache update failed:", err);
  }
}

/** Start background updates on activation */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      startBackgroundUpdate();
      if (navigator.onLine) {
        updateCache();
      }
    })()
  );
});