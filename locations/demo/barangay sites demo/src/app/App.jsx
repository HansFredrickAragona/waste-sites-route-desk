import barangaySitesUrl from "../../../../data/jsons/barangays/barangay_sites_v2.json?url";
import AppHeader from "../layouts/AppHeader.jsx";
import { Dashboard } from "../features/dashboard/components/Dashboard.jsx";
import BarangaysDirectory from "../features/barangays/components/BarangaysDirectory.jsx";
import BarangayReviewPage from "../features/barangay-review/components/BarangayReviewPage.jsx";
import ReviewDialogs from "../features/barangay-review/components/ReviewDialogs.jsx";
import { useBarangayReviewController } from "../features/barangay-review/hooks/useBarangayReviewController.js";

function App() {
  const controller = useBarangayReviewController(barangaySitesUrl);
  const {
    review,
    loadError,
    storageWarning,
    workspaceStorageWarning,
    notice,
    setNotice,
    activeJson,
    activeJsonId,
    availableJsonCount,
    bundledJsonHidden,
    jsonLibrary,
    activityLog,
    undoCount,
    page,
    selectedBarangay,
    barangays,
    siteCount,
    confirmedCount,
    unconfirmedCount,
    needsPurokCount,
    filteredBarangays,
    search,
    setSearch,
    listFilter,
    setListFilter,
    fileInputRef,
    changeActiveJson,
    handleAddJson,
    setShowJsonDeleteConfirmation,
    openExportConfirmation,
    undoLastAction,
    showActivity,
    setShowActivity,
    setShowExportConfirmation,
    returnToBarangayList,
    setPage,
    openBarangay,
    selectedPin,
    selectedLine,
    selectedLineNode,
    selectedPinHasMapCoordinates,
    selectedPinForMap,
    mapPinPoints,
    visiblePins,
    mappedSiteCount,
    unlocatedSiteCount,
    removedSiteCount,
    mode,
    linePoints,
    selectedLineNodeIndex,
    mapFocus,
    mapView,
    setMapView,
    deviceLocation,
    selectedPinId,
    selectedLineId,
    pinDraft,
    pinLocationInput,
    setPinLocationInput,
    lineDraft,
    pinManagerCollapsed,
    pinEditorOpen,
    isLocatingCurrentPosition,
    showLineNodeStreetView,
    lineNodeLocationInput,
    lineNodeLocationError,
    lineNodeLocationMessage,
    pinSearch,
    openDetailsEditor,
    setConfirmed,
    openConfirmationContactEditor,
    finishLineNodePlacement,
    cancelMapMode,
    finishLineDrawing,
    handleMapClick,
    selectPin,
    selectLine,
    selectLineNode,
    setUndoCount,
    recenterOnCurrentLocation,
    setMapFocus,
    setPinManagerCollapsed,
    beginPinFromCurrentLocation,
    beginPinPlacement,
    setPinEditorOpen,
    savePin,
    setPinDraft,
    resetWorkspaceSession,
    setPinSearch,
    beginEditPin,
    requestDelete,
    beginLineDrawing,
    saveLine,
    deleteSelectedLineNode,
    beginLineNodePlacement,
    setShowLineNodeStreetView,
    setLineNodeLocationInput,
    setLineNodeLocationError,
    setLineNodeLocationMessage,
    applyLineNodeLocation,
    handleLineNodeStreetViewPosition,
    beginEditLine,
    updateLineNodePosition,
    disconnectFiringLine,
    pinDragStartRef,
    pinMoveUndoRef,
    reviewUndoRef,
    lineDraftUndoRef,
    coordinateText,
    addScheduleDay,
    removeScheduleDay,
    scheduleDayEntries,
    sourceScheduleRows,
    updateScheduleEntry,
    showExportConfirmation,
    exportFilename,
    exportChangeSummary,
    exportChangeCount,
    showBarangayDetails,
    barangayDetailsDraft,
    showConfirmationContact,
    confirmationContactDraft,
    showJsonDeleteConfirmation,
    pendingDelete,
    exportReview,
    saveBarangayDetails,
    setShowBarangayDetails,
    saveConfirmationContact,
    setConfirmationContactDraft,
    setShowConfirmationContact,
    deleteActiveJson,
    setPendingDelete,
    confirmDelete,
  } = controller;

  if (loadError) {
    return (
      <main className="app-shell load-error-shell">
        <section className="data-load-state data-load-state--error"><span className="data-load-symbol">!</span><div><h2>Barangay data could not be loaded</h2><p>{loadError}</p><p>Start the demo with <code>npm run dev</code> from its folder so the barangay sites JSON can load.</p></div></section>
      </main>
    );
  }

  if (!review) {
    return <main className="app-shell"><section className="data-load-state"><span className="data-load-symbol">…</span><div><h2>Preparing barangay review</h2><p>Loading collection-site records from barangay_sites_v2.json.</p></div></section></main>;
  }

  const data = {
    selectedBarangay,
    activeJson,
    mappedSiteCount,
    unlocatedSiteCount,
    removedSiteCount,
    selectedPin,
    selectedLine,
    selectedLineNode,
    selectedPinHasMapCoordinates,
    selectedPinForMap,
    mapPinPoints,
    visiblePins,
  };
  const ui = {
    page,
    mode,
    linePoints,
    selectedLineNodeIndex,
    mapFocus,
    mapView,
    deviceLocation,
    selectedPinId,
    selectedLineId,
    pinDraft,
    pinLocationInput,
    lineDraft,
    pinManagerCollapsed,
    pinEditorOpen,
    isLocatingCurrentPosition,
    showLineNodeStreetView,
    lineNodeLocationInput,
    lineNodeLocationError,
    lineNodeLocationMessage,
    pinSearch,
  };
  const actions = {
    openDetailsEditor,
    setConfirmed,
    openConfirmationContactEditor,
    finishLineNodePlacement,
    cancelMapMode,
    finishLineDrawing,
    handleMapClick,
    selectPin,
    selectLine,
    selectLineNode,
    setUndoCount,
    recenterOnCurrentLocation,
    setMapFocus,
    setMapView,
    setPinManagerCollapsed,
    beginPinFromCurrentLocation,
    beginPinPlacement,
    setPinEditorOpen,
    savePin,
    setPinDraft,
    setPinLocationInput,
    setPinSearch,
    beginEditPin,
    requestDelete,
    beginLineDrawing,
    saveLine,
    deleteSelectedLineNode,
    beginLineNodePlacement,
    setShowLineNodeStreetView,
    setLineNodeLocationInput,
    setLineNodeLocationError,
    setLineNodeLocationMessage,
    applyLineNodeLocation,
    handleLineNodeStreetViewPosition,
    beginEditLine,
    updateLineNodePosition,
    disconnectFiringLine,
  };
  const refs = { pinDragStartRef, pinMoveUndoRef, reviewUndoRef, lineDraftUndoRef };
  const helpers = { coordinateText, addScheduleDay, removeScheduleDay, scheduleDayEntries, sourceScheduleRows, updateScheduleEntry };

  return (
    <main className="app-shell">
      <AppHeader
        data={{ activeJson, activeJsonId, availableJsonCount, bundledJsonHidden, jsonLibrary, activityLog }}
        ui={{ page, selectedBarangay, undoCount }}
        actions={{
          changeActiveJson,
          handleAddJson,
          deleteJson: () => setShowJsonDeleteConfirmation(true),
          openExportConfirmation,
          undoLastAction,
          resetWorkspaceSession,
          openActivityLog: () => setShowActivity(true),
          returnToBarangayList,
          showMap: () => { setMapFocus(null); setPage("map"); },
          showDashboard: () => setPage("dashboard"),
        }}
        refs={{ fileInputRef }}
      />

      {(storageWarning || workspaceStorageWarning) && <div className="storage-warning" role="status">Browser storage could not save all progress. Export saved review changes; unfinished edits may not recover. Check that this browser allows site storage.</div>}
      {notice && <div className={`toast toast--${notice.kind}`} role="status"><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}

      <BarangaysDirectory
        page={page}
        barangays={barangays}
        siteCount={siteCount}
        activeJson={activeJson}
        confirmedCount={confirmedCount}
        unconfirmedCount={unconfirmedCount}
        needsPurokCount={needsPurokCount}
        filteredBarangays={filteredBarangays}
        search={search}
        setSearch={setSearch}
        listFilter={listFilter}
        setListFilter={setListFilter}
        openBarangay={openBarangay}
      />

      <BarangayReviewPage data={data} ui={ui} actions={actions} refs={refs} helpers={helpers} />

      {page === "dashboard" && (
        <Dashboard
          barangays={barangays}
          siteCount={siteCount}
          confirmedCount={confirmedCount}
          activityLog={activityLog}
          activeJsonName={activeJson?.name ?? "No JSON loaded"}
          onOpenBarangay={openBarangay}
        />
      )}

      <ReviewDialogs
        state={{ showActivity, showExportConfirmation, exportFilename, exportChangeSummary, exportChangeCount, showBarangayDetails, barangayDetailsDraft, showConfirmationContact, confirmationContactDraft, showJsonDeleteConfirmation, pendingDelete }}
        data={{ activeJson, activityLog, selectedBarangay }}
        actions={{ setShowActivity, setShowExportConfirmation, setExportFilename: controller.setExportFilename, exportReview, saveBarangayDetails, setShowBarangayDetails, saveConfirmationContact, setConfirmationContactDraft, setShowConfirmationContact, deleteActiveJson, setShowJsonDeleteConfirmation, setPendingDelete, confirmDelete }}
      />

      <footer className="app-footer"><span>Baguio City · Barangay collection-site review</span><span>Changes stay in this browser until you export the JSON.</span></footer>
    </main>
  );
}

export default App;
