import PinLocationAssistant from "./PinLocationAssistant.jsx";
import AnimatedSize from "../../../shared/ui/AnimatedSize.jsx";
import { formatNumber, hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";

export default function PinManagerCard({ data, ui, actions, helpers }) {
  const { selectedBarangay, selectedPin, visiblePins } = data;
  const { mode, pinDraft, pinManagerCollapsed, pinEditorOpen, isLocatingCurrentPosition, selectedPinId, pinSearch } = ui;
  const { beginPinFromCurrentLocation, beginPinPlacement, setPinManagerCollapsed, savePin, cancelMapMode, setPinDraft, setPinEditorOpen, setMapFocus, beginEditPin, requestDelete, setPinSearch, selectPin } = actions;
  const { coordinateText, sourceScheduleRows, scheduleFieldValue, updateScheduleField } = helpers;
  return (
              <section className={`review-panel pin-manager-panel${pinManagerCollapsed ? " pin-manager-panel--collapsed" : ""}`}>
                <div className="tools-heading">
                  <div><p className="eyebrow">Collection sites</p><h2>Pins <span>{formatNumber(selectedBarangay.pins.length)}</span></h2></div>
                  <div className="pin-manager-heading-actions">
                    {!pinManagerCollapsed && <button className="small-action" type="button" onClick={beginPinFromCurrentLocation} disabled={isLocatingCurrentPosition} aria-busy={isLocatingCurrentPosition}>{isLocatingCurrentPosition ? "Locating…" : "⌖ Add GPS pin"}</button>}
                    {!pinManagerCollapsed && <button className={`small-action${mode === "place-pin" ? " small-action--active" : ""}`} type="button" onClick={beginPinPlacement} aria-pressed={mode === "place-pin"}>＋ Add pin</button>}
                    <button
                      className="small-action pin-manager-toggle"
                      type="button"
                      onClick={() => setPinManagerCollapsed((current) => !current)}
                      aria-expanded={!pinManagerCollapsed}
                      aria-label={pinManagerCollapsed ? "Expand Pins panel" : "Minimize Pins panel"}
                    >
                      {pinManagerCollapsed ? "Expand" : "Minimize"}
                    </button>
                  </div>
                </div>
                <AnimatedSize className="pin-content-size-transition" collapsed={pinManagerCollapsed}>
                  <>
                {pinDraft ? (
                  pinEditorOpen ? (
                    <form className="pin-editor pin-editor-form" onSubmit={savePin}>
                      <header className="pin-editor-header">
                        <div><p className="eyebrow">{pinDraft.isNew ? "New collection site" : "Edit collection site"}</p><h2 id="pin-editor-title">{pinDraft.isNew ? "Add a collection-site pin" : pinDraft.name}</h2><p className="pin-editor-context">{selectedBarangay.name}</p></div>
                        <button className="icon-close" type="button" aria-label="Cancel pin editing" onClick={cancelMapMode}>×</button>
                      </header>
                      <div className="pin-editor-body">
                        <section className="pin-editor-section pin-editor-site-section" aria-labelledby="pin-site-details-title">
                          <div className="pin-editor-section-heading"><h3 id="pin-site-details-title">Site details</h3><span>Required fields</span></div>
                          <label className="field-label">Site name<input autoFocus value={pinDraft.name} onChange={(event) => setPinDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Site 3, Riverside drop-off" /></label>
                          <label className="field-label">Assigned purok<input list="barangay-purok-options" value={pinDraft.purok} onChange={(event) => setPinDraft((current) => ({ ...current, purok: event.target.value }))} placeholder="e.g. Purok 1" /><datalist id="barangay-purok-options">{selectedBarangay.puroks.map((purok) => <option key={purok} value={purok} />)}</datalist></label>
                          <label className="field-label">Status type<select value={pinDraft.statusType ?? pinDraft.sourceStatusLabel ?? ""} onChange={(event) => setPinDraft((current) => ({ ...current, statusType: event.target.value }))}>
                            <option value="">Select a status type</option>
                            {[pinDraft.statusType ?? pinDraft.sourceStatusLabel, "Existing", "Corrected/Adjusted", "Removed collection point", "Unverified / For Checking", "With remarks", "New"]
                              .filter((status, index, statuses) => status && statuses.indexOf(status) === index)
                              .map((status) => <option key={status} value={status}>{status}</option>)}
                          </select></label>
                        </section>
                        <section className="pin-editor-section pin-editor-location-section" aria-labelledby="pin-location-title">
                          <div className="pin-editor-section-heading"><h3 id="pin-location-title">Location</h3><span>Drag the pin or enter coordinates</span></div>
                          <div className="coordinate-fields"><label className="field-label">Latitude<input type="number" step="any" value={pinDraft.latitude} onChange={(event) => setPinDraft((current) => ({ ...current, latitude: event.target.value }))} /></label><label className="field-label">Longitude<input type="number" step="any" value={pinDraft.longitude} onChange={(event) => setPinDraft((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
                          {pinDraft.location?.source === "device_gps" && <p className="field-help gps-capture-note">GPS location captured{Number.isFinite(pinDraft.location.accuracy_m) ? ` · about ±${pinDraft.location.accuracy_m} m` : ""}. A Google Maps link will be saved with this pin.</p>}
                          <div className="pin-location-map-adjust"><span>Want to place it more precisely on the map?</span><button className="quiet-small-button" type="button" disabled={!hasMapCoordinates(pinDraft)} onClick={() => { setPinEditorOpen(false); setMapFocus({ type: "point", point: [Number(pinDraft.latitude), Number(pinDraft.longitude)], zoom: 19 }); }}>Adjust pin on map</button></div>
                          <PinLocationAssistant
                            pinId={pinDraft.id}
                            latitude={pinDraft.latitude}
                            longitude={pinDraft.longitude}
                            onCoordinatesChange={({ latitude, longitude }) => setPinDraft((current) => current ? ({
                              ...current,
                              latitude: Number(latitude.toFixed(6)),
                              longitude: Number(longitude.toFixed(6)),
                            }) : current)}
                          />
                        </section>
                        <section className="pin-editor-section pin-editor-schedule-section" aria-labelledby="pin-schedule-title">
                          <div className="pin-editor-section-heading"><h3 id="pin-schedule-title">Collection schedule</h3><span>Optional</span></div>
                          <div className="site-schedule-editor">
                            <fieldset className="site-schedule-group">
                              <legend>Pickup</legend>
                              <label className="field-label">Date<input type="date" value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "date")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "date", event.target.value) }) : current)} /></label>
                              <div className="site-schedule-fields">
                                <label className="field-label">Day<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "day")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "day", event.target.value) }) : current)} placeholder="Monday" /></label>
                                <label className="field-label">Time<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "time")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "time", event.target.value) }) : current)} placeholder="5:00 AM - 7:00 AM" /></label>
                              </div>
                            </fieldset>
                            <fieldset className="site-schedule-group">
                              <legend>Drop-off</legend>
                              <label className="field-label">Date<input type="date" value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "date")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "date", event.target.value) }) : current)} /></label>
                              <div className="site-schedule-fields">
                                <label className="field-label">Day<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "day")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "day", event.target.value) }) : current)} placeholder="Monday" /></label>
                                <label className="field-label">Time<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "time")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "time", event.target.value) }) : current)} placeholder="5:00 AM - 7:00 AM" /></label>
                              </div>
                            </fieldset>
                          </div>
                        </section>
                        <details open className="pin-editor-notes">
                          <summary><span>Remarks and review note</span><small>{pinDraft.remarks || pinDraft.sourceRemarks || pinDraft.notes ? "Existing notes" : "Optional"}</small></summary>
                          <div className="pin-editor-notes-fields">
                            <label className="field-label">Site remarks<textarea value={pinDraft.remarks ?? pinDraft.sourceRemarks ?? ""} onChange={(event) => setPinDraft((current) => ({ ...current, remarks: event.target.value }))} rows="2" placeholder="Add site remarks" /></label>
                            <label className="field-label">Review note<textarea value={pinDraft.notes} onChange={(event) => setPinDraft((current) => ({ ...current, notes: event.target.value }))} rows="2" placeholder="Add a note from the discussion" /></label>
                          </div>
                        </details>
                      </div>
                      <footer className="editor-actions pin-editor-actions"><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button><button className="primary-small-button" type="submit">{pinDraft.isNew ? "Save pin" : "Save changes"}</button></footer>
                    </form>
                  ) : (
                    <div className="pin-map-edit-card">
                      <div className="pin-detail-topline"><span className="pin-status-dot" /><span className="eyebrow">Pin location draft</span></div>
                      <h3>{pinDraft.name}</h3>
                      <p>Drag the selected pin on the map to adjust its placement. Your changes are still a draft.</p>
                      {hasMapCoordinates(pinDraft) && <code>{coordinateText(pinDraft.latitude, pinDraft.longitude)}</code>}
                      <div className="pin-detail-actions"><button className="primary-small-button" type="button" onClick={() => setPinEditorOpen(true)}>Return to pin editor</button><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel edit</button></div>
                    </div>
                  )
                ) : selectedPin ? (
                  <div className="pin-detail-card">
                    <div className="pin-detail-topline"><span className={`pin-status-dot${selectedPin.sourceStatus === "removed" ? " pin-status-dot--removed" : ""}`} /><span className="eyebrow">{selectedPin.sourceStatusLabel || (selectedPin.sourceStatus === "removed" ? "Removed in source export" : selectedPin.sourceStatus === "new" ? "Added in this review" : "Site record")}</span></div>
                    <h3>{selectedPin.name}</h3>
                    {selectedPin.sourceNames?.length > 1 && <p className="source-aliases">Source labels: {selectedPin.sourceNames.join(" · ")}</p>}
                    <dl className="pin-detail-list">
                      <div><dt>Purok</dt><dd>{selectedPin.purok || <span className="missing-value">Not assigned</span>}</dd></div>
                      <div><dt>Coordinates</dt><dd>{hasMapCoordinates(selectedPin) ? <code>{coordinateText(selectedPin.latitude, selectedPin.longitude)}</code> : <span className="missing-value">Not mapped · edit to add coordinates</span>}</dd></div>
                      <div><dt>Status last updated</dt><dd>{selectedPin.statusLastUpdated || <span className="missing-value">Not recorded</span>}</dd></div>
                      {sourceScheduleRows(selectedPin.schedule ?? selectedPin.sourceSchedule).map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
                      <div><dt>Source record</dt><dd>{selectedPin.sourceRowCount || "New record"}</dd></div>
                      {selectedPin.sourcePuroks?.length > 0 && <div><dt>Raw purok field</dt><dd>{selectedPin.sourcePuroks.join(" · ")}</dd></div>}
                      {(selectedPin.remarks || selectedPin.sourceRemarks) && <div><dt>Remarks</dt><dd>{selectedPin.remarks || selectedPin.sourceRemarks}</dd></div>}
                      {selectedPin.notes && <div><dt>Review note</dt><dd>{selectedPin.notes}</dd></div>}
                    </dl>
                    <div className="pin-detail-actions">
                      {hasMapCoordinates(selectedPin) && <a className="quiet-small-button pin-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateText(selectedPin.latitude, selectedPin.longitude))}`} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>}
                      <button className="quiet-small-button" type="button" onClick={() => beginEditPin(selectedPin)}>Edit pin</button>
                      <button className="danger-text-button" type="button" onClick={() => requestDelete("pin", selectedPin)}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="pin-selection-prompt"><span className="selection-target" aria-hidden="true">⌖</span><strong>Select a pin to review</strong><p>Choose a site below or on the map. Add a new pin by clicking <b>Add pin</b> and placing it on the map.</p></div>
                )}
                <label className="site-search"><span aria-hidden="true">⌕</span><input value={pinSearch} onChange={(event) => setPinSearch(event.target.value)} placeholder="Search sites or puroks" aria-label="Search collection sites" /></label>
                <ul className="site-record-list" aria-label="Collection-site pins">
                  {visiblePins.map((pin, index) => (
                    <li key={pin.id}><button className={`site-record${selectedPinId === pin.id ? " site-record--active" : ""}${pin.sourceStatus === "removed" ? " site-record--removed" : ""}`} type="button" onClick={() => selectPin(pin.id)}>
                      <span className="site-record-number">{index + 1}</span><span className="site-record-copy"><strong>{pin.name}</strong><small>{pin.purok || pin.sourcePuroks?.[0] || "Purok not assigned"}{pin.sourceStatus === "removed" ? " · removed" : ""}{!hasMapCoordinates(pin) ? " · no coordinates" : ""}</small></span><span className="site-record-arrow" aria-hidden="true">›</span>
                    </button></li>
                  ))}
                  {visiblePins.length === 0 && <li className="site-list-empty">No sites match this search.</li>}
                </ul>
                  </>
                </AnimatedSize>
              </section>


  );
}
