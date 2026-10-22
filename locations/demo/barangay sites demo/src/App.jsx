import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import barangaySitesUrl from "../../../data/jsons/barangays/barangay_sites.json?url";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import GoogleStreetViewEditor from "./components/GoogleStreetViewEditor.jsx";
import PinLocationAssistant from "./components/PinLocationAssistant.jsx";
import { parseMapCoordinates } from "./data/mapCoordinates.js";
import {
  BUNDLED_JSON_ID,
  NO_JSON_REVIEW_ID,
  buildInitialReview,
  createId,
  loadActiveJsonId,
  loadBundledJsonHidden,
  loadJsonLibrary,
  loadSavedReview,
  normalizeReviewData,
  persistActiveJsonId,
  persistBundledJsonHidden,
  persistJsonLibrary,
  persistReview,
  removeSavedReview,
  siteRecordCount,
} from "./data/reviewData.js";

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BAGUIO_CENTER = [16.4100, 120.5930];
const EMPTY_ACTIVITY = [];

function emptyReviewData(activityLog = []) {
  return { schemaVersion: 1, source: null, jsonSource: null, barangays: [], activityLog };
}

function pinIcon(index, active, removed = false) {
  return L.divIcon({
    className: "barangay-pin-shell",
    html: `<span class="barangay-pin${active ? " barangay-pin--active" : ""}${removed ? " barangay-pin--removed" : ""}"><span>${index + 1}</span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
  });
}

function vertexIcon(active = false) {
  return L.divIcon({
    className: "route-vertex-shell",
    html: `<span class='route-vertex${active ? " route-vertex--active" : ""}'></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function coordinateText(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}

function hasMapCoordinates(pin) {
  if (pin?.latitude === null || pin?.latitude === undefined || String(pin.latitude).trim() === "" ||
    pin?.longitude === null || pin?.longitude === undefined || String(pin.longitude).trim() === "") return false;
  const latitude = Number(pin.latitude);
  const longitude = Number(pin.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function sourceScheduleRows(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.flatMap((entry) => Object.entries(entry ?? {}).map(([kind, timing]) => ({
    label: kind.replace(/-/g, " "),
    value: [timing?.date, timing?.day, timing?.time].filter(Boolean).join(" · ") || "Not provided",
  })));
}

function scheduleFieldValue(schedule, kind, field) {
  if (!Array.isArray(schedule)) return "";
  const entry = schedule.find((item) => item && Object.prototype.hasOwnProperty.call(item, kind));
  return String(entry?.[kind]?.[field] ?? "");
}

function updateScheduleField(schedule, kind, field, value) {
  const nextSchedule = (Array.isArray(schedule) ? schedule : []).map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).map(([name, timing]) => [
      name,
      timing && typeof timing === "object" && !Array.isArray(timing) ? { ...timing } : timing,
    ]));
  });
  let entryIndex = nextSchedule.findIndex((entry) => entry && Object.prototype.hasOwnProperty.call(entry, kind));
  if (entryIndex === -1) {
    nextSchedule.push({ [kind]: { day: "", time: "" } });
    entryIndex = nextSchedule.length - 1;
  }
  const entry = nextSchedule[entryIndex];
  const timing = entry[kind] && typeof entry[kind] === "object" && !Array.isArray(entry[kind]) ? entry[kind] : {};
  nextSchedule[entryIndex] = { ...entry, [kind]: { ...timing, [field]: value } };
  return nextSchedule;
}

function formatStatusUpdatedAt(date) {
  const dateText = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeText = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return dateText + " " + timeText;
}

function DialogShell({ open, onClose, titleId, className = "", children }) {
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

function MapInteractions({ mode, onMapClick, onFinishLine }) {
  const map = useMap();
  useEffect(() => {
    if (mode === "draw-line" || mode === "add-line-node") map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    return () => map.doubleClickZoom.enable();
  }, [map, mode]);

  useMapEvents({
    click(event) {
      if ((mode === "draw-line" || mode === "add-line-node") && event.originalEvent?.detail > 1) return;
      onMapClick([event.latlng.lat, event.latlng.lng]);
    },
    dblclick(event) {
      if (mode !== "draw-line") return;
      event.originalEvent?.preventDefault();
      onFinishLine();
    },
  });
  return null;
}

function FitBarangay({ barangay }) {
  const map = useMap();
  const lastId = useRef(null);

  useEffect(() => {
    if (!barangay || lastId.current === barangay.id) return;
    lastId.current = barangay.id;
    const points = [
      ...barangay.pins.map((pin) => [pin.latitude, pin.longitude]),
      ...barangay.firingLines.flatMap((line) => line.coordinates ?? []),
    ].filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (points.length === 0) map.setView(BAGUIO_CENTER, 13);
    else if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 16 });
  }, [barangay, map]);
  return null;
}

function FocusMap({ focus }) {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;
    if (focus.type === "point") {
      map.flyTo(focus.point, 17, { duration: 0.6 });
    } else if (focus.type === "bounds" && focus.points.length === 1) {
      map.flyTo(focus.points[0], 15, { duration: 0.6 });
    } else if (focus.type === "bounds" && focus.points.length > 1) {
      map.flyToBounds(L.latLngBounds(focus.points), { padding: [32, 32], maxZoom: 16, duration: 0.6 });
    }
  }, [focus, map]);

  return null;
}

