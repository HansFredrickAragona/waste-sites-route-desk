import { useMemo } from "react";
import { Polygon, Tooltip } from "react-leaflet";
import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
import { clusterName, clusterColor } from "../data/clusterColors.js";
import { siteCoverage } from "../data/siteCoverage.js";

export default function BarangayCoverage({ barangays, selectedId, onSelect }) {
  const areas = useMemo(() => barangays.map(barangay => ({
    barangay,
    points: siteCoverage(barangay.pins.filter(hasMapCoordinates).map(pin => [Number(pin.latitude), Number(pin.longitude)])),
  })).filter(area => area.points.length), [barangays]);
  return areas.map(({ barangay, points }) => <Polygon
    key={barangay.id}
    positions={points}
    bubblingMouseEvents={false}
    pathOptions={{ color: clusterColor(clusterName(barangay.name)), weight: selectedId === barangay.id ? 3 : 1.5, fillOpacity: selectedId === barangay.id ? 0.24 : 0.10 }}
    eventHandlers={{ click: () => onSelect(barangay.id, null) }}
  ><Tooltip sticky>{barangay.name} · {clusterName(barangay.name)} · Approximate site coverage</Tooltip></Polygon>);
}
