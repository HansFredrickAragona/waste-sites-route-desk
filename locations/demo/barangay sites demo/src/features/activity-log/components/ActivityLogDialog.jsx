import { DialogShell } from "../../../shared/ui/DialogShell.jsx";
import { formatTime } from "../../../shared/utils/reviewFormatting.js";

export function ActivityLogDialog({ open, entries, onClose }) {
  return (
    <DialogShell open={open} onClose={onClose} titleId="activity-title" className="activity-dialog">
      <header className="dialog-header">
        <div className="dialog-heading-lockup"><span className="activity-mark" aria-hidden="true">↶</span><div><p className="eyebrow">Review history</p><h2 id="activity-title">Activity log</h2></div><span className="activity-total">{entries.length}</span></div>
        <button className="icon-close" type="button" aria-label="Close activity log" onClick={onClose}>×</button>
      </header>
      <div className="activity-content">
        {entries.length === 0
          ? <div className="empty-activity"><span>↶</span><h3>No changes yet</h3><p>Barangay, pin, and firing-line edits will appear here during the review.</p></div>
          : <ol className="activity-list">{entries.map((entry) => <li className="activity-entry" key={entry.id}><div className="activity-entry-heading"><strong>{entry.action}</strong><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></div><p className="activity-entry-name">{entry.itemName || entry.itemType}</p><p className="activity-entry-meta">{entry.barangayName}{entry.details ? ` · ${entry.details}` : ""}</p></li>)}</ol>}
      </div>
    </DialogShell>
  );
}
