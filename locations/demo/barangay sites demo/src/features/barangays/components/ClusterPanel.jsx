import { useState } from "react";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

// Interactive draft-cluster selector shown on the overview map. Selecting a
// cluster opens the glass summary card and frames the cluster on the map. The
// panel header has a browser-style minimize button that keeps the title visible.
export default function ClusterPanel({ summaries, selectedName, onSelect }) {
  const [minimized, setMinimized] = useState(false);
  if (!summaries.length) return null;
  return <section className={`barangays-cluster-panel${minimized ? " barangays-cluster-panel--minimized" : ""}`} aria-label="Draft clusters">
    <header className="barangays-cluster-panel-head">
      <span className="barangays-cluster-panel-title">Clusters</span>
      <span className="barangays-cluster-panel-total">{formatNumber(summaries.length)}</span>
      <button
        className="barangays-cluster-panel-toggle"
        type="button"
        aria-expanded={!minimized}
        aria-controls="barangays-cluster-panel-body"
        aria-label={minimized ? "Maximize cluster list" : "Minimize cluster list"}
        title={minimized ? "Maximize cluster list" : "Minimize cluster list"}
        onClick={() => setMinimized((current) => !current)}
      >{minimized ? "+" : "−"}</button>
    </header>
    <div className="barangays-cluster-panel-body" id="barangays-cluster-panel-body" hidden={minimized}>
      <div className="barangays-cluster-panel-items" role="group" aria-label="Select a draft cluster">
        {summaries.map((summary) => {
          const active = summary.name === selectedName;
          return <button
            key={summary.name}
            type="button"
            className={`barangays-cluster-chip${active ? " barangays-cluster-chip--active" : ""}`}
            aria-pressed={active}
            style={{ "--cluster-color": summary.color }}
            title={`${summary.name} · ${formatNumber(summary.barangayCount)} barangays · ${formatNumber(summary.siteCount)} site records`}
            onClick={() => onSelect(summary.name)}
          >
            <i className="barangays-cluster-chip-dot" aria-hidden="true" />
            <span className="barangays-cluster-chip-name">{summary.name}</span>
            <span className="barangays-cluster-chip-count">{formatNumber(summary.barangayCount)}</span>
          </button>;
        })}
      </div>
      <p className="barangays-cluster-panel-note">Draft proximity groups · counts are barangays in this JSON</p>
    </div>
  </section>;
}
