import { scheduleText } from "../barangay-review/utils/selectedBarangayCsv.js";

export const summaryColumns = [
  "Barangay", "Dumping Schedule", "Pick-up Schedule", "Firing Lines",
  "Pick-up Points", "Puroks", "Last Updated",
];

export const detailColumns = [
  "Site", "Type", "Purok", "Dumping Schedule", "Pick-up Schedule", "Location",
];

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});

function activePoints(barangay) {
  return barangay.pins.filter(({ sourceStatus }) => sourceStatus !== "removed");
}

export function confirmedReport(barangays, activityLog) {
  const updates = new Map();
  for (const { barangayId, timestamp } of activityLog) {
    const time = Date.parse(timestamp);
    if (time > (updates.get(barangayId) ?? -Infinity)) updates.set(barangayId, time);
  }

  return barangays.filter(({ confirmed }) => confirmed).map((barangay) => {
    const points = activePoints(barangay);
    const lines = barangay.firingLines;
    const details = [
      ...points.map((point) => detailRow(point, "Pick-up point", point.purok, point.googleMapsUrl ||
        (point.latitude != null && point.longitude != null ? `${point.latitude}, ${point.longitude}` : ""))),
      ...lines.map((line) => detailRow(line, "Firing line", line.puroks?.join(", "), line.coordinates?.map((point) => point.join(", ")).join("\n"))),
    ];
    const schedules = (column) => [...new Set(details.map((row) => row[column]).filter(Boolean))].join("\n");
    const updated = Math.max(Date.parse(barangay.updatedAt) || 0, updates.get(barangay.id) ?? 0);
    return {
      barangay, details, updated,
      detailTargets: [
        ...points.map((item) => ({ kind: "pin", item })),
        ...lines.map((item) => ({ kind: "line", item })),
      ],
      summary: [
        barangay.name, schedules(3), schedules(4), lines.length, points.length,
        new Set(barangay.puroks).size, updated ? dateFormat.format(updated) : "",
      ],
    };
  }).sort((a, b) => b.updated - a.updated || a.barangay.name.localeCompare(b.barangay.name));
}

export function confirmedGeoJson(report) {
  const features = [];
  for (const { barangay } of [...report].sort((a, b) => a.barangay.name.localeCompare(b.barangay.name))) {
    for (const item of activePoints(barangay)) {
      const { latitude, longitude, purok } = item;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) || Math.abs(longitude) > 180) continue;
      features.push({
        type: "Feature",
        properties: { barangay: barangay.name, name: item.name ?? "", purok: purok ?? "" },
        geometry: { type: "Point", coordinates: [longitude, latitude] },
      });
    }
    for (const line of barangay.firingLines ?? []) {
      const coordinates = line.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2 ||
          !coordinates.every((point) => Array.isArray(point) && point.length === 2 &&
            Number.isFinite(point[0]) && Math.abs(point[0]) <= 90 &&
            Number.isFinite(point[1]) && Math.abs(point[1]) <= 180)) continue;
      features.push({
        type: "Feature",
        properties: { barangay: barangay.name, name: line.name ?? "", type: "firing_line", puroks: line.puroks ?? [] },
        geometry: { type: "LineString", coordinates: coordinates.map(([latitude, longitude]) => [longitude, latitude]) },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function detailRow(item, type, purok, location) {
  return [
    item.name, type, purok ?? "", scheduleText(item.schedule, "drop-off"),
    scheduleText(item.schedule, "pick-up"), location ?? "",
  ];
}