function BarangayMap({
  barangay,
      focus,
  deviceLocation,
  mode,
  selectedPinId,
  selectedLineId,
  selectedLineNodeIndex,
  pinDraft,
  lineDraft,
  linePoints,
  onMapClick,
  onFinishLine,
  onSelectPin,
  onSelectLine,
  onSelectLineNode,
  onPinDragStart,
  onPinDrag,
  onPinDragEnd,
  onLineVertexDrag,
  onDeleteLineNode,
  onDisconnectLine,
  onRemoveLine,
}) {
  const [nodeMenu, setNodeMenu] = useState(null);
  const pins = barangay.pins.map((pin) => pinDraft?.id === pin.id ? pinDraft : pin).filter(hasMapCoordinates);
  if (pinDraft?.isNew && hasMapCoordinates(pinDraft)) pins.push(pinDraft);
  const canDisconnectAtMenuNode = Boolean(nodeMenu && lineDraft && nodeMenu.index >= 1 && nodeMenu.index < lineDraft.coordinates.length - 2);
  const canDeleteAtMenuNode = Boolean(lineDraft && lineDraft.coordinates.length > 2);

  useEffect(() => {
    if (!nodeMenu) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setNodeMenu(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [nodeMenu]);

  return (
    <>
    <MapContainer className="review-map" center={BAGUIO_CENTER} zoom={13} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url={TILE_URL}
        maxZoom={19}
      />
      <FitBarangay barangay={barangay} />
      <FocusMap focus={focus} />
      {deviceLocation && (
        <>
          {Number.isFinite(deviceLocation.accuracy) && deviceLocation.accuracy > 0 && <Circle
            center={[deviceLocation.latitude, deviceLocation.longitude]}
            radius={deviceLocation.accuracy}
            pathOptions={{ color: "#4389e8", weight: 1, fillColor: "#4389e8", fillOpacity: 0.12 }}
            interactive={false}
          />}
          <CircleMarker
            center={[deviceLocation.latitude, deviceLocation.longitude]}
            radius={7}
            pathOptions={{ color: "#fff", weight: 3, fillColor: "#4389e8", fillOpacity: 1 }}
            interactive={false}
          />
        </>
      )}
      <MapInteractions mode={mode} onMapClick={onMapClick} onFinishLine={onFinishLine} />
      {pins.map((pin, index) => {
        const selected = selectedPinId === pin.id;
        const editable = Boolean(pinDraft?.id === pin.id);
        const displayName = pin.name || `Collection site ${index + 1}`;
        return (
          <Marker
            key={pin.id}
            position={[pin.latitude, pin.longitude]}
            icon={pinIcon(index, selected, pin.sourceStatus === "removed")}
            title={`${displayName} · ${pin.purok || "Purok not assigned"}`}
            alt={`${displayName} in ${barangay.name}`}
            keyboard
            interactive={mode === "browse"}
            draggable={editable}
            bubblingMouseEvents={false}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectPin(pin.id),
              ...(editable ? {
                dragstart: () => onPinDragStart(pin.id),
                dragend: (event) => {
                  const point = event.target.getLatLng();
                  onPinDrag(point.lat, point.lng);
                  onPinDragEnd(pin.id, point.lat, point.lng);
                },
              } : {}),
            }}
          >
            <Tooltip direction="top" offset={[0, -28]}>{displayName}</Tooltip>
          </Marker>
        );
      })}
      {barangay.firingLines.map((line) => {
        const editing = lineDraft?.id === line.id;
        const coordinates = editing ? lineDraft.coordinates : line.coordinates;
        return (
          <Polyline
            key={line.id}
            positions={coordinates}
            pathOptions={{
              color: selectedLineId === line.id ? "#d5783f" : "#7568ad",
              weight: selectedLineId === line.id ? 5 : 3,
              dashArray: line.sample ? "6 6" : "9 6",
              opacity: line.sample ? 0.72 : 0.9,
            }}
            interactive={mode === "browse"}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => onSelectLine(line.id) }}
          >
            <Tooltip sticky>{line.name}{line.sample ? " · demo example" : ""}</Tooltip>
          </Polyline>
        );
      })}
      {lineDraft?.isNew && lineDraft.coordinates.length >= 2 && (
        <Polyline positions={lineDraft.coordinates} pathOptions={{ color: "#d5783f", weight: 4, dashArray: "6 5" }} />
      )}
      {mode === "draw-line" && linePoints.length > 0 && (
        <Polyline positions={linePoints} pathOptions={{ color: "#7568ad", weight: 4, dashArray: "7 6" }} />
      )}
      {(mode === "edit-line" || mode === "add-line-node") && lineDraft?.coordinates.map((point, index) => (
        <Marker
          key={`${lineDraft.id}-vertex-${index}`}
          position={point}
          icon={vertexIcon(selectedLineNodeIndex === index)}
          draggable
          keyboard
          title={`${lineDraft.name || "Firing line"} · node ${index + 1}`}
          alt={`Firing line node ${index + 1}`}
          bubblingMouseEvents={false}
          zIndexOffset={selectedLineNodeIndex === index ? 1500 : 1000}
          eventHandlers={{
            click: (event) => {
              onSelectLineNode(index);
              event.target.getElement()?.focus({ preventScroll: true });
            },
            contextmenu: (event) => {
              const originalEvent = event.originalEvent;
              originalEvent.preventDefault();
              originalEvent.stopPropagation();
              onSelectLineNode(index);
              const menuWidth = 220;
              const menuHeight = 150;
              setNodeMenu({
                lineId: lineDraft.id,
                index,
                x: Math.max(8, Math.min(originalEvent.clientX, window.innerWidth - menuWidth - 8)),
                y: Math.max(8, Math.min(originalEvent.clientY, window.innerHeight - menuHeight - 8)),
              });
            },
            dragend: (event) => {
              const next = event.target.getLatLng();
              onSelectLineNode(index);
              onLineVertexDrag(index, [next.lat, next.lng]);
              event.target.getElement()?.focus({ preventScroll: true });
            },
          }}
        />
      ))}
    </MapContainer>
    {nodeMenu && lineDraft?.id === nodeMenu.lineId && (
      <div className="line-node-context-backdrop" onPointerDown={() => setNodeMenu(null)} onContextMenu={(event) => event.preventDefault()}>
        <div
          className="line-node-context-menu"
          role="menu"
          aria-label={`Actions for node ${nodeMenu.index + 1}`}
          style={{ left: nodeMenu.x, top: nodeMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <p>Node {nodeMenu.index + 1} · {lineDraft.coordinates.length} total</p>
          <button type="button" role="menuitem" autoFocus={canDisconnectAtMenuNode} disabled={!canDisconnectAtMenuNode} title={!canDisconnectAtMenuNode ? "Each disconnected line needs at least two nodes." : undefined} onClick={() => { setNodeMenu(null); onDisconnectLine(nodeMenu.index); }}>
            Disconnect from next node
          </button>
          <button type="button" role="menuitem" autoFocus={!canDisconnectAtMenuNode && canDeleteAtMenuNode} disabled={!canDeleteAtMenuNode} title={!canDeleteAtMenuNode ? "A firing line must keep at least two nodes." : undefined} onClick={() => { setNodeMenu(null); onDeleteLineNode(nodeMenu.index); }}>
            Delete selected node
          </button>
          <button type="button" role="menuitem" autoFocus={!canDisconnectAtMenuNode && !canDeleteAtMenuNode} className="line-node-context-danger" onClick={() => { setNodeMenu(null); onRemoveLine(); }}>
            {lineDraft.isNew ? "Discard line draft" : "Remove firing line"}
          </button>
        </div>
      </div>
    )}
    </>
  );
}

