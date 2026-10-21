import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ALL_BARANGAYS } from "../data/scheduleModel.js";
import { isQrtAreaName } from "../data/scheduleCellPresentation.js";
import CellReviewToggle from "./CellReviewToggle.jsx";
import DataNotes from "./DataNotes.jsx";
import GoogleStreetViewEditor from "./GoogleStreetViewEditor.jsx";
import MapEditingTools from "./MapEditingTools.jsx";
import QrtPreviousRoutePanel from "./QrtPreviousRoutePanel.jsx";
import SiteDetailsCard from "./SiteDetailsCard.jsx";

const tileUrl = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const emptyCoordinateList = [];

function featurePoints(features) {
  return features.flatMap((feature) => Array.isArray(feature.coordinates)
    ? feature.coordinates.filter((point) => Array.isArray(point) && point.length >= 2)
    : []);
}

function FitMapContent({ sites, firingLines, estimatedAreaPoints = emptyCoordinateList, fallbackCenter }) {
  const map = useMap();
  const visiblePoints = useMemo(() => [
    ...sites.map((site) => [site.latitude, site.longitude]),
    ...featurePoints(firingLines),
  ], [firingLines, sites]);
  const points = useMemo(
    () => visiblePoints.length > 0 ? visiblePoints : estimatedAreaPoints,
    [estimatedAreaPoints, visiblePoints],
  );
  const hasVisiblePoints = visiblePoints.length > 0;
  const fallbackLatitude = fallbackCenter?.[0] ?? null;
  const fallbackLongitude = fallbackCenter?.[1] ?? null;

  useEffect(() => {
    if (points.length === 0) {
      if (Number.isFinite(fallbackLatitude) && Number.isFinite(fallbackLongitude)) {
        map.setView([fallbackLatitude, fallbackLongitude], 13);
      }
      return;
    }
    const bounds = L.latLngBounds(points);
    if (points.length === 1) {
      map.setView(bounds.getCenter(), hasVisiblePoints ? 15 : 14);
    } else {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: hasVisiblePoints ? 16 : 14 });
    }
  }, [fallbackLatitude, fallbackLongitude, hasVisiblePoints, map, points]);

  return null;
}

function markerIcon(index, active, isPreviousRoute = false) {
  return L.divIcon({
    className: "site-marker-shell",
    html: `<span class="site-marker${active ? " site-marker--active" : ""}${isPreviousRoute ? " site-marker--previous" : ""}"><span>${index + 1}</span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
  });
}

function vertexIcon() {
  return L.divIcon({
    className: "line-vertex-shell",
    html: "<span class='line-vertex-handle'></span>",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function draftNodeIcon(selected = false, editing = false) {
  return L.divIcon({
    className: "firing-line-draft-node-shell",
    html: `<span class="firing-line-draft-node${selected ? " firing-line-draft-node--selected" : ""}${editing ? " firing-line-draft-node--editing" : ""}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function MapClickHandler({ toolMode, isAddingFeatureNode, onPlaceSite, onAddPoint, onAddFeatureNode, onMoveCursor, onFinishLine, onFinishFeatureNodeDraft }) {
  const map = useMap();

  useEffect(() => {
    if (toolMode === "draw-line" || isAddingFeatureNode) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    return () => map.doubleClickZoom.enable();
  }, [map, toolMode, isAddingFeatureNode]);

  useMapEvents({
    click(event) {
      // Leaflet fires a click for both halves of a double-click. Keep the first
      // endpoint and let dblclick finish the line without adding a duplicate.
      if ((toolMode === "draw-line" || isAddingFeatureNode) && event.originalEvent?.detail > 1) return;
      const point = [event.latlng.lat, event.latlng.lng];
      if (isAddingFeatureNode) {
        onAddFeatureNode(point);
        return;
      }
      if (toolMode === "add-site") onPlaceSite(point);
      if (toolMode === "draw-line" || toolMode === "draw-area") onAddPoint(point);
    },
    mousemove(event) {
      if (toolMode === "draw-line" || isAddingFeatureNode) onMoveCursor([event.latlng.lat, event.latlng.lng]);
    },
    dblclick(event) {
      if (isAddingFeatureNode) {
        event.originalEvent?.preventDefault();
        onFinishFeatureNodeDraft();
        return;
      }
      if (toolMode === "draw-line") {
        event.originalEvent?.preventDefault();
        onFinishLine();
      }
    },
  });
  return null;
}

function MapContents({
  sites,
  firingLines,
  estimatedAreaPoints,
  fallbackCenter,
  activeSiteId,
  editableSiteId,
  selectedFeatureId,
  editingFeatureId,
  toolMode,
  isAddingFeatureNode,
  featureNodeDraft,
  draftPoints,
  cursorPoint,
  selectedDraftNodeIndex,
  editingDraftNodeIndex,
  selectedFeatureNode,
  isEditingDraftLine,
  onHoverSite,
  onSelectSite,
  onDraftSitePosition,
  onSelectFeature,
  onAddFeatureNode,
  onFinishFeatureNodeDraft,
  onMoveVertex,
  onMoveDraftPoint,
  onSelectDraftNode,
  onSelectFeatureNode,
  onPlaceSite,
  onAddPoint,
  onMoveCursor,
  onFinishLine,
}) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url={tileUrl}
        maxZoom={19}
      />
      <FitMapContent
        sites={sites}
        firingLines={firingLines}
        estimatedAreaPoints={estimatedAreaPoints}
        fallbackCenter={fallbackCenter}
      />
      <MapClickHandler
        toolMode={toolMode}
        isAddingFeatureNode={isAddingFeatureNode}
        onPlaceSite={onPlaceSite}
        onAddPoint={onAddPoint}
        onAddFeatureNode={onAddFeatureNode}
        onFinishFeatureNodeDraft={onFinishFeatureNodeDraft}
        onMoveCursor={onMoveCursor}
        onFinishLine={onFinishLine}
      />
      {sites.map((site, index) => {
        const isActive = activeSiteId === site.id;
        const markerName = site.siteName || `Site record ${index + 1} (name not provided)`;
        return (
          <Marker
            key={site.id}
            position={[site.latitude, site.longitude]}
            icon={markerIcon(index, isActive, site.isPreviousRoute)}
            title={`${markerName}${site.isPreviousRoute ? ` · Previous route: ${site.referenceDriverName}, ${site.referenceDay}, ${site.referenceAreaName}` : ""} · ${site.barangay || site.assignedBarangay || "Barangay not provided"}`}
            alt={`${markerName}, ${site.barangay || site.assignedBarangay || "barangay not provided"}`}
            keyboard
            interactive={toolMode === "browse" && !isAddingFeatureNode}
            draggable={!site.isPreviousRoute && editableSiteId === site.id}
            bubblingMouseEvents={false}
            zIndexOffset={isActive ? 1000 : 0}
            eventHandlers={{
              mouseover: () => onHoverSite(site.id),
              mouseout: () => onHoverSite(null),
              click: () => onSelectSite(site.id),
              ...(editableSiteId === site.id ? { dragend: (event) => {
                const position = event.target.getLatLng();
                onDraftSitePosition(site.id, position.lat, position.lng);
              } } : {}),
            }}
          >
            <Tooltip direction="top" offset={[0, -30]}>{markerName}</Tooltip>
          </Marker>
        );
      })}
      {firingLines.map((feature) => {
        const positions = feature.coordinates ?? [];
        const selected = selectedFeatureId === feature.id;
        const style = {
          color: selected ? "#d5783f" : "#645aa8",
          weight: selected ? 5 : 3,
          fillColor: "#8a7ed0",
          fillOpacity: selected ? 0.22 : 0.12,
          dashArray: feature.feature_type === "firing_line" ? "8 6" : undefined,
        };
        const shapeProps = {
          key: feature.id,
          positions,
          pathOptions: style,
          bubblingMouseEvents: false,
          interactive: toolMode === "browse" && !isAddingFeatureNode,
          eventHandlers: { click: () => onSelectFeature(feature.id) },
        };

        return (
          <Fragment key={feature.id}>
            {feature.feature_type === "bounded_area"
              ? <Polygon {...shapeProps} />
              : <Polyline {...shapeProps} />}
            {editingFeatureId === feature.id && positions.map((position, pointIndex) => (
              <Marker
                key={`${feature.id}-vertex-${pointIndex}`}
                position={position}
                icon={feature.feature_type === "firing_line"
                  ? draftNodeIcon(selectedFeatureNode?.featureId === feature.id && selectedFeatureNode?.pointIndex === pointIndex, true)
                  : vertexIcon()}
                draggable
                interactive={!isAddingFeatureNode}
                bubblingMouseEvents={false}
                eventHandlers={{
                  click: () => onSelectFeatureNode(feature.id, pointIndex),
                  dragend: (event) => {
                    const nextPosition = event.target.getLatLng();
                    onMoveVertex(feature.id, pointIndex, [nextPosition.lat, nextPosition.lng]);
                  },
                }}
              />
            ))}
          </Fragment>
        );
      })}
      {featureNodeDraft && (() => {
        const feature = firingLines.find((item) => item.id === featureNodeDraft.featureId);
        const basePoint = feature?.coordinates?.[featureNodeDraft.startIndex];
        if (!feature || !basePoint) return null;
        const draftPositions = [basePoint, ...featureNodeDraft.points];
        const lastDraftPoint = draftPositions[draftPositions.length - 1];
        const cursorIsNew = cursorPoint && (Math.abs(lastDraftPoint[0] - cursorPoint[0]) > 1e-8 || Math.abs(lastDraftPoint[1] - cursorPoint[1]) > 1e-8);
        return (
          <>
            <Polyline
              positions={cursorIsNew ? [...draftPositions, cursorPoint] : draftPositions}
              pathOptions={{ color: "#2878cf", weight: 4, dashArray: "7 5" }}
              interactive={false}
            />
            {featureNodeDraft.points.map((point, index) => (
              <Marker
                key={`feature-node-draft-${feature.id}-${index}`}
                position={point}
                icon={draftNodeIcon(index === featureNodeDraft.points.length - 1, false)}
                interactive={false}
              />
            ))}
          </>
        );
      })()}
      {toolMode === "draw-area" && draftPoints.length > 0 && (
        draftPoints.length > 2
          ? <Polygon positions={draftPoints} pathOptions={{ color: "#b08325", dashArray: "5 5", fillOpacity: 0.1 }} />
          : <Polyline positions={draftPoints} pathOptions={{ color: "#b08325", dashArray: "5 5" }} />
      )}
      {(toolMode === "draw-line" || toolMode === "confirm-line") && draftPoints.length > 0 && (
        <>
          <Polyline
            positions={toolMode === "draw-line" && cursorPoint ? [...draftPoints, cursorPoint] : draftPoints}
            pathOptions={{ color: "#2878cf", weight: 4, dashArray: toolMode === "confirm-line" ? undefined : "7 5" }}
            interactive={false}
          />
          {draftPoints.map((point, index) => (
            <Marker
              key={`draft-line-node-${index}`}
              position={point}
              icon={draftNodeIcon(index === selectedDraftNodeIndex, isEditingDraftLine || index === editingDraftNodeIndex)}
              draggable={isEditingDraftLine || index === editingDraftNodeIndex}
              interactive
              bubblingMouseEvents={false}
              eventHandlers={{
                click: () => onSelectDraftNode(index),
                ...(isEditingDraftLine || index === editingDraftNodeIndex ? { dragend: (event) => {
                  const nextPoint = event.target.getLatLng();
                  onMoveDraftPoint(index, [nextPoint.lat, nextPoint.lng]);
                } } : {}),
              }}
            />
          ))}
        </>
      )}
    </>
  );
}

