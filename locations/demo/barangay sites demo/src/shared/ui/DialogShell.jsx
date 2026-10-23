import { useEffect, useRef } from "react";

export function DialogShell({ open, onClose, titleId, className = "", children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeFromBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`review-dialog ${className}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={closeFromBackdrop}
    >
      {children}
    </dialog>
  );
}
