export default function QrtPreviousRoutePanel({ areas, selectedAreaId, onChange }) {
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? null;

  return (
    <section className="qrt-route-reference-panel" aria-labelledby="qrt-route-reference-title">
      <div>
        <p className="eyebrow">QRT relief coverage</p>
        <h3 id="qrt-route-reference-title">Previous routes and areas</h3>
      </div>
      <p>Choose another driver’s assigned area in this schedule to view its mapped stops as a reference.</p>
      <label className="map-action-area-select">
        <span>Previous assignment</span>
        <select
          aria-label="Previous route or area for QRT reference"
          value={selectedAreaId}
          disabled={areas.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{areas.length > 0 ? "Select a previous route or area" : "No previous areas available"}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.driverName} · {area.day} · {area.areaName} ({area.sites.length} mapped pins)
            </option>
          ))}
        </select>
      </label>
      {selectedArea ? (
        <div className="qrt-route-reference-summary" role="status">
          <strong>{selectedArea.areaName}</strong>
          <span>{selectedArea.driverName} · {selectedArea.day}</span>
          <small>
            <span className="qrt-route-reference-dot" aria-hidden="true" />
            {selectedArea.sites.length > 0
              ? `${selectedArea.sites.length} blue reference pin${selectedArea.sites.length === 1 ? "" : "s"} on the map`
              : "No mapped pins in this previous assignment"}
          </small>
        </div>
      ) : (
        <p className="qrt-route-reference-empty" role="status">
          {areas.length > 0
            ? "Select an assignment to display its previous route area pins."
            : "No assigned areas from other drivers are available in this schedule."}
        </p>
      )}
    </section>
  );
}
