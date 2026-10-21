import { useEffect, useState } from "react";
import { parseMapCoordinates } from "../data/mapCoordinates.js";
import { PIN_STATUS_OPTIONS } from "../data/scheduleModel.js";
import GoogleStreetViewEditor from "./GoogleStreetViewEditor.jsx";

function toDraft(site) {
  return {
    siteName: site?.siteName ?? "",
    mapLabel: site?.mapLabel ?? "",
    barangay: site?.barangay ?? site?.assignedBarangay ?? "",
    pinStatus: site?.pinStatus ?? "Unverified / For Checking",
    latitude: String(site?.latitude ?? ""),
    longitude: String(site?.longitude ?? ""),
  };
}

function validPosition(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export default function SiteDetailsCard({
  site,
  readOnly = false,
  isNew = false,
  positionUpdate,
  onDraftPosition,
  onEditModeChange,
  onCancel,
  onSave,
  onDelete,
  saveMessage,
}) {
  const [draft, setDraft] = useState(() => toDraft(site));
  const [formError, setFormError] = useState("");
  const [streetViewInput, setStreetViewInput] = useState("");
  const [streetViewError, setStreetViewError] = useState("");
  const [streetViewMessage, setStreetViewMessage] = useState("");
  const [showEmbeddedStreetView, setShowEmbeddedStreetView] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  useEffect(() => {
    setDraft(toDraft(site));
    setFormError("");
    setStreetViewInput("");
    setStreetViewError("");
    setStreetViewMessage("");
    setShowEmbeddedStreetView(false);
    setShowSaveConfirmation(false);
    setIsEditing(isNew && !readOnly);
  }, [site?.id, site?.siteName, site?.mapLabel, site?.barangay, site?.pinStatus, site?.latitude, site?.longitude, isNew, readOnly]);

  useEffect(() => {
    if (!site || positionUpdate?.siteId !== site.id) return;
    const latitude = String(positionUpdate.latitude.toFixed(6));
    const longitude = String(positionUpdate.longitude.toFixed(6));
    setDraft((current) => ({ ...current, latitude, longitude }));
    setStreetViewMessage(`Pin position updated to ${latitude}, ${longitude}. Save pin to review and confirm.`);
    setFormError("");
  }, [positionUpdate?.siteId, positionUpdate?.latitude, positionUpdate?.longitude, site?.id]);

  if (!site) {
    return (
      <aside className="site-details site-details--empty" aria-label="Site details">
        <div className="details-empty-icon" aria-hidden="true">⌖</div>
        <p className="eyebrow">Site details</p>
        <h3>Select a site pin</h3>
        <p>Click a pin to view its details. Choose Edit pin before changing or moving it.</p>
      </aside>
    );
  }

  function previewCoordinates(latitudeText, longitudeText) {
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (latitudeText.trim() === "" || longitudeText.trim() === "" || !validPosition(latitude, longitude)) return;
    onDraftPosition?.(site.id, latitude, longitude);
  }

  function setField(field, value) {
    const nextDraft = { ...draft, [field]: value };
    setDraft(nextDraft);
    if (field === "latitude" || field === "longitude") {
      previewCoordinates(nextDraft.latitude, nextDraft.longitude);
    }
  }

  function applyStreetViewLocation() {
    const coordinates = parseMapCoordinates(streetViewInput);
    if (!coordinates) {
      setStreetViewError("Paste a full Google Maps link or coordinates as latitude, longitude. Short links do not include coordinates.");
      setStreetViewMessage("");
      return;
    }

    const nextDraft = {
      ...draft,
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude),
    };
    setDraft(nextDraft);
    onDraftPosition?.(site.id, coordinates.latitude, coordinates.longitude);
    setStreetViewError("");
    setStreetViewMessage("Coordinates updated. Choose Save pin to review and confirm the changes.");
    setFormError("");
  }

  function handlePanoramaPosition(position) {
    const latitude = position.latitude.toFixed(6);
    const longitude = position.longitude.toFixed(6);
    if (Number(draft.latitude).toFixed(6) === latitude && Number(draft.longitude).toFixed(6) === longitude) return;

    setDraft((current) => ({ ...current, latitude, longitude }));
    onDraftPosition?.(site.id, position.latitude, position.longitude);
    setStreetViewError("");
    setStreetViewMessage(`Street View moved to ${latitude}, ${longitude}. Save pin to review and confirm.`);
    setFormError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (draft.latitude.trim() === "" || draft.longitude.trim() === "") {
      setFormError("Enter both latitude and longitude before saving.");
      return;
    }
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setFormError("Enter a valid latitude between -90 and 90.");
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setFormError("Enter a valid longitude between -180 and 180.");
      return;
    }

    setFormError("");
    setShowSaveConfirmation(true);
  }

  function confirmSave() {
    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    if (!validPosition(latitude, longitude)) {
      setFormError("Enter valid coordinates before confirming.");
      setShowSaveConfirmation(false);
      return;
    }

    const result = onSave(site.id, {
      site_name: draft.siteName.trim(),
      map_label: draft.mapLabel.trim(),
      barangay: draft.barangay.trim(),
      latitude,
      longitude,
      pinStatus: draft.pinStatus,
    });
    if (result === false || result === null) {
      setFormError("This pin could not be saved. Check that it belongs to an assigned area.");
      setShowSaveConfirmation(false);
      return;
    }

    setFormError("");
    setShowSaveConfirmation(false);
    setIsEditing(false);
    setShowEmbeddedStreetView(false);
    onEditModeChange?.(null);
  }

  function cancelEditing() {
    setDraft(toDraft(site));
    setFormError("");
    setStreetViewInput("");
    setStreetViewError("");
    setStreetViewMessage("");
    setShowEmbeddedStreetView(false);
    setShowSaveConfirmation(false);
    setIsEditing(false);
    onEditModeChange?.(null);
    onCancel?.(site.id);
  }

  function startEditing() {
    if (readOnly) return;
    setDraft(toDraft(site));
    setFormError("");
    setIsEditing(true);
    onEditModeChange?.(site.id);
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${site.siteName || "this site pin"} from the local working copy? The bundled source JSON will remain unchanged.`)) return;
    onDelete(site);
  }

  const streetViewLatitude = isEditing && Number.isFinite(Number(draft.latitude)) ? Number(draft.latitude) : site.latitude;
  const streetViewLongitude = isEditing && Number.isFinite(Number(draft.longitude)) ? Number(draft.longitude) : site.longitude;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewLatitude},${streetViewLongitude}`;
  const displayLatitude = isEditing ? Number(draft.latitude) : site.latitude;
  const displayLongitude = isEditing ? Number(draft.longitude) : site.longitude;

  return (
    <aside className={`site-details${readOnly ? " site-details--reference" : ""}`} aria-label={isEditing ? "Edit site details" : readOnly ? "Previous route site details" : "Site details"}>
      <div className="details-topline">
        <p className="eyebrow">{isNew ? "New collection pin" : "Site pin"}</p>
        {validPosition(displayLatitude, displayLongitude) && (
          <span className="site-coordinate-badge">{displayLatitude.toFixed(5)}, {displayLongitude.toFixed(5)}</span>
        )}
      </div>
      <h3>{draft.siteName || (isNew ? "New site pin" : "Unnamed site")}</h3>

      {showSaveConfirmation ? (
        <section className="pin-save-confirmation" role="group" aria-label="Confirm pin details">
          <p className="eyebrow">Review before saving</p>
          <h4>{isNew ? "Confirm new pin" : "Confirm pin changes"}</h4>
          <dl className="pin-confirmation-details">
            <div><dt>Site name</dt><dd>{draft.siteName.trim() || "Not provided"}</dd></div>
            <div><dt>Map label</dt><dd>{draft.mapLabel.trim() || "Not provided"}</dd></div>
            <div><dt>Barangay</dt><dd>{draft.barangay.trim() || "Not provided"}</dd></div>
            <div><dt>Pin status</dt><dd>{draft.pinStatus}</dd></div>
            <div><dt>Coordinates</dt><dd>{Number(draft.latitude).toFixed(6)}, {Number(draft.longitude).toFixed(6)}</dd></div>
          </dl>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="site-edit-actions">
            <button type="button" className="primary-small-button" onClick={confirmSave}>Confirm and save pin</button>
            <button type="button" className="quiet-small-button" onClick={() => setShowSaveConfirmation(false)}>Back to edit</button>
          </div>
        </section>
      ) : isEditing ? (
        <form className="site-edit-form" onSubmit={handleSubmit}>
          <label>
            Site name
            <input value={draft.siteName} onChange={(event) => setField("siteName", event.target.value)} />
          </label>
          <label>
            Map label
            <textarea rows={3} value={draft.mapLabel} onChange={(event) => setField("mapLabel", event.target.value)} />
          </label>
          <label>
            Barangay
            <input value={draft.barangay} onChange={(event) => setField("barangay", event.target.value)} />
          </label>
          <label>
            Pin status
            <select value={draft.pinStatus} onChange={(event) => setField("pinStatus", event.target.value)}>
              {PIN_STATUS_OPTIONS.map((status) => <option key={status.key} value={status.value}>{status.value}</option>)}
            </select>
          </label>
          <div className="coordinate-edit-grid">
            <label>
              Latitude
              <input type="number" step="0.000001" min="-90" max="90" value={draft.latitude} onChange={(event) => setField("latitude", event.target.value)} />
            </label>
            <label>
              Longitude
              <input type="number" step="0.000001" min="-180" max="180" value={draft.longitude} onChange={(event) => setField("longitude", event.target.value)} />
            </label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="site-edit-actions">
            <button type="submit" className="primary-small-button">Save pin</button>
            <button type="button" className="quiet-small-button" onClick={cancelEditing}>{isNew ? "Discard new pin" : "Cancel"}</button>
          </div>
        </form>
      ) : (
        <>
          <dl className="site-detail-list">
            <div><dt>Pickup time</dt><dd>{site.pickupTime || "No pickup time provided"}</dd></div>
            <div><dt>Map label</dt><dd>{site.mapLabel || "No map label provided"}</dd></div>
            <div><dt>Barangay</dt><dd>{site.barangay || site.assignedBarangay || "No barangay provided"}</dd></div>
            <div>
              <dt>Pin status</dt>
              <dd>
                <span className={`pin-status-label pin-status-label--${site.pinStatusKey || "unchecked"}`}>
                  <i className={`map-pin-status-swatch map-pin-status-swatch--${site.pinStatusKey || "unchecked"}`} aria-hidden="true" />
                  {site.pinStatus || "Unverified / For Checking"}
                </span>
              </dd>
            </div>
            {validPosition(site.latitude, site.longitude) && (
              <div><dt>Coordinates</dt><dd>{site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}</dd></div>
            )}
          </dl>
          {readOnly ? (
            <p className="source-match-note">
              Previous route reference · {site.referenceDriverName} · {site.referenceDay}
            </p>
          ) : (
            <div className="site-edit-actions site-view-actions">
              <button type="button" className="primary-small-button" onClick={startEditing}>Edit pin</button>
              <button type="button" className="danger-small-button" onClick={handleDelete}>Delete pin</button>
            </div>
          )}
        </>
      )}

      {saveMessage && <p className="inline-save-status" role="status">{saveMessage}</p>}
      <p className="source-match-note">
        Assigned area: {site.areaName || "Area name not provided"}
        {site.assignedBarangay ? ` · ${site.assignedBarangay}` : ""}
      </p>
      {site.sourceBarangays?.length > 0 && (
        <p className="source-match-note">SWMD reference match: {site.sourceBarangays.join(", ")}</p>
      )}
      <a className="maps-link" href={streetViewUrl} target="_blank" rel="noreferrer">
        Check Street View in Google Maps <span aria-hidden="true">↗</span>
      </a>
      {isEditing && !showSaveConfirmation && <section className="street-view-handoff" aria-label="Use a Street View location for this pin">
        <p className="street-view-title">Verify this location in Street View</p>
        {googleMapsApiKey ? (
          <>
            <p className="imagery-note">Move through Street View here. The coordinate fields follow its location. Save pin to review and confirm all changes.</p>
            <button
              type="button"
              className="quiet-small-button"
              onClick={() => setShowEmbeddedStreetView((current) => !current)}
            >
              {showEmbeddedStreetView ? "Close in-app Street View" : "Open in-app Street View"}
            </button>
            {showEmbeddedStreetView && (
              <GoogleStreetViewEditor
                key={site.id}
                apiKey={googleMapsApiKey}
                latitude={Number.isFinite(Number(draft.latitude)) ? Number(draft.latitude) : site.latitude}
                longitude={Number.isFinite(Number(draft.longitude)) ? Number(draft.longitude) : site.longitude}
                onPositionChange={handlePanoramaPosition}
                onUsePosition={handlePanoramaPosition}
              />
            )}
            {streetViewMessage && <p className="inline-save-status" role="status">{streetViewMessage}</p>}
          </>
        ) : (
          <p className="imagery-note">Automatic coordinate updates need a Google Maps API key. Until one is configured, open Street View using the link above and paste its coordinates below.</p>
        )}
        <details className="manual-street-view-fallback" open={!googleMapsApiKey}>
          <summary>Paste a Maps link or coordinates instead</summary>
          <label className="street-view-input-label" htmlFor="street-view-location">Google Maps link or coordinates</label>
          <textarea
            id="street-view-location"
            rows={2}
            value={streetViewInput}
            onChange={(event) => {
              setStreetViewInput(event.target.value);
              setStreetViewError("");
              setStreetViewMessage("");
            }}
            placeholder="16.4021, 120.5960 or paste a full Maps link"
          />
          <button type="button" className="quiet-small-button" onClick={applyStreetViewLocation}>Use these coordinates</button>
          {streetViewError && <p className="form-error" role="alert">{streetViewError}</p>}
          {streetViewMessage && <p className="inline-save-status" role="status">{streetViewMessage}</p>}
        </details>
        <p className="imagery-note">Street View coverage varies. Pin edits are saved in this browser; export a new JSON file for a portable copy.</p>
      </section>}
    </aside>
  );
}
