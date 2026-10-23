function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function coordinatePair(value) {
  const match = value.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return validCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}

export function parseMapCoordinates(input) {
  const value = input.trim();
  if (!value) return null;

  const plainPair = coordinatePair(value);
  if (plainPair) return plainPair;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  for (const key of ["viewpoint", "query", "q", "ll", "center"]) {
    const pair = coordinatePair(url.searchParams.get(key) ?? "");
    if (pair) return pair;
  }

  for (const pattern of [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
  ]) {
    const match = `${url.pathname}${url.hash}`.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (validCoordinates(latitude, longitude)) return { latitude, longitude };
  }

  return null;
}

export async function resolveMapCoordinates(input) {
  const directCoordinates = parseMapCoordinates(input);
  if (directCoordinates) return directCoordinates;

  const value = input.trim();
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  if (!["maps.app.goo.gl", "goo.gl"].includes(url.hostname.toLowerCase())) return null;

  const response = await fetch("/api/resolve-google-maps-link", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ url: url.href }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message || "Could not resolve this Google Maps share link.");
  }

  const latitude = Number(result?.latitude);
  const longitude = Number(result?.longitude);
  return validCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}
