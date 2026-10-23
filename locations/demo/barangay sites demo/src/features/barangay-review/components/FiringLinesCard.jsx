import GoogleStreetViewEditor from "./GoogleStreetViewEditor.jsx";
import AnimatedSize from "../../../shared/ui/AnimatedSize.jsx";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

export default function FiringLinesCard({ data, ui, actions }) {
  const { selectedBarangay, selectedLine, selectedLineNode } = data;
  const { mode, lineDraft, selectedLineId, selectedLineNodeIndex, showLineNodeStreetView, lineNodeLocationInput, lineNodeLocationError, lineNodeLocationMessage, isResolvingLineNodeLocation } = ui;
  const { beginLineDrawing, saveLine, cancelMapMode, setLineDraft, finishLineNodePlacement, beginLineNodePlacement, deleteSelectedLineNode, setShowLineNodeStreetView, setLineNodeLocationInput, setLineNodeLocationError, setLineNodeLocationMessage, applyLineNodeLocation, handleLineNodeStreetViewPosition, beginEditLine, requestDelete, selectLine } = actions;
  return (
              <section className="review-panel line-manager-panel">
                <div className="tools-heading"><div><p className="eyebrow">Route features</p><h2>Firing lines <span>{formatNumber(selectedBarangay.firingLines.length)}</span></h2></div><button className={`small-action small-action--line${mode === "draw-line" ? " small-action--active" : ""}`} type="button" onClick={beginLineDrawing} aria-pressed={mode === "draw-line"}>{mode === "draw-line" ? "Cancel line" : "＋ Add line"}</button></div>
                <AnimatedSize className="line-content-size-transition">
                  <>
                {lineDraft ? (
                  <form className="line-editor" onSubmit={saveLine}>
                    <div className="editor-topline"><div><p className="eyebrow">{lineDraft.isNew ? "New feature" : "Edit feature"}</p><h3>{lineDraft.name}</h3></div><button className="icon-close icon-close--small" type="button" aria-label="Cancel line editing" onClick={cancelMapMode}>×</button></div>
                    <label className="field-label">Firing-line name<input autoFocus value={lineDraft.name} onChange={(event) => setLineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name this line" /></label>
                    <div className="line-node-summary"><span className="line-node-icon">⌁</span><span><strong>{lineDraft.coordinates.length} map nodes</strong><small>Select a blue node to review it. Right-click for node and line actions; Backspace deletes the selected node.</small></span></div>
                    {selectedLineNode && Number.isInteger(selectedLineNodeIndex) && (
                      <section className="firing-line-node-panel" aria-labelledby="firing-line-node-title" aria-live="polite">
                        <div>
                          <p className="eyebrow">Selected node · {selectedLineNodeIndex + 1} of {lineDraft.coordinates.length}</p>
                          <h4 id="firing-line-node-title">{lineDraft.name || "Firing line"} · node {selectedLineNodeIndex + 1}</h4>
                        </div>
                        <dl className="firing-line-node-coordinates">
                          <div><dt>Latitude</dt><dd>{selectedLineNode[0].toFixed(6)}</dd></div>
                          <div><dt>Longitude</dt><dd>{selectedLineNode[1].toFixed(6)}</dd></div>
                        </dl>
                        <p>{mode === "add-line-node"
                          ? "Click the map to place a node after this one. You can add several before finishing."
                          : "Drag this blue node on the map, use Street View, or paste a Google Maps location. Save the firing line to keep your changes."}</p>
                        <div className="line-detail-actions">
                          <button className="quiet-small-button" type="button" onClick={mode === "add-line-node" ? finishLineNodePlacement : beginLineNodePlacement}>
                            {mode === "add-line-node" ? "Finish placing nodes" : "Add node after this one"}
                          </button>
                          <button className="danger-text-button firing-line-delete-node-button" type="button" disabled={lineDraft.coordinates.length <= 2} onClick={deleteSelectedLineNode} title={lineDraft.coordinates.length <= 2 ? "A firing line must keep at least two nodes." : undefined}>
                            {lineDraft.coordinates.length <= 2 ? "At least two nodes are required" : "Delete selected node"}
                          </button>
                        </div>
                        <div className="firing-line-node-street-view">
                          <a
                            className="firing-line-street-view-link"
                            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedLineNode[0]},${selectedLineNode[1]}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open this node in Google Street View <span aria-hidden="true">↗</span>
                          </a>
                          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ? (
                            <>
                              <button type="button" className="quiet-small-button" aria-expanded={showLineNodeStreetView} onClick={() => setShowLineNodeStreetView((current) => !current)}>
                                {showLineNodeStreetView ? "Close in-app Street View" : "Open in-app Street View"}
                              </button>
                              {showLineNodeStreetView && (
                                <GoogleStreetViewEditor
                                  key={`${lineDraft.id}-${selectedLineNodeIndex}`}
                                  apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim()}
                                  latitude={selectedLineNode[0]}
                                  longitude={selectedLineNode[1]}
                                  onPositionChange={handleLineNodeStreetViewPosition}
                                  onUsePosition={handleLineNodeStreetViewPosition}
                                  instructions="The selected node follows the panorama. Save the firing line to record its updated position."
                                />
                              )}
                            </>
                          ) : null}
                          <details className="manual-street-view-fallback" open={!import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()}>
                            <summary>Paste a Google Maps share link or coordinates</summary>
                            <label className="street-view-input-label" htmlFor={`line-node-location-${lineDraft.id}-${selectedLineNodeIndex}`}>Google Maps share link or latitude, longitude</label>
                            <textarea
                              id={`line-node-location-${lineDraft.id}-${selectedLineNodeIndex}`}
                              rows={2}
                              value={lineNodeLocationInput}
                              onChange={(event) => {
                                setLineNodeLocationInput(event.target.value);
                                setLineNodeLocationError("");
                                setLineNodeLocationMessage("");
                              }}
                              placeholder="Paste a phone Share link or enter 16.4021, 120.5960"
                            />
                            <button type="button" className="quiet-small-button" onClick={applyLineNodeLocation} disabled={isResolvingLineNodeLocation} aria-busy={isResolvingLineNodeLocation}>{isResolvingLineNodeLocation ? "Resolving Maps link…" : "Use this location"}</button>
                            {lineNodeLocationError && <p className="form-error" role="alert">{lineNodeLocationError}</p>}
                            {lineNodeLocationMessage && <p className="inline-save-status" role="status">{lineNodeLocationMessage}</p>}
                          </details>
                          <p className="imagery-note">Node moves stay in this firing-line draft until you save the line.</p>
                        </div>
                      </section>
                    )}
                    {lineDraft.sample && <p className="sample-line-note">This illustrative demo line is labeled for verification.</p>}
                    <label className="field-label">Review note<textarea value={lineDraft.notes} onChange={(event) => setLineDraft((current) => ({ ...current, notes: event.target.value }))} rows="2" placeholder="Add a note about this route" /></label>
                    <div className="editor-actions"><button className="primary-small-button primary-small-button--violet" type="submit">{lineDraft.isNew ? "Save firing line" : "Save line changes"}</button><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button></div>
                  </form>
                ) : selectedLine ? (
                  <div className="line-detail-card">
                    <div className="line-detail-topline"><span className="line-swatch" /><span className="eyebrow">Firing line · {selectedLine.coordinates.length} nodes</span>{selectedLine.sample && <span className="demo-badge">Demo example</span>}</div>
                    <h3>{selectedLine.name}</h3>
                    {selectedLine.notes && <p className="line-review-note">{selectedLine.notes}</p>}
                    <div className="line-detail-actions"><button className="quiet-small-button" type="button" onClick={() => beginEditLine(selectedLine)}>Edit line</button><button className="danger-text-button" type="button" onClick={() => requestDelete("line", selectedLine)}>Delete</button></div>
                  </div>
                ) : selectedBarangay.firingLines.length === 0 ? (
                  <div className="line-empty-state"><span aria-hidden="true">⌁</span><strong>No firing lines yet</strong><p>Add a line, then click map locations to trace its path. Double-click or use Finish line to complete it.</p></div>
                ) : null}
                <ul className="firing-line-list" aria-label="Firing lines">
                  {selectedBarangay.firingLines.map((line) => (
                    <li key={line.id} className={selectedLineId === line.id ? "firing-line-row--active" : ""}>
                      <button className="firing-line-select" type="button" onClick={() => selectLine(line.id)}><span className="line-swatch" /><span><strong>{line.name}</strong><small>{line.coordinates.length} nodes{line.sample ? " · demo example" : ""}</small></span></button>
                      <div className="firing-line-actions"><button type="button" className="line-edit-button" onClick={() => beginEditLine(line)}>Edit</button><button type="button" className="danger-text-button" onClick={() => requestDelete("line", line)}>Delete</button></div>
                    </li>
                  ))}
                </ul>
                  </>
                </AnimatedSize>
              </section>
  );
}
