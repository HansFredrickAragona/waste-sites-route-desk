import { parseMapCoordinates } from "./mapCoordinates.js";

const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

function resolverError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isGoogleHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "google.com"
    || host.endsWith(".google.com")
    || host === "goo.gl"
    || host.endsWith(".goo.gl");
}

export async function resolveGoogleMapsShortLink(value) {
  let destination;
  try {
    destination = new URL(value);
  } catch {
    throw resolverError(400, "Paste a valid Google Maps share link.");
  }

  if (destination.protocol !== "https:" || destination.port || !SHORT_LINK_HOSTS.has(destination.hostname.toLowerCase())) {
    throw resolverError(400, "Only Google Maps mobile share links can be resolved.");
  }

  try {
    for (let redirectCount = 0; redirectCount <= 8; redirectCount += 1) {
      const response = await fetch(destination, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});

      if (response.status < 300 || response.status >= 400 || !location || redirectCount === 8) break;

      const nextDestination = new URL(location, destination);
      if (nextDestination.protocol !== "https:" || nextDestination.port || !isGoogleHost(nextDestination.hostname)) {
        throw resolverError(400, "This share link redirected outside Google Maps.");
      }
      destination = nextDestination;
    }
  } catch (error) {
    if (Number.isInteger(error?.status)) throw error;
    throw resolverError(502, "Could not reach Google Maps to resolve this share link. Check the connection and try again.");
  }

  const coordinates = parseMapCoordinates(destination.href);
  if (coordinates) return coordinates;

  throw resolverError(422, "Google Maps opened the share link, but it did not expose coordinates. Use Adjust pin on map to confirm the placement.");
}
