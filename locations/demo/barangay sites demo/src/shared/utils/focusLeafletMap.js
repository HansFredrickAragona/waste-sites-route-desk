export function focusLeafletMap(map, focus, { pointZoom, singleZoom, boundsZoom, padding }) {
  const duration = 0.6;
  if (focus.type === "point") {
    map.flyTo(focus.point, focus.zoom ?? pointZoom, { duration });
  } else if (focus.type === "bounds" && focus.points.length === 1) {
    map.flyTo(focus.points[0], focus.maxZoom ?? singleZoom, { duration });
  } else if (focus.type === "bounds" && focus.points.length > 1) {
    map.flyToBounds(focus.points, { padding, maxZoom: focus.maxZoom ?? boundsZoom, duration });
  }
}
