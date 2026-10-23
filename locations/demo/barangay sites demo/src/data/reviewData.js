const REVIEW_STORAGE_KEY = "baguio-barangay-site-review-v2";
const REVIEW_DATA_STORAGE_PREFIX = `${REVIEW_STORAGE_KEY}:`;
const JSON_LIBRARY_STORAGE_KEY = "baguio-barangay-site-json-library-v1";
const ACTIVE_JSON_STORAGE_KEY = "baguio-barangay-site-active-json-v1";
const HIDDEN_BUNDLED_JSON_STORAGE_KEY = "baguio-barangay-site-hidden-bundled-json-v1";
export const BUNDLED_JSON_ID = "bundled-barangay-sites";
export const NO_JSON_REVIEW_ID = "__no-json__";
const BUNDLED_JSON_SOURCE = { name: "barangay_sites.json", kind: "Bundled source" };

function slug(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function explicitPurokNames(value) {
  return [...String(value ?? "").matchAll(/\bpurok\s*#?\s*(\d+)\b/gi)]
    .map((match) => `Purok ${match[1]}`);
}

function siteCoordinates(site) {
  const latitude = String(site?.location?.latitude ?? "").trim();
  const longitude = String(site?.location?.longitude ?? "").trim();
  if (!latitude || !longitude) return { latitude: null, longitude: null };
  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90 ||
    !Number.isFinite(longitudeNumber) || longitudeNumber < -180 || longitudeNumber > 180) {
    return { latitude: null, longitude: null };
  }
  return { latitude: latitudeNumber, longitude: longitudeNumber };
}

function normalizeSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)).map((entry) =>
    Object.fromEntries(Object.entries(entry).map(([kind, timing]) => [
      kind,
      timing && typeof timing === "object" && !Array.isArray(timing) ? { ...timing } : timing,
    ])),
  );
}

function sourceStatusFor(value) {
  return /^removed\b/i.test(String(value ?? "").trim()) ? "removed" : "active";
}

export function buildInitialReview(siteRecords, jsonSource = BUNDLED_JSON_SOURCE) {
  if (!Array.isArray(siteRecords)) throw new Error("Barangay sites JSON must contain a list of site records.");

  const recordsByBarangay = new Map();
  siteRecords.forEach((site) => {
    const name = typeof site?.barangay?.name === "string" ? site.barangay.name.trim() : "";
    if (!name) return;
    if (!recordsByBarangay.has(name)) recordsByBarangay.set(name, []);
    recordsByBarangay.get(name).push(site);
  });

  const barangayEntries = [...recordsByBarangay.entries()].sort(([left], [right]) => left.localeCompare(right));
  const barangays = barangayEntries.map(([name, records], barangayIndex) => {
    const id = `barangay-${String(barangayIndex + 1).padStart(3, "0")}-${slug(name)}`;
    const pins = records.map((site, siteIndex) => {
      const { latitude, longitude } = siteCoordinates(site);
      const rawPurok = String(site?.barangay?.purok ?? "").trim();
      const explicitPuroks = explicitPurokNames(rawPurok);
      const sourceStatusLabel = String(site?.status?.type ?? "").trim();
      const statusLastUpdated = String(site?.status?.last_updated ?? "");
      const sourceSchedule = normalizeSchedule(site?.schedule);
      const sourceRemarks = String(site?.remarks ?? "");
      const location = site?.location && typeof site.location === "object" && !Array.isArray(site.location)
        ? { ...site.location }
        : {};
      const status = site?.status && typeof site.status === "object" && !Array.isArray(site.status)
        ? { ...site.status }
        : {};
      return {
        id: `site-${slug(name)}-${String(siteIndex + 1).padStart(3, "0")}`,
        name: String(site?.site_name ?? "").trim() || `Site ${siteIndex + 1}`,
        sourceNames: [String(site?.site_name ?? "").trim() || `Site ${siteIndex + 1}`],
        latitude,
        longitude,
        site_name: String(site?.site_name ?? "").trim() || "Site " + (siteIndex + 1),
        location,
        googleMapsUrl: String(site?.location?.google_maps_url ?? "").trim(),
        purok: explicitPuroks.length === 1 ? explicitPuroks[0] : "",
        sourcePuroks: rawPurok ? [rawPurok] : [],
        sourceStatus: sourceStatusFor(sourceStatusLabel),
        sourceStatusLabel,
        sourceRowCount: 1,
        statusType: sourceStatusLabel,
        statusLastUpdated,
        status: { ...status, type: sourceStatusLabel, last_updated: statusLastUpdated },
        schedule: normalizeSchedule(sourceSchedule),
        sourceSchedule,
        remarks: sourceRemarks,
        sourceRemarks,
        reviewStatus: "needs_review",
        notes: "",
      };
    });

    return {
      id,
      name,
      puroks: [...new Set(records.flatMap((site) => explicitPurokNames(site?.barangay?.purok)))],
      notes: "",
      confirmed: false,
      confirmationContact: null,
      pins,
      firingLines: [],
    };
  });

  return {
    schemaVersion: 1,
    source: "locations/data/jsons/barangays/barangay_sites.json",
    jsonSource: {
      name: typeof jsonSource?.name === "string" && jsonSource.name.trim() ? jsonSource.name.trim() : BUNDLED_JSON_SOURCE.name,
      kind: typeof jsonSource?.kind === "string" && jsonSource.kind.trim() ? jsonSource.kind.trim() : BUNDLED_JSON_SOURCE.kind,
    },
    sourceRowCount: siteRecords.length,
    sourceCoordinateCount: siteRecords.filter((site) => siteCoordinates(site).latitude !== null).length,
    generatedAt: new Date().toISOString(),
    barangays,
    activityLog: [],
  };
}

