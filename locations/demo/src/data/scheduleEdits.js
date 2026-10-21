import { normalizeCellStatuses } from "./cellReview.js";

const EDIT_STORAGE_PREFIX = "baguio-driver-schedule-edits:";

function storageKey(version) {
  return `${EDIT_STORAGE_PREFIX}${encodeURIComponent(version)}`;
}

export function loadScheduleEdits() {
  if (typeof window === "undefined") return {};

  const edits = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(EDIT_STORAGE_PREFIX)) continue;
      const version = decodeURIComponent(key.slice(EDIT_STORAGE_PREFIX.length));
      const edit = JSON.parse(window.localStorage.getItem(key));
      if (Array.isArray(edit?.schedule)) {
        edits[version] = {
          ...edit,
          mapFeatures: Array.isArray(edit.mapFeatures) ? edit.mapFeatures : [],
          cellStatuses: normalizeCellStatuses(edit.cellStatuses),
        };
      }
    }
  } catch {
    // Ignore unavailable or corrupt browser drafts and keep the bundled schedule available.
  }
  return edits;
}

export function persistScheduleEdit(version, edit) {
  window.localStorage.setItem(storageKey(version), JSON.stringify(edit));
}

export function removeScheduleEdit(version) {
  window.localStorage.removeItem(storageKey(version));
}

export function parseScheduleFile(parsed) {
  if (Array.isArray(parsed)) return { schedule: parsed, mapFeatures: [], cellStatuses: {} };

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.schedule)) {
    const mapFeatures = Array.isArray(parsed.map_features)
      ? parsed.map_features
      : Array.isArray(parsed.firing_lines)
        ? parsed.firing_lines
        : [];
    const malformedFeature = mapFeatures.some((feature) => {
      const minimumPoints = feature?.feature_type === "bounded_area" ? 3 : 2;
      return !feature ||
        typeof feature.id !== "string" ||
        !["firing_line", "bounded_area"].includes(feature.feature_type) ||
        !Array.isArray(feature.coordinates) ||
        feature.coordinates.length < minimumPoints ||
        feature.coordinates.some((point) =>
          !Array.isArray(point) ||
          point.length < 2 ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]) ||
          point[0] < -90 || point[0] > 90 || point[1] < -180 || point[1] > 180);
    });
    if (malformedFeature) throw new Error("map_features contains an invalid firing-line or bounded-area record");
    return {
      schedule: parsed.schedule,
      mapFeatures,
      cellStatuses: normalizeCellStatuses(parsed.cell_statuses),
    };
  }

  throw new Error("expected a driver-record array or an exported schedule object with a schedule array");
}

export function createScheduleExport({ version, basedOn, schedule, mapFeatures, cellStatuses = {} }) {
  return {
    format: "baguio-driver-schedule",
    version,
    based_on: basedOn,
    exported_at: new Date().toISOString(),
    schedule,
    map_features: mapFeatures,
    cell_statuses: normalizeCellStatuses(cellStatuses),
  };
}
