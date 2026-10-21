import { useMemo, useState } from "react";

function normalize(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function collectPins(areas) {
  const pins = new Map();
  for (const area of areas) {
    for (const site of area.sites) {
      const key = `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`;
      const existing = pins.get(key);
      const assignment = `${area.driverName} · ${area.day} · ${area.areaName}`;
      if (existing) {
        if (!existing.assignments.includes(assignment)) existing.assignments.push(assignment);
        continue;
      }
      pins.set(key, {
        key,
        name: site.siteName || site.mapLabel || "Unnamed collection pin",
        barangay: site.barangay || site.assignedBarangay || "Barangay not recorded",
        latitude: site.latitude,
        longitude: site.longitude,
        assignments: [assignment],
      });
    }
  }
  return [...pins.values()].sort((a, b) =>
    a.barangay.localeCompare(b.barangay) || a.name.localeCompare(b.name),
  );
}

export default function QrtHistoryView({ driver, day, areas, onBack }) {
  const [query, setQuery] = useState("");
  const pins = useMemo(() => collectPins(areas), [areas]);
  const normalizedQuery = normalize(query);
  const visiblePins = pins.filter((pin) => normalize([
    pin.name,
    pin.barangay,
    ...pin.assignments,
  ].join(" ")).includes(normalizedQuery));

  return (
    <section className="qrt-history-view" aria-labelledby="qrt-history-title">
      <header className="qrt-history-header">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to schedule
        </button>
        <p className="eyebrow">Relief assignment · {day}</p>
        <h1 id="qrt-history-title">{driver.name} · QRT</h1>
        <p>Historical collection pins from other assigned routes. These are reference stops, not a fixed QRT route.</p>
      </header>

      <div className="qrt-history-toolbar">
        <label htmlFor="qrt-history-search">Search historical pins</label>
        <input
          id="qrt-history-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search site, barangay, driver, or area"
        />
        <span>{visiblePins.length} of {pins.length} pins</span>
      </div>

      {visiblePins.length > 0 ? (
        <ul className="qrt-history-list">
          {visiblePins.map((pin) => (
            <li key={pin.key}>
              <span className="qrt-history-pin-dot" aria-hidden="true" />
              <div>
                <strong>{pin.name}</strong>
                <span>{pin.barangay} · {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}</span>
                <small>{pin.assignments.join("; ")}</small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="qrt-history-empty" role="status">
          {pins.length === 0
            ? "No mapped historical pins are available in this schedule yet."
            : "No historical pins match this search."}
        </p>
      )}
    </section>
  );
}
