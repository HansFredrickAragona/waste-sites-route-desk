import {
  BUNDLED_JSON_ID,
  NO_JSON_REVIEW_ID,
  buildInitialReview,
  createId,
  loadSavedReview,
  normalizeReviewData,
  persistBundledJsonHidden,
  persistJsonLibrary,
  persistReview,
  removeSavedReview,
  removeWorkspaceSession,
  siteRecordCount,
} from "../services/reviewRepository.js";

export function createJsonLibraryActions(context) {
  const {
    review,
    reviewRef,
    setReview,
    bundledReview,
    setBundledReview,
    jsonLibrary,
    setJsonLibrary,
    activeJsonId,
    setActiveJsonId,
    bundledJsonHidden,
    setBundledJsonHidden,
    canDeleteActiveJson,
    activeJson,
    exportFilename,
    setExportFilename,
    setShowExportConfirmation,
    setShowJsonDeleteConfirmation,
    setNotice,
    setStorageWarning,
    clearUndoHistory,
    resetReviewView,
    emptyReviewData,
  } = context;

  async function handleAddJson(event) {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) return;

    const added = [];
    const rejected = [];
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text());
        const isSourceJson = Array.isArray(parsed);
        const kind = isSourceJson ? "Imported site data" : "Imported review export";
        const imported = isSourceJson
          ? buildInitialReview(parsed, { name: file.name, kind })
          : { ...normalizeReviewData(parsed), jsonSource: { name: file.name, kind } };
        if (imported.barangays.length === 0) {
          throw new Error("This JSON file does not contain any barangay site records.");
        }
        const timestamp = new Date().toISOString();
        const id = createId("json");
        const entry = {
          id: createId("activity"),
          timestamp,
          action: "Added JSON to review library",
          itemType: "JSON library",
          itemName: file.name,
          barangayId: "all",
          barangayName: "JSON library",
          details: `${siteRecordCount(imported.barangays)} site records across ${imported.barangays.length} barangays`,
        };
        const reviewData = {
          ...imported,
          importedAt: timestamp,
          jsonSource: { name: file.name, kind },
          activityLog: [entry, ...(imported.activityLog ?? [])].slice(0, 500),
        };
        added.push({ id, name: file.name, kind, review: reviewData });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "could not read this JSON file";
        rejected.push(`${file.name}: ${reason}`);
      }
    }

    if (added.length === 0) {
      setNotice({ kind: "error", text: rejected.join(" · ") || "No valid JSON files were added." });
      return;
    }

    const libraryEntries = added.map(({ id, name, kind }) => ({ id, name, kind }));
    const nextLibrary = [...jsonLibrary, ...libraryEntries];
    const savedReviews = added.map((item) => persistReview(item.review, item.id)).every(Boolean);
    const savedLibrary = persistJsonLibrary(nextLibrary);
    setStorageWarning(!(savedReviews && savedLibrary));
    clearUndoHistory();
    setJsonLibrary(nextLibrary);
    setActiveJsonId(added[0].id);
    setReview(added[0].review);
    resetReviewView();

    const addedNames = added.map((item) => item.name).join(", ");
    const storageSuffix = savedReviews && savedLibrary ? " Saved in this browser." : " Available for this session; browser storage could not save all files.";
    const rejectedSuffix = rejected.length > 0 ? ` Skipped ${rejected.length}: ${rejected.join(" · ")}` : "";
    setNotice({ kind: rejected.length > 0 ? "error" : "success", text: `Added ${addedNames}.${storageSuffix}${rejectedSuffix}` });
  }

  function changeActiveJson(jsonId) {
    if (!jsonId || jsonId === activeJsonId) return;
    const nextReview = loadSavedReview(jsonId) ?? (jsonId === BUNDLED_JSON_ID ? bundledReview : null);
    if (!nextReview) {
      setNotice({ kind: "error", text: "That JSON could not be loaded from this browser. Add the file again to restore it." });
      return;
    }
    if (review) persistReview(review, activeJsonId);
    clearUndoHistory();
    setActiveJsonId(jsonId);
    setReview(nextReview);
    resetReviewView();
    const nextJsonName = jsonId === BUNDLED_JSON_ID ? "barangay_sites_v2.json" : jsonLibrary.find((item) => item.id === jsonId)?.name;
    setNotice({ kind: "success", text: `${nextJsonName || "JSON file"} is now in use.` });
  }

  function deleteActiveJson() {
    if (!canDeleteActiveJson) return;
    const deleted = activeJson;
    const nextLibrary = jsonLibrary.filter((item) => item.id !== activeJsonId);
    const nextBundledHidden = activeJsonId === BUNDLED_JSON_ID ? true : bundledJsonHidden;
    const remainingJsonIds = [
      ...(!nextBundledHidden ? [BUNDLED_JSON_ID] : []),
      ...nextLibrary.map((item) => item.id),
    ];
    const nextJsonId = remainingJsonIds[0] ?? "";
    let nextReview = nextJsonId === BUNDLED_JSON_ID
      ? loadSavedReview(BUNDLED_JSON_ID) ?? bundledReview
      : nextJsonId
        ? loadSavedReview(nextJsonId)
        : loadSavedReview(NO_JSON_REVIEW_ID) ?? emptyReviewData();
    if (!nextReview && nextJsonId) {
      setNotice({ kind: "error", text: "The next JSON could not be loaded. The review list was left unchanged." });
      setShowJsonDeleteConfirmation(false);
      return;
    }
    const timestamp = new Date().toISOString();
    const deleteEntry = {
      id: createId("activity"),
      timestamp,
      action: "Deleted JSON from review library",
      itemType: "JSON library",
      itemName: deleted.name,
      barangayId: "all",
      barangayName: "JSON library",
      details: "Removed from this browser; the source file on disk is unchanged",
    };
    nextReview = {
      ...nextReview,
      activityLog: [deleteEntry, ...(nextReview.activityLog ?? [])].slice(0, 500),
    };
    clearUndoHistory();
    const librarySaved = persistJsonLibrary(nextLibrary);
    const removedReview = removeSavedReview(activeJsonId);
    const removedWorkspace = removeWorkspaceSession(activeJsonId);
    const bundledVisibilitySaved = persistBundledJsonHidden(nextBundledHidden);
    setJsonLibrary(nextLibrary);
    setActiveJsonId(nextJsonId);
    setBundledJsonHidden(nextBundledHidden);
    setBundledReview(nextJsonId === BUNDLED_JSON_ID ? nextReview : nextBundledHidden ? null : bundledReview);
    setReview(nextReview);
    setStorageWarning(!(librarySaved && removedReview && removedWorkspace && bundledVisibilitySaved));
    setShowJsonDeleteConfirmation(false);
    resetReviewView();
    setNotice({
      kind: "success",
      text: remainingJsonIds.length === 0
        ? `${deleted.name} was removed. No JSON files are available; add one to start a review.`
        : `${deleted.name} was removed from this browser's JSON list. Its source file on disk remains.`,
    });
  }

  function openExportConfirmation() {
    if (!review || !activeJson) return;
    const baseName = (activeJson.name || "barangay_sites_v2.json")
      .replace(/\.json$/i, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "barangay-sites";
    setExportFilename(`${baseName}-review-${new Date().toISOString().slice(0, 10)}.json`);
    setShowExportConfirmation(true);
  }

  function exportReview() {
    const latestReview = reviewRef?.current ?? review;
    if (!latestReview) return;
    const safeBaseName = exportFilename.trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .replace(/(?:\.json)+$/i, "")
      .trim();
    if (!safeBaseName) {
      setNotice({ kind: "error", text: "Enter a file name before exporting." });
      return;
    }
    const downloadName = `${safeBaseName}.json`;
    const exported = { ...latestReview, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportConfirmation(false);
    setNotice({ kind: "success", text: `${downloadName} exported as JSON.` });
  }

  return { handleAddJson, changeActiveJson, deleteActiveJson, openExportConfirmation, exportReview };
}
