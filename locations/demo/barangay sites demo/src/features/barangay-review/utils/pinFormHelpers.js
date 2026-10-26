export function coordinateText(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

export const SCHEDULE_DAYS = [
  { code: "MON", label: "Monday", shortLabel: "Mon" },
  { code: "TUES", label: "Tuesday", shortLabel: "Tue" },
  { code: "WED", label: "Wednesday", shortLabel: "Wed" },
  { code: "THURS", label: "Thursday", shortLabel: "Thu" },
  { code: "FRI", label: "Friday", shortLabel: "Fri" },
  { code: "SAT", label: "Saturday", shortLabel: "Sat" },
  { code: "SUN", label: "Sunday", shortLabel: "Sun" },
];

const SCHEDULE_DAY_ALIASES = {
  MON: ["MON", "MONDAY", "M"],
  TUES: ["TUE", "TUES", "TUESDAY", "TU", "T"],
  WED: ["WED", "WEDNESDAY", "W"],
  THURS: ["THU", "THUR", "THURS", "THURSDAY", "TH"],
  FRI: ["FRI", "FRIDAY", "F"],
  SAT: ["SAT", "SATURDAY", "SA"],
  SUN: ["SUN", "SUNDAY", "SU"],
};

const COMPACT_SCHEDULE_DAYS = {
  MW: ["MON", "WED"],
  MWF: ["MON", "WED", "FRI"],
  TTH: ["TUES", "THURS"],
  TR: ["TUES", "THURS"],
};

export function scheduleDayCodes(value) {
  const text = (Array.isArray(value) ? value.join(",") : String(value ?? ""))
    .toUpperCase()
    .replace(/\bAND\b/g, ",");
  const selected = new Set();

  text.split(/[\s,/&+;]+/).filter(Boolean).forEach((token) => {
    const compactDays = COMPACT_SCHEDULE_DAYS[token];
    if (compactDays) {
      compactDays.forEach((code) => selected.add(code));
      return;
    }
    const day = Object.entries(SCHEDULE_DAY_ALIASES).find(([, aliases]) => aliases.includes(token));
    if (day) selected.add(day[0]);
  });

  return SCHEDULE_DAYS.filter(({ code }) => selected.has(code)).map(({ code }) => code);
}

export function scheduleDayCode(value) {
  return scheduleDayCodes(value)[0] ?? "";
}

export function emptyScheduleGroup() {
  return {
    "pick-up": { day: "", time: "" },
    "drop-off": { day: "", time: "" },
  };
}

export function normalizeScheduleGroups(schedule) {
  if (!Array.isArray(schedule)) return [];

  const groups = [];
  let pickupCount = 0;
  let dropoffCount = 0;
  const ensureGroup = (index) => {
    while (groups.length <= index) groups.push({});
    return groups[index];
  };
  const copyTiming = (timing) => timing && typeof timing === "object" && !Array.isArray(timing)
    ? { ...timing, day: Array.isArray(timing.day) ? timing.day.join(", ") : String(timing.day ?? ""), time: String(timing.time ?? "") }
    : { day: "", time: "" };

  schedule.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const hasPickup = Object.prototype.hasOwnProperty.call(entry, "pick-up");
    const hasDropoff = Object.prototype.hasOwnProperty.call(entry, "drop-off");
    if (!hasPickup && !hasDropoff) return;

    if (hasPickup && hasDropoff) {
      const index = Math.max(pickupCount, dropoffCount);
      const group = ensureGroup(index);
      group["pick-up"] = copyTiming(entry["pick-up"]);
      group["drop-off"] = copyTiming(entry["drop-off"]);
      pickupCount = index + 1;
      dropoffCount = index + 1;
      return;
    }

    if (hasPickup) {
      ensureGroup(pickupCount)["pick-up"] = copyTiming(entry["pick-up"]);
      pickupCount += 1;
    }
    if (hasDropoff) {
      ensureGroup(dropoffCount)["drop-off"] = copyTiming(entry["drop-off"]);
      dropoffCount += 1;
    }
  });

  return groups;
}

export function addScheduleGroup(schedule) {
  const groups = normalizeScheduleGroups(schedule);
  if (!groups.length) groups.push(emptyScheduleGroup());
  return [...groups, emptyScheduleGroup()];
}

export function removeScheduleGroup(schedule, index) {
  return normalizeScheduleGroups(schedule).filter((_, groupIndex) => groupIndex !== index);
}

export function sourceScheduleRows(schedule) {
  const groups = normalizeScheduleGroups(schedule);
  return groups.flatMap((group, index) => ["pick-up", "drop-off"].flatMap((kind) => {
    const timing = group[kind];
    if (!timing) return [];
    const dayCodes = scheduleDayCodes(timing.day);
    const days = dayCodes.length
      ? dayCodes.map((code) => SCHEDULE_DAYS.find((day) => day.code === code).label).join(", ")
      : timing.day;
    const label = `${kind.replace(/-/g, " ")}${groups.length > 1 ? ` ${index + 1}` : ""}`;
    return [{ label, value: [days, timing.time].filter(Boolean).join(" · ") || "Not provided" }];
  }));
}

export function scheduleWithoutDates(schedule) {
  return normalizeScheduleGroups(schedule).flatMap((group) => {
    const cleanGroup = {};
    ["pick-up", "drop-off"].forEach((kind) => {
      const timing = group[kind];
      if (!timing) return;
      const cleanTiming = Object.fromEntries(Object.entries(timing).filter(([field]) => field !== "date"));
      const hasValue = Object.values(cleanTiming).some((value) => String(value ?? "").trim());
      if (hasValue) cleanGroup[kind] = cleanTiming;
    });
    return Object.keys(cleanGroup).length ? [cleanGroup] : [];
  });
}

export function scheduleFieldValue(schedule, index, kind, field) {
  const group = normalizeScheduleGroups(schedule)[index];
  const value = group?.[kind]?.[field];
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

export function updateScheduleField(schedule, index, kind, field, value) {
  const groups = normalizeScheduleGroups(schedule);
  while (groups.length <= index) groups.push(emptyScheduleGroup());
  const group = groups[index];
  const timing = group[kind] && typeof group[kind] === "object" ? group[kind] : { day: "", time: "" };
  groups[index] = { ...group, [kind]: { ...timing, [field]: value } };
  return groups;
}

export function formatStatusUpdatedAt(date) {
  const dateText = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeText = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dateText} ${timeText}`;
}

export function dateTimeFieldValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const localValue = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (localValue && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return `${localValue[1]}T${localValue[2]}`;

  const displayValue = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (displayValue) {
    const [, day, month, year, hourText, minute, meridiem] = displayValue;
    const hour = Number(hourText) % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0);
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
