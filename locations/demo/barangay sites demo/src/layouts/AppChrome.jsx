export function ActivityLogButton({ count, onClick }) {
  return (
    <button className="activity-log-trigger" type="button" aria-haspopup="dialog" onClick={onClick}>
      <span className="activity-log-icon" aria-hidden="true">↶</span>
      Activity log <span className="activity-log-count">{count}</span>
    </button>
  );
}
export function ReviewTabs({ className, page, selectedBarangay, onReturnToBarangayList, onCloseSelectedBarangay, onShowOverview, onShowMap, onShowDashboard, dashboardTabs, onShowDashboardTab, onCloseDashboardTab }) {
  const inDetail = dashboardTabs.some((tab) => tab.id === page);
  const inDashboard = page === "dashboard" || inDetail;
  const inBarangays = !inDashboard;
  return <div className={`review-navigation ${className}`}>
    <nav className="app-tabs" role="tablist" aria-label="Main views">
      <button className={`app-tab${inBarangays ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={inBarangays} onClick={inBarangays ? undefined : onReturnToBarangayList}>Barangays</button>
      <button className={`app-tab${inDashboard ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={inDashboard} onClick={onShowDashboard}>Dashboard</button>
    </nav>
    {inDashboard && <div className="barangay-subnavigation">
      <nav className="barangay-subtabs" role="tablist" aria-label="Dashboard views">
        <button className={`barangay-subtab${!inDetail ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={!inDetail} onClick={onShowDashboard}>Overview</button>
        {dashboardTabs.map(({ id, label }) => (
          <div key={id} className="dashboard-detail-tab" role="presentation">
            <button className={`barangay-subtab${page === id ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={page === id} onClick={() => onShowDashboardTab(id)}>{label}</button>
            <button className="barangay-shortcut-close" type="button" aria-label={`Close ${label}`} title={`Close ${label}`} onClick={() => onCloseDashboardTab(id)}>×</button>
          </div>
        ))}
      </nav>
    </div>}
    {inBarangays && <div className="barangay-subnavigation">
      <nav className="barangay-subtabs" role="tablist" aria-label="Barangay views">
        <button className={`barangay-subtab${page !== "overview" ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={page !== "overview"} onClick={onReturnToBarangayList}>Sites</button>
        <button className={`barangay-subtab${page === "overview" ? " barangay-subtab--active" : ""}`} type="button" role="tab" aria-selected={page === "overview"} onClick={onShowOverview}>Map</button>
      </nav>
      {selectedBarangay && <div className={`barangay-selected-shortcut${page === "map" ? " barangay-selected-shortcut--active" : ""}`}>
        <button className="barangay-resume-link" type="button" aria-current={page === "map" ? "page" : undefined} title={selectedBarangay.name} onClick={onShowMap}>
          <span className="barangay-resume-name">{selectedBarangay.name}</span>
        </button>
        <button className="barangay-shortcut-close" type="button" aria-label={`Close ${selectedBarangay.name}`} title="Close selected barangay" onClick={onCloseSelectedBarangay}>×</button>
      </div>}
    </div>}
  </div>;
}
