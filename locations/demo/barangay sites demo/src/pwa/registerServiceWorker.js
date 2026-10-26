export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const register = () => {
    const baseUrl = import.meta.env.BASE_URL;
    const scriptUrl = new URL(`${baseUrl}sw.js`, window.location.href);
    const scopeUrl = new URL(baseUrl, window.location.href);
    navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl.pathname })
      .catch((error) => console.warn("Offline app support could not be enabled.", error));
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
