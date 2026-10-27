import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGoogleMapsShortLink } from "./src/features/barangay-review/data/googleMapsShareResolver.js";

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
        sharedUrl = JSON.parse(body).url;
      } catch {
        sendJson(400, { message: "Paste a valid Google Maps share link." });
        return;
      }

      try {
        sendJson(200, await resolveGoogleMapsShortLink(sharedUrl));
      } catch (error) {
        sendJson(Number.isInteger(error?.status) ? error.status : 502, {
          message: error instanceof Error ? error.message : "Could not resolve this Google Maps share link.",
        });
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
