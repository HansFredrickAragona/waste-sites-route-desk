import { groupAreaAssignments, isQrtAreaName, isUnmappedAreaSegment } from "../data/scheduleCellPresentation.js";

function normalizedLabel(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

export default function ScheduleCell({ areas, areaNames = [], driverName, day, confirmed = false, onSelect }) {
  const groups = groupAreaAssignments(areas);
  const names = [...new Set((areaNames.length > 0 ? areaNames : groups.map((group) => group.areaName)).filter(Boolean))];

  if (areas.length === 0) {
    return <span className="empty-cell" aria-label={`${driverName} on ${day}: ${names.join("; ") || "No areas assigned"}`}>{names.join(" · ") || "—"}</span>;
  }

  const routeGroups = groups.filter((group) => !isQrtAreaName(group.areaName));
  const warnings = [...new Set(routeGroups.map((group) => group.warning).filter(Boolean))];
  const mappedLocations = new Set(
    areas.flatMap((area) => area.sites)
      .filter((site) => site.hasCoordinates && site.catalogStatus !== "removed")
      .map((site) => `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`),
  );
  const hasQrtAssignment = groups.some((group) => isQrtAreaName(group.areaName));
  const hasFixedRouteAssignment = routeGroups.length > 0;
  const unmappedSegments = routeGroups.reduce(
    (count, group) => count + group.records.reduce(
      (areaCount, area) => areaCount + (area.unmappedSegments ?? []).filter(isUnmappedAreaSegment).length,
      0,
    ),
    0,
  );
  const detailMeta = [
    mappedLocations.size > 0
      ? `${mappedLocations.size} mapped site${mappedLocations.size === 1 ? "" : "s"}`
      : hasQrtAssignment && !hasFixedRouteAssignment
        ? "Relief team · no fixed route"
        : "No mapped site",
    ...(hasQrtAssignment && hasFixedRouteAssignment ? ["QRT relief team"] : []),
    ...(unmappedSegments > 0 ? [`${unmappedSegments} segment${unmappedSegments === 1 ? "" : "s"} need mapping`] : []),
  ].join(" · ");

  return (
    <button
      className="schedule-cell"
      type="button"
      onClick={onSelect}
      aria-label={`${driverName} on ${day}: ${names.join("; ")}. ${detailMeta}. Open map.`}
      title={warnings.length > 0 ? warnings.join("; ") : "Open this driver's sites on the map"}
    >
      <span className="area-list">
        {names.map((name) => {
          const matchingGroups = groups.filter(
            (group) => normalizedLabel(group.areaName) === normalizedLabel(name),
          );
          const isQrt = isQrtAreaName(name);
          const areaWarnings = isQrt
            ? []
            : [...new Set(matchingGroups.map((group) => group.warning).filter(Boolean))];
          const groupStatuses = [...new Set(matchingGroups.map((group) => group.status))];
          const status = groupStatuses.includes("mixed") ||
            (groupStatuses.includes("mapped") && groupStatuses.includes("unmapped"))
            ? "mixed"
            : groupStatuses[0] ?? "unmapped";
          const statusClass = isQrt ? "area-entry--qrt" : `area-entry--${status}`;

          return (
            <span className={`area-entry ${statusClass}`} key={name}>
              <span
                className="area-tag area-day-name"
                title={areaWarnings.length > 0 ? areaWarnings.join("; ") : undefined}
              >
                {name}
                {areaWarnings.length > 0 && <span className="area-warning-mark" aria-hidden="true"> *</span>}
              </span>
            </span>
          );
        })}
        <small className="area-detail-meta">{detailMeta}</small>
      </span>
      {confirmed && <span className="cell-confirmed-mark" title="Cell confirmed" aria-hidden="true">✓</span>}
      <span className="cell-open-hint" aria-hidden="true">↗</span>
    </button>
  );
}