function validPoint(point) {
  return Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) &&
    Number(point[0]) >= -90 && Number(point[0]) <= 90 &&
    Number(point[1]) >= -180 && Number(point[1]) <= 180;
}

function normalizedCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function normalizeReviewData(value) {
  const source = value?.reviewData ?? value;
  if (!source || source.schemaVersion !== 1 || !Array.isArray(source.barangays)) {
    throw new Error("This file is not a Barangay Sites review JSON export.");
  }

  const barangays = source.barangays.filter((item) => item && typeof item.name === "string").map((item, index) => ({
    id: typeof item.id === "string" ? item.id : `barangay-import-${index + 1}-${slug(item.name)}`,
    name: item.name.trim(),
    puroks: Array.isArray(item.puroks) ? [...new Set(item.puroks.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim()))] : [],
    notes: typeof item.notes === "string" ? item.notes : "",
    confirmed: item.confirmed === true,
    confirmationContact: item.confirmationContact && typeof item.confirmationContact === "object" && !Array.isArray(item.confirmationContact)
      ? {
        name: typeof item.confirmationContact.name === "string" ? item.confirmationContact.name : "",
        position: typeof item.confirmationContact.position === "string" ? item.confirmationContact.position : "",
        phone: typeof item.confirmationContact.phone === "string" ? item.confirmationContact.phone : "",
        email: typeof item.confirmationContact.email === "string" ? item.confirmationContact.email : "",
      }
      : null,
    pins: Array.isArray(item.pins) ? item.pins.filter((pin) => pin && typeof pin === "object").map((pin, pinIndex) => ({
      ...pin,
      id: typeof pin.id === "string" ? pin.id : `pin-import-${index + 1}-${pinIndex + 1}`,
      name: typeof pin.name === "string" && pin.name.trim() ? pin.name.trim() : `Site ${pinIndex + 1}`,
      latitude: normalizedCoordinate(pin.latitude, -90, 90),
      longitude: normalizedCoordinate(pin.longitude, -180, 180),
      sourceNames: Array.isArray(pin.sourceNames) ? pin.sourceNames.filter((name) => typeof name === "string") : [],
      site_name: typeof pin.site_name === "string" && pin.site_name.trim()
        ? pin.site_name.trim()
        : typeof pin.name === "string" && pin.name.trim() ? pin.name.trim() : "Site " + (pinIndex + 1),
      location: {
        ...(pin.location && typeof pin.location === "object" && !Array.isArray(pin.location) ? pin.location : {}),
        latitude: normalizedCoordinate(pin.latitude, -90, 90),
        longitude: normalizedCoordinate(pin.longitude, -180, 180),
        google_maps_url: typeof pin.location?.google_maps_url === "string"
          ? pin.location.google_maps_url
          : typeof pin.googleMapsUrl === "string" ? pin.googleMapsUrl : "",
      },
      sourcePuroks: Array.isArray(pin.sourcePuroks) ? pin.sourcePuroks.filter((name) => typeof name === "string") : [],
      purok: typeof pin.purok === "string" ? pin.purok : "",
      statusType: typeof pin.statusType === "string"
        ? pin.statusType
        : typeof pin.sourceStatusLabel === "string" ? pin.sourceStatusLabel
          : typeof pin.status?.type === "string" ? pin.status.type : "",
      statusLastUpdated: typeof pin.statusLastUpdated === "string"
        ? pin.statusLastUpdated
        : typeof pin.status?.last_updated === "string" ? pin.status.last_updated : "",
      status: {
        ...(pin.status && typeof pin.status === "object" && !Array.isArray(pin.status) ? pin.status : {}),
        type: typeof pin.statusType === "string" ? pin.statusType
          : typeof pin.sourceStatusLabel === "string" ? pin.sourceStatusLabel
            : typeof pin.status?.type === "string" ? pin.status.type : "",
        last_updated: typeof pin.statusLastUpdated === "string"
          ? pin.statusLastUpdated
          : typeof pin.status?.last_updated === "string" ? pin.status.last_updated : "",
      },
      schedule: normalizeSchedule(pin.schedule ?? pin.sourceSchedule),
      sourceSchedule: normalizeSchedule(pin.sourceSchedule ?? pin.schedule),
      remarks: typeof pin.remarks === "string"
        ? pin.remarks
        : typeof pin.sourceRemarks === "string" ? pin.sourceRemarks : "",
      sourceRemarks: typeof pin.sourceRemarks === "string"
        ? pin.sourceRemarks
        : typeof pin.remarks === "string" ? pin.remarks : "",
      notes: typeof pin.notes === "string" ? pin.notes : "",
      reviewStatus: typeof pin.reviewStatus === "string" ? pin.reviewStatus : "needs_review",
    })) : [],
    firingLines: Array.isArray(item.firingLines) ? item.firingLines.filter((line) => line && Array.isArray(line.coordinates) && line.coordinates.length >= 2 && line.coordinates.every(validPoint)).map((line, lineIndex) => ({
      ...line,
      id: typeof line.id === "string" ? line.id : `line-import-${index + 1}-${lineIndex + 1}`,
      name: typeof line.name === "string" && line.name.trim() ? line.name.trim() : `Firing line ${lineIndex + 1}`,
      coordinates: line.coordinates.map((point) => [Number(point[0]), Number(point[1])]),
      notes: typeof line.notes === "string" ? line.notes : "",
      sample: line.sample === true,
    })) : [],
  }));

  if (barangays.length === 0) throw new Error("The JSON file does not contain any barangays.");
  const fallbackSourceName = typeof source.source === "string" ? source.source.split(/[\\/]/).filter(Boolean).at(-1) : "";
  const jsonSource = source.jsonSource && typeof source.jsonSource === "object" &&
    typeof source.jsonSource.name === "string" && source.jsonSource.name.trim()
    ? {
      name: source.jsonSource.name.trim(),
      kind: typeof source.jsonSource.kind === "string" && source.jsonSource.kind.trim()
        ? source.jsonSource.kind.trim()
        : "Review data",
    }
    : { name: fallbackSourceName || BUNDLED_JSON_SOURCE.name, kind: BUNDLED_JSON_SOURCE.kind };
  return {
    ...source,
    schemaVersion: 1,
    jsonSource,
    barangays,
    activityLog: Array.isArray(source.activityLog) ? source.activityLog.filter((entry) => entry && typeof entry.id === "string").slice(0, 500) : [],
  };
}

