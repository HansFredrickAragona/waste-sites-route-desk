import { useState } from "react";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

// Glassmorphism summary shown when a draft cluster is selected on the map.
// Lists every barangay in the cluster with its site-record total. The card can
// be minimized to its heading and total, or maximized back to the full list.
export default function ClusterSummaryCard({ summary, visibleIds, onSelectBarangay, onClose }) {
  const [expanded, setExpanded] = useState(true);
  if (!summary) return null;
  const visible = visibleIds ? summary.barangays.filter((barangay) => visibleIds.has(barangay.id)) : summary.barangays;
  const hiddenCount = summary.barangays.length - visible.length;
  return <article className={`barangays-cluster-card${expanded ? "" : " barangays-cluster-card--minimized"}`} aria-labelledby="cluster-card-title">
    <div className="barangays-cluster-card-controls">
      <button
        className="barangays-cluster-card-control"
        type="button"
        aria-expanded={expanded}
        aria-controls="cluster-card-body"
        aria-label={expanded ? "Minimize cluster details" : "Maximize cluster details"}
        title={expanded ? "Minimize cluster details" : "Maximize cluster details"}
        onClick={() => setExpanded((current) => !current)}
      >{expanded ? "−" : "+"}</button>
      <button className="barangays-cluster-card-control barangays-cluster-card-close" type="button" aria-label="Close cluster summary" title="Close cluster summary" onClick={onClose}>×</button>
    </div>
    <header className="barangays-cluster-card-head">
      <span className="barangays-cluster-card-swatch" style={{ background: summary.color }} aria-hidden="true" />
      <div>
        <p className="eyebrow">Draft proximity cluster</p>
        <h2 id="cluster-card-title">{summary.name}</h2>
      </div>
    </header>
    <p className="barangays-cluster-card-total"><strong>{formatNumber(summary.siteCount)}</strong><span>total site records</span></p>
    <div className="barangays-cluster-card-body" id="cluster-card-body" hidden={!expanded}>
      <dl className="barangays-cluster-card-stats">
        <div><dt>Barangays</dt><dd>{formatNumber(summary.barangayCount)}</dd></div>
        <div><dt>Mapped sites</dt><dd>{formatNumber(summary.mappedCount)}</dd></div>
        <div><dt>Confirmed</dt><dd>{formatNumber(summary.confirmedCount)}</dd></div>
      </dl>
      <p className="barangays-cluster-card-location">{hiddenCount > 0 ? `${formatNumber(visible.length)} of ${formatNumber(summary.barangayCount)} barangays shown; the rest are hidden by the current search or type filter.` : "Barangays in this cluster, with the site records saved in the active JSON."}</p>
      <ul className="barangays-cluster-card-list">
        {visible.map((barangay) => <li key={barangay.id}>
          <button type="button" onClick={() => onSelectBarangay(barangay.id)}>
            <span className="barangays-cluster-card-name">
              <strong>{barangay.name}</strong>
              <small className={barangay.confirmed ? "is-confirmed" : ""}>{barangay.confirmed ? "Confirmed" : "Needs review"}</small>
            </span>
            <span className="barangays-cluster-card-sites">{formatNumber(barangay.pins.length)}<small>sites</small></span>
          </button>
        </li>)}
      </ul>
    </div>
  </article>;
}
