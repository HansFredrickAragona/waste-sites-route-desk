export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const ALL_BARANGAYS = "__all__";

export const PIN_STATUS_OPTIONS = [
  { value: "Existing", key: "existing" },
  { value: "With remarks", key: "remarks" },
  { value: "Unverified / For Checking", key: "unchecked" },
  { value: "Removed collection point", key: "removed" },
  { value: "Corrected/Adjusted", key: "corrected" },
];

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedLabel(value) {
  return textValue(value).normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function coordinateValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasValidCoordinates(latitude, longitude) {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function coordinateKey(latitude, longitude) {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function resolvePinStatus(value) {
  const normalized = normalizedLabel(value);
  if (normalized.includes("removed")) return PIN_STATUS_OPTIONS[3];
  if (normalized.includes("corrected") || normalized.includes("adjusted")) return PIN_STATUS_OPTIONS[4];
  if (normalized.includes("remark")) return PIN_STATUS_OPTIONS[1];
  if (normalized.includes("existing")) return PIN_STATUS_OPTIONS[0];
  return PIN_STATUS_OPTIONS[2];
}

function createIssueCounts() {
  return {
    malformedDriverRecords: 0,
    missingDriverNames: 0,
    missingSchedules: 0,
    malformedScheduleEntries: 0,
    unknownDays: 0,
    malformedAreas: 0,
    missingBarangays: 0,
    missingAreaNames: 0,
    missingSiteArrays: 0,
    malformedSites: 0,
    sitesWithoutCoordinates: 0,
    siteCoordinatesWithoutSourceMatch: 0,
    sitesWithoutNames: 0,
    sitesWithoutMapLabels: 0,
  };
}

function describeIssues(counts) {
  const messages = [];
  const add = (count, message) => {
    if (count > 0) messages.push(`${count} ${message}`);
  };

  add(counts.malformedDriverRecords, "driver record(s) were unreadable and skipped.");
  add(counts.missingDriverNames, "driver record(s) do not include a driver name.");
  add(counts.missingSchedules, "driver record(s) do not include a readable schedule.");
  add(counts.malformedScheduleEntries, "schedule entr(y/ies) were unreadable and skipped.");
  add(counts.unknownDays, "schedule entr(y/ies) use a missing or unrecognized day and were skipped.");
  add(counts.malformedAreas, "area record(s) were unreadable and skipped.");
  add(counts.missingBarangays, "area record(s) do not include a barangay and cannot match a barangay filter.");
  add(counts.missingAreaNames, "area record(s) do not include a day-level area name, `area_name`, or `barangay`; the cell will show that the area name is missing.");
  add(counts.missingSiteArrays, "area record(s) do not include a readable sites list.");
  add(counts.malformedSites, "site record(s) were unreadable and skipped.");
  add(counts.sitesWithoutCoordinates, "site record(s) have missing or invalid coordinates and cannot be mapped.");
  add(counts.siteCoordinatesWithoutSourceMatch, "coordinate-bearing site record(s) are not in the raw SWMD source index; valid coordinates can still appear on the map.");
  add(counts.sitesWithoutNames, "site record(s) do not include `site_name`; their detail card will say so.");
  add(counts.sitesWithoutMapLabels, "site record(s) do not include `map_label`; their detail card will say so.");
  return messages;
}

export function buildScheduleModel(source, siteIndex, version = "v3", dayAreaLabels = {}) {
  const issueCounts = createIssueCounts();
  const drivers = [];
  const scheduleAreaLabels = new Set();
  let areaCount = 0;
  let siteCount = 0;
  let coordinateBearingSiteOccurrences = 0;

  const scheduleCatalogSites = Array.isArray(siteIndex?.sites) ? siteIndex.sites : [];
  const catalogSites = Array.isArray(siteIndex?.sourceSites)
    ? siteIndex.sourceSites
    : scheduleCatalogSites;
  const catalogByCoordinate = new Map(
    catalogSites.map((site) => [site.coordinateKey, site]),
  );
  const scheduledLocationStatuses = new Map();
  const canonicalBarangays = Array.isArray(siteIndex?.barangays)
    ? [...new Set(siteIndex.barangays.map(textValue).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : [];
  const canonicalByLabel = new Map(
    canonicalBarangays.map((barangay) => [normalizedLabel(barangay), barangay]),
  );

  if (!Array.isArray(source)) {
    return {
      drivers,
      barangays: canonicalBarangays,
      issues: [`The ${version.toUpperCase()} JSON must contain a top-level array of driver records.`],
      contextNotes: [],
      stats: {
        driverCount: 0,
        barangayCount: canonicalBarangays.length,
        areaCount: 0,
        collectionSiteCount: scheduleCatalogSites.filter((site) => site.status === "active").length,
      },
    };
  }

  source.forEach((record, driverIndex) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      issueCounts.malformedDriverRecords += 1;
      return;
    }

    const driverRecord = record.driver && typeof record.driver === "object" && !Array.isArray(record.driver)
      ? record.driver
      : { name: record.driver };
    const driverName = textValue(driverRecord.name);
    if (!driverName) issueCounts.missingDriverNames += 1;

    const days = Object.fromEntries(DAYS.map((day) => [day, []]));
    if (!Array.isArray(record.schedule)) {
      issueCounts.missingSchedules += 1;
    } else {
      record.schedule.forEach((entry, entryIndex) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          issueCounts.malformedScheduleEntries += 1;
          return;
        }

        const day = textValue(entry.day);
        if (!DAYS.includes(day)) {
          issueCounts.unknownDays += 1;
          return;
        }

        const dayArea = entry.area && typeof entry.area === "object" && !Array.isArray(entry.area)
          ? entry.area
          : null;
        const dayAreaName = textValue(dayAreaLabels?.[driverName]?.[day]) || textValue(dayArea?.name);
        const rawAreas = dayArea ? dayArea.details : entry.area;
        if (!Array.isArray(rawAreas)) {
          issueCounts.malformedAreas += 1;
        }

        const areas = Array.isArray(rawAreas)
          ? rawAreas.flatMap((area, areaIndex) => {
              if (!area || typeof area !== "object" || Array.isArray(area)) {
                issueCounts.malformedAreas += 1;
                return [];
              }

              areaCount += 1;
              const barangay = textValue(area.barangay);
              const assignedMapBarangay = canonicalByLabel.get(normalizedLabel(barangay));
              const routeSegment = textValue(area.route_segment);
              const sourceAreaName = textValue(area.area_name) ||
                (Array.isArray(area.source_areas) ? area.source_areas.map(textValue).filter(Boolean).join(", ") : "") ||
                routeSegment;
              const unmappedSegments = Array.isArray(area.unmapped_segments)
                ? area.unmapped_segments.flatMap((segment, sourceIndex) => {
                  if (!segment || typeof segment !== "object") return [];
                  const coordinates = Array.isArray(segment.coordinates)
                    ? segment.coordinates.flatMap((point) => {
                      if (!Array.isArray(point) || point.length < 2) return [];
                      const latitude = coordinateValue(point[0]);
                      const longitude = coordinateValue(point[1]);
                      return hasValidCoordinates(latitude, longitude) ? [[latitude, longitude]] : [];
                    })
                    : [];
                  const name = textValue(segment.name);
                  return name ? [{
                    name,
                    type: textValue(segment.type),
                    sourceIndex,
                    coordinates,
                  }] : [];
                })
                : [];
              const areaName = sourceAreaName || barangay || dayAreaName;
              if (!barangay) issueCounts.missingBarangays += 1;
              if (!areaName) issueCounts.missingAreaNames += 1;
              if (barangay) scheduleAreaLabels.add(barangay);

              let rawSites = area.sites;
              if (rawSites !== undefined && !Array.isArray(rawSites)) {
                issueCounts.missingSiteArrays += 1;
                rawSites = [];
              }
              if (rawSites === undefined) {
                issueCounts.missingSiteArrays += 1;
                rawSites = [];
              }

              const sites = rawSites.flatMap((site, siteIndex) => {
                if (!site || typeof site !== "object" || Array.isArray(site)) {
                  issueCounts.malformedSites += 1;
                  return [];
                }

                siteCount += 1;
                const latitude = coordinateValue(site.latitude);
                const longitude = coordinateValue(site.longitude);
                const hasCoordinates = hasValidCoordinates(latitude, longitude);
                const siteCoordinateKey = hasCoordinates ? coordinateKey(latitude, longitude) : null;
                const hasManualMapOverride = site.manual_override === true;
                const catalogSite = hasCoordinates
                  ? catalogByCoordinate.get(siteCoordinateKey)
                  : null;
                const annotationStatus = textValue(site.Status);
                const pinStatus = resolvePinStatus(annotationStatus);
                const annotationMarksRemoved = pinStatus.key === "removed";
                const catalogStatus = annotationMarksRemoved
                  ? "removed"
                  : hasManualMapOverride
                    ? "active"
                    : catalogSite?.status ?? "unmatched";
                if (hasCoordinates) {
                  coordinateBearingSiteOccurrences += 1;
                  scheduledLocationStatuses.set(
                    siteCoordinateKey,
                    catalogStatus === "unmatched" ? "active" : catalogStatus,
                  );
                  if (!catalogSite) issueCounts.siteCoordinatesWithoutSourceMatch += 1;
                } else {
                  issueCounts.sitesWithoutCoordinates += 1;
                }

                const siteName = textValue(site.site_name);
                const mapLabel = textValue(site.map_label);
                const explicitBarangay = Object.prototype.hasOwnProperty.call(site, "barangay")
                  ? textValue(site.barangay)
                  : "";
                const explicitMapBarangay = canonicalByLabel.get(normalizedLabel(explicitBarangay));
                const mapBarangays = explicitMapBarangay
                  ? [explicitMapBarangay]
                  : assignedMapBarangay
                    ? [assignedMapBarangay]
                    : (catalogSite?.barangays ?? []).filter((name) => canonicalByLabel.has(normalizedLabel(name)));
                if (!siteName) issueCounts.sitesWithoutNames += 1;
                if (!mapLabel) issueCounts.sitesWithoutMapLabels += 1;

                return [
                  {
                    ...site,
                    id: `${driverIndex}-${day}-${entryIndex}-${areaIndex}-${siteIndex}`,
                    siteName,
                    mapLabel,
                    latitude,
                    longitude,
                    hasCoordinates,
                    sourceBarangays: catalogSite?.barangays ?? [],
                    sourceSiteNames: catalogSite?.siteNames ?? [],
                    sourcePuroks: catalogSite?.puroks ?? [],
                    mapBarangays,
                    catalogStatus,
                    pinStatus: pinStatus.value,
                    pinStatusKey: pinStatus.key,
                    barangay: explicitBarangay || barangay,
                    hasExplicitBarangay: Object.prototype.hasOwnProperty.call(site, "barangay"),
                    assignedBarangay: barangay,
                    areaName,
                    sourceAreaName,
                    dayAreaName,
                    driverName,
                    day,
                    pickupTime: textValue(area["pick up time"]),
                    sourceRef: { driverIndex, day, entryIndex, areaIndex, siteIndex },
                  },
                ];
              });

              return [
                {
                  id: `${driverIndex}-${day}-${entryIndex}-${areaIndex}`,
                  barangay,
                  areaName,
                  sourceAreaName,
                  dayAreaName,
                  mapBarangays: assignedMapBarangay
                    ? [assignedMapBarangay]
                    : [...new Set(sites.flatMap((site) => site.mapBarangays))],
                  routeSegment,
                  unmappedSegments,
                  pickupTime: textValue(area["pick up time"]),
                  sites,
                  sourceRef: { driverIndex, day, entryIndex, areaIndex },
                },
              ];
            })
          : [];

        if (dayArea?.type === "relief") {
          areaCount += 1;
          areas.push({
            id: `${driverIndex}-${day}-relief`,
            barangay: "",
            areaName: dayAreaName || "QRT",
            sourceAreaName: textValue(dayArea.source_area_name),
            dayAreaName: dayAreaName || "QRT",
            mapBarangays: [],
            pickupTime: textValue(entry.time),
            sites: [],
            unmappedSegments: [],
            assignmentType: "relief",
            sourceRef: { driverIndex, day, entryIndex },
          });
        }

        days[day].push({
          time: textValue(entry.time),
          areaName: dayAreaName,
          areas,
        });
      });
    }

    drivers.push({
      id: `driver-${driverIndex}`,
      name: driverName || `Driver name missing (record ${driverIndex + 1})`,
      type: textValue(driverRecord.type),
      truck: Array.isArray(driverRecord.truck) ? driverRecord.truck.map(textValue).filter(Boolean) : [],
      days,
    });
  });

  const canonicalBarangayLabels = new Set(canonicalBarangays.map(normalizedLabel));
  const directBarangayMatchCount = [...scheduleAreaLabels]
    .filter((label) => canonicalBarangayLabels.has(normalizedLabel(label))).length;
  const activeScheduledLocationCount = [...scheduledLocationStatuses.values()]
    .filter((status) => status !== "removed").length;
  const removedScheduledLocationCount = [...scheduledLocationStatuses.values()]
    .filter((status) => status === "removed").length;
  const uniqueScheduledLocationCount = scheduledLocationStatuses.size;
  const activeSourceLocationCount = Number(siteIndex?.activeSourceCoordinateLocationCount) || 0;
  const sourceCoordinateLocationCount = Number(siteIndex?.sourceCoordinateLocationCount) || 0;
  const sourceLocationsNotScheduled = catalogSites.filter(
    (site) => site.status === "active" && !scheduledLocationStatuses.has(site.coordinateKey),
  ).length;

  return {
    drivers,
    barangays: canonicalBarangays,
    issues: describeIssues(issueCounts),
    contextNotes: [
      `The ${version.toUpperCase()} schedule has ${scheduleAreaLabels.size} distinct area.barangay labels. ${directBarangayMatchCount} directly match the ${canonicalBarangays.length} canonical SWMD barangay names; the remaining ${scheduleAreaLabels.size - directBarangayMatchCount} need the coordinate comparison to interpret.`,
      `The SWMD CSV has ${Number(siteIndex?.sourceCsvRowCount) || 0} rows and ${sourceCoordinateLocationCount.toLocaleString()} unique coordinate locations (${activeSourceLocationCount.toLocaleString()} active). The ${version.toUpperCase()} schedule references ${activeScheduledLocationCount.toLocaleString()} active unique locations; ${sourceLocationsNotScheduled.toLocaleString()} active source locations are not referenced by this schedule.`,
      `${coordinateBearingSiteOccurrences.toLocaleString()} is the count of coordinate-bearing ${version.toUpperCase()} site entries, including repeated schedule occurrences; these resolve to ${uniqueScheduledLocationCount.toLocaleString()} unique locations, with ${removedScheduledLocationCount} marked removed.`,
    ],
    stats: {
      driverCount: drivers.length,
      barangayCount: canonicalBarangays.length,
      areaCount,
      collectionSiteCount: activeScheduledLocationCount,
      scheduleSiteRecordCount: siteCount,
      coordinateBearingSiteOccurrenceCount: coordinateBearingSiteOccurrences,
      uniqueLocationCount: uniqueScheduledLocationCount,
    },
  };
}

export function getAreasForCell(driver, day, selectedBarangay = ALL_BARANGAYS) {
  const entries = driver?.days?.[day] ?? [];
  const areas = entries.flatMap((entry) => entry.areas);
  if (selectedBarangay === ALL_BARANGAYS) return areas;

  return areas.flatMap((area) => {
    const sites = area.sites.filter(
      (site) => site.catalogStatus === "active" &&
        site.mapBarangays.some((barangay) => normalizedLabel(barangay) === normalizedLabel(selectedBarangay)),
    );
    if (sites.length > 0) return [{ ...area, sites }];
    return area.mapBarangays.some((barangay) => normalizedLabel(barangay) === normalizedLabel(selectedBarangay))
      ? [{ ...area, sites: [] }]
      : [];
  });
}

export function getSitesForAreas(areas) {
  return areas.flatMap((area) => area.sites);
}

export function getBarangaysForAreas(areas) {
  const available = new Map();

  for (const area of areas) {
    const label = textValue(area.barangay) ||
      textValue(area.sourceAreaName) ||
      textValue(area.dayAreaName) ||
      textValue(area.areaName);
    const key = normalizedLabel(label);
    if (key && !available.has(key)) available.set(key, label);
  }

  return [...available.values()];
}
