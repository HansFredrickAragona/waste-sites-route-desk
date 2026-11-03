import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Marker, Tooltip, useMap } from "react-leaflet";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

import { clusterName, clusterColor } from "../data/clusterColors.js";

const CLUSTER_RADIUS = 56;

function centerIcon(barangay, selected) {
  const state = barangay.confirmed ? "confirmed" : "review";
  return L.divIcon({
    className: "barangay-overview-marker-shell",
    html: `<span style="background:${clusterColor(clusterName(barangay.name))}" class="barangays-overview-marker barangays-overview-marker--${state}${selected ? " barangays-overview-marker--selected" : ""}"></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
  });
}

function clusterIcon(cluster, selected) {
  const confirmed = cluster.items.every(({ barangay }) => barangay.confirmed);
  const color = clusterColor(clusterName(cluster.items[0].barangay.name));
  return L.divIcon({
    className: "barangay-overview-marker-shell",
    html: `<span style="background:${color}" class="barangays-overview-marker barangays-overview-marker--${confirmed ? "confirmed" : "review"} barangays-overview-marker--cluster${selected ? " barangays-overview-marker--selected" : ""}"></span>`,
    iconSize: [36, 38],
    iconAnchor: [18, 36],
  });
}

function clusterLocations(locations, map, zoom) {
  const projected = locations.map((item) => ({ ...item, point: map.project(item.center, zoom) }))
    .sort((a, b) => a.point.x - b.point.x || a.point.y - b.point.y || String(a.barangay.id).localeCompare(String(b.barangay.id)));
  const groups = [];

  for (const item of projected) {
    const nearestGroup = groups
      .map((group) => ({
        group,
        distances: group.items.map((member) => item.point.distanceTo(member.point)),
      }))
      .filter(({ group, distances }) => clusterName(group.items[0].barangay.name) === clusterName(item.barangay.name) && distances.every((distance) => distance <= CLUSTER_RADIUS))
      .sort((a, b) => a.distances.reduce((sum, distance) => sum + distance, 0) - b.distances.reduce((sum, distance) => sum + distance, 0))[0]?.group;

    if (nearestGroup) nearestGroup.items.push(item);
    else groups.push({ items: [item] });
  }

  return groups.map(({ items }) => {
    const point = L.point(
      items.reduce((sum, item) => sum + item.point.x, 0) / items.length,
      items.reduce((sum, item) => sum + item.point.y, 0) / items.length,
    );
    return {
      items,
      center: map.unproject(point, zoom),
      siteRecordCount: items.reduce((sum, item) => sum + item.barangay.pins.length, 0),
    };
  });
}

export default function BarangayOverviewMarkers({ locations, selectedId, selectedGroupIds, onSelectBarangay, onSelectGroup }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    return () => map.off("zoomend", updateZoom);
  }, [map]);

  const groups = useMemo(() => clusterLocations(locations, map, zoom), [locations, map, zoom]);

  return groups.map((group) => {
    if (group.items.length === 1) {
      const { barangay, center } = group.items[0];
      return <Marker
        key={barangay.id}
        position={center}
        icon={centerIcon(barangay, selectedId === barangay.id)}
        title={`${barangay.name} · ${formatNumber(barangay.pins.length)} site records`}
        alt={`${barangay.name} approximate center`}
        zIndexOffset={selectedId === barangay.id ? 1000 : 0}
        bubblingMouseEvents={false}
        riseOnHover
        eventHandlers={{ click: () => onSelectBarangay(barangay.id, center) }}
      >
        <Tooltip>{barangay.name} · {clusterName(barangay.name)} · {formatNumber(barangay.pins.length)} site records</Tooltip>
      </Marker>;
    }

    const ids = group.items.map(({ barangay }) => barangay.id);
    const selected = selectedGroupIds?.length === ids.length && ids.every((id) => selectedGroupIds.includes(id));
    return <Marker
      key={`cluster-${ids.join("-")}`}
      position={group.center}
      icon={clusterIcon(group, selected)}
      title={`${formatNumber(ids.length)} nearby barangays · ${formatNumber(group.siteRecordCount)} site records`}
      alt={`${formatNumber(ids.length)} nearby barangays`}
      bubblingMouseEvents={false}
      riseOnHover
      eventHandlers={{ click: () => onSelectGroup(group) }}
    >
      <Tooltip>{clusterName(group.items[0].barangay.name)} · {formatNumber(ids.length)} barangays · {formatNumber(group.siteRecordCount)} site records · click to zoom in</Tooltip>
    </Marker>;
  });
}
