const SITE_COLUMNS = ["Site name", "Purok", "Longitiude", "Latitude", "Googlemaps view", "Pick-Up", "Drop-off"];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvDocument(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function scheduleTime(timing) {
  const savedTime = String(timing.time ?? "").trim();
  if (savedTime) return savedTime;
  const endpoint = (time, period) => [time, period].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
  const start = endpoint(timing.startTime, timing.startPeriod);
  const end = endpoint(timing.endTime, timing.endPeriod);
  return start && end ? `${start} - ${end}` : start || end;
}

function scheduleText(schedule, kind) {
  if (!Array.isArray(schedule)) return "";
  return schedule.flatMap((group) => {
    const value = group?.[kind];
    return Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  }).map((timing) => {
    if (!timing || typeof timing !== "object") return "";
    const day = Array.isArray(timing.day) ? timing.day.join(", ").trim() : String(timing.day ?? "").trim();
    const time = scheduleTime(timing);
    return day && time ? `${day}: ${time}` : day || time;
  }).filter(Boolean).join("; ");
}

function mapsUrl(latitude, longitude) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function siteSummaryCsv(barangay) {
  const rows = (barangay.pins ?? []).map((pin) => {
    const latitude = pin.latitude ?? "";
    const longitude = pin.longitude ?? "";
    const link = pin.googleMapsUrl || pin.location?.google_maps_url ||
      (latitude !== "" && longitude !== "" ? mapsUrl(latitude, longitude) : "");
    return [
      pin.name ?? pin.site_name ?? "",
      pin.purok ?? "",
      longitude,
      latitude,
      link,
      scheduleText(pin.schedule, "pick-up"),
      scheduleText(pin.schedule, "drop-off"),
    ];
  });
  return csvDocument([SITE_COLUMNS, ...rows]);
}

export function firingLinesCsv(barangay) {
  const lines = barangay.firingLines ?? [];
  if (lines.length === 0) return null;
  const header = ["Firing line name", ...lines.flatMap((line) => [line.name, `${line.name} - Google Maps`])];
  const pointCount = Math.max(...lines.map((line) => line.coordinates?.length ?? 0));
  const rows = Array.from({ length: pointCount }, (_, index) => [
    index === 0 ? "Points" : "",
    ...lines.flatMap((line) => {
      const point = line.coordinates?.[index];
      if (!point) return ["", ""];
      const [latitude, longitude] = point;
      return [`${longitude},${latitude}`, mapsUrl(latitude, longitude)];
    }),
  ]);
  return csvDocument([header, ...rows]);
}

export function barangayCsvFilenames(barangayName, date = new Date()) {
  const stem = String(barangayName ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "barangay";
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return { sites: `${stem}_summary_${day}.csv`, firingLines: `${stem}_firing_lines_${day}.csv` };
}
