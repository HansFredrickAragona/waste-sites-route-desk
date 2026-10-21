import { useEffect, useRef, useState } from "react";

export default function DataNotes({ selectedCellNotes = [] }) {
  const dialogRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const count = selectedCellNotes.length;

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

  if (count === 0) return null;

  return (
    <div className="data-notes">
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
                <p className="eyebrow">Selected cell</p>
                <h2 id="data-notes-dialog-title">Issues to resolve</h2>
              </div>
              <span className="notes-count">{count}</span>
            </div>
            <button className="data-notes-close" type="button" aria-label="Close data notes" onClick={closeDialog}>×</button>
          </header>
          <div className="data-notes-dialog-content">
            <ul>{selectedCellNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
          </div>
        </div>
      </dialog>
    </div>
  );
}
