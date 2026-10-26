import { BUNDLED_JSON_ID } from "../features/json-library/services/reviewRepository.js";
import { ActivityLogButton, ReviewTabs } from "./AppChrome.jsx";

export default function AppHeader({ data, ui, actions, refs }) {
  const { activeJson, activeJsonId, availableJsonCount, bundledJsonHidden, jsonLibrary, activityLog } = data;
  const { page, selectedBarangay, undoCount } = ui;
  const { changeActiveJson, handleAddJson, deleteJson, openExportConfirmation, undoLastAction, resetWorkspaceSession, openActivityLog, returnToBarangayList, showMap, showDashboard } = actions;
  const { fileInputRef } = refs;

  return (
    <>
      <header className="sticky-header">
        <div className="app-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 18s5.5-5.1 5.5-9.3a5.5 5.5 0 1 0-11 0C4.5 12.9 10 18 10 18Z" /><circle cx="10" cy="8.5" r="1.8" /></svg></div>
            <div><p className="brand-kicker">Baguio City · Collection-site review</p><p className="brand-name">Barangay sites</p></div>
          </div>
          <div className="global-actions">
            <div className="json-library-control">
              <select id="active-json" value={activeJsonId} onChange={(event) => changeActiveJson(event.target.value)} aria-label="Select active dataset" disabled={availableJsonCount === 0}>
                {availableJsonCount === 0 && <option value="">No JSON available</option>}
                {!bundledJsonHidden && <option value={BUNDLED_JSON_ID}>barangay_sites_v2.json · bundled</option>}
                {jsonLibrary.map((item) => {
                  const sameName = jsonLibrary.filter((candidate) => candidate.name === item.name);
                  const duplicate = sameName.length > 1 ? ` · ${sameName.findIndex((candidate) => candidate.id === item.id) + 1}` : "";
                  return <option value={item.id} key={item.id}>{item.name} · {item.kind}{duplicate}</option>;
                })}
              </select>
            </div>
            <input ref={fileInputRef} className="hidden-file-input" type="file" multiple accept="application/json,.json" onChange={handleAddJson} aria-label="Add one or more barangay site or review JSON files" />
            <button className="secondary-action json-add-action" type="button" title="Add one or more raw site-record JSON files or review exports" onClick={() => fileInputRef.current?.click()}>Add JSON</button>
            <button className="json-delete-action" type="button" disabled={!activeJson} title={activeJson ? "Remove this JSON and its review copy from this browser. The source file on disk remains." : "Select a JSON file to delete it."} onClick={deleteJson}>Delete JSON</button>
            <button className="export-schedule-button" type="button" onClick={openExportConfirmation} disabled={!activeJson}>Export JSON <span aria-hidden="true">↓</span></button>
            <button className="secondary-action undo-action" type="button" disabled={undoCount === 0} aria-keyshortcuts="Control+Z Meta+Z" title="Undo the last pin move or saved review change (Ctrl+Z)" onClick={undoLastAction}>↶ Undo</button>
            <ActivityLogButton count={activityLog.length} onClick={openActivityLog} />
            <button className="secondary-action reset-session-action" type="button" title="Clear the current place and unfinished edits, while keeping saved review changes" onClick={resetWorkspaceSession}>Reset session</button>
          </div>
        </div>
        <ReviewTabs className="desktop-app-tabs" page={page} selectedBarangay={selectedBarangay} onReturnToBarangayList={returnToBarangayList} onShowMap={showMap} onShowDashboard={showDashboard} />
      </header>
      <ReviewTabs className="mobile-app-tabs" page={page} selectedBarangay={selectedBarangay} onReturnToBarangayList={returnToBarangayList} onShowMap={showMap} onShowDashboard={showDashboard} />
    </>
  );
}
