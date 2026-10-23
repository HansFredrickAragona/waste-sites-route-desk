import { useState } from "react";
import { parseMapCoordinates } from "../data/mapCoordinates.js";
import GoogleStreetViewEditor from "./GoogleStreetViewEditor.jsx";

function validPosition(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

function positionText(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export default function PinLocationAssistant({ pinId, latitude, longitude, onCoordinatesChange }) {
  const [locationInput, setLocationInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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

  function applyMapsLocation() {
    const coordinates = parseMapCoordinates(locationInput);
    if (!coordinates) {
      setError("Paste a Google Maps link that contains coordinates, or enter latitude, longitude. Short links do not include coordinates.");
      setMessage("");
      return;
    }

    onCoordinatesChange(coordinates);
    setShowEmbeddedStreetView(false);
    setError("");
    setMessage(`Pin moved to ${positionText(coordinates.latitude, coordinates.longitude)}. Save the pin to record this location.`);
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
      <p className="street-view-title">Improve pin accuracy with Street View</p>
      {streetViewUrl ? (
        <a className="street-view-maps-link" href={streetViewUrl} target="_blank" rel="noreferrer">
          Open this pin in Google Street View <span aria-hidden="true">↗</span>
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

      <details className="manual-street-view-fallback" open={!apiKey}>
        <summary>Paste a Google Maps link or coordinates</summary>
        <label className="street-view-input-label" htmlFor={`pin-maps-location-${pinId}`}>Google Maps link or latitude, longitude</label>
        <textarea
          id={`pin-maps-location-${pinId}`}
          rows={2}
          value={locationInput}
          onChange={(event) => {
            setLocationInput(event.target.value);
            setError("");
            setMessage("");
          }}
          placeholder="16.4021, 120.5960 or paste a Maps link with coordinates"
        />
        <button type="button" className="quiet-small-button" onClick={applyMapsLocation}>Use these coordinates</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="inline-save-status" role="status">{message}</p>}
      </details>
      <p className="imagery-note">Street View coverage varies. Pin changes remain a draft until you save.</p>
    </section>
  );
}