function MapModeNotice({ mode, linePointCount, selectedLineNodeIndex, onCancel, onFinish, onFinishNodePlacement }) {
  if (mode === "browse") return null;
  const placement = mode === "place-pin";
  const drawing = mode === "draw-line";
  const addingNode = mode === "add-line-node";
  return (
    <div className={`map-mode-notice${drawing || addingNode ? " map-mode-notice--line" : ""}`} role="status">
      <span className="mode-indicator" aria-hidden="true">{placement ? "＋" : drawing || addingNode ? "⌁" : "↔"}</span>
      <span>{placement ? "Click the map to place a collection-site pin." : drawing ? `Click to add firing-line nodes · ${linePointCount} placed` : addingNode ? `Click the map to add a node after node ${(selectedLineNodeIndex ?? 0) + 1}.` : "Drag blue nodes to edit the path. Right-click for node and line actions; Backspace deletes the selected node."}</span>
      <div className="map-mode-actions">
        {drawing && <button className="small-action" type="button" disabled={linePointCount < 2} onClick={onFinish}>Finish line</button>}
        {addingNode && <button className="small-action" type="button" onClick={onFinishNodePlacement}>Finish placing</button>}
        <button className="small-quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ActivityLogButton({ count, onClick }) {
  return (
    <button className="activity-log-trigger" type="button" aria-haspopup="dialog" onClick={onClick}>
      <span className="activity-log-icon" aria-hidden="true">↶</span>
      Activity log <span className="activity-log-count">{count}</span>
    </button>
  );
}

function App() {
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
  const [mode, setMode] = useState("browse");
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [pinManagerCollapsed, setPinManagerCollapsed] = useState(false);
  const [pinDraft, setPinDraft] = useState(null);
  const [isLocatingCurrentPosition, setIsLocatingCurrentPosition] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [lineDraft, setLineDraft] = useState(null);
  const [selectedLineNodeIndex, setSelectedLineNodeIndex] = useState(null);
  const [showLineNodeStreetView, setShowLineNodeStreetView] = useState(false);
  const [lineNodeLocationInput, setLineNodeLocationInput] = useState("");
  const [lineNodeLocationError, setLineNodeLocationError] = useState("");
  const [lineNodeLocationMessage, setLineNodeLocationMessage] = useState("");
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
        const response = await fetch(barangaySitesUrl, { headers: { Accept: "application/json" } });
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
  const activeJson = activeJsonId === BUNDLED_JSON_ID && !bundledJsonHidden
    ? { id: BUNDLED_JSON_ID, name: "barangay_sites.json", kind: "Bundled source" }
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

  function openDetailsEditor() {
    if (!selectedBarangay) return;
    setBarangayDetailsDraft({
      name: selectedBarangay.name,
      puroks: selectedBarangay.puroks.join("\n"),
      notes: selectedBarangay.notes,
    });
    setShowBarangayDetails(true);
  }

  function saveBarangayDetails(event) {
    event.preventDefault();
    if (!selectedBarangay) return;
    const name = barangayDetailsDraft.name.trim();
    if (!name) {
      setNotice({ kind: "error", text: "Enter a barangay name before saving." });
      return;
    }
    const normalizedName = name.toLocaleLowerCase("en-US");
    const duplicateName = barangays.some((item) => item.id !== selectedBarangay.id &&
      item.name.trim().toLocaleLowerCase("en-US") === normalizedName);
    if (duplicateName) {
      setNotice({ kind: "error", text: "Another barangay already uses that name." });
      return;
    }
    const puroks = [...new Set(barangayDetailsDraft.puroks.split(/[\n,]/).map((name) => name.trim()).filter(Boolean))];
    const notes = barangayDetailsDraft.notes.trim();
    const changed = name !== selectedBarangay.name ||
      JSON.stringify(puroks) !== JSON.stringify(selectedBarangay.puroks) ||
      notes !== selectedBarangay.notes;
    if (changed) {
      commitBarangay(selectedBarangay.id, (current) => ({ ...current, name, puroks, notes }), {
        action: "Updated barangay details",
        itemType: "Barangay details",
        itemName: name,
        barangayName: name,
        details: `${puroks.length} purok${puroks.length === 1 ? "" : "s"} recorded`,
      });
    }
    setShowBarangayDetails(false);
  }

  function setConfirmed(confirmed) {
    if (!selectedBarangay || confirmed === selectedBarangay.confirmed) return;
    commitBarangay(selectedBarangay.id, (current) => ({ ...current, confirmed }), {
      action: confirmed ? "Confirmed barangay information" : "Reopened barangay review",
      itemType: "Barangay confirmation",
      itemName: selectedBarangay.name,
      details: confirmed ? "Marked confirmed" : "Marked unconfirmed",
    });
  }

  function beginPinPlacement() {
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before adding another feature." });
      return;
    }
    clearDraftUndoHistory();
    locationRequestRef.current += 1;
    setIsLocatingCurrentPosition(false);
    setPinDraft(null);
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
    setSelectedPinId(id);
    setSelectedLineId(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setMode("browse");
    setPinManagerCollapsed(false);
    setMapFocus(locationCapture ? { type: "point", point: [latitude, longitude] } : null);
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
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
    setPinManagerCollapsed(false);
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
    const nextJsonName = jsonId === BUNDLED_JSON_ID ? "barangay_sites.json" : jsonLibrary.find((item) => item.id === jsonId)?.name;
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
    const bundledVisibilitySaved = persistBundledJsonHidden(nextBundledHidden);
    setJsonLibrary(nextLibrary);
    setActiveJsonId(nextJsonId);
    setBundledJsonHidden(nextBundledHidden);
    setBundledReview(nextJsonId === BUNDLED_JSON_ID ? nextReview : nextBundledHidden ? null : bundledReview);
    setReview(nextReview);
    setStorageWarning(!(librarySaved && removedReview && bundledVisibilitySaved));
    setShowJsonDeleteConfirmation(false);
    resetReviewView();
    setNotice({
      kind: "success",
      text: remainingJsonIds.length === 0
        ? `${deleted.name} was removed. No JSON files are available; add one to start a review.`
        : `${deleted.name} was removed from this browser's JSON list. Its source file on disk remains.`,
    });
  }

  function exportReview() {
    if (!review) return;
    const exported = { ...review, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const baseName = (activeJson?.name || "barangay_sites.json").replace(/\.json$/i, "").replace(/[^a-z0-9_-]+/gi, "-");
    link.download = `${baseName}-review-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: "success", text: "Review data exported as JSON." });
  }

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

  if (loadError) {
    return (
      <main className="app-shell load-error-shell">
        <section className="data-load-state data-load-state--error"><span className="data-load-symbol">!</span><div><h2>Barangay data could not be loaded</h2><p>{loadError}</p><p>Start the demo with <code>npm run dev</code> from its folder so the barangay sites JSON can load.</p></div></section>
      </main>
    );
  }

  if (!review) {
    return <main className="app-shell"><section className="data-load-state"><span className="data-load-symbol">…</span><div><h2>Preparing barangay review</h2><p>Loading collection-site records from barangay_sites.json.</p></div></section></main>;
  }

  const visiblePins = selectedBarangay?.pins.filter((pin) => {
    const query = pinSearch.trim().toLocaleLowerCase("en-US");
    return !query || [pin.name, pin.purok, ...pin.sourceNames].join(" ").toLocaleLowerCase("en-US").includes(query);
  }) ?? [];
  const mappedSiteCount = selectedBarangay?.pins.filter(hasMapCoordinates).length ?? 0;
  const unlocatedSiteCount = (selectedBarangay?.pins.length ?? 0) - mappedSiteCount;
  const removedSiteCount = selectedBarangay?.pins.filter((pin) => pin.sourceStatus === "removed").length ?? 0;

  return (
    <main className="app-shell">
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
                {!bundledJsonHidden && <option value={BUNDLED_JSON_ID}>barangay_sites.json · bundled</option>}
                {jsonLibrary.map((item) => {
                  const sameName = jsonLibrary.filter((candidate) => candidate.name === item.name);
                  const duplicate = sameName.length > 1 ? ` · ${sameName.findIndex((candidate) => candidate.id === item.id) + 1}` : "";
                  return <option value={item.id} key={item.id}>{item.name} · {item.kind}{duplicate}</option>;
                })}
              </select>
            </div>
            <input ref={fileInputRef} className="hidden-file-input" type="file" multiple accept="application/json,.json" onChange={handleAddJson} aria-label="Add one or more barangay site or review JSON files" />
            <button className="secondary-action json-add-action" type="button" title="Add one or more raw site-record JSON files or review exports" onClick={() => fileInputRef.current?.click()}>Add JSON</button>
            <button className="json-delete-action" type="button" disabled={!canDeleteActiveJson} title={canDeleteActiveJson ? "Remove this JSON and its review copy from this browser. The source file on disk remains." : "Select a JSON file to delete it."} onClick={() => setShowJsonDeleteConfirmation(true)}>Delete JSON</button>
            <button className="export-schedule-button" type="button" onClick={exportReview} disabled={!activeJson}>Export JSON <span aria-hidden="true">↓</span></button>
            <button className="secondary-action undo-action" type="button" disabled={undoCount === 0} aria-keyshortcuts="Control+Z Meta+Z" title="Undo the last pin move or saved review change (Ctrl+Z)" onClick={undoLastAction}>↶ Undo</button>
            <ActivityLogButton count={activityLog.length} onClick={() => setShowActivity(true)} />
          </div>
        </div>
        <nav className="app-tabs" role="tablist" aria-label="Barangay review views">
          <button className={`app-tab${page === "barangays" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "barangays"} onClick={returnToBarangayList}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5 7.5 3l5 2.5L17 3v11.5L12.5 17l-5-2.5L3 17zM7.5 3v11.5M12.5 5.5V17" /></svg>Barangays
          </button>
          {selectedBarangay && <button className={`app-tab${page === "map" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "map"} onClick={() => setPage("map")}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17s5.5-5.1 5.5-9.3a5.5 5.5 0 1 0-11 0C4.5 11.9 10 17 10 17Z" /><circle cx="10" cy="7.5" r="1.7" /></svg>{selectedBarangay.name}
          </button>}
          <button className={`app-tab${page === "dashboard" ? " app-tab--active" : ""}`} type="button" role="tab" aria-selected={page === "dashboard"} onClick={() => setPage("dashboard")}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>Dashboard
          </button>
        </nav>
      </header>

      {storageWarning && <div className="storage-warning" role="status">Browser storage is full. Keep an exported JSON copy of your review changes.</div>}
      {notice && <div className={`toast toast--${notice.kind}`} role="status"><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}

      {page === "barangays" && (
        <section className="directory-view" aria-labelledby="directory-title">
          <div className="directory-heading">
            <div><p className="eyebrow">Collection-site verification</p><h1 id="directory-title">Barangay review</h1><p className="dashboard-subtitle">Choose a barangay to review its mapped collection sites and confirm local details together.</p></div>
            <div className="source-chip"><span className="source-dot" />Active dataset <strong>{activeJson?.name ?? "No JSON loaded"} · {formatNumber(siteCount)} records</strong></div>
          </div>
          <div className="directory-metrics">
            <MetricCard tone="green" label="Barangays" value={barangays.length} detail="Areas in this review workspace" icon="⌖" />
            <MetricCard tone="orange" label="Collection sites" value={siteCount} detail="Site records in the active JSON" icon="●" />
            <MetricCard tone="violet" label="Confirmed" value={confirmedCount} detail={`${formatNumber(unconfirmedCount)} still to review`} icon="✓" />
            <MetricCard tone="blue" label="Puroks recorded" value={barangays.length - needsPurokCount} detail={`${formatNumber(needsPurokCount)} barangays need purok details`} icon="⌂" />
          </div>
          <section className="directory-panel" aria-label="Barangay list">
            <div className="directory-panel-heading">
              <div><p className="eyebrow">Review workspace</p><h2>Barangays <span>{filteredBarangays.length}</span></h2><p>Open a barangay to review its map, sites, and firing lines.</p></div>
              <div className="directory-controls">
                <label className="directory-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a barangay" aria-label="Find a barangay" /></label>
                <label className="directory-filter"><span className="sr-only">Filter barangays</span><select value={listFilter} onChange={(event) => setListFilter(event.target.value)}><option value="all">All barangays</option><option value="unconfirmed">Needs confirmation</option><option value="confirmed">Confirmed</option><option value="no-sites">No site pins</option></select></label>
              </div>
            </div>
            <div className="barangay-list-head" aria-hidden="true"><span>Barangay</span><span>Sites</span><span>Review status</span><span /></div>
            <div className="barangay-list">
              {filteredBarangays.map((barangay, index) => (
                <button className="barangay-row" key={barangay.id} type="button" onClick={() => openBarangay(barangay)}>
                  <span className="barangay-row-name"><span className="row-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{barangay.name}</strong><small>{barangay.puroks.length ? `${barangay.puroks.length} purok${barangay.puroks.length === 1 ? "" : "s"} recorded` : "Puroks not yet recorded"}</small></span></span>
                  <span className="barangay-site-count"><strong>{formatNumber(barangay.pins.length)}</strong><small>site{barangay.pins.length === 1 ? "" : "s"}</small></span>
                  <span className={`review-status${barangay.confirmed ? " review-status--confirmed" : ""}`}><i />{barangay.confirmed ? "Confirmed" : "Needs review"}</span>
                  <span className="row-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
              {filteredBarangays.length === 0 && (barangays.length === 0
                ? <div className="directory-empty"><span>⌖</span><strong>No JSON data loaded</strong><p>Add a JSON file to review its barangays and collection sites.</p></div>
                : <div className="directory-empty"><span>⌕</span><strong>No barangays found</strong><p>Try another name or change the review filter.</p><button className="small-quiet" type="button" onClick={() => { setSearch(""); setListFilter("all"); }}>Clear filters</button></div>)}

            </div>
            <p className="directory-footnote">{activeJson ? <>Active data: <code>{activeJson.name}</code>. </> : "No JSON is currently loaded. Add a file to begin a review. "}Changes in this demo stay in this browser until exported.</p>
          </section>
        </section>
      )}

      {page === "map" && selectedBarangay && (
        <section className="map-view barangay-map-view" aria-labelledby="barangay-map-title">
          <div className="map-page-heading">
            <div>
              <p className="eyebrow">Field collection</p>
              <h1 id="barangay-map-title">{selectedBarangay.name}</h1>
              <p className="map-page-subtitle">Capture collection sites and pickup/drop-off details for this barangay. Use a GPS pin or place one manually on the map.</p>
            </div>
            <div className="barangay-review-actions">
              <button className="secondary-action" type="button" onClick={openDetailsEditor}><span aria-hidden="true">✎</span>Update barangay details</button>
              <label className={`confirmation-control${selectedBarangay.confirmed ? " confirmation-control--on" : ""}`}>
                <span className="confirmation-copy"><strong>{selectedBarangay.confirmed ? "Information confirmed" : "Not yet confirmed"}</strong><small>Barangay review status</small></span>
                <input type="checkbox" checked={selectedBarangay.confirmed} onChange={(event) => setConfirmed(event.target.checked)} aria-label={`Mark ${selectedBarangay.name} information confirmed`} />
                <span className="confirmation-switch" aria-hidden="true"><i /></span>
              </label>
            </div>
          </div>

          <div className="barangay-summary-strip">
            <div><span className="summary-strip-icon summary-strip-icon--green">●</span><strong>{formatNumber(selectedBarangay.pins.length)}</strong><small>site records</small></div>
            <div><span className="summary-strip-icon summary-strip-icon--violet">⌁</span><strong>{formatNumber(selectedBarangay.firingLines.length)}</strong><small>firing lines</small></div>
            <div><span className="summary-strip-icon summary-strip-icon--orange">⌂</span><strong>{formatNumber(selectedBarangay.puroks.length)}</strong><small>puroks recorded</small></div>
            <div className="summary-source-note"><span className="source-dot" /><span>Collection records from {activeJson?.name ?? "No JSON loaded"}</span></div>
          </div>

          <section className="map-filter-preview" aria-label="Map filter preview">
            <div className="map-filter-title"><span className="filter-funnel" aria-hidden="true">▽</span><div><strong>Map filters</strong><small>Preview only</small></div></div>
            <label><span>Purok</span><select disabled value="all" aria-label="Purok map filter placeholder"><option value="all">All puroks</option></select></label>
            <label><span>Site status</span><select disabled value="all" aria-label="Site status map filter placeholder"><option value="all">All sites</option></select></label>
            <label><span>Review</span><select disabled value="all" aria-label="Review map filter placeholder"><option value="all">Any status</option></select></label>
            <p>Filters are visual placeholders for this demo.</p>
          </section>

          <div className="map-layout barangay-map-layout">
            <section className="map-card" aria-label={`${selectedBarangay.name} collection-site map`}>
              <div className="map-card-heading"><div><p className="eyebrow">Site locations</p><h2>Collection map</h2></div><span className="map-count-card"><strong className="map-count-number">{formatNumber(mappedSiteCount)}</strong> mapped</span></div>
              <MapModeNotice
                mode={mode}
                linePointCount={linePoints.length}
                selectedLineNodeIndex={selectedLineNodeIndex}
                onCancel={mode === "add-line-node" ? finishLineNodePlacement : cancelMapMode}
                onFinish={finishLineDrawing}
                onFinishNodePlacement={finishLineNodePlacement}
              />
              <div className={`map-frame barangay-map-frame${mode !== "browse" ? " barangay-map-frame--active-tool" : ""}`}>
                <BarangayMap
                  key={selectedBarangay.id}
                  barangay={selectedBarangay}
                  focus={mapFocus}
                  deviceLocation={deviceLocation}
                  mode={mode}
                  selectedPinId={selectedPinId}
                  selectedLineId={selectedLineId}
                  selectedLineNodeIndex={selectedLineNodeIndex}
                  pinDraft={pinDraft}
                  lineDraft={lineDraft}
                  linePoints={linePoints}
                  onMapClick={handleMapClick}
                  onFinishLine={finishLineDrawing}
                  onSelectPin={selectPin}
                  onSelectLine={selectLine}
                  onSelectLineNode={selectLineNode}
                  onPinDragStart={(pinId) => {
                    if (pinDraft?.id !== pinId) return;
                    pinDragStartRef.current = {
                      pinId,
                      latitude: Number(pinDraft.latitude),
                      longitude: Number(pinDraft.longitude),
                    };
                  }}
                  onPinDrag={(latitude, longitude) => setPinDraft((current) => current ? ({ ...current, latitude, longitude }) : current)}
                  onPinDragEnd={(pinId, latitude, longitude) => {
                    const previous = pinDragStartRef.current;
                    pinDragStartRef.current = null;
                    if (!previous || previous.pinId !== pinId) return;
                    const moved = Math.abs(previous.latitude - latitude) > 0.0000001 || Math.abs(previous.longitude - longitude) > 0.0000001;
                    if (!moved) return;
                    pinMoveUndoRef.current.push({
                      pinId,
                      latitude: previous.latitude,
                      longitude: previous.longitude,
                    });
                    if (pinMoveUndoRef.current.length > 100) pinMoveUndoRef.current.shift();
                    setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
                  }}
                  onLineVertexDrag={(pointIndex, nextPoint) => updateLineNodePosition(pointIndex, nextPoint[0], nextPoint[1])}
                  onDeleteLineNode={deleteSelectedLineNode}
                  onDisconnectLine={disconnectFiringLine}
                  onRemoveLine={() => {
                    if (!lineDraft) return;
                    if (lineDraft.isNew) cancelMapMode();
                    else requestDelete("line", lineDraft);
                  }}
                />
                <button
                  className={`map-recenter-button${isLocatingCurrentPosition ? " map-recenter-button--loading" : ""}`}
                  type="button"
                  onClick={recenterOnCurrentLocation}
                  disabled={isLocatingCurrentPosition}
                  aria-label="Recenter map on my current location"
                  aria-busy={isLocatingCurrentPosition}
                  title="Recenter on my current location"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="5.25" />
                    <circle className="map-recenter-dot" cx="12" cy="12" r="1.5" />
                    <path d="M12 2.75v3.1M12 18.15v3.1M2.75 12h3.1M18.15 12h3.1" />
                  </svg>
                </button>
                <button
                  className="map-recenter-button map-recenter-button--pin"
                  type="button"
                  disabled={!selectedPinHasMapCoordinates && mapPinPoints.length === 0}
                  onClick={() => {
                    if (selectedPinHasMapCoordinates) {
                      setMapFocus({ type: "point", point: [Number(selectedPinForMap.latitude), Number(selectedPinForMap.longitude)] });
                    } else {
                      setMapFocus({ type: "bounds", points: mapPinPoints });
                    }
                  }}
                  aria-label={selectedPinHasMapCoordinates ? "Recenter map on selected pin" : "Recenter map to show all pins"}
                  title={selectedPinHasMapCoordinates ? "Recenter on selected pin" : "Show all pins on map"}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                    <circle cx="12" cy="10" r="2.25" />
                  </svg>
                </button>
                <div className="map-legend"><span><i className="legend-pin" />Collection site</span>{deviceLocation && <span><i className="legend-current-location" />My location</span>}<span><i className="legend-line" />Firing line</span><span><i className="legend-removed" />Removed in source</span></div>
              </div>
              <div className="map-card-footer"><span>Map tiles by OpenStreetMap</span><span>{formatNumber(unlocatedSiteCount)} without coordinates · {formatNumber(removedSiteCount)} removed in source</span></div>
            </section>

            <aside className="map-side-panel barangay-tools-panel" aria-label="Manage collection pins and firing lines">
              <section className={`review-panel pin-manager-panel${pinManagerCollapsed ? " pin-manager-panel--collapsed" : ""}`}>
                <div className="tools-heading">
                  <div><p className="eyebrow">Collection sites</p><h2>Pins <span>{formatNumber(selectedBarangay.pins.length)}</span></h2></div>
                  <div className="pin-manager-heading-actions">
                    {!pinManagerCollapsed && <button className="small-action" type="button" onClick={beginPinFromCurrentLocation} disabled={isLocatingCurrentPosition} aria-busy={isLocatingCurrentPosition}>{isLocatingCurrentPosition ? "Locating…" : "⌖ Add GPS pin"}</button>}
                    {!pinManagerCollapsed && <button className={`small-action${mode === "place-pin" ? " small-action--active" : ""}`} type="button" onClick={beginPinPlacement} aria-pressed={mode === "place-pin"}>＋ Add pin</button>}
                    <button
                      className="small-action pin-manager-toggle"
                      type="button"
                      onClick={() => setPinManagerCollapsed((current) => !current)}
                      aria-expanded={!pinManagerCollapsed}
                      aria-label={pinManagerCollapsed ? "Expand Pins panel" : "Minimize Pins panel"}
                    >
                      {pinManagerCollapsed ? "Expand" : "Minimize"}
                    </button>
                  </div>
                </div>
                {pinDraft ? (
                  <form className="pin-editor" onSubmit={savePin}>
                    <div className="editor-topline"><div><p className="eyebrow">{pinDraft.isNew ? "New site" : "Edit site"}</p><h3>{pinDraft.isNew ? "Collection-site pin" : pinDraft.name}</h3></div><button className="icon-close icon-close--small" type="button" aria-label="Cancel pin editing" onClick={cancelMapMode}>×</button></div>
                    <label className="field-label">Site name<input autoFocus value={pinDraft.name} onChange={(event) => setPinDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Site 3, Riverside drop-off" /></label>
                    <label className="field-label">Assigned purok<input list="barangay-purok-options" value={pinDraft.purok} onChange={(event) => setPinDraft((current) => ({ ...current, purok: event.target.value }))} placeholder="e.g. Purok 1" /><datalist id="barangay-purok-options">{selectedBarangay.puroks.map((purok) => <option key={purok} value={purok} />)}</datalist></label>
                    <div className="coordinate-fields"><label className="field-label">Latitude<input type="number" step="any" value={pinDraft.latitude} onChange={(event) => setPinDraft((current) => ({ ...current, latitude: event.target.value }))} /></label><label className="field-label">Longitude<input type="number" step="any" value={pinDraft.longitude} onChange={(event) => setPinDraft((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
                    {pinDraft.location?.source === "device_gps" && <p className="field-help gps-capture-note">GPS location captured{Number.isFinite(pinDraft.location.accuracy_m) ? ` · about ±${pinDraft.location.accuracy_m} m` : ""}. A Google Maps link will be saved with this pin.</p>}
                    <div className="site-schedule-editor">
                      <fieldset className="site-schedule-group">
                        <legend>Pickup schedule</legend>
                        <label className="field-label">Date<input type="date" value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "date")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "date", event.target.value) }) : current)} /></label>
                        <div className="site-schedule-fields">
                          <label className="field-label">Day<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "day")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "day", event.target.value) }) : current)} placeholder="Monday" /></label>
                          <label className="field-label">Time<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "pick-up", "time")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "pick-up", "time", event.target.value) }) : current)} placeholder="5:00 AM - 7:00 AM" /></label>
                        </div>
                      </fieldset>
                      <fieldset className="site-schedule-group">
                        <legend>Drop-off schedule</legend>
                        <label className="field-label">Date<input type="date" value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "date")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "date", event.target.value) }) : current)} /></label>
                        <div className="site-schedule-fields">
                          <label className="field-label">Day<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "day")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "day", event.target.value) }) : current)} placeholder="Monday" /></label>
                          <label className="field-label">Time<input value={scheduleFieldValue(pinDraft.schedule ?? pinDraft.sourceSchedule, "drop-off", "time")} onChange={(event) => setPinDraft((current) => current ? ({ ...current, schedule: updateScheduleField(current.schedule ?? current.sourceSchedule, "drop-off", "time", event.target.value) }) : current)} placeholder="5:00 AM - 7:00 AM" /></label>
                        </div>
                      </fieldset>
                    </div>
                    <label className="field-label">Status type<input list="barangay-site-status-types" value={pinDraft.statusType ?? pinDraft.sourceStatusLabel ?? ""} onChange={(event) => setPinDraft((current) => ({ ...current, statusType: event.target.value }))} placeholder="e.g. Existing" /></label>
                    <datalist id="barangay-site-status-types">
                      <option value="Existing" />
                      <option value="Corrected/Adjusted" />
                      <option value="Removed collection point" />
                      <option value="Unverified / For Checking" />
                      <option value="With remarks" />
                      <option value="New" />
                    </datalist>
                    <label className="field-label">Remarks<textarea value={pinDraft.remarks ?? pinDraft.sourceRemarks ?? ""} onChange={(event) => setPinDraft((current) => ({ ...current, remarks: event.target.value }))} rows="2" placeholder="Add site remarks" /></label>
                    <PinLocationAssistant
                      pinId={pinDraft.id}
                      latitude={pinDraft.latitude}
                      longitude={pinDraft.longitude}
                      onCoordinatesChange={({ latitude, longitude }) => setPinDraft((current) => current ? ({
                        ...current,
                        latitude: Number(latitude.toFixed(6)),
                        longitude: Number(longitude.toFixed(6)),
                      }) : current)}
                    />
                    <label className="field-label">Review note<textarea value={pinDraft.notes} onChange={(event) => setPinDraft((current) => ({ ...current, notes: event.target.value }))} rows="2" placeholder="Add a note from the discussion" /></label>
                    <div className="editor-actions"><button className="primary-small-button" type="submit">{pinDraft.isNew ? "Save pin" : "Save changes"}</button><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button></div>
                  </form>
                ) : selectedPin ? (
                  <div className="pin-detail-card">
                    <div className="pin-detail-topline"><span className={`pin-status-dot${selectedPin.sourceStatus === "removed" ? " pin-status-dot--removed" : ""}`} /><span className="eyebrow">{selectedPin.sourceStatusLabel || (selectedPin.sourceStatus === "removed" ? "Removed in source export" : selectedPin.sourceStatus === "new" ? "Added in this review" : "Site record")}</span></div>
                    <h3>{selectedPin.name}</h3>
                    {selectedPin.sourceNames?.length > 1 && <p className="source-aliases">Source labels: {selectedPin.sourceNames.join(" · ")}</p>}
                    <dl className="pin-detail-list">
                      <div><dt>Purok</dt><dd>{selectedPin.purok || <span className="missing-value">Not assigned</span>}</dd></div>
                      <div><dt>Coordinates</dt><dd>{hasMapCoordinates(selectedPin) ? <code>{coordinateText(selectedPin.latitude, selectedPin.longitude)}</code> : <span className="missing-value">Not mapped · edit to add coordinates</span>}</dd></div>
                      <div><dt>Status last updated</dt><dd>{selectedPin.statusLastUpdated || <span className="missing-value">Not recorded</span>}</dd></div>
                      {sourceScheduleRows(selectedPin.schedule ?? selectedPin.sourceSchedule).map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
                      <div><dt>Source record</dt><dd>{selectedPin.sourceRowCount || "New record"}</dd></div>
                      {selectedPin.sourcePuroks?.length > 0 && <div><dt>Raw purok field</dt><dd>{selectedPin.sourcePuroks.join(" · ")}</dd></div>}
                      {(selectedPin.remarks || selectedPin.sourceRemarks) && <div><dt>Remarks</dt><dd>{selectedPin.remarks || selectedPin.sourceRemarks}</dd></div>}
                      {selectedPin.notes && <div><dt>Review note</dt><dd>{selectedPin.notes}</dd></div>}
                    </dl>
                    <div className="pin-detail-actions">
                      {hasMapCoordinates(selectedPin) && <a className="quiet-small-button pin-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateText(selectedPin.latitude, selectedPin.longitude))}`} target="_blank" rel="noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>}
                      <button className="quiet-small-button" type="button" onClick={() => beginEditPin(selectedPin)}>Edit pin</button>
                      <button className="danger-text-button" type="button" onClick={() => requestDelete("pin", selectedPin)}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="pin-selection-prompt"><span className="selection-target" aria-hidden="true">⌖</span><strong>Select a pin to review</strong><p>Choose a site below or on the map. Add a new pin by clicking <b>Add pin</b> and placing it on the map.</p></div>
                )}
                <label className="site-search"><span aria-hidden="true">⌕</span><input value={pinSearch} onChange={(event) => setPinSearch(event.target.value)} placeholder="Search sites or puroks" aria-label="Search collection sites" /></label>
                <ul className="site-record-list" aria-label="Collection-site pins">
                  {visiblePins.map((pin, index) => (
                    <li key={pin.id}><button className={`site-record${selectedPinId === pin.id ? " site-record--active" : ""}${pin.sourceStatus === "removed" ? " site-record--removed" : ""}`} type="button" onClick={() => selectPin(pin.id)}>
                      <span className="site-record-number">{index + 1}</span><span className="site-record-copy"><strong>{pin.name}</strong><small>{pin.purok || pin.sourcePuroks?.[0] || "Purok not assigned"}{pin.sourceStatus === "removed" ? " · removed" : ""}{!hasMapCoordinates(pin) ? " · no coordinates" : ""}</small></span><span className="site-record-arrow" aria-hidden="true">›</span>
                    </button></li>
                  ))}
                  {visiblePins.length === 0 && <li className="site-list-empty">No sites match this search.</li>}
                </ul>
              </section>

              <section className="review-panel line-manager-panel">
                <div className="tools-heading"><div><p className="eyebrow">Route features</p><h2>Firing lines <span>{formatNumber(selectedBarangay.firingLines.length)}</span></h2></div><button className={`small-action small-action--line${mode === "draw-line" ? " small-action--active" : ""}`} type="button" onClick={beginLineDrawing} aria-pressed={mode === "draw-line"}>{mode === "draw-line" ? "Cancel line" : "＋ Add line"}</button></div>
                {lineDraft ? (
                  <form className="line-editor" onSubmit={saveLine}>
                    <div className="editor-topline"><div><p className="eyebrow">{lineDraft.isNew ? "New feature" : "Edit feature"}</p><h3>{lineDraft.name}</h3></div><button className="icon-close icon-close--small" type="button" aria-label="Cancel line editing" onClick={cancelMapMode}>×</button></div>
                    <label className="field-label">Firing-line name<input autoFocus value={lineDraft.name} onChange={(event) => setLineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name this line" /></label>
                    <div className="line-node-summary"><span className="line-node-icon">⌁</span><span><strong>{lineDraft.coordinates.length} map nodes</strong><small>Select a blue node to review it. Right-click for node and line actions; Backspace deletes the selected node.</small></span></div>
                    {selectedLineNode && Number.isInteger(selectedLineNodeIndex) && (
                      <section className="firing-line-node-panel" aria-labelledby="firing-line-node-title" aria-live="polite">
                        <div>
                          <p className="eyebrow">Selected node · {selectedLineNodeIndex + 1} of {lineDraft.coordinates.length}</p>
                          <h4 id="firing-line-node-title">{lineDraft.name || "Firing line"} · node {selectedLineNodeIndex + 1}</h4>
                        </div>
                        <dl className="firing-line-node-coordinates">
                          <div><dt>Latitude</dt><dd>{selectedLineNode[0].toFixed(6)}</dd></div>
                          <div><dt>Longitude</dt><dd>{selectedLineNode[1].toFixed(6)}</dd></div>
                        </dl>
                        <p>{mode === "add-line-node"
                          ? "Click the map to place a node after this one. You can add several before finishing."
                          : "Drag this blue node on the map, use Street View, or paste a Google Maps location. Save the firing line to keep your changes."}</p>
                        <div className="line-detail-actions">
                          <button className="quiet-small-button" type="button" onClick={mode === "add-line-node" ? finishLineNodePlacement : beginLineNodePlacement}>
                            {mode === "add-line-node" ? "Finish placing nodes" : "Add node after this one"}
                          </button>
                          <button className="danger-text-button firing-line-delete-node-button" type="button" disabled={lineDraft.coordinates.length <= 2} onClick={deleteSelectedLineNode} title={lineDraft.coordinates.length <= 2 ? "A firing line must keep at least two nodes." : undefined}>
                            {lineDraft.coordinates.length <= 2 ? "At least two nodes are required" : "Delete selected node"}
                          </button>
                        </div>
                        <div className="firing-line-node-street-view">
                          <a
                            className="firing-line-street-view-link"
                            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedLineNode[0]},${selectedLineNode[1]}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open this node in Google Street View <span aria-hidden="true">↗</span>
                          </a>
                          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ? (
                            <>
                              <button type="button" className="quiet-small-button" aria-expanded={showLineNodeStreetView} onClick={() => setShowLineNodeStreetView((current) => !current)}>
                                {showLineNodeStreetView ? "Close in-app Street View" : "Open in-app Street View"}
                              </button>
                              {showLineNodeStreetView && (
                                <GoogleStreetViewEditor
                                  key={`${lineDraft.id}-${selectedLineNodeIndex}`}
                                  apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim()}
                                  latitude={selectedLineNode[0]}
                                  longitude={selectedLineNode[1]}
                                  onPositionChange={handleLineNodeStreetViewPosition}
                                  onUsePosition={handleLineNodeStreetViewPosition}
                                  instructions="The selected node follows the panorama. Save the firing line to record its updated position."
                                />
                              )}
                            </>
                          ) : null}
                          <details className="manual-street-view-fallback" open={!import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()}>
                            <summary>Paste a Google Maps link or coordinates</summary>
                            <label className="street-view-input-label" htmlFor={`line-node-location-${lineDraft.id}-${selectedLineNodeIndex}`}>Google Maps link or latitude, longitude</label>
                            <textarea
                              id={`line-node-location-${lineDraft.id}-${selectedLineNodeIndex}`}
                              rows={2}
                              value={lineNodeLocationInput}
                              onChange={(event) => {
                                setLineNodeLocationInput(event.target.value);
                                setLineNodeLocationError("");
                                setLineNodeLocationMessage("");
                              }}
                              placeholder="16.4021, 120.5960 or paste a Maps link with coordinates"
                            />
                            <button type="button" className="quiet-small-button" onClick={applyLineNodeLocation}>Use these coordinates</button>
                            {lineNodeLocationError && <p className="form-error" role="alert">{lineNodeLocationError}</p>}
                            {lineNodeLocationMessage && <p className="inline-save-status" role="status">{lineNodeLocationMessage}</p>}
                          </details>
                          <p className="imagery-note">Node moves stay in this firing-line draft until you save the line.</p>
                        </div>
                      </section>
                    )}
                    {lineDraft.sample && <p className="sample-line-note">This illustrative demo line is labeled for verification.</p>}
                    <label className="field-label">Review note<textarea value={lineDraft.notes} onChange={(event) => setLineDraft((current) => ({ ...current, notes: event.target.value }))} rows="2" placeholder="Add a note about this route" /></label>
                    <div className="editor-actions"><button className="primary-small-button primary-small-button--violet" type="submit">{lineDraft.isNew ? "Save firing line" : "Save line changes"}</button><button className="quiet-small-button" type="button" onClick={cancelMapMode}>Cancel</button></div>
                  </form>
                ) : selectedLine ? (
                  <div className="line-detail-card">
                    <div className="line-detail-topline"><span className="line-swatch" /><span className="eyebrow">Firing line · {selectedLine.coordinates.length} nodes</span>{selectedLine.sample && <span className="demo-badge">Demo example</span>}</div>
                    <h3>{selectedLine.name}</h3>
                    {selectedLine.notes && <p className="line-review-note">{selectedLine.notes}</p>}
                    <div className="line-detail-actions"><button className="quiet-small-button" type="button" onClick={() => beginEditLine(selectedLine)}>Edit line</button><button className="danger-text-button" type="button" onClick={() => requestDelete("line", selectedLine)}>Delete</button></div>
                  </div>
                ) : selectedBarangay.firingLines.length === 0 ? (
                  <div className="line-empty-state"><span aria-hidden="true">⌁</span><strong>No firing lines yet</strong><p>Add a line, then click map locations to trace its path. Double-click or use Finish line to complete it.</p></div>
                ) : null}
                <ul className="firing-line-list" aria-label="Firing lines">
                  {selectedBarangay.firingLines.map((line) => (
                    <li key={line.id} className={selectedLineId === line.id ? "firing-line-row--active" : ""}>
                      <button className="firing-line-select" type="button" onClick={() => selectLine(line.id)}><span className="line-swatch" /><span><strong>{line.name}</strong><small>{line.coordinates.length} nodes{line.sample ? " · demo example" : ""}</small></span></button>
                      <div className="firing-line-actions"><button type="button" className="line-edit-button" onClick={() => beginEditLine(line)}>Edit</button><button type="button" className="danger-text-button" onClick={() => requestDelete("line", line)}>Delete</button></div>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
          <p className="review-data-note">This is a review copy. Edits are saved in this browser and can be carried to another device with <strong>Export JSON</strong>.</p>
        </section>
      )}

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

      <footer className="app-footer"><span>Baguio City · Barangay collection-site review</span><span>Changes stay in this browser until you export the JSON.</span></footer>

      <DialogShell open={showActivity} onClose={() => setShowActivity(false)} titleId="activity-title" className="activity-dialog">
        <header className="dialog-header">
          <div className="dialog-heading-lockup"><span className="activity-mark" aria-hidden="true">↶</span><div><p className="eyebrow">Review history</p><h2 id="activity-title">Activity log</h2></div><span className="activity-total">{activityLog.length}</span></div>
          <button className="icon-close" type="button" aria-label="Close activity log" onClick={() => setShowActivity(false)}>×</button>
        </header>
        <div className="activity-content">
          {activityLog.length === 0 ? <div className="empty-activity"><span>↶</span><h3>No changes yet</h3><p>Barangay, pin, and firing-line edits will appear here during the review.</p></div> : <ol className="activity-list">{activityLog.map((entry) => <li className="activity-entry" key={entry.id}><div className="activity-entry-heading"><strong>{entry.action}</strong><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></div><p className="activity-entry-name">{entry.itemName || entry.itemType}</p><p className="activity-entry-meta">{entry.barangayName}{entry.details ? ` · ${entry.details}` : ""}</p></li>)}</ol>}
        </div>
      </DialogShell>

      <DialogShell open={showBarangayDetails} onClose={() => setShowBarangayDetails(false)} titleId="barangay-details-title" className="details-dialog">
        <header className="dialog-header"><div className="dialog-heading-lockup"><span className="details-mark" aria-hidden="true">⌂</span><div><p className="eyebrow">Barangay information</p><h2 id="barangay-details-title">Update barangay details</h2></div></div><button className="icon-close" type="button" aria-label="Close barangay details" onClick={() => setShowBarangayDetails(false)}>×</button></header>
        <form className="details-form" onSubmit={saveBarangayDetails}>
          <div className="details-barangay-name"><span>Editing barangay name</span><strong>{barangayDetailsDraft.name || "Enter a name"}</strong></div>
          <label className="field-label">Barangay name<input autoFocus value={barangayDetailsDraft.name} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Enter barangay name" /></label>
          <label className="field-label">Puroks<textarea value={barangayDetailsDraft.puroks} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, puroks: event.target.value }))} rows="7" placeholder={"Purok 1\nPurok 2\nPurok 3"} /><small>Enter one purok per line. Commas are also accepted.</small></label>
          <label className="field-label">Barangay review notes<textarea value={barangayDetailsDraft.notes} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, notes: event.target.value }))} rows="4" placeholder="Add details or questions raised during the review" /></label>
          <div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowBarangayDetails(false)}>Cancel</button><button className="primary-small-button" type="submit">Save details</button></div>
        </form>
      </DialogShell>

      <DialogShell open={showJsonDeleteConfirmation} onClose={() => setShowJsonDeleteConfirmation(false)} titleId="delete-json-title" className="delete-dialog">
        <div className="delete-dialog-content"><span className="delete-symbol" aria-hidden="true">!</span><p className="eyebrow">Remove from this browser</p><h2 id="delete-json-title">Delete this JSON?</h2><p className="delete-item-name">{activeJson?.name}</p><p className="delete-description">This removes the JSON and its saved review from the selector. The original file on disk will remain unchanged.</p><div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowJsonDeleteConfirmation(false)}>Cancel</button><button className="delete-submit" type="button" onClick={deleteActiveJson}>Delete JSON</button></div></div>
      </DialogShell>

      <DialogShell open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} titleId="delete-title" className="delete-dialog">
        <div className="delete-dialog-content"><span className="delete-symbol" aria-hidden="true">!</span><p className="eyebrow">Remove from this review</p><h2 id="delete-title">Delete {pendingDelete?.kind === "line" ? "firing line" : "collection-site pin"}?</h2><p className="delete-item-name">{pendingDelete?.name}</p><p className="delete-description">This item will be removed from the barangay review copy and included in the activity log.</p><div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setPendingDelete(null)}>Cancel</button><button className="delete-submit" type="button" onClick={confirmDelete}>Delete item</button></div></div>
      </DialogShell>
    </main>
  );
}

