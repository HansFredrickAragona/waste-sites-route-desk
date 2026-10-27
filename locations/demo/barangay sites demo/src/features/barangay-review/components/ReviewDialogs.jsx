import { DialogShell } from "../../../shared/ui/DialogShell.jsx";
import { formatNumber, formatTime } from "../../../shared/utils/reviewFormatting.js";
import { ActivityLogDialog } from "../../activity-log/components/ActivityLogDialog.jsx";

export default function ReviewDialogs({ state, data, actions }) {
  const { showActivity, showExportConfirmation, exportFilename, exportChangeSummary, exportChangeCount, showBarangayDetails, barangayDetailsDraft, showConfirmationContact, confirmationContactDraft, showJsonDeleteConfirmation, pendingDelete } = state;
  const { activeJson, activityLog, selectedBarangay } = data;
  const { setShowActivity, setShowExportConfirmation, setExportFilename, exportReview, saveBarangayDetails, setShowBarangayDetails, setBarangayDetailsDraft, saveConfirmationContact, setConfirmationContactDraft, setShowConfirmationContact, deleteActiveJson, setShowJsonDeleteConfirmation, setPendingDelete, confirmDelete } = actions;
  return (
    <>
      <ActivityLogDialog open={showActivity} entries={activityLog} onClose={() => setShowActivity(false)} />

      <DialogShell open={showExportConfirmation} onClose={() => setShowExportConfirmation(false)} titleId="export-confirmation-title" className="export-confirmation-dialog">
        <header className="dialog-header export-confirmation-header">
          <div className="dialog-heading-lockup"><span className="export-confirmation-mark" aria-hidden="true">↓</span><div><h2 id="export-confirmation-title">Review JSON before export</h2><p>Check the changes and name the file you’ll download.</p></div></div>
          <button className="icon-close" type="button" aria-label="Close export summary" onClick={() => setShowExportConfirmation(false)}>×</button>
        </header>
        <div className="export-confirmation-body">
          <div className="export-source-card"><span>Original JSON</span><strong>{activeJson?.name ?? "No JSON selected"}</strong></div>
          <label className="field-label export-filename-field">Export file name<input autoFocus value={exportFilename} onChange={(event) => setExportFilename(event.target.value)} aria-label="Export file name" /><small>The file will be downloaded as a .json file.</small></label>
          <div className="export-change-summary" aria-label="Summary of changes from the original JSON">
            <article className="export-change-total export-change-total--added"><span>Added</span><strong>{formatNumber(exportChangeSummary.added.length)}</strong></article>
            <article className="export-change-total export-change-total--removed"><span>Removed</span><strong>{formatNumber(exportChangeSummary.removed.length)}</strong></article>
            <article className="export-change-total export-change-total--edited"><span>Edited</span><strong>{formatNumber(exportChangeSummary.edited.length)}</strong></article>
          </div>
          {exportChangeCount === 0 && <p className="export-no-changes">No recorded collection-site, firing-line, or barangay-detail changes from the original JSON.</p>}
          <div className="export-change-groups">
            {[
              { category: "added", title: "Added", entries: exportChangeSummary.added },
              { category: "removed", title: "Removed", entries: exportChangeSummary.removed },
              { category: "edited", title: "Edited", entries: exportChangeSummary.edited },
            ].map((group) => <section className={`export-change-group export-change-group--${group.category}`} key={group.category}>
              <header><h3>{group.title}</h3><span>{formatNumber(group.entries.length)}</span></header>
              {group.entries.length ? <ul>{group.entries.map((entry, index) => <li key={`${entry.id ?? entry.itemName}-${index}`}><strong>{entry.itemName || entry.itemType}</strong><small>{entry.barangayName || "Barangay not recorded"}{entry.details ? ` · ${entry.details}` : ""}</small><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></li>)}</ul> : <p>No {group.title.toLocaleLowerCase()} items recorded.</p>}
            </section>)}
          </div>
        </div>
        <footer className="dialog-actions export-confirmation-actions"><button className="quiet-small-button" type="button" onClick={() => setShowExportConfirmation(false)}>Cancel</button><button className="primary-small-button" type="button" onClick={exportReview}>Download JSON</button></footer>
      </DialogShell>

      <DialogShell open={showBarangayDetails} onClose={() => setShowBarangayDetails(false)} titleId="barangay-details-title" className="details-dialog">
        <header className="dialog-header"><div className="dialog-heading-lockup"><span className="details-mark" aria-hidden="true">⌂</span><div><p className="eyebrow">Barangay information</p><h2 id="barangay-details-title">Update barangay details</h2></div></div><button className="icon-close" type="button" aria-label="Close barangay details" onClick={() => setShowBarangayDetails(false)}>×</button></header>
        <form className="details-form" onSubmit={saveBarangayDetails}>
          <div className="details-barangay-name"><span>Editing barangay name</span><strong>{barangayDetailsDraft.name || "Enter a name"}</strong></div>
          <label className="field-label">Barangay name<input autoFocus value={barangayDetailsDraft.name} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Enter barangay name" /></label>
          <label className="field-label">Puroks<textarea value={barangayDetailsDraft.puroks} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, puroks: event.target.value }))} rows="7" placeholder={"Purok 1\nPurok 2\nPurok 3"} /><small>Enter one purok per line. Commas are also accepted.</small></label>
          <label className="field-label">Barangay review notes<textarea value={barangayDetailsDraft.notes} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, notes: event.target.value }))} rows="4" placeholder="Add details or questions raised during the review" /></label>
          <div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowBarangayDetails(false)}>Cancel</button><button className="primary-small-button" type="submit">Save details</button></div>
        </form>
      </DialogShell>

      <DialogShell open={showConfirmationContact} onClose={() => setShowConfirmationContact(false)} titleId="confirmation-contact-title" className="confirmation-contact-dialog">
        <header className="dialog-header">
          <div className="dialog-heading-lockup"><span className="confirmation-contact-mark" aria-hidden="true">✓</span><div><p className="eyebrow">Barangay confirmation</p><h2 id="confirmation-contact-title">{selectedBarangay?.confirmed ? "Update contact details" : "Confirm barangay details"}</h2></div></div>
          <button className="icon-close" type="button" aria-label="Close confirmation details" onClick={() => setShowConfirmationContact(false)}>×</button>
        </header>
        <form className="confirmation-contact-form" onSubmit={saveConfirmationContact}>
          <p className="confirmation-contact-intro">Record who you spoke with so this review has a contact for the barangay confirmation.</p>
          <label className="field-label">Official’s name<input autoFocus required value={confirmationContactDraft.name} onChange={(event) => setConfirmationContactDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name of the person you spoke with" /></label>
          <div className="confirmation-contact-fields">
            <label className="field-label">Position or role<input value={confirmationContactDraft.position} onChange={(event) => setConfirmationContactDraft((current) => ({ ...current, position: event.target.value }))} placeholder="e.g. Barangay Secretary" /></label>
            <label className="field-label">Contact number<input type="tel" value={confirmationContactDraft.phone} onChange={(event) => setConfirmationContactDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" /></label>
            <label className="field-label confirmation-contact-email">Email address<input type="email" value={confirmationContactDraft.email} onChange={(event) => setConfirmationContactDraft((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" /></label>
          </div>
          <div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowConfirmationContact(false)}>Cancel</button><button className="primary-small-button" type="submit">{selectedBarangay?.confirmed ? "Save contact" : "Confirm barangay"}</button></div>
        </form>
      </DialogShell>

      <DialogShell open={showJsonDeleteConfirmation} onClose={() => setShowJsonDeleteConfirmation(false)} titleId="delete-json-title" className="delete-dialog">
        <div className="delete-dialog-content"><span className="delete-symbol" aria-hidden="true">!</span><p className="eyebrow">Remove from this browser</p><h2 id="delete-json-title">Delete this JSON?</h2><p className="delete-item-name">{activeJson?.name}</p><p className="delete-description">This removes the JSON and its saved review from the selector. The original file on disk will remain unchanged.</p><div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowJsonDeleteConfirmation(false)}>Cancel</button><button className="delete-submit" type="button" onClick={deleteActiveJson}>Delete JSON</button></div></div>
      </DialogShell>

      <DialogShell open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} titleId="delete-title" className="delete-dialog">
        <div className="delete-dialog-content"><span className="delete-symbol" aria-hidden="true">!</span><p className="eyebrow">Remove from this review</p><h2 id="delete-title">Delete {pendingDelete?.kind === "line" ? "firing line" : "collection-site pin"}?</h2><p className="delete-item-name">{pendingDelete?.name}</p><p className="delete-description">This item will be removed from the barangay review copy and included in the activity log.</p><div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="delete-submit" type="button" onClick={confirmDelete}>Delete item</button></div></div>
      </DialogShell>

    </>
  );
}
