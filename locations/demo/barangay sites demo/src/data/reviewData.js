const REVIEW_STORAGE_KEY = "baguio-barangay-site-review-v1";

function slug(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function purokNamesFor(records) {
  return [...new Set(records.flatMap((site) => site.puroks ?? [])
    .filter((value) => /^purok\s+\d+/i.test(value)))];
}

export function buildInitialReview(index) {
  const barangays = index.barangays.map((name, barangayIndex) => {
    const records = index.sites.filter((site) => site.barangays?.includes(name));
    const id = `barangay-${String(barangayIndex + 1).padStart(3, "0")}-${slug(name)}`;
    const pins = records.map((site, siteIndex) => ({
      id: `site-${slug(site.coordinateKey)}-${barangayIndex}`,
      name: site.siteNames?.[0] || `Site ${siteIndex + 1}`,
      sourceNames: site.siteNames ?? [],
      latitude: site.latitude,
      longitude: site.longitude,
      coordinateKey: site.coordinateKey,
      purok: (site.puroks ?? []).find((value) => /^purok\s+\d+/i.test(value)) || "",
      sourcePuroks: site.puroks ?? [],
      sourceStatus: site.status || "active",
      sourceRowCount: site.sourceRowCount || 1,
      reviewStatus: "needs_review",
      notes: "",
    }));

    return {
      id,
      name,
      puroks: purokNamesFor(records),
      notes: "",
      confirmed: false,
      pins,
      firingLines: [],
    };
  });

  // A clearly labeled example gives reviewers a firing line to inspect without
  // presenting it as an official route from the source export.
  const irisan = barangays.find((barangay) => barangay.name === "Irisan");
  if (irisan && irisan.pins.length >= 3) {
    irisan.firingLines.push({
      id: "demo-irisan-route-example",
      name: "Example route segment",
      coordinates: irisan.pins.slice(0, 3).map((pin) => [pin.latitude, pin.longitude]),
      notes: "Illustrative demo line. Please verify its path with barangay officials.",
      sample: true,
    });
  }

  return {
    schemaVersion: 1,
    source: "SWMD collection-site map export",
    sourceRowCount: index.sourceCsvRowCount,
    sourceCoordinateCount: index.sourceCoordinateLocationCount,
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
    pins: Array.isArray(item.pins) ? item.pins.filter((pin) => pin && validPoint([pin.latitude, pin.longitude])).map((pin, pinIndex) => ({
      ...pin,
      id: typeof pin.id === "string" ? pin.id : `pin-import-${index + 1}-${pinIndex + 1}`,
      name: typeof pin.name === "string" && pin.name.trim() ? pin.name.trim() : `Site ${pinIndex + 1}`,
      latitude: Number(pin.latitude),
      longitude: Number(pin.longitude),
      sourceNames: Array.isArray(pin.sourceNames) ? pin.sourceNames.filter((name) => typeof name === "string") : [],
      sourcePuroks: Array.isArray(pin.sourcePuroks) ? pin.sourcePuroks.filter((name) => typeof name === "string") : [],
      purok: typeof pin.purok === "string" ? pin.purok : "",
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
  return {
    ...source,
    schemaVersion: 1,
    barangays,
    activityLog: Array.isArray(source.activityLog) ? source.activityLog.filter((entry) => entry && typeof entry.id === "string").slice(0, 500) : [],
  };
}

export function loadSavedReview() {
  try {
    const saved = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    return saved ? normalizeReviewData(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

export function persistReview(value) {
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function uniqueSiteCount(barangays) {
  const coordinates = new Set();
  barangays.forEach((barangay) => barangay.pins.forEach((pin) => {
    coordinates.add(`${Number(pin.latitude).toFixed(6)},${Number(pin.longitude).toFixed(6)}`);
  }));
  return coordinates.size;
}

export function createId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}
