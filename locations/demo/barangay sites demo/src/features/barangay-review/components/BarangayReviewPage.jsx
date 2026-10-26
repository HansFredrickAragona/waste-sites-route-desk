import CollectionMapCard from "./CollectionMapCard.jsx";
import PinManagerCard from "./PinManagerCard.jsx";
import FiringLinesCard from "./FiringLinesCard.jsx";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

export default function BarangayReviewPage({ data, ui, actions, refs, helpers }) {
  const { selectedBarangay, activeJson } = data;
  const { page, pinDraft } = ui;
  const { openDetailsEditor, setConfirmed, openConfirmationContactEditor } = actions;
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

          <section className="map-filter-preview" aria-label="Map filter preview">
            <div className="map-filter-title"><span className="filter-funnel" aria-hidden="true">▽</span><div><strong>Map filters</strong><small>Preview only</small></div></div>
            <label><span>Purok</span><select disabled value="all" aria-label="Purok map filter placeholder"><option value="all">All puroks</option></select></label>
            <label><span>Site status</span><select disabled value="all" aria-label="Site status map filter placeholder"><option value="all">All sites</option></select></label>
            <label><span>Review</span><select disabled value="all" aria-label="Review map filter placeholder"><option value="all">Any status</option></select></label>
            <p>Filters are visual placeholders for this demo.</p>
          </section>

          <div className={`map-layout barangay-map-layout${pinDraft ? " barangay-map-layout--pin-editing" : ""}`}>
            <CollectionMapCard data={data} ui={ui} actions={actions} refs={refs} />
            <aside className="map-side-panel barangay-tools-panel" aria-label="Manage collection pins and firing lines">
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
