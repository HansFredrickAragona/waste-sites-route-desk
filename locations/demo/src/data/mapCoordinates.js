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

  const queryKeys = ["viewpoint", "query", "q", "ll", "center"];
  for (const key of queryKeys) {
    const pair = coordinatePair(url.searchParams.get(key) ?? "");
    if (pair) return pair;
  }

  const pathPatterns = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
  ];
  for (const pattern of pathPatterns) {
    const match = `${url.pathname}${url.hash}`.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (validCoordinates(latitude, longitude)) return { latitude, longitude };
  }

  return null;
}
