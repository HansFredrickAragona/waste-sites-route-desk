import { useEffect, useRef, useState } from "react";

export default function ScheduleVersionControl({
  activeVersion,
  availableBuiltInVersions,
  hasHiddenBuiltInVersions,
  uploadedSchedules,
  activeFileName,
  canDeleteActiveSchedule,
  uploadMessage,
  uploadError,
  onVersionChange,
  onUpload,
  onDeleteSchedule,
  onRestoreBuiltInSchedules,
}) {
  const fileInputRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteConfirmOpen && !dialog.open) dialog.showModal();
    if (!deleteConfirmOpen && dialog.open) dialog.close();
  }, [deleteConfirmOpen]);

  async function handleFileChange(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length > 0) await onUpload(files);
  }

  return (
    <div className="version-control">
      <label htmlFor="schedule-version">Schedule file</label>
      <select
        id="schedule-version"
        value={activeVersion}
        onChange={(event) => onVersionChange(event.target.value)}
      >
        {!activeVersion && <option value="" disabled>No schedules available</option>}
        {availableBuiltInVersions.includes("v3") && <option value="v3">driver_schedule_v3.json</option>}
        {availableBuiltInVersions.includes("v4") && <option value="v4">driver_schedule_v4.json</option>}
        {availableBuiltInVersions.includes("v5") && <option value="v5">driver_schedule_v5.json</option>}
        {availableBuiltInVersions.includes("v6") && <option value="v6">driver_schedule_v6.json</option>}
        {uploadedSchedules.map((schedule, index) => {
          const fileName = schedule.name || "Uploaded JSON";
          const sameName = uploadedSchedules.filter((item) => item.name === schedule.name);
          const duplicateNumber = sameName.findIndex((item) => item.id === schedule.id) + 1;
          const duplicateSuffix = sameName.length > 1 ? ` ${duplicateNumber}` : "";
          return (
            <option value={schedule.id} key={`${schedule.id}-${index}`}>
              {fileName} · uploaded{duplicateSuffix}
            </option>
          );
        })}
      </select>
      <button
        className="version-upload-button"
        type="button"
        title="Select one or more JSON files; each is added as its own version."
        onClick={() => fileInputRef.current?.click()}
      >
        Add JSON
      </button>
      <button
        className="version-delete-button"
        type="button"
        disabled={!canDeleteActiveSchedule}
        title={canDeleteActiveSchedule ? "Remove the selected JSON from this browser's schedule list. Its source file will remain on disk." : "Select a JSON file to remove it."}
        aria-label={canDeleteActiveSchedule ? `Remove ${activeFileName || "selected JSON"}` : "Remove selected JSON"}
        onClick={() => setDeleteConfirmOpen(true)}
      >
        Delete JSON
      </button>
      {hasHiddenBuiltInVersions && (
        <button
          className="version-upload-button"
          type="button"
          title="Restore bundled schedule files hidden from this browser's selector."
          onClick={onRestoreBuiltInSchedules}
        >
          Restore bundled
        </button>
      )}
      <input
        ref={fileInputRef}
        className="version-file-input"
        type="file"
        multiple
        accept=".json,application/json"
        aria-label="Add one or more schedule JSON files"
        onChange={handleFileChange}
      />
      {activeFileName && <span className="version-file-name" title={activeFileName}>{activeFileName}</span>}
      {uploadMessage && <span className="version-upload-message" role="status">{uploadMessage}</span>}
      {uploadError && <span className="version-upload-error" role="alert">{uploadError}</span>}
      <dialog
        ref={deleteDialogRef}
        className="delete-confirm-dialog"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
        onCancel={(event) => {
          event.preventDefault();
          setDeleteConfirmOpen(false);
        }}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <div className="delete-confirm-content">
          <p className="delete-confirm-kicker">Delete schedule</p>
          <h2 id="delete-confirm-title">Are you sure you want to delete this data?</h2>
          <p className="delete-confirm-file">{activeFileName || "Selected JSON"}</p>
          <p id="delete-confirm-description">
            This removes the schedule from this browser's list. The source JSON file on disk will remain.
          </p>
          <div className="delete-confirm-actions">
            <button
              type="button"
              className="delete-confirm-cancel"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="delete-confirm-submit"
              onClick={() => {
                onDeleteSchedule();
                setDeleteConfirmOpen(false);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
