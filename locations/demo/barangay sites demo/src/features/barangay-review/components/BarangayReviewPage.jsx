import CollectionMapCard from "./CollectionMapCard.jsx";
import PinManagerCard from "./PinManagerCard.jsx";
import FiringLinesCard from "./FiringLinesCard.jsx";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

export default function BarangayReviewPage({ data, ui, actions, refs, helpers }) {
  const { selectedBarangay, activeJson, mapFilteredPins, mapPurokOptions, mapSiteStatusOptions } = data;
  const { page, pinDraft, mapPurokFilter, mapSiteStatusFilter, activeToolsPanel } = ui;
  const { openDetailsEditor, setConfirmed, openConfirmationContactEditor, setMapPurokFilter, setMapSiteStatusFilter, setSelectedPinId } = actions;
  return (
    <>
      {page === "map" && selectedBarangay && (
        <section className="map-view barangay-map-view" aria-labelledby="barangay-map-title">
          <div className="map-page-heading">
            <div>
              <h1 id="barangay-map-title">{selectedBarangay.name}</h1>
            </div>
            <div className="barangay-review-actions">
              <button className="secondary-action" type="button" onClick={openDetailsEditor}><span aria-hidden="true">✎</span>Update barangay details</button>
              <label className={`confirmation-control${selectedBarangay.confirmed ? " confirmation-control--on" : ""}`}>
                <span className="confirmation-copy"><strong>{selectedBarangay.confirmed ? "Information confirmed" : "Not yet confirmed"}</strong><small>Barangay review status</small></span>
                <input type="checkbox" checked={selectedBarangay.confirmed} onChange={(event) => event.target.checked ? openConfirmationContactEditor() : setConfirmed(false)} aria-label={`Mark ${selectedBarangay.name} information confirmed`} />
                <span className="confirmation-switch" aria-hidden="true"><i /></span>
              </label>
              {selectedBarangay.confirmed && <button className="confirmation-contact-edit" type="button" onClick={openConfirmationContactEditor}>{selectedBarangay.confirmationContact?.name ? "Edit contact" : "Add contact"}</button>}
            </div>
          </div>

          <div className="barangay-summary-strip">
            <div><span className="summary-strip-icon summary-strip-icon--green">●</span><strong>{formatNumber(selectedBarangay.pins.length)}</strong><small>site records</small></div>
            <div><span className="summary-strip-icon summary-strip-icon--violet">⌁</span><strong>{formatNumber(selectedBarangay.firingLines.length)}</strong><small>firing lines</small></div>
            <div><span className="summary-strip-icon summary-strip-icon--orange">⌂</span><strong>{formatNumber(selectedBarangay.puroks.length)}</strong><small>puroks recorded</small></div>
            <div className="summary-source-note"><span className="source-dot" /><span>Collection records from {activeJson?.name ?? "No JSON loaded"}</span></div>
          </div>

          <section className="map-filters" aria-label="Map filters">
            <div className="map-filter-title"><span className="filter-funnel" aria-hidden="true">▽</span><strong>Map filters</strong></div>
            <label><span>Purok</span><select value={mapPurokFilter} aria-label="Filter map by purok" onChange={(event) => { setMapPurokFilter(event.target.value); if (!pinDraft) setSelectedPinId(null); }}><option value="all">All puroks</option>{mapPurokOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span>Site status</span><select value={mapSiteStatusFilter} aria-label="Filter map by site status" onChange={(event) => { setMapSiteStatusFilter(event.target.value); if (!pinDraft) setSelectedPinId(null); }}><option value="all">All statuses</option>{mapSiteStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <p aria-live="polite">{formatNumber(mapFilteredPins.length)} of {formatNumber(selectedBarangay.pins.length)} sites shown</p>
          </section>

          <div className={`map-layout barangay-map-layout${pinDraft ? " barangay-map-layout--pin-editing" : ""}${activeToolsPanel ? " barangay-map-layout--tools-expanded" : ""}`}>
            <CollectionMapCard data={data} ui={ui} actions={actions} refs={refs} />
            <aside className={`map-side-panel barangay-tools-panel${activeToolsPanel === "lines" ? " barangay-tools-panel--lines-expanded" : ""}`} aria-label="Manage collection pins and firing lines">
              <PinManagerCard data={data} ui={ui} actions={actions} helpers={helpers} />
              <FiringLinesCard data={data} ui={ui} actions={actions} />
            </aside>
          </div>
          <p className="review-data-note">Your field session and unfinished edits save automatically in this browser. Return from Google Maps or reopen this app to continue. Use <strong>Export JSON</strong> to carry review changes to another device.</p>
        </section>
      )}


    </>
  );
}
