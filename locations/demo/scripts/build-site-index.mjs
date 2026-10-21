import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const locationsDirectory = resolve(demoDirectory, "..");
const rawMapPath = resolve(
  locationsDirectory,
  "data/csvs/raw/SWMD MAP - Baguio_SWMD_Google_MyMaps.csv",
);
const schedulePath = resolve(locationsDirectory, "data/jsons/schedules/driver_schedule_v3.json");
const outputPath = resolve(demoDirectory, "public/data/maps/swmd_site_index.json");
const comparisonPath = resolve(demoDirectory, "public/data/v3_barangay_comparison.csv");
const coveragePath = resolve(demoDirectory, "public/data/swmd_barangay_coverage.csv");
const summaryPath = resolve(demoDirectory, "public/data/v3_barangay_comparison_summary.md");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  return rows;
}

function numericCoordinate(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinateKey(latitude, longitude) {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function normalizeLabel(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function csvDocument(headers, records) {
  return [headers, ...records].map((record) => record.map(csvCell).join(",")).join("\n") + "\n";
}

function compareV3AreaLabels(schedule, mapByCoordinate, barangayNames) {
  const sourceNamesByNormalized = new Map(
    barangayNames.map((name) => [normalizeLabel(name), name]),
  );
  const comparisons = new Map();

  for (const driver of Array.isArray(schedule) ? schedule : []) {
    for (const day of Array.isArray(driver?.schedule) ? driver.schedule : []) {
      for (const area of Array.isArray(day?.area) ? day.area : []) {
        const label = typeof area?.barangay === "string" && area.barangay.trim()
          ? area.barangay.trim()
          : "[missing v3 area.barangay]";
        const comparison = comparisons.get(label) ?? {
          label,
          areaAssignments: 0,
          siteRecords: 0,
          coordinateBearingSiteRecords: 0,
          matchedSourceSiteRecords: 0,
          unmatchedCoordinateSiteRecords: 0,
          siteRecordsWithoutCoordinates: 0,
          activeLocations: new Set(),
          activeSourceBarangays: new Set(),
          removedSourceBarangays: new Set(),
        };
        comparison.areaAssignments += 1;

        for (const site of Array.isArray(area?.sites) ? area.sites : []) {
          comparison.siteRecords += 1;
          const latitude = numericCoordinate(site?.latitude);
          const longitude = numericCoordinate(site?.longitude);
          if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            comparison.siteRecordsWithoutCoordinates += 1;
            continue;
          }

          comparison.coordinateBearingSiteRecords += 1;
          const key = coordinateKey(latitude, longitude);
          const sourceRows = mapByCoordinate.get(key);
          if (!sourceRows?.length) {
            comparison.unmatchedCoordinateSiteRecords += 1;
            continue;
          }

          comparison.matchedSourceSiteRecords += 1;
          const removed = sourceRows.some((row) => row.status.toLowerCase().includes("removed collection point"));
          if (!removed) comparison.activeLocations.add(key);

          for (const sourceRow of sourceRows) {
            if (!sourceRow.barangay) continue;
            (removed ? comparison.removedSourceBarangays : comparison.activeSourceBarangays).add(sourceRow.barangay);
          }
        }

        comparisons.set(label, comparison);
      }
    }
  }

  return [...comparisons.values()].map((comparison) => ({
    ...comparison,
    directSourceMatch: sourceNamesByNormalized.get(normalizeLabel(comparison.label)) ?? "",
  })).sort((a, b) => a.label.localeCompare(b.label));
}

function collectScheduleCoordinates(schedule) {
  const coordinates = new Set();
  for (const driver of Array.isArray(schedule) ? schedule : []) {
    for (const day of Array.isArray(driver?.schedule) ? driver.schedule : []) {
      for (const area of Array.isArray(day?.area) ? day.area : []) {
        for (const site of Array.isArray(area?.sites) ? area.sites : []) {
          const latitude = numericCoordinate(site?.latitude);
          const longitude = numericCoordinate(site?.longitude);
          if (latitude === null || longitude === null) continue;
          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
          coordinates.add(coordinateKey(latitude, longitude));
        }
      }
    }
  }
  return coordinates;
}

function buildSiteRecord(key, sourceRows) {
  const [latitude, longitude] = key.split(",").map(Number);
  return {
    coordinateKey: key,
    latitude,
    longitude,
    barangays: [...new Set(sourceRows.map((row) => row.barangay).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    siteNames: [...new Set(sourceRows.map((row) => row.siteName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    puroks: [...new Set(sourceRows.map((row) => row.purok).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    sourceRowCount: sourceRows.length,
    status: sourceRows.some((row) => row.status.toLowerCase().includes("removed collection point"))
      ? "removed"
      : "active",
  };
}

const [rawCsv, scheduleText] = await Promise.all([
  readFile(rawMapPath, "utf8"),
  readFile(schedulePath, "utf8"),
]);
const csvRows = parseCsv(rawCsv.replace(/^\uFEFF/, ""));
const headers = csvRows.shift().map((header) => header.trim().toLowerCase());
const column = (name) => headers.indexOf(name.toLowerCase());
const nameIndex = column("Site Name");
const barangayIndex = column("Barangay");
const purokIndex = column("Purok");
const latitudeIndex = column("Latitude");
const longitudeIndex = column("Longitude");
const streetViewIndex = column("Street View");

for (const [name, index] of Object.entries({
  "Site Name": nameIndex,
  Barangay: barangayIndex,
  Latitude: latitudeIndex,
  Longitude: longitudeIndex,
  "Street View": streetViewIndex,
})) {
  if (index < 0) throw new Error(`The raw SWMD CSV is missing the ${name} column.`);
}

const mapByCoordinate = new Map();
const barangayNames = new Set();
for (const row of csvRows) {
  const barangay = (row[barangayIndex] ?? "").trim();
  if (barangay) barangayNames.add(barangay);

  const latitude = numericCoordinate(row[latitudeIndex]);
  const longitude = numericCoordinate(row[longitudeIndex]);
  if (latitude === null || longitude === null) continue;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;

  const key = coordinateKey(latitude, longitude);
  const sourceRow = {
    siteName: (row[nameIndex] ?? "").trim(),
    barangay,
    purok: purokIndex >= 0 ? (row[purokIndex] ?? "").trim() : "",
    status: row.slice(streetViewIndex + 1).map((value) => value.trim()).filter(Boolean).join("; "),
  };
  const group = mapByCoordinate.get(key) ?? [];
  group.push(sourceRow);
  mapByCoordinate.set(key, group);
}
const removedSourceCoordinateCount = [...mapByCoordinate.values()]
  .filter((rows) => rows.some((row) => row.status.toLowerCase().includes("removed collection point")))
  .length;
const activeSourceCoordinateCount = mapByCoordinate.size - removedSourceCoordinateCount;

const schedule = JSON.parse(scheduleText);
const scheduleCoordinates = collectScheduleCoordinates(schedule);
const missingSourceCoordinates = [];
const sourceSites = [...mapByCoordinate.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, sourceRows]) => buildSiteRecord(key, sourceRows));
const sourceSitesByCoordinate = new Map(sourceSites.map((site) => [site.coordinateKey, site]));
const sites = [...scheduleCoordinates].sort().map((key) => {
  const site = sourceSitesByCoordinate.get(key);
  if (!site) missingSourceCoordinates.push(key);
  return site ?? null;
}).filter(Boolean);

if (missingSourceCoordinates.length > 0) {
  throw new Error(`Could not match ${missingSourceCoordinates.length} v3 coordinate(s) to the raw SWMD map: ${missingSourceCoordinates.slice(0, 5).join(", ")}`);
}

const index = {
  sourceCsvRowCount: csvRows.length,
  sourceCoordinateLocationCount: mapByCoordinate.size,
  activeSourceCoordinateLocationCount: activeSourceCoordinateCount,
  removedSourceCoordinateLocationCount: removedSourceCoordinateCount,
  barangays: [...barangayNames].sort((a, b) => a.localeCompare(b)),
  sourceSites,
  sites,
};
await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

const comparisons = compareV3AreaLabels(schedule, mapByCoordinate, index.barangays);
const comparisonCsv = csvDocument(
  [
    "v3_area_barangay_label",
    "area_assignment_count",
    "site_record_count",
    "coordinate_bearing_site_records",
    "matched_source_site_records",
    "unmatched_coordinate_site_records",
    "site_records_without_coordinates",
    "unique_active_source_locations",
    "active_source_barangays_by_coordinate",
    "removed_source_barangays_by_coordinate",
    "direct_canonical_name_match",
  ],
  comparisons.map((comparison) => [
    comparison.label,
    comparison.areaAssignments,
    comparison.siteRecords,
    comparison.coordinateBearingSiteRecords,
    comparison.matchedSourceSiteRecords,
    comparison.unmatchedCoordinateSiteRecords,
    comparison.siteRecordsWithoutCoordinates,
    comparison.activeLocations.size,
    [...comparison.activeSourceBarangays].sort((a, b) => a.localeCompare(b)),
    [...comparison.removedSourceBarangays].sort((a, b) => a.localeCompare(b)),
    comparison.directSourceMatch,
  ]),
);
await writeFile(comparisonPath, comparisonCsv, "utf8");

const sourceCoverage = new Map(index.barangays.map((name) => [name, {
  sourceLocations: new Set(),
  scheduledLocations: new Set(),
  areaLabels: new Set(),
}]));
for (const [key, rows] of mapByCoordinate) {
  if (rows.some((row) => row.status.toLowerCase().includes("removed collection point"))) continue;
  for (const barangay of rows.map((row) => row.barangay).filter(Boolean)) {
    sourceCoverage.get(barangay)?.sourceLocations.add(key);
  }
}
for (const site of sites.filter((record) => record.status === "active")) {
  for (const barangay of site.barangays) {
    sourceCoverage.get(barangay)?.scheduledLocations.add(site.coordinateKey);
  }
}
for (const comparison of comparisons) {
  for (const barangay of comparison.activeSourceBarangays) {
    sourceCoverage.get(barangay)?.areaLabels.add(comparison.label);
  }
}
const coverageRecords = [...sourceCoverage.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([barangay, coverage]) => [
    barangay,
    coverage.sourceLocations.size,
    coverage.scheduledLocations.size,
    [...coverage.sourceLocations].filter((key) => !coverage.scheduledLocations.has(key)).length,
    coverage.areaLabels.size,
    [...coverage.areaLabels].sort((a, b) => a.localeCompare(b)),
  ]);
await writeFile(
  coveragePath,
  csvDocument([
    "source_swmd_barangay",
    "active_source_coordinate_locations",
    "active_v3_scheduled_locations",
    "active_source_locations_not_in_v3",
    "v3_area_label_count",
    "v3_area_labels",
  ], coverageRecords),
  "utf8",
);

const directMatchCount = comparisons.filter((comparison) => comparison.directSourceMatch).length;
const labelsWithOneSourceBarangay = comparisons.filter((comparison) => comparison.activeSourceBarangays.size === 1).length;
const labelsWithMultipleSourceBarangays = comparisons.filter((comparison) => comparison.activeSourceBarangays.size > 1).length;
const labelsWithoutActiveSourceMatch = comparisons.filter((comparison) => comparison.activeSourceBarangays.size === 0).length;
const sourceBarangaysWithoutActiveSites = coverageRecords.filter(([, , scheduledLocations]) => scheduledLocations === 0).map(([name]) => name);
const activeSiteCount = sites.filter((site) => site.status === "active").length;
const removedSiteCount = sites.filter((site) => site.status === "removed").length;
const activeScheduledCoordinates = new Set(sites.filter((site) => site.status === "active").map((site) => site.coordinateKey));
const unscheduledActiveSourceCoordinateCount = [...mapByCoordinate.entries()]
  .filter(([key, rows]) => !activeScheduledCoordinates.has(key) && !rows.some((row) => row.status.toLowerCase().includes("removed collection point")))
  .length;
const summary = [
  "# v3 area labels compared with the SWMD source barangays",
  "",
  `- Source CSV: ${csvRows.length.toLocaleString()} data rows, ${index.barangays.length} distinct non-empty Barangay names, and ${mapByCoordinate.size.toLocaleString()} unique coordinate locations (${activeSourceCoordinateCount.toLocaleString()} active and ${removedSourceCoordinateCount} marked removed).`,
  `- v3 schedule: ${comparisons.reduce((sum, comparison) => sum + comparison.areaAssignments, 0).toLocaleString()} area assignments and ${comparisons.length} distinct area.barangay labels.`,
  `- ${directMatchCount} v3 labels directly match a source barangay name after case and whitespace normalization; ${comparisons.length - directMatchCount} do not.`,
  `- By active site coordinates, ${labelsWithOneSourceBarangay} v3 labels map to one source barangay, ${labelsWithMultipleSourceBarangays} map to multiple source barangays, and ${labelsWithoutActiveSourceMatch} have no active coordinate-linked source barangay.`,
  `- The schedule has ${sites.length.toLocaleString()} distinct coordinate locations: ${activeSiteCount.toLocaleString()} active and ${removedSiteCount} marked removed in the source map.`,
  `- The SWMD CSV has ${activeSourceCoordinateCount.toLocaleString()} active unique coordinate locations; ${unscheduledActiveSourceCoordinateCount} are not referenced by v3.`,
  `- Source barangays with no active coordinate-linked v3 location (${sourceBarangaysWithoutActiveSites.length}): ${sourceBarangaysWithoutActiveSites.join(", ") || "none"}.`,
  "",
  "The label report includes one row for every distinct v3 area.barangay label. Coordinate matches use latitude/longitude rounded to six decimal places against the SWMD CSV. A route label may correspond to multiple canonical barangays, so the coordinate mapping is reported separately from direct name matching.",
  "",
  "Generated by `npm run data:refresh` from the local SWMD CSV and v3 JSON.",
  "",
].join("\n");
await writeFile(summaryPath, summary, "utf8");

console.log(JSON.stringify({
  barangays: index.barangays.length,
  sourceRows: csvRows.length,
  sourceCoordinateLocations: mapByCoordinate.size,
  activeSourceCoordinateLocations: activeSourceCoordinateCount,
  removedSourceCoordinateLocations: removedSourceCoordinateCount,
  v3AreaAssignments: comparisons.reduce((sum, comparison) => sum + comparison.areaAssignments, 0),
  distinctV3AreaLabels: comparisons.length,
  directSourceNameMatches: directMatchCount,
  labelsMappingToOneSourceBarangay: labelsWithOneSourceBarangay,
  labelsMappingToMultipleSourceBarangays: labelsWithMultipleSourceBarangays,
  labelsWithoutActiveCoordinateMatch: labelsWithoutActiveSourceMatch,
  sourceBarangaysWithoutActiveLocations: sourceBarangaysWithoutActiveSites,
  uniqueScheduleLocations: sites.length,
  activeCollectionSites: activeSiteCount,
  activeSourceCoordinatesNotInV3: unscheduledActiveSourceCoordinateCount,
  removedLocations: removedSiteCount,
  unmatchedCoordinates: missingSourceCoordinates.length,
  generatedFiles: [outputPath, comparisonPath, coveragePath, summaryPath],
}, null, 2));
