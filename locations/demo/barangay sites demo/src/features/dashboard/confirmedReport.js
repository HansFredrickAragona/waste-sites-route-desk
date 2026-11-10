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

export function confirmedReport(barangays, activityLog) {
  const updates = new Map();
  for (const { barangayId, timestamp } of activityLog) {
    const time = Date.parse(timestamp);
    if (time > (updates.get(barangayId) ?? -Infinity)) updates.set(barangayId, time);
  }

  return barangays.filter(({ confirmed }) => confirmed).map((barangay) => {
    const points = barangay.pins.filter(({ sourceStatus }) => sourceStatus !== "removed");
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
      summary: [
        barangay.name, schedules(3), schedules(4), lines.length, points.length,
        new Set(barangay.puroks).size, updated ? dateFormat.format(updated) : "",
      ],
    };
  }).sort((a, b) => b.updated - a.updated || a.barangay.name.localeCompare(b.barangay.name));
}

function detailRow(item, type, purok, location) {
  return [
    item.name, type, purok ?? "", scheduleText(item.schedule, "drop-off"),
    scheduleText(item.schedule, "pick-up"), location ?? "",
  ];
}
