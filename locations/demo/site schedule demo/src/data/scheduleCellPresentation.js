function normalizedLabel(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()
    : "";
}

export function isQrtAreaName(value) {
  return typeof value === "string" && /\bqrt\b/i.test(value.normalize("NFKC"));
}

export function isUnmappedAreaSegment(segment) {
  return !Array.isArray(segment?.coordinates) || segment.coordinates.length < 2;
}

function isUndefinedFiringLineSite(site) {
  return normalizedLabel(site?.siteName ?? site?.site_name).replace(/\s+/g, "") === "firingline"
    && !site?.hasCoordinates;
}

function summarizeLocationStatus(areas) {
  const firstArea = areas[0];
  if (isQrtAreaName(firstArea?.areaName || firstArea?.sourceAreaName || firstArea?.barangay)) {
    return {
      mappedSiteCount: 0,
      missingCoordinateCount: 0,
      removedSiteCount: 0,
      unmatchedSiteCount: 0,
      emptyAreaCount: 0,
      mixed: false,
      warning: null,
      status: "qrt",
    };
  }

  const sites = areas
    .flatMap((area) => Array.isArray(area.sites) ? area.sites : [])
    .filter((site) => !isUndefinedFiringLineSite(site));
  const mappedSiteCount = sites.filter(
    (site) => site.hasCoordinates && site.catalogStatus !== "removed",
  ).length;
  const missingCoordinateCount = sites.filter((site) => !site.hasCoordinates).length;
  const removedSiteCount = sites.filter(
    (site) => site.hasCoordinates && site.catalogStatus === "removed",
  ).length;
  const unmatchedSiteCount = sites.filter(
    (site) => site.hasCoordinates && site.catalogStatus !== "active" && site.catalogStatus !== "removed",
  ).length;
  const emptyAreaCount = areas.filter(
    (area) => !Array.isArray(area.sites) || area.sites.length === 0,
  ).length;
  const hasUnmappedSites = missingCoordinateCount > 0 || removedSiteCount > 0 || emptyAreaCount > 0;
  const mixed = mappedSiteCount > 0 && hasUnmappedSites;
  const warningParts = [];

  if (missingCoordinateCount > 0) {
    warningParts.push(`${missingCoordinateCount} site${missingCoordinateCount === 1 ? "" : "s"} need a map location`);
  }
  if (removedSiteCount > 0) {
    warningParts.push(`${removedSiteCount} site${removedSiteCount === 1 ? "" : "s"} marked removed`);
  }
  if (unmatchedSiteCount > 0) {
    warningParts.push(`${unmatchedSiteCount} coordinate${unmatchedSiteCount === 1 ? "" : "s"} not in the SWMD index`);
  }
  if (emptyAreaCount > 0) {
    warningParts.push(`${emptyAreaCount} area record${emptyAreaCount === 1 ? "" : "s"} have no site records`);
  }
  if (areas.length > 1) {
    warningParts.push(`${areas.length} repeated area records grouped`);
  }

  return {
    mappedSiteCount,
    missingCoordinateCount,
    removedSiteCount,
    unmatchedSiteCount,
    emptyAreaCount,
    mixed,
    warning: warningParts.length > 0 ? warningParts.join("; ") : null,
    status: mappedSiteCount > 0 ? (mixed ? "mixed" : "mapped") : "unmapped",
  };
}

export function groupAreaAssignments(areas) {
  const groups = new Map();

  areas.forEach((area, index) => {
    const areaName = area.areaName || area.barangay || "Area name not provided";
    const barangayKey = normalizedLabel(area.barangay);
    const areaKey = normalizedLabel(areaName);
    const key = barangayKey || areaKey
      ? `${barangayKey}::${areaKey}`
      : `missing-label-${index}`;
    const existing = groups.get(key);

    if (existing) {
      existing.records.push(area);
      return;
    }

    groups.set(key, {
      id: area.id || key,
      areaName,
      records: [area],
    });
  });

  return Array.from(groups.values()).map((group) => {
    const locationStatus = summarizeLocationStatus(group.records);

    return {
      ...group,
      ...locationStatus,
    };
  });
}
