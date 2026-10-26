# Install the Barangay Sites demo on a phone

The demo can be installed as a progressive web app (PWA). It remains the same React app and keeps data independently in each device's browser storage. There is no account, database, or automatic phone-to-laptop sync.

## Build and host

1. Build from this folder with `npm run build`.
2. Host the contents of `dist/` at a stable HTTPS address. The laptop does not need to remain on after the hosted app is available.
3. Open the HTTPS address on the phone and install it from the browser menu. On iPhone, use Safari's **Share → Add to Home Screen**.

The PWA caches its app shell, bundled site data, scripts, styles, manifest, and icons after the first successful load. Each device keeps its own review changes and workspace session. Use **Export JSON** and **Add JSON** to move a working dataset between devices.

## Offline limits

- The app and bundled site data can reopen after they have been cached.
- OpenStreetMap tiles and Google Maps links require an internet connection. The map may show pins and lines without its background tiles.
- Resolving shortened `maps.app.goo.gl` links uses a development-server endpoint that is not included in a static build. On a static host, enter coordinates or use a full Maps URL instead.

The browser requires HTTPS for installation and GPS permission. Localhost is suitable for development, but it is not the phone's hosted address.
