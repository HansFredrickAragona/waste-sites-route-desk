import { useState } from "react";
import { resolveMapCoordinates } from "../data/mapCoordinates.js";
import GoogleStreetViewEditor from "./GoogleStreetViewEditor.jsx";

function validPosition(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

function positionText(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export default function PinLocationAssistant({ pinId, latitude, longitude, locationInput, onLocationInputChange, onCoordinatesChange }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [showEmbeddedStreetView, setShowEmbeddedStreetView] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const latitudeNumber = Number(latitude);
  const longitudeNumber = Number(longitude);
  const hasPosition = String(latitude ?? "").trim() !== ""
    && String(longitude ?? "").trim() !== ""
    && validPosition(latitudeNumber, longitudeNumber);
  const streetViewUrl = hasPosition
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitudeNumber},${longitudeNumber}`
    : "";

  async function applyMapsLocation() {
    setIsResolvingLocation(true);
    setError("");
    setMessage("");
    try {
      const coordinates = await resolveMapCoordinates(locationInput);
      if (!coordinates) {
        setError("Paste a Google Maps share link or enter latitude, longitude.");
        return;
      }

      onCoordinatesChange(coordinates);
      setShowEmbeddedStreetView(false);
      setMessage(`Pin moved to ${positionText(coordinates.latitude, coordinates.longitude)}. Save the pin to record this location.`);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Could not resolve this Google Maps share link.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  function updateFromStreetView(position) {
    if (!validPosition(position.latitude, position.longitude)) return;
    if (latitudeNumber.toFixed(6) === position.latitude.toFixed(6)
      && longitudeNumber.toFixed(6) === position.longitude.toFixed(6)) return;

    onCoordinatesChange(position);
    setError("");
    setMessage(`Street View moved the pin to ${positionText(position.latitude, position.longitude)}. Save the pin to record this location.`);
  }

  return (
    <section className="street-view-handoff" aria-label="Improve collection-site pin accuracy">
      {streetViewUrl ? (
        <a className="quiet-small-button street-view-maps-link" href={streetViewUrl} target="_blank" rel="noreferrer">
          Open this pin in Google Street View
        </a>
      ) : (
        <p className="imagery-note">Enter valid coordinates to open this pin in Street View.</p>
      )}

      {apiKey ? (
        <>
          <p className="imagery-note">Navigate the panorama here; its position updates the draft pin and map.</p>
          <button
            type="button"
            className="quiet-small-button"
            aria-expanded={showEmbeddedStreetView}
            disabled={!hasPosition}
            onClick={() => setShowEmbeddedStreetView((current) => !current)}
          >
            {showEmbeddedStreetView ? "Close in-app Street View" : "Open in-app Street View"}
          </button>
          {showEmbeddedStreetView && hasPosition && (
            <GoogleStreetViewEditor
              key={pinId}
              apiKey={apiKey}
              latitude={latitudeNumber}
              longitude={longitudeNumber}
              onPositionChange={updateFromStreetView}
              onUsePosition={updateFromStreetView}
              instructions="Move through the panorama to adjust the draft pin. Save the pin to apply this location to the review data."
            />
          )}
        </>
      ) : null}

      <div className="manual-street-view-fallback">
        <label className="street-view-input-label" htmlFor={`pin-maps-location-${pinId}`}>Google Maps share link or latitude, longitude</label>
        <textarea
          id={`pin-maps-location-${pinId}`}
          rows={2}
          value={locationInput}
          onChange={(event) => {
            onLocationInputChange(event.target.value);
            setError("");
            setMessage("");
          }}
          placeholder="Paste a phone Share link or enter 16.4021, 120.5960"
        />
        <button type="button" className="quiet-small-button" onClick={applyMapsLocation} disabled={isResolvingLocation} aria-busy={isResolvingLocation}>{isResolvingLocation ? "Resolving Maps link…" : "Use this location"}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="inline-save-status" role="status">{message}</p>}
      </div>
    </section>
  );
}
