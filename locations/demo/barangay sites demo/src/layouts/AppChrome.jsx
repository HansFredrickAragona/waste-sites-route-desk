export function ActivityLogButton({ count, onClick }) {
  return (
    <button className="activity-log-trigger" type="button" aria-haspopup="dialog" onClick={onClick}>
      <span className="activity-log-icon" aria-hidden="true">↶</span>
      Activity log <span className="activity-log-count">{count}</span>
    </button>
  );
}
export function ReviewTabs({ className, page, selectedBarangay, onReturnToBarangayList, onCloseSelectedBarangay, onShowOverview, onShowMap, onShowDashboard }) {
  const inBarangays = page !== "dashboard";
  return <div className={`review-navigation ${className}`}>
    <nav className="app-tabs" role="tablist" aria-label="Main views">
      <button className={`app-tab${inBarangays ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={inBarangays} onClick={inBarangays ? undefined : onReturnToBarangayList}>Barangays</button>
      <button className={`app-tab${!inBarangays ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={!inBarangays} onClick={onShowDashboard}>Dashboard</button>
    </nav>
    {inBarangays && <div className="barangay-subnavigation">
      <nav className="barangay-subtabs" role="tablist" aria-label="Barangay views">
        <button className={`barangay-subtab${page !== "overview" ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={page !== "overview"} onClick={onReturnToBarangayList}>Sites</button>
        <button className={`barangay-subtab${page === "overview" ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={page === "overview"} onClick={onShowOverview}>Map</button>
      </nav>
      {selectedBarangay && <div className="barangay-selected-shortcut"><button className="barangay-resume-link" type="button" onClick={page === "map" ? onReturnToBarangayList : onShowMap}>{page === "map" ? "All barangays" : `Resume ${selectedBarangay.name}`}</button><button className="barangay-shortcut-close" type="button" aria-label={`Close ${selectedBarangay.name}`} title="Close selected barangay" onClick={onCloseSelectedBarangay}>×</button></div>}
    </div>}
  </div>;
}
