# Deploy the Barangay Sites app

The Barangay Sites demo is a regular browser-based React and Vite app. It stores each review in that browser's local storage; there is no account or automatic device sync. Use **Export JSON** and **Add JSON** to move a dataset between devices.

## Cloudflare Pages

Set the project root to `locations/demo`, the build command to `npm run build:barangay-sites`, and the output directory to `barangay sites demo/dist`. Keep the Pages Function in `locations/demo/functions/`; it resolves shortened Google Maps links copied from a phone. Deploy through the connected Git repository or Wrangler so Cloudflare deploys the function along with the static site.

The app can also be hosted as a static site elsewhere, but shortened Maps links need a server endpoint at `/api/resolve-google-maps-link` that accepts a JSON `url` field and returns `latitude` and `longitude`. A static file upload alone cannot resolve the phone share links.

The app needs HTTPS (or localhost during development) for current-location capture. Map tiles and shortened Google Maps links need an internet connection. Without a service worker, the site does not provide offline access. Each browser keeps its own saved review data.
