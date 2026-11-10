import { DashboardDetailPage } from "./DashboardDetailPage.jsx";
import { useMemo } from "react";
import { MetricCard } from "../../../shared/ui/MetricCard.jsx";
import { formatNumber, formatTime, hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";

export function Dashboard({ barangays, siteCount, confirmedCount, activityLog, activeJsonName, onOpenBarangay, onOpenKpi, detail }) {
  const allBarangays = useMemo(() => [...barangays].sort((a, b) => a.name.localeCompare(b.name)), [barangays]);
  const allSiteEntries = useMemo(() => allBarangays.flatMap((barangay) => barangay.pins.map((pin) => ({ barangay, pin }))), [allBarangays]);
  const largestBarangays = [...barangays].sort((a, b) => b.pins.length - a.pins.length || a.name.localeCompare(b.name)).slice(0, 8);
  const maximumSiteCount = Math.max(1, ...largestBarangays.map((barangay) => barangay.pins.length));
  const reviewQueue = [...barangays].filter((barangay) => !barangay.confirmed).sort((a, b) => b.pins.length - a.pins.length);
  const recentEntries = activityLog.slice(0, 5);
  const barangaysWithSites = barangays.filter((barangay) => barangay.pins.length > 0).length;
  const confirmedWithSites = barangays.filter((barangay) => barangay.confirmed && barangay.pins.length > 0).length;
  const siteCoverage = barangaysWithSites === 0 ? 0 : Math.round((confirmedWithSites / barangaysWithSites) * 100);
  if (detail) {
    return <DashboardDetail detail={detail} allBarangays={allBarangays} allSiteEntries={allSiteEntries}
      activityLog={activityLog} siteCount={siteCount} onOpenBarangay={onOpenBarangay} />;
  }

  return (
    <section className="dashboard-view barangay-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading"><div><h1 id="dashboard-title">Review dashboard</h1></div><div className="dashboard-schedule-chip"><span className="dashboard-live-dot" /><span>Active dataset</span><strong>{activeJsonName} · browser saved</strong></div></div>
      <div className="dashboard-metrics">
        <MetricCard tone="green" label="Barangays" value={barangays.length} compact onClick={() => onOpenKpi("dashboard-barangays", "Barangays")} />
        <MetricCard tone="orange" label="Collection sites" value={siteCount} compact onClick={() => onOpenKpi("dashboard-sites", "Collection sites")} />
        <MetricCard tone="violet" label="Confirmed barangays" value={confirmedCount} compact onClick={() => onOpenKpi("confirmed-report", "Confirmed Report")} />
        <MetricCard tone="teal" label="Review changes" value={activityLog.length} compact onClick={() => onOpenKpi("dashboard-changes", "Review changes")} />
      </div>

      <section className="dashboard-coverage-panel" aria-labelledby="coverage-title">
        <div className="dashboard-coverage-panel-heading"><div><h2 id="coverage-title">Barangay confirmation progress</h2></div><span className="dashboard-coverage-tag">{confirmedWithSites} of {barangaysWithSites} with mapped sites confirmed</span></div>
        <div className="dashboard-coverage-grid">
          <div className="dashboard-coverage-item"><div className="dashboard-coverage-heading"><div><h3>Confirmed with site locations</h3></div><strong>{siteCoverage}%</strong></div><div className="dashboard-progress-track"><span style={{ width: `${siteCoverage}%` }} /></div><p className="dashboard-coverage-count">{formatNumber(confirmedWithSites)} confirmed · {formatNumber(Math.max(0, barangaysWithSites - confirmedWithSites))} still open</p></div>
          <div className="dashboard-coverage-item dashboard-coverage-item--violet"><div className="dashboard-coverage-heading"><div><h3>Barangay puroks recorded</h3></div><strong>{barangays.length === 0 ? 0 : Math.round((barangays.filter((barangay) => barangay.puroks.length > 0).length / barangays.length) * 100)}%</strong></div><div className="dashboard-progress-track"><span style={{ width: `${barangays.length === 0 ? 0 : Math.round((barangays.filter((barangay) => barangay.puroks.length > 0).length / barangays.length) * 100)}%` }} /></div><p className="dashboard-coverage-count">{formatNumber(barangays.filter((barangay) => barangay.puroks.length > 0).length)} barangays have at least one purok recorded</p></div>
        </div>
      </section>

      <div className="dashboard-two-column">
        <section className="dashboard-daily-panel" aria-labelledby="largest-title">
          <div className="dashboard-section-heading"><div><h2 id="largest-title">Barangays with the most site pins</h2></div><span className="dashboard-coverage-tag">Top 8</span></div>
          <div className="dashboard-site-bars">{largestBarangays.map((barangay) => <button className="dashboard-site-bar-row" key={barangay.id} type="button" onClick={() => onOpenBarangay(barangay)}><span className="dashboard-bar-label">{barangay.name}</span><span className="dashboard-bar-track"><i style={{ width: `${Math.max(3, (barangay.pins.length / maximumSiteCount) * 100)}%` }} /></span><strong>{formatNumber(barangay.pins.length)}</strong><span className={`mini-confirm-mark${barangay.confirmed ? " mini-confirm-mark--on" : ""}`}>{barangay.confirmed ? "✓" : "·"}</span></button>)}</div>
        </section>

        <section className="dashboard-review-queue" aria-labelledby="queue-title">
          <div className="dashboard-section-heading"><div><h2 id="queue-title">Open barangays</h2></div><span className="queue-count">{formatNumber(barangays.length - confirmedCount)}</span></div>
          <div className="review-queue-list">{reviewQueue.map((barangay) => <button type="button" key={barangay.id} className="review-queue-row" onClick={() => onOpenBarangay(barangay)}><span className="queue-row-copy"><strong>{barangay.name}</strong><small>{formatNumber(barangay.pins.length)} site pins · {barangay.puroks.length ? `${barangay.puroks.length} puroks` : "puroks not recorded"}</small></span><span className="queue-arrow" aria-hidden="true">↗</span></button>)}{reviewQueue.length === 0 && <div className="queue-complete"><span>✓</span><strong>All barangays are confirmed</strong><p>New changes can reopen a barangay for another review.</p></div>}</div>
        </section>
      </div>

      <section className="dashboard-activity-panel" aria-labelledby="recent-activity-title">
        <div className="dashboard-section-heading"><div><h2 id="recent-activity-title">Recent activity</h2></div><span className="dashboard-coverage-tag">{activityLog.length} changes recorded</span></div>
        {recentEntries.length ? <ol className="dashboard-recent-list">{recentEntries.map((entry) => <li key={entry.id}><span className="recent-activity-icon">↶</span><div><strong>{entry.action}</strong><small>{entry.itemName} · {entry.barangayName}</small></div><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></li>)}</ol> : <p className="dashboard-activity-empty">The activity log will fill in as you review barangays together.</p>}
      </section>
    </section>
  );
}

function DashboardDetail({ detail, allBarangays, allSiteEntries, activityLog, siteCount, onOpenBarangay }) {
  const openKpi = detail.id;
  const count = openKpi === "dashboard-sites" ? siteCount : openKpi === "dashboard-changes" ? activityLog.length : allBarangays.length;

  return (
    <DashboardDetailPage title={detail.label} count={count}>
        {openKpi === "dashboard-barangays" && (allBarangays.length ? <ul className="kpi-detail-list">{allBarangays.map((barangay) => <li key={barangay.id}><button className="kpi-detail-row" type="button" onClick={() => onOpenBarangay(barangay)}><span className="kpi-detail-row-main"><strong>{barangay.name}</strong><small>{formatNumber(barangay.pins.length)} collection sites · {barangay.confirmed ? "Confirmed" : "Needs review"}</small></span><span className="kpi-detail-row-arrow" aria-hidden="true">↗</span></button></li>)}</ul> : <p className="kpi-detail-empty">No barangays are in this JSON.</p>)}
        {openKpi === "dashboard-sites" && (allSiteEntries.length ? <ul className="kpi-detail-list">{allSiteEntries.map(({ barangay, pin }) => <li key={`${barangay.id}-${pin.id}`}><button className="kpi-detail-row" type="button" onClick={() => onOpenBarangay(barangay)}><span className="kpi-detail-row-main"><strong>{pin.name}</strong><small>{barangay.name} · {pin.purok || "Purok not assigned"} · {hasMapCoordinates(pin) ? `${Number(pin.latitude).toFixed(5)}, ${Number(pin.longitude).toFixed(5)}` : "Coordinates not recorded"}</small></span><span className="kpi-detail-row-arrow" aria-hidden="true">↗</span></button></li>)}</ul> : <p className="kpi-detail-empty">No collection sites are in this JSON.</p>)}
        {openKpi === "dashboard-changes" && (activityLog.length ? <ol className="kpi-detail-list">{activityLog.map((entry) => <li key={entry.id}><article className="kpi-detail-row kpi-detail-row--static"><span className="kpi-detail-row-main"><strong>{entry.action}</strong><small>{entry.itemName || entry.itemType} · {entry.barangayName}{entry.details ? ` · ${entry.details}` : ""}</small></span><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></article></li>)}</ol> : <p className="kpi-detail-empty">No review changes have been recorded yet.</p>)}
    </DashboardDetailPage>
  );
}
