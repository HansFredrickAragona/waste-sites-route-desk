import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
import {
  BUNDLED_JSON_ID,
  NO_JSON_REVIEW_ID,
  buildInitialReview,
  createId,
  loadActiveJsonId,
  loadBundledJsonHidden,
  loadJsonLibrary,
  loadSavedReview,
  persistActiveJsonId,
  persistBundledJsonHidden,
  persistJsonLibrary,
  persistReview,
  siteRecordCount,
} from "../../json-library/services/reviewRepository.js";
import { createJsonLibraryActions } from "../../json-library/actions/createJsonLibraryActions.js";
import { createBarangayDetailsActions } from "../actions/createBarangayDetailsActions.js";
import { createMapEditingActions } from "../actions/createMapEditingActions.js";
import { summarizeReviewChanges } from "../utils/reviewChanges.js";
import {
  coordinateText,
  scheduleFieldValue,
  sourceScheduleRows,
  updateScheduleField,
} from "../utils/pinFormHelpers.js";

const EMPTY_ACTIVITY = [];

function emptyReviewData(activityLog = []) {
  return { schemaVersion: 1, source: null, jsonSource: null, barangays: [], activityLog };
}

export function useBarangayReviewController(sourceUrl) {
  const [review, setReview] = useState(null);
  const [bundledReview, setBundledReview] = useState(null);
  const [jsonLibrary, setJsonLibrary] = useState(loadJsonLibrary);
  const [activeJsonId, setActiveJsonId] = useState(loadActiveJsonId);
  const [bundledJsonHidden, setBundledJsonHidden] = useState(loadBundledJsonHidden);
  const [page, setPage] = useState("barangays");
  const [selectedBarangayId, setSelectedBarangayId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [notice, setNotice] = useState(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showBarangayDetails, setShowBarangayDetails] = useState(false);
  const [barangayDetailsDraft, setBarangayDetailsDraft] = useState({ name: "", puroks: "", notes: "" });
  const [showConfirmationContact, setShowConfirmationContact] = useState(false);
  const [confirmationContactDraft, setConfirmationContactDraft] = useState({ name: "", position: "", phone: "", email: "" });
  const [showExportConfirmation, setShowExportConfirmation] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const [mode, setMode] = useState("browse");
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [pinManagerCollapsed, setPinManagerCollapsed] = useState(false);
  const [pinDraft, setPinDraft] = useState(null);
  const [pinEditorOpen, setPinEditorOpen] = useState(false);
  const [isLocatingCurrentPosition, setIsLocatingCurrentPosition] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [lineDraft, setLineDraft] = useState(null);
  const [selectedLineNodeIndex, setSelectedLineNodeIndex] = useState(null);
  const [showLineNodeStreetView, setShowLineNodeStreetView] = useState(false);
  const [lineNodeLocationInput, setLineNodeLocationInput] = useState("");
  const [lineNodeLocationError, setLineNodeLocationError] = useState("");
  const [lineNodeLocationMessage, setLineNodeLocationMessage] = useState("");
  const [isResolvingLineNodeLocation, setIsResolvingLineNodeLocation] = useState(false);
  const [linePoints, setLinePoints] = useState([]);
  const [pinSearch, setPinSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showJsonDeleteConfirmation, setShowJsonDeleteConfirmation] = useState(false);
  const fileInputRef = useRef(null);
  const reviewRef = useRef(null);
  const reviewUndoRef = useRef([]);
  const pinMoveUndoRef = useRef([]);
  const lineDraftUndoRef = useRef([]);
  const pinDragStartRef = useRef(null);
  const locationRequestRef = useRef(0);
  const [undoCount, setUndoCount] = useState(0);

  useEffect(() => {
    reviewRef.current = review;
  }, [review]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const response = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Barangay sites JSON returned HTTP ${response.status}.`);
        const siteRecords = await response.json();
        if (cancelled) return;
        const baseline = buildInitialReview(siteRecords);
        let savedBundledReview = bundledJsonHidden ? null : loadSavedReview(BUNDLED_JSON_ID) ?? baseline;
        let availableJsonLibrary = jsonLibrary;
        let initialJsonId = activeJsonId;
        if (!bundledJsonHidden && initialJsonId === BUNDLED_JSON_ID && jsonLibrary.length === 0 &&
          /^Imported /.test(savedBundledReview.jsonSource?.kind ?? "")) {
          const importedId = createId("json");
          const importedSource = savedBundledReview.jsonSource;
          const migratedReview = { ...savedBundledReview, jsonSource: importedSource };
          availableJsonLibrary = [{ id: importedId, name: importedSource.name, kind: importedSource.kind }];
          persistReview(migratedReview, importedId);
          persistJsonLibrary(availableJsonLibrary);
          persistReview(baseline, BUNDLED_JSON_ID);
          savedBundledReview = baseline;
          initialJsonId = importedId;
          setJsonLibrary(availableJsonLibrary);
        }
        const availableJsonIds = [
          ...(!bundledJsonHidden ? [BUNDLED_JSON_ID] : []),
          ...availableJsonLibrary.map((item) => item.id),
        ];
        if (!availableJsonIds.includes(initialJsonId)) initialJsonId = availableJsonIds[0] ?? "";
        let initialReview = initialJsonId === BUNDLED_JSON_ID
          ? savedBundledReview ?? baseline
          : initialJsonId
            ? loadSavedReview(initialJsonId)
            : loadSavedReview(NO_JSON_REVIEW_ID) ?? emptyReviewData();
        if (!initialReview && initialJsonId) {
          initialJsonId = availableJsonIds.find((id) => id !== initialJsonId && id === BUNDLED_JSON_ID) ??
            availableJsonIds.find((id) => id !== initialJsonId) ?? "";
          initialReview = initialJsonId === BUNDLED_JSON_ID
            ? savedBundledReview ?? baseline
            : initialJsonId
              ? loadSavedReview(initialJsonId)
              : loadSavedReview(NO_JSON_REVIEW_ID) ?? emptyReviewData();
        }
        if (!initialReview) {
          initialJsonId = "";
          initialReview = loadSavedReview(NO_JSON_REVIEW_ID) ?? emptyReviewData();
        }
        setBundledReview(savedBundledReview);
        setActiveJsonId(initialJsonId);
        setReview(initialReview ?? baseline);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not read the barangay sites JSON data.");
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!review) return;
    const reviewSaved = persistReview(review, activeJsonId || NO_JSON_REVIEW_ID);
    const librarySaved = persistJsonLibrary(jsonLibrary);
    const activeJsonSaved = persistActiveJsonId(activeJsonId);
    const bundledVisibilitySaved = persistBundledJsonHidden(bundledJsonHidden);
    setStorageWarning(!(reviewSaved && librarySaved && activeJsonSaved && bundledVisibilitySaved));
  }, [review, activeJsonId, jsonLibrary, bundledJsonHidden]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const undoLastAction = useCallback(() => {
    const lastPinMove = pinMoveUndoRef.current.at(-1);
    if (pinDraft && lastPinMove?.pinId === pinDraft.id) {
      pinMoveUndoRef.current.pop();
      setPinDraft((current) => current?.id === lastPinMove.pinId ? ({
        ...current,
        latitude: lastPinMove.latitude,
        longitude: lastPinMove.longitude,
      }) : current);
      setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
      setNotice({ kind: "success", text: "Pin move undone. The draft location has been restored." });
      return;
    }

    const lastLineDraftChange = lineDraftUndoRef.current.at(-1);
    if (lineDraft && lastLineDraftChange?.lineId === lineDraft.id) {
      lineDraftUndoRef.current.pop();
      setLineDraft(lastLineDraftChange.draft);
      setSelectedLineNodeIndex(lastLineDraftChange.selectedLineNodeIndex);
      setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
      setNotice({ kind: "success", text: "Undid the last firing-line draft change." });
      return;
    }

    const current = reviewRef.current;
    const lastChange = reviewUndoRef.current.at(-1);
    if (!current || !lastChange) return;
    reviewUndoRef.current.pop();
    const timestamp = new Date().toISOString();
    const entry = {
      id: createId("activity"),
      timestamp,
      action: `Undid: ${lastChange.action}`,
      itemType: "Undo",
      itemName: lastChange.itemName,
      barangayId: lastChange.barangayId,
      barangayName: lastChange.barangayName,
      details: "Restored the review data from before the last saved change",
    };
    const restored = {
      ...lastChange.review,
      updatedAt: timestamp,
      activityLog: [entry, ...(current.activityLog ?? [])].slice(0, 500),
    };
    reviewRef.current = restored;
    setReview(restored);
    setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
    setNotice({ kind: "success", text: `Undid: ${lastChange.action}.` });
  }, [lineDraft, pinDraft]);

  useEffect(() => {
    function handleUndoShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLocaleLowerCase() !== "z") return;
      const target = event.target;
      const pendingPinMove = pinDraft && pinMoveUndoRef.current.at(-1)?.pinId === pinDraft.id;
      const pendingLineChange = lineDraft && lineDraftUndoRef.current.at(-1)?.lineId === lineDraft.id;
      if (!pendingPinMove && !pendingLineChange && target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (undoCount === 0) return;
      event.preventDefault();
      undoLastAction();
    }
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [pinDraft, undoCount, undoLastAction]);

  useEffect(() => {
    function handleDeleteSelectedNode(event) {
      if (event.key !== "Backspace" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!lineDraft || !Number.isInteger(selectedLineNodeIndex) || !["edit-line", "add-line-node"].includes(mode)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable || target.matches("input, textarea, select") || target.closest(".line-node-context-menu")
      )) return;
      event.preventDefault();
      deleteSelectedLineNode();
    }
    window.addEventListener("keydown", handleDeleteSelectedNode);
    return () => window.removeEventListener("keydown", handleDeleteSelectedNode);
  }, [lineDraft, mode, selectedLineNodeIndex]);

  const barangays = review?.barangays ?? [];
  const selectedBarangay = barangays.find((barangay) => barangay.id === selectedBarangayId) ?? null;
  const selectedPin = selectedBarangay?.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const selectedPinForMap = pinDraft?.id === selectedPinId ? pinDraft : selectedPin;
  const mapPinPoints = (selectedBarangay?.pins ?? [])
    .map((pin) => pinDraft?.id === pin.id ? pinDraft : pin)
    .filter(hasMapCoordinates)
    .map((pin) => [Number(pin.latitude), Number(pin.longitude)]);
  if (pinDraft?.isNew && hasMapCoordinates(pinDraft)) mapPinPoints.push([Number(pinDraft.latitude), Number(pinDraft.longitude)]);
  const selectedPinHasMapCoordinates = Boolean(selectedPinId && hasMapCoordinates(selectedPinForMap));
  const selectedLine = selectedBarangay?.firingLines.find((line) => line.id === selectedLineId) ?? null;
  const selectedLineNode = lineDraft && Number.isInteger(selectedLineNodeIndex)
    ? lineDraft.coordinates[selectedLineNodeIndex] ?? null
    : null;
  const activityLog = review?.activityLog ?? EMPTY_ACTIVITY;
  const exportChangeSummary = summarizeReviewChanges(activityLog);
  const exportChangeCount = exportChangeSummary.added.length + exportChangeSummary.removed.length + exportChangeSummary.edited.length;
  const activeJson = activeJsonId === BUNDLED_JSON_ID && !bundledJsonHidden
    ? { id: BUNDLED_JSON_ID, name: "barangay_sites_v2.json", kind: "Bundled source" }
    : jsonLibrary.find((item) => item.id === activeJsonId) ?? null;
  const availableJsonCount = jsonLibrary.length + (bundledJsonHidden ? 0 : 1);
  const canDeleteActiveJson = Boolean(activeJson);
  const siteCount = useMemo(() => siteRecordCount(barangays), [barangays]);
  const confirmedCount = barangays.filter((barangay) => barangay.confirmed).length;
  const unconfirmedCount = barangays.length - confirmedCount;
  const needsPurokCount = barangays.filter((barangay) => barangay.puroks.length === 0).length;

  const commitBarangay = useCallback((barangayId, transform, logEntry) => {
    const current = reviewRef.current;
    if (!current) return;
    const target = current.barangays.find((item) => item.id === barangayId);
    if (!target) return;
    const timestamp = new Date().toISOString();
    const entry = logEntry ? {
      id: createId("activity"),
      timestamp,
      barangayId,
      barangayName: target.name,
      ...logEntry,
    } : null;
    const next = {
      ...current,
      updatedAt: timestamp,
      barangays: current.barangays.map((item) => item.id === barangayId ? transform(item) : item),
      activityLog: entry ? [entry, ...(current.activityLog ?? [])].slice(0, 500) : current.activityLog ?? [],
    };
    reviewUndoRef.current.push({
      review: current,
      action: logEntry?.action ?? "review change",
      itemName: logEntry?.itemName ?? target.name,
      barangayId,
      barangayName: target.name,
    });
    if (reviewUndoRef.current.length > 100) reviewUndoRef.current.shift();
    reviewRef.current = next;
    setReview(next);
    setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
  }, []);

  function clearDraftUndoHistory() {
    pinMoveUndoRef.current = [];
    lineDraftUndoRef.current = [];
    pinDragStartRef.current = null;
    setUndoCount(reviewUndoRef.current.length);
  }

  function rememberLineDraftUndo() {
    if (!lineDraft) return;
    lineDraftUndoRef.current.push({
      lineId: lineDraft.id,
      draft: lineDraft,
      selectedLineNodeIndex,
    });
    if (lineDraftUndoRef.current.length > 100) lineDraftUndoRef.current.shift();
    setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
  }

  function clearUndoHistory() {
    reviewUndoRef.current = [];
    pinMoveUndoRef.current = [];
    lineDraftUndoRef.current = [];
    pinDragStartRef.current = null;
    setUndoCount(0);
  }

  function openBarangay(barangay) {
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setMapFocus(null);
    clearDraftUndoHistory();
    setSelectedBarangayId(barangay.id);
    setPage("map");
    setSelectedPinId(null);
    setSelectedLineId(null);
    setPinDraft(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setMode("browse");
    setPinManagerCollapsed(false);
    setPinSearch("");
  }

  function returnToBarangayList() {
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setMapFocus(null);
    clearDraftUndoHistory();
    setPage("barangays");
    setMode("browse");
    setPinDraft(null);
    setLineDraft(null);
    setLinePoints([]);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setPinManagerCollapsed(false);
  }

  function resetReviewView() {
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setMapFocus(null);
    clearDraftUndoHistory();
    setPage("barangays");
    setSelectedBarangayId(null);
    setSelectedPinId(null);
    setSelectedLineId(null);
    setPinDraft(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setMode("browse");
    setPinManagerCollapsed(false);
    setPinSearch("");
    setShowActivity(false);
    setShowBarangayDetails(false);
    setPendingDelete(null);
  }

  const actionContext = {
    review,
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
    barangays,
    selectedBarangay,
    barangayDetailsDraft,
    setBarangayDetailsDraft,
    confirmationContactDraft,
    setConfirmationContactDraft,
    setShowBarangayDetails,
    setShowConfirmationContact,
    commitBarangay,
    clearDraftUndoHistory,
    rememberLineDraftUndo,
    deviceLocation,
    lineDraft,
    lineNodeLocationInput,
    linePoints,
    locationRequestRef,
    mode,
    pendingDelete,
    pinDraft,
    selectedLineId,
    selectedLineNodeIndex,
    selectedPinId,
    setDeviceLocation,
    setIsLocatingCurrentPosition,
    setLineDraft,
    setLineNodeLocationError,
    setLineNodeLocationInput,
    setIsResolvingLineNodeLocation,
    setLineNodeLocationMessage,
    setLinePoints,
    setMapFocus,
    setMode,
    setPendingDelete,
    setPinDraft,
    setPinEditorOpen,
    setPinManagerCollapsed,
    setSelectedLineId,
    setSelectedLineNodeIndex,
    setSelectedPinId,
    setShowLineNodeStreetView,
  };
  const barangayDetailsActions = createBarangayDetailsActions(actionContext);
  const { openDetailsEditor, saveBarangayDetails, openConfirmationContactEditor, saveConfirmationContact, setConfirmed } = barangayDetailsActions;
  const mapEditingActions = createMapEditingActions(actionContext);
  const {
    beginPinPlacement,
    createPinDraftAt,
    beginPinFromCurrentLocation,
    recenterOnCurrentLocation,
    beginLineDrawing,
    beginEditPin,
    handleMapClick,
    finishLineDrawing,
    cancelMapMode,
    selectPin,
    selectLine,
    savePin,
    saveLine,
    beginEditLine,
    selectLineNode,
    updateLineNodePosition,
    handleLineNodeStreetViewPosition,
    applyLineNodeLocation,
    beginLineNodePlacement,
    finishLineNodePlacement,
    disconnectFiringLine,
    deleteSelectedLineNode,
    requestDelete,
    confirmDelete,
  } = mapEditingActions;
  const jsonLibraryActions = createJsonLibraryActions(actionContext);
  const { handleAddJson, changeActiveJson, deleteActiveJson, openExportConfirmation, exportReview } = jsonLibraryActions;
  const filteredBarangays = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
    return barangays.filter((barangay) => {
      const matchesSearch = !normalizedSearch || barangay.name.toLocaleLowerCase("en-US").includes(normalizedSearch);
      const matchesFilter = listFilter === "all" ||
        (listFilter === "unconfirmed" && !barangay.confirmed) ||
        (listFilter === "confirmed" && barangay.confirmed) ||
        (listFilter === "no-sites" && barangay.pins.length === 0);
      return matchesSearch && matchesFilter;
    });
  }, [barangays, search, listFilter]);

  const visiblePins = selectedBarangay?.pins.filter((pin) => {
    const query = pinSearch.trim().toLocaleLowerCase("en-US");
    return !query || [pin.name, pin.purok, ...pin.sourceNames].join(" ").toLocaleLowerCase("en-US").includes(query);
  }) ?? [];
  const mappedSiteCount = selectedBarangay?.pins.filter(hasMapCoordinates).length ?? 0;
  const unlocatedSiteCount = (selectedBarangay?.pins.length ?? 0) - mappedSiteCount;
  const removedSiteCount = selectedBarangay?.pins.filter((pin) => pin.sourceStatus === "removed").length ?? 0;

  return {
    review,
    setReview,
    bundledReview,
    setBundledReview,
    jsonLibrary,
    setJsonLibrary,
    activeJsonId,
    setActiveJsonId,
    bundledJsonHidden,
    setBundledJsonHidden,
    page,
    setPage,
    selectedBarangayId,
    setSelectedBarangayId,
    loadError,
    setLoadError,
    search,
    setSearch,
    listFilter,
    setListFilter,
    notice,
    setNotice,
    storageWarning,
    setStorageWarning,
    showActivity,
    setShowActivity,
    showBarangayDetails,
    setShowBarangayDetails,
    barangayDetailsDraft,
    setBarangayDetailsDraft,
    showConfirmationContact,
    setShowConfirmationContact,
    confirmationContactDraft,
    setConfirmationContactDraft,
    showExportConfirmation,
    setShowExportConfirmation,
    exportFilename,
    setExportFilename,
    mode,
    setMode,
    selectedPinId,
    setSelectedPinId,
    selectedLineId,
    setSelectedLineId,
    pinManagerCollapsed,
    setPinManagerCollapsed,
    pinDraft,
    setPinDraft,
    pinEditorOpen,
    setPinEditorOpen,
    isLocatingCurrentPosition,
    setIsLocatingCurrentPosition,
    mapFocus,
    setMapFocus,
    deviceLocation,
    setDeviceLocation,
    lineDraft,
    setLineDraft,
    selectedLineNodeIndex,
    setSelectedLineNodeIndex,
    showLineNodeStreetView,
    setShowLineNodeStreetView,
    lineNodeLocationInput,
    setLineNodeLocationInput,
    lineNodeLocationError,
    setLineNodeLocationError,
    isResolvingLineNodeLocation,
    setIsResolvingLineNodeLocation,
    lineNodeLocationMessage,
    setLineNodeLocationMessage,
    linePoints,
    setLinePoints,
    pinSearch,
    setPinSearch,
    pendingDelete,
    setPendingDelete,
    showJsonDeleteConfirmation,
    setShowJsonDeleteConfirmation,
    undoCount,
    setUndoCount,
    fileInputRef,
    reviewRef,
    reviewUndoRef,
    pinMoveUndoRef,
    lineDraftUndoRef,
    pinDragStartRef,
    locationRequestRef,
    undoLastAction,
    barangays,
    selectedBarangay,
    selectedPin,
    selectedPinForMap,
    mapPinPoints,
    selectedPinHasMapCoordinates,
    selectedLine,
    selectedLineNode,
    activityLog,
    exportChangeSummary,
    exportChangeCount,
    activeJson,
    availableJsonCount,
    canDeleteActiveJson,
    siteCount,
    confirmedCount,
    unconfirmedCount,
    needsPurokCount,
    commitBarangay,
    filteredBarangays,
    clearDraftUndoHistory,
    rememberLineDraftUndo,
    clearUndoHistory,
    openBarangay,
    returnToBarangayList,
    resetReviewView,
    openDetailsEditor,
    saveBarangayDetails,
    openConfirmationContactEditor,
    saveConfirmationContact,
    setConfirmed,
    beginPinPlacement,
    createPinDraftAt,
    beginPinFromCurrentLocation,
    recenterOnCurrentLocation,
    beginLineDrawing,
    beginEditPin,
    handleMapClick,
    finishLineDrawing,
    cancelMapMode,
    selectPin,
    selectLine,
    savePin,
    saveLine,
    beginEditLine,
    selectLineNode,
    updateLineNodePosition,
    handleLineNodeStreetViewPosition,
    applyLineNodeLocation,
    beginLineNodePlacement,
    finishLineNodePlacement,
    disconnectFiringLine,
    deleteSelectedLineNode,
    requestDelete,
    confirmDelete,
    handleAddJson,
    changeActiveJson,
    deleteActiveJson,
    openExportConfirmation,
    exportReview,
    visiblePins,
    mappedSiteCount,
    unlocatedSiteCount,
    removedSiteCount,
    coordinateText,
    sourceScheduleRows,
    scheduleFieldValue,
    updateScheduleField,
  };
}
