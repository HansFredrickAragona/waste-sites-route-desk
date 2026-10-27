export function cleanupLegacyPwa() {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const expectedWorkerUrl = new URL("sw.js", baseUrl).href;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations
        .filter((registration) => {
          if (registration.scope !== baseUrl.href) return false;
          return [registration.installing, registration.waiting, registration.active]
            .some((worker) => worker?.scriptURL === expectedWorkerUrl);
        })
        .map((registration) => registration.unregister())))
      .catch(() => {});
  }

  if ("caches" in window) {
    window.caches.keys()
      .then((cacheNames) => Promise.all(cacheNames
        .filter((name) => name.startsWith("baguio-barangay-sites-"))
        .map((name) => window.caches.delete(name))))
      .catch(() => {});
  }
}
