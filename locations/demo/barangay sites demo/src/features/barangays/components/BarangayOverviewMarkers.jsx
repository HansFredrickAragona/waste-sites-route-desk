import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

import { clusterName, clusterColor } from "../data/clusterColors.js";

function centerIcon(barangay, selected, offset = 0, dimmed = false) {
  const state = barangay.confirmed ? "confirmed" : "review";
  return L.divIcon({
    className: "barangay-overview-marker-shell",
    html: `<span style="background:${clusterColor(clusterName(barangay.name))}" class="barangays-overview-marker barangays-overview-marker--${state}${selected ? " barangays-overview-marker--selected" : ""}${dimmed ? " barangays-overview-marker--dimmed" : ""}"></span>`,
    iconSize: [32, 38],
    iconAnchor: [16 - offset, 36],
  });
}

export default function BarangayOverviewMarkers({ locations, selectedId, activeCluster, onSelectBarangay }) {
  // Offset only the symbol, never the recorded geographic position.
  const sharedCenters = new Map();
  for (const item of locations) {
    const key = item.center.join(",");
    if (!sharedCenters.has(key)) sharedCenters.set(key, []);
    sharedCenters.get(key).push(item.barangay.id);
  }
  for (const ids of sharedCenters.values()) ids.sort();
  return locations.map(({ barangay, center }) => {
      const ids = sharedCenters.get(center.join(","));
      const offset = (ids.indexOf(barangay.id) - (ids.length - 1) / 2) * 36;
      const sharedLabel = ids.length > 1 ? " · Shared recorded center; pin symbol offset for visibility" : "";
      const dimmed = Boolean(activeCluster) && clusterName(barangay.name) !== activeCluster;
      return <Marker
        key={barangay.id}
        position={center}
        icon={centerIcon(barangay, selectedId === barangay.id, offset, dimmed)}
        title={`${barangay.name} · ${formatNumber(barangay.pins.length)} site records${sharedLabel}`}
        alt={`${barangay.name} approximate center`}
        zIndexOffset={selectedId === barangay.id ? 1000 : 0}
        bubblingMouseEvents={false}
        riseOnHover
        eventHandlers={{ click: () => onSelectBarangay(barangay.id, center) }}
      >
        <Tooltip>{barangay.name} · {clusterName(barangay.name)} · {formatNumber(barangay.pins.length)} site records{sharedLabel}</Tooltip>
      </Marker>;
  });
}
