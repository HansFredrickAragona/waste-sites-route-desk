import { useEffect, useRef, useState } from "react";

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function ActivityLog({ entries = [], scheduleName = "", scopeLabel = "", onRevert }) {
  const dialogRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [isOpen]);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setIsOpen(false);
  }

  function closeWhenBackdropIsClicked(event) {
    const dialog = event.currentTarget;
    const bounds = dialog.getBoundingClientRect();
    const clickIsOutsideCard = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (event.target === dialog || clickIsOutsideCard) closeDialog();
  }

  const latestRevertibleEntryId = entries.find((entry) => entry.undo && !entry.revertedAt)?.id;

  return (
    <div className="activity-log">
      <button className="activity-log-trigger" type="button" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        <span className="activity-log-icon" aria-hidden="true">↶</span>
        Activity log <span className="activity-log-count">{entries.length}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="data-notes-dialog activity-log-dialog"
        aria-labelledby="activity-log-title"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={closeWhenBackdropIsClicked}
      >
        <div className="data-notes-dialog-inner">
          <header className="data-notes-dialog-header">
            <div className="data-notes-dialog-title-lockup">
              <span className="activity-log-icon activity-log-icon--large" aria-hidden="true">↶</span>
              <div>
                <p className="eyebrow">Change history</p>
                <h2 id="activity-log-title">Activity log</h2>
              </div>
              <span className="activity-log-count">{entries.length}</span>
            </div>
            <button className="data-notes-close" type="button" aria-label="Close activity log" onClick={closeDialog}>×</button>
          </header>
          <div className="activity-log-content">
            <p className="activity-log-schedule">
              Schedule: {scheduleName || "Current schedule"}{scopeLabel ? ` · ${scopeLabel}` : ""}
            </p>
            {entries.length === 0 ? (
              <p className="activity-log-empty">
                No changes have been recorded for {scopeLabel ? "this schedule cell" : scheduleName || "this schedule"} yet.
              </p>
            ) : (
              <ol className="activity-log-list">
                {entries.map((entry) => (
                  <li className="activity-log-entry" key={entry.id}>
                    <div className="activity-log-entry-heading">
                      <strong>{entry.action}</strong>
                      <time dateTime={entry.timestamp}>{formatDateTime(entry.timestamp)}</time>
                    </div>
                    {entry.revertedAt && <p className="activity-log-reverted">Reverted {formatDateTime(entry.revertedAt)}</p>}
                    <p className="activity-log-item-name">{entry.itemName || entry.itemType || "Schedule change"}</p>
                    <dl className="activity-log-details">
                      <div><dt>Type</dt><dd>{entry.itemType || "Schedule change"}</dd></div>
                      <div><dt>Location</dt><dd>{entry.location || "Location unavailable"}</dd></div>
                      <div><dt>Driver</dt><dd>{entry.driverName || "—"}</dd></div>
                      <div><dt>Day</dt><dd>{entry.day || "—"}</dd></div>
                    </dl>
                    {onRevert && entry.id === latestRevertibleEntryId && (
                      <button className="activity-log-revert" type="button" onClick={() => onRevert(entry)}>
                        Undo this change
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
