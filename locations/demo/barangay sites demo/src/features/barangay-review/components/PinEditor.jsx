import PinLocationAssistant from "./PinLocationAssistant.jsx";
import CollectionScheduleFields from "./CollectionScheduleFields.jsx";

export default function PinEditor({ selectedBarangay, pinDraft, setPinDraft, pinLocationInput, setPinLocationInput, savePin, cancelMapMode, onMap, error }) {
  const siteReview = pinDraft.review ?? {};

  function updateSiteReview(field, value) {
    setPinDraft((current) => current ? ({
      ...current,
      review: { ...(current.review ?? {}), [field]: value },
    }) : current);
  }

  return (
    <form className="pin-editor pin-editor-form" onSubmit={savePin}>
      <header className="pin-editor-header">
        <div><h2 id="pin-editor-title">{pinDraft.isNew ? "Add a collection-site pin" : pinDraft.name}</h2><p className="pin-editor-context">{selectedBarangay.name}</p></div>
        <button className="icon-close" type="button" aria-label="Cancel pin editing" onClick={cancelMapMode}>×</button>
      </header>
      <div className="pin-editor-body">
        <div className="pin-editor-column pin-editor-column--site">
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
          <label className={`confirmation-control site-review-confirmation${siteReview.is_brgy_confirmed ? " confirmation-control--on" : ""}`}>
            <span className="confirmation-copy"><strong>Barangay confirmed</strong><small>Mark this site as confirmed</small></span>
            <input type="checkbox" checked={siteReview.is_brgy_confirmed === true} onChange={(event) => updateSiteReview("is_brgy_confirmed", event.target.checked)} aria-label={`Barangay confirmed for ${pinDraft.name}`} />
            <span className="confirmation-switch" aria-hidden="true"><i /></span>
          </label>
        </div>
        <div className="pin-editor-column pin-editor-column--location">
          <section className="pin-editor-section pin-editor-location-section" aria-labelledby="pin-location-title">
            <div className="pin-editor-section-heading"><h3 id="pin-location-title">Location</h3><span>{onMap ? "Drag the pin or enter coordinates" : "Enter coordinates or a Maps link"}</span></div>
            <div className="coordinate-fields"><label className="field-label">Latitude<input type="number" step="any" value={pinDraft.latitude} onChange={(event) => setPinDraft((current) => ({ ...current, latitude: event.target.value }))} /></label><label className="field-label">Longitude<input type="number" step="any" value={pinDraft.longitude} onChange={(event) => setPinDraft((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
            {pinDraft.location?.source === "device_gps" && <p className="field-help gps-capture-note">GPS location captured{Number.isFinite(pinDraft.location.accuracy_m) ? ` · about ±${pinDraft.location.accuracy_m} m` : ""}. A Google Maps link will be saved with this pin.</p>}
            <PinLocationAssistant
              pinId={pinDraft.id}
              latitude={pinDraft.latitude}
              longitude={pinDraft.longitude}
              locationInput={pinLocationInput}
              onLocationInputChange={setPinLocationInput}
              onCoordinatesChange={({ latitude, longitude }) => setPinDraft((current) => current ? ({
                ...current,
                latitude: Number(latitude.toFixed(6)),
                longitude: Number(longitude.toFixed(6)),
              }) : current)}
            />
          </section>
        </div>
        <div className="pin-editor-notes">
          <div className="pin-editor-notes-fields">
            <label className="field-label">Site remarks<textarea value={pinDraft.remarks ?? pinDraft.sourceRemarks ?? ""} onChange={(event) => setPinDraft((current) => ({ ...current, remarks: event.target.value }))} rows="4" placeholder="Add site remarks" /></label>
            <label className="field-label">Review note<textarea value={pinDraft.notes} onChange={(event) => setPinDraft((current) => ({ ...current, notes: event.target.value }))} rows="4" placeholder="Add a note from the discussion" /></label>
          </div>
        </div>
        <section className="pin-editor-section pin-editor-schedule-section" aria-labelledby="pin-schedule-title">
          <div className="pin-editor-section-heading"><h3 id="pin-schedule-title">Collection schedule</h3><span>One row per day · time optional</span></div>
          <CollectionScheduleFields
            schedule={pinDraft.schedule ?? pinDraft.sourceSchedule}
            onChange={(schedule) => setPinDraft((current) => current ? ({ ...current, schedule }) : current)}
          />
        </section>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="editor-actions pin-editor-actions"><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button><button className="primary-small-button" type="submit">{pinDraft.isNew ? "Save pin" : "Save changes"}</button></footer>
    </form>
  );
}
