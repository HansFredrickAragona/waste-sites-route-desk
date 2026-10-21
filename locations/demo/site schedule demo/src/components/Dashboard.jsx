import { useEffect, useRef, useState } from "react";
import { groupAreaAssignments, isQrtAreaName, isUnmappedAreaSegment } from "../data/scheduleCellPresentation.js";
import { DAYS } from "../data/scheduleModel.js";

function formatted(value) {
  return value.toLocaleString();
}

function normalizeName(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function isUsableLine(feature) {
  return Array.isArray(feature.coordinates) &&
    feature.coordinates.length >= 2 &&
    feature.coordinates.every((point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      point[0] >= -90 && point[0] <= 90 &&
      point[1] >= -180 && point[1] <= 180);
}

function scheduleAreaLabel(area) {
  return area.dayAreaName || area.areaName || area.sourceAreaName || area.barangay || "Area name not provided";
}

function cleanDashboardAreaName(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").replace(/\s*\(\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|nn)\s*\)\s*$/i, "")
    : "";
}

function splitAreaList(value) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth = Math.max(0, depth - 1);
    if (value[index] === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function dashboardAreaNames(area) {
  const sourceName = area.sourceAreaName || area.areaName || area.barangay || area.dayAreaName || "Area name not provided";
  return splitAreaList(sourceName)
    .map(cleanDashboardAreaName)
    .flatMap((name) => normalizeName(name) === "burnham-legarda" ? ["Burnham", "Legarda"] : [name])
    .filter(Boolean);
}

function siteLabel(site) {
  return site.siteName || site.mapLabel || site.sourceSiteNames?.[0] || "Unnamed site";
}

function getDashboardStats(scheduleModel, mapFeatures) {
  const uniqueAreas = new Map();
  const barangayLabels = new Set();
  const scheduledAreaGroups = new Map();
  const areaGroupsByCell = new Map();
  const dailyStats = new Map(DAYS.map((day) => [day, { areas: new Map(), sites: new Set() }]));
  const canonicalBarangays = new Map(
    (scheduleModel.barangays ?? []).map((name) => [normalizeName(name), {
      name,
      sites: new Map(),
      areas: new Set(),
    }]),
  );
  const undefinedLineRecords = [];

  scheduleModel.drivers.forEach((driver) => {
    Object.entries(driver.days ?? {}).forEach(([day, entries]) => {
      const areas = entries.flatMap((entry) => entry.areas ?? []).filter((area) =>
        !isQrtAreaName(area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName),
      );
      const cellKey = `${driver.id}:${day}`;

      areas.forEach((area) => {
        dashboardAreaNames(area).forEach((label) => {
          const areaName = normalizeName(label);
          const barangay = normalizeName(area.barangay);
          const areaKey = areaName || barangay || `missing::${area.id}`;
          const activeSites = (area.sites ?? []).filter(
            (site) => site.hasCoordinates && site.catalogStatus !== "removed",
          );

          if (barangay) barangayLabels.add(barangay);

          const savedArea = uniqueAreas.get(areaKey) ?? {
            key: areaKey,
            name: label,
            hasSites: false,
            barangays: new Set(),
            sites: new Map(),
            occurrences: new Map(),
          };
          savedArea.hasSites ||= activeSites.length > 0;
          if (area.barangay) savedArea.barangays.add(area.barangay);
          savedArea.occurrences.set(`${driver.id}:${day}`, `${driver.name} · ${day}`);

          (area.sites ?? []).forEach((site) => {
            const labelForSite = siteLabel(site);
            const siteKey = site.hasCoordinates
              ? `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`
              : normalizeName(labelForSite) === "unnamed site"
                ? `unmapped::${site.id}`
                : `unmapped::${normalizeName(labelForSite)}`;
            const savedSite = savedArea.sites.get(siteKey) ?? {
              key: siteKey,
              name: labelForSite,
              mapped: false,
              status: "No map coordinates",
              hasMissingCoordinates: false,
              hasRemovedRecord: false,
              hasUnmatchedReference: false,
              coordinates: null,
              occurrences: new Set(),
            };
            const mapped = site.hasCoordinates && site.catalogStatus !== "removed";
            savedSite.mapped ||= mapped;
            savedSite.hasMissingCoordinates ||= !site.hasCoordinates;
            savedSite.hasRemovedRecord ||= site.hasCoordinates && site.catalogStatus === "removed";
            savedSite.hasUnmatchedReference ||= site.hasCoordinates && site.catalogStatus !== "active" && site.catalogStatus !== "removed";
            savedSite.status = savedSite.hasRemovedRecord && savedSite.mapped
              ? "Conflicting map status"
              : savedSite.hasRemovedRecord
                ? "Removed from map"
                : savedSite.hasUnmatchedReference
                  ? "Map reference needs review"
                  : savedSite.mapped ? "Mapped" : "No map coordinates";
            if (site.hasCoordinates) savedSite.coordinates = [site.latitude, site.longitude];
            savedSite.occurrences.add(`${driver.name} · ${day}`);
            savedArea.sites.set(siteKey, savedSite);

            let siteBarangayNames = [
              ...(site.mapBarangays ?? []),
              ...(site.sourceBarangays ?? []),
              site.hasExplicitBarangay ? site.barangay : "",
            ].filter(Boolean);
            if (siteBarangayNames.length === 0) {
              siteBarangayNames = [...(area.mapBarangays ?? []), area.barangay].filter(Boolean);
            }
            const matchingBarangayKeys = new Set(siteBarangayNames.map(normalizeName));
            matchingBarangayKeys.forEach((barangayKey) => {
              const savedBarangay = canonicalBarangays.get(barangayKey);
              if (!savedBarangay) return;
              const savedBarangaySite = savedBarangay.sites.get(siteKey) ?? {
                key: siteKey,
                name: labelForSite,
                status: site.catalogStatus === "removed"
                  ? "Removed from map"
                  : site.hasCoordinates ? "Mapped" : "No map coordinates",
                coordinates: site.hasCoordinates ? [site.latitude, site.longitude] : null,
                occurrences: new Set(),
              };
              savedBarangaySite.occurrences.add(`${driver.name} · ${day}`);
              savedBarangay.sites.set(siteKey, savedBarangaySite);
              savedBarangay.areas.add(label);
            });
          });

          (area.mapBarangays ?? []).forEach((name) => {
            canonicalBarangays.get(normalizeName(name))?.areas.add(label);
          });
          if (area.barangay) canonicalBarangays.get(barangay)?.areas.add(label);
          uniqueAreas.set(areaKey, savedArea);

          const daily = dailyStats.get(day);
          if (daily) {
            const dailyArea = daily.areas.get(areaKey) ?? { hasSites: false };
            dailyArea.hasSites ||= activeSites.length > 0;
            daily.areas.set(areaKey, dailyArea);
            activeSites.forEach((site) => {
              daily.sites.add(`${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`);
            });
          }

          const lineItems = (area.unmappedSegments ?? [])
            .filter((segment) => segment.type === "route" && isUnmappedAreaSegment(segment))
            .map((segment) => ({ label: segment.name || "Unnamed route segment" }));
          lineItems.push(...(area.sites ?? [])
            .filter((site) => normalizeName(site.siteName) === "firingline")
            .map((site) => ({ label: site.mapLabel || "FiringLine placeholder" })));
          lineItems.forEach((line, index) => {
            undefinedLineRecords.push({
              key: `${driver.id}:${day}:${area.id}:${index}`,
              areaKey,
              areaName: label,
              barangay: area.barangay,
              lineName: line.label,
              driverName: driver.name,
              day,
            });
          });
        });
      });

      groupAreaAssignments(areas).forEach((group) => {
        const key = `${cellKey}:${group.id}`;
        const assignment = { cellKey, group };
        scheduledAreaGroups.set(key, assignment);
        const cellGroups = areaGroupsByCell.get(cellKey) ?? [];
        cellGroups.push([key, group]);
        areaGroupsByCell.set(cellKey, cellGroups);
      });
    });
  });

  const driverIdsByName = new Map(
    scheduleModel.drivers.map((driver) => [normalizeName(driver.name), driver.id]),
  );
  const areaGroupsWithLines = new Set();

  (mapFeatures ?? []).forEach((feature) => {
    if (!feature || feature.feature_type !== "firing_line" || !isUsableLine(feature)) return;
    const driverId = feature.driver_id || driverIdsByName.get(normalizeName(feature.driver));
    if (!driverId || !feature.day) return;
    const cellKey = `${driverId}:${feature.day}`;
    const areaIds = Array.isArray(feature.area_ids) ? feature.area_ids.filter(Boolean) : [];
    const areaNames = Array.isArray(feature.area_names)
      ? feature.area_names.map(normalizeName).filter(Boolean)
      : [];

    (areaGroupsByCell.get(cellKey) ?? []).forEach(([key, group]) => {
      const appliesToArea = areaIds.length > 0
        ? group.records.some((record) => areaIds.includes(record.id))
        : areaNames.length > 0
          ? areaNames.includes(normalizeName(group.areaName))
          : true;
      if (appliesToArea) areaGroupsWithLines.add(key);
    });
  });

  const totalAreaGroups = scheduledAreaGroups.size;
  const areasWithLines = areaGroupsWithLines.size;
  const areaCount = uniqueAreas.size;
  const areasWithoutSites = [...uniqueAreas.values()].filter((area) => !area.hasSites).length;
  const referenceBarangaysInSchedule = [...barangayLabels]
    .filter((barangay) => canonicalBarangays.has(barangay)).length;
  const dailySummary = DAYS.map((day) => {
    const daily = dailyStats.get(day);
    return {
      day,
      sites: daily.sites.size,
      areasWithoutSites: [...daily.areas.values()].filter((area) => !area.hasSites).length,
      totalAreas: daily.areas.size,
    };
  });
  const undefinedLineCountsByArea = new Map();
  undefinedLineRecords.forEach((record) => {
    undefinedLineCountsByArea.set(record.areaKey, (undefinedLineCountsByArea.get(record.areaKey) ?? 0) + 1);
  });
  const areaBreakdown = [...uniqueAreas.values()].map((area) => {
    const sites = [...area.sites.values()].map((site) => ({
      ...site,
      occurrences: [...site.occurrences].sort((a, b) => a.localeCompare(b)),
    })).sort((a, b) => a.name.localeCompare(b.name));
    const clarificationReasons = [];
    const missingCoordinateCount = sites.filter((site) => site.hasMissingCoordinates && normalizeName(site.name).replace(/\s+/g, "") !== "firingline").length;
    const removedCount = sites.filter((site) => site.hasRemovedRecord && !site.mapped).length;
    const conflictingStatusCount = sites.filter((site) => site.hasRemovedRecord && site.mapped).length;
    const unmatchedCount = sites.filter((site) => site.hasUnmatchedReference).length;
    const undefinedLineCount = undefinedLineCountsByArea.get(area.key) ?? 0;

    if (missingCoordinateCount > 0) clarificationReasons.push(`${formatted(missingCoordinateCount)} ${missingCoordinateCount === 1 ? "site has" : "sites have"} no map coordinates`);
    if (removedCount > 0) clarificationReasons.push(`${formatted(removedCount)} scheduled ${removedCount === 1 ? "site is" : "sites are"} marked removed from the map`);
    if (conflictingStatusCount > 0) clarificationReasons.push(`${formatted(conflictingStatusCount)} ${conflictingStatusCount === 1 ? "site has" : "sites have"} conflicting map status across schedule entries`);
    if (unmatchedCount > 0) clarificationReasons.push(`${formatted(unmatchedCount)} ${unmatchedCount === 1 ? "map location needs" : "map locations need"} reference verification`);
    if (undefinedLineCount > 0) clarificationReasons.push(`${formatted(undefinedLineCount)} undefined route or firing ${undefinedLineCount === 1 ? "line needs" : "lines need"} map nodes`);
    if (!area.hasSites && sites.length === 0) clarificationReasons.push("No site records appear in this schedule");
    else if (!area.hasSites && clarificationReasons.length === 0) clarificationReasons.push("No active mapped sites in this schedule");

    return {
      key: area.key,
      name: area.name,
      hasSites: area.hasSites,
      needsClarification: clarificationReasons.length > 0,
      clarificationReasons,
      barangays: [...area.barangays].sort((a, b) => a.localeCompare(b)),
      sites,
      occurrences: [...area.occurrences.values()].sort((a, b) => a.localeCompare(b)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const undefinedLinesByArea = new Map();
  undefinedLineRecords.forEach((record) => {
    const existing = undefinedLinesByArea.get(record.areaKey) ?? {
      key: record.areaKey,
      name: record.areaName,
      barangays: new Set(),
      lines: [],
    };
    if (record.barangay) existing.barangays.add(record.barangay);
    existing.lines.push(record);
    undefinedLinesByArea.set(record.areaKey, existing);
  });
  const driverBreakdown = scheduleModel.drivers.map((driver) => ({
    key: driver.id,
    name: driver.name,
    days: DAYS.map((day) => {
      const entries = driver.days?.[day] ?? [];
      const areas = entries.flatMap((entry) => entry.areas ?? []);
      const labels = [...new Set([
        ...entries.map((entry) => entry.areaName).filter(Boolean),
        ...areas.map(scheduleAreaLabel),
      ])];
      return { day, onDuty: entries.length > 0, areas: labels };
    }),
  })).sort((a, b) => a.name.localeCompare(b.name));

  return {
    areasWithoutSites,
    areaCount,
    barangayCount: barangayLabels.size,
    referenceBarangayCount: canonicalBarangays.size,
    referenceBarangaysMissingCount: canonicalBarangays.size - referenceBarangaysInSchedule,
    driverCount: scheduleModel.stats.driverCount,
    undefinedFiringLines: new Set(undefinedLineRecords.map((record) => record.key)).size,
    areasWithLines,
    totalAreaGroups,
    areasWithSites: areaCount - areasWithoutSites,
    dailySummary,
    barangayBreakdown: [...canonicalBarangays.values()].map((barangay) => ({
      name: barangay.name,
      sites: [...barangay.sites.values()].map((site) => ({
        ...site,
        occurrences: [...site.occurrences].sort((a, b) => a.localeCompare(b)),
      })).sort((a, b) => a.name.localeCompare(b.name)),
      areas: [...barangay.areas].sort((a, b) => a.localeCompare(b)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    driverBreakdown,
    areaBreakdown,
    undefinedLineBreakdown: [...undefinedLinesByArea.values()].map((area) => ({
      ...area,
      barangays: [...area.barangays].sort((a, b) => a.localeCompare(b)),
      lines: area.lines.sort((a, b) => `${a.day} ${a.driverName} ${a.lineName}`.localeCompare(`${b.day} ${b.driverName} ${b.lineName}`)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
function MetricIcon({ name }) {
  const paths = {
    sites: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></>,
    lines: <><path d="m4 18 5-9 5 4 6-8" /><circle cx="4" cy="18" r="1.4" /><circle cx="9" cy="9" r="1.4" /><circle cx="14" cy="13" r="1.4" /><circle cx="20" cy="5" r="1.4" /></>,
    areas: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
    barangays: <><path d="M3.5 11.2 12 4l8.5 7.2" /><path d="M5.5 10.5v9h13v-9M9.5 19.5v-5h5v5" /></>,
    drivers: <><circle cx="12" cy="8" r="3.3" /><path d="M5 20c.4-3.4 2.8-5.4 7-5.4s6.6 2 7 5.4" /><path d="M4 8.5h2.5M17.5 8.5H20" /></>,
  };

  return (
    <svg className="dashboard-metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function CoverageMeter({ label, value, total, tone, description, unit }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className={`dashboard-coverage-item dashboard-coverage-item--${tone}`}>
      <div className="dashboard-coverage-heading">
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
        <strong>{percentage}%</strong>
      </div>
      <div
        className="dashboard-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percentage}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p className="dashboard-coverage-count">{formatted(value)} of {formatted(total)} {total === 1 ? unit.slice(0, -1) : unit}</p>
    </div>
  );
}

function DailySummary({ dailySummary }) {
  const maximumSites = Math.max(1, ...dailySummary.map((item) => item.sites));

  return (
    <section className="dashboard-daily-panel" aria-labelledby="daily-summary-title">
      <div className="dashboard-coverage-panel-heading">
        <div>
          <p className="eyebrow">Daily totals</p>
          <h2 id="daily-summary-title">Weekly collection summary</h2>
        </div>
        <span className="dashboard-coverage-tag">From the selected JSON schedule</span>
      </div>
      <div className="dashboard-daily-table-wrap">
        <table className="dashboard-daily-table">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Mapped sites</th>
              <th scope="col">Areas without sites</th>
              <th scope="col">Total areas</th>
            </tr>
          </thead>
          <tbody>
            {dailySummary.map((item) => (
              <tr key={item.day}>
                <th scope="row">{item.day}</th>
                <td>
                  <div className="dashboard-daily-sites">
                    <strong>{formatted(item.sites)}</strong>
                    <span className="dashboard-daily-bar" aria-hidden="true">
                      <span style={{ width: `${(item.sites / maximumSites) * 100}%` }} />
                    </span>
                  </div>
                </td>
                <td>{formatted(item.areasWithoutSites)}</td>
                <td>{formatted(item.totalAreas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function matchesQuery(query, ...values) {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return true;
  return normalizeName(values.filter(Boolean).join(" ")).includes(normalizedQuery);
}

function EmptyBreakdown({ children }) {
  return <p className="dashboard-detail-empty">{children}</p>;
}

function BarangayBreakdown({ barangays, query }) {
  const visibleBarangays = barangays.filter((barangay) => matchesQuery(
    query,
    barangay.name,
    ...barangay.areas,
    ...barangay.sites.flatMap((site) => [site.name, site.status]),
  ));

  if (visibleBarangays.length === 0) return <EmptyBreakdown>No barangays match this search.</EmptyBreakdown>;

  return (
    <div className="dashboard-detail-accordion-list">
      {visibleBarangays.map((barangay) => (
        <details className="dashboard-detail-accordion" key={barangay.name}>
          <summary>
            <span>{barangay.name}</span>
            <span>{formatted(barangay.sites.length)} scheduled {barangay.sites.length === 1 ? "site" : "sites"}</span>
          </summary>
          <div className="dashboard-detail-accordion-body">
            {barangay.areas.length > 0 && <p>Areas: {barangay.areas.join(" · ")}</p>}
            {barangay.sites.length > 0 ? (
              <ul className="dashboard-detail-site-list">
                {barangay.sites.map((site) => (
                  <li key={site.key}>
                    <strong>{site.name}</strong>
                    <span>{site.status}{site.occurrences.length > 0 ? ` · ${site.occurrences.length} schedule occurrence${site.occurrences.length === 1 ? "" : "s"}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyBreakdown>No site records for this barangay in the selected schedule.</EmptyBreakdown>}
          </div>
        </details>
      ))}
    </div>
  );
}

function AreaBreakdownList({ areas, query }) {
  const visibleAreas = areas.filter((area) => matchesQuery(
    query,
    area.name,
    ...area.barangays,
    ...area.occurrences,
    ...area.sites.flatMap((site) => [site.name, site.status]),
    ...area.clarificationReasons,
    area.needsClarification ? "needs clarification" : "no current issues",
  ));

  return (
    <>
      {visibleAreas.length === 0 ? <EmptyBreakdown>No areas match this search.</EmptyBreakdown> : (
        <div className="dashboard-detail-card-list">
          {visibleAreas.map((area) => {
            const mappedSites = area.sites.filter((site) => site.mapped);
            return (
              <article className="dashboard-detail-card" key={area.key}>
                <div className="dashboard-detail-card-heading">
                  <h3>{area.name}</h3>
                  <div className="dashboard-area-card-meta">
                    <span className={`dashboard-area-status${area.needsClarification ? " dashboard-area-status--review" : " dashboard-area-status--clear"}`}>
                      {area.needsClarification ? "Needs clarification" : "No current issues"}
                    </span>
                    <span>{formatted(mappedSites.length)} mapped {mappedSites.length === 1 ? "site" : "sites"}</span>
                  </div>
                </div>
                {area.clarificationReasons.length > 0 && (
                  <ul className="dashboard-area-clarification-reasons" aria-label={`Clarification needed for ${area.name}`}>
                    {area.clarificationReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
                {area.barangays.length > 0 && <p className="dashboard-detail-secondary">Barangays: {area.barangays.join(" · ")}</p>}
                {area.sites.length > 0 ? (
                  <ul className="dashboard-detail-site-list">
                    {area.sites.map((site) => (
                      <li key={site.key}>
                        <strong>{site.name}</strong>
                        <span>{site.status}{site.occurrences.length > 0 ? ` · ${site.occurrences.length} schedule occurrence${site.occurrences.length === 1 ? "" : "s"}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyBreakdown>No site records in the selected schedule.</EmptyBreakdown>}
                {area.occurrences.length > 0 && <p className="dashboard-detail-secondary">Scheduled: {area.occurrences.join(" · ")}</p>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function DriverBreakdown({ drivers, query }) {
  const visibleDrivers = drivers.filter((driver) => matchesQuery(
    query,
    driver.name,
    ...driver.days.flatMap((item) => item.areas),
  ));

  if (visibleDrivers.length === 0) return <EmptyBreakdown>No drivers match this search.</EmptyBreakdown>;

  return (
    <div className="dashboard-driver-table-wrap">
      <table className="dashboard-driver-table">
        <thead>
          <tr>
            <th scope="col">Driver</th>
            {DAYS.map((day) => <th scope="col" key={day}>{day}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleDrivers.map((driver) => (
            <tr key={driver.key}>
              <th scope="row">{driver.name}</th>
              {driver.days.map((item) => (
                <td key={item.day}>
                  <span className={`dashboard-driver-status${item.onDuty ? " dashboard-driver-status--on" : " dashboard-driver-status--off"}`}>
                    {item.onDuty ? "Scheduled" : "Off"}
                  </span>
                  {item.areas.length > 0 && <small>{item.areas.join(" · ")}</small>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UndefinedLineBreakdown({ areas, query }) {
  const visibleAreas = areas.filter((area) => matchesQuery(
    query,
    area.name,
    ...area.barangays,
    ...area.lines.flatMap((line) => [line.lineName, line.driverName, line.day]),
  ));

  if (visibleAreas.length === 0) return <EmptyBreakdown>No undefined firing lines match this search.</EmptyBreakdown>;

  return (
    <div className="dashboard-detail-card-list">
      {visibleAreas.map((area) => (
        <article className="dashboard-detail-card" key={area.key}>
          <div className="dashboard-detail-card-heading">
            <h3>{area.name}</h3>
            <span>{formatted(area.lines.length)} undefined {area.lines.length === 1 ? "line" : "lines"}</span>
          </div>
          {area.barangays.length > 0 && <p className="dashboard-detail-secondary">Barangays: {area.barangays.join(" · ")}</p>}
          <ul className="dashboard-detail-site-list">
            {area.lines.map((line) => (
              <li key={line.key}>
                <strong>{line.lineName}</strong>
                <span>{line.driverName} · {line.day}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function DashboardDetailContent({ metric, stats, query }) {
  if (metric.key === "barangays") {
    return <BarangayBreakdown barangays={stats.barangayBreakdown} query={query} />;
  }
  if (metric.key === "drivers") {
    return <DriverBreakdown drivers={stats.driverBreakdown} query={query} />;
  }
  if (metric.key === "scheduled-areas") {
    return <AreaBreakdownList areas={stats.areaBreakdown} query={query} />;
  }
  if (metric.key === "undefined-firing-lines") {
    return <UndefinedLineBreakdown areas={stats.undefinedLineBreakdown} query={query} />;
  }
  const areasWithoutSites = stats.areaBreakdown.filter((area) => !area.hasSites);
  const areasWithSites = stats.areaBreakdown.filter((area) => area.hasSites);
  return (
    <div className="dashboard-detail-sections">
      <section>
        <div className="dashboard-detail-section-heading">
          <h3>Areas without active mapped sites</h3>
          <span>{formatted(areasWithoutSites.length)}</span>
        </div>
        <AreaBreakdownList areas={areasWithoutSites} query={query} />
      </section>
      <section>
        <div className="dashboard-detail-section-heading">
          <h3>Areas with active mapped sites</h3>
          <span>{formatted(areasWithSites.length)}</span>
        </div>
        <AreaBreakdownList areas={areasWithSites} query={query} />
      </section>
    </div>
  );
}

function DashboardDetailDialog({ metric, stats, onClose }) {
  const dialogRef = useRef(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (metric && dialog && !dialog.open) dialog.showModal();
    if (!metric && dialog?.open) dialog.close();
  }, [metric?.key]);

  useEffect(() => setQuery(""), [metric?.key]);

  function closeWhenBackdropIsClicked(event) {
    const dialog = event.currentTarget;
    const bounds = dialog.getBoundingClientRect();
    const clickIsOutsideCard = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (event.target === dialog || clickIsOutsideCard) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      id="dashboard-detail-dialog"
      className="data-notes-dialog dashboard-detail-dialog"
      aria-labelledby="dashboard-detail-title"
      onClose={() => { if (metric) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={closeWhenBackdropIsClicked}
    >
      {metric && (
        <div className="data-notes-dialog-inner">
          <header className="data-notes-dialog-header">
            <div className="data-notes-dialog-title-lockup">
              <span className={`dashboard-metric-icon-wrap dashboard-detail-icon--${metric.tone}`}>
                <MetricIcon name={metric.icon} />
              </span>
              <div>
                <p className="eyebrow">Schedule breakdown</p>
                <h2 id="dashboard-detail-title">{metric.label}</h2>
              </div>
              <span className="notes-count">{formatted(metric.value)}</span>
            </div>
            <button className="data-notes-close" type="button" aria-label="Close breakdown" onClick={onClose}>×</button>
          </header>
          <div className="dashboard-detail-content">
            <div className="dashboard-detail-toolbar">
              <p>{metric.description}</p>
              <label>
                <span>Search breakdown</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type a name or area"
                />
              </label>
            </div>
            <DashboardDetailContent metric={metric} stats={stats} query={query} />
          </div>
        </div>
      )}
    </dialog>
  );
}

export default function Dashboard({ scheduleModel, mapFeatures, scheduleName }) {
  const stats = getDashboardStats(scheduleModel, mapFeatures);
  const [activeMetricKey, setActiveMetricKey] = useState(null);
  const metrics = [
    {
      key: "areas-without-sites",
      icon: "sites",
      value: stats.areasWithoutSites,
      label: "Areas without sites",
      description: "Distinct areas with no active mapped site",
      tone: "orange",
    },
    {
      key: "undefined-firing-lines",
      icon: "lines",
      value: stats.undefinedFiringLines,
      label: "Undefined firing lines",
      description: "Route segments and firing-line placeholders in the selected JSON",
      tone: "violet",
    },
    {
      key: "scheduled-areas",
      icon: "areas",
      value: stats.areaCount,
      label: "Areas mentioned in schedule",
      description: "Distinct area labels found in the selected JSON",
      tone: "green",
    },
    {
      key: "barangays",
      icon: "barangays",
      value: stats.referenceBarangayCount,
      label: "Total barangays",
      description: `${formatted(stats.barangayCount)} in selected schedule · ${formatted(stats.referenceBarangaysMissingCount)} not listed`,
      tone: "blue",
    },
    {
      key: "drivers",
      icon: "drivers",
      value: stats.driverCount,
      label: "Drivers",
      description: "Drivers listed in this schedule",
      tone: "teal",
    },
  ];
  const activeMetric = metrics.find((metric) => metric.key === activeMetricKey) ?? null;

  return (
    <section className="dashboard-view" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Route overview</p>
          <h1 id="dashboard-title">Schedule dashboard</h1>
          <p className="dashboard-subtitle">A quick view of area coverage, route details, and schedule totals.</p>
          <p className="dashboard-source-note">Counts update from the selected JSON. Sites count when they have active, valid map coordinates.</p>
        </div>
        <div className="dashboard-schedule-chip">
          <span className="dashboard-live-dot" aria-hidden="true" />
          <span>Current schedule</span>
          <strong title={scheduleName}>{scheduleName}</strong>
        </div>
      </div>

      <div className="dashboard-metrics">
        {metrics.map((metric) => (
          <button
            className={`dashboard-metric dashboard-metric-button dashboard-metric--${metric.tone}`}
            key={metric.key}
            type="button"
            aria-label={`${metric.label}: ${formatted(metric.value)}. Open breakdown.`}
            aria-haspopup="dialog"
            aria-controls="dashboard-detail-dialog"
            onClick={() => setActiveMetricKey(metric.key)}
          >
            <div className="dashboard-metric-topline">
              <span className="dashboard-metric-icon-wrap"><MetricIcon name={metric.icon} /></span>
              <span className="dashboard-metric-label">{metric.label}</span>
            </div>
            <strong className="dashboard-metric-value">{formatted(metric.value)}</strong>
            <p className="dashboard-metric-description">{metric.description}</p>
            <span className="dashboard-metric-hint">View breakdown <span aria-hidden="true">↗</span></span>
          </button>
        ))}
      </div>

      <section className="dashboard-coverage-panel" aria-labelledby="coverage-title">
        <div className="dashboard-coverage-panel-heading">
          <div>
            <p className="eyebrow">Data coverage</p>
            <h2 id="coverage-title">Route definition progress</h2>
          </div>
          <span className="dashboard-coverage-tag">Selected JSON and saved map edits</span>
        </div>
        <div className="dashboard-coverage-grid">
          <CoverageMeter
            label="Areas with mapped sites"
            value={stats.areasWithSites}
            total={stats.areaCount}
            tone="green"
            description="Distinct areas with at least one active mapped site"
            unit="unique areas"
          />
          <CoverageMeter
            label="Area groups with firing lines"
            value={stats.areasWithLines}
            total={stats.totalAreaGroups}
            tone="violet"
            description="Scheduled area groups with a saved firing line"
            unit="area groups"
          />
        </div>
      </section>
      <DailySummary dailySummary={stats.dailySummary} />
      <DashboardDetailDialog
        metric={activeMetric}
        stats={stats}
        onClose={() => setActiveMetricKey(null)}
      />
    </section>
  );
}
