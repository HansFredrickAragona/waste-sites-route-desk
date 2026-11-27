import PinEditor from "./PinEditor.jsx";
import AnimatedSize from "../../../shared/ui/AnimatedSize.jsx";
import { formatNumber, hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";

export default function PinManagerCard({ data, ui, actions, helpers }) {
  const { selectedBarangay, selectedPin, visiblePins } = data;
  const { mode, pinDraft, lineDraft, pinManagerCollapsed, pinEditorOpen, isLocatingCurrentPosition, selectedPinId, pinSearch, pinLocationInput } = ui;
  const { beginPinFromCurrentLocation, beginPinPlacement, setPinManagerCollapsed, savePin, cancelMapMode, setPinDraft, setPinEditorOpen, setPinLocationInput, setMapFocus, beginEditPin, requestDelete, setPinSearch, selectPin } = actions;
  const { coordinateText, sourceScheduleRows } = helpers;
  const panelCollapsed = pinDraft ? false : pinManagerCollapsed;
  const editInProgress = Boolean(pinDraft || lineDraft || mode === "draw-line");

  return (
              <section className={`review-panel pin-manager-panel${panelCollapsed ? " pin-manager-panel--collapsed" : ""}`}>
                <div className="tools-heading">
                  <div><h2>Pins <span>{formatNumber(selectedBarangay.pins.length)}</span></h2></div>
                  <div className="pin-manager-heading-actions">
                    {!panelCollapsed && <button className="small-action" type="button" onClick={beginPinFromCurrentLocation} disabled={isLocatingCurrentPosition} aria-busy={isLocatingCurrentPosition}>{isLocatingCurrentPosition ? "Locating…" : "⌖ Add GPS pin"}</button>}
                    {!panelCollapsed && <button className={`small-action${mode === "place-pin" ? " small-action--active" : ""}`} type="button" onClick={beginPinPlacement} aria-pressed={mode === "place-pin"}>＋ Add pin</button>}
                    <button
                      className="small-action pin-manager-toggle"
                      type="button"
                      onClick={() => setPinManagerCollapsed((current) => !current)}
                      disabled={editInProgress}
                      aria-expanded={!panelCollapsed}
                      aria-label={panelCollapsed ? "Show Pins panel" : "Minimize Pins panel"}
                    >
                      {panelCollapsed ? "Show" : "Minimize"}
                    </button>
                  </div>
                </div>
                <AnimatedSize className="pin-content-size-transition" collapsed={panelCollapsed}>
                  <>
                {pinDraft ? (
                  pinEditorOpen ? (
                    <PinEditor
                      selectedBarangay={selectedBarangay}
                      pinDraft={pinDraft}
                      setPinDraft={setPinDraft}
                      pinLocationInput={pinLocationInput}
                      setPinLocationInput={setPinLocationInput}
                      savePin={savePin}
                      cancelMapMode={cancelMapMode}
                      onMap
                    />
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
                    <h3>{selectedPin.name}</h3>
                    <dl className="pin-detail-list">
                      <div><dt>Purok</dt><dd>{selectedPin.purok || <span className="missing-value">Not assigned</span>}</dd></div>
                      <div><dt>Coordinates</dt><dd>{hasMapCoordinates(selectedPin) ? <code>{coordinateText(selectedPin.latitude, selectedPin.longitude)}</code> : <span className="missing-value">Not mapped · edit to add coordinates</span>}</dd></div>
                      {["pick up", "drop off"].map((label) => <div key={label}><dt>{label}</dt><dd>{sourceScheduleRows(selectedPin.schedule ?? selectedPin.sourceSchedule).find((row) => row.label === label)?.value || <span className="missing-value">Not provided</span>}</dd></div>)}
                      <div><dt>Barangay confirmed</dt><dd>{selectedPin.review?.is_brgy_confirmed === true ? "Yes" : "No"}</dd></div>
                      <div><dt>Remarks</dt><dd>{selectedPin.remarks || selectedPin.sourceRemarks || <span className="missing-value">Not provided</span>}</dd></div>
                      <div><dt>Review note</dt><dd>{selectedPin.notes || <span className="missing-value">Not provided</span>}</dd></div>
                    </dl>
                    <div className="pin-detail-actions">
                      {hasMapCoordinates(selectedPin) && <a className="quiet-small-button pin-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateText(selectedPin.latitude, selectedPin.longitude))}`} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>}
                      <button className="quiet-small-button" type="button" onClick={() => beginEditPin(selectedPin)}>Edit pin</button>
                      <button className="danger-text-button" type="button" onClick={() => requestDelete("pin", selectedPin)}>Delete</button>
                    </div>
                  </div>
                ) : null}
                <label className="site-search"><span aria-hidden="true">⌕</span><input value={pinSearch} onChange={(event) => setPinSearch(event.target.value)} placeholder="Search sites or puroks" aria-label="Search collection sites" /></label>
                <ul className="site-record-list" aria-label="Collection-site pins">
                  {visiblePins.map((pin, index) => (
                    <li key={pin.id}><button className={`site-record${selectedPinId === pin.id ? " site-record--active" : ""}${pin.sourceStatus === "removed" ? " site-record--removed" : ""}`} type="button" onClick={() => selectPin(pin.id)}>
                      <span className="site-record-number">{index + 1}</span><span className="site-record-copy"><strong>{pin.name}</strong><small>{pin.purok || "Purok not assigned"}{pin.sourceStatus === "removed" ? " · removed" : ""}{!hasMapCoordinates(pin) ? " · no coordinates" : ""}</small></span><span className="site-record-arrow" aria-hidden="true">›</span>
                    </button></li>
                  ))}
                  {visiblePins.length === 0 && <li className="site-list-empty">No sites match the filters or search.</li>}
                </ul>
                  </>
                </AnimatedSize>
              </section>


  );
}
