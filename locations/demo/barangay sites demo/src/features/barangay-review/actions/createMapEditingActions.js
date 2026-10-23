import { createId } from "../../json-library/services/reviewRepository.js";
import { parseMapCoordinates } from "../data/mapCoordinates.js";
import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
import { coordinateText, formatStatusUpdatedAt } from "../utils/pinFormHelpers.js";

export function createMapEditingActions(context) {
  const {
    clearDraftUndoHistory,
    commitBarangay,
    deviceLocation,
    lineDraft,
    lineNodeLocationInput,
    linePoints,
    locationRequestRef,
    mode,
    pendingDelete,
    pinDraft,
    rememberLineDraftUndo,
    review,
    selectedBarangay,
    selectedLineId,
    selectedLineNodeIndex,
    selectedPinId,
    setDeviceLocation,
    setIsLocatingCurrentPosition,
    setLineDraft,
    setLineNodeLocationError,
    setLineNodeLocationInput,
    setLineNodeLocationMessage,
    setLinePoints,
    setMapFocus,
    setMode,
    setNotice,
    setPendingDelete,
    setPinDraft,
    setPinEditorOpen,
    setPinManagerCollapsed,
    setSelectedLineId,
    setSelectedLineNodeIndex,
    setSelectedPinId,
    setShowLineNodeStreetView,
  } = context;
  function beginPinPlacement() {
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before adding another feature." });
      return;
    }
    clearDraftUndoHistory();
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setPinDraft(null);
    setPinEditorOpen(false);
    setSelectedPinId(null);
    setSelectedLineId(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setPinManagerCollapsed(false);
    setMode((current) => current === "place-pin" ? "browse" : "place-pin");
  }

  function createPinDraftAt(point, locationCapture = null) {
    if (!selectedBarangay) return;
    const latitude = Number(Number(point[0]).toFixed(6));
    const longitude = Number(Number(point[1]).toFixed(6));
    const mapsUrl = `https://www.google.com/maps?q=${coordinateText(latitude, longitude)}`;
    const id = createId("pin");
    const location = {
      latitude,
      longitude,
      google_maps_url: mapsUrl,
      ...(locationCapture ? {
        source: "device_gps",
        accuracy_m: Number.isFinite(locationCapture.accuracy) ? Math.round(locationCapture.accuracy) : null,
        captured_at: locationCapture.capturedAt,
      } : {}),
    };
    setPinDraft({
      id,
      isNew: true,
      name: `Collection site ${selectedBarangay.pins.length + 1}`,
      sourceNames: [],
      latitude,
      longitude,
      location,
      sourceStatus: "new",
      statusType: "New",
      statusLastUpdated: "",
      schedule: [{ "pick-up": { day: "", time: "" } }, { "drop-off": { day: "", time: "" } }],
      sourceSchedule: [],
      remarks: "",
      sourceRemarks: "",
      sourceRowCount: 0,
      reviewStatus: "needs_review",
      purok: "",
      sourcePuroks: [],
      notes: "",
    });
    setPinEditorOpen(true);
    setSelectedPinId(id);
    setSelectedLineId(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setMode("browse");
    setPinManagerCollapsed(false);
    setMapFocus({ type: "point", point: [latitude, longitude], zoom: 19 });
  }

  function beginPinFromCurrentLocation() {
    if (!selectedBarangay) return;
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before adding another feature." });
      return;
    }
    if (!navigator.geolocation) {
      setNotice({ kind: "error", text: "Current location needs browser location access on HTTPS or localhost." });
      return;
    }

    clearDraftUndoHistory();
    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;
    setIsLocatingCurrentPosition(true);
    setMode("browse");
    setNotice({ kind: "info", text: "Getting your current location…" });
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (locationRequestRef.current !== requestId) return;
          setIsLocatingCurrentPosition(false);
          const capturedAt = new Date().toISOString();
          setDeviceLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          createPinDraftAt([position.coords.latitude, position.coords.longitude], {
            accuracy: position.coords.accuracy,
            capturedAt,
          });
          const accuracyText = Number.isFinite(position.coords.accuracy)
            ? ` GPS accuracy is about ${Math.round(position.coords.accuracy)} m.`
            : "";
          setNotice({ kind: "success", text: `Location captured. Confirm the pin on the map, then enter its details.${accuracyText}` });
        },
        (error) => {
          if (locationRequestRef.current !== requestId) return;
          setIsLocatingCurrentPosition(false);
          const message = error.code === 1
            ? "Location access was denied. Allow location access in your browser and try again."
            : error.code === 3
              ? "Location lookup timed out. Move to an open area and try again."
              : "Your current location is unavailable. Check device location services and try again.";
          setNotice({ kind: "error", text: message });
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    } catch {
      if (locationRequestRef.current !== requestId) return;
      setIsLocatingCurrentPosition(false);
      setNotice({ kind: "error", text: "Your browser could not start location lookup. Check location settings and try again." });
    }
  }

  function recenterOnCurrentLocation() {
    if (!navigator.geolocation) {
      if (deviceLocation) {
        setMapFocus({ type: "point", point: [deviceLocation.latitude, deviceLocation.longitude] });
        setNotice({ kind: "info", text: "Showing your last captured location. Fresh GPS access is unavailable here." });
      } else {
        setNotice({ kind: "error", text: "Current location needs browser location access on HTTPS or localhost." });
      }
      return;
    }

    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;
    setIsLocatingCurrentPosition(true);
    setNotice({ kind: "info", text: "Finding your current location…" });
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (locationRequestRef.current !== requestId) return;
          setIsLocatingCurrentPosition(false);
          const point = [position.coords.latitude, position.coords.longitude];
          setDeviceLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setMapFocus({ type: "point", point });
          const accuracyText = Number.isFinite(position.coords.accuracy)
            ? ` GPS accuracy is about ${Math.round(position.coords.accuracy)} m.`
            : "";
          setNotice({ kind: "success", text: `Map centered on your current location.${accuracyText}` });
        },
        (error) => {
          if (locationRequestRef.current !== requestId) return;
          setIsLocatingCurrentPosition(false);
          if (deviceLocation) {
            setMapFocus({ type: "point", point: [deviceLocation.latitude, deviceLocation.longitude] });
            setNotice({ kind: "info", text: "Could not get a fresh GPS fix. Recentered on your last captured location." });
            return;
          }
          const message = error.code === 1
            ? "Location access was denied. Allow location access in your browser and try again."
            : error.code === 3
              ? "Location lookup timed out. Move to an open area and try again."
              : "Your current location is unavailable. Check device location services and try again.";
          setNotice({ kind: "error", text: message });
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    } catch {
      if (locationRequestRef.current !== requestId) return;
      setIsLocatingCurrentPosition(false);
      if (deviceLocation) {
        setMapFocus({ type: "point", point: [deviceLocation.latitude, deviceLocation.longitude] });
        setNotice({ kind: "info", text: "Fresh GPS lookup failed. Recentered on your last captured location." });
      } else {
        setNotice({ kind: "error", text: "Your browser could not start location lookup. Check location settings and try again." });
      }
    }
  }

  function beginLineDrawing() {
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    if (mode === "draw-line") {
      setLinePoints([]);
      setMode("browse");
      setPinManagerCollapsed(false);
      return;
    }
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before adding another feature." });
      return;
    }
    setPinDraft(null);
    setSelectedPinId(null);
    setSelectedLineId(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setPinManagerCollapsed(true);
    setMode("draw-line");
  }

  function beginEditPin(pin) {
    clearDraftUndoHistory();
    setSelectedPinId(pin.id);
    setSelectedLineId(null);
    setPinDraft({
      ...pin,
      statusType: pin.statusType ?? pin.sourceStatusLabel ?? "",
      statusLastUpdated: pin.statusLastUpdated ?? "",
      schedule: Array.isArray(pin.schedule) ? pin.schedule : pin.sourceSchedule ?? [],
      remarks: pin.remarks ?? pin.sourceRemarks ?? "",
      isNew: false,
    });
    setPinEditorOpen(true);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
    setPinManagerCollapsed(false);
    if (hasMapCoordinates(pin)) {
      setMapFocus({ type: "point", point: [Number(pin.latitude), Number(pin.longitude)], zoom: 19 });
    }
  }

  function handleMapClick(point) {
    if (!selectedBarangay) return;
    if (mode === "browse") {
      if (selectedPinId && !pinDraft && !lineDraft) setSelectedPinId(null);
      return;
    }
    if (mode === "place-pin") {
      createPinDraftAt(point);
      return;
    }
    if (mode === "add-line-node" && lineDraft) {
      const nextPoint = [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))];
      const insertionIndex = Math.min(
        Math.max((selectedLineNodeIndex ?? lineDraft.coordinates.length - 1) + 1, 0),
        lineDraft.coordinates.length,
      );
      rememberLineDraftUndo();
      setLineDraft((current) => current ? ({
        ...current,
        coordinates: [
          ...current.coordinates.slice(0, insertionIndex),
          nextPoint,
          ...current.coordinates.slice(insertionIndex),
        ],
      }) : current);
      setSelectedLineNodeIndex(insertionIndex);
      setShowLineNodeStreetView(false);
      setLineNodeLocationInput("");
      setLineNodeLocationError("");
      setLineNodeLocationMessage("");
      return;
    }
    if (mode === "draw-line") setLinePoints((current) => [...current, point]);
  }

  function finishLineDrawing() {
    if (linePoints.length < 2) return;
    const id = createId("line");
    setLineDraft({ id, isNew: true, name: "New firing line", coordinates: linePoints, notes: "", sample: false });
    setSelectedLineId(id);
    setSelectedPinId(null);
    setSelectedLineNodeIndex(0);
    setLinePoints([]);
    setMode("edit-line");
  }

  function cancelMapMode() {
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    clearDraftUndoHistory();
    setMode("browse");
    setLinePoints([]);
    if (pinDraft?.isNew) setSelectedPinId(null);
    if (lineDraft?.isNew) setSelectedLineId(null);
    setPinDraft(null);
    setPinEditorOpen(false);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLineNodeLocationInput("");
    setLineNodeLocationError("");
    setLineNodeLocationMessage("");
    setPinManagerCollapsed(false);
  }

  function selectPin(pinId) {
    if (pinDraft?.id === pinId) return;
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before selecting another feature." });
      return;
    }
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setSelectedPinId(pinId);
    setSelectedLineId(null);
    setPinDraft(null);
    setLineDraft(null);
    setMode("browse");
    const pin = selectedBarangay?.pins.find((item) => item.id === pinId);
    if (hasMapCoordinates(pin)) {
      setMapFocus({ type: "point", point: [Number(pin.latitude), Number(pin.longitude)], zoom: 19 });
    }
  }

  function selectLine(lineId) {
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before selecting another feature." });
      return;
    }
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setSelectedLineId(lineId);
    setSelectedPinId(null);
    setPinDraft(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
    const line = selectedBarangay?.firingLines.find((item) => item.id === lineId);
    if (line?.coordinates?.length) {
      setMapFocus({ type: "bounds", points: line.coordinates, maxZoom: 18 });
    }
  }

  function savePin(event) {
    event.preventDefault();
    if (!selectedBarangay || !pinDraft) return;
    const name = pinDraft.name.trim();
    const latitudeText = String(pinDraft.latitude ?? "").trim();
    const longitudeText = String(pinDraft.longitude ?? "").trim();
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!name) {
      setNotice({ kind: "error", text: "Enter a collection-site name before saving." });
      return;
    }
    if (!latitudeText || !longitudeText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setNotice({ kind: "error", text: "Enter valid latitude and longitude values." });
      return;
    }
    const savingNew = pinDraft.isNew;
    const statusType = String(pinDraft.statusType ?? pinDraft.sourceStatusLabel ?? "").trim();
    const remarks = String(pinDraft.remarks ?? pinDraft.sourceRemarks ?? "").trim();
    const statusLastUpdated = formatStatusUpdatedAt(new Date());
    const location = {
      ...(pinDraft.location && typeof pinDraft.location === "object" && !Array.isArray(pinDraft.location) ? pinDraft.location : {}),
      latitude,
      longitude,
      google_maps_url: "https://www.google.com/maps?q=" + coordinateText(latitude, longitude),
    };
    const status = {
      ...(pinDraft.status && typeof pinDraft.status === "object" && !Array.isArray(pinDraft.status) ? pinDraft.status : {}),
      type: statusType,
      last_updated: statusLastUpdated,
    };
    const nextPin = {
      ...pinDraft,
      name,
      latitude,
      longitude,
      site_name: name,
      location,
      googleMapsUrl: location.google_maps_url,
      status,
      statusType,
      sourceStatusLabel: statusType,
      sourceStatus: /^removed\b/i.test(statusType) ? "removed" : savingNew && /^new\b/i.test(statusType) ? "new" : "active",
      statusLastUpdated,
      schedule: Array.isArray(pinDraft.schedule) ? pinDraft.schedule : pinDraft.sourceSchedule ?? [],
      remarks,
      purok: pinDraft.purok || "",
      notes: pinDraft.notes.trim(),
      isNew: undefined,
    };
    clearDraftUndoHistory();
    commitBarangay(selectedBarangay.id, (current) => ({
      ...current,
      pins: savingNew ? [nextPin, ...current.pins] : current.pins.map((pin) => pin.id === nextPin.id ? nextPin : pin),
    }), {
      action: savingNew ? "Added collection-site pin" : "Updated collection-site pin",
      itemType: "Collection site",
      itemName: name,
      details: `${nextPin.purok || "No purok assigned"} · ${coordinateText(latitude, longitude)}`,
    });
    setSelectedPinId(nextPin.id);
    setPinDraft(null);
    setPinEditorOpen(false);
    setMode("browse");
  }

  function saveLine(event) {
    event.preventDefault();
    if (!selectedBarangay || !lineDraft) return;
    if (lineDraft.coordinates.length < 2) {
      setNotice({ kind: "error", text: "A firing line needs at least two map nodes." });
      return;
    }
    const savingNew = lineDraft.isNew;
    const name = lineDraft.name.trim();
    if (!name) {
      setNotice({ kind: "error", text: "Enter a name for this firing line." });
      return;
    }
    const nextLine = { ...lineDraft, name, notes: lineDraft.notes.trim(), isNew: undefined };
    const originalLine = selectedBarangay.firingLines.find((line) => line.id === nextLine.id);
    const placementsChanged = originalLine && JSON.stringify(originalLine.coordinates) !== JSON.stringify(nextLine.coordinates);
    const detailsChanged = originalLine && (originalLine.name !== nextLine.name || originalLine.notes !== nextLine.notes);
    clearDraftUndoHistory();
    commitBarangay(selectedBarangay.id, (current) => ({
      ...current,
      firingLines: savingNew ? [nextLine, ...current.firingLines] : current.firingLines.map((line) => line.id === nextLine.id ? nextLine : line),
    }), {
      action: savingNew ? "Added firing line" : "Updated firing line",
      itemType: "Firing line",
      itemName: name,
      details: `${nextLine.coordinates.length} map nodes${placementsChanged ? " · node placements updated" : ""}${detailsChanged ? " · line details updated" : ""}${nextLine.sample ? " · demo example" : ""}`,
    });
    setSelectedLineId(nextLine.id);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
    setPinManagerCollapsed(false);
  }

  function beginEditLine(line) {
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before opening another line." });
      return;
    }
    clearDraftUndoHistory();
    setSelectedLineId(line.id);
    setSelectedPinId(null);
    setPinDraft(null);
    setLineDraft({ ...line, coordinates: line.coordinates.map((point) => [...point]), isNew: false });
    setSelectedLineNodeIndex(0);
    setShowLineNodeStreetView(false);
    setLineNodeLocationInput("");
    setLineNodeLocationError("");
    setLineNodeLocationMessage("");
    setMode("edit-line");
    setPinManagerCollapsed(true);
    if (line.coordinates.length) {
      setMapFocus({ type: "bounds", points: line.coordinates, maxZoom: 18 });
    }
  }

  function selectLineNode(pointIndex) {
    setSelectedLineNodeIndex(pointIndex);
    setShowLineNodeStreetView(false);
    setLineNodeLocationInput("");
    setLineNodeLocationError("");
    setLineNodeLocationMessage("");
  }

  function updateLineNodePosition(pointIndex, latitude, longitude) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;
    const currentPoint = lineDraft?.coordinates[pointIndex];
    const nextPoint = [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))];
    if (!currentPoint || (currentPoint[0] === nextPoint[0] && currentPoint[1] === nextPoint[1])) return;
    rememberLineDraftUndo();
    setLineDraft((current) => current ? ({
      ...current,
      coordinates: current.coordinates.map((point, index) => index === pointIndex
        ? nextPoint
        : point),
    }) : current);
  }

  function handleLineNodeStreetViewPosition(position) {
    if (!Number.isInteger(selectedLineNodeIndex)) return;
    updateLineNodePosition(selectedLineNodeIndex, Number(position.latitude), Number(position.longitude));
    setLineNodeLocationMessage(`Node moved to ${coordinateText(position.latitude, position.longitude)}. Save the firing line to record this change.`);
    setLineNodeLocationError("");
  }

  function applyLineNodeLocation() {
    const coordinates = parseMapCoordinates(lineNodeLocationInput);
    if (!coordinates || !Number.isInteger(selectedLineNodeIndex)) {
      setLineNodeLocationError("Paste a Google Maps link that contains coordinates, or enter latitude, longitude.");
      setLineNodeLocationMessage("");
      return;
    }
    updateLineNodePosition(selectedLineNodeIndex, coordinates.latitude, coordinates.longitude);
    setShowLineNodeStreetView(false);
    setLineNodeLocationError("");
    setLineNodeLocationMessage(`Node moved to ${coordinateText(coordinates.latitude, coordinates.longitude)}. Save the firing line to record this change.`);
  }

  function beginLineNodePlacement() {
    if (!lineDraft || lineDraft.coordinates.length < 2) return;
    if (!Number.isInteger(selectedLineNodeIndex)) setSelectedLineNodeIndex(lineDraft.coordinates.length - 1);
    setShowLineNodeStreetView(false);
    setPinManagerCollapsed(true);
    setMode("add-line-node");
  }

  function finishLineNodePlacement() {
    setMode("edit-line");
  }

  function disconnectFiringLine(pointIndex) {
    if (!selectedBarangay || !lineDraft || !Number.isInteger(pointIndex)) return;
    if (pointIndex < 1 || pointIndex >= lineDraft.coordinates.length - 2) {
      setNotice({ kind: "error", text: "Disconnecting here would leave fewer than two nodes on one side." });
      return;
    }
    const baseName = lineDraft.name.trim() || "Firing line";
    const existingNames = new Set(selectedBarangay.firingLines.map((line) => line.name.trim().toLocaleLowerCase("en-US")));
    existingNames.add(baseName.toLocaleLowerCase("en-US"));
    let partNumber = 2;
    let nextName = `${baseName} (part ${partNumber})`;
    while (existingNames.has(nextName.toLocaleLowerCase("en-US"))) {
      partNumber += 1;
      nextName = `${baseName} (part ${partNumber})`;
    }
    const splitAt = pointIndex + 1;
    const firstPart = { ...lineDraft, name: baseName, coordinates: lineDraft.coordinates.slice(0, splitAt), isNew: undefined };
    const secondPart = {
      ...lineDraft,
      id: createId("line"),
      name: nextName,
      coordinates: lineDraft.coordinates.slice(splitAt),
      isNew: undefined,
    };
    const wasNew = Boolean(lineDraft.isNew);
    clearDraftUndoHistory();
    commitBarangay(selectedBarangay.id, (current) => ({
      ...current,
      firingLines: wasNew
        ? [firstPart, secondPart, ...current.firingLines]
        : current.firingLines.flatMap((line) => line.id === lineDraft.id ? [firstPart, secondPart] : [line]),
    }), {
      action: "Disconnected firing-line segment",
      itemType: "Firing line",
      itemName: baseName,
      details: `Disconnected node ${pointIndex + 1} from node ${pointIndex + 2}; created ${baseName} and ${nextName}`,
    });
    setSelectedLineId(firstPart.id);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
    setPinManagerCollapsed(false);
    setNotice({ kind: "success", text: `Disconnected the segment. The line is now “${baseName}” and “${nextName}”.` });
  }

  function deleteSelectedLineNode(pointIndex = selectedLineNodeIndex) {
    if (!lineDraft || !Number.isInteger(pointIndex)) return;
    if (lineDraft.coordinates.length <= 2) {
      setNotice({ kind: "error", text: "A firing line needs at least two nodes. Remove the whole line to clear it." });
      return;
    }
    rememberLineDraftUndo();
    const nextCoordinates = lineDraft.coordinates.filter((_, index) => index !== pointIndex);
    const nextIndex = Math.min(pointIndex, nextCoordinates.length - 1);
    setLineDraft((current) => current ? ({ ...current, coordinates: nextCoordinates }) : current);
    setSelectedLineNodeIndex(nextIndex);
    setShowLineNodeStreetView(false);
    setLineNodeLocationInput("");
    setLineNodeLocationError("");
    setLineNodeLocationMessage("Node removed from the draft. Save the firing line to record this change.");
  }

  function requestDelete(kind, item) {
    setPendingDelete({ kind, id: item.id, name: item.name });
  }

  function confirmDelete() {
    if (!pendingDelete || !selectedBarangay) return;
    const { kind, id, name } = pendingDelete;
    const isPin = kind === "pin";
    if (!isPin && lineDraft?.id === id) clearDraftUndoHistory();
    commitBarangay(selectedBarangay.id, (current) => isPin
      ? { ...current, pins: current.pins.filter((pin) => pin.id !== id) }
      : { ...current, firingLines: current.firingLines.filter((line) => line.id !== id) }, {
      action: `Deleted ${isPin ? "collection-site pin" : "firing line"}`,
      itemType: isPin ? "Collection site" : "Firing line",
      itemName: name,
      details: "Deleted during barangay review",
    });
    if (isPin && selectedPinId === id) setSelectedPinId(null);
    if (!isPin && selectedLineId === id) {
      setSelectedLineId(null);
      setSelectedLineNodeIndex(null);
      setShowLineNodeStreetView(false);
    }
    if (!isPin && lineDraft?.id === id) {
      setLineDraft(null);
      setSelectedLineNodeIndex(null);
      setShowLineNodeStreetView(false);
      setPinManagerCollapsed(false);
    }
    setPendingDelete(null);
  }

  return {
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
  };
}
