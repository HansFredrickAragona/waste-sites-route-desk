export function coordinateText(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

export const SCHEDULE_DAYS = [
  { code: "MON", label: "Monday" },
  { code: "TUES", label: "Tuesday" },
  { code: "WED", label: "Wednesday" },
  { code: "THURS", label: "Thursday" },
  { code: "FRI", label: "Friday" },
  { code: "SAT", label: "Saturday" },
  { code: "SUN", label: "Sunday" },
];

export function scheduleDayCode(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (!normalized) return "";
  const match = SCHEDULE_DAYS.find(({ code, label }) => {
    const fullName = label.toUpperCase();
    return normalized === code || normalized === fullName || fullName.startsWith(normalized);
  });
  return match?.code ?? "";
}

export function sourceScheduleRows(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.flatMap((entry) => Object.entries(entry ?? {}).map(([kind, timing]) => ({
    label: kind.replace(/-/g, " "),
    value: [SCHEDULE_DAYS.find(({ code }) => code === scheduleDayCode(timing?.day))?.label ?? timing?.day, timing?.time].filter(Boolean).join(" · ") || "Not provided",
  })));
}

export function scheduleWithoutDates(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).map(([kind, timing]) => [
      kind,
      timing && typeof timing === "object" && !Array.isArray(timing)
        ? Object.fromEntries(Object.entries(timing).filter(([field]) => field !== "date"))
        : timing,
    ]));
  });
}

export function scheduleFieldValue(schedule, kind, field) {
  if (!Array.isArray(schedule)) return "";
  const entry = schedule.find((item) => item && Object.prototype.hasOwnProperty.call(item, kind));
  return String(entry?.[kind]?.[field] ?? "");
}

export function updateScheduleField(schedule, kind, field, value) {
  const nextSchedule = (Array.isArray(schedule) ? schedule : []).map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).map(([name, timing]) => [
      name,
      timing && typeof timing === "object" && !Array.isArray(timing) ? { ...timing } : timing,
    ]));
  });
  let entryIndex = nextSchedule.findIndex((entry) => entry && Object.prototype.hasOwnProperty.call(entry, kind));
  if (entryIndex === -1) {
    nextSchedule.push({ [kind]: { day: "", time: "" } });
    entryIndex = nextSchedule.length - 1;
  }
  const entry = nextSchedule[entryIndex];
  const timing = entry[kind] && typeof entry[kind] === "object" && !Array.isArray(entry[kind]) ? entry[kind] : {};
  nextSchedule[entryIndex] = { ...entry, [kind]: { ...timing, [field]: value } };
  return nextSchedule;
}

export function formatStatusUpdatedAt(date) {
  const dateText = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeText = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dateText} ${timeText}`;
}
