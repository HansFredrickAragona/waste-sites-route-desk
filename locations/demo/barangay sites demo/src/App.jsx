import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
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
  buildInitialReview,
  createId,
  loadSavedReview,
  normalizeReviewData,
  persistReview,
  uniqueSiteCount,
} from "./data/reviewData.js";

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BAGUIO_CENTER = [16.4100, 120.5930];
const EMPTY_ACTIVITY = [];

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

function BarangayMap({
  barangay,
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
  onPinDrag,
  onLineVertexDrag,
}) {
  const pins = barangay.pins.map((pin) => pinDraft?.id === pin.id ? pinDraft : pin);
  if (pinDraft?.isNew) pins.push(pinDraft);

  return (
    <MapContainer className="review-map" center={BAGUIO_CENTER} zoom={13} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url={TILE_URL}
        maxZoom={19}
      />
      <FitBarangay barangay={barangay} />
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
              ...(editable ? { dragend: (event) => {
                const point = event.target.getLatLng();
                onPinDrag(point.lat, point.lng);
              } } : {}),
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
            click: () => onSelectLineNode(index),
            dragend: (event) => {
              const next = event.target.getLatLng();
              onSelectLineNode(index);
              onLineVertexDrag(index, [next.lat, next.lng]);
            },
          }}
        />
      ))}
    </MapContainer>
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
      <span>{placement ? "Click the map to place a collection-site pin." : drawing ? `Click to add firing-line nodes · ${linePointCount} placed` : addingNode ? `Click the map to add a node after node ${(selectedLineNodeIndex ?? 0) + 1}.` : "Drag the blue nodes to update the firing-line path."}</span>
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
  const [page, setPage] = useState("barangays");
  const [selectedBarangayId, setSelectedBarangayId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState("all");
  const [notice, setNotice] = useState(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showBarangayDetails, setShowBarangayDetails] = useState(false);
  const [barangayDetailsDraft, setBarangayDetailsDraft] = useState({ puroks: "", notes: "" });
  const [mode, setMode] = useState("browse");
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [pinDraft, setPinDraft] = useState(null);
  const [lineDraft, setLineDraft] = useState(null);
  const [selectedLineNodeIndex, setSelectedLineNodeIndex] = useState(null);
  const [showLineNodeStreetView, setShowLineNodeStreetView] = useState(false);
  const [lineNodeLocationInput, setLineNodeLocationInput] = useState("");
  const [lineNodeLocationError, setLineNodeLocationError] = useState("");
  const [lineNodeLocationMessage, setLineNodeLocationMessage] = useState("");
  const [linePoints, setLinePoints] = useState([]);
  const [pinSearch, setPinSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/maps/swmd_site_index.json`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`SWMD site index returned HTTP ${response.status}.`);
        const index = await response.json();
        if (cancelled) return;
        setReview(loadSavedReview() ?? buildInitialReview(index));
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not read the bundled SWMD site data.");
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!review) return;
    setStorageWarning(!persistReview(review));
  }, [review]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const barangays = review?.barangays ?? [];
  const selectedBarangay = barangays.find((barangay) => barangay.id === selectedBarangayId) ?? null;
  const selectedPin = selectedBarangay?.pins.find((pin) => pin.id === selectedPinId) ?? null;
  const selectedLine = selectedBarangay?.firingLines.find((line) => line.id === selectedLineId) ?? null;
  const selectedLineNode = lineDraft && Number.isInteger(selectedLineNodeIndex)
    ? lineDraft.coordinates[selectedLineNodeIndex] ?? null
    : null;
  const activityLog = review?.activityLog ?? EMPTY_ACTIVITY;
  const siteCount = useMemo(() => uniqueSiteCount(barangays), [barangays]);
  const confirmedCount = barangays.filter((barangay) => barangay.confirmed).length;
  const unconfirmedCount = barangays.length - confirmedCount;
  const needsPurokCount = barangays.filter((barangay) => barangay.puroks.length === 0).length;

  const commitBarangay = useCallback((barangayId, transform, logEntry) => {
    setReview((current) => {
      if (!current) return current;
      const target = current.barangays.find((item) => item.id === barangayId);
      if (!target) return current;
      const timestamp = new Date().toISOString();
      const entry = logEntry ? {
        id: createId("activity"),
        timestamp,
        barangayId,
        barangayName: target.name,
        ...logEntry,
      } : null;
      return {
        ...current,
        updatedAt: timestamp,
        barangays: current.barangays.map((item) => item.id === barangayId ? transform(item) : item),
        activityLog: entry ? [entry, ...(current.activityLog ?? [])].slice(0, 500) : current.activityLog ?? [],
      };
    });
  }, []);

  function openBarangay(barangay) {
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
    setPinSearch("");
  }

  function returnToBarangayList() {
    setPage("barangays");
    setMode("browse");
    setPinDraft(null);
    setLineDraft(null);
    setLinePoints([]);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
  }

  function openDetailsEditor() {
    if (!selectedBarangay) return;
    setBarangayDetailsDraft({ puroks: selectedBarangay.puroks.join("\n"), notes: selectedBarangay.notes });
    setShowBarangayDetails(true);
  }

  function saveBarangayDetails(event) {
    event.preventDefault();
    if (!selectedBarangay) return;
    const puroks = [...new Set(barangayDetailsDraft.puroks.split(/[\n,]/).map((name) => name.trim()).filter(Boolean))];
    const notes = barangayDetailsDraft.notes.trim();
    const changed = JSON.stringify(puroks) !== JSON.stringify(selectedBarangay.puroks) || notes !== selectedBarangay.notes;
    if (changed) {
      commitBarangay(selectedBarangay.id, (current) => ({ ...current, puroks, notes }), {
        action: "Updated barangay details",
        itemType: "Barangay details",
        itemName: selectedBarangay.name,
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
    setPinDraft(null);
    setSelectedPinId(null);
    setSelectedLineId(null);
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setLinePoints([]);
    setMode((current) => current === "place-pin" ? "browse" : "place-pin");
  }

  function beginLineDrawing() {
    if (mode === "draw-line") {
      setLinePoints([]);
      setMode("browse");
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
    setMode("draw-line");
  }

  function beginEditPin(pin) {
    setSelectedPinId(pin.id);
    setSelectedLineId(null);
    setPinDraft({ ...pin, isNew: false });
    setLineDraft(null);
    setSelectedLineNodeIndex(null);
    setShowLineNodeStreetView(false);
    setMode("browse");
  }

  function handleMapClick(point) {
    if (!selectedBarangay) return;
    if (mode === "place-pin") {
      const id = createId("pin");
      setPinDraft({
        id,
        isNew: true,
        name: `Collection site ${selectedBarangay.pins.length + 1}`,
        sourceNames: [],
        latitude: Number(point[0].toFixed(6)),
        longitude: Number(point[1].toFixed(6)),
        sourceStatus: "new",
        sourceRowCount: 0,
        reviewStatus: "needs_review",
        purok: "",
        sourcePuroks: [],
        notes: "",
      });
      setSelectedPinId(id);
      setSelectedLineId(null);
      setMode("browse");
      return;
    }
    if (mode === "add-line-node" && lineDraft) {
      const nextPoint = [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))];
      const insertionIndex = Math.min(
        Math.max((selectedLineNodeIndex ?? lineDraft.coordinates.length - 1) + 1, 0),
        lineDraft.coordinates.length,
      );
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
  }

  function selectPin(pinId) {
    if (pinDraft?.id === pinId) return;
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before selecting another feature." });
      return;
    }
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
    const latitude = Number(pinDraft.latitude);
    const longitude = Number(pinDraft.longitude);
    if (!name) {
      setNotice({ kind: "error", text: "Enter a collection-site name before saving." });
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setNotice({ kind: "error", text: "Enter valid latitude and longitude values." });
      return;
    }
    const savingNew = pinDraft.isNew;
    const nextPin = {
      ...pinDraft,
      name,
      latitude,
      longitude,
      purok: pinDraft.purok || "",
      notes: pinDraft.notes.trim(),
      isNew: undefined,
    };
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
  }

  function beginEditLine(line) {
    if (pinDraft || lineDraft) {
      setNotice({ kind: "error", text: "Save or cancel the open edit before opening another line." });
      return;
    }
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
    setLineDraft((current) => current ? ({
      ...current,
      coordinates: current.coordinates.map((point, index) => index === pointIndex
        ? [Number(latitude.toFixed(6)), Number(longitude.toFixed(6))]
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
    setMode("add-line-node");
  }

  function finishLineNodePlacement() {
    setMode("edit-line");
  }

  function deleteSelectedLineNode() {
    if (!lineDraft || !Number.isInteger(selectedLineNodeIndex) || lineDraft.coordinates.length <= 2) return;
    const nextCoordinates = lineDraft.coordinates.filter((_, index) => index !== selectedLineNodeIndex);
    const nextIndex = Math.min(selectedLineNodeIndex, nextCoordinates.length - 1);
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
    }
    setPendingDelete(null);
  }

  async function handleImport(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = normalizeReviewData(JSON.parse(await file.text()));
      const timestamp = new Date().toISOString();
      const entry = {
        id: createId("activity"),
        timestamp,
        action: "Imported barangay review JSON",
        itemType: "JSON import",
        itemName: file.name,
        barangayId: "all",
        barangayName: "All barangays",
        details: `${imported.barangays.length} barangays loaded`,
      };
      setReview({ ...imported, importedAt: timestamp, activityLog: [entry, ...(imported.activityLog ?? [])].slice(0, 500) });
      setPage("barangays");
      setSelectedBarangayId(null);
      setSelectedPinId(null);
      setSelectedLineId(null);
      setPinDraft(null);
      setLineDraft(null);
      setSelectedLineNodeIndex(null);
      setShowLineNodeStreetView(false);
      setMode("browse");
      setNotice({ kind: "success", text: `${file.name} imported. The review workspace has been updated.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not import this JSON file." });
    } finally {
      input.value = "";
    }
  }

  function exportReview() {
    if (!review) return;
    const exported = { ...review, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barangay-sites-review-${new Date().toISOString().slice(0, 10)}.json`;
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
        <section className="data-load-state data-load-state--error"><span className="data-load-symbol">!</span><div><h2>Barangay data could not be loaded</h2><p>{loadError}</p><p>Start the demo with <code>npm run dev</code> from its folder so the bundled map data can load.</p></div></section>
      </main>
    );
  }

  if (!review) {
    return <main className="app-shell"><section className="data-load-state"><span className="data-load-symbol">…</span><div><h2>Preparing barangay review</h2><p>Loading the bundled SWMD collection-site map.</p></div></section></main>;
  }

  const visiblePins = selectedBarangay?.pins.filter((pin) => {
    const query = pinSearch.trim().toLocaleLowerCase("en-US");
    return !query || [pin.name, pin.purok, ...pin.sourceNames].join(" ").toLocaleLowerCase("en-US").includes(query);
  }) ?? [];

  return (
    <main className="app-shell">
      <header className="sticky-header">
        <div className="app-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 18s5.5-5.1 5.5-9.3a5.5 5.5 0 1 0-11 0C4.5 12.9 10 18 10 18Z" /><circle cx="10" cy="8.5" r="1.8" /></svg></div>
            <div><p className="brand-kicker">Baguio City · Collection-site review</p><p className="brand-name">Barangay sites</p></div>
          </div>
          <div className="global-actions">
            <ActivityLogButton count={activityLog.length} onClick={() => setShowActivity(true)} />
            <input ref={fileInputRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={handleImport} aria-label="Import barangay review JSON" />
            <button className="secondary-action" type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
            <button className="export-schedule-button" type="button" onClick={exportReview}>Export JSON <span aria-hidden="true">↓</span></button>
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
            <div className="source-chip"><span className="source-dot" />SWMD map export <strong>{formatNumber(siteCount)} locations</strong></div>
          </div>
          <div className="directory-metrics">
            <MetricCard tone="green" label="Barangays" value={barangays.length} detail="Areas in this review workspace" icon="⌖" />
            <MetricCard tone="orange" label="Collection sites" value={siteCount} detail="Distinct mapped locations" icon="●" />
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
              {filteredBarangays.length === 0 && <div className="directory-empty"><span>⌕</span><strong>No barangays found</strong><p>Try another name or change the review filter.</p><button className="small-quiet" type="button" onClick={() => { setSearch(""); setListFilter("all"); }}>Clear filters</button></div>}
            </div>
            <p className="directory-footnote">Source data is a bundled SWMD map snapshot. Changes in this demo stay in this browser until exported.</p>
          </section>
        </section>
      )}

      {page === "map" && selectedBarangay && (
        <section className="map-view barangay-map-view" aria-labelledby="barangay-map-title">
          <div className="map-page-heading">
            <div>
              <p className="eyebrow">Barangay map review</p>
              <h1 id="barangay-map-title">{selectedBarangay.name}</h1>
              <p className="map-page-subtitle">Review mapped collection sites, discuss purok assignments, and record what local officials confirm.</p>
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
            <div className="summary-source-note"><span className="source-dot" /><span>Map locations from the bundled SWMD snapshot</span></div>
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
              <div className="map-card-heading"><div><p className="eyebrow">Site locations</p><h2>Collection map</h2></div><span className="map-count-card"><strong className="map-count-number">{formatNumber(selectedBarangay.pins.length)}</strong> pins</span></div>
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
                  onPinDrag={(latitude, longitude) => setPinDraft((current) => current ? ({ ...current, latitude, longitude }) : current)}
                  onLineVertexDrag={(pointIndex, nextPoint) => updateLineNodePosition(pointIndex, nextPoint[0], nextPoint[1])}
                />
                <div className="map-legend"><span><i className="legend-pin" />Collection site</span><span><i className="legend-line" />Firing line</span><span><i className="legend-removed" />Removed in source</span></div>
              </div>
              <div className="map-card-footer"><span>Map tiles by OpenStreetMap</span><span>{selectedBarangay.pins.filter((pin) => pin.sourceStatus !== "removed").length} active · {selectedBarangay.pins.filter((pin) => pin.sourceStatus === "removed").length} removed in source</span></div>
            </section>

            <aside className="map-side-panel barangay-tools-panel" aria-label="Manage collection pins and firing lines">
              <section className="review-panel pin-manager-panel">
                <div className="tools-heading"><div><p className="eyebrow">Collection sites</p><h2>Pins <span>{formatNumber(selectedBarangay.pins.length)}</span></h2></div><button className={`small-action${mode === "place-pin" ? " small-action--active" : ""}`} type="button" onClick={beginPinPlacement} aria-pressed={mode === "place-pin"}>＋ Add pin</button></div>
                {pinDraft ? (
                  <form className="pin-editor" onSubmit={savePin}>
                    <div className="editor-topline"><div><p className="eyebrow">{pinDraft.isNew ? "New site" : "Edit site"}</p><h3>{pinDraft.isNew ? "Collection-site pin" : pinDraft.name}</h3></div><button className="icon-close icon-close--small" type="button" aria-label="Cancel pin editing" onClick={cancelMapMode}>×</button></div>
                    <label className="field-label">Site name<input autoFocus value={pinDraft.name} onChange={(event) => setPinDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Site 3, Riverside drop-off" /></label>
                    <label className="field-label">Assigned purok<select value={pinDraft.purok} onChange={(event) => setPinDraft((current) => ({ ...current, purok: event.target.value }))}><option value="">Unassigned</option>{selectedBarangay.puroks.map((purok) => <option key={purok} value={purok}>{purok}</option>)}</select></label>
                    {selectedBarangay.puroks.length === 0 && <p className="field-help">Add the barangay’s puroks with <strong>Update barangay details</strong> to assign this site.</p>}
                    <div className="coordinate-fields"><label className="field-label">Latitude<input type="number" step="any" value={pinDraft.latitude} onChange={(event) => setPinDraft((current) => ({ ...current, latitude: event.target.value }))} /></label><label className="field-label">Longitude<input type="number" step="any" value={pinDraft.longitude} onChange={(event) => setPinDraft((current) => ({ ...current, longitude: event.target.value }))} /></label></div>
                    <p className="coordinate-help">Drag the highlighted map pin or edit its coordinates.</p>
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
                    <div className="pin-detail-topline"><span className={`pin-status-dot${selectedPin.sourceStatus === "removed" ? " pin-status-dot--removed" : ""}`} /><span className="eyebrow">{selectedPin.sourceStatus === "removed" ? "Removed in source export" : selectedPin.sourceStatus === "new" ? "Added in this review" : "Site record"}</span></div>
                    <h3>{selectedPin.name}</h3>
                    {selectedPin.sourceNames?.length > 1 && <p className="source-aliases">Source labels: {selectedPin.sourceNames.join(" · ")}</p>}
                    <dl className="pin-detail-list">
                      <div><dt>Purok</dt><dd>{selectedPin.purok || <span className="missing-value">Not assigned</span>}</dd></div>
                      <div><dt>Coordinates</dt><dd><code>{coordinateText(selectedPin.latitude, selectedPin.longitude)}</code></dd></div>
                      <div><dt>Source rows</dt><dd>{selectedPin.sourceRowCount || "New record"}</dd></div>
                      {selectedPin.sourcePuroks?.length > 0 && <div><dt>Raw purok field</dt><dd>{selectedPin.sourcePuroks.join(" · ")}</dd></div>}
                      {selectedPin.notes && <div><dt>Review note</dt><dd>{selectedPin.notes}</dd></div>}
                    </dl>
                    <div className="pin-detail-actions"><button className="quiet-small-button" type="button" onClick={() => beginEditPin(selectedPin)}>Edit pin</button><button className="danger-text-button" type="button" onClick={() => requestDelete("pin", selectedPin)}>Delete</button></div>
                  </div>
                ) : (
                  <div className="pin-selection-prompt"><span className="selection-target" aria-hidden="true">⌖</span><strong>Select a pin to review</strong><p>Choose a site below or on the map. Add a new pin by clicking <b>Add pin</b> and placing it on the map.</p></div>
                )}
                <label className="site-search"><span aria-hidden="true">⌕</span><input value={pinSearch} onChange={(event) => setPinSearch(event.target.value)} placeholder="Search sites or puroks" aria-label="Search collection sites" /></label>
                <ul className="site-record-list" aria-label="Collection-site pins">
                  {visiblePins.map((pin, index) => (
                    <li key={pin.id}><button className={`site-record${selectedPinId === pin.id ? " site-record--active" : ""}${pin.sourceStatus === "removed" ? " site-record--removed" : ""}`} type="button" onClick={() => selectPin(pin.id)}>
                      <span className="site-record-number">{index + 1}</span><span className="site-record-copy"><strong>{pin.name}</strong><small>{pin.purok || "Purok not assigned"}{pin.sourceStatus === "removed" ? " · removed" : ""}</small></span><span className="site-record-arrow" aria-hidden="true">›</span>
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
                    <div className="line-node-summary"><span className="line-node-icon">⌁</span><span><strong>{lineDraft.coordinates.length} map nodes</strong><small>Select a blue node to review its coordinates, Street View, and placement.</small></span></div>
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
                          ) : (
                            <p className="imagery-note">In-app Street View needs a Google Maps API key. The Google Maps link and coordinate paste work without one.</p>
                          )}
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
          <div className="details-barangay-name"><span>Selected barangay</span><strong>{selectedBarangay?.name}</strong></div>
          <label className="field-label">Puroks<textarea autoFocus value={barangayDetailsDraft.puroks} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, puroks: event.target.value }))} rows="7" placeholder={"Purok 1\nPurok 2\nPurok 3"} /><small>Enter one purok per line. Commas are also accepted.</small></label>
          <label className="field-label">Barangay review notes<textarea value={barangayDetailsDraft.notes} onChange={(event) => setBarangayDetailsDraft((current) => ({ ...current, notes: event.target.value }))} rows="4" placeholder="Add details or questions raised during the review" /></label>
          <div className="dialog-actions"><button className="quiet-small-button" type="button" onClick={() => setShowBarangayDetails(false)}>Cancel</button><button className="primary-small-button" type="submit">Save details</button></div>
        </form>
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

function Dashboard({ barangays, siteCount, confirmedCount, activityLog, onOpenBarangay }) {
  const largestBarangays = [...barangays].sort((a, b) => b.pins.length - a.pins.length || a.name.localeCompare(b.name)).slice(0, 8);
  const maximumSiteCount = Math.max(1, ...largestBarangays.map((barangay) => barangay.pins.length));
  const reviewQueue = [...barangays].filter((barangay) => !barangay.confirmed).sort((a, b) => b.pins.length - a.pins.length).slice(0, 5);
  const recentEntries = activityLog.slice(0, 5);
  const barangaysWithSites = barangays.filter((barangay) => barangay.pins.length > 0).length;
  const confirmedWithSites = barangays.filter((barangay) => barangay.confirmed && barangay.pins.length > 0).length;
  const siteCoverage = barangaysWithSites === 0 ? 0 : Math.round((confirmedWithSites / barangaysWithSites) * 100);

  return (
    <section className="dashboard-view barangay-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading"><div><p className="eyebrow">Barangay collection-site review</p><h1 id="dashboard-title">Review dashboard</h1><p className="dashboard-subtitle">A quick view of map coverage, barangay confirmations, and review activity.</p></div><div className="dashboard-schedule-chip"><span className="dashboard-live-dot" /><span>Current review copy</span><strong>SWMD site data · browser saved</strong></div></div>
      <div className="dashboard-metrics">
        <MetricCard tone="green" label="Barangays" value={barangays.length} detail="Included in the current review copy" icon="⌖" />
        <MetricCard tone="orange" label="Collection sites" value={siteCount} detail="Distinct mapped locations across barangays" icon="●" />
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
