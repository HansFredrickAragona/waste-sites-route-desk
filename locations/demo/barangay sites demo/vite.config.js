import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMapCoordinates } from "./src/features/barangay-review/data/mapCoordinates.js";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));

function googleMapsLinkResolver() {
  function middleware(request, response, next) {
    let pathname;
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      return next();
    }

    if (pathname !== "/api/resolve-google-maps-link") return next();
    if (request.method !== "POST") {
      response.statusCode = 405;
      response.setHeader("Allow", "POST");
      response.end();
      return;
    }

    let body = "";
    let tooLarge = false;
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) tooLarge = true;
    });
    request.on("end", async () => {
      const sendJson = (status, payload) => {
        response.statusCode = status;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify(payload));
      };

      if (tooLarge) {
        sendJson(413, { message: "The Maps link is too long." });
        return;
      }

      let sharedUrl;
      try {
        sharedUrl = new URL(JSON.parse(body).url);
      } catch {
        sendJson(400, { message: "Paste a valid Google Maps share link." });
        return;
      }

      if (sharedUrl.protocol !== "https:" || !["maps.app.goo.gl", "goo.gl"].includes(sharedUrl.hostname.toLowerCase())) {
        sendJson(400, { message: "Only Google Maps mobile share links can be resolved." });
        return;
      }

      const isGoogleHost = (hostname) => hostname === "google.com"
        || hostname.endsWith(".google.com")
        || hostname === "goo.gl"
        || hostname.endsWith(".goo.gl");

      try {
        let destination = sharedUrl;
        let finalResponse;
        for (let redirectCount = 0; redirectCount <= 8; redirectCount += 1) {
          finalResponse = await fetch(destination, {
            redirect: "manual",
            signal: AbortSignal.timeout(8000),
          });

          if (finalResponse.status < 300 || finalResponse.status >= 400) break;
          const location = finalResponse.headers.get("location");
          if (!location || redirectCount === 8) break;
          destination = new URL(location, destination);
          if (destination.protocol !== "https:" || !isGoogleHost(destination.hostname.toLowerCase())) {
            sendJson(400, { message: "This share link redirected outside Google Maps." });
            return;
          }
        }

        const coordinates = parseMapCoordinates(destination.href);
        if (coordinates) {
          sendJson(200, coordinates);
          return;
        }

        sendJson(422, { message: "Google Maps opened the share link, but it did not expose coordinates. Use Adjust pin on map to confirm the placement." });
      } catch {
        sendJson(502, { message: "Could not reach Google Maps to resolve this share link. Check the connection and try again." });
      }
    });
  }

  return {
    name: "google-maps-share-link-resolver",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), googleMapsLinkResolver()],
  cacheDir: ".vite",
  server: {
    fs: { allow: [path.resolve(appDirectory, "../..")] },
  },
});
