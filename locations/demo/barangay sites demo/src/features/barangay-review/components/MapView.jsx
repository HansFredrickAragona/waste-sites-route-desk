import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BAGUIO_CENTER = [16.4100, 120.5930];

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

function MapInteractions({ mode, onMapClick, onFinishLine, onMapViewChange }) {
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
    moveend(event) {
      const center = event.target.getCenter();
      onMapViewChange({ center: [center.lat, center.lng], zoom: event.target.getZoom() });
    },
  });
  return null;
}

function FitBarangay({ barangay, initialView }) {
  const map = useMap();
  const lastId = useRef(null);

  useEffect(() => {
    if (!barangay || lastId.current === barangay.id) return;
    lastId.current = barangay.id;
    if (initialView) {
      map.setView(initialView.center, initialView.zoom);
      return;
    }
    const points = [
      ...barangay.pins.map((pin) => [pin.latitude, pin.longitude]),
      ...barangay.firingLines.flatMap((line) => line.coordinates ?? []),
    ].filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (points.length === 0) map.setView(BAGUIO_CENTER, 13);
    else if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 16 });
  }, [barangay, initialView, map]);
  return null;
}

function FocusMap({ focus }) {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;
    if (focus.type === "point") {
      map.flyTo(focus.point, focus.zoom ?? 17, { duration: 0.6 });
    } else if (focus.type === "bounds" && focus.points.length === 1) {
      map.flyTo(focus.points[0], focus.maxZoom ?? 15, { duration: 0.6 });
    } else if (focus.type === "bounds" && focus.points.length > 1) {
      map.flyToBounds(L.latLngBounds(focus.points), { padding: [32, 32], maxZoom: focus.maxZoom ?? 16, duration: 0.6 });
    }
  }, [focus, map]);

  return null;
}

function MapResizeObserver() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function BarangayMap({
  barangay,
  focus,
  mapView,
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
  onMapViewChange,
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
    <MapContainer className="review-map" center={mapView?.center ?? BAGUIO_CENTER} zoom={mapView?.zoom ?? 13} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url={TILE_URL}
        maxZoom={19}
      />
      <MapResizeObserver />
      <FitBarangay barangay={barangay} initialView={mapView} />
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
      <MapInteractions mode={mode} onMapClick={onMapClick} onFinishLine={onFinishLine} onMapViewChange={onMapViewChange} />
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
export function MapModeNotice({ mode, linePointCount, selectedLineNodeIndex, onCancel, onFinish, onFinishNodePlacement }) {
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
