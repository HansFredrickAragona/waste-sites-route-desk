import { useState } from "react";
import { DialogShell } from "../../../shared/ui/DialogShell.jsx";
import { createLineDraft, createPinDraft } from "../../barangay-review/actions/createMapEditingActions.js";
import FiringLineEditor from "../../barangay-review/components/FiringLineEditor.jsx";
import PinEditor from "../../barangay-review/components/PinEditor.jsx";

export function ConfirmedReportEditor({ barangay, target, onClose, commitPinDraft, commitLineDraft }) {
  const isPin = target.kind === "pin";
  const [draft, setDraft] = useState(() => isPin ? createPinDraft(target.item) : createLineDraft(target.item));
  const [pinLocationInput, setPinLocationInput] = useState("");
  const [error, setError] = useState("");

  function save(event) {
    event.preventDefault();
    const commit = isPin ? commitPinDraft : commitLineDraft;
    if (commit(barangay, draft, ({ text }) => setError(text))) onClose();
  }

  return (
    <DialogShell open onClose={onClose} titleId={isPin ? "pin-editor-title" : "line-editor-title"} className="confirmed-report-editor">
      <div onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") event.stopPropagation();
      }}>
        {isPin ? (
          <PinEditor selectedBarangay={barangay} pinDraft={draft} setPinDraft={setDraft}
            pinLocationInput={pinLocationInput} setPinLocationInput={setPinLocationInput}
            savePin={save} cancelMapMode={onClose} error={error} />
        ) : (
          <FiringLineEditor selectedBarangay={barangay} lineDraft={draft} setLineDraft={setDraft}
            saveLine={save} cancelMapMode={onClose} error={error} />
        )}
      </div>
    </DialogShell>
  );
}