function makeFeatureId() {
  return globalThis.crypto?.randomUUID?.() ?? `firing-feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizedLabel(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function areaLabelTokens(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").toLocaleLowerCase("en-US")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 4 && !["barangay", "purok", "road", "route", "area"].includes(token)) ?? []
    : [];
}

function matchesBarangay(value, selectedBarangay) {
  const selected = normalizedLabel(selectedBarangay);
  return Boolean(selected && normalizedLabel(value) === selected);
}

function siteMatchesBarangay(site, selectedBarangay) {
  const labels = [
    ...(Array.isArray(site.mapBarangays) ? site.mapBarangays : []),
    site.barangay,
    site.assignedBarangay,
  ];
  if (!site.assignedBarangay) {
    labels.push(site.sourceAreaName, site.dayAreaName, site.areaName);
  }
  return labels
    .some((value) => matchesBarangay(value, selectedBarangay));
}

function areaMatchesBarangay(area, selectedBarangay) {
  const labels = [...(area.mapBarangays ?? []), area.barangay];
  if (!area.barangay) labels.push(area.sourceAreaName || area.dayAreaName || area.areaName);
  return labels.some((value) => matchesBarangay(value, selectedBarangay)) ||
    area.sites.some((site) => siteMatchesBarangay(site, selectedBarangay));
}

export default function SiteMap({
  driver,
  day,
  cellAreas = [],
  barangays = [],
  qrtPreviousAreas = [],
  sites,
  areaLocationSites = [],
  siteRecords,
  unmappedCount,
  removedSiteCount,
  fallbackCenter,
  firingLines,
  undefinedFiringLines = [],
  saveMessage,
  cellNotes = [],
  cellConfirmed = false,
  scheduleIssues = [],
  scheduleContextNotes = [],
  showV3Reports = false,
  onCellConfirmationChange,
  onBack,
  onAddSite,
  onSaveSite,
  onDeleteSite,
  onAddFiringLine,
  onUpdateFiringLine,
  onDeleteFiringLine,
}) {
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [hoveredSiteId, setHoveredSiteId] = useState(null);
  const fixedAssignmentAreas = useMemo(
    () => cellAreas.filter((area) => !isQrtAreaName(
      area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName,
    )),
    [cellAreas],
  );
  const hasQrtAssignment = cellAreas.some((area) => isQrtAreaName(
    area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName,
  ));
  const hasFixedAssignment = fixedAssignmentAreas.length > 0;
  const [addSiteAreaId, setAddSiteAreaId] = useState(fixedAssignmentAreas[0]?.id ?? "");
  const [selectedPreviousAreaId, setSelectedPreviousAreaId] = useState("");
  const [selectedMapBarangay, setSelectedMapBarangay] = useState(ALL_BARANGAYS);
  const [pendingPin, setPendingPin] = useState(null);
  const [draftPinPosition, setDraftPinPosition] = useState(null);
  const [editingSiteId, setEditingSiteId] = useState(null);
  const [toolMode, setToolMode] = useState("browse");
  const [draftPoints, setDraftPoints] = useState([]);
  const [cursorPoint, setCursorPoint] = useState(null);
  const [pendingFiringLine, setPendingFiringLine] = useState(null);
  const [pendingRouteTarget, setPendingRouteTarget] = useState(null);
  const [selectedDraftNodeIndex, setSelectedDraftNodeIndex] = useState(null);
  const [editingDraftNodeIndex, setEditingDraftNodeIndex] = useState(null);
  const [isEditingDraftLine, setIsEditingDraftLine] = useState(false);
  const [selectedFeatureNode, setSelectedFeatureNode] = useState(null);
  const [showNodeStreetView, setShowNodeStreetView] = useState(false);
  const [isAddingFeatureNode, setIsAddingFeatureNode] = useState(false);
  const [featureNodeDraft, setFeatureNodeDraft] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const dayAreaNames = [...new Set(fixedAssignmentAreas
    .map((area) => area.areaName || area.sourceAreaName || area.barangay)
    .filter(Boolean))];
  const fixedBarangays = barangays.filter((name) => !isQrtAreaName(name));
  const selectedPreviousArea = qrtPreviousAreas.find((area) => area.id === selectedPreviousAreaId) ?? null;
  const activeCellAreas = useMemo(
    () => selectedMapBarangay === ALL_BARANGAYS
      ? fixedAssignmentAreas
      : fixedAssignmentAreas.filter((area) => areaMatchesBarangay(area, selectedMapBarangay)),
    [fixedAssignmentAreas, selectedMapBarangay],
  );
  const addableAreas = useMemo(
    () => fixedAssignmentAreas.map((area) => {
      const duplicateBarangayCount = fixedAssignmentAreas.filter((candidate) =>
        normalizedLabel(candidate.barangay) === normalizedLabel(area.barangay),
      ).length;
      return {
        ...area,
        groupId: area.id,
        areaName: area.areaName,
        areaRecordIds: [area.id],
        pinLabel: duplicateBarangayCount > 1 && area.barangay && area.sourceAreaName
          ? `${area.barangay} · ${area.sourceAreaName}`
          : area.barangay || area.sourceAreaName || area.areaName || "Barangay not provided",
      };
    }),
    [fixedAssignmentAreas],
  );
  const visibleSourceSites = useMemo(() => {
    if (selectedMapBarangay === ALL_BARANGAYS) return sites;
    return sites.filter((site) => siteMatchesBarangay(site, selectedMapBarangay));
  }, [sites, selectedMapBarangay]);
  const visibleFiringLines = useMemo(() => {
    if (selectedMapBarangay === ALL_BARANGAYS) return firingLines;
    const activeAreaIds = new Set(activeCellAreas.map((area) => area.id));
    return firingLines.filter((feature) => {
      const featureBarangays = [
        ...(Array.isArray(feature.barangays) ? feature.barangays : []),
        feature.barangay,
      ].filter(Boolean);
      const areaIdsMatch = Array.isArray(feature.area_ids) &&
        feature.area_ids.some((areaId) => activeAreaIds.has(areaId));
      const areaNamesMatch = Array.isArray(feature.area_names) && feature.area_names.some((name) =>
        activeCellAreas.some((area) => [area.sourceAreaName, area.areaName, area.dayAreaName]
          .some((areaName) => normalizedLabel(areaName) === normalizedLabel(name))),
      );
      return featureBarangays.some((value) => matchesBarangay(value, selectedMapBarangay)) || areaIdsMatch || areaNamesMatch;
    });
  }, [activeCellAreas, firingLines, selectedMapBarangay]);
  const estimatedAreaSites = useMemo(() => {
    if (selectedMapBarangay === ALL_BARANGAYS) return [];

    const locationLabels = [
      selectedMapBarangay,
      ...activeCellAreas.flatMap((area) => [
        ...(area.mapBarangays ?? []),
        ...area.sites.flatMap((site) => site.mapBarangays ?? []),
      ]),
    ].filter(Boolean);
    const normalizedLabels = new Set(locationLabels.map(normalizedLabel));
    const availableSites = areaLocationSites.filter((site) =>
      site.status === "active" &&
      Number.isFinite(site.latitude) &&
      Number.isFinite(site.longitude) &&
      Array.isArray(site.barangays) &&
      site.barangays.length > 0,
    );
    const exactMatches = availableSites.filter((site) =>
      site.barangays.some((name) => normalizedLabels.has(normalizedLabel(name))),
    );
    if (exactMatches.length > 0) return exactMatches;

    const locationTokens = new Set(locationLabels.flatMap(areaLabelTokens));
    if (locationTokens.size === 0) return [];
    return availableSites.filter((site) =>
      site.barangays.some((name) => areaLabelTokens(name).some((token) => locationTokens.has(token))),
    );
  }, [activeCellAreas, areaLocationSites, selectedMapBarangay]);
  const estimatedAreaPoints = useMemo(
    () => estimatedAreaSites.map((site) => [site.latitude, site.longitude]),
    [estimatedAreaSites],
  );
  const estimatedAreaCenter = useMemo(() => {
    if (estimatedAreaPoints.length === 0) return null;
    const total = estimatedAreaPoints.reduce(
      ([latitude, longitude], point) => [latitude + point[0], longitude + point[1]],
      [0, 0],
    );
    return total.map((coordinate) => coordinate / estimatedAreaPoints.length);
  }, [estimatedAreaPoints]);
  const visibleUndefinedFiringLines = useMemo(() => {
    // These records have no coordinates, so they cannot be drawn as map
    // geometry. Show their red map notices after the viewer selects an area.
    if (selectedMapBarangay === ALL_BARANGAYS) return [];
    const activeAreaIds = new Set(activeCellAreas.map((area) => area.id));
    return undefinedFiringLines.filter((feature) => activeAreaIds.has(feature.areaId));
  }, [activeCellAreas, selectedMapBarangay, undefinedFiringLines]);
  const activeMapBarangays = selectedMapBarangay === ALL_BARANGAYS
    ? fixedBarangays
    : [selectedMapBarangay];
  const displayedSites = useMemo(() => {
    const positionedSites = visibleSourceSites.map((site) => draftPinPosition?.siteId === site.id
      ? { ...site, latitude: draftPinPosition.latitude, longitude: draftPinPosition.longitude }
      : site);
    const previousRouteSites = (selectedPreviousArea?.sites ?? []).map((site) => ({
      ...site,
      isPreviousRoute: true,
      referenceDriverName: selectedPreviousArea.driverName,
      referenceDay: selectedPreviousArea.day,
      referenceAreaName: selectedPreviousArea.areaName,
    }));
    const pendingPinIsVisible = pendingPin && (
      selectedMapBarangay === ALL_BARANGAYS ||
      siteMatchesBarangay(pendingPin, selectedMapBarangay)
    );
    return pendingPinIsVisible ? [...positionedSites, ...previousRouteSites, {
      ...pendingPin,
      ...(draftPinPosition?.siteId === pendingPin.id
        ? { latitude: draftPinPosition.latitude, longitude: draftPinPosition.longitude }
        : {}),
    }] : [...positionedSites, ...previousRouteSites];
  }, [visibleSourceSites, selectedPreviousArea, pendingPin, draftPinPosition, selectedMapBarangay]);
  const visibleSiteIds = new Set(displayedSites.map((site) => site.id));
  const activeSiteId = visibleSiteIds.has(selectedSiteId)
    ? selectedSiteId
    : visibleSiteIds.has(hoveredSiteId)
      ? hoveredSiteId
      : null;
  const activeSite = displayedSites.find((site) => site.id === selectedSiteId) ?? null;
  const isMapFeatureFocused = Boolean(selectedFeatureId || editingFeatureId || selectedFeatureNode || isAddingFeatureNode);
  const selectedDraftPoint = draftPoints[selectedDraftNodeIndex] ?? null;
  const selectedFeatureForNode = selectedFeatureNode
    ? firingLines.find((feature) => feature.id === selectedFeatureNode.featureId)
    : null;
  const selectedFeaturePoint = selectedFeatureForNode?.coordinates?.[selectedFeatureNode?.pointIndex] ?? null;
  const selectedNodePoint = selectedDraftPoint ?? selectedFeaturePoint;
  const selectedNodeTitle = selectedDraftPoint
    ? `Firing line node ${selectedDraftNodeIndex + 1}`
    : selectedFeatureForNode
      ? `${selectedFeatureForNode.name || "Firing line"} · node ${selectedFeatureNode.pointIndex + 1}`
      : "";
  const selectedNodeKey = selectedDraftPoint
    ? `draft-${selectedDraftNodeIndex}`
    : selectedFeatureForNode
      ? `${selectedFeatureForNode.id}-${selectedFeatureNode.pointIndex}`
      : "";
  const canEditSelectedNode = selectedDraftPoint
    ? isEditingDraftLine || editingDraftNodeIndex === selectedDraftNodeIndex
    : Boolean(selectedFeatureForNode && editingFeatureId === selectedFeatureForNode.id);
  const centerPoint = displayedSites[0]
    ? [displayedSites[0].latitude, displayedSites[0].longitude]
    : featurePoints(visibleFiringLines)[0] ?? estimatedAreaCenter ?? fallbackCenter ?? null;
  const areaIds = addableAreas.map((area) => area.groupId).join("|");

  useEffect(() => {
    if (addableAreas.some((area) => area.groupId === addSiteAreaId)) return;
    setAddSiteAreaId(addableAreas[0]?.groupId ?? "");
  }, [areaIds, addSiteAreaId, addableAreas]);

  useEffect(() => {
    if (selectedMapBarangay === ALL_BARANGAYS || fixedBarangays.some((name) => matchesBarangay(name, selectedMapBarangay))) return;
    setSelectedMapBarangay(ALL_BARANGAYS);
  }, [fixedBarangays, selectedMapBarangay]);

  function handleToolModeChange(mode) {
    setToolMode(mode);
    setDraftPoints([]);
    setCursorPoint(null);
    setPendingFiringLine(null);
    setPendingRouteTarget(null);
    setSelectedDraftNodeIndex(null);
    setEditingDraftNodeIndex(null);
    setIsEditingDraftLine(false);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
    setIsAddingFeatureNode(false);
    setFeatureNodeDraft(null);
    setEditingFeatureId(null);
  }

  function handleMapUndefinedRoute(route) {
    if (!route?.sourceRef || route.sourceRef.segmentIndex === undefined) return;
    setSelectedSiteId(null);
    setHoveredSiteId(null);
    setSelectedFeatureId(null);
    setEditingFeatureId(null);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
    setPendingRouteTarget(route);
    setPendingFiringLine(null);
    setDraftPoints((route.coordinates ?? []).map((point) => [...point]));
    setCursorPoint(null);
    setSelectedDraftNodeIndex(null);
    setEditingDraftNodeIndex(null);
    setIsEditingDraftLine(false);
    setToolMode("draw-line");
  }

  function handleMapBarangayChange(barangay) {
    if (pendingPin || editingSiteId || pendingFiringLine) return;
    setSelectedMapBarangay(barangay);
    setSelectedSiteId(null);
    setHoveredSiteId(null);
    setSelectedFeatureId(null);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
    setIsAddingFeatureNode(false);
    setFeatureNodeDraft(null);
    setCursorPoint(null);
    setEditingFeatureId(null);
  }

  function handlePlaceSite(coordinates) {
    if (!addSiteAreaId || pendingPin || editingSiteId) return;
    const selectedArea = addableAreas.find((area) => area.groupId === addSiteAreaId);
    if (!selectedArea) return;
    const selectedAreaBarangayLabels = [
      ...(selectedArea.mapBarangays ?? []),
      ...selectedArea.sites.flatMap((site) => site.mapBarangays ?? []),
    ];
    const selectedBarangay = barangays.find((candidate) =>
      selectedAreaBarangayLabels.some((label) => matchesBarangay(candidate, label)),
    );
    if (selectedBarangay) setSelectedMapBarangay(selectedBarangay);
    const newSiteId = `pending-${makeFeatureId()}`;
    setPendingPin({
      id: newSiteId,
      siteName: "",
      mapLabel: "",
      barangay: selectedArea.barangay || selectedArea.assignedBarangay || "",
      assignedBarangay: selectedArea.barangay || selectedArea.assignedBarangay || "",
      areaName: selectedArea.areaName,
      areaGroupId: selectedArea.groupId,
      areaRecordIds: selectedArea.areaRecordIds,
      sourceBarangays: [],
      mapBarangays: selectedBarangay ? [selectedBarangay] : selectedArea.mapBarangays ?? [],
      latitude: coordinates[0],
      longitude: coordinates[1],
      areaSource: selectedArea,
    });
    setDraftPinPosition({ siteId: newSiteId, latitude: coordinates[0], longitude: coordinates[1] });
    setSelectedSiteId(newSiteId);
    setEditingSiteId(newSiteId);
    setToolMode("browse");
  }

  function handleDraftSitePosition(siteId, latitude, longitude) {
    setDraftPinPosition({ siteId, latitude, longitude });
    setSelectedSiteId(siteId);
  }

  function discardPendingPin() {
    setPendingPin(null);
    setDraftPinPosition(null);
    setEditingSiteId(null);
    setSelectedSiteId(null);
    setHoveredSiteId(null);
  }

  function handleSelectSite(siteId) {
    if (siteId === selectedSiteId) return;
    if (pendingPin && !window.confirm("Discard this unsaved collection pin?")) return;
    if (editingSiteId && !pendingPin && !window.confirm("Cancel the unsaved pin edits?")) return;
    if (pendingPin) setPendingPin(null);
    setDraftPinPosition(null);
    setEditingSiteId(null);
    setSelectedFeatureId(null);
    setEditingFeatureId(null);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
    setIsAddingFeatureNode(false);
    setFeatureNodeDraft(null);
    setSelectedSiteId(siteId);
    setToolMode("browse");
  }

  function handleSaveActiveSite(siteId, values) {
    if (pendingPin?.id === siteId) {
      const newSiteId = onAddSite(pendingPin.areaSource, [values.latitude, values.longitude], values);
      if (!newSiteId) return null;
      setPendingPin(null);
      setDraftPinPosition(null);
      setSelectedSiteId(newSiteId);
      setEditingSiteId(null);
      return newSiteId;
    }

    const result = onSaveSite(siteId, values);
    if (result === false || result === null) return result;
    setDraftPinPosition(null);
    setEditingSiteId(null);
    return true;
  }

  function handleCancelSite(siteId) {
    if (pendingPin?.id === siteId) {
      discardPendingPin();
      return;
    }
    setDraftPinPosition(null);
    setEditingSiteId(null);
  }

  function handleFinishDraft() {
    if (toolMode === "draw-line") {
      const linePoints = draftPoints.filter((point, index) => (
        index === 0 ||
        Math.abs(point[0] - draftPoints[index - 1][0]) > 1e-8 ||
        Math.abs(point[1] - draftPoints[index - 1][1]) > 1e-8
      ));
      if (linePoints.length < 2) return;
      setDraftPoints(linePoints);
      setSelectedDraftNodeIndex((current) => current === null ? null : Math.min(current, linePoints.length - 1));
      const routeTarget = pendingRouteTarget;
      setPendingFiringLine({
        id: routeTarget?.id ?? makeFeatureId(),
        feature_type: "firing_line",
        name: routeTarget?.name || `Firing line ${firingLines.length + 1}`,
        coordinates: linePoints.map((point) => [...point]),
        area_ids: routeTarget ? [routeTarget.areaId] : activeCellAreas.map((area) => area.id),
        area_names: routeTarget
          ? [...new Set(activeCellAreas.filter((area) => area.id === routeTarget.areaId).map((area) => area.areaName).filter(Boolean))]
          : [...new Set(activeCellAreas.map((area) => area.areaName).filter(Boolean))],
        barangays: routeTarget?.mapBarangays?.length ? routeTarget.mapBarangays : activeMapBarangays,
        ...(routeTarget?.sourceRef ? { sourceRef: routeTarget.sourceRef } : {}),
      });
      setCursorPoint(null);
      setEditingDraftNodeIndex(null);
      setIsEditingDraftLine(false);
      setToolMode("confirm-line");
      return;
    }

    const isBoundedArea = toolMode === "draw-area";
    const minimumPoints = isBoundedArea ? 3 : 2;
    if (draftPoints.length < minimumPoints) return;
    onAddFiringLine({
      id: makeFeatureId(),
      feature_type: isBoundedArea ? "bounded_area" : "firing_line",
      name: isBoundedArea ? `Bounded area ${firingLines.length + 1}` : `Firing line ${firingLines.length + 1}`,
      coordinates: draftPoints,
      area_ids: activeCellAreas.map((area) => area.id),
      area_names: [...new Set(activeCellAreas.map((area) => area.areaName).filter(Boolean))],
      barangays: activeMapBarangays,
    });
    setDraftPoints([]);
    setCursorPoint(null);
    setToolMode("browse");
  }

  function handleSavePendingFiringLine() {
    if (!pendingFiringLine) return;
    const savedFeature = { ...pendingFiringLine, coordinates: draftPoints.map((point) => [...point]) };
    if (savedFeature.sourceRef?.segmentIndex !== undefined) {
      onUpdateFiringLine(savedFeature.id, savedFeature.coordinates);
      setSelectedFeatureId(savedFeature.id);
      setEditingFeatureId(savedFeature.id);
    } else {
      onAddFiringLine(savedFeature);
    }
    setPendingFiringLine(null);
    setPendingRouteTarget(null);
    setDraftPoints([]);
    setCursorPoint(null);
    setSelectedDraftNodeIndex(null);
    setEditingDraftNodeIndex(null);
    setIsEditingDraftLine(false);
    setToolMode("browse");
  }

  function handleMoveDraftPoint(pointIndex, nextPoint) {
    setDraftPoints((current) => current.map((point, index) => index === pointIndex ? nextPoint : point));
  }

  function handleSelectDraftNode(pointIndex) {
    setSelectedDraftNodeIndex(pointIndex);
    setEditingDraftNodeIndex(null);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
  }

  function handleSelectFeatureNode(featureId, pointIndex) {
    setSelectedFeatureNode({ featureId, pointIndex });
    setSelectedDraftNodeIndex(null);
    setShowNodeStreetView(false);
    setIsAddingFeatureNode(false);
    setFeatureNodeDraft(null);
    setCursorPoint(null);
  }

  function handleToggleAddFeatureNode(featureId) {
    if (isAddingFeatureNode && editingFeatureId === featureId) {
      setIsAddingFeatureNode(false);
      setFeatureNodeDraft(null);
      setCursorPoint(null);
      return;
    }
    const feature = firingLines.find((item) => item.id === featureId);
    if (!feature || feature.feature_type !== "firing_line" || !Array.isArray(feature.coordinates) || feature.coordinates.length < 2) return;
    const selectedIndex = selectedFeatureNode?.featureId === featureId ? selectedFeatureNode.pointIndex : null;
    const startIndex = selectedIndex === 0 ? 0 : feature.coordinates.length - 1;
    setEditingFeatureId(featureId);
    setSelectedFeatureId(featureId);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
    setFeatureNodeDraft({ featureId, startIndex, points: [] });
    setCursorPoint(null);
    setIsAddingFeatureNode(true);
  }

  function handleAddFeatureNode(point) {
    setFeatureNodeDraft((current) => current
      ? { ...current, points: [...current.points, point] }
      : current);
  }

  function handleFinishFeatureNodeDraft() {
    if (!featureNodeDraft || featureNodeDraft.points.length === 0) return;
    const feature = firingLines.find((item) => item.id === featureNodeDraft.featureId);
    if (!feature || feature.feature_type !== "firing_line") return;
    const extendsFromFirstNode = featureNodeDraft.startIndex === 0;
    const coordinates = extendsFromFirstNode
      ? [...featureNodeDraft.points.slice().reverse(), ...feature.coordinates]
      : [...feature.coordinates, ...featureNodeDraft.points];
    onUpdateFiringLine(feature.id, coordinates);
    setSelectedFeatureNode({ featureId: feature.id, pointIndex: extendsFromFirstNode ? 0 : coordinates.length - 1 });
    setShowNodeStreetView(false);
    setIsAddingFeatureNode(false);
    setFeatureNodeDraft(null);
    setCursorPoint(null);
  }

  function handleDeleteSelectedFeatureNode() {
    if (!selectedFeatureNode) return;
    const feature = firingLines.find((item) => item.id === selectedFeatureNode.featureId);
    if (!feature || feature.feature_type !== "firing_line" || feature.coordinates.length <= 2) return;
    const nodeNumber = selectedFeatureNode.pointIndex + 1;
    if (!window.confirm(`Delete node ${nodeNumber} from ${feature.name || "this firing line"}?`)) return;
    const coordinates = feature.coordinates.filter((_, index) => index !== selectedFeatureNode.pointIndex);
    onUpdateFiringLine(feature.id, coordinates);
    setSelectedFeatureNode(null);
    setShowNodeStreetView(false);
  }

  function handleEditDraftNode() {
    if (selectedDraftNodeIndex === null) return;
    setEditingDraftNodeIndex((current) => current === selectedDraftNodeIndex ? null : selectedDraftNodeIndex);
  }

  function handleToggleDraftLineEditing() {
    setIsEditingDraftLine((current) => !current);
    setEditingDraftNodeIndex(null);
  }

  function handleMoveVertex(featureId, pointIndex, nextPoint) {
    const feature = firingLines.find((item) => item.id === featureId);
    if (!feature) return;
    const coordinates = feature.coordinates.map((point, index) => index === pointIndex ? nextPoint : point);
    onUpdateFiringLine(featureId, coordinates);
  }

  function handleStreetViewNodePosition(position) {
    const nextPoint = [position.latitude, position.longitude];
    if (selectedDraftNodeIndex !== null && draftPoints[selectedDraftNodeIndex]) {
      if (!isEditingDraftLine && editingDraftNodeIndex !== selectedDraftNodeIndex) return;
      handleMoveDraftPoint(selectedDraftNodeIndex, nextPoint);
      return;
    }
    if (selectedFeatureNode && selectedFeatureNode.featureId === editingFeatureId) {
      handleMoveVertex(selectedFeatureNode.featureId, selectedFeatureNode.pointIndex, nextPoint);
    }
  }

  return (
    <section className="map-view" aria-labelledby="map-title">
      <div className="map-top-actions">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Weekly schedule
        </button>
      </div>

      <section className="selected-cell-context" aria-label={`Selected schedule cell: ${driver.name}, ${day}`}>
        <div className="selected-cell-heading">
          <strong id="map-title">{driver.name} <span aria-hidden="true">·</span> {day}</strong>
        </div>
        <div className="selected-cell-areas">
          <div className="selected-cell-areas-content">
            <div className="selected-cell-filter-heading">
              {dayAreaNames.length > 0 && <p className="selected-cell-route-name">{dayAreaNames.join(" · ")}</p>}
              <DataNotes
                issues={scheduleIssues}
                contextNotes={scheduleContextNotes}
                selectedCellNotes={cellNotes}
                showV3Reports={showV3Reports}
              />
            </div>
            {hasFixedAssignment ? (
              <div className="selected-cell-chip-row" role="group" aria-label="Filter map by barangay or area">
                <button
                  type="button"
                  className={`selected-cell-area-filter-chip${selectedMapBarangay === ALL_BARANGAYS ? " selected-cell-area-filter-chip--active" : ""}`}
                  aria-pressed={selectedMapBarangay === ALL_BARANGAYS}
                  disabled={Boolean(pendingPin || editingSiteId || pendingFiringLine || toolMode === "draw-line" || toolMode === "draw-area")}
                  onClick={() => handleMapBarangayChange(ALL_BARANGAYS)}
                >
                  All areas
                </button>
                {fixedBarangays.map((barangay) => (
                  <button
                    type="button"
                    className={`selected-cell-area-filter-chip${matchesBarangay(selectedMapBarangay, barangay) ? " selected-cell-area-filter-chip--active" : ""}`}
                    key={barangay}
                    aria-pressed={matchesBarangay(selectedMapBarangay, barangay)}
                    disabled={Boolean(pendingPin || editingSiteId || pendingFiringLine || toolMode === "draw-line" || toolMode === "draw-area")}
                    onClick={() => handleMapBarangayChange(barangay)}
                  >
                    {barangay}
                  </button>
                ))}
                {fixedBarangays.length === 0 && <span className="selected-cell-empty">No mapped area labels in this cell.</span>}
              </div>
            ) : hasQrtAssignment ? (
              <p className="qrt-map-intro">QRT is a relief assignment with no fixed route. Choose another driver’s previous area in the map panel.</p>
            ) : (
              <span className="selected-cell-empty">No barangay or area assignments in this cell.</span>
            )}
            <div className="selected-cell-actions" aria-label="Map actions">
              <div className="map-count-card">
                <span className="map-count-number">{displayedSites.length}</span>
                <span>
                  site pin{displayedSites.length === 1 ? "" : "s"} on map
                  {selectedPreviousArea && <small> · blue pins are reference stops</small>}
                  {pendingPin && <small> · 1 unsaved draft</small>}
                </span>
              </div>
              {hasFixedAssignment && <>
              <label className="map-action-area-select">
                <span>Pin assignment</span>
                <select
                  aria-label="Schedule assignment for new collection pin"
                  value={addSiteAreaId}
                  disabled={!centerPoint || addableAreas.length === 0 || Boolean(pendingPin || editingSiteId || pendingFiringLine)}
                  onChange={(event) => setAddSiteAreaId(event.target.value)}
                >
                  {addableAreas.length === 0
                    ? <option value="">No schedule assignments</option>
                    : addableAreas.map((area) => <option key={area.groupId} value={area.groupId}>{area.pinLabel}</option>)}
                </select>
              </label>
              <button
                type="button"
                className={`tool-button${toolMode === "add-site" ? " tool-button--active" : ""}`}
                disabled={!centerPoint || addableAreas.length === 0 || Boolean(pendingPin || editingSiteId || pendingFiringLine)}
                aria-pressed={toolMode === "add-site"}
                onClick={() => handleToolModeChange(toolMode === "add-site" ? "browse" : "add-site")}
              >
                {toolMode === "add-site" ? "Cancel pin placement" : "Add collection pin"}
              </button>
              {[
                { mode: "draw-line", label: "Add firing line" },
                { mode: "draw-area", label: "Add bounded area" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  className={`tool-button${toolMode === mode ? " tool-button--active" : ""}`}
                  disabled={!centerPoint || Boolean(pendingPin || editingSiteId || pendingFiringLine)}
                  aria-pressed={toolMode === mode}
                  onClick={() => handleToolModeChange(toolMode === mode ? "browse" : mode)}
                >
                  {toolMode === mode
                    ? mode === "draw-line" && pendingRouteTarget
                      ? "Mapping route…"
                      : `Drawing ${mode === "draw-line" ? "firing line" : "bounded area"}…`
                    : label}
                </button>
              ))}
              {(toolMode === "draw-line" || toolMode === "draw-area") && (
                <>
                  <button type="button" className="primary-small-button" disabled={draftPoints.length < (toolMode === "draw-area" ? 3 : 2)} onClick={handleFinishDraft}>
                    {toolMode === "draw-line" ? pendingRouteTarget ? "Review route" : "Review firing line" : "Finish bounded area"}
                  </button>
                  {toolMode === "draw-area" && (
                    <button type="button" className="quiet-small-button" onClick={() => handleToolModeChange("browse")}>Cancel</button>
                  )}
                </>
              )}
              </>}
            </div>
            {toolMode === "add-site" && <p className="map-action-status" role="status">Click the map to place a draft pin. It is saved only after you confirm the details.</p>}
            {toolMode === "draw-area" && (
              <p className="map-action-status" role="status">Click the map to add points, then finish the bounded area.</p>
            )}
          </div>
        </div>
      </section>

      {displayedSites.length === 0 && (
        <p className="map-empty-inline" role="status">
          {hasQrtAssignment && !hasFixedAssignment
            ? selectedPreviousArea
              ? `No mapped pins are available in ${selectedPreviousArea.driverName}’s ${selectedPreviousArea.day} assignment for ${selectedPreviousArea.areaName}.`
              : "QRT has no fixed route. Select another driver’s previous route or area to view its mapped stops."
            : <>No mapped pins are available for these assignments. {centerPoint
              ? <>Use <strong>Add collection pin</strong> above to start a new pin.</>
              : "No coordinates are available to center the map and place a new feature."}</>}
          {siteRecords > 0 && <> {unmappedCount} assigned site record{unmappedCount === 1 ? " has" : "s have"} no usable coordinates.</>}
          {removedSiteCount > 0 && <> {removedSiteCount} record{removedSiteCount === 1 ? " is" : "s are"} marked removed in the SWMD index.</>}
        </p>
      )}

      <div className="map-layout">
        <div className="map-frame" aria-label={`Map of ${displayedSites.length} collection sites, ${visibleFiringLines.length} saved firing-line features, and ${visibleUndefinedFiringLines.length} firing-line records without coordinates`}>
          {centerPoint ? (
            <MapContainer
              center={centerPoint}
              zoom={displayedSites.length > 0 || visibleFiringLines.length > 0 || estimatedAreaPoints.length > 0 ? 14 : 13}
              scrollWheelZoom
              zoomControl
              className={`leaflet-map${toolMode === "draw-line" ? " leaflet-map--drawing-line" : ""}${isAddingFeatureNode ? " leaflet-map--adding-feature-node" : ""}`}
              preferCanvas
            >
              <MapContents
                sites={displayedSites}
                firingLines={visibleFiringLines}
                estimatedAreaPoints={estimatedAreaPoints}
                fallbackCenter={centerPoint}
                activeSiteId={activeSiteId}
                editableSiteId={editingSiteId}
                selectedFeatureId={selectedFeatureId}
                editingFeatureId={editingFeatureId}
                toolMode={toolMode}
                isAddingFeatureNode={isAddingFeatureNode}
                featureNodeDraft={featureNodeDraft}
                draftPoints={draftPoints}
                cursorPoint={cursorPoint}
                selectedDraftNodeIndex={selectedDraftNodeIndex}
                editingDraftNodeIndex={editingDraftNodeIndex}
                selectedFeatureNode={selectedFeatureNode}
                isEditingDraftLine={isEditingDraftLine}
                onHoverSite={setHoveredSiteId}
                onSelectSite={handleSelectSite}
                onDraftSitePosition={handleDraftSitePosition}
                onSelectFeature={(featureId) => {
                  setSelectedSiteId(null);
                  setHoveredSiteId(null);
                  setSelectedFeatureNode(null);
                  setShowNodeStreetView(false);
                  setIsAddingFeatureNode(false);
                  setFeatureNodeDraft(null);
                  setCursorPoint(null);
                  setSelectedFeatureId(featureId);
                }}
                onMoveVertex={handleMoveVertex}
                onMoveDraftPoint={handleMoveDraftPoint}
                onSelectDraftNode={handleSelectDraftNode}
                onSelectFeatureNode={handleSelectFeatureNode}
                onAddFeatureNode={handleAddFeatureNode}
                onFinishFeatureNodeDraft={handleFinishFeatureNodeDraft}
                onPlaceSite={handlePlaceSite}
                onAddPoint={(point) => {
                  setSelectedDraftNodeIndex(draftPoints.length);
                  setEditingDraftNodeIndex(null);
                  setDraftPoints((current) => [...current, point]);
                  setCursorPoint(point);
                }}
                onMoveCursor={setCursorPoint}
                onFinishLine={handleFinishDraft}
              />
            </MapContainer>
          ) : (
            <div className="map-no-center" role="status">
              <strong>No coordinates are available to center this map.</strong>
              <span>{hasQrtAssignment && !hasFixedAssignment
                ? "Choose a previous area with mapped pins to center the map."
                : "Add valid coordinates to the selected JSON before placing new features."}</span>
            </div>
          )}
        </div>
        <aside className="map-side-panel" aria-label="Map tools and selected pin details">
          {hasQrtAssignment && (
            <QrtPreviousRoutePanel
              areas={qrtPreviousAreas}
              selectedAreaId={selectedPreviousAreaId}
              onChange={(areaId) => {
                setSelectedPreviousAreaId(areaId);
                setSelectedSiteId(null);
                setHoveredSiteId(null);
              }}
            />
          )}
          {toolMode === "draw-line" && (
            <section className="firing-line-draw-panel" aria-labelledby="firing-line-draw-title" aria-live="polite">
              <div className="firing-line-draw-heading">
                <span className="firing-line-mode-dot" aria-hidden="true" />
                <div>
                  <p className="eyebrow">Drawing mode</p>
                  <h3 id="firing-line-draw-title">{pendingRouteTarget ? "Mapping route segment" : "Adding a firing line"}</h3>
                </div>
              </div>
              <p>{pendingRouteTarget
                ? `Add map nodes for ${pendingRouteTarget.name}. Double-click to finish and review the route.`
                : "Click the map to place blue pins. Use Edit pins to move any placed pin. Double-click to finish and review."}</p>
              <div className="firing-line-draw-meta"><strong>{draftPoints.length}</strong> node{draftPoints.length === 1 ? "" : "s"} placed</div>
              <div className="firing-line-draw-actions">
                <button type="button" className="primary-small-button" disabled={draftPoints.length < 2} onClick={handleFinishDraft}>Finish and review</button>
                <button type="button" className="quiet-small-button" onClick={handleToggleDraftLineEditing}>{isEditingDraftLine ? "Done editing pins" : "Edit pins"}</button>
                <button type="button" className="quiet-small-button" onClick={() => handleToolModeChange("browse")}>Cancel drawing</button>
              </div>
            </section>
          )}
          {toolMode === "confirm-line" && pendingFiringLine && (
            <section className="firing-line-draw-panel firing-line-draw-panel--review" aria-labelledby="firing-line-review-title" aria-live="polite">
              <div className="firing-line-draw-heading">
                <span className="firing-line-mode-dot" aria-hidden="true" />
                <div>
                  <p className="eyebrow">Ready to save</p>
                  <h3 id="firing-line-review-title">{pendingFiringLine.sourceRef?.segmentIndex !== undefined ? "Review route segment" : "Review firing line"}</h3>
                </div>
              </div>
              <p>{pendingFiringLine.sourceRef?.segmentIndex !== undefined
                ? "Check the route on the map. Edit pins to move nodes before saving it to this schedule segment."
                : "Check the line on the map. Edit pins to move any blue pin, then save the confirmed locations."}</p>
              <div className="firing-line-draw-meta"><strong>{draftPoints.length}</strong> nodes · {pendingFiringLine.name}</div>
              <div className="firing-line-draw-actions">
                <button type="button" className="primary-small-button" onClick={handleSavePendingFiringLine}>
                  {pendingFiringLine.sourceRef?.segmentIndex !== undefined ? "Save route" : "Save firing line"}
                </button>
                <button type="button" className="quiet-small-button" onClick={handleToggleDraftLineEditing}>{isEditingDraftLine ? "Done editing pins" : "Edit pins"}</button>
                <button type="button" className="quiet-small-button" onClick={() => { setPendingFiringLine(null); setCursorPoint(null); setToolMode("draw-line"); }}>Keep editing</button>
                <button type="button" className="danger-text-button" onClick={() => handleToolModeChange("browse")}>Discard line</button>
              </div>
            </section>
          )}
          {selectedNodePoint && (
            (selectedDraftPoint && (toolMode === "draw-line" || toolMode === "confirm-line")) ||
            (selectedFeatureForNode && editingFeatureId === selectedFeatureForNode.id)
          ) && (
            <section className="firing-line-node-panel" aria-labelledby="firing-line-node-title" aria-live="polite">
              <div>
                <p className="eyebrow">Selected node</p>
                <h4 id="firing-line-node-title">{selectedNodeTitle}</h4>
              </div>
              <dl className="firing-line-node-coordinates">
                <div><dt>Latitude</dt><dd>{selectedNodePoint[0].toFixed(6)}</dd></div>
                <div><dt>Longitude</dt><dd>{selectedNodePoint[1].toFixed(6)}</dd></div>
              </dl>
              <p>{selectedDraftPoint
                ? isEditingDraftLine || editingDraftNodeIndex === selectedDraftNodeIndex
                  ? "Move this node on the map or in Street View. The firing line is saved after you confirm it."
                  : "This node is read-only. Choose Edit location before moving it or updating it from Street View."
                : "This node belongs to a saved map feature. Move it on the map or use Street View to update its location."}</p>
              {selectedDraftPoint && !isEditingDraftLine && (
                <button type="button" className="quiet-small-button" onClick={handleEditDraftNode}>
                  {editingDraftNodeIndex === selectedDraftNodeIndex ? "Done editing location" : "Edit location"}
                </button>
              )}
              {selectedFeatureForNode?.feature_type === "firing_line" && editingFeatureId === selectedFeatureForNode.id && (
                <button
                  type="button"
                  className="danger-text-button firing-line-delete-node-button"
                  disabled={selectedFeatureForNode.coordinates.length <= 2}
                  onClick={handleDeleteSelectedFeatureNode}
                  title={selectedFeatureForNode.coordinates.length <= 2 ? "A firing line must keep at least two nodes." : undefined}
                >
                  {selectedFeatureForNode.coordinates.length <= 2 ? "At least two nodes are required" : "Delete selected node"}
                </button>
              )}
              <div className="firing-line-node-street-view">
                <a
                  className="firing-line-street-view-link"
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedNodePoint[0]},${selectedNodePoint[1]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open this node in Google Street View <span aria-hidden="true">↗</span>
                </a>
                {googleMapsApiKey && canEditSelectedNode ? (
                  <>
                    <button
                      type="button"
                      className="quiet-small-button"
                      aria-expanded={showNodeStreetView}
                      onClick={() => setShowNodeStreetView((current) => !current)}
                    >
                      {showNodeStreetView ? "Close in-app Street View" : "Open in-app Street View"}
                    </button>
                    {showNodeStreetView && (
                      <GoogleStreetViewEditor
                        key={selectedNodeKey}
                        apiKey={googleMapsApiKey}
                        latitude={selectedNodePoint[0]}
                        longitude={selectedNodePoint[1]}
                        onPositionChange={handleStreetViewNodePosition}
                        onUsePosition={handleStreetViewNodePosition}
                        instructions="The selected node follows the panorama. Its coordinates update here as you navigate."
                      />
                    )}
                  </>
                ) : googleMapsApiKey ? (
                  <p className="imagery-note">Choose Edit location or Edit pins before using in-app Street View to move this node.</p>
                ) : (
                  <p className="imagery-note">In-app Street View is unavailable here. The Google Maps link opens this node’s coordinates for imagery and location review.</p>
                )}
              </div>
            </section>
          )}
          {(toolMode === "browse" || toolMode === "add-site") && !isMapFeatureFocused &&
            (activeSite || !hasQrtAssignment || hasFixedAssignment) && (
            <SiteDetailsCard
              site={activeSite}
              readOnly={Boolean(activeSite?.isPreviousRoute)}
              isNew={pendingPin?.id === activeSite?.id}
              positionUpdate={draftPinPosition}
              onDraftPosition={handleDraftSitePosition}
              onEditModeChange={(siteId) => {
                setEditingSiteId(siteId);
                if (siteId) setToolMode("browse");
              }}
              onCancel={handleCancelSite}
              onSave={handleSaveActiveSite}
              onDelete={(site) => {
                onDeleteSite(site);
                setSelectedSiteId(null);
                setEditingSiteId(null);
              }}
              saveMessage={saveMessage}
            />
          )}
          {toolMode === "browse" && !editingSiteId && !pendingPin &&
            (!hasQrtAssignment || hasFixedAssignment) && (
            <MapEditingTools
              firingLines={visibleFiringLines}
              undefinedFiringLines={visibleUndefinedFiringLines}
              showAreaSelectionHint={selectedMapBarangay === ALL_BARANGAYS && undefinedFiringLines.length > 0}
              selectedFeatureId={selectedFeatureId}
              editingFeatureId={editingFeatureId}
              selectedFeatureNode={selectedFeatureNode}
              isAddingFeatureNode={isAddingFeatureNode}
              featureNodeDraft={featureNodeDraft}
              onSelectFeature={(id) => {
                setSelectedSiteId(null);
                setHoveredSiteId(null);
                setSelectedFeatureNode(null);
                setShowNodeStreetView(false);
                setIsAddingFeatureNode(false);
                setFeatureNodeDraft(null);
                setCursorPoint(null);
                setSelectedFeatureId((current) => current === id ? null : id);
              }}
              onEditFeature={(id) => {
                setSelectedSiteId(null);
                setHoveredSiteId(null);
                setSelectedFeatureNode(null);
                setShowNodeStreetView(false);
                setIsAddingFeatureNode(false);
                setFeatureNodeDraft(null);
                setCursorPoint(null);
                setEditingFeatureId(id);
                setSelectedFeatureId(id);
              }}
              onAddNode={handleToggleAddFeatureNode}
              onFinishAddingNodes={handleFinishFeatureNodeDraft}
              onMapUndefinedRoute={handleMapUndefinedRoute}
              onDeleteFeature={(id) => {
                onDeleteFiringLine(id);
                if (selectedFeatureId === id) setSelectedFeatureId(null);
                if (editingFeatureId === id) setEditingFeatureId(null);
                if (selectedFeatureNode?.featureId === id) setSelectedFeatureNode(null);
                setShowNodeStreetView(false);
                setIsAddingFeatureNode(false);
                setFeatureNodeDraft(null);
                setCursorPoint(null);
              }}
            />
          )}
        </aside>
      </div>

      {sites.length > 0 && unmappedCount > 0 && (
        <p className="mapping-note" role="note">
          {unmappedCount} scheduled site record{unmappedCount === 1 ? "" : "s"} have no valid coordinates and are not shown as pins.
        </p>
      )}

      <CellReviewToggle
        driverName={driver.name}
        day={day}
        confirmed={cellConfirmed}
        onChange={onCellConfirmationChange}
      />
    </section>
  );
}
