import { useEffect, useRef, useState } from "react";

function V3Reports() {
  return (
    <li>
      v3 comparison files: {" "}
      <a href={`${import.meta.env.BASE_URL}data/v3_barangay_comparison_summary.md`} target="_blank" rel="noreferrer">summary</a>
      <span aria-hidden="true"> · </span>
      <a href={`${import.meta.env.BASE_URL}data/v3_barangay_comparison.csv`} download>label comparison CSV</a>
      <span aria-hidden="true"> · </span>
      <a href={`${import.meta.env.BASE_URL}data/swmd_barangay_coverage.csv`} download>barangay coverage CSV</a>
    </li>
  );
}

export default function DataNotes({
  issues = [],
  contextNotes = [],
  selectedCellNotes = [],
  showV3Reports = false,
  mode = "compact",
}) {
  const dialogRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const hasSelectedCellNotes = selectedCellNotes.length > 0;
  const notes = [...contextNotes, ...issues];
  const count = notes.length + selectedCellNotes.length + (showV3Reports ? 1 : 0);

  useEffect(() => {
    if (mode !== "panel" && isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [isOpen, mode]);

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

  if (mode === "panel") {
    return (
      <section className="data-notes-panel" aria-labelledby="data-notes-panel-title">
        <div className="data-notes-panel-heading">
          <span className="notes-icon" aria-hidden="true">!</span>
          <div>
            <p className="eyebrow">Data notes</p>
            <h2 id="data-notes-panel-title">Review notes</h2>
          </div>
          <span className="notes-count">{count}</span>
        </div>
        {count > 0 ? (
          <ul>
            {notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}
            {showV3Reports && <V3Reports />}
          </ul>
        ) : <p className="data-notes-empty">No data notes are available for this schedule.</p>}
      </section>
    );
  }

  if (count === 0) return null;

  return (
    <div className={`data-notes${hasSelectedCellNotes ? " data-notes--cell" : ""}`}>
      <button className="data-notes-trigger" type="button" aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        <span className="notes-icon" aria-hidden="true">!</span>
        Data notes <span className="notes-count">{count}</span>
      </button>
      <dialog
        ref={dialogRef}
        className="data-notes-dialog"
        aria-labelledby="data-notes-dialog-title"
        onClose={() => setIsOpen(false)}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={closeWhenBackdropIsClicked}
      >
        <div className="data-notes-dialog-inner">
          <header className="data-notes-dialog-header">
            <div className="data-notes-dialog-title-lockup">
              <span className="notes-icon" aria-hidden="true">!</span>
              <div>
                <p className="eyebrow">Data notes</p>
                <h2 id="data-notes-dialog-title">Review details</h2>
              </div>
              <span className="notes-count">{count}</span>
            </div>
            <button className="data-notes-close" type="button" aria-label="Close data notes" onClick={closeDialog}>×</button>
          </header>
          <div className="data-notes-dialog-content">
            {hasSelectedCellNotes && (
              <section>
                <h3>Selected cell</h3>
                <ul>{selectedCellNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
              </section>
            )}
            {notes.length > 0 && (
              <section>
                <h3>Schedule data</h3>
                <ul>{notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
              </section>
            )}
            {showV3Reports && <section><h3>Comparison files</h3><ul><V3Reports /></ul></section>}
          </div>
        </div>
      </dialog>
    </div>
  );
}
