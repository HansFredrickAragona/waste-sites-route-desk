export function ActivityLogButton({ count, onClick }) {
  return (
    <button className="activity-log-trigger" type="button" aria-haspopup="dialog" onClick={onClick}>
      <span className="activity-log-icon" aria-hidden="true">↶</span>
      Activity log <span className="activity-log-count">{count}</span>
    </button>
  );
}
export function ReviewTabs({ className, page, selectedBarangay, onReturnToBarangayList, onShowOverview, onShowMap, onShowDashboard }) {
  return (
    <nav className={`app-tabs ${className}`} role="tablist" aria-label="Barangay review views">
      <button className={`app-tab${page === "barangays" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "barangays"} onClick={onReturnToBarangayList}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" /><circle cx="2.5" cy="5" r=".5" /><circle cx="2.5" cy="10" r=".5" /><circle cx="2.5" cy="15" r=".5" /></svg>Sites
      </button>
      <button className={`app-tab${page === "overview" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "overview"} onClick={onShowOverview}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17s5-4.7 5-8.5a5 5 0 1 0-10 0C5 12.3 10 17 10 17Z" /><circle cx="10" cy="8.5" r="1.5" /></svg>Barangays
      </button>
      {selectedBarangay && <button className={`app-tab${page === "map" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "map"} onClick={onShowMap}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17s5.5-5.1 5.5-9.3a5.5 5.5 0 1 0-11 0C4.5 11.9 10 17 10 17Z" /><circle cx="10" cy="7.5" r="1.7" /></svg>{selectedBarangay.name}
      </button>}
      <button className={`app-tab${page === "dashboard" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "dashboard"} onClick={onShowDashboard}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>Dashboard
      </button>
    </nav>
  );
}
