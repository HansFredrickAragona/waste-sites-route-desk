import CollectionScheduleFields from "./CollectionScheduleFields.jsx";
import AssignedPuroksField from "./AssignedPuroksField.jsx";

export default function FiringLineEditor({ selectedBarangay, lineDraft, setLineDraft, saveLine, cancelMapMode, onMap, children, error }) {
  return (
    <form className="line-editor" onSubmit={saveLine}>
      <div className="editor-topline"><div><p className="eyebrow">{lineDraft.isNew ? "New feature" : "Edit feature"}</p><h3 id="line-editor-title">{lineDraft.name}</h3></div><button className="icon-close icon-close--small" type="button" aria-label="Cancel line editing" onClick={cancelMapMode}>×</button></div>
      <label className="field-label">Firing-line name<input autoFocus={!onMap} value={lineDraft.name} onChange={(event) => setLineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name this line" /></label>
      <AssignedPuroksField barangayPuroks={selectedBarangay.puroks} lineDraft={lineDraft} setLineDraft={setLineDraft} />
      {children}
      {lineDraft.sample && <p className="sample-line-note">This illustrative demo line is labeled for verification.</p>}
      <label className={`confirmation-control line-review-confirmation${lineDraft.review?.is_brgy_confirmed ? " confirmation-control--on" : ""}`}>
        <span className="confirmation-copy"><strong>Barangay confirmed</strong><small>Mark this firing line as confirmed</small></span>
        <input
          type="checkbox"
          checked={lineDraft.review?.is_brgy_confirmed === true}
          onChange={(event) => setLineDraft((current) => current ? ({
            ...current,
            review: { ...(current.review ?? {}), is_brgy_confirmed: event.target.checked },
          }) : current)}
          aria-label={`Barangay confirmed for ${lineDraft.name}`}
        />
        <span className="confirmation-switch" aria-hidden="true"><i /></span>
      </label>
      <section className="line-schedule-section" aria-label="Firing line collection schedule">
        <div className="pin-editor-section-heading"><h4>Collection schedule</h4><span>One row per day · time optional</span></div>
        <CollectionScheduleFields
          schedule={lineDraft.schedule}
          onChange={(schedule) => setLineDraft((current) => current ? ({ ...current, schedule }) : current)}
        />
      </section>
      <label className="field-label">Review note<textarea value={lineDraft.notes} onChange={(event) => setLineDraft((current) => ({ ...current, notes: event.target.value }))} rows="2" placeholder="Add a note about this route" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="editor-actions"><button className="primary-small-button primary-small-button--violet" type="submit">{lineDraft.isNew ? "Save firing line" : "Save line changes"}</button><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button></div>
    </form>
  );
}
