export function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export function hasMapCoordinates(pin) {
  if (pin?.latitude === null || pin?.latitude === undefined || String(pin.latitude).trim() === "" ||
    pin?.longitude === null || pin?.longitude === undefined || String(pin.longitude).trim() === "") return false;
  const latitude = Number(pin.latitude);
  const longitude = Number(pin.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}
