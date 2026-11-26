import { DialogShell } from "../../../shared/ui/DialogShell.jsx";

export function GeoJsonExportPreview({ preview, error, onClose, onDownload }) {
  return (
    <DialogShell open onClose={onClose} titleId="geojson-preview-title" className="geojson-export-preview">
      <header className="dialog-heading">
        <h2 id="geojson-preview-title">Preview GeoJSON</h2>
        <button className="icon-close" type="button" aria-label="Close GeoJSON preview" onClick={onClose}>×</button>
      </header>
      <div className="geojson-preview-content">
        <p><strong>confirmed-barangays.geojson</strong> · {preview.count} mapped collection points</p>
        <p>This is the exact JSON that will download. Coordinates are longitude, latitude.</p>
        <pre tabIndex={0} aria-label="GeoJSON file preview"><code>{preview.text}</code></pre>
        {!preview.count && <p>No mapped collection points are available. This file contains an empty FeatureCollection.</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer className="dialog-actions">
        <button className="quiet-small-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-small-button" type="button" onClick={onDownload}>Confirm and download</button>
      </footer>
    </DialogShell>
  );
}
