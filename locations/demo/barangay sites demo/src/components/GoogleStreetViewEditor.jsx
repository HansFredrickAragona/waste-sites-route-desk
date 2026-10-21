import { useEffect, useRef, useState } from "react";

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve(window.google.maps);
  if (window.baguioGoogleMapsPromise) return window.baguioGoogleMapsPromise;

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
  script.async = true;
  script.defer = true;

  const loadPromise = new Promise((resolve, reject) => {
    script.addEventListener("load", () => {
      if (window.google?.maps?.StreetViewPanorama) resolve(window.google.maps);
      else reject(new Error("Google Maps loaded without Street View support."));
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps could not be loaded. Check the API key and Maps JavaScript API settings.")), { once: true });
  });

  window.baguioGoogleMapsPromise = loadPromise.catch((error) => {
    delete window.baguioGoogleMapsPromise;
    throw error;
  });
  document.head.append(script);
  return window.baguioGoogleMapsPromise;
}

export default function GoogleStreetViewEditor({ apiKey, latitude, longitude, onPositionChange, onUsePosition, instructions }) {
  const containerRef = useRef(null);
  const initialPositionRef = useRef({ latitude, longitude });
  const onPositionChangeRef = useRef(onPositionChange);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(null);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    let disposed = false;
    let panorama;
    let positionListener;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (disposed || !containerRef.current) return;
        panorama = new maps.StreetViewPanorama(containerRef.current, {
          position: { lat: initialPositionRef.current.latitude, lng: initialPositionRef.current.longitude },
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: true,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        });
        positionListener = panorama.addListener("position_changed", () => {
          const point = panorama.getPosition();
          if (!point) return;
          const position = {
            latitude: Number(point.lat().toFixed(6)),
            longitude: Number(point.lng().toFixed(6)),
          };
          setCurrentPosition(position);
          onPositionChangeRef.current(position);
        });
        setIsLoading(false);
      })
      .catch((error) => {
        if (!disposed) {
          setIsLoading(false);
          setLoadError(error instanceof Error ? error.message : "Google Maps could not be loaded.");
        }
      });

    return () => {
      disposed = true;
      positionListener?.remove();
      if (panorama && window.google?.maps?.event) window.google.maps.event.clearInstanceListeners(panorama);
    };
  }, [apiKey]);

  return (
    <div className="street-view-editor">
      <div ref={containerRef} className="street-view-panorama" aria-label="Google Street View panorama" />
      {isLoading && <p className="imagery-note" role="status">Loading Street View…</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {currentPosition && (
        <>
          <p className="street-view-current-position">Current panorama: {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}</p>
          <button type="button" className="quiet-small-button" onClick={() => onUsePosition(currentPosition)}>
            Use this Street View position
          </button>
        </>
      )}
      <p className="imagery-note">{instructions || "Move through the panorama to update the pin coordinates. Save the pin to keep the review changes."}</p>
    </div>
  );
}
