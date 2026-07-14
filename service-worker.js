/* ==========================================================================
   MindBloom — service-worker.js (kill switch)
   A service worker was registered during an earlier development pass and
   is likely still installed in some browsers, silently serving stale
   cached files and causing "no internet connection" errors as the app's
   file structure changed. Browsers always fetch this file fresh on
   navigation (bypassing HTTP cache) to check for updates, so replacing
   its contents with a self-unregistering kill switch is the reliable way
   to fully remove any previously-installed service worker + its caches.

   PWA support is intentionally not being re-added yet — that should be a
   deliberate, later step once the app is stable, not something running
   silently during active development.
   ========================================================================== */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return caches.delete(key);
        }));
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll();
      })
      .then(function (clients) {
        clients.forEach(function (client) {
          client.navigate(client.url);
        });
      })
  );
});
