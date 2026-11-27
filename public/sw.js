// Minimal service worker — just enough to make the app installable (Chrome
// requires a registered SW with a fetch handler). Intentionally NO caching of
// the app shell: this app ships often and a stale cache would serve old builds.
// The fetch handler is a pure pass-through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // pass-through: let the browser handle the request normally (no respondWith)
});