function MetricCard({ tone, label, value, detail, icon }) {
  return <article className={`dashboard-metric dashboard-metric--${tone}`}><div className="dashboard-metric-topline"><span className="dashboard-metric-icon-wrap"><span className="dashboard-metric-icon" aria-hidden="true">{icon}</span></span><span className="dashboard-metric-label">{label}</span></div><strong className="dashboard-metric-value">{formatNumber(value)}</strong><p className="dashboard-metric-description">{detail}</p></article>;
}

function Dashboard({ barangays, siteCount, confirmedCount, activityLog, activeJsonName, onOpenBarangay }) {
  const largestBarangays = [...barangays].sort((a, b) => b.pins.length - a.pins.length || a.name.localeCompare(b.name)).slice(0, 8);
  const maximumSiteCount = Math.max(1, ...largestBarangays.map((barangay) => barangay.pins.length));
  const reviewQueue = [...barangays].filter((barangay) => !barangay.confirmed).sort((a, b) => b.pins.length - a.pins.length).slice(0, 5);
  const recentEntries = activityLog.slice(0, 5);
  const barangaysWithSites = barangays.filter((barangay) => barangay.pins.length > 0).length;
  const confirmedWithSites = barangays.filter((barangay) => barangay.confirmed && barangay.pins.length > 0).length;
  const siteCoverage = barangaysWithSites === 0 ? 0 : Math.round((confirmedWithSites / barangaysWithSites) * 100);

  return (
    <section className="dashboard-view barangay-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading"><div><p className="eyebrow">Barangay collection-site review</p><h1 id="dashboard-title">Review dashboard</h1><p className="dashboard-subtitle">A quick view of map coverage, barangay confirmations, and review activity.</p></div><div className="dashboard-schedule-chip"><span className="dashboard-live-dot" /><span>Active dataset</span><strong>{activeJsonName} · browser saved</strong></div></div>
      <div className="dashboard-metrics">
        <MetricCard tone="green" label="Barangays" value={barangays.length} detail="Included in the current review copy" icon="⌖" />
        <MetricCard tone="orange" label="Collection sites" value={siteCount} detail="Source site records across barangays" icon="●" />
        <MetricCard tone="violet" label="Confirmed barangays" value={confirmedCount} detail={`${formatNumber(barangays.length - confirmedCount)} still to review`} icon="✓" />
        <MetricCard tone="teal" label="Review changes" value={activityLog.length} detail="Recorded edits and confirmations" icon="↶" />
      </div>

      <section className="dashboard-coverage-panel" aria-labelledby="coverage-title">
        <div className="dashboard-coverage-panel-heading"><div><p className="eyebrow">Review coverage</p><h2 id="coverage-title">Barangay confirmation progress</h2></div><span className="dashboard-coverage-tag">{confirmedWithSites} of {barangaysWithSites} with mapped sites confirmed</span></div>
        <div className="dashboard-coverage-grid">
          <div className="dashboard-coverage-item"><div className="dashboard-coverage-heading"><div><h3>Confirmed with site locations</h3><p>Barangays confirmed during local review</p></div><strong>{siteCoverage}%</strong></div><div className="dashboard-progress-track"><span style={{ width: `${siteCoverage}%` }} /></div><p className="dashboard-coverage-count">{formatNumber(confirmedWithSites)} confirmed · {formatNumber(Math.max(0, barangaysWithSites - confirmedWithSites))} still open</p></div>
          <div className="dashboard-coverage-item dashboard-coverage-item--violet"><div className="dashboard-coverage-heading"><div><h3>Barangay puroks recorded</h3><p>Local purok details in the review copy</p></div><strong>{barangays.length === 0 ? 0 : Math.round((barangays.filter((barangay) => barangay.puroks.length > 0).length / barangays.length) * 100)}%</strong></div><div className="dashboard-progress-track"><span style={{ width: `${barangays.length === 0 ? 0 : Math.round((barangays.filter((barangay) => barangay.puroks.length > 0).length / barangays.length) * 100)}%` }} /></div><p className="dashboard-coverage-count">{formatNumber(barangays.filter((barangay) => barangay.puroks.length > 0).length)} barangays have at least one purok recorded</p></div>
        </div>
      </section>

      <div className="dashboard-two-column">
        <section className="dashboard-daily-panel" aria-labelledby="largest-title">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Map distribution</p><h2 id="largest-title">Barangays with the most site pins</h2><p>Open a barangay to inspect its locations on the map.</p></div><span className="dashboard-coverage-tag">Top 8</span></div>
          <div className="dashboard-site-bars">{largestBarangays.map((barangay) => <button className="dashboard-site-bar-row" key={barangay.id} type="button" onClick={() => onOpenBarangay(barangay)}><span className="dashboard-bar-label">{barangay.name}</span><span className="dashboard-bar-track"><i style={{ width: `${Math.max(3, (barangay.pins.length / maximumSiteCount) * 100)}%` }} /></span><strong>{formatNumber(barangay.pins.length)}</strong><span className={`mini-confirm-mark${barangay.confirmed ? " mini-confirm-mark--on" : ""}`}>{barangay.confirmed ? "✓" : "·"}</span></button>)}</div>
        </section>

        <section className="dashboard-review-queue" aria-labelledby="queue-title">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Next to review</p><h2 id="queue-title">Open barangays</h2><p>Start with an unconfirmed area.</p></div><span className="queue-count">{formatNumber(barangays.length - confirmedCount)}</span></div>
          <div className="review-queue-list">{reviewQueue.map((barangay) => <button type="button" key={barangay.id} className="review-queue-row" onClick={() => onOpenBarangay(barangay)}><span className="queue-row-copy"><strong>{barangay.name}</strong><small>{formatNumber(barangay.pins.length)} site pins · {barangay.puroks.length ? `${barangay.puroks.length} puroks` : "puroks not recorded"}</small></span><span className="queue-arrow" aria-hidden="true">↗</span></button>)}{reviewQueue.length === 0 && <div className="queue-complete"><span>✓</span><strong>All barangays are confirmed</strong><p>New changes can reopen a barangay for another review.</p></div>}</div>
        </section>
      </div>

      <section className="dashboard-activity-panel" aria-labelledby="recent-activity-title">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Review history</p><h2 id="recent-activity-title">Recent activity</h2></div><span className="dashboard-coverage-tag">{activityLog.length} changes recorded</span></div>
        {recentEntries.length ? <ol className="dashboard-recent-list">{recentEntries.map((entry) => <li key={entry.id}><span className="recent-activity-icon">↶</span><div><strong>{entry.action}</strong><small>{entry.itemName} · {entry.barangayName}</small></div><time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time></li>)}</ol> : <p className="dashboard-activity-empty">The activity log will fill in as you review barangays together.</p>}
      </section>
    </section>
  );
}

export default App;
