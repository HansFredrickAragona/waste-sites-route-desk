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

function parseTimeRange(value) {
  const times = [...String(value ?? "").matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.?|P\.M\.?)?\b/gi)]
    .slice(0, 2)
    .map(([, rawHour, rawMinute = "00", rawPeriod = ""]) => {
      let hour = Number(rawHour);
      const minute = Number(rawMinute);
      let period = rawPeriod.toUpperCase().replaceAll(".", "").replace(/\s/g, "");
      if (hour < 0 || hour > 23 || minute > 59) return null;
      if (!period && hour === 0) {
        hour = 12;
        period = "AM";
      } else if (!period && hour > 12) {
        hour -= 12;
        period = "PM";
      }
      return { time: `${hour}:${String(minute).padStart(2, "0")}`, period };
    })
    .filter(Boolean);

  if (times.length > 1) {
    times[0].period ||= times[1].period;
    times[1].period ||= times[0].period;
  }
  return {
    startTime: times[0]?.time ?? "",
    startPeriod: times[0]?.period ?? "",
    endTime: times[1]?.time ?? "",
    endPeriod: times[1]?.period ?? "",
  };
}

function formatScheduleTime(timing) {
  const endpoint = (time, period) => {
    const text = String(time ?? "").trim();
    return text ? `${text}${period ? ` ${period}` : ""}` : "";
  };
  const start = endpoint(timing?.startTime, timing?.startPeriod);
  const end = endpoint(timing?.endTime, timing?.endPeriod);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function emptyScheduleDay() {
  return { day: "", startTime: "", startPeriod: "", endTime: "", endPeriod: "" };
}

function normalizeTimingRows(timing) {
  const values = Array.isArray(timing) ? timing : timing && typeof timing === "object" ? [timing] : [];
  return values.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const dayValue = Array.isArray(item.day) ? item.day.join(", ") : String(item.day ?? "");
    const dayCodes = scheduleDayCodes(dayValue);
    const days = dayCodes.length
      ? dayCodes.map((code) => SCHEDULE_DAYS.find((day) => day.code === code).label)
      : [dayValue];
    const parsedRange = parseTimeRange(item.time);
    const range = {
      startTime: String(item.startTime ?? parsedRange.startTime),
      startPeriod: String(item.startPeriod ?? parsedRange.startPeriod),
      endTime: String(item.endTime ?? parsedRange.endTime),
      endPeriod: String(item.endPeriod ?? parsedRange.endPeriod),
    };
    const extras = Object.fromEntries(Object.entries(item).filter(([field]) =>
      !["day", "date", "time", "startTime", "startPeriod", "endTime", "endPeriod"].includes(field),
    ));
    return days.map((day) => ({ ...extras, day, ...range }));
  });
}

export function normalizeSiteSchedule(schedule) {
  const entries = Array.isArray(schedule) ? schedule : [];
  const siteSchedule = { "pick-up": [], "drop-off": [] };
  // The editor writes one pair of day lists. Keep newly added blank rows in
  // that draft shape, but discard empty placeholders from older groups.
  const isDayListDraft = entries.length === 1 &&
    Object.keys(siteSchedule).every((kind) => Array.isArray(entries[0]?.[kind]));

  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    for (const kind of Object.keys(siteSchedule)) {
      const rows = normalizeTimingRows(entry[kind]);
      siteSchedule[kind].push(...rows.filter((row) => isDayListDraft ||
        Object.values(row).some((value) => String(value ?? "").trim()),
      ));
    }
  }
  return siteSchedule;
}

export function sourceScheduleRows(schedule) {
  const siteSchedule = normalizeSiteSchedule(schedule);
  return ["pick-up", "drop-off"].flatMap((kind) => {
    const timings = siteSchedule[kind];
    if (!timings?.length) return [];
    const details = timings.map((timing) => [timing.day, formatScheduleTime(timing)].filter(Boolean).join(" · "))
      .filter(Boolean).join("; ");
    const label = kind.replace(/-/g, " ");
    return [{ label, value: details || "Not provided" }];
  });
}

export function scheduleWithoutDates(schedule) {
  const siteSchedule = normalizeSiteSchedule(schedule);
  const cleanSchedule = {};
  ["pick-up", "drop-off"].forEach((kind) => {
    const cleanTimings = siteSchedule[kind].flatMap((timing) => {
      const day = String(timing.day ?? "").trim();
      const time = formatScheduleTime(timing);
      const extras = Object.fromEntries(Object.entries(timing).filter(([field]) =>
        !["day", "date", "time", "startTime", "startPeriod", "endTime", "endPeriod"].includes(field),
      ));
      if (!day && !time && !Object.values(extras).some((value) => String(value ?? "").trim())) return [];
      return [{ ...extras, ...(day ? { day } : {}), ...(time ? { time } : {}) }];
    });
    if (cleanTimings.length === 1) cleanSchedule[kind] = cleanTimings[0];
    else if (cleanTimings.length > 1) cleanSchedule[kind] = cleanTimings;
  });
  return Object.keys(cleanSchedule).length ? [cleanSchedule] : [];
}

export function scheduleDayEntries(schedule, kind) {
  const rows = normalizeSiteSchedule(schedule)[kind] ?? [];
  return rows.length ? rows : [emptyScheduleDay()];
}

export function updateScheduleEntry(schedule, kind, entryIndex, fields) {
  const siteSchedule = normalizeSiteSchedule(schedule);
  const rows = [...(siteSchedule[kind]?.length ? siteSchedule[kind] : [emptyScheduleDay()])];
  while (rows.length <= entryIndex) rows.push(emptyScheduleDay());
  rows[entryIndex] = { ...rows[entryIndex], ...fields };
  return [{ ...siteSchedule, [kind]: rows }];
}

export function addScheduleDay(schedule, kind) {
  const siteSchedule = normalizeSiteSchedule(schedule);
  const rows = siteSchedule[kind]?.length ? siteSchedule[kind] : [emptyScheduleDay()];
  return [{ ...siteSchedule, [kind]: [...rows, emptyScheduleDay()] }];
}

export function removeScheduleDay(schedule, kind, entryIndex) {
  const siteSchedule = normalizeSiteSchedule(schedule);
  const rows = (siteSchedule[kind] ?? []).filter((_, rowIndex) => rowIndex !== entryIndex);
  return [{ ...siteSchedule, [kind]: rows }];
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
