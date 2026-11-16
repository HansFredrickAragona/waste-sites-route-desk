import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";

export function collectionPoint(pin) {
  return [Number(pin.latitude), Number(pin.longitude)];
}

export default function BarangaySiteOverlay({ barangay }) {
  return <>
    {barangay.firingLines.map((line) => (
      <Polyline key={line.id} positions={line.coordinates} bubblingMouseEvents={false}
        pathOptions={{ color: "#7568ad", weight: 4, dashArray: line.sample ? "6 6" : "9 6" }}>
        <Tooltip sticky>{line.name}{line.sample ? " (demo example)" : " (firing line)"}</Tooltip>
      </Polyline>
    ))}
    {barangay.pins.filter(hasMapCoordinates).map((pin) => (
      <CircleMarker key={pin.id} center={collectionPoint(pin)} radius={5} bubblingMouseEvents={false}
        pathOptions={{ color: "#fff", weight: 2, fillColor: pin.sourceStatus === "removed" ? "#64748b" : "#086c49", fillOpacity: 1 }}>
        <Tooltip>{pin.name || "Collection site"}{pin.sourceStatus === "removed" ? " (removed)" : ""}</Tooltip>
      </CircleMarker>
    ))}
  </>;
}