export function loadSavedReview(jsonId = BUNDLED_JSON_ID) {
  try {
    const saved = window.localStorage.getItem(`${REVIEW_DATA_STORAGE_PREFIX}${jsonId}`) ??
      (jsonId === BUNDLED_JSON_ID ? window.localStorage.getItem(REVIEW_STORAGE_KEY) : null);
    if (!saved) return null;
    const value = JSON.parse(saved);
    if (jsonId === NO_JSON_REVIEW_ID && value?.schemaVersion === 1 && Array.isArray(value.barangays) && value.barangays.length === 0) {
      return {
        ...value,
        activityLog: Array.isArray(value.activityLog)
          ? value.activityLog.filter((entry) => entry && typeof entry.id === "string").slice(0, 500)
          : [],
      };
    }
    return normalizeReviewData(value);
  } catch {
    return null;
  }
}

export function persistReview(value, jsonId = BUNDLED_JSON_ID) {
  try {
    window.localStorage.setItem(`${REVIEW_DATA_STORAGE_PREFIX}${jsonId}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeSavedReview(jsonId) {
  if (!jsonId || jsonId === NO_JSON_REVIEW_ID) return false;
  try {
    window.localStorage.removeItem(`${REVIEW_DATA_STORAGE_PREFIX}${jsonId}`);
    if (jsonId === BUNDLED_JSON_ID) window.localStorage.removeItem(REVIEW_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadJsonLibrary() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(JSON_LIBRARY_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && typeof item.id === "string" && item.id !== BUNDLED_JSON_ID &&
      typeof item.name === "string" && item.name.trim()).map((item) => ({
      id: item.id,
      name: item.name.trim(),
      kind: typeof item.kind === "string" && item.kind.trim() ? item.kind.trim() : "Imported JSON",
    }));
  } catch {
    return [];
  }
}

export function persistJsonLibrary(library) {
  try {
    window.localStorage.setItem(JSON_LIBRARY_STORAGE_KEY, JSON.stringify(library));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveJsonId() {
  try {
    const savedId = window.localStorage.getItem(ACTIVE_JSON_STORAGE_KEY);
    return savedId === null ? BUNDLED_JSON_ID : savedId;
  } catch {
    return BUNDLED_JSON_ID;
  }
}

export function persistActiveJsonId(jsonId) {
  try {
    window.localStorage.setItem(ACTIVE_JSON_STORAGE_KEY, jsonId);
    return true;
  } catch {
    return false;
  }
}

export function loadBundledJsonHidden() {
  try {
    return window.localStorage.getItem(HIDDEN_BUNDLED_JSON_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistBundledJsonHidden(hidden) {
  try {
    window.localStorage.setItem(HIDDEN_BUNDLED_JSON_STORAGE_KEY, String(Boolean(hidden)));
    return true;
  } catch {
    return false;
  }
}

export function siteRecordCount(barangays) {
  return barangays.reduce((count, barangay) => count + barangay.pins.length, 0);
}

export function createId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}
